import * as vscode from 'vscode';
import { AdKarClient, Ad } from '../client';

export class SidebarSurface implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'adkar.sidebar';

  private view?: vscode.WebviewView;
  private timer: ReturnType<typeof setInterval> | undefined;
  private ads: Ad[] = [];
  private client: AdKarClient;

  constructor(client: AdKarClient, _extensionUri: vscode.Uri) {
    this.client = client;
  }

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;

    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (message: { command: string; index?: number }) => {
      if (message.command === 'click' && typeof message.index === 'number') {
        const ad = this.ads[message.index];
        if (ad) {
          await this.client.trackClick(ad);
          await vscode.env.openExternal(vscode.Uri.parse(ad.url));
        }
      } else if (message.command === 'refresh') {
        await this.refresh();
      }
    });

    await this.refresh();
    this.timer = setInterval(() => this.refresh(), 60_000);
  }

  async refresh(): Promise<void> {
    if (!this.view) return;

    const newAds: Ad[] = [];
    for (let i = 0; i < 3; i++) {
      const ad = await this.client.fetchAd('sidebar-panel');
      if (!ad) break;
      if (newAds.some(a => a.id === ad.id)) break;
      newAds.push(ad);
      await this.client.trackImpression(ad);
    }

    if (newAds.length > 0) {
      this.ads = newAds;
    }

    if (this.ads.length === 0) {
      this.view.webview.html = this.buildFallbackHtml();
      return;
    }

    this.view.webview.html = this.buildMultiHtml(this.ads);
  }

  private buildMultiHtml(ads: Ad[]): string {
    // SECURITY: never render server-provided HTML (ad.htmlContent) raw into a
    // scripted webview — that was an advertiser→publisher stored-XSS / RCE sink.
    // Only escaped, structured fields are rendered.
    const cards = ads.map((ad, i) => {
      return `<div class="card clickable" data-index="${i}">
        <div class="badge">Sponsored</div>
        <h2>${this.esc(ad.headline)}</h2>
        ${ad.body ? `<p>${this.esc(ad.body)}</p>` : ''}
        <button class="cta" data-index="${i}">${this.esc(ad.cta || 'Learn More')}</button>
        <div class="powered">Powered by AdKar</div>
      </div>`;
    }).join('\n');

    const nonce = this.nonce();
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${this.getStyles()}</style></head>
<body>
  ${cards}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-index') || '0');
        vscode.postMessage({ command: 'click', index: idx });
      });
    });
    document.querySelectorAll('.cta').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-index') || '0');
        vscode.postMessage({ command: 'click', index: idx });
      });
    });
    document.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const card = a.closest('.clickable');
        if (card) {
          const idx = parseInt(card.getAttribute('data-index') || '0');
          vscode.postMessage({ command: 'click', index: idx });
        }
      });
    });
  </script>
</body></html>`;
  }

  private buildFallbackHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>${this.getStyles()}</style></head>
<body>
  <div class="card">
    <div class="badge">AdKar</div>
    <h2>No ads available</h2>
    <p>Ads will appear here once campaigns are running.</p>
    <div class="powered">Powered by AdKar</div>
  </div>
</body></html>`;
  }

  private getStyles(): string {
    return `
      body { margin: 0; padding: 8px; font-family: var(--vscode-font-family, -apple-system, sans-serif); background: var(--vscode-sideBar-background, #1e1e1e); color: var(--vscode-foreground, #ccc); }
      .card { border: 1px solid var(--vscode-panel-border, #333); border-radius: 8px; padding: 16px; background: var(--vscode-editor-background, #252526); margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
      .card:hover { border-color: var(--vscode-focusBorder, #0e639c); }
      .badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground, #888); margin-bottom: 8px; }
      h2 { font-size: 14px; margin: 0 0 8px; color: var(--vscode-foreground, #eee); font-weight: 600; }
      p { font-size: 12px; color: var(--vscode-descriptionForeground, #aaa); margin: 0 0 12px; line-height: 1.4; }
      .cta { display: block; width: 100%; padding: 8px; border: none; border-radius: 6px; background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); font-size: 13px; font-weight: 600; cursor: pointer; }
      .cta:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
      .powered { font-size: 10px; color: var(--vscode-descriptionForeground, #666); margin-top: 10px; text-align: center; }
    `;
  }

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private nonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  stop(): void {
    if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined; }
  }

  dispose(): void { this.stop(); }
}
