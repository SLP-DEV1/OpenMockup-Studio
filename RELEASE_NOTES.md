# OpenMockup Studio 0.18.4 Release Notes

## Release focus

This release changes the Windows public launcher so the browser opens the local app URL instead of the temporary Cloudflare URL. The Cloudflare tunnel is now used only as the public HTTPS asset base for Photopea.

## Why this matters

Photopea cannot load design assets from `127.0.0.1`, so PSD SmartObject rendering needs a public HTTPS design URL. Earlier launchers tried to open and verify the `trycloudflare.com` URL directly. On some Windows/DNS setups this caused `DNS_PROBE_FINISHED_NXDOMAIN` or long waiting loops even though the local Vite server and Cloudflare tunnel were already running.

Version `0.18.4` avoids that problem:

- The app UI opens locally at `http://127.0.0.1:5173`.
- The temporary `trycloudflare.com` URL is passed to Vite as `OPENMOCKUP_PUBLIC_BASE_URL`.
- The design endpoint returns public HTTPS asset URLs for Photopea.
- The launcher waits for the local Vite server and Cloudflare tunnel registration, but it no longer blocks on a browser-style public URL reachability check.

## Windows launcher fixes

- `start.bat` now opens the local app URL for a more reliable user experience.
- `npm run dev:public` uses the Cloudflare tunnel only for Photopea asset loading.
- Default Cloudflare tunnel protocol changed to `http2` for better compatibility on Windows networks.
- `.openmockup-public.log` is written with launcher status messages.
- `start-local.bat` now uses `call npm ...` consistently.
- README troubleshooting updated to explain the local UI + public asset tunnel split.

## Existing release cleanup retained

- `node_modules/` is excluded from the release ZIP.
- Old `dist/` assets are excluded from the release ZIP.
- Local test assets and generated ZIP exports are excluded.
- `.gitignore`, `.gitattributes` and `.env.example` are included.
- GitHub Actions CI is included for install, strict typecheck and build.

## Verification

Clean install verification was run from a fresh dependency install:

```bash
npm ci
npm run typecheck:strict
npm run build
npm audit --audit-level=moderate
node --check scripts/dev-public.mjs
```

Result: build passed, strict typecheck passed, launcher syntax check passed, 0 vulnerabilities.
