import * as vscode from 'vscode';
import { AdKarClient, Ad } from '../client';

export class StatusBarSurface implements vscode.Disposable {
  private adItem: vscode.StatusBarItem;
  private earningsItem: vscode.StatusBarItem;
  private timer: ReturnType<typeof setInterval> | undefined;
  private currentAd: Ad | null = null;
  private client: AdKarClient;
  private serverEarnings: number = 0;
  private serverImpressions: number = 0;

  constructor(client: AdKarClient) {
    this.client = client;

    this.adItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.adItem.command = 'adkar.statusBarClick';

    this.earningsItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      0
    );
    this.earningsItem.tooltip = 'AdKar Total Earnings';
  }

  async start(): Promise<void> {
    this.adItem.text = '$(megaphone) AdKar';
    this.adItem.tooltip = 'Loading ad...';
    this.adItem.show();

    this.earningsItem.show();

    await this.fetchRealEarnings();
    this.updateEarningsDisplay();
    await this.refresh();
    this.timer = setInterval(() => this.tick(), 30_000);
  }

  stop(): void {
    this.adItem.hide();
    this.earningsItem.hide();
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    await this.refresh();
    await this.fetchRealEarnings();
    this.updateEarningsDisplay();
  }

  async refresh(): Promise<void> {
    const ad = await this.client.fetchAd('status-bar');
    if (!ad) {
      if (this.currentAd) return;
      this.adItem.text = '$(megaphone) AdKar';
      return;
    }

    this.currentAd = ad;

    const mainText = `$(megaphone) ${ad.headline}`;
    this.adItem.text = mainText.length > 70 ? mainText.slice(0, 67) + '…' : mainText;
    this.adItem.tooltip = `${ad.headline}\n${ad.body || ''}\n\n→ ${ad.cta} [Sponsored by AdKar]`;

    await this.client.trackImpression(ad);
  }

  private async fetchRealEarnings(): Promise<void> {
    const data = await this.client.fetchEarnings();
    if (data) {
      this.serverEarnings = parseFloat(data.totalEarnings) || 0;
      this.serverImpressions = data.totalImpressions;
    }
  }

  private updateEarningsDisplay(): void {
    const rupees = this.serverEarnings.toFixed(2);
    this.earningsItem.text = `$(zap) ₹${rupees}`;
    this.earningsItem.tooltip = `AdKar Total Earnings: ₹${rupees}\n${this.serverImpressions} total impressions`;
  }

  registerClickCommand(context: vscode.ExtensionContext): void {
    const cmd = vscode.commands.registerCommand('adkar.statusBarClick', async () => {
      if (!this.currentAd) return;
      await this.client.trackClick(this.currentAd);
      await vscode.env.openExternal(vscode.Uri.parse(this.currentAd.url));
    });
    context.subscriptions.push(cmd);
  }

  dispose(): void {
    this.stop();
    this.adItem.dispose();
    this.earningsItem.dispose();
  }
}
