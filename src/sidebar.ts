import * as vscode from 'vscode';

export class SidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const item = new vscode.TreeItem('Open locale table editor', vscode.TreeItemCollapsibleState.None);
    item.command = {
      command: 'localeLanguagesJsonTableEditor.openTable',
      title: 'Open Locale Table Editor',
      tooltip: 'Open the Locale Table Editor'
    };
    return [item];
  }
}