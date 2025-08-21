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
function collectData(folderPath: string): { languages: string[], keys: string[], data: Record<string, Record<string, string>> } {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  const languages = files.map(f => path.basename(f, '.json'));
  const allKeys = new Set<string>();
  const data: Record<string, Record<string, string>> = {};

  languages.forEach(lang => {
    const filePath = path.join(folderPath, `${lang}.json`);
    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const flattened = flattenJson(json);
      data[lang] = flattened;
      Object.keys(flattened).forEach(k => allKeys.add(k));
    } catch (e) {
      const error = e as Error;
      vscode.window.showErrorMessage(`Error reading ${lang}.json: ${error.message}`);
    }
  });

  return { languages, keys: Array.from(allKeys).sort(), data };
}

export function activate(context: vscode.ExtensionContext) {
  let currentFolderPath: string | undefined;
  let panel: vscode.WebviewPanel | undefined;

  const selectFolder = async (): Promise<string | undefined> => {
    const folderUri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select i18n Folder' });
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
      'i18nTable',
      'i18n Table Editor',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const updateWebview = () => {
      if (!currentFolderPath || !panel) return;
      try {
        const { languages, keys, data } = collectData(currentFolderPath);
        panel.webview.html = getWebviewContent(languages, keys, data);
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

function getWebviewContent(languages: string[], keys: string[], data: Record<string, Record<string, string>>) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>i18n Table Editor</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                'vscode-bg': 'var(--vscode-editor-background)',
                'vscode-fg': 'var(--vscode-editor-foreground)',
                'vscode-border': 'var(--vscode-editorWidget-border)',
                'vscode-focus': 'var(--vscode-focusBorder)',
                'vscode-error': 'var(--vscode-editorError-background)',
                'vscode-header': 'var(--vscode-tab-activeBackground)',
                'vscode-hover': 'var(--vscode-list-hoverBackground)',
                'vscode-input': 'var(--vscode-input-background)',
              }
            }
          }
        }
      </script>
      <style>
        body {
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
          font-size: 13px;
        }
        
        .table-container {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 1px solid var(--vscode-editorWidget-border);
        }
        
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
        }
        
        th, td {
          border: 1px solid var(--vscode-editorWidget-border);
          padding: 12px 8px;
          text-align: left;
          vertical-align: top;
          word-wrap: break-word;
          overflow-wrap: break-word;
          width: 200px;
        }
        
        th:first-child, td:first-child {
          width: 250px;
          min-width: 250px;
        }
        
        th {
          background: linear-gradient(135deg, var(--vscode-tab-activeBackground) 0%, var(--vscode-editor-background) 100%);
          cursor: pointer;
          position: sticky;
          top: 0;
          z-index: 10;
          font-weight: 600;
          transition: all 0.2s ease;
          border-bottom: 2px solid var(--vscode-editorWidget-border);
        }
        
        th:hover {
          background: linear-gradient(135deg, var(--vscode-list-hoverBackground) 0%, var(--vscode-tab-activeBackground) 100%);
          transform: translateY(-1px);
        }
        
        td {
          background-color: var(--vscode-editor-background);
          transition: all 0.2s ease;
          line-height: 1.4;
          max-height: 100px;
          overflow-y: auto;
        }
        
        td:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        
        td.missing {
          background: linear-gradient(135deg, var(--vscode-editorError-background) 0%, var(--vscode-editor-background) 100%);
          position: relative;
        }
        
        td.missing::before {
          content: "Missing";
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 10px;
          color: #ef4444;
          opacity: 0.7;
          font-weight: 500;
        }
        
        td[contenteditable]:focus {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
          background-color: var(--vscode-input-background);
          border-color: var(--vscode-focusBorder);
          transform: scale(1.02);
          z-index: 5;
          position: relative;
        }
        
        .sortable:hover {
          background: linear-gradient(135deg, var(--vscode-list-hoverBackground) 0%, var(--vscode-tab-activeBackground) 100%);
        }
        
        .drag-over {
          border-left: 3px solid var(--vscode-focusBorder);
          background: var(--vscode-list-hoverBackground);
        }
        
        .btn {
          transition: all 0.2s ease;
          font-weight: 500;
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .search-input {
          background-color: var(--vscode-input-background);
          border: 2px solid var(--vscode-editorWidget-border);
          color: var(--vscode-editor-foreground);
          transition: all 0.2s ease;
          border-radius: 8px;
        }
        
        .search-input:focus {
          outline: none;
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 0 0 3px rgba(var(--vscode-focusBorder), 0.1);
        }
        
        .checkbox-label {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-editorWidget-border);
          border-radius: 6px;
          padding: 8px 12px;
          margin: 4px;
          cursor: move;
          transition: all 0.2s ease;
          user-select: none;
        }
        
        .checkbox-label:hover {
          background: var(--vscode-list-hoverBackground);
          border-color: var(--vscode-focusBorder);
          transform: translateY(-1px);
        }
        
        .pagination-controls {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-editorWidget-border);
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }
        
        tbody tr:nth-child(even) {
          background-color: rgba(var(--vscode-editorWidget-border), 0.05);
        }
        
        tbody tr:hover {
          background-color: var(--vscode-list-hoverBackground);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .sort-indicator {
          margin-left: 8px;
          opacity: 0.6;
          transition: all 0.2s ease;
        }
        
        .page-info {
          background: var(--vscode-tab-activeBackground);
          border-radius: 4px;
          padding: 4px 8px;
          font-weight: 500;
        }
      </style>
    </head>
    <body class="p-6">
      <div class="max-w-full mx-auto">
        <h1 class="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🌐 i18n Table Editor
        </h1>
        
        <div class="flex flex-wrap gap-3 mb-6">
          <button onclick="addLanguage()" class="btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2">
            ➕ Add Language
          </button>
          <button onclick="addKey()" class="btn bg-green-500 hover:bg-green-600 text-white px-4 py-2">
            🔑 Add Key
          </button>
          <button onclick="refreshData()" class="btn bg-gray-500 hover:bg-gray-600 text-white px-4 py-2">
            🔄 Refresh
          </button>
        </div>
        
        <div class="mb-6">
          <input 
            id="search" 
            placeholder="🔍 Search keys or values..." 
            class="search-input px-4 py-3 w-full max-w-md text-sm"
          >
        </div>
        
        <div id="columns" class="mb-6 text-sm">
          <div class="font-semibold mb-3">📋 Visible columns (drag to reorder):</div>
          <div class="flex flex-wrap" id="columnCheckboxes"></div>
        </div>
        
        <div class="table-container">
          <div class="overflow-auto" style="max-height: 70vh;">
            <table id="i18nTable">
              <thead id="tableHead"></thead>
              <tbody id="tableBody"></tbody>
            </table>
          </div>
        </div>
        
        <div class="pagination-controls">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex items-center space-x-3">
              <button onclick="prevPage()" class="btn bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 disabled:opacity-50" disabled>
                ⬅️ Previous
              </button>
              <span id="pageInfo" class="page-info text-sm"></span>
              <button onclick="nextPage()" class="btn bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 disabled:opacity-50" disabled>
                Next ➡️
              </button>
            </div>
            <div class="flex items-center space-x-3">
              <label class="text-sm font-medium">Rows per page:</label>
              <select id="pageSize" class="search-input px-3 py-2 text-sm">
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let allKeys = ${JSON.stringify(keys)};
        let allData = ${JSON.stringify(data)};
        let languages = ${JSON.stringify(languages)};
        let columnOrder = ['key', ...languages];
        let visibleColumns = new Set(languages);
        let currentPage = 0;
        let pageSize = 50;
        let sortColumn = 'key';
        let sortDirection = 'asc';
        let filterText = '';

        function addLanguage() { vscode.postMessage({ command: 'addLanguage' }); }
        function addKey() { vscode.postMessage({ command: 'addKey' }); }
        function refreshData() { vscode.postMessage({ command: 'refresh' }); }

        function renderColumns() {
          const checkboxesDiv = document.getElementById('columnCheckboxes');
          checkboxesDiv.innerHTML = '';
          
          languages.forEach(lang => {
            const label = document.createElement('label');
            label.className = 'checkbox-label inline-flex items-center';
            label.draggable = true;
            label.ondragstart = dragStart;
            label.ondragover = dragOver;
            label.ondrop = drop;
            label.dataset.lang = lang;
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = visibleColumns.has(lang);
            cb.className = 'mr-2';
            cb.onchange = () => {
              if (cb.checked) visibleColumns.add(lang);
              else visibleColumns.delete(lang);
              renderTable();
            };
            
            label.appendChild(cb);
            label.appendChild(document.createTextNode(lang));
            checkboxesDiv.appendChild(label);
          });
        }

        function renderTable() {
          const tableHead = document.getElementById('tableHead');
          const tableBody = document.getElementById('tableBody');
          tableHead.innerHTML = '';
          tableBody.innerHTML = '';

          // Header row
          const headerRow = document.createElement('tr');
          columnOrder.forEach(col => {
            if (col === 'key' || visibleColumns.has(col)) {
              const th = document.createElement('th');
              th.innerHTML = \`
                <div class="flex items-center justify-between">
                  <span>\${col === 'key' ? '🔑 Key' : '🌍 ' + col}</span>
                  <div class="flex items-center space-x-2">
                    \${sortColumn === col ? \`<span class="sort-indicator">\${sortDirection === 'asc' ? '⬆️' : '⬇️'}</span>\` : ''}
                    \${col !== 'key' ? \`<button onclick="renameLanguage('\${col}')" class="btn bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1">✏️</button>\` : ''}
                  </div>
                </div>
              \`;
              th.className = 'sortable';
              th.onclick = () => sortByColumn(col);
              th.draggable = true;
              th.ondragstart = dragStartHeader;
              th.ondragover = dragOverHeader;
              th.ondrop = dropHeader;
              th.dataset.col = col;
              headerRow.appendChild(th);
            }
          });
          tableHead.appendChild(headerRow);

          // Filter keys and values
          let filteredKeys = allKeys.filter(key => {
            const keyMatch = key.toLowerCase().includes(filterText.toLowerCase());
            const valueMatch = languages.some(lang => {
              const value = allData[lang][key] || '';
              return value.toLowerCase().includes(filterText.toLowerCase());
            });
            return keyMatch || valueMatch;
          });

          // Sort
          filteredKeys.sort((a, b) => {
            if (sortColumn === 'key') {
              return sortDirection === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
            } else {
              const valA = allData[sortColumn][a] || '';
              const valB = allData[sortColumn][b] || '';
              return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
          });

          // Paging
          const start = currentPage * pageSize;
          const end = start + pageSize;
          const pageKeys = filteredKeys.slice(start, end);

          pageKeys.forEach((key, index) => {
            const tr = document.createElement('tr');
            columnOrder.forEach(col => {
              if (col === 'key' || visibleColumns.has(col)) {
                const td = document.createElement('td');
                if (col === 'key') {
                  td.innerHTML = \`<div class="font-mono text-sm">\${key}</div>\`;
                } else {
                  const value = allData[col][key] || '';
                  td.innerHTML = \`<div>\${value}</div>\`;
                  td.contentEditable = 'true';
                  td.dataset.key = key;
                  td.dataset.lang = col;
                  td.onblur = handleCellBlur;
                  td.oninput = handleCellInput;
                  if (!value) td.classList.add('missing');
                }
                tr.appendChild(td);
              }
            });
            tableBody.appendChild(tr);
          });

          // Page info
          const totalPages = Math.ceil(filteredKeys.length / pageSize);
          document.getElementById('pageInfo').textContent = \`Page \${currentPage + 1} of \${totalPages} (\${filteredKeys.length} items)\`;
          document.querySelector('button[onclick="prevPage()"]').disabled = currentPage === 0;
          document.querySelector('button[onclick="nextPage()"]').disabled = end >= filteredKeys.length;
        }

        function sortByColumn(col) {
          if (sortColumn === col) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            sortColumn = col;
            sortDirection = 'asc';
          }
          renderTable();
        }

        function handleCellInput(e) {
          const td = e.target;
          td.classList.toggle('missing', !td.textContent.trim());
        }

        function handleCellBlur(e) {
          const td = e.target;
          const newValue = td.textContent.trim();
          const oldValue = allData[td.dataset.lang][td.dataset.key] || '';
          if (newValue !== oldValue) {
            vscode.postMessage({ command: 'saveCell', key: td.dataset.key, lang: td.dataset.lang, value: newValue });
          }
          td.classList.toggle('missing', !newValue);
        }

        function renameLanguage(lang) {
          vscode.postMessage({ command: 'renameLanguage', lang: lang });
        }

        function prevPage() {
          if (currentPage > 0) {
            currentPage--;
            renderTable();
          }
        }

        function nextPage() {
          const filteredKeys = allKeys.filter(key => {
            const keyMatch = key.toLowerCase().includes(filterText.toLowerCase());
            const valueMatch = languages.some(lang => {
              const value = allData[lang][key] || '';
              return value.toLowerCase().includes(filterText.toLowerCase());
            });
            return keyMatch || valueMatch;
          });
          
          if ((currentPage + 1) * pageSize < filteredKeys.length) {
            currentPage++;
            renderTable();
          }
        }

        function dragStart(e) {
          e.dataTransfer.setData('text/plain', e.target.dataset.lang);
        }

        function dragOver(e) {
          e.preventDefault();
          e.target.classList.add('drag-over');
        }

        function drop(e) {
          e.preventDefault();
          e.target.classList.remove('drag-over');
          const draggedLang = e.dataTransfer.getData('text/plain');
          const targetLang = e.target.closest('label').dataset.lang;
          if (draggedLang !== targetLang) {
            const indexDragged = languages.indexOf(draggedLang);
            const indexTarget = languages.indexOf(targetLang);
            [languages[indexDragged], languages[indexTarget]] = [languages[indexTarget], languages[indexDragged]];
            columnOrder = ['key', ...languages];
            renderColumns();
            renderTable();
          }
        }

        function dragStartHeader(e) {
          e.dataTransfer.setData('text/plain', e.target.dataset.col);
        }

        function dragOverHeader(e) {
          e.preventDefault();
          e.target.classList.add('drag-over');
        }

        function dropHeader(e) {
          e.preventDefault();
          e.target.classList.remove('drag-over');
          const draggedCol = e.dataTransfer.getData('text/plain');
          const targetCol = e.target.dataset.col;
          if (draggedCol !== targetCol && draggedCol !== 'key' && targetCol !== 'key') {
            const indexDragged = columnOrder.indexOf(draggedCol);
            const indexTarget = columnOrder.indexOf(targetCol);
            [columnOrder[indexDragged], columnOrder[indexTarget]] = [columnOrder[indexTarget], columnOrder[indexDragged]];
            renderTable();
          }
        }

        document.getElementById('search').addEventListener('input', (e) => {
          filterText = e.target.value;
          currentPage = 0;
          renderTable();
        });

        document.getElementById('pageSize').addEventListener('change', (e) => {
          pageSize = parseInt(e.target.value);
          currentPage = 0;
          renderTable();
        });

        // Initialize
        renderColumns();
        renderTable();
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {}