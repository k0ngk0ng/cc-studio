# CodexStudio

<p align="center">
  <img src="https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/github/actions/workflow/status/k0ngk0ng/codex-studio/ci.yml?label=CI" />
  <img src="https://img.shields.io/github/v/release/k0ngk0ng/codex-studio?label=Release" />
  <img src="https://img.shields.io/github/license/k0ngk0ng/codex-studio" />
</p>

A desktop GUI for Codex CLI, closely modeled on `codex-studio`. It drives the local `codex` binary over the standard stdin/stdout JSON protocol, with streaming chat, live tool cards, terminal integration, git diff tooling, remote/mobile control, and session history backed by Codex rollout files.

<p align="center">
  <strong>macOS</strong> · <strong>Windows</strong> · <strong>Linux</strong>
</p>

---

## ✨ Features

- 💬 **Chat Interface** — Streaming responses with markdown rendering, syntax highlighting, and code blocks
- 🔧 **Real-time Tool Activity** — See Codex tool executions as collapsible cards with input/output details and live shell output
- 📂 **Session History** — Browse and resume Codex sessions from `~/.codex/sessions/` and archived rollout files
- 🔄 **Multi-session Support** — Switch between threads without losing streaming state; per-session runtime preservation
- 🖥️ **Integrated Terminal** — Full terminal emulator (xterm.js + node-pty) embedded in the app
- 📝 **Git Integration** — View unstaged/staged changes, stage/unstage files, commit, push, and push tags — all inline
- 🖼️ **Image Paste** — Paste images from clipboard (⌘V / Ctrl+V) to include in conversations
- 📁 **Open in Editor** — Quick-open project in VS Code, Cursor, Zed, Windsurf, or other detected editors
- ⌨️ **Keyboard Shortcuts** — `⌘N` new thread, `⌘T` terminal, `⌘D` diff panel, `⌘B` sidebar, `⌘,` settings
- 📐 **Resizable Panels** — Drag to resize sidebar, terminal, and diff panel
- 🎨 **Theme Support** — Dark, Light, and System (auto-switch) themes
- 🔗 **Codex Config Sync** — Sync model and runtime settings with `~/.codex/config.toml`, plus app-managed env vars
- 🔐 **Permission Modes** — Default, Accept Edits, Plan, Bypass Permissions, Don't Ask
- ⚙️ **Settings** — Codex CLI config, permissions, MCP servers, git, appearance, keybindings
- 🔍 **Dependency Check** — Auto-detects missing Codex CLI or Git on startup with install hints
- 🖥️ **Cross-Platform** — Native experience on macOS, Windows, and Linux — install and use, no extra setup needed

## 📸 Screenshots

> *Coming soon — run `npm start` to see it in action!*

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Codex CLI     │ │ Git Manager  │ │ Terminal Manager     │ │
│  │ JSON bridge   │ │ (git ops)    │ │ (node-pty)           │ │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘ │
│         │                │                     │             │
│  ┌──────┴────────────────┴─────────────────────┴───────────┐ │
│  │                    IPC Handlers                          │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │ contextBridge                      │
├─────────────────────────┼────────────────────────────────────┤
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │                  React Renderer                          │ │
│  │  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐  │ │
│  │  │ Sidebar │ │ Chat View │ │ Terminal │ │ Diff Panel│  │ │
│  │  │         │ │ + Input   │ │ (xterm)  │ │ (diff2html│  │ │
│  │  └─────────┘ └───────────┘ └──────────┘ └───────────┘  │ │
│  │                    Zustand Store                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- **Codex CLI** installed and authenticated
  ```bash
  npm install -g @openai/codex
  codex  # Follow auth prompts
  ```
- **Git** (for diff panel and commit features)
  - macOS: `xcode-select --install`
  - Windows: [git-scm.com](https://git-scm.com/download/win)
  - Linux: `sudo apt install git`

### Download Pre-built Releases

Check the [Releases](https://github.com/k0ngk0ng/codex-studio/releases) page for pre-built installers:

| Platform | Format |
|---|---|
| macOS | `.dmg` (Apple Silicon + Intel) |
| Windows | `.exe` (Squirrel installer) |
| Linux | `.deb` + `.zip` |

> 💡 All dependencies are bundled — install and use, no extra setup needed.

### Build from Source

```bash
# Clone the repo
git clone https://github.com/k0ngk0ng/codex-studio.git
cd codex-studio

# Install dependencies (auto-rebuilds node-pty for Electron)
npm install

# Launch in dev mode
npm start
```

### Build Installers

```bash
# Package the app (no installer)
npm run package

# Build platform-specific installer
npm run make
# → macOS: DMG + ZIP
# → Windows: Squirrel installer (.exe)
# → Linux: .deb + ZIP
```

## ⚙️ Settings

### Codex CLI Configuration

The app provides a **Codex CLI** settings panel that syncs model/provider choices and related environment variables:

- **API Configuration** — `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`
- **Model Settings** — `CODEX_MODEL`, `OPENAI_MODEL`, `CODEX_REASONING_EFFORT`, `CODEX_PROFILE`
- **Proxy** — `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`
- **Custom Environment Variables** — Add any env var for the spawned Codex process
- **Runtime Flags** — `CODEX_OSS`, `CODEX_LOCAL_PROVIDER`, `CODEX_EPHEMERAL`
- **Import / Export** — Import/export app-managed Codex settings profiles

Codex native settings are read from `~/.codex/config.toml`; app-specific settings are stored separately by the desktop client.

### Other Settings

- **General** — Send key, permission mode, notifications, debug mode
- **Permissions** — File read/write, bash, MCP access controls
- **MCP Servers** — Configure Model Context Protocol servers
- **Git** — Auto-stage, diff on commit, auto-push, commit prefix
- **Appearance** — Theme (Dark/Light/System), font size, font family, line numbers
- **Keybindings** — Customize keyboard shortcuts

## 📁 Project Structure

```
codex-studio/
├── .github/workflows/
│   ├── ci.yml                  # CI: typecheck + build verify (push/PR)
│   └── release.yml             # Release: build installers (tag v*)
├── scripts/
│   └── sync-version.mjs        # Sync version from git tag / commit hash
├── assets/
│   ├── icon.icns               # macOS app icon
│   ├── icon.ico                # Windows app icon
│   └── icon.png                # Linux / source icon (512×512)
├── forge.config.ts             # Electron Forge config (packaging, native modules)
├── vite.main.config.ts         # Vite config — main process
├── vite.preload.config.ts      # Vite config — preload script
├── vite.renderer.config.ts     # Vite config — React renderer
├── tsconfig.json
├── src/
│   ├── main/                   # Electron Main Process
│   │   ├── index.ts            # App entry, BrowserWindow, PATH fix
│   │   ├── codex-process.ts   # Codex CLI session bridge (legacy filename)
│   │   ├── session-manager.ts  # Codex rollout history reader
│   │   ├── git-manager.ts      # Git operations wrapper
│   │   ├── terminal-manager.ts # node-pty terminal manager
│   │   ├── ipc-handlers.ts     # IPC channel registration
│   │   └── platform.ts         # Cross-platform utilities + Codex config
│   ├── preload/
│   │   └── preload.ts          # contextBridge API
│   └── renderer/               # React UI
│       ├── App.tsx             # Root layout (3-panel) + theme switching
│       ├── stores/
│       │   ├── appStore.ts     # Zustand global state + per-session runtime
│       │   ├── settingsStore.ts # Settings state (localStorage + sync)
│       │   └── debugLogStore.ts # Debug log store
│       ├── types/index.ts      # TypeScript types
│       ├── hooks/
│       │   ├── useCodex.ts    # Codex stream event handler (legacy filename)
│       │   ├── useSessions.ts  # Session management + runtime save/restore
│       │   ├── useGit.ts       # Git operations
│       │   ├── useTerminal.ts  # Terminal lifecycle
│       │   └── useResizable.ts # Panel drag-to-resize
│       ├── components/
│       │   ├── Sidebar/        # Thread history sidebar
│       │   ├── TopBar/         # Action bar (Open, Commit, Push)
│       │   ├── Chat/           # Chat view + messages + tool cards
│       │   ├── InputBar/       # Message input + file attach + image paste
│       │   ├── BottomPanel/    # Terminal + Debug Logs tabs
│       │   ├── DiffPanel/      # Git diff viewer
│       │   ├── Settings/       # Settings (General, Codex CLI, Permissions, etc.)
│       │   └── StatusBar/      # Bottom status bar
│       └── styles/
│           └── globals.css     # Tailwind CSS 4 + dark/light theme variables
```

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Electron 35 (electron-forge + Vite) |
| Codex Integration | Codex CLI stdio JSON/JSONL protocol |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 |
| Terminal | xterm.js + node-pty |
| Git Diff | diff2html |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Build | Vite 6 + electron-forge |

## 🔌 How It Works

### Codex CLI Integration

The app launches the local `codex` binary and consumes its JSONL event stream directly:

- **`codex exec --json`** — Starts a new streaming conversation
- **`codex exec resume --json <thread_id>`** — Continues an existing Codex thread
- **`thread.started` / `turn.*` / `item.*` events** — Streamed into the UI and remote/mobile bridge in real time
- **`command_execution` items** — Rendered as live shell/tool cards in the chat transcript

### Session Management

- **Discovery** — Reads from `~/.codex/sessions/` and archived rollout JSONL files
- **Resume** — Uses `codex exec resume --json` with the Codex `thread_id`
- **Runtime Preservation** — Switching threads saves/restores streaming state (tool activities, content)

### Tool Activity Display

Tool calls are shown as collapsible cards matching Codex CLI output:
- ▶ Spinner while running → ✓ Checkmark when done
- Tool name + brief input shown inline (e.g. `Read → src/App.tsx`)
- Expand to see full input/output

### Packaging

Native modules are handled automatically during packaging:
- **node-pty** — Rebuilt for Electron ABI via `@electron/rebuild`, then copied into the asar (with native files unpacked)
- **PATH fix** — macOS Dock-launched apps get full user PATH by sourcing the login shell

## 🔄 CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | Push to `main` / PR | TypeScript type check + build verify on macOS, Windows, Linux |
| **Release** | Push tag `v*` | Build installers for all platforms → Publish GitHub Release |

### Versioning

App version is automatically synced from git:
- **Tagged commit** (`v1.2.3`) → version `1.2.3`
- **Untagged commit** → version `0.0.0-<commit-hash>`

### Release a new version

```bash
git tag v1.0.0
git push --tags
# → GitHub Actions builds DMG, Squirrel (.exe), .deb for all platforms
# → Creates a GitHub Release with all artifacts
```

## 🖥️ Platform Notes

| | macOS | Windows | Linux |
|---|---|---|---|
| Window | Frameless (hiddenInset) | Standard frame | Standard frame |
| Terminal | zsh (default) | cmd.exe (COMSPEC) | bash/zsh |
| Installer | DMG + ZIP | Squirrel (.exe) | .deb + ZIP |
| Editors | VS Code, Cursor, Zed, Xcode, etc. | VS Code, Cursor (shell: true) | VS Code, Cursor, Zed |
| App icon | .icns | .ico | .png |

## 📄 License

MIT

---

<p align="center">
  Built with Codex CLI
</p>
