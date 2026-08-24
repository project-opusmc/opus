import base64, json, socket, subprocess, sys, time, struct, zlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import protocol_smoke as ps

def write_png(path, w, h, bgra):
    # bgra premultiplied first, little-endian 32 => bytes order B,G,R,A per pixel
    # Convert to RGBA rows with PNG filter 0.
    raw = bytearray()
    row = w * 4
    for y in range(h):
        raw.append(0)
        line = bgra[y*row:(y+1)*row]
        # swap B and R
        px = bytearray(line)
        px[0::4], px[2::4] = px[2::4], px[0::4]
        raw.extend(px)
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ+data) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    comp = zlib.compress(bytes(raw), 6)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", comp))
        f.write(chunk(b"IEND", b""))

route = sys.argv[1] if len(sys.argv) > 1 else "title"
out = sys.argv[2] if len(sys.argv) > 2 else f"/tmp/opus_{route}.png"

httpd, http_port = ps.serve_dist()
port = ps.free_port()
base = f"http://127.0.0.1:{http_port}/"
proc = subprocess.Popen([str(ps.HELPER), "--port", str(port), "--token", ps.TOKEN],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    deadline=time.monotonic()+6; sock=None
    while time.monotonic()<deadline:
        try: sock=socket.create_connection(("127.0.0.1",port),timeout=0.5); break
        except OSError: time.sleep(0.1)
    c=ps.HelperClient(sock)
    c.send_line(f"HELLO {ps.TOKEN}")
    c.read_line(time.monotonic()+5)
    c.send_line("SIZE 960 540")
    c.send_line(f"URL {base}#/{route}")
    w,h,frame=c.next_frame(time.monotonic()+15)
    # let it settle to final render
    t=time.monotonic()+3.5
    while time.monotonic()<t:
        try: w,h,frame=c.next_frame(time.monotonic()+0.6)
        except Exception: break
    # hover the middle-left where a main button should be
    mv=base64.b64encode(json.dumps({"type":"move","x":260,"y":210,"button":0,"deltaY":0}).encode()).decode()
    c.send_line(f"INPUT {mv}")
    try:
        w,h,frame=c.next_frame(time.monotonic()+1.2)
        print("HOVER frame changed")
    except Exception:
        print("HOVER no change")
    write_png(out, w, h, frame)
    print("wrote", out, w, h)
    c.send_line("BYE")
finally:
    try: sock.close()
    except Exception: pass
    try: proc.terminate(); proc.wait(timeout=5)
    except Exception: proc.kill()
    httpd.shutdown()
