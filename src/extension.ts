// extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config';
import { getWebviewContent } from './webview';
import { collectDataFlat, collectDataNested } from './dataCollector';
import { SidebarProvider } from './sidebar';
import { flattenJson, unflattenJson } from './jsonUtils';

export function activate(context: vscode.ExtensionContext) {
  let currentFolderPath: string | undefined;
  let currentStructureType: 'flat' | 'nested' | undefined;
  let currentSelectedFile: string | undefined; // For nested structure
  let panel: vscode.WebviewPanel | undefined;

  const selectFolder = async (): Promise<string | undefined> => {
    const folderUri = await vscode.window.showOpenDialog({ 
      canSelectFolders: true, 
      canSelectFiles: false, 
      openLabel: 'Select Locale Folder' 
    });
    if (!folderUri || folderUri.length === 0) {
      vscode.window.showErrorMessage('No folder selected');
      return undefined;
    }
    return folderUri[0].fsPath;
  };

  const selectStructureType = async (): Promise<'flat' | 'nested' | undefined> => {
    const choice = await vscode.window.showQuickPick([
      {
        label: 'Flat Structure',
        description: 'Files like en.json, vi.json, ko.json in root folder',
        detail: 'Traditional structure with language files directly in the folder'
      },
      {
        label: 'Nested Structure', 
        description: 'Folders like en/, vi/, ko/ with files inside each',
        detail: 'Organized structure with language folders containing multiple JSON files'
      }
    ], {
      placeHolder: 'Select your locale folder structure type'
    });

    if (!choice) return undefined;
    return choice.label === 'Flat Structure' ? 'flat' : 'nested';
  };

  const selectFileForNested = async (folderPath: string): Promise<string | undefined> => {
    // Get available files from the first language folder
    const languageFolders = fs.readdirSync(folderPath)
      .filter(item => fs.statSync(path.join(folderPath, item)).isDirectory());
    
    if (languageFolders.length === 0) {
      vscode.window.showErrorMessage('No language folders found');
      return undefined;
    }

    const firstLangFolder = path.join(folderPath, languageFolders[0]);
    const availableFiles = fs.readdirSync(firstLangFolder)
      .filter(f => f.endsWith('.json'));

    if (availableFiles.length === 0) {
      vscode.window.showErrorMessage('No JSON files found in language folders');
      return undefined;
    }

    const selectedFile = await vscode.window.showQuickPick(
      availableFiles.map(file => ({
        label: file,
        description: `Edit translations for ${file}`
      })),
      {
        placeHolder: 'Select which JSON file to edit'
      }
    );

    return selectedFile?.label;
  };

  const initializeWorkspace = async () => {
    currentFolderPath = await selectFolder();
    if (!currentFolderPath) return false;

    currentStructureType = await selectStructureType();
    if (!currentStructureType) return false;

    if (currentStructureType === 'nested') {
      currentSelectedFile = await selectFileForNested(currentFolderPath);
      if (!currentSelectedFile) return false;
    }

    return true;
  };

  const createWebview = async () => {
    // If no workspace is initialized, initialize it
    if (!currentFolderPath || !currentStructureType) {
      const initialized = await initializeWorkspace();
      if (!initialized) return;
    }

    if (panel) panel.dispose();
    panel = vscode.window.createWebviewPanel(
      'localeTable',
      'Locale Table Editor',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const updateWebview = () => {
      if (!currentFolderPath || !panel || !currentStructureType) return;
      try {
        let result;
        if (currentStructureType === 'flat') {
          result = collectDataFlat(currentFolderPath);
        } else {
          result = collectDataNested(currentFolderPath, currentSelectedFile!);
        }
        
        const { languages, keys, data } = result;
        const config = getConfig();
        
        panel.webview.postMessage({ 
          command: 'updateData', 
          languages, 
          keys, 
          data, 
          config,
          structureType: currentStructureType,
          selectedFile: currentSelectedFile 
        });
      } catch (e) {
        const error = e as Error;
        vscode.window.showErrorMessage(`Error updating Webview: ${error.message}`);
      }
    };

    // Set initial empty HTML to initialize Webview
    const config = getConfig();
    panel.webview.html = getWebviewContent([], [], {}, config, currentStructureType, currentSelectedFile);
    updateWebview(); // Send real data via postMessage

    // File watcher
    if (currentFolderPath) {
      let watchPattern: string;
      if (currentStructureType === 'flat') {
        watchPattern = '*.json';
      } else {
        watchPattern = `**/${currentSelectedFile}`;
      }
      
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(currentFolderPath, watchPattern)
      );
      watcher.onDidChange(() => updateWebview());
      watcher.onDidCreate(() => updateWebview());
      watcher.onDidDelete(() => updateWebview());
      context.subscriptions.push(watcher);
    }

    // Handle messages from Webview
    panel.webview.onDidReceiveMessage(async message => {
      if (!currentFolderPath || !currentStructureType) {
        const initialized = await initializeWorkspace();
        if (!initialized) return;
        updateWebview();
        return;
      }

      switch (message.command) {
        case 'changeFolder':
          const initialized = await initializeWorkspace();
          if (initialized) {
            updateWebview();
          }
          break;
          
        case 'changeFile':
          if (currentStructureType === 'nested' && currentFolderPath) {
            const newFile = await selectFileForNested(currentFolderPath);
            if (newFile) {
              currentSelectedFile = newFile;
              updateWebview();
            }
          }
          break;

        case 'addLanguage':
          vscode.window.showInputBox({ prompt: 'New Language Code (e.g., fr)' }).then(newLang => {
            if (newLang && currentFolderPath && currentStructureType) {
              try {
                if (currentStructureType === 'flat') {
                  const newFile = path.join(currentFolderPath, `${newLang}.json`);
                  fs.writeFileSync(newFile, '{}');
                } else {
                  const newFolder = path.join(currentFolderPath, newLang);
                  if (!fs.existsSync(newFolder)) {
                    fs.mkdirSync(newFolder);
                  }
                  const newFile = path.join(newFolder, currentSelectedFile!);
                  fs.writeFileSync(newFile, '{}');
                }
                updateWebview();
              } catch (e) {
                const error = e as Error;
                vscode.window.showErrorMessage(`Error creating ${newLang}: ${error.message}`);
              }
            }
          });
          break;

        case 'renameLanguage':
          vscode.window.showInputBox({ prompt: `Rename ${message.lang} to?` }).then(newName => {
            if (newName && currentFolderPath && currentStructureType) {
              try {
                if (currentStructureType === 'flat') {
                  const oldFile = path.join(currentFolderPath, `${message.lang}.json`);
                  const newFile = path.join(currentFolderPath, `${newName}.json`);
                  fs.renameSync(oldFile, newFile);
                } else {
                  const oldFolder = path.join(currentFolderPath, message.lang);
                  const newFolder = path.join(currentFolderPath, newName);
                  fs.renameSync(oldFolder, newFolder);
                }
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
            if (newKey && currentFolderPath && currentStructureType) {
              let result;
              if (currentStructureType === 'flat') {
                result = collectDataFlat(currentFolderPath);
              } else {
                result = collectDataNested(currentFolderPath, currentSelectedFile!);
              }
              
              const { languages } = result;
              languages.forEach(lang => {
                let filePath: string;
                if (currentStructureType === 'flat') {
                  filePath = path.join(currentFolderPath!, `${lang}.json`);
                } else {
                  filePath = path.join(currentFolderPath!, lang, currentSelectedFile!);
                }
                
                try {
                  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                  const flat = flattenJson(json);
                  flat[newKey] = '';
                  fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
                } catch (e) {
                  const error = e as Error;
                  vscode.window.showErrorMessage(`Error updating ${lang}: ${error.message}`);
                }
              });
              updateWebview();
            }
          });
          break;

        case 'deleteKey':
          if (currentFolderPath && currentStructureType) {
            let result;
            if (currentStructureType === 'flat') {
              result = collectDataFlat(currentFolderPath);
            } else {
              result = collectDataNested(currentFolderPath, currentSelectedFile!);
            }
            
            const { languages } = result;
            languages.forEach(lang => {
              let filePath: string;
              if (currentStructureType === 'flat') {
                filePath = path.join(currentFolderPath!, `${lang}.json`);
              } else {
                filePath = path.join(currentFolderPath!, lang, currentSelectedFile!);
              }
              
              try {
                const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const flat = flattenJson(json);
                delete flat[message.key];
                fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
              } catch (e) {
                const error = e as Error;
                vscode.window.showErrorMessage(`Error deleting key from ${lang}: ${error.message}`);
              }
            });
            updateWebview();
          }
          break;

        case 'duplicateKey':
          if (currentFolderPath && currentStructureType) {
            let result;
            if (currentStructureType === 'flat') {
              result = collectDataFlat(currentFolderPath);
            } else {
              result = collectDataNested(currentFolderPath, currentSelectedFile!);
            }
            
            const { languages } = result;
            languages.forEach(lang => {
              let filePath: string;
              if (currentStructureType === 'flat') {
                filePath = path.join(currentFolderPath!, `${lang}.json`);
              } else {
                filePath = path.join(currentFolderPath!, lang, currentSelectedFile!);
              }
              
              try {
                const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const flat = flattenJson(json);
                if (flat[message.originalKey]) {
                  flat[message.newKey] = flat[message.originalKey];
                }
                fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
              } catch (e) {
                const error = e as Error;
                vscode.window.showErrorMessage(`Error duplicating key in ${lang}: ${error.message}`);
              }
            });
            updateWebview();
          }
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
          if (currentFolderPath && currentStructureType) {
            let filePath: string;
            if (currentStructureType === 'flat') {
              filePath = path.join(currentFolderPath, `${message.lang}.json`);
            } else {
              filePath = path.join(currentFolderPath, message.lang, currentSelectedFile!);
            }
            
            try {
              const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              const flat = flattenJson(json);
              flat[message.key] = message.value;
              fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
              updateWebview();
            } catch (e) {
              const error = e as Error;
              vscode.window.showErrorMessage(`Error saving ${message.lang}: ${error.message}`);
            }
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

export function deactivate() {}