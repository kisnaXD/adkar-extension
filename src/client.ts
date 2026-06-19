import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Ad {
  id: string;
  trackingToken: string;
  verifyToken: string;
  headline: string;
  body: string;
  cta: string;
  url: string;
  sponsored: boolean;
  surface: string;
  imageUrl?: string | null;
  htmlContent?: string | null;
}

export class AdKarClient {
  private publisherId: string;
  private apiKey: string;
  private apiUrl: string;

  constructor(publisherId: string, apiKey: string, apiUrl: string) {
    this.publisherId = publisherId;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async fetchAd(surface: string): Promise<Ad | null> {
    if (!this.apiKey) return null;

    try {
      const context = this.detectContext();

      const response = await fetch(`${this.apiUrl}/v1/ads/serve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          surface,
          context: { ...context, tool: 'vscode' },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok || response.status === 204) return null;

      return await response.json() as Ad;
    } catch {
      return null;
    }
  }

  async trackImpression(ad: Ad): Promise<void> {
    if (!ad.trackingToken) return;
    try {
      await fetch(`${this.apiUrl}/v1/ads/impression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ trackingToken: ad.trackingToken, verifyToken: ad.verifyToken }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // ignore
    }
  }

  async trackClick(ad: Ad): Promise<void> {
    if (!ad.trackingToken) return;
    try {
      await fetch(`${this.apiUrl}/v1/ads/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ trackingToken: ad.trackingToken }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // ignore
    }
  }

  async fetchEarnings(): Promise<{ totalEarnings: string; totalImpressions: number; totalClicks: number } | null> {
    if (!this.apiKey) return null;
    try {
      const response = await fetch(`${this.apiUrl}/v1/ads/earnings`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      return await response.json() as { totalEarnings: string; totalImpressions: number; totalClicks: number };
    } catch {
      return null;
    }
  }

  private detectContext(): Record<string, string | undefined> {
    const editor = vscode.window.activeTextEditor;
    return {
      language: editor?.document.languageId,
      framework: this.detectFramework(),
    };
  }

  private detectFramework(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return undefined;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const pkgJsonPath = path.join(rootPath, 'package.json');

    try {
      if (!fs.existsSync(pkgJsonPath)) return undefined;
      const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return 'nextjs';
      if (deps['react']) return 'react';
      if (deps['vue']) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps['svelte']) return 'svelte';
      if (deps['express']) return 'express';
    } catch {
      // ignore
    }

    return undefined;
  }
}
