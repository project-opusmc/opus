# Optional draft: Lunar M3 Vendor Collaboration Request

Status: **optional draft only — not sent, not approval, not a prerequisite for
M3 General, and not evidence of supported Lunar integration**

Date prepared: September 9, 2026

This is an optional collaboration route if the OPUS team chooses to seek
vendor-specific guidance or a test environment. It does **not** define the M3
General target model and must not be read as a requirement for a JVM game
process that the current OS user owns/manages. The authoritative boundary is
[M3 General](m3-general-objective.md): an explicit PID, current-user ownership
or test authorization, JVM/Minecraft evidence, and architecture/runtime
compatibility.

This draft neither authorizes a transport nor permits stealth, reverse
engineering, bypassing protections, or modification outside that boundary.

Submit this only through Lunar's official support or developer-contact channel
after the OPUS team has reviewed it. Preserve the written response and record
its ticket or authorization identifier in
`target.authorization.reference` and the SHA-256 of the retained response in
`target.authorization.recordSha256` of the eventual M3 evidence capture.

## Requested authorization

```text
Subject: Request for an opt-in integration test path for OPUS on Lunar Client

Hello Lunar Client team,

We maintain OPUS, an in-development Minecraft 1.8.9 runtime. Before we pursue
any compatibility work, we would like written guidance on whether Lunar offers
an approved integration or test path for a source-controlled, opt-in OPUS
runtime on macOS Apple Silicon.

We are not requesting permission to reverse engineer Lunar Client, attach to
ordinary user sessions, bypass security controls, disable protections, or use
stealth/manual-mapping techniques. We will not proceed against Lunar Client
without an approved and documented integration mechanism.

If an approved path is available, please identify:

1. the eligible Lunar version/build and target environment;
2. the permitted opt-in runtime-control or plugin interface;
3. any required launch configuration, signing, sandbox, or test-account rules;
4. the supported lifecycle for load, stop/unload, and repeat testing;
5. logging/diagnostic handling requirements; and
6. the written authorization or ticket reference that should accompany test
   evidence.

Our planned acceptance run would use only the approved test target and would
record an architecture match, versioned handshake, typed load/unload status,
three or more clean lifecycle cycles, and target survival. We can provide the
exact test plan and source review materials before a test begins.

Thank you.
```

## Requirements if the team elects the vendor-collaboration route

If the team elects this vendor route, do not present it as vendor-approved
unless the response provides all of the following:

1. A written authorization reference that the team can retain.
2. A specific allowed client build and platform.
3. A documented cooperative opt-in interface or vendor-provided test target.
4. Explicit permission for the requested lifecycle tests.
5. Any conditions required for reporting, privacy, account handling, or
   release.

If the vendor declines or no supported opt-in route exists, record that result
and keep **vendor certification** absent. It does not redefine M3 General or
remove a normal current-user-managed Minecraft JVM from the target model. The
OPUS-owned fixture remains a foundation test only; it must not be relabeled as
Lunar evidence.

## Evidence handoff if vendor collaboration is approved

Once approval exists, capture and review:

```text
authorization reference
    ->
allowed client build SHA-256
    ->
authorized runtime SHA-256
    ->
same-architecture selection
    ->
health -> load -> health -> unload -> health (three or more cycles)
    ->
clean stop and descriptor removal
```

The resulting JSON must pass
`scripts/verify-m3-client-integration-evidence.mjs`, but a passing structural
check remains insufficient without source review and the written authorization.
