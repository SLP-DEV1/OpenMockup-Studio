# Security Policy

## Supported version

Security fixes target the current `main` branch and the latest tagged release when one exists.

## Reporting a vulnerability

Please do **not** open a public issue for a vulnerability that could expose files, execute unintended code, bypass upload restrictions, or make a self-hosted deployment unsafe.

Prefer GitHub's private vulnerability reporting / Security Advisory flow for this repository when available. If that is unavailable, contact the repository owner through their GitHub profile and provide only enough information to establish a private reporting channel.

A useful report includes:

- affected commit or version
- impact and realistic attack scenario
- minimal reproduction steps
- whether the issue requires PSD mode, a public tunnel, or a self-hosted deployment
- suggested mitigation, if known

## Scope notes

Flat-image mode is local-first, while PSD mode deliberately integrates with Photopea and may expose a selected temporary design through a public HTTPS tunnel. Reports should distinguish expected PSD-mode data flow from unintended exposure.

Do not test vulnerabilities against systems or assets you do not own or have permission to test.
