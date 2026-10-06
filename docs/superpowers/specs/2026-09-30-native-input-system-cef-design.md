# Native input and CEF connection screens

The user requested continued implementation of working Minecraft-native buttons and CEF presentation for connecting, kicks and disconnection. The current client uses a Retina backbuffer while LWJGL still reports logical mouse coordinates. Native hover and click consumers must normalize that boundary; CEF's existing logical coordinate mapper remains authoritative for its own input.

## Presentation and lifecycle

- Minecraft remains the owner of networking, packet processing, cancellation, terrain loading and disconnect reasons.
- A small adapter retains the original `GuiConnecting`, `GuiDownloadTerrain` or `GuiDisconnected` instance. The CEF host initializes, ticks and closes this delegate. Cancel/Back invokes its native button action, once, on the game thread.
- Java exposes a host-only `connection` route and immutable connection data through the revisioned `ui-state` contract: `phase`, `title`, `detail`, `serverName`, `serverAddress`, `canCancel`.
- Changes between connecting, terrain loading and disconnected advance the navigation revision even when the route ID stays the same. Stale actions cannot affect a newer screen.
- Existing Opus screens are reused for system transitions and returns, retaining their CEF texture and browser lease. No document reload or fabricated progress is used.
- The native system screen provides working presentation/input if CEF is unavailable. CEF failure must not stop networking or strand cancellation.

## Visual direction

Use the existing neutral white/gray liquid glass components, current background media and a centered status surface. Show the actual host/server and localized reason as plain text, with safe wrapping and scrolling for long kick messages. Connecting offers Cancel; disconnection offers Back; terrain loading has no invented cancel behavior or percentage.

## Scope and verification

Inventory/container, sign and merchant screens retain their owners. Native GUI coordinate correction includes hover, click and list consumers, without changing gameplay relative camera motion. Verify native Retina/unscaled behavior, delegate tick/action/close, revision changes and reason serialization, rendered CEF states and real CEF bridge input. Package and install through the existing launcher workflow with a recoverable previous app. Physical in-game click acceptance remains user-driven; do not control their mouse or keyboard.
