import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Flatten JSON để lấy key-value (chỉ string values)
function flattenJson(obj: any, prefix = ''): Record<string, string> {
  let result: Record<string, string> = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[newKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          Object.assign(result, flattenJson(item, `${newKey}[${index}]`));
        });
      } else {
        Object.assign(result, flattenJson(value, newKey));
      }
    }
  }
  return result;
}

// Unflatten JSON để lưu lại nested structure
function unflattenJson(flat: Record<string, string>): any {
  const result: any = {};
  for (const key in flat) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isArray = part.match(/\[(\d+)\]/);
      if (isArray) {
        const arrayIndex = parseInt(isArray[1]);
        const arrayKey = part.split('[')[0];
        current[arrayKey] = current[arrayKey] || [];
        while (current[arrayKey].length <= arrayIndex) {
          current[arrayKey].push({});
        }
        current = current[arrayKey][arrayIndex];
      } else {
        if (i === parts.length - 1) {
          current[part] = flat[key];
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      }
    }
  }
  return result;
}

// Thu thập data từ thư mục
function collectData(folderPath: string): { languages: string[], keys: string[], data: Record<string, Record<string, string>>, missing: Record<string, string[]> } {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  const languages = files.map(f => path.basename(f, '.json'));
  const allKeys = new Set<string>();
  const data: Record<string, Record<string, string>> = {};
  const missing: Record<string, string[]> = {};

  languages.forEach(lang => {
    const filePath = path.join(folderPath, `${lang}.json`);
    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const flattened = flattenJson(json);
      data[lang] = flattened;
      missing[lang] = [];
      Object.keys(flattened).forEach(k => allKeys.add(k));
    } catch (e) {
      const error = e as Error;
      vscode.window.showErrorMessage(`Error reading ${lang}.json: ${error.message}`);
    }
  });

  languages.forEach(lang => {
    allKeys.forEach(key => {
      if (!(key in data[lang])) {
        missing[lang].push(key);
      }
    });
  });

  return { languages, keys: Array.from(allKeys).sort(), data, missing };
}

export function activate(context: vscode.ExtensionContext) {
  let currentFolderPath: string | undefined;
  let panel: vscode.WebviewPanel | undefined;

  const createWebview = async () => {
    if (!currentFolderPath) {
      const folderUri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select i18n Folder' });
      if (!folderUri || folderUri.length === 0) return;
      currentFolderPath = folderUri[0].fsPath;
    }

    if (panel) panel.dispose();
    panel = vscode.window.createWebviewPanel(
      'i18nTable',
      'i18n Table Editor',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const updateWebview = () => {
      if (!currentFolderPath) return;
      try {
        const { languages, keys, data, missing } = collectData(currentFolderPath);
        if (panel) {
          panel.webview.html = getWebviewContent(languages, keys, data, missing);
          panel.webview.postMessage({ command: 'updateData', languages, keys, data, missing });
        }
      } catch (e) {
        const error = e as Error;
        vscode.window.showErrorMessage(`Error updating Webview: ${error.message}`);
      }
    };

    updateWebview();

    // File watcher
    if (currentFolderPath) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(currentFolderPath, '*.json'));
      watcher.onDidChange(() => updateWebview());
      watcher.onDidCreate(() => updateWebview());
      watcher.onDidDelete(() => updateWebview());
      context.subscriptions.push(watcher);
    }

    // Xử lý message từ Webview
    panel.webview.onDidReceiveMessage(message => {
      if (!currentFolderPath) return;
      switch (message.command) {
        case 'addLanguage':
          vscode.window.showInputBox({ prompt: 'New Language Code (e.g., fr)' }).then(newLang => {
            if (newLang) {
              const newFile = path.join(currentFolderPath, `${newLang}.json`);
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
              const oldFile = path.join(currentFolderPath, `${message.lang}.json`);
              const newFile = path.join(currentFolderPath, `${newName}.json`);
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
              const { languages } = collectData(currentFolderPath);
              languages.forEach(lang => {
                const filePath = path.join(currentFolderPath, `${lang}.json`);
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
        case 'saveCell':
          const filePath = path.join(currentFolderPath, `${message.lang}.json`);
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
    vscode.commands.registerCommand('i18nTableEditor.openTable', createWebview)
  );

  // Sidebar View
  class I18nTableSidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
      return element;
    }

    getChildren(): vscode.TreeItem[] {
      const item = new vscode.TreeItem('Open i18n Table', vscode.TreeItemCollapsibleState.None);
      item.command = {
        command: 'i18nTableEditor.openTable',
        title: 'Open i18n Table Editor',
        tooltip: 'Open the i18n Table Editor'
      };
      return [item];
    }
  }

  const sidebarProvider = new I18nTableSidebarProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('i18nTableEditor.sidebar', sidebarProvider)
  );

}

function getWebviewContent(languages: string[], keys: string[], data: Record<string, Record<string, string>>, missing: Record<string, string[]>) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>i18n Table Editor</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        td.missing { background-color: #fee2e2; }
        #columns { margin: 10px 0; }
        #missingReport { margin-top: 20px; }
      </style>
    </head>
    <body class="p-4 bg-gray-50">
      <h1 class="text-2xl font-bold mb-4">i18n Table Editor</h1>
      <div class="flex space-x-2 mb-4">
        <button onclick="addLanguage()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition">Add Language</button>
        <button onclick="addKey()" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition">Add Key</button>
        <button onclick="refresh()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition">Refresh</button>
      </div>
      <div id="columns" class="text-sm">Columns: </div>
      <table id="i18nTable" class="bg-white shadow rounded-md">
        <thead><tr class="bg-gray-100"><th class="font-semibold">Key</th></tr></thead>
        <tbody></tbody>
      </table>
      <div id="missingReport" class="mt-4">
        <h2 class="text-lg font-semibold">Missing Keys Report</h2>
        <ul id="missingList" class="list-disc pl-5"></ul>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let currentData = ${JSON.stringify({ languages, keys, data, missing })};
        let hiddenColumns = new Set();

        function renderTable() {
          const table = document.getElementById('i18nTable');
          const thead = table.querySelector('thead tr');
          const tbody = table.querySelector('tbody');
          thead.innerHTML = '<th class="font-semibold">Key</th>';
          currentData.languages.forEach(lang => {
            if (!hiddenColumns.has(lang)) {
              const th = document.createElement('th');
              th.className = 'font-semibold';
              th.innerHTML = \`\${lang} <button class="ml-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-2 py-1 rounded-md transition" onclick="renameLanguage('\${lang}')">Rename</button>\`;
              thead.appendChild(th);
            }
          });

          tbody.innerHTML = '';
          currentData.keys.forEach(key => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + key + '</td>';
            currentData.languages.forEach(lang => {
              if (!hiddenColumns.has(lang)) {
                const value = currentData.data[lang][key] || '';
                const td = document.createElement('td');
                td.contentEditable = true;
                td.textContent = value;
                if (!value) td.classList.add('missing');
                td.onblur = () => vscode.postMessage({ command: 'saveCell', key, lang, value: td.textContent });
                tr.appendChild(td);
              }
            });
            tbody.appendChild(tr);
          });

          const columnsDiv = document.getElementById('columns');
          columnsDiv.innerHTML = 'Columns: ';
          currentData.languages.forEach(lang => {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !hiddenColumns.has(lang);
            cb.className = 'mr-1';
            cb.onchange = () => {
              if (cb.checked) hiddenColumns.delete(lang);
              else hiddenColumns.add(lang);
              renderTable();
            };
            columnsDiv.appendChild(cb);
            columnsDiv.appendChild(document.createTextNode(lang + ' '));
          });

          const missingList = document.getElementById('missingList');
          missingList.innerHTML = '';
          currentData.languages.forEach(lang => {
            if (currentData.missing[lang].length > 0) {
              const li = document.createElement('li');
              li.textContent = \`\${lang}: \${currentData.missing[lang].join(', ')}\`;
              missingList.appendChild(li);
            }
          });
        }

        function addLanguage() { vscode.postMessage({ command: 'addLanguage' }); }
        function addKey() { vscode.postMessage({ command: 'addKey' }); }
        function renameLanguage(lang) { vscode.postMessage({ command: 'renameLanguage', lang }); }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }

        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'updateData') {
            currentData = message;
            renderTable();
          }
        });

        renderTable();
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {}