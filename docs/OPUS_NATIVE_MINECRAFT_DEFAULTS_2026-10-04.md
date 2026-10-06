# Native Minecraft defaults — 2026-10-04

## Approved scope

The owner approved a one-time native preset for existing and newly created
Opus-managed Minecraft profiles. The clarification is **Quake Pro, 110°**,
not FOV 100°. Later non-music user changes remain authoritative. Music must
remain disabled before boot, on later launches and during play. Other audio
categories, keybinds, sensitivity, resource packs, accounts and worlds are not
changed by this preset. This is not a frontend-preview setting.

Implementation and scoped tests are complete. The subsequently approved input
and Connecting recovery was completed, rebuilt and installed into
`/Applications/Opus Launcher.app`, including this native preset. See the
[final installed receipt](OPUS_INPUT_CONNECTING_RECOVERY_2026-10-04.md) for the
new artifact identity, fresh UI tests, exact-byte/signature checks and recoverable
previous app. Physical game acceptance remains unverified.

The preset-only checkpoint below is retained as historical evidence: its
build-only candidate was deliberately held because UI contracts failed and a
separate concurrent operation changed the installed app/artifact pins. Those
failures and fingerprints are not the current installed release identity.

## Native integration and persistence

- `launcher/crates/engine/src/game_settings.rs` merges the native options
  before the validated `ForgeBootstrap` plan is returned. Both the desktop
  Launcher and the existing CLI production lane use this same launch engine.
  The frozen M3 preview is not selected or altered.
- Each selected managed game directory owns `.opus-native-defaults-v1/`.
  Existing `options.txt` and `optionsof.txt` are backed up byte-for-byte there.
  `originals.json` records which originals existed; `applied` commits only
  after both settings files have been written and synchronized.
- A failed/interrupted migration retains its first originals and can retry.
  Advisory locking prevents concurrent preset writes for the same profile.
  A symlinked game directory is rejected before Forge staging, and checked
  again before preset writes. Setting/backup symlinks and malformed inputs
  are rejected rather than
  followed or silently overwritten. Only approved keys are merged; unrelated
  lines, including resource-pack JSON with colons and Unicode, are retained.
- Later launches only enforce `soundCategory_music:0.0` on an existing
  `options.txt`. If either options file is absent, that new file receives its
  defaults without resetting the other existing file. The OptiFine file is
  otherwise left byte-for-byte unchanged after the migration.
- The existing Client initialization/tick music-volume enforcement remains.
  A new lowest-priority Forge `PlaySoundEvent` subscriber vetoes only the
  `MUSIC` category, including a new playback attempt between volume changes
  and the next tick. The handler does no UI/GL/client-state work on the sound
  thread. Records, UI clicks, blocks, combat and all other categories remain
  unchanged.

No active real profile was edited by this agent or the automated fixtures.
The preset applies through the native launch engine, not through the preview.
A subsequent read-only inspection found an independently created receipt at
01:11:31 local time in the managed profile below; all **70 approved option
values matched** with no conflicting duplicate rows:

`/Users/zvwgvx/.opus-launcher/instances/9e048b4178f8444886a9098ecf6546b1/game/`

Both original backups exist (2264 / 1362 bytes), with presence recorded in
`originals.json`. This proves the current saved configuration of that profile,
not who launched it, live gameplay behavior, or installation of the final
reviewed Launcher candidate.

## Approved values and audited serialization

Minecraft 1.8.9 and the locally imported, pinned OptiFine HD U M5 were inspected
for their actual option keys and enum values. The temporary patched audit JAR
is diagnostic only; it is not redistributed or installed.

| Group | Native defaults |
|---|---|
| FOV | Quake Pro 110°: `fov:1.0`, serialized as `(110 - 70) / 40` |
| Main video | Fast graphics, 12 chunks, Unlimited FPS (`maxFps:260` native sentinel), VSync OFF, smooth lighting/level OFF, view bobbing OFF, GUI Large, VBOs ON, Brightness Bright, alternate blocks ON, dynamic lights/FOV OFF |
| Performance | Fast Render ON; unrelated performance options are not reset |
| Detail | Clouds/cloud height OFF; Trees Fast; rain/snow, sky, sun/moon and fog OFF; stars/capes ON; fog start 0.6; translucent/dropped items/vignette Default; held-item tooltips and swamp colors ON; entity shadows and smooth biomes OFF |
| Quality | Maximum mipmaps (4), Nearest, AF/AA/Clear Water/Random Entities/Better Grass/Better Snow/Custom Fonts/Custom Colors/Custom Entity Models OFF; Connected Textures Fast; Natural Textures/Custom Sky/Custom Items/Custom GUIs/Emissive Textures ON |
| Animation | All 17 pictured animation/individual-particle switches OFF; the independent global Particles setting stays All (`particles:0`) |
| Audio | Music always OFF; every other category untouched |

For OptiFine M5, OFF is 3 for fog/clouds/rain/better grass/dynamic lights,
2 for animated water/lava, and 1 for disabled anisotropic filtering. The
remaining animation switches are booleans. These values are not inferred
from modern Minecraft option formats.

### Fast Render / pause blur boundary

The actual M5 `OpenGlHelper.isFramebufferEnabled` implementation returns
false while Fast Render is enabled. Opus's existing pause-blur guard checks
that API and keeps its transparent dim overlay when framebuffer blur is
unavailable. Fast Render is not silently disabled to retain blur. The
underlying world remains visible; native in-game visual acceptance and
fullscreen/live-resize testing remain separate and unverified here.

## Preset-only checkpoint evidence (before UI recovery)

- The four native-default launch tests first failed against the missing
  implementation, then passed: full screenshot preset/Quake Pro preparation,
  byte-exact backup with unrelated preferences, preserving later user edits
  while muting duplicate Music rows, and refusal to follow a settings symlink.
- Four additional regression cases pass: interruption with originals/metadata
  present but receipt absent; invalid UTF-8 aborting before either options
  file is changed; refusal to recover without a required original backup;
  and recreation of one missing options file without resetting the other.
- A ninth preset test exposed following a symlinked game directory, then
  passed after the early containment check was added (RED to GREEN).
- Final Launcher Rust workspace: **104 passed, zero failed**, including all
  nine preset cases. The official Mojang network-endpoint test remains
  intentionally ignored. Scoped final code review approved the preset/Music
  changes, including containment and interrupted-transaction coverage; it
  does not approve unrelated UI changes or the independently installed app.
- `harnessNativeMusic` first failed because MUSIC was not vetoed, then passed
  for MUSIC and all eight other categories. It invokes the real public,
  annotation-selected Forge subscriber with a typed event. Standalone
  JavaExec has no global Forge Loader/LaunchClassLoader, so this is not a claim
  that an actual game/audio device was launched or that a global mod bus was
  exercised.
- Runtime `prepareRuntime verifyRuntimeArtifacts check`: PASS in 22s after a
  sequential rebuild. Ordinary unit-test tasks were up-to-date; the drawable
  ownership check executed. An earlier simultaneous clean/build and harness
  attempt conflicted in the shared legacy build directory and failed; it
  was not a product crash, and those concurrent results are not PASS evidence.
- Both frontends' TypeScript checks passed.
- Client Node contracts at that checkpoint: 17 passed, **2 failed**. The unmodified
  current Connecting UI fails `an empty native detail keeps its layout row
  without a textarea-like tab stop` (changed class/empty-row layout) and
  `loading terrain has no action even if stale navigation says back is
  available` (it renders Back during loading). This native-default scope
  neither changes that UI nor relabels the complete UI suite as passing.
- Fresh Java screen input contract: **FAIL**, `An unowned repeated release
  escaped to CEF` at `ScreenInputHarness:120`. The current, unmodified
  `OpusClientScreen.mouseReleased` forwards unowned releases and also forwards
  releases that were meant to be suppressed. Its source predates this preset.
- Fresh CEF route contract: **FAIL**, missing
  `connect:cycle0.example.invalid`; only navigation to Multiplayer was
  observed. Changed control geometry may affect this fixture; this result is
  not a claim that a physical server connection was tested.
- Fresh system-screen contract: **FAIL**, `A same-route disconnect accepted
  stale connection actions` at `SystemScreenHarness:168`. Earlier checks in
  that run passed, but the complete task did not.
- Fresh standalone `harnessBridge`: PASS. It does not supersede the failed
  screen-input, CEF-route or system-screen contracts above.
- Normal engine Clippy passed with one pre-existing `collapsible_if` warning
  in helper staging. The `-D warnings` run failed on that existing warning;
  strict lint is not reported as passing.
- Build-only Tauri candidate: PASS; deep ad-hoc signature verification and
  file-only/Web-Surface bundle gate passed with `OPUS_AUTO_INSTALL=0`. The
  failed UI/input contracts still prevent release acceptance.

Legacy Forge/Gradle and Java Unsafe/deprecation warnings remain visible.
No physical mouse/keyboard, clipboard, foreground control, native game launch,
real account/world mutation, dependency download, commit or push was performed.

## Historical artifact identity and concurrent installation boundary

`runtime/build/runtime/artifacts/opus-native-ui-1.8.9-0.1.0.jar`

- The first sequential settings build was 10194044 bytes, SHA-1
  `662a241d03253195a7acfa93ba8b3a9a5848f55c`, SHA-256
  `d6b74ac2b975cf14af9e85d5eaa41a2b30f8dabd9f7792f26884c5e2b4c7185b`.
- An independent concurrent operation replaced the Runtime Client artifact
  at 01:23:33 and updated its Launcher pins at 01:25:06. Current size:
  `10193905` bytes; SHA-1 `e29003924ca2706d3644fd12cf32fd74c4a2907a`;
  SHA-256 `11728d0d8028737af5dc47c792f536569b55395cefbc9cec244ca8f10df3fe9a`.
- The build-only candidate captured those current, manifest-verified bytes.
  Bytecode inspection confirmed its production `onPlaySound` sets `result`
  to null only for `MUSIC`. No provenance or complete UI-pass claim is made
  for the concurrent Runtime rebuild.
- Other three runtime JAR identities are unchanged.

Build-only candidate:

`launcher/target/release/bundle/macos/Opus Launcher.app`

- Launcher executable SHA-256:
  `8ee6e32f01988eb2bd473eebfa1c156508b229e7ea619162df4c15263291f4e6`.
- Client JAR SHA-256: `11728d0d8028737af5dc47c792f536569b55395cefbc9cec244ca8f10df3fe9a`.
- This agent did not run the installer or open the app/game.

The installed app changed independently during this turn. Its executable
was initially `84c667c5b194d4a67b1cee3df0e77cc4081f97d815e315487f887fceb0eafbe5`,
then became `b2a0a4cba1e51b2eca1d49e69ed9b862b14861936e753718fa8ad6d05d6da34f`
at 01:26:17. Its current Client JAR matches the concurrent Runtime artifact,
but its executable **does not match the final build-only candidate**. Do not
attribute this installation to this agent or describe it as the final
reviewed candidate. A read-only process-guard check found Opus idle.

At this checkpoint the release was held: stop overlapping build/install
operations, resolve the failed input and Connecting contracts in their own
scope, then rebuild and reconcile exact candidate/installed bytes. The
subsequent approved recovery fulfilled those gates; its installed identity is
recorded in the final receipt linked above, not these older fingerprints.

The previous input-lifecycle receipt's interim artifact fingerprint is
historical, not the identity of this new settings build. Earlier first-Pause
raster/account-selection and physical-input/fullscreen boundaries remain
open; this preset does not close them.
