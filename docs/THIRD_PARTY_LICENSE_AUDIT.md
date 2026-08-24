# Third-party license audit for Opus UI V3

Status: **initial audit — release gate remains open**

Date: 2026-08-23

This document records engineering obligations and release gates. It is not a
substitute for legal advice.

## Frozen inputs

| Component | Immutable source | Planned artifact | License evidence |
| --- | --- | --- | --- |
| OneConfig v0 | `Polyfrost/OneConfig@233452661e6d273f130230bb8e1813fb0a28b80a` (`develop-v0`) | `cc.polyfrost:oneconfig-1.8.9-forge:0.2.2-alpha228` | repository `LICENSE`, SHA-256 `2afc780cec59015c7c6b0c022924798376414fb9ae64955cfd1b00d82c9c3b99` |
| Elementa | `EssentialGG/Elementa@01392527e98e83026e52f27396775cf042f3e922` | candidate `gg.essential:elementa:762` | repository `LICENSE`, SHA-256 `e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118` |
| UniversalCraft | `EssentialGG/UniversalCraft@e507b65e6bd76c88d6d461db8a5f8a0cdf066c85` | candidate `gg.essential:universalcraft-1.8.9-forge:516` | repository `LICENSE`, SHA-256 `e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118` |

The downloaded published OneConfig `0.2.2-alpha228` JAR used during this audit
has SHA-256:

```text
bf44d346a6a53df3f1f9813de9c6f028cc93adf9c8cb1276c694863a7e1136de
```

The Elementa and UniversalCraft artifact versions remain candidates until the
exact runtime baseline succeeds.

## OneConfig

### License

The frozen OneConfig source states:

- GNU LGPL version 3; and
- Additional Terms Applicable to OneConfig version 1.1, dated 2024-08-16.

### Engineering obligations to preserve

- keep copyright, license, additional-term, and warranty notices;
- mark modified source prominently and date the modifications;
- retain a reproducible path to the preferred source form of the fork;
- provide the required source/relinking mechanism for conveyed binaries under
  the selected LGPL/GPL path;
- do not use OneConfig or Polyfrost trademarks as Opus branding or imply
  endorsement;
- maintain a third-party notices surface in the product and distribution.

### Attribution conflict with the V3 visual requirement

The Additional Terms require a visible attribution statement on UI produced by
a conveyed adaptation unless an exception applies. The required statement is:

> Powered by OneConfig - get OneConfig from the original creators at
> https://polyfrost.org/oneconfig

V3 also requires removing OneConfig product branding. These requirements are
not treated as permission to hide legal attribution. Product chrome, logo,
sidebar identity, and theme may be replaced, while legally required notices
must remain until a different compliant release path is approved.

### Release options requiring an explicit decision

Before public or commercial distribution, record one of:

1. visible attribution retained as required;
2. written authorization from Polyfrost for the intended presentation;
3. GPL distribution path selected after reviewing its effect on the fork and
   combined distribution;
4. documented applicability of the non-commercial exception.

Private development and runtime testing can continue while this gate is open.
No release artifact may claim the gate is resolved without evidence.

## Elementa and UniversalCraft

Both inspected repositories contain the GNU LGPL version 3 license text.

For a conveyed combined work, the release process must at minimum:

- ship the LGPL/GPL license notices;
- identify the linked versions;
- preserve the user's ability to replace or relink compatible modified library
  versions, or provide the corresponding application/source mechanism required
  by the selected LGPL route;
- publish modifications to the libraries under LGPL-compatible terms;
- retain copyright and modification notices.

The integration design should keep Elementa and UniversalCraft as identifiable
libraries rather than copying arbitrary source fragments into proprietary
packages without provenance.

## OneConfig transitive dependencies still to audit

The frozen source references or bundles at least:

- UniversalCraft `246` under OneConfig's relocation/bundling rules;
- Kotlin standard libraries and kotlinx libraries;
- Sponge Mixin;
- Caffeine;
- keventbus;
- deencapsulation;
- lwjgl-legacy;
- optional Vigilance compatibility.

Each bundled binary needs its own version, license, source URL, checksum, and
notice disposition before distribution. The OneConfig stock artifact does not
close this audit automatically.

## Elementa transitive dependencies still to audit

Before the Elementa pin is finalized, record the exact POM/Gradle dependency
graph for the selected artifact pair, including Kotlin and UniversalCraft
versions, then classify which artifacts are bundled, dynamically provided, or
compile-only in the Opus distribution.

## Required release artifacts

The production packaging lane must eventually generate or include:

```text
THIRD_PARTY_NOTICES.txt
licenses/oneconfig-LICENSE.txt
licenses/elementa-LICENSE.txt
licenses/universalcraft-LICENSE.txt
source-offer-or-source-location.txt
dependency-lock with artifact checksums
```

The files must be generated from frozen inputs and verified by release tests;
they must not rely on mutable `latest` Maven metadata.

## Current verdict

- Source integration and private testing: **allowed to proceed technically**.
- Public/commercial distribution: **not yet approved by this audit**.
- Primary open gate: OneConfig attribution/licensing path.
- Secondary open gate: complete transitive dependency inventory.
