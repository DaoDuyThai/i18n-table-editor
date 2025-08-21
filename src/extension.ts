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
      result[newKey] = value; // Chỉ lấy "text": "text"
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Xử lý array: flatten với index
        value.forEach((item, index) => {
          Object.assign(result, flattenJson(item, `${newKey}[${index}]`));
        });
      } else {
        // Object: recursive
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
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const flattened = flattenJson(json);
    data[lang] = flattened;
    missing[lang] = [];
    Object.keys(flattened).forEach(k => allKeys.add(k));
  });

  // Tìm key thiếu
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
  let disposable = vscode.commands.registerCommand('i18nTableEditor.openTable', async () => {
    const folderUri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select i18n Folder' });
    if (!folderUri || folderUri.length === 0) return;

    const folderPath = folderUri[0].fsPath;
    let { languages, keys, data, missing } = collectData(folderPath);

    const panel = vscode.window.createWebviewPanel(
      'i18nTable',
      'i18n Table Editor',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getWebviewContent(languages, keys, data, missing, folderPath);

    panel.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'addLanguage':
          vscode.window.showInputBox({ prompt: 'New Language Code (e.g., fr)' }).then(newLang => {
            if (newLang) {
              const newFile = path.join(folderPath, `${newLang}.json`);
              fs.writeFileSync(newFile, '{}');
              const updated = collectData(folderPath);
              panel.webview.postMessage({ command: 'updateData', ...updated });
            }
          });
          break;
        case 'renameLanguage':
          vscode.window.showInputBox({ prompt: `Rename ${message.lang} to?` }).then(newName => {
            if (newName) {
              const oldFile = path.join(folderPath, `${message.lang}.json`);
              const newFile = path.join(folderPath, `${newName}.json`);
              fs.renameSync(oldFile, newFile);
              const updated = collectData(folderPath);
              panel.webview.postMessage({ command: 'updateData', ...updated });
            }
          });
          break;
        case 'addKey':
          vscode.window.showInputBox({ prompt: 'New Key (e.g., home.new)' }).then(newKey => {
            if (newKey) {
              languages.forEach(lang => {
                const filePath = path.join(folderPath, `${lang}.json`);
                const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const flat = flattenJson(json);
                flat[newKey] = ''; // Thêm key với value rỗng
                fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
              });
              const updated = collectData(folderPath);
              panel.webview.postMessage({ command: 'updateData', ...updated });
            }
          });
          break;
        case 'saveCell':
          const filePath = path.join(folderPath, `${message.lang}.json`);
          const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const flat = flattenJson(json);
          flat[message.key] = message.value;
          fs.writeFileSync(filePath, JSON.stringify(unflattenJson(flat), null, 2));
          const updated = collectData(folderPath);
          panel.webview.postMessage({ command: 'updateData', ...updated });
          break;
      }
    });
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(languages: string[], keys: string[], data: Record<string, Record<string, string>>, missing: Record<string, string[]>, folderPath: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>i18n Table Editor</title>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        td.missing { background-color: #ffdddd; }
        input[type="checkbox"] { margin-right: 5px; }
        #missingReport { margin-top: 20px; }
        button { margin: 5px; }
      </style>
    </head>
    <body>
      <h1>i18n Table Editor</h1>
      <button onclick="addLanguage()">Add Language</button>
      <button onclick="addKey()">Add Key</button>
      <div id="columns">Columns: </div>
      <table id="i18nTable">
        <thead><tr><th>Key</th></tr></thead>
        <tbody></tbody>
      </table>
      <div id="missingReport">
        <h2>Missing Keys Report</h2>
        <ul id="missingList"></ul>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let currentData = ${JSON.stringify({ languages, keys, data, missing })};
        let hiddenColumns = new Set();

        function renderTable() {
          const table = document.getElementById('i18nTable');
          const thead = table.querySelector('thead tr');
          const tbody = table.querySelector('tbody');
          thead.innerHTML = '<th>Key</th>';
          currentData.languages.forEach(lang => {
            if (!hiddenColumns.has(lang)) {
              const th = document.createElement('th');
              th.textContent = lang;
              const renameBtn = document.createElement('button');
              renameBtn.textContent = 'Rename';
              renameBtn.onclick = () => vscode.postMessage({ command: 'renameLanguage', lang });
              th.appendChild(renameBtn);
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

          // Columns control
          const columnsDiv = document.getElementById('columns');
          columnsDiv.innerHTML = 'Columns: ';
          currentData.languages.forEach(lang => {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !hiddenColumns.has(lang);
            cb.onchange = () => {
              if (cb.checked) hiddenColumns.delete(lang);
              else hiddenColumns.add(lang);
              renderTable();
            };
            columnsDiv.appendChild(cb);
            columnsDiv.appendChild(document.createTextNode(lang + ' '));
          });

          // Missing keys report
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