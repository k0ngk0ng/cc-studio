# CLAUDE.md

This file provides guidance to Codex CLI when working on this project.

## Project Overview

CodexStudio — Desktop GUI for Codex CLI CLI. Built with Electron 35 + React 18 + TypeScript + Tailwind CSS v4 + Zustand.

## Architecture

```
src/
├── main/              # Electron main process
│   ├── index.ts       # App entry, BrowserWindow creation, PATH fix
│   ├── ipc-handlers.ts # All IPC handlers (codex, git, terminal, settings, updates)
│   ├── codex-process.ts # Codex CLI JSON bridge process management, streaming input queue
│   ├── session-manager.ts # JSONL session file read/write/fork
│   └── platform.ts    # Platform utils (paths, binary detection, config)
├── preload/
│   └── preload.ts     # Context bridge API (window.api.*)
└── renderer/          # React frontend
    ├── App.tsx
    ├── index.tsx
    ├── types/index.ts  # All TypeScript interfaces and types
    ├── stores/         # Zustand stores
    │   ├── appStore.ts       # Main app state (session, messages, streaming, panels)
    │   ├── settingsStore.ts  # Settings with auto-persist to ~/.codex-studio/settings.json
    │   └── ...
    ├── hooks/
    │   └── useCodex.ts      # Codex CLI JSON bridge interaction, streaming, message handling
    ├── components/
    │   ├── Chat/             # ChatView, MessageBubble, ToolCard, WelcomeScreen
    │   ├── Settings/         # Settings modal with tabs, AppearanceSection, controls/
    │   ├── DiffPanel/        # FileTree (Files tab), DiffPanel (Changes tab)
    │   ├── TopBar/
    │   ├── Sidebar/
    │   ├── InputBar/
    │   └── Terminal/
    └── styles/
        └── globals.css       # Global styles, streaming cursor animations
```

## Key Patterns

- **Settings**: Add field to `AppearanceSettings` in `types/index.ts` → add default in `settingsStore.ts` → add UI in `AppearanceSection.tsx`. `mergeWithDefaults()` handles migration automatically.
- **IPC**: Main process handlers in `ipc-handlers.ts`, preload bridge in `preload.ts`, renderer calls via `window.api.*`.
- **Streaming**: Codex CLI JSON bridge streams via async generator in `codex-process.ts`. Renderer tracks `streamingContent` + `toolActivities` in appStore, committed to messages on turn boundaries via `commitCurrentTurn()` in `useCodex.ts`.
- **Sessions**: JSONL files in `~/.codex/sessions/<encoded-path>/<session-id>.jsonl`. Follow-up user messages are appended by app (SDK only writes the first).
- **Context menus**: React-based fixed-position divs (not native Electron Menu), with click-outside and Escape to dismiss.

## Build & Run

```bash
npm install
npm start          # Dev mode with hot reload
npm run package    # Package for current platform
npm run make       # Build distributable installer
```

## Important Notes

- `contextIsolation: true`, `nodeIntegration: false` — all main process access goes through preload bridge
- Windows PATH may not be ready at startup — dependency checks use retry logic
- `getWebContents()` checks `isDestroyed()` before sending to avoid crashes during app quit
- Streaming cursor styles are configurable in Settings > Appearance (8 styles available)
- Links in chat messages: left-click opens in default browser, right-click shows Open Link / Copy Link menu
