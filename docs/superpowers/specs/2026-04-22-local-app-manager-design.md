# Local App Manager — Design

**Date:** 2026-04-22
**Status:** Draft

## Overview

A cross-platform (Ubuntu + macOS) desktop app for developers to register, start, stop, and monitor locally running applications (dev servers, databases, background services). Managed processes survive the desktop app being closed.

## Goals

- Register local apps by name, shell command, and port.
- Start / stop registered apps from a UI.
- View live console logs per app; logs persist across desktop-app restarts.
- Managed processes run detached — they keep running after the desktop app exits.
- Two UI views: phone-style app-grid and Docker-Desktop-style list, toggleable.

## Non-goals (YAGNI)

- Auto-start on system login
- Environment variables, working-directory config, multi-port apps
- Log search / filtering / export
- Remote management, authentication, multi-user
- App grouping, tags, dependencies

## Tech Stack

- **Tauri** (Rust backend + webview) for small binary and native process control.
- **React + TypeScript** frontend.
- Rust crates: `tokio` (async), `serde` (JSON), `nix` (process groups / signals on Unix), `notify` (log file watcher).

## Architecture

Single Tauri app. The Rust backend owns all process / filesystem concerns; the React frontend is a pure UI that invokes Tauri commands and subscribes to Tauri events.

```
┌─────────────── Tauri App ───────────────┐
│  React UI  ── invoke() ──▶  Rust core   │
│  React UI  ◀── emit() ───  Rust core    │
│                                ▲        │
│                                │        │
│                 apps.json, state.json,  │
│                 logs/*.log              │
└─────────────────────────────────────────┘
          │ spawns detached (setsid)
          ▼
  Child processes (independent OS process groups)
```

## Data Storage

Using Tauri's platform-appropriate paths:

- **Config** — `<app_config_dir>/apps.json`
  - Array of `{ id: uuid, name: string, command: string, port: number, createdAt: ISO8601 }`.
- **Runtime state** — `<app_data_dir>/state.json`
  - Map `{ appId: { pid: number, pgid: number, startedAt: ISO8601 } }`.
  - Written when a process is started; cleared when stopped or detected dead.
- **Logs** — `<app_data_dir>/logs/<appId>.log`
  - Combined stdout + stderr.
  - Ring buffered at 10 MB. On rollover, rename to `<appId>.log.1` (one backup kept).

On Linux these resolve under `~/.config/` and `~/.local/share/`; on macOS under `~/Library/Application Support/` and `~/Library/Preferences/`.

## Core Flows

### Register App
1. User fills a form: name, command, port.
2. Frontend calls `register_app(name, command, port)`.
3. Backend validates: port not already present in `apps.json`. If duplicate, return error; UI shows inline message.
4. On success, append new `{id, ...}` to `apps.json`.

### Start
1. Frontend calls `start_app(appId)`.
2. Backend looks up the app, spawns `sh -c "<command>"`:
   - Unix: `setsid` so the child becomes its own session/process-group leader (detached from the Tauri app).
   - stdout and stderr redirected to `<app_data_dir>/logs/<appId>.log` (append mode).
3. Record `{pid, pgid, startedAt}` in `state.json`.
4. Return immediately (do not wait for child to exit).
5. Frontend refreshes status; tailing starts if the log panel is open.

### Stop
1. Frontend calls `stop_app(appId)`.
2. Backend primary path (PID-first, tree kill):
   - Read `pgid` from `state.json`.
   - `kill(-pgid, SIGTERM)` (negative PID = whole process group).
   - Wait up to 5 seconds for the port to be free and/or pgid to be gone.
   - If still alive: `kill(-pgid, SIGKILL)`.
3. Backend fallback (port-based) — triggered if pgid is missing, stale, or kill failed:
   - Resolve PID bound to port via `lsof -iTCP:<port> -sTCP:LISTEN -t` (macOS & Linux) or `ss -ltnp` on Linux.
   - Derive pgid of that PID; `kill(-pgid, SIGTERM)` → `SIGKILL` on timeout.
4. Clear the app's entry from `state.json`.
5. If the port is *still* bound after all attempts, surface an error: "Port still in use by PID X (not ours)".

### Detect State on Launch
For each registered app:
- If `state.json` has an entry AND the stored pid is still alive AND the port is bound → status `running`.
- Else → status `stopped`; remove any stale `state.json` entry.

### Log Streaming
- Rust uses `notify` to watch `logs/<appId>.log`.
- On change, read new bytes since last offset; emit Tauri event `log-chunk:<appId>` with the chunk.
- Frontend listener appends to a scrollback buffer in the detail panel.
- On log panel open, backend sends the last N KB (e.g. 64 KB) as an initial `log-chunk`, then begins tailing.

## UI

### Header
- App title on the left.
- View toggle (Grid ⊞ / List ☰) — persists to localStorage.
- "+ Add App" button on the right.

### Grid View (phone-style)
- Responsive grid, ~4 columns on a standard window.
- Each tile: 64×64 rounded-square icon with a deterministic gradient derived from the app name's hash, first letter centered.
- Name label below icon.
- Status dot under the name: green = running, grey = stopped.
- Click → opens the detail panel.

### List View (Docker Desktop-style)
- Table columns: status dot, name, port, status/uptime, inline actions (▶ start, ■ stop, 📋 logs).
- Click row → opens the detail panel.

### Detail Panel (slide-over from right, or modal)
- Header: app name.
- Fields (read-only for v1): command, port.
- Contextual Start / Stop button reflecting current status.
- Logs panel: live-tail scrollable terminal-like view, auto-scroll to bottom with a "pin to bottom" toggle, "Clear view" button (doesn't delete log file).
- Delete app button (confirm; must be stopped first).

### Add App Dialog
- Fields: Name (required), Command (required), Port (required, 1–65535).
- Live validation for duplicate port; Save disabled until resolved.

## Error Handling

- **Registration duplicate port** — inline error on Port field, Save disabled.
- **Start — command not found / immediate exit** — child exits; next poll detects `pid` dead + port not bound; surface "Failed to start — see logs" with tail preview.
- **Start — port already in use by another process** — detected immediately after spawn (port bound but our pid exited, or spawn error in logs); show error.
- **Stop — still alive after SIGKILL** — show error noted above; leave `state.json` entry but flag as "unresponsive".
- **Log file write error** — log to Rust stderr (captured by Tauri's own log), show toast in UI.

## Testing

### Rust
- **Unit**
  - Port validator (uniqueness, range).
  - Config CRUD (register / list / delete on a temp dir).
  - Kill helper with mocked `nix` / process lookups.
- **Integration**
  - Spawn a real long-running dummy (`sleep 60`), assert it's detached, stop it, assert exit within 5 s.
  - Spawn a command that spawns a child (`sh -c "sleep 60 & wait"`), stop it, assert both are dead.
  - Duplicate-port registration is rejected.
  - State rediscovery: kill dummy out-of-band, relaunch detection should mark it stopped.

### Frontend
- Component test: Add-App form validation (duplicate port blocks Save).
- Component test: view-toggle switches rendering and persists.

## Open Questions

None at design time. Command editing post-registration and environment variables are deliberately deferred.
