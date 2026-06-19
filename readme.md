# AdKar — Developer Ads for VS Code

Monetize your development workflow with contextual, non-intrusive ads from developer tool companies.

## What This Does

AdKar shows sponsored content in your VS Code sidebar and status bar. You earn 75% of all ad revenue — paid via UPI or bank transfer.

- **Sidebar ads** — Sponsored cards from developer tool companies (multiple ads stacked)
- **Status bar** — Ad headline on the left, your total earnings (₹) on the right
- **Inline hints** — Subtle decorations (optional)
- **Terminal banners** — On terminal open (optional)

All ads are developer-relevant: hosting, databases, APIs, dev tools.

## Setup

```bash
npx @adkar/cli-hook login
```

This command:
1. Opens browser for authentication
2. Saves your API key to `~/.adkar/config.json`
3. Installs Claude Code / Codex hooks
4. Configures MCP server for sponsored recommendations
5. Extension picks up the config automatically

## Open Source — Full Transparency

This extension is fully open source so you can audit every line:

- **No telemetry** beyond impression/click tracking for earnings
- **No data collection** — we don't read your code or files
- **No RCE** — the extension only makes HTTPS calls to `api.adkar.online`
- **Config is local** — stored in `~/.adkar/config.json`

## Building from Source

```bash
git clone https://github.com/kisnaXD/adkar-vscode.git
cd adkar-vscode
npm install
npm run build
```

Package as VSIX:
```bash
npx @vscode/vsce package
```

## Architecture

```
src/
  extension.ts    — Entry point, activates surfaces
  config.ts       — Reads ~/.adkar/config.json + VS Code settings
  client.ts       — HTTP client for api.adkar.online (fetchAd, trackImpression, fetchEarnings)
  surfaces/
    sidebar.ts    — Webview sidebar with multiple ad cards
    statusbar.ts  — Left: ad headline, Right: earnings counter
    inline.ts     — Code decoration hints
    terminal.ts   — Terminal banner ads
    notification.ts — Toast notifications (disabled by default)
    welcome.ts    — Welcome tab (disabled by default)
```

## Privacy

The extension sends: surface type, active editor language ID, framework detection (from package.json deps).

The extension does NOT send: file contents, code, file paths, git history, or personal data.

All API calls go to `api.adkar.online` only.

## Links

- Website: [adkar.online](https://adkar.online)
- Dashboard: [adkar.online/dashboard/publisher](https://adkar.online/dashboard/publisher)

## License

Source Available — see [LICENSE](LICENSE). You can read and audit the code. You cannot fork, redistribute, or use it to build competing products.
