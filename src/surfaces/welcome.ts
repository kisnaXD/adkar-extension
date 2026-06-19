import * as vscode from 'vscode';
import { AdKarClient, Ad } from '../client';

const LAST_SHOWN_KEY = 'adkar.welcome.lastShown';

export class WelcomeSurface implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private client: AdKarClient;
  private context: vscode.ExtensionContext;

  constructor(client: AdKarClient, context: vscode.ExtensionContext) {
    this.client = client;
    this.context = context;
  }

  async showIfDue(): Promise<void> {
    const lastShown = this.context.globalState.get<number>(LAST_SHOWN_KEY, 0);
    const oneHourMs = 60 * 60 * 1000; // show once per hour (was daily)
    if (Date.now() - lastShown < oneHourMs) return;
    await this.show();
  }

  async show(): Promise<void> {
    await this.context.globalState.update(LAST_SHOWN_KEY, Date.now());

    const ad = await this.client.fetchAd('welcome-splash');

    this.panel = vscode.window.createWebviewPanel(
      'adkar.welcome',
      'Welcome — AdKar',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.webview.html = this.buildHtml(ad);

    if (ad) {
      await this.client.trackImpression(ad);
      this.panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
        if (message.command === 'click' && ad) {
          await this.client.trackClick(ad);
          await vscode.env.openExternal(vscode.Uri.parse(ad.url));
        }
      });
    }

    this.panel.onDidDispose(() => { this.panel = undefined; });
  }

  private buildHtml(ad: Ad | null): string {
    const headline = ad?.headline ?? 'Welcome to AdKar';
    const body = ad?.body ?? 'Monetize your VS Code workflow — the ad platform built for Indian developers. 75% revenue share.';
    const cta = ad?.cta ?? 'Get Started';
    const url = ad?.url ?? 'https://adkar.dev';

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { margin: 0; padding: 0; font-family: var(--vscode-font-family, -apple-system, sans-serif); background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #ccc); display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .container { max-width: 500px; text-align: center; padding: 40px; }
  .logo { font-size: 48px; font-weight: 800; letter-spacing: -2px; margin-bottom: 8px; color: var(--vscode-foreground, #eee); }
  .logo span { color: #22c55e; }
  .tagline { font-size: 14px; color: var(--vscode-descriptionForeground, #888); margin-bottom: 32px; }
  h1 { font-size: 24px; margin: 0 0 12px; color: var(--vscode-foreground, #eee); }
  p { font-size: 14px; color: var(--vscode-descriptionForeground, #aaa); line-height: 1.6; margin: 0 0 24px; }
  button { padding: 12px 32px; border: none; border-radius: 8px; background: #22c55e; color: #000; font-size: 15px; font-weight: 700; cursor: pointer; }
  button:hover { background: #16a34a; }
  .badge { font-size: 11px; color: var(--vscode-descriptionForeground, #666); margin-top: 24px; }
</style></head>
<body>
  <div class="container">
    <div class="logo">Ad<span>Kar</span></div>
    <div class="tagline">Developer Ads for India</div>
    <h1>${this.esc(headline)}</h1>
    <p>${this.esc(body)}</p>
    <button id="cta">${this.esc(cta)}</button>
    <div class="badge">[Sponsored] Powered by AdKar</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('cta').addEventListener('click', () => vscode.postMessage({ command: 'click' }));
  </script>
</body></html>`;
  }

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  dispose(): void { this.panel?.dispose(); }
}
