# Opus WebView Helper protocol (v1)

> Historical prototype only. Neither this Swift/WKWebView helper nor the later
> CEF OSR helper is part of the OPUS production compositor or input path.
> Core-Mod-first production is Forge + OptiFine + OPUS Core Mod + vanilla
> Minecraft UI. Do not run this protocol or a CEF harness as a production,
> Core Mod, or file-only acceptance test.

Loopback bridge between the Java 8 Minecraft process and a native macOS
WKWebView that renders the Opus web UI offscreen and streams frames back.

Java -> helper (newline-delimited UTF-8):

    HELLO <token>
    SIZE <width> <height>
    URL <url>
    INPUT <base64-json>
    RELOAD
    PING
    BYE

helper -> Java:

    READY\n                                once, after HELLO accepted
    FRAME <width> <height> <byteCount>\n    followed by <byteCount> BGRA bytes
    PONG\n

- Bind: 127.0.0.1 loopback only, ephemeral port from --port.
- Auth: first line must be HELLO <token> matching --token; otherwise dropped.
- Pixels: BGRA (premultiplied, little-endian, 8 bpc), top-left origin,
  stride = width*4, no padding.
- URL: when only the URL fragment (SPA route) changes and the page is already
  loaded, the helper switches routes in place via `location.hash` instead of a
  full reload. A different scheme/host/port/path/query triggers a real load.
- RELOAD: forces a genuine reload of the current URL (desync recovery).
- Identical consecutive frames are suppressed; a resize or reload always resends.
