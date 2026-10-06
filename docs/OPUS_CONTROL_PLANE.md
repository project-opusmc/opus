# Opus semantic control plane

`./scripts/opusctl` controls a running Opus Client without focusing a window or sending mouse/keyboard events.

The launcher gives each Forge session a private revisioned command file:

```text
~/.opus-launcher/sessions/<session>/control.json
~/.opus-launcher/sessions/<session>/control.status.json
```

The Minecraft client consumes commands on the client thread and writes an atomic status acknowledgement. The control plane deliberately has no click, drag, key, mouse, or focus operations.

```bash
./scripts/opusctl status
./scripts/opusctl metrics
./scripts/opusctl reload-ui
./scripts/opusctl route title
./scripts/opusctl route multiplayer
./scripts/opusctl route mods_catalog
./scripts/opusctl route module_detail --module-id fps
./scripts/opusctl route settings --settings-section game
```

`metrics` reports the canonical route, CEF state, logical viewport, framebuffer, device scale and enforced Minecraft music volume. `reload-ui` acknowledges only after CEF publishes the new reload generation.

A running session must have been launched by a bundle that includes `-Dopus.control.file=...`; sessions started before the control-plane build cannot be retrofitted.
