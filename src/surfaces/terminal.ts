import * as vscode from 'vscode';
import { AdKarClient, Ad } from '../client';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Foreground
  white: '\x1b[97m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  // Clear
  clear: '\x1b[2J\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

class AdPseudoTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<void>();
  onDidWrite = this.writeEmitter.event;
  onDidClose = this.closeEmitter.event;

  private ad: Ad;
  private client: AdKarClient;

  constructor(ad: Ad, client: AdKarClient) {
    this.ad = ad;
    this.client = client;
  }

  open(): void {
    this.render();
    this.client.trackImpression(this.ad).catch(() => {});
  }

  handleInput(data: string): void {
    if (data === '\x03' || data === '\r' || data === 'q' || data === '\x1b') {
      this.writeEmitter.fire(C.showCursor);
      this.closeEmitter.fire();
      return;
    }

    if (/^[a-zA-Z0-9]$/.test(data) && data !== 'q') {
      this.client.trackClick(this.ad).catch(() => {});
      vscode.env.openExternal(vscode.Uri.parse(this.ad.url));
      this.writeEmitter.fire(C.showCursor);
      this.closeEmitter.fire();
    }
  }

  close(): void {
    this.writeEmitter.dispose();
    this.closeEmitter.dispose();
  }

  private render(): void {
    const W = 70;
    const ad = this.ad;

    const headline = ad.headline.slice(0, W - 4);
    const body = ad.body ? ad.body.slice(0, W - 4) : '';
    const cta = ad.cta || 'Learn More';
    const url = ad.url.slice(0, W - 4);

    const line = `${C.green}${'─'.repeat(W)}${C.reset}`;
    const visLen = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z?]/g, '').length;
    const center = (s: string) => {
      const pad = Math.max(0, Math.floor((W - visLen(s)) / 2));
      return ' '.repeat(pad) + s;
    };

    const lines: string[] = [];

    lines.push(C.clear + C.hideCursor);
    lines.push('');
    lines.push(line);
    lines.push(center(`${C.brightGreen}${C.bold}⚡ AdKar${C.reset}`));
    lines.push(center(`${C.gray}[Sponsored]${C.reset}`));
    lines.push('');
    lines.push(`  ${C.white}${C.bold}${headline}${C.reset}`);
    if (body) {
      lines.push(`  ${C.cyan}${body}${C.reset}`);
    }
    lines.push('');
    lines.push(`  ${C.brightYellow}${C.bold}▸ ${cta}${C.reset}`);
    lines.push(`  ${C.dim}${url}${C.reset}`);
    lines.push('');
    lines.push(line);
    lines.push(`  ${C.gray}Press any key to visit  •  Ctrl+C to dismiss${C.reset}`);
    lines.push('');

    this.writeEmitter.fire(lines.join('\r\n'));
  }
}

export class TerminalSurface implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private client: AdKarClient;
  private cooldownMs = 5 * 60 * 1000;
  private lastShown = 0;
  private isAdTerminal = new WeakSet<vscode.Terminal>();

  constructor(client: AdKarClient) {
    this.client = client;
  }

  start(): void {
    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        if (this.isAdTerminal.has(terminal)) return;
        this.maybeShowAd(terminal);
      })
    );

    if (vscode.window.terminals.length > 0) {
      setTimeout(() => this.maybeShowAd(vscode.window.terminals[0]), 1000);
    }
  }

  private async maybeShowAd(originalTerminal: vscode.Terminal): Promise<void> {
    const now = Date.now();
    if (now - this.lastShown < this.cooldownMs) return;

    const ad = await this.client.fetchAd('terminal-banner');
    if (!ad) return;

    this.lastShown = now;

    const pty = new AdPseudoTerminal(ad, this.client);
    const adTerminal = vscode.window.createTerminal({
      name: `⚡ Sponsored`,
      pty,
    });
    this.isAdTerminal.add(adTerminal);
    adTerminal.show();

    const listener = vscode.window.onDidCloseTerminal((closed) => {
      if (closed === adTerminal) {
        listener.dispose();
        originalTerminal.show();
      }
    });
    this.disposables.push(listener);
  }

  stop(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  dispose(): void {
    this.stop();
  }
}
