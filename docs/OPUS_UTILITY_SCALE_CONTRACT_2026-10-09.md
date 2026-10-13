# Launcher and HUD scale contract — 2026-10-09

The Launcher showed `Launcher state unavailable: Opus utility settings file is invalid`
after a HUD editor resize. The actual settings file was valid schema version 1 JSON:
FPS was enabled at 150%, and Keystrokes was enabled at 154%. The game/editor allowed
50–400%, while the Launcher backend still rejected values above 150%. Its `u8`
storage type also could not deserialize values above 255%. The Launcher frontend
independently replaced valid editor scales above 150% with its 100% default.

The fix accepts integer scales from 50 through 400 in backend validation and
frontend hydration. Backend scale storage is `u16`; the JSON schema and preference
keys remain unchanged. Launcher scale sliders share the frontend bounds and use
1% steps so saved values such as 154% remain representable. Positions, enabled
states, opacity, client-specific options, and unknown module preferences are kept.

## Regression evidence

- Before the fix, the Rust regression failed at 154% with the reported invalid-file
  error. The frontend regression failed because saved 154% became 100%.
- The regressions exercise 50, 150, 154, 256, 300, and 400%, including backend
  normalization and atomic save/read roundtrips. Invalid scales 49 and 401 remain
  rejected; frontend non-integer inputs use existing defaults.
- Frontend hydration of the actual saved settings preserves the complete JSON
  value, including Keystrokes at 154%.
- Original settings backup: `/tmp/opus-utility-scale-original-20261009.json`.
- Initial settings SHA-256:
  `5a34819e6cc727f78ab6667d2af932fd48df84635b0c0bb439a3ef03b600b4a9`.

## Installation and verification

- Full offline release Cargo workspace run: 112 passed, zero failed. One live
  official Mojang metadata test remains intentionally ignored because it requires
  external endpoints. Frontend tests: 2 passed, zero failed. The new frontend
  regressions are also registered in `launcher/scripts/check.sh` for Launcher CI.
- TypeScript and Vite production build passed. The complete local app bundle
  passed strict signing and the file-only/Web-Surface gate before installation.
- Installed `/Applications/Opus Launcher.app`. Executable SHA-256:
  `e98cad535a77bde8d7f8bd511c60d1304246d81003ac7a67c05a13b2e36d225f`.
- Observed the previous app's actual error through its accessibility tree. After
  replacement, the actual app showed `Ready`, a valid launch profile, and an
  enabled Play button. Its Utilities page showed FPS enabled at 150% with offset
  `68 · 55`, and Keystrokes enabled at 154% with offset `651 · 89`. Returned the
  app to Home without starting a game or changing preferences.
- Settings remained byte-identical after installation and actual app loading.
  The original SHA-256 above still matches. Independent read-only review found
  no blockers.
- All five runtime JARs, the runtime manifest, and checksums remain byte-identical
  between the canonical artifacts, bundled app, and installed app. No runtime
  artifacts were rebuilt or repinned; the profile remains development-only.
- Removed this install's exact previous-app backup and generated `launcher/target`
  and `launcher/desktop/dist` directories after verification. Recorded free disk
  space increased from 14.98 to 16.79 GiB. Tracked Git status and settings were
  unchanged by cleanup.

Verification receipts and full logs are under `/tmp/opus-utility-scale-*-20261009*`.
Actual Launcher loading and saved values were verified; this Launcher-only fix
does not add fresh manual gameplay, server-join, or HUD drag/resize acceptance.
