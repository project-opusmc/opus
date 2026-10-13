# FPS configuration in the Opus UI — 2026-10-09

The Lunar screenshots define the FPS options and behavior, not the visual design.
FPS now uses the original Opus control center, module sidebar, typography,
switches, navigation, and footer. The cloned full-screen Lunar settings surface
and its Minecraft UI font are removed.

## Configuration and rendering

- Display: scale, reverse order, text shadow, brackets, bracket color, and text
  color. Background: visibility, static width, width, height, border, thickness,
  border color, and background color. Existing placement and opacity controls
  remain available below these sections.
- The native bridge publishes 19 settings rows. Scale uses integer percentages
  from 50 through 400; the Opus UI presents a multiplier. Border thickness uses
  hundredths. Colors retain the runtime `#AARRGGBB` order and independent alpha.
- Color controls include hex, RGB selection, numeric RGBA, alpha, and local
  favorites. Apply saves a draft; Cancel and Escape discard it. Closing a color
  editor returns focus to its swatch. An unchanged Apply still closes the editor.
- Reset is one native save of the FPS appearance defaults and scale. It preserves
  the module's enabled state, placement, opacity, and other modules' preferences.
- Client writes merge changed fields into the latest settings file and adopt the
  saved result. Launcher writes submit only edited preference fields and return
  the authoritative saved settings. Stale owners preserve newer FPS options,
  other modules, unknown fields, and the untouched component of a combined offset.
  Reset explicitly writes every appearance default even from a stale snapshot.
- FPS text, optional brackets, background, and border share the same layout used
  by HUD editor bounds. Fractional scale origins use a transform correction so
  content starts at the saved frame position rather than drifting by rounding.
- Minecraft 1.8.9's font renderer treats alpha values 0–3 as opaque. The adapter
  skips alpha zero and clamps nonzero values 1–3 to 4, preserving RGB and avoiding
  an opaque result. This is a three-level quantization at the bottom of the alpha
  range; higher values are unchanged.

## Verification boundaries

Browser fixture coverage checks every FPS control, ARGB drafts, reset, save/read
error handling, focus, root/nested Escape, and four viewport sizes. Native Java
harnesses check persistence, rendering, HUD lifecycle, all resize corners and
anchors, and fractional scales. The real CEF helper harness reads the actual
native FPS rows and verifies that keyboard changes persist to an isolated
settings file; it also checks return-to-HUD and close navigation.

These harnesses do not substitute for fresh manual multiplayer gameplay,
Bedwars server selection, or user acceptance of HUD drag/resize in a live game.
Installation fingerprints, final check results, and cleanup evidence follow.

## Final verification and installation — 2026-10-10

- UI node tests: 26 passed. Launcher node tests: 3 passed. Both TypeScript and
  production builds passed. The browser contract passed FPS controls, ARGB
  drafts, atomic reset, truthful errors, focus/navigation, and four viewport sizes.
- Offline release Rust workspace: 113 passed, zero failed; one external official
  metadata test remains intentionally ignored. Formatting and release Clippy with
  warnings denied passed after removing two unnecessary borrows in the new loader.
- Legacy Java `check`, system screens, actual Retina screen input, and CEF host
  navigation all passed. FPS appearance/persistence/rendering, frame resize,
  Keystrokes, HUD lifecycle, and Minecraft font alpha regressions passed.
- Modern runtime artifact preparation, verification, and `check` passed. The four
  non-UI runtime artifacts retain their previous bytes. The rebuilt native UI JAR
  is 10,234,062 bytes with SHA-1 `b88df0783db08de29f98ada34c4664faac018ea2`.
  Its launcher pin and the development-only CEF profile manifest pin are updated.
- The fresh legacy CEF helper passed both WebView and host-navigation harnesses
  and is the exact helper packaged and installed. The older installed helper had
  failed to accept its loopback connection during earlier checks.
- Installed `/Applications/Opus Launcher.app` after strict signing and the
  file-only/Web-Surface gate. Installed executable SHA-256:
  `1fb15af21b09a10a90bd0968398142ce8a4b3f453db2185bb85108c615ef2622`.
- All five runtime JARs, the manifest/checksums, executable, and fresh helper were
  compared across canonical output, the app bundle, and the installation.
  Manifest SHA-256:
  `5f928bb5da2e5b7b98c5f05bca05d4fe4e2e75b54ba7ec677bed7ab6004fecc3`.
- Opened the installed Launcher: Ready, valid Standard profile, enabled Play,
  zero running games. Utilities retained enabled FPS at 400%, offset `15 · 16`,
  and enabled Keystrokes at 221%, offset `175 · 107`. Returned to Home without
  changing preferences or starting a multiplayer session.
- Preferences remained byte-identical before installation, after loading the app,
  and after cleanup. SHA-256:
  `780b2797c2d723ff6d11e73f9fc54bf91e72b78b9932f0ae01721d807c8ace65`.
- Removed the exact replaced app backup and 16 verified ignored build/cache
  directories. Sources, tracked Git status, and preferences were preserved.
  Free disk space increased from 18.07 to 20.36 GiB. Canonical runtime artifacts
  and the installed app passed verification again after cleanup.

Full logs, screenshots, settings backup, install fingerprints, and cleanup receipts
are retained in `output/fps-config-20261010/`. Work remains on the existing `main`
checkout; no commit, push, or branch change was performed.
