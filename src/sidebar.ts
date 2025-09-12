import * as vscode from 'vscode';

export class SidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const flatStructureItem = new vscode.TreeItem('Open with Flat Structure', vscode.TreeItemCollapsibleState.None);
    flatStructureItem.command = {
      command: 'localeLanguagesJsonTableEditor.openTableFlat',
      title: 'Open Locale Table Editor - Flat Structure',
      tooltip: 'Open the Locale Table Editor with Flat Structure (files like en.json, vi.json in root folder)'
    };
    flatStructureItem.iconPath = new vscode.ThemeIcon('file-text');

    const nestedStructureItem = new vscode.TreeItem('Open with Nested Structure', vscode.TreeItemCollapsibleState.None);
    nestedStructureItem.command = {
      command: 'localeLanguagesJsonTableEditor.openTableNested',
      title: 'Open Locale Table Editor - Nested Structure',
      tooltip: 'Open the Locale Table Editor with Nested Structure (folders like en/, vi/ with files inside each)'
    };
    nestedStructureItem.iconPath = new vscode.ThemeIcon('folder-opened');

    return [flatStructureItem, nestedStructureItem];
  }
}