//extension.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config';
import { getWebviewContent } from './webview';
import { collectData } from './dataCollector';
import { SidebarProvider } from './sidebar';
import { flattenJson, unflattenJson } from './jsonUtils';

export function activate(context: vscode.ExtensionContext) {
  let currentFolderPath: string | undefined;
  let panel: vscode.WebviewPanel | undefined;

  const selectFolder = async (): Promise<string | undefined> => {
    const folderUri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select Locale Folder' });
    if (!folderUri || folderUri.length === 0) {
      vscode.window.showErrorMessage('No folder selected');
      return undefined;
    }
    return folderUri[0].fsPath;
  };

  const createWebview = async () => {
    if (!currentFolderPath) {
      currentFolderPath = await selectFolder();
      if (!currentFolderPath) return;
    }

    if (panel) panel.dispose();
    panel = vscode.window.createWebviewPanel(
      'localeTable',
      'Locale Table Editor',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const updateWebview = () => {
      if (!currentFolderPath || !panel) return;
      try {
        const { languages, keys, data } = collectData(currentFolderPath);
        const config = getConfig();
        panel.webview.postMessage({ command: 'updateData', languages, keys, data, config });
      } catch (e) {
        const error = e as Error;
        vscode.window.showErrorMessage(`Error updating Webview: ${error.message}`);
      }
    };

    // Set initial empty HTML to initialize Webview
    const config = getConfig();
    panel.webview.html = getWebviewContent([], [], {}, config);
    updateWebview(); // Send real data via postMessage

    // File watcher
    if (currentFolderPath) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(currentFolderPath, '*.json'));
      watcher.onDidChange(() => updateWebview());
      watcher.onDidCreate(() => updateWebview());
      watcher.onDidDelete(() => updateWebview());
      context.subscriptions.push(watcher);
    }

    // Handle messages from Webview
    panel.webview.onDidReceiveMessage(async message => {
      if (!currentFolderPath) {
        currentFolderPath = await selectFolder();
        if (!currentFolderPath) return;
      }
      switch (message.command) {
        case 'addLanguage':
          vscode.window.showInputBox({ prompt: 'New Language Code (e.g., fr)' }).then(newLang => {
            if (newLang) {
              const newFile = path.join(currentFolderPath!, `${newLang}.json`);
              try {
                fs.writeFileSync(newFile, '{}');
                updateWebview();
              } catch (e) {
                const error = e as Error;
                vscode.window.showErrorMessage(`Error creating ${newLang}.json: ${error.message}`);
              }
            }
          });
          break;
        case 'renameLanguage':
          vscode.window.showInputBox({ prompt: `Rename ${message.lang} to?` }).then(newName => {
            if (newName) {
              const oldFile = path.join(currentFolderPath!, `${message.lang}.json`);
              const newFile = path.join(currentFolderPath!, `${newName}.json`);
              try {
                fs.renameSync(oldFile, newFile);
                updateWebview();
              } catch (e) {
                const error = e as Error;
                vscode.window.showErrorMessage(`Error renaming ${message.lang}: ${error.message}`);
              }
            }
          });
          break;
        case 'addKey':
          vscode.window.showInputBox({ prompt: 'New Key (e.g., home.new)' }).then(newKey => {
            if (newKey) {
              const { languages } = collectData(currentFolderPath!);
              languages.forEach(lang => {
                const filePath = path.join(currentFolderPath!, `${lang}.json`);
                try {
                  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                  const flat = flattenJson(json);
                  flat[newKey] = '';
                  fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
                } catch (e) {
                  const error = e as Error;
                  vscode.window.showErrorMessage(`Error updating ${lang}.json: ${error.message}`);
                }
              });
              updateWebview();
            }
          });
          break;
        case 'deleteKey':
          const { languages } = collectData(currentFolderPath!);
          languages.forEach(lang => {
            const filePath = path.join(currentFolderPath!, `${lang}.json`);
            try {
              const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              const flat = flattenJson(json);
              delete flat[message.key];
              fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
            } catch (e) {
              const error = e as Error;
              vscode.window.showErrorMessage(`Error deleting key from ${lang}.json: ${error.message}`);
            }
          });
          updateWebview();
          break;
        case 'duplicateKey':
          const { languages: langs } = collectData(currentFolderPath!);
          langs.forEach(lang => {
            const filePath = path.join(currentFolderPath!, `${lang}.json`);
            try {
              const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              const flat = flattenJson(json);
              if (flat[message.originalKey]) {
                flat[message.newKey] = flat[message.originalKey];
              }
              fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
            } catch (e) {
              const error = e as Error;
              vscode.window.showErrorMessage(`Error duplicating key in ${lang}.json: ${error.message}`);
            }
          });
          updateWebview();
          break;
        case 'copyKey':
          const config = getConfig();
          let textToCopy = message.key;

          if (message.useTemplate || config.defaultCopyMode === 'template') {
            textToCopy = config.copyTemplate.replace('{key}', message.key);
          }

          vscode.env.clipboard.writeText(textToCopy);
          vscode.window.showInformationMessage(`Copied: ${textToCopy}`);
          break;
        case 'updateConfig':
          const configuration = vscode.workspace.getConfiguration('localeLanguagesJsonTableEditor');
          await configuration.update(message.key, message.value, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Updated ${message.key} to: ${message.value}`);
          updateWebview();
          break;
        case 'saveCell':
          const filePath = path.join(currentFolderPath!, `${message.lang}.json`);
          try {
            const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const flat = flattenJson(json);
            flat[message.key] = message.value;
            fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
            updateWebview();
          } catch (e) {
            const error = e as Error;
            vscode.window.showErrorMessage(`Error saving ${message.lang}.json: ${error.message}`);
          }
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'localeLanguagesJsonTableEditor');
          break;
        case 'refresh':
          updateWebview();
          break;
      }
    });

    panel.onDidDispose(() => {
      panel = undefined;
    });
  };

  // Command
  context.subscriptions.push(
    vscode.commands.registerCommand('localeLanguagesJsonTableEditor.openTable', createWebview)
  );

  // Sidebar View
  const sidebarProvider = new SidebarProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('localeLanguagesJsonTableEditor.sidebar', sidebarProvider)
  );
}

export function deactivate() { }