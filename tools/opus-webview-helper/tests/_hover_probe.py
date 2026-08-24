import base64, json, socket, subprocess, sys, time, http.server, socketserver, threading, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import protocol_smoke as ps

httpd, http_port = ps.serve_dist()
port = ps.free_port()
base = f"http://127.0.0.1:{http_port}/"
proc = subprocess.Popen([str(ps.HELPER), "--port", str(port), "--token", ps.TOKEN],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def h(b): return hashlib.md5(b).hexdigest()[:8]
try:
    deadline=time.monotonic()+6
    sock=None
    while time.monotonic()<deadline:
        try: sock=socket.create_connection(("127.0.0.1",port),timeout=0.5); break
        except OSError: time.sleep(0.1)
    c=ps.HelperClient(sock)
    c.send_line(f"HELLO {ps.TOKEN}")
    print("ready:", c.read_line(time.monotonic()+5))
    c.send_line("SIZE 960 540")
    c.send_line(f"URL {base}#/title")
    w,hgt,frame=c.next_frame(time.monotonic()+15)
    print("first frame", w, hgt, h(frame))
    # settle
    prev=frame; t=time.monotonic()+4
    while time.monotonic()<t:
        try: _,_,prev=c.next_frame(time.monotonic()+0.6)
        except Exception: break
    base_hash=h(prev)
    print("baseline", base_hash)
    for x in (200, 324, 480, 640):
        print(f"--- sweep x={x} ---")
        cur=prev
        for y in range(60,520,20):
            mv=base64.b64encode(json.dumps({"type":"move","x":x,"y":y,"button":0,"deltaY":0}).encode()).decode()
            c.send_line(f"INPUT {mv}")
            try:
                _,_,f=c.next_frame(time.monotonic()+0.8)
                tag="CHANGE" if f!=cur else "-"
                if f!=cur: print(f"  y={y} {h(f)} {tag}")
                cur=f
            except Exception:
                pass
    c.send_line("BYE")
finally:
    try: sock.close()
    except Exception: pass
    try: proc.terminate(); proc.wait(timeout=5)
    except Exception: proc.kill()
    httpd.shutdown()
