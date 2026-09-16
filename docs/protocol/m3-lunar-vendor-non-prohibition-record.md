# Lunar Client M3 Vendor Non-Prohibition Record

Status: **recorded — Lunar's support/developer channel reported that injecting
the client is not prohibited (gray area). This is a general non-prohibition, NOT
a vendor-approved integration, and the current evidence schema cannot represent
it: no M3 capture may be filed under it. Every lane to the shipped client is
closed: both transports (see "Measured precondition") and local re-signing,
which Lunar permits but whose launcher reverts on every launch (see "Measured:
the launcher restores its JRE"). No route remains that this project can take
unilaterally.**

Recorded: September 10, 2026

## Provenance — read this first

This record is written from the **OPUS project owner's account** of an email
exchange with Lunar Client's support/developer channel. The primary artifact —
Lunar's written reply — is retained by the project owner and is **not** attached
to this repository.

Consequences, stated plainly:

- Everything under "Reported response" is an attributed account, not an
  independently verified quotation. The author of this record did not read the
  reply.
- `recordSha256` below is **pending**. Any future evidence capture that
  references this record must compute it from the retained reply first, per
  [M3 Authorized Client Integration Evidence](m3-authorized-client-integration-evidence.md).
- This record must not be cited as vendor certification, adapter certification,
  or feature-support evidence. Per [M3 General](../m3-general-objective.md),
  runtime entry and handshake success prove transport lifecycle only.

## Reported response

The project owner reports that Lunar's support/developer channel replied to an
email asking whether injecting the Lunar Client is permitted.

| Point | Reported answer |
| --- | --- |
| Prohibited? | No. Lunar does not prohibit injecting the client. |
| Characterization | **Gray area** — explicitly neither encouraged nor prohibited. |
| Why not encouraged | Careless injection can crash the client and harm user experience. |
| Why not prohibited | Benign, harmless features are not a problem. |
| Boundary | Anything that infringes or damages Lunar — the stated example is cracking Lunar Client — is not permitted. |
| Scope — game process | Injection into the **game process** is the most encouraged target. |
| Scope — whole client | Injection into the client generally is permitted. |
| Scope — launcher | Permitted but **extremely discouraged** (reported in the strongest terms; the owner's Vietnamese wording is "cực kì không khuyến khích"). |
| Re-signing the binary | **Permitted.** Lunar does not prohibit it and treats it as a third-party developer's own decision. |
| Disabling SIP | Lunar does **not** prohibit it but **disclaims responsibility** — it is the machine owner's decision. Apple likewise disclaims responsibility if the user disables SIP. This is a disclaimer, not a technical endorsement. |
| Written form | A written reply exists; the project owner reports it is long and has not been supplied to the repository. |

Traceability — **record-only, not schema fields.** The evidence schema's
`target.authorization` object accepts exactly `mode`, `reference`,
`recordSha256`, and `approvedTransport`
(`scripts/verify-m3-client-integration-evidence.mjs` enforces the exact key set),
so nothing below may be pasted into a capture:

```text
reference:         PENDING — retained email reply from Lunar support/developer channel
date:              PENDING — to be recorded from the retained reply
recordSha256:      PENDING — SHA-256 of the retained reply
channel:           email, Lunar Client support/developer contact
scope:             game process (encouraged) > whole client (permitted)
                   > launcher (permitted, extremely discouraged)
condition:         features must be benign; must not infringe, damage, or crack Lunar
sanctionedEntryPoint:  none provided by Lunar
```

## What this is, precisely — and what it is not

This is a **general non-prohibition**: Lunar has said it will not treat benign
injection as a violation. That is a genuine and useful policy position. It is
not the same thing as a vendor-approved integration package.

The distinction matters, and it has a hard consequence:

`scripts/verify-m3-client-integration-evidence.mjs` restricts
`target.authorization.mode` to `opus-owned` or `vendor-approved`, and
`target.kind` to `opus-owned-client` or `vendor-approved-client`. **There is no
representable value for a general non-prohibition.** A capture filed under this
authorization would fail the same verifier that `./scripts/check.sh` runs.

So the correct instruction is not "file it under a different mode" — it is:
**do not file a capture for this at all.** Record it here and in
[M3 General](../m3-general-objective.md). If a future schema revision wants to
represent it, it must add a mode to both
`docs/protocol/m3-authorized-client-integration-evidence.md` and the verifier's
`AUTHORIZATION_MODES` set first.

Lunar also did **not** provide the mechanism half of a vendor-approved package:

1. a specific allowed client build and platform;
2. a documented cooperative opt-in interface or vendor-provided test target;
3. explicit permission scoped to automated lifecycle testing;
4. conditions for reporting, privacy, or account handling; or
5. an entry point usable by this schema.

## Measured precondition — authorization is not capability

Authorization is a policy fact. It does not by itself open a path to a live
Lunar Client 1.8.9 JVM on macOS. Both lanes were measured directly on the
project owner's Mac on September 10, 2026, against a running Lunar Client 1.8.9
JVM (arm64, path contains `zulu17…macosx_aarch64`, main class
`com.moonsworth.lunar.genesis.Genesis`, `--version 1.8.9` present).

Lunar's Java binary carries the hardened runtime
(`flags=0x10000(runtime)`, `Authority=Developer ID Application: Azul Systems,
Inc. (TDTHCUPYFR)`).

**Lane 1 — non-cooperative transport (`task_for_pid`).**

What governs this gate is the **target's code signature**, not the caller's
entitlements. Measured, same host and session:

```text
caller: /tmp/tfp2 — ad-hoc signed, NO entitlements at all
        (codesign -d --entitlements - prints nothing)

  -> target: Opus's own opus-task-port-probe-target
             (ad-hoc signed WITH com.apple.security.get-task-allow)
             kern_return=0  (os/kern) successful        port acquired

  -> target: an ordinary hardened JVM (Gradle daemon)
             kern_return=5  (os/kern) failure

  -> target: the Lunar JVM
             kern_return=5  (os/kern) failure
```

So an entitlement-free caller succeeds against a `get-task-allow` target. The
blocking factor for Lunar is that its shipped binary is hardened and not
debuggable — a property of how it is signed. **That is exactly what a vendor can
change**: a development build signed with `get-task-allow` opens this lane for
Opus's existing ad-hoc helper. (For completeness: `pid 1` also returns
`kern_return=5`, but the governing protection there is SIP / platform-binary
protection — a different mechanism that says nothing about Lunar.)

**Lane 2 — cooperative transport (JDK Attach API).**

The decisive evidence is a direct A/B against a normal JVM on the same host:

```text
$ jcmd <ordinary JVM pid>  VM.version
OpenJDK 64-Bit Server VM version 25.0.2+10-LTS      <- attach succeeds

$ jcmd <lunar pid>         VM.version
com.sun.tools.attach.AttachNotSupportedException:
    The VM does not support the attach mechanism     <- attach refused
```

`jps` still lists the Lunar JVM; only `attach` is refused.

Note on mechanism, so the cause is not overclaimed: the reason recorded here is
that the target VM reports itself non-attachable — `jdk.attach`'s
`HotSpotAttachProvider.testAttachable` throws on that basis, which is why `jps`
can list the process while `jcmd` fails. The standard launch flag
`-XX:+DisableAttachMechanism` is the obvious hypothesis and it reproduces this
exact signature, but **it was not present in the observable command line**
(and it could also arrive via an `@argfile`, `JDK_JAVA_OPTIONS`, or
`JAVA_TOOL_OPTIONS`, none of which appear in argv). **The cause is therefore
unresolved** — the refusal is on the client JVM's side rather than macOS's, but
which switch produces it was not identified.

Net: on the shipped macOS client, **Lunar's permission and Lunar's binary
disagree.** The permission permits the act; the binary refuses the mechanism. A
future reader must not infer from this record that injection into the shipped
Lunar client currently works.

## What would convert this into a usable path

**The recipe is now proven end-to-end on Lunar's own JVM binary** (measured
September 10, 2026, on the project owner's Mac, working on a copy in `/tmp` so
the Lunar installation was not touched):

```text
baseline:  Lunar Zulu 17 java, original signature
           flags=0x10000(runtime), Authority=Azul Systems
           -> task_for_pid: kern_return=5 KERN_FAILURE

re-signed: codesign --force --sign - --entitlements <get-task-allow> <java>
           --options=runtime deliberately OMITTED
           -> flags=0x2(adhoc)
           -> JVM still boots (openjdk 17.0.18 LTS, Zulu17.64+17-CA)
           -> task_for_pid: kern_return=0 (os/kern) successful
           -> opus-macos-transport probe --pid <pid>
              code=TaskPortProbeReady task_port=acquired_and_released
```

**The critical, non-obvious finding:** `get-task-allow` does **not** override the
hardened runtime. Measured on a controlled binary:

| Signature | Result |
| --- | --- |
| hardened runtime, no `get-task-allow` | `kern_return=5` refused |
| `get-task-allow`, hardened runtime **not** set | `kern_return=0` acquired |
| hardened runtime **and** `get-task-allow` | `kern_return=5` refused |

So a build that merely adds `get-task-allow` while keeping hardened runtime will
**not** work. The hardened runtime flag has to go — which is a materially larger
ask than "add one entitlement", because hardened runtime is itself a protection.

**But the recipe does not survive contact with the shipped launcher.** See the
next section before planning around it.

## Measured: the launcher restores its JRE

Measured September 10, 2026 on the project owner's Mac, on the **real** Lunar
installation — this is the test the recipe section previously listed as
unverified.

Sequence:

```text
1. re-signed  …/.lunarclient/jre/<hash>/zulu-17.jre/Contents/Home/bin/java
   backup kept at  …/bin/java.opus-orig
   (recipe above: get-task-allow, hardened runtime omitted)

2. owner quit Lunar, relaunched it, and launched the game

3. launcher re-extracted its JRE — whole tree rewritten, 163 files,
   jre/ directory mtime advanced to the launch time

4. consequences, all verified after the relaunch:

   bin/java          reverted to the shipped signature
                     flags=0x10000(runtime), Authority=Azul Systems (TDTHCUPYFR)
                     mtime back to 29 Jan 2026 21:38:49 (archive timestamp)
   java.opus-orig    DELETED by the re-extract
   task_for_pid on the live game JVM (pid 4752)
                     kern_return=5  (os/kern) failure
```

The install itself is unharmed: `codesign -v` on the restored binary reports
*valid on disk* and *satisfies its Designated Requirement*. The launcher
returned its own artifact to its shipped state, and no file left by this project
remains in the JRE tree.

The finding is not "the re-sign was detected as tampering". Whether the launcher
re-extracts on every launch or only when its integrity check fails is **not
determined** and does not change the outcome: either way, the JRE is restored
before the game JVM execs, and `task_for_pid` is gated on the signature that is
on disk at exec time. A re-sign performed after launch has no effect on the
already-running process for the same reason.

**The only counter-measure is to defeat the launcher's integrity repair** — for
example `chflags uchg` on `bin/java` so the re-extract cannot overwrite it.
That is not a development convenience; it is an operation against a protection
the launcher deliberately implements. The project owner's host authority does
not by itself establish authority over that vendor-side integrity repair, and
Lunar has not supplied a concrete method covering it. It is also fragile: it
turns a routine launcher repair into a failed write, which can leave Lunar in a
broken state, and the flag is removable by the launcher or an update at any
time. It is therefore not a current M3 transport path. Recorded here so the
idea is not rediscovered later as if it were new.

So the tension the earlier section described gets sharper, not looser. Lunar's
**policy** permits re-signing. Lunar's **launcher** actively undoes it. Permission
and implementation disagree for the second time in this record — the first was
permission-versus-attach-mechanism, this is permission-versus-integrity-repair.

Consequence for the vendor request: it now has a measured justification rather
than a hypothetical one. The ask is no longer "we would prefer to re-sign" — it
is "your launcher reverts any local re-sign, so a build that opens this lane has
to come from you."

That makes the vendor request narrower and sharper. The options, in order of
preference:

1. **~~Locally re-sign the JVM binary~~ — measured to fail on the shipped
   client.** The recipe is proven on a copy, but Lunar's launcher restores its
   JRE on launch and reverts the signature. See "Measured: the launcher restores
   its JRE" below. The only observed counter-measure acts on the launcher's own
   integrity repair; it has no vendor-side method record and is not a current
   M3 transport path. **This route is closed.**
2. **A Lunar development build signed with `get-task-allow` and without hardened
   runtime.** Cleanest for all parties, but a real ask: it means Lunar shipping
   a non-hardened binary. **Reported 2026-09-10: Lunar declined to provide a
   development build to a third-party developer.** So this route is closed on
   Lunar's side, not merely expensive.
2b. **A vendor-supplied internal method document** (restricted circulation,
   describing Lunar's injection method for third-party developers). Lunar raised
   this as the alternative to a build. It is a different kind of artifact and
   must be assessed when the real document exists — the analysis below states
   what it can and cannot change. **Not yet received.**

   Clarification recorded from the project owner on September 10, 2026: Lunar
   described the prospective method as a way for a third-party developer to
   reach the desired injection path when the ordinary public capability route
   is unavailable. The owner's shorthand is “đi vòng qua OS”; the actual vendor
   mechanism, terminology, scope, client builds, and conditions have not been
   supplied. Until the primary document is received, this must remain a
   pending vendor-method lane — not an inferred permission to defeat macOS,
   client, or launcher protections.
3. **A build with the attach mechanism left enabled** — restores the standard
   JDK Attach API path. Note the caveat above: the cause of the current refusal
   is unresolved, and if the disable was deliberate anti-tamper hardening this
   is again a larger ask than it looks.
4. **A vendor-provided XPC / Mach service** — transport by IPC instead of task
   port.
5. **A sanctioned mod route.** Lunar loads local mods from
   `-Dichor.fabric.localModPath=…/.lunarclient/profiles/1.8/mods`, so Opus code
   shipped as a mod needs no injection at all. **This does not satisfy M3** —
   M3 is a transport/lifecycle objective, and a mod route performs no native
   runtime entry and no versioned handshake. It is listed here because it is a
   route that needs no vendor change, and because the owner may want it for
   reasons other than M3.

Note again that **disabling SIP is not required for any of these.** The
`kern_return=0` results above were all obtained with SIP enabled — the gate is
the target's signature, not System Integrity Protection.

## Boundary — and what the owner has separately accepted

The project owner reports that Lunar explicitly permits **re-signing the
binary**, treating it as a third-party developer's own decision. That places
local re-signing inside this project's boundary as a vendor-permitted operation,
and the proven recipe above depends on it.

Two things that are the owner's own call rather than Lunar's:

- **Disabling SIP.** Lunar does not prohibit it but disclaims responsibility;
  Apple disclaims responsibility too. It is the machine owner's decision, and
  the project owner has stated they accept the consequences during development.
  Recorded as a decision, not as a recommendation: it is a whole-machine
  security downgrade, and **it is not needed** — every `kern_return=0` result
  above was obtained with SIP enabled.

- **Re-signing a binary the project does not own.** Permitted by the vendor
  here, and therefore in bounds for this project. It remains true that the
  artifact belongs to someone else, so the practical rules are: keep a backup of
  the original binary, prefer the vendor's own build if one becomes available,
  and never treat a re-signed artifact as something the project controls.

  **Permitted, but — measured — ineffective.** Lunar's launcher restores its
  JRE on launch and reverts the signature, so this permission does not buy a
  working lane (see "Measured: the launcher restores its JRE"). The obvious next
  thought is to stop the launcher from doing that. That would act on the
  launcher's own integrity repair, has no documented vendor method, and risks
  leaving Lunar broken. The permission is real; the lane it was supposed to
  open is not.

The condition Lunar attached — benign features, nothing that infringes or
cracks Lunar — is a live constraint to carry into M4–M6, not a formality.

## Owner-authorized host experiment boundary

On September 11, 2026, the project owner separately confirmed authority and
responsibility for host-level development decisions on the designated Mac,
including SIP state and locally installed development services/daemons. This
is now recorded in
[Decision 0007](../decisions/0007-owner-authorized-host-experiment-boundary.md).

That decision permits a separately scoped host experiment; it does **not**
convert Lunar's launcher integrity repair into an OPUS-owned mechanism, supply
a missing vendor method, or make a host-level mechanism vendor-approved. The
recorded “do not” conclusion for defeating the launcher's integrity repair
therefore remains unchanged unless Lunar supplies concrete documentation that
changes the target-side authority and mechanism facts.

The one thing this record still does **not** authorize is an M3 evidence
capture. The schema has no representable mode for a general non-prohibition (see
above), so the permission is real, the mechanism is now proven, and the paperwork
slot still does not exist.
