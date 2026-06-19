import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AdKarConfig {
  publisherId: string;
  apiKey: string;
  apiUrl: string;
  enabled: boolean;
  surfaces: {
    statusBar: boolean;
    sidebar: boolean;
    notifications: boolean;
    welcome: boolean;
  };
}

function readSharedConfig(): { apiKey: string; apiUrl: string } {
  try {
    const configPath = path.join(os.homedir(), '.adkar', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw);
    return { apiKey: cfg.apiKey ?? '', apiUrl: cfg.apiUrl ?? 'https://api.adkar.online' };
  } catch {
    return { apiKey: '', apiUrl: 'https://api.adkar.online' };
  }
}

export function getConfig(): AdKarConfig {
  const cfg = vscode.workspace.getConfiguration('adkar');
  const shared = readSharedConfig();

  // VS Code settings override shared config, but fall back to ~/.adkar/config.json
  const apiKey = cfg.get<string>('apiKey', '') || shared.apiKey;
  const apiUrl = cfg.get<string>('apiUrl', '') || shared.apiUrl;

  return {
    publisherId: cfg.get<string>('publisherId', ''),
    apiKey,
    apiUrl,
    enabled: cfg.get<boolean>('enabled', true),
    surfaces: {
      statusBar: cfg.get<boolean>('surfaces.statusBar', true),
      sidebar: cfg.get<boolean>('surfaces.sidebar', true),
      notifications: cfg.get<boolean>('surfaces.notifications', true),
      welcome: cfg.get<boolean>('surfaces.welcome', true),
    },
  };
}

export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('adkar')) {
      callback();
    }
  });
}
