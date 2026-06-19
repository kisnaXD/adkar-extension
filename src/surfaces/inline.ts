import * as vscode from 'vscode';
import { AdKarClient, Ad } from '../client';

const SUPPORTED_LANGUAGES = new Set([
  'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
  'python', 'go', 'rust', 'java', 'c', 'cpp', 'csharp',
]);

export class InlineSurface implements vscode.Disposable {
  private decoration: vscode.TextEditorDecorationType;
  private topDecoration: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];
  private currentAd: Ad | null = null;
  private client: AdKarClient;

  constructor(client: AdKarClient) {
    this.client = client;

    // Bottom-of-file subtle ad
    this.decoration = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 2em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
        textDecoration: 'none; opacity: 0.5',
      },
      isWholeLine: true,
    });

    // Top-of-file banner decoration
    this.topDecoration = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 2em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
        textDecoration: 'none; opacity: 0.4',
      },
      isWholeLine: true,
    });
  }

  async start(): Promise<void> {
    await this.refreshAd();

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.applyToEditor(editor);
      }),
      vscode.workspace.onDidSaveTextDocument(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) this.applyToEditor(editor);
      })
    );

    const editor = vscode.window.activeTextEditor;
    if (editor) this.applyToEditor(editor);

    const timer = setInterval(() => this.refreshAd(), 3 * 60 * 1000);
    this.disposables.push({ dispose: () => clearInterval(timer) });
  }

  private async refreshAd(): Promise<void> {
    this.currentAd = await this.client.fetchAd('inline-suggestion');
    const editor = vscode.window.activeTextEditor;
    if (editor) this.applyToEditor(editor);
  }

  private applyToEditor(editor: vscode.TextEditor): void {
    const lang = editor.document.languageId;
    if (!SUPPORTED_LANGUAGES.has(lang)) {
      editor.setDecorations(this.decoration, []);
      editor.setDecorations(this.topDecoration, []);
      return;
    }

    if (!this.currentAd) {
      editor.setDecorations(this.decoration, []);
      editor.setDecorations(this.topDecoration, []);
      return;
    }

    const ad = this.currentAd;
    const commentChar = lang === 'python' ? '#' : '//';

    // Bottom of file
    const lastLine = editor.document.lineCount - 1;
    const lastLineRange = editor.document.lineAt(lastLine).range;
    editor.setDecorations(this.decoration, [{
      range: lastLineRange,
      renderOptions: {
        after: { contentText: `  ${commentChar} ${ad.headline} → ${ad.url} [Sponsored]` },
      },
    }]);

    // Top of file (line 0)
    if (editor.document.lineCount > 1) {
      const firstLineRange = editor.document.lineAt(0).range;
      editor.setDecorations(this.topDecoration, [{
        range: firstLineRange,
        renderOptions: {
          after: { contentText: `  ${commentChar} [Ad] ${ad.cta || 'Sponsored by AdKar'}` },
        },
      }]);
    }
  }

  stop(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decoration, []);
      editor.setDecorations(this.topDecoration, []);
    }
  }

  dispose(): void {
    this.stop();
    this.decoration.dispose();
    this.topDecoration.dispose();
  }
}
