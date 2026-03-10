# CC Studio

`cc-studio` is the umbrella repository for two desktop apps with one shared mobile client and one shared relay server:

- `claude-studio` — Electron desktop app for Claude Code CLI
- `codex-studio` — Electron desktop app for Codex CLI
- `mobile` — shared React Native remote-control client for both desktop apps
- `server` — shared auth + relay server for pairing, sync, and remote control

## Repository Layout

```text
cc-studio/
├── claude-studio/
├── codex-studio/
├── mobile/
└── server/
```

Both desktop apps keep their own branding, settings, session storage, and provider-specific CLI adapters. `mobile` and `server` are intentionally neutral and speak the shared `studio:*` remote-control protocol.

## Local Development

### Claude Studio

```bash
cd claude-studio
npm install
npm run start
```

### Codex Studio

```bash
cd codex-studio
npm install
npm run start
```

### Shared Mobile

```bash
cd mobile
npm install
npm run start
```

### Shared Server

```bash
cd server
npm install
npm run dev
```

## Validation

```bash
cd claude-studio && npx tsc --noEmit
cd codex-studio && npx tsc --noEmit
cd mobile && npx tsc --noEmit
cd server && npx tsc --noEmit
```

## Notes

- Pair either desktop app with the shared `CC Studio` mobile client from `Settings -> Remote Control`.
- `claude-studio` continues to read Claude sessions and settings from `~/.claude-studio` / `~/.claude`.
- `codex-studio` continues to read Codex sessions and settings from `~/.codex-studio` / `~/.codex`.
- Shared mobile/server state is stored under `cc-studio` naming to avoid provider-specific coupling.
