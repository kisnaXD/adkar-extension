import * as vscode from 'vscode';
import { AdKarClient } from '../client';

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes (was 10 — more aggressive)

export class NotificationSurface implements vscode.Disposable {
  private lastShown = 0;
  private disposables: vscode.Disposable[] = [];
  private client: AdKarClient;

  constructor(client: AdKarClient) {
    this.client = client;
  }

  start(): void {
    // Show one immediately on activation
    setTimeout(() => this.maybeShow('startup'), 3000);

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => this.maybeShow('file-save')),
      vscode.window.onDidOpenTerminal(() => this.maybeShow('terminal-open')),
      vscode.debug.onDidStartDebugSession(() => this.maybeShow('debug-start')),
      vscode.window.onDidChangeActiveTextEditor(() => this.maybeShow('editor-change')),
    );
  }

  private async maybeShow(_trigger: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastShown < COOLDOWN_MS) return;

    const ad = await this.client.fetchAd('notification-toast');
    if (!ad) return;

    this.lastShown = now;
    await this.client.trackImpression(ad);

    const selection = await vscode.window.showInformationMessage(
      `[Sponsored] ${ad.headline}${ad.body ? ' — ' + ad.body : ''}`,
      ad.cta || 'Learn More',
      'Dismiss'
    );

    if (selection === (ad.cta || 'Learn More')) {
      await this.client.trackClick(ad);
      await vscode.env.openExternal(vscode.Uri.parse(ad.url));
    }
  }

  stop(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  dispose(): void {
    this.stop();
  }
}
