import * as vscode from 'vscode';
import { getConfig, onConfigChange } from './config';
import { AdKarClient } from './client';
import { StatusBarSurface } from './surfaces/statusbar';
import { SidebarSurface } from './surfaces/sidebar';
import { NotificationSurface } from './surfaces/notification';
import { WelcomeSurface } from './surfaces/welcome';
import { InlineSurface } from './surfaces/inline';
import { TerminalSurface } from './surfaces/terminal';

let statusBar: StatusBarSurface | undefined;
let sidebar: SidebarSurface | undefined;
let notification: NotificationSurface | undefined;
let welcome: WelcomeSurface | undefined;
let inline: InlineSurface | undefined;
let terminal: TerminalSurface | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();

  if (!config.apiKey) {
    vscode.window.showInformationMessage(
      'AdKar: No API key found. Run `npx adkar login` in your terminal to connect.',
      'Open Terminal'
    ).then(choice => {
      if (choice === 'Open Terminal') {
        const term = vscode.window.createTerminal('AdKar Login');
        term.show();
        term.sendText('npx adkar login');
      }
    });
    return;
  }

  if (!config.enabled) return;

  const client = new AdKarClient(config.publisherId, config.apiKey, config.apiUrl);

  // Sidebar
  if (config.surfaces.sidebar) {
    sidebar = new SidebarSurface(client, context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SidebarSurface.viewType, sidebar)
    );
    context.subscriptions.push(sidebar);
  }

  // Status bar
  if (config.surfaces.statusBar) {
    statusBar = new StatusBarSurface(client);
    statusBar.registerClickCommand(context);
    await statusBar.start();
    context.subscriptions.push(statusBar);
  }

  // Notifications — disabled (too intrusive)
  // if (config.surfaces.notifications) {
  //   notification = new NotificationSurface(client);
  //   notification.start();
  //   context.subscriptions.push(notification);
  // }

  // Welcome tab — disabled (too intrusive)
  // if (config.surfaces.welcome) {
  //   welcome = new WelcomeSurface(client, context);
  //   await welcome.showIfDue();
  //   context.subscriptions.push(welcome);
  // }

  // Inline decorations
  inline = new InlineSurface(client);
  await inline.start();
  context.subscriptions.push(inline);

  // Terminal banner ads — blocks terminal until Ctrl+C
  terminal = new TerminalSurface(client);
  terminal.start();
  context.subscriptions.push(terminal);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('adkar.refreshAd', async () => {
      await statusBar?.refresh();
      await sidebar?.refresh();
    }),

    onConfigChange(async () => {
      const newConfig = getConfig();
      if (!newConfig.enabled) {
        statusBar?.stop();
        inline?.stop();
        terminal?.stop();
      }
    })
  );
}

export function deactivate(): void {
  // VS Code will call dispose() on all context.subscriptions
}
