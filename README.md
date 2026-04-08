# T3 Code

T3 Code is a minimal web GUI for coding agents (currently Codex and Claude, more coming soon).

## Installation

> [!WARNING]
> T3 Code currently supports Codex and Claude.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://github.com/openai/codex) and run `codex login`
> - Claude: install Claude Code and run `claude auth login`

### Run without installing

```bash
npx t3
```

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install T3Tools.T3Code
```

#### macOS (Homebrew)

```bash
brew install --cask t3-code
```

#### Arch Linux (AUR)

```bash
yay -S t3code-bin
```

## Local development

This repo pins its source-development toolchain in [`.mise.toml`](./.mise.toml):

- `node = 24.13.1`
- `bun = 1.3.9`

If you already use `mise`, run `mise install` at the repo root.

If you do not use `mise`, install the pinned runtimes manually before continuing. For Bun, the official install path is:

```bash
curl -fsSL https://bun.com/install | bash
```

Then confirm:

```bash
node -v
bun --version
```

Install workspace dependencies:

```bash
bun install
```

Run the local web dev environment:

```bash
T3CODE_NO_BROWSER=1 bun dev
```

The default dev URL is `http://localhost:5733`. If the dev runner selects a different port, use the URL it prints in the terminal.

## Nilus prototype: local read-only test flow

The `crweiner/t3code` fork currently contains a first-pass Nilus read-only prototype.

Use this flow to test it locally:

1. Clone the fork and enter the repo:

```bash
git clone https://github.com/crweiner/t3code
cd t3code
```

2. Install the pinned Node and Bun versions, then install dependencies:

```bash
bun install
```

3. Optional build smoke:

```bash
bun run build
```

4. Start the web dev environment:

```bash
T3CODE_NO_BROWSER=1 bun dev
```

5. Open the printed dev URL and go to `/nilus`.

Default example:

```text
http://localhost:5733/nilus
```

6. In the Nilus page, paste the absolute path to your Nilus repo checkout into the repo path field, then click `Open repo`.

7. Confirm the read-only prototype loads:

- startup summary cards render
- open tasks appear from `todo.txt`
- Talk, Partners, Issues, and Knowledge views show repo documents
- selecting a document shows a preview in the right-hand pane

8. Optional desktop-mode test if you want the native folder picker instead of pasting a path:

```bash
bun dev:desktop
```

Notes:

- the Nilus read-only page does not require provider auth by itself, but Codex or Claude auth is still needed for the broader app experience
- if the default dev ports are busy, set `T3CODE_DEV_INSTANCE` or `T3CODE_PORT_OFFSET` before running `bun dev`
- the `Browse` button only works in the desktop app because it uses the Electron folder picker

## Some notes

We are very very early in this project. Expect bugs.

We are not accepting contributions yet.

Observability guide: [docs/observability.md](./docs/observability.md)

## If you REALLY want to contribute still.... read this first

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
