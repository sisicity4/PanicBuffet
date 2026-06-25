Original prompt: Build the full MVP of "Panic Buffet" from design.md using Vite + TypeScript + Canvas, no extra dependencies; verify with npm run build.

## Progress

- Read `design.md` and `docs.md`; `design.md` is authoritative.
- Replacing the Vite template with a full canvas/DOM game split across `src/game/*`.

## TODO

- Implement game state, update loop, renderer, and entry scene management.
- Run `npm run build`.
- Run a local browser smoke test and inspect screenshots if possible.

- Implemented core game files and fresh CSS.
- Removed obsolete Vite template assets and counter file.

- `npm run build` passed.
- Dev server started on http://127.0.0.1:5174/.
- Playwright client could not launch Chromium in this managed macOS environment: Mach port permission/crashpad launch failures after browser install.

## Final notes

- MVP implementation complete across requested files.
- Remaining verification gap: screenshot/play interaction test could not run because Chromium launch is blocked by this macOS sandbox (`bootstrap_check_in ... Permission denied`, then crashpad abort in headed mode).
