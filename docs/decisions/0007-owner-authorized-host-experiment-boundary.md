# Decision 0007: Owner-authorized host experiment boundary

Status: **FROZEN R&D decision — preserved for an explicit future injector
resumption; not active product-mainline authority as of September 15, 2026**

> The active product authority is
> [Decision 0008](0008-opus-client-launcher-ui-first-mainline.md). This
> decision preserves an authority boundary for future R&D only. It does not
> authorize new host changes, target interaction, transport execution, or Gate
> promotion while the injector lane is frozen.

## Decision

The OPUS project owner has declared control of the designated development Mac
and accepts responsibility for changes made to that host. M3 research may
therefore use an **owner-authorized host experiment** when the owner explicitly
chooses to evaluate a host-level transport mechanism.

Host-level authority includes the owner's decision about the Mac's security
configuration, developer signing, locally installed development services, and
their removal. This decision records authority and responsibility; it is not a
claim that a third-party client binary, launcher, service, account, or
intellectual property is OPUS-owned.

The normal M3 production objective remains a selected Minecraft game JVM and
its load -> handshake -> logical unload -> reinjection lifecycle. A host-level
experiment is an additional research lane for reaching that selected target; it
does not turn a system-wide mechanism into normal production transport.

## Authority model

Three facts must be recorded separately:

| Boundary | Required statement |
| --- | --- |
| Host authority | The project owner controls the named development Mac and explicitly accepts the consequences of the chosen host configuration. |
| Target basis | The intended game process/build is named, and the record states why it is being tested: OPUS-owned, vendor-permitted, vendor-approved, or another retained test authorization. Host ownership alone is not silently substituted for this fact. |
| Scope authority | The mechanism's actual scope is recorded: one selected PID, a named launch path, or a named host service. A broad mechanism may not be described as selected-PID transport when it is not. |

## Containment requirements

Every owner-authorized host experiment must have a short retained record with:

- the named development host and experiment owner;
- the intended Minecraft target/build and the actual mechanism scope;
- the explicit start/stop test window;
- a rollback and uninstall/cleanup check for host-level components;
- a statement of whether the mechanism can affect non-target processes; and
- a result that distinguishes `capability unavailable`, `transport entered`,
  `runtime ready`, and `lifecycle proven`.

The experiment may not treat a system-wide side effect as a successful M3
result. It must still prove the exact selected game's runtime entry, versioned
handshake, logical unload, reinjection, and target survival. It must not record
credentials or raw game command lines in reports.

## What this changes

A selected-PID capability denial remains terminal for the **selected-PID
transport path**. It is no longer a blanket policy prohibition on evaluating a
separately declared owner-authorized host experiment on the owner's development
Mac.

Such an experiment is not implemented by the current `opus-injector`, is not
enabled by default, and does not alter the current CLI's current-user
selected-PID checks. It requires a separately reviewed implementation and the
containment record above.

## What this does not change

- OPUS does not claim that Lunar, Badlion, or another vendor client is
  OPUS-owned merely because it runs on the owner's Mac.
- A vendor's general non-prohibition is not silently upgraded to a documented
  vendor integration or compatibility certification.
- A host-level experiment does not prove a client adapter, mappings, Java
  runtime, OneConfig, modules, or release readiness.
- Stealth, anti-detection, credential capture, screenshare evasion, and
  indiscriminate process control remain outside OPUS.
- Third-party source remains subject to its license and separate source-review
  boundary.

## Implementation status

This decision itself installed or changed no SIP setting, daemon, system
service, or third-party injector. On September 11, 2026, the owner separately
recorded a one-PID, `sudo`-mediated task-port capability probe on the designated
host in [Badlion Direct Task-Port Capability Record](../protocol/m3-badlion-direct-task-port-capability-record-2026-09-11.md).
That record reports the host's observed SIP state, scope, rollback facts, and
result classification; it does not turn this decision into a transport
implementation or client-integration certification.
