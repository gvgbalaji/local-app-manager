# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — starts three concurrent processes: `tsc --watch` for the Electron main-process code, Vite for the renderer, and the Electron shell (after `wait-on` sees the compiled main + preload + dev server). Kill the whole tree with Ctrl-C; `concurrently -k` stops all three.
- `npm run build` — one-shot: `tsc` emits `dist-electron/` (CommonJS), then `vite build` emits `dist/` (renderer).
- `npm start` — launches Electron against the built output (expects `npm run build` first; loads `dist/index.html` when `NODE_ENV !== 'development'`).
- `npm run typecheck` — runs both TS projects in `--noEmit`: the renderer config at the repo root, then `electron/tsconfig.json`. Run this before committing; the renderer and main process use different module systems and won't catch each other's errors.

## Architecture

Electron app split cleanly along the preload boundary. All process management, filesystem IO, and child-process lifecycle live in the **main process (Node, CommonJS)**; the **renderer (React + Vite, ESM)** is a pure UI that talks to the main process only through `window.api`, exposed by `electron/preload.ts` via `contextBridge`. `contextIsolation: true` and `nodeIntegration: false` are set in `electron/main.ts` — the renderer has no direct Node access, only the whitelisted IPC surface.

### Process lifecycle (the load-bearing part)

`electron/processManager.ts` is the heart of the app. The design is unusual and deliberate:

- **Spawn is detached.** Child processes are started with `spawn('sh', ['-c', cmd], { detached: true, stdio: [ignore, fileFd, fileFd] })`. On Unix, `detached: true` makes the child a session leader, so `child.pid === child.pgid`. The child outlives the Electron app. We call `child.unref()` so Electron can exit without waiting on it.
- **Runtime state is persisted to disk**, not held in memory. `state.json` (`{ appId: {pid, pgid, startedAt} }`) is the only way the app rediscovers children after a restart, because detached children have no parent link back to us.
- **Status = pid alive**, not port-bound. `statusOf()` used to also require `portBound()`, but that produced false "stopped" readings when apps hadn't bound the port yet (startup delay) — so now pid-alive is authoritative. `portBound()` is used only for the pre-start check and the stop-fallback path.
- **Stop is PID-first, port-fallback, tree-kill.** Primary: `kill(-pgid, SIGTERM)` (negative PID = whole process group), wait up to 5 s for the port to free, then `SIGKILL`. Fallback (when pgid is gone/stale): find PID bound to the port via `lsof -iTCP:PORT -sTCP:LISTEN -t`, derive its pgid via `ps -o pgid=`, tree-kill that.

### Log tailing

`processManager.ts` keeps a `Map<appId, FSWatcher>`. When the UI subscribes, it returns the last 64 KB of the log file as `initial` and starts an `fs.watch` that emits `log:${appId}` on the internal `EventEmitter`. `ipc.ts` bridges those events to Tauri-style webContents messages on channel `logs:chunk:${id}`. Unsubscribe is wired through `ipcMain.once` on a per-id `logs:unsubscribe:${id}` channel to clean up the watcher. Log files ring-buffer at 10 MB — `rotateIfLarge` is called before each start, renaming `<id>.log` → `<id>.log.1` (one backup kept).

### Storage paths

`electron/paths.ts` derives everything from `app.getPath('userData')` (Electron's per-OS data dir — `~/.config/local-app-manager` on Linux, `~/Library/Application Support/local-app-manager` on macOS). Config (`apps.json`), state (`state.json`), and `logs/<id>.log` all live there.

### Frontend data flow

`src/App.tsx` owns all state: the app list, the status map, the selected app, modal state. It polls `window.api.list()` every 3 s and after every start/stop/delete. Child components (`GridView`, `ListView`, `DetailPanel`, `AddAppDialog`) are dumb renderers that receive state + callbacks. `DetailPanel` is the one exception — it owns its own log subscription lifecycle via `useEffect`, tearing down on unmount or when `app.id` changes.

### IPC channel naming

- `apps:list` / `apps:register` / `apps:update` / `apps:delete` / `apps:start` / `apps:stop` / `apps:status` — all invoke/handle.
- `logs:subscribe` (invoke, returns `{ initial }`) + `logs:chunk:${id}` (push from main) + `logs:unsubscribe` (send, fire-and-forget).

The `logs:unsubscribe:${id}` internal channel (note the `:${id}` suffix) is used only inside the main process to signal cleanup — don't confuse it with the public `logs:unsubscribe` the renderer sends.

## Build configuration gotchas

- The electron code lives under `electron/` with its own `tsconfig.json` emitting to `dist-electron/` as CommonJS (Electron's main process requires CJS). The renderer's `tsconfig.json` at the repo root is ESM + bundler-mode + `noEmit`; Vite handles its emit. `npm run typecheck` runs both so neither can drift.
- `package.json` points `main` at `dist-electron/main.js`. Running Electron before `tsc` has emitted will fail — `npm run dev` uses `wait-on dist-electron/main.js dist-electron/preload.js` specifically to gate the Electron launch.
- `~/.config/autostart/local-app-manager.desktop` runs `npm run dev` from the project dir on login (configured locally, not in-repo).

## Specs and design docs

Implementation spec lives at `docs/superpowers/specs/2026-04-22-local-app-manager-design.md`. Several decisions recorded there matter when extending the app:

- Out of scope (deliberately): env vars, working-dir config, multi-port apps, auto-start-on-login config in-app, log search/filter.
- Register-time validation: port must be unique across apps; name and command non-empty; port 1–65535.
- Process must *outlive* the Electron app — never add logic that kills children on Electron quit.
