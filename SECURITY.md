# Security Policy

## Supported Versions

The latest published `1.x` release receives security fixes.

| Version | Supported |
|---|---|
| 1.x | yes |
| < 1.0 | no |

## Reporting a Vulnerability

Please report security issues privately, not through public issues or pull requests.

Use GitHub's private vulnerability reporting on this repository (**Security → Report a vulnerability**), or email the maintainer. Include a description, affected version, and a minimal reproduction.

You can expect an acknowledgement within a few days. Once a fix is available, a patched release is published and the reporter is credited unless they prefer otherwise.

## Scope

`@joelouf/ledger-system` is a pure, zero-dependency computation library. It performs no I/O, opens no network connections, reads no ambient state, and never executes input as code — it folds a plain in-memory store into derived figures. The relevant security surface is therefore numeric correctness: amounts are integer cents bounded by `MAX_AMOUNT_CENTS`, and every figure is a deterministic, reproducible fold over the entries you supply.
