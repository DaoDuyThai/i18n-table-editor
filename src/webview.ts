import { ExtensionConfig } from './types';
import * as vscode from 'vscode';
import * as path from 'path';

export function getWebviewContent(
  languages: string[], 
  keys: string[], 
  data: Record<string, Record<string, string>>, 
  config: ExtensionConfig,
  structureType?: 'flat' | 'nested',
  selectedFile?: string,
  webview?: vscode.Webview,
  extensionUri?: vscode.Uri
) {
  // Get CSS file URI
  let cssUri = '';
  if (webview && extensionUri) {
    const cssPath = path.join('src', 'webview.css');
    cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, cssPath)).toString();
  }

  return `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Locale Language Json Table Editor</title>
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
  ${cssUri ? `<link rel="stylesheet" href="${cssUri}">` : ''}
</head>
<body class="p-6">
  <div class="max-w-full mx-auto">
    <h1 class="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
      🌐 Locale Language Json Table Editor
    </h1>
    
    <!-- Workspace Info Panel -->
    <div id="workspaceInfo" class="workspace-info">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">📁 Current Workspace</h2>
        <div class="flex gap-2">
          <button onclick="changeFolder()" class="btn bg-blue-500 hover:bg-blue-600 text-white btn-sm">
            📁 Change Folder
          </button>
          <button id="changeFileBtn" onclick="changeFile()" class="btn bg-purple-500 hover:bg-purple-600 text-white btn-sm hidden">
            📄 Change File
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-3 text-sm">
        <div class="flex items-center gap-2">
          <span class="font-medium">Structure:</span>
          <span id="structureType" class="info-badge">Not Set</span>
        </div>
        <div id="selectedFileInfo" class="flex items-center gap-2 hidden">
          <span class="font-medium">Editing File:</span>
          <span id="selectedFile" class="info-badge">Not Set</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-medium">Languages:</span>
          <span id="languageCount" class="info-badge">0</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-medium">Keys:</span>
          <span id="keyCount" class="info-badge">0</span>
        </div>
      </div>
    </div>
    
    <!-- Settings Panel -->
    <details class="settings-panel">
      <summary>⚙️ Key Copy Behavior Settings</summary>
      <div class="pt-4">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold hidden">⚙️ Key Copy Behavior Settings</h2>
          <button onclick="openSettings()" class="btn bg-gray-500 hover:bg-gray-600 text-white btn-sm">
            Open VS Code Settings
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Default Copy Mode:</label>
            <select id="copyModeSelect" class="search-input px-3 py-2 w-full" onchange="updateCopyMode(this.value)">
              <option value="plain" ${config.defaultCopyMode === 'plain' ? 'selected' : ''}>Plain Key Mode</option>
              <option value="template" ${config.defaultCopyMode === 'template' ? 'selected' : ''}>Template Mode</option>
            </select>
            <div class="text-xs text-gray-400 mt-1">
              Default behavior when double-clicking keys cell
            </div>
          </div>

          <div id="templateInputSection" class="${config.defaultCopyMode === 'plain' ? 'hidden' : ''}">
            <label class="block text-sm font-medium mb-2">Selected Template:</label>
            <div class="text-xs text-gray-400 mt-1">Click on a template below to select it. Use {key} as placeholder for the translation key</div>
          </div>
        </div>

        <div id="quickTemplatesSection" class="mt-4 ${config.defaultCopyMode === 'plain' ? 'hidden' : ''}">
          <label class="block text-sm font-medium mb-2">Quick Templates:</label>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            ${Object.entries(config.templates).map(([name, template]) => {
    const isSelected = template === config.copyTemplate;
    return `<div class="template-grid-item cursor-pointer transition-colors ${isSelected ? 'template-selected' : 'hover:bg-gray-600'}" 
                  data-template="${template.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" 
                  data-template-name="${name}"
                  onclick="setTemplateFromData(this)">
                <div class="font-semibold ${isSelected ? 'text-blue-200' : 'text-blue-400'}">${name}:</div>
                <code class="text-xs ${isSelected ? 'text-green-200' : 'text-green-400'} break-all">${template.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
                ${isSelected ? '<div class="text-xs text-blue-200 mt-1 font-medium">✓ Currently Selected</div>' : ''}
              </div>`;
  }).join('')}
          </div>
        </div>
      </div>
    </details>
    
    <!-- Progress Bar -->
    <div id="progressContainer" class="progress-container">
      <div class="flex justify-between text-sm mb-2">
        <span class="font-semibold">📊 Translation Progress</span>
        <span id="progressText">0/0 (0%)</span>
      </div>
      <div class="progress-bar">
        <div id="progressFill" class="progress-fill" style="width: 0%"></div>
      </div>
    </div>
    
    <!-- Action Buttons -->
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
    
    <!-- Search and Filters -->
    <div class="search-filters flex gap-3 mb-6">
      <input 
        id="search" 
        placeholder="🔍 Search keys or values..." 
        class="search-input px-4 py-3 flex-1"
      >
      <select id="filterType" class="search-input px-3 py-3">
        <option value="all">All Items</option>
        <option value="missing">Missing Values</option>
        <option value="empty">Empty Keys</option>
        <option value="duplicates">Duplicate Values</option>
      </select>
      <select id="filterLanguage" class="search-input px-3 py-3">
        <option value="">All Languages</option>
      </select>
    </div>
    
    <!-- Column Controls -->
    <div id="columns" class="mb-6 text-sm">
      <div class="font-semibold mb-3">📋 Visible columns (drag to reorder):</div>
      <div class="flex flex-wrap" id="columnCheckboxes"></div>
    </div>
    
    <!-- Table -->
    <div class="table-container">
      <div class="overflow-auto" style="max-height: 70vh;">
        <table id="localeTable">
          <thead style="border-" id="tableHead"></thead>
          <tbody id="tableBody"></tbody>
        </table>
      </div>
    </div>
    
    <!-- Pagination -->
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
    
    <!-- Keyboard Shortcuts Info -->
    <div class="keyboard-shortcuts">
      <div class="font-semibold mb-1">⌨️ Shortcuts:</div>
      <div>Ctrl+F: Search</div>
      <div>Ctrl+N: Add Key</div>
      <div>Ctrl+L: Add Language</div>
      <div>Ctrl+S: Refresh</div>
      <div>Double-click key cell: Copy</div>
      <div>Shift+Double-click: Copy with template</div>
      <div>Enter in cell: Save</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let allKeys = ${JSON.stringify(keys)};
    let allData = ${JSON.stringify(data)};
    let languages = ${JSON.stringify(languages)};
    let config = ${JSON.stringify(config)};
    let structureType = '${structureType || 'flat'}';
    let selectedFile = '${selectedFile || ''}';
    let columnOrder = ['key', ...languages];
    let visibleColumns = new Set(languages);
    let currentPage = 0;
    let pageSize = 50;
    let sortColumn = null;
    let sortDirection = null;
    let filterText = '';
    let filterType = 'all';
    let filterLanguage = '';
    let contextMenu = null;

    // Handle data updates from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'updateData') {
        allKeys = message.keys;
        allData = message.data;
        languages = message.languages;
        config = message.config;
        structureType = message.structureType;
        selectedFile = message.selectedFile;
        columnOrder = ['key', ...languages];
        visibleColumns = new Set(languages);
        populateLanguageFilter();
        renderColumns();
        updateSettingsUI();
        updateWorkspaceInfo();
        renderTable();
      }
    });

    function changeFolder() { vscode.postMessage({ command: 'changeFolder' }); }
    function changeFile() { vscode.postMessage({ command: 'changeFile' }); }
    function addLanguage() { vscode.postMessage({ command: 'addLanguage' }); }
    function addKey() { vscode.postMessage({ command: 'addKey' }); }
    function refreshData() { vscode.postMessage({ command: 'refresh' }); }
    function openSettings() { vscode.postMessage({ command: 'openSettings' }); }

    function updateWorkspaceInfo() {
      document.getElementById('structureType').textContent = structureType === 'flat' ? 'Flat Structure' : 'Nested Structure';
      document.getElementById('languageCount').textContent = languages.length;
      document.getElementById('keyCount').textContent = allKeys.length;
      
      if (structureType === 'nested') {
        document.getElementById('selectedFileInfo').classList.remove('hidden');
        document.getElementById('changeFileBtn').classList.remove('hidden');
        document.getElementById('selectedFile').textContent = selectedFile || 'Not Set';
      } else {
        document.getElementById('selectedFileInfo').classList.add('hidden');
        document.getElementById('changeFileBtn').classList.add('hidden');
      }
    }

    function updateTemplate(newTemplate) {
      config.copyTemplate = newTemplate;
      vscode.postMessage({ command: 'updateConfig', key: 'copyTemplate', value: newTemplate });
    }

    function updateCopyMode(newMode) {
      config.defaultCopyMode = newMode;
      vscode.postMessage({ command: 'updateConfig', key: 'defaultCopyMode', value: newMode });
      const isTemplate = newMode === 'template';
      document.getElementById('templateInputSection').classList.toggle('hidden', !isTemplate);
      document.getElementById('quickTemplatesSection').classList.toggle('hidden', !isTemplate);
      updateSettingsUI();
    }

    function setTemplateFromData(element) {
      const template = element.getAttribute('data-template');
      document.querySelectorAll('.template-grid-item').forEach(item => {
        item.classList.remove('template-selected');
        item.classList.add('hover:bg-gray-600');
        const title = item.querySelector('.font-semibold');
        const code = item.querySelector('code');
        const selectedIndicator = item.querySelector('.text-xs.text-blue-200.mt-1');
        if (title) title.className = 'font-semibold text-blue-400';
        if (code) code.className = 'text-xs text-green-400 break-all';
        if (selectedIndicator) selectedIndicator.remove();
      });
      element.classList.remove('hover:bg-gray-600');
      element.classList.add('template-selected');
      const title = element.querySelector('.font-semibold');
      const code = element.querySelector('code');
      if (title) title.className = 'font-semibold text-blue-200';
      if (code) code.className = 'text-xs text-green-200 break-all';
      const selectedIndicator = document.createElement('div');
      selectedIndicator.className = 'text-xs text-blue-200 mt-1 font-medium';
      selectedIndicator.textContent = '✓ Currently Selected';
      element.appendChild(selectedIndicator);
      updateTemplate(template);
    }

    function updateSettingsUI() {
      document.getElementById('copyModeSelect').value = config.defaultCopyMode;
      const isTemplate = config.defaultCopyMode === 'template';
      document.getElementById('templateInputSection').classList.toggle('hidden', !isTemplate);
      document.getElementById('quickTemplatesSection').classList.toggle('hidden', !isTemplate);
      document.querySelectorAll('.template-grid-item').forEach(item => {
        const template = item.getAttribute('data-template');
        const isSelected = template === config.copyTemplate;
        item.classList.toggle('template-selected', isSelected);
        item.classList.toggle('hover:bg-gray-600', !isSelected);
        const title = item.querySelector('.font-semibold');
        const code = item.querySelector('code');
        let selectedIndicator = item.querySelector('.text-xs.text-blue-200.mt-1');
        if (isSelected) {
          if (title) title.className = 'font-semibold text-blue-200';
          if (code) code.className = 'text-xs text-green-200 break-all';
          if (!selectedIndicator) {
            selectedIndicator = document.createElement('div');
            selectedIndicator.className = 'text-xs text-blue-200 mt-1 font-medium';
            selectedIndicator.textContent = '✓ Currently Selected';
            item.appendChild(selectedIndicator);
          }
        } else {
          if (title) title.className = 'font-semibold text-blue-400';
          if (code) code.className = 'text-xs text-green-400 break-all';
          if (selectedIndicator) selectedIndicator.remove();
        }
      });
    }

    function copyKey(key, useTemplate = false) {
      vscode.postMessage({ 
        command: 'copyKey', 
        key: key,
        useTemplate: useTemplate || config.defaultCopyMode === 'template'
      });
    }

    function calculateProgress() {
      let total = 0, completed = 0;
      allKeys.forEach(key => {
        languages.forEach(lang => {
          total++;
          if (allData[lang] && allData[lang][key] && allData[lang][key].trim()) {
            completed++;
          }
        });
      });
      return { completed, total, percentage: total > 0 ? Math.round((completed/total) * 100) : 0 };
    }

    function updateProgress() {
      const progress = calculateProgress();
      document.getElementById('progressText').textContent = \`\${progress.completed}/\${progress.total} (\${progress.percentage}%)\`;
      document.getElementById('progressFill').style.width = \`\${progress.percentage}%\`;
    }

    function populateLanguageFilter() {
      const select = document.getElementById('filterLanguage');
      select.innerHTML = '<option value="">All Languages</option>';
      languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang;
        select.appendChild(option);
      });
    }

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

    function filterKeys() {
      return allKeys.filter(key => {
        const keyMatch = key.toLowerCase().includes(filterText.toLowerCase());
        const valueMatch = languages.some(lang => {
          const value = allData[lang] && allData[lang][key] ? allData[lang][key] : '';
          return value.toLowerCase().includes(filterText.toLowerCase());
        });
        if (!keyMatch && !valueMatch) return false;
        switch(filterType) {
          case 'missing':
            return languages.some(lang => !allData[lang] || !allData[lang][key] || !allData[lang][key].trim());
          case 'empty':
            return languages.every(lang => !allData[lang] || !allData[lang][key] || !allData[lang][key].trim());
          case 'duplicates':
            const values = languages.map(lang => allData[lang] && allData[lang][key] ? allData[lang][key] : '').filter(v => v.trim());
            return new Set(values).size < values.length;
          default:
            return true;
        }
      });
    }

    function renderTable() {
      const tableHead = document.getElementById('tableHead');
      const tableBody = document.getElementById('tableBody');
      tableHead.innerHTML = '';
      tableBody.innerHTML = '';

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
          th.draggable = false;
          th.ondragstart = dragStartHeader;
          th.ondragover = dragOverHeader;
          th.ondrop = dropHeader;
          th.dataset.col = col;
          headerRow.appendChild(th);
        }
      });
      tableHead.appendChild(headerRow);

      let filteredKeys = filterKeys();
      if (sortColumn) {
        filteredKeys.sort((a, b) => {
          if (sortColumn === 'key') {
            return sortDirection === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
          } else {
            const valA = allData[sortColumn] && allData[sortColumn][a] ? allData[sortColumn][a] : '';
            const valB = allData[sortColumn] && allData[sortColumn][b] ? allData[sortColumn][b] : '';
            return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
        });
      }

      const start = currentPage * pageSize;
      const end = start + pageSize;
      const pageKeys = filteredKeys.slice(start, end);

      pageKeys.forEach((key, index) => {
        const tr = document.createElement('tr');
        columnOrder.forEach(col => {
          if (col === 'key' || visibleColumns.has(col)) {
            const td = document.createElement('td');
            if (col === 'key') {
              td.innerHTML = \`<div class="font-mono text-sm key-cell">\${key}</div>\`;
              td.className = 'key-cell';
              td.oncontextmenu = (e) => showContextMenu(e, key);
              td.ondblclick = (e) => {
                e.preventDefault();
                copyKey(key, e.shiftKey);
              };
            } else {
              const value = allData[col] && allData[col][key] ? allData[col][key] : '';
              td.innerHTML = \`<div>\${value}</div>\`;
              td.contentEditable = 'true';
              td.dataset.key = key;
              td.dataset.lang = col;
              td.onblur = handleCellBlur;
              td.oninput = handleCellInput;
              td.onkeydown = handleCellKeydown;
              if (!value) td.classList.add('missing');
            }
            tr.appendChild(td);
          }
        });
        tableBody.appendChild(tr);
      });

      const totalPages = Math.ceil(filteredKeys.length / pageSize);
      document.getElementById('pageInfo').textContent = \`Page \${currentPage + 1} of \${totalPages} (\${filteredKeys.length} items)\`;
      document.querySelector('button[onclick="prevPage()"]').disabled = currentPage === 0;
      document.querySelector('button[onclick="nextPage()"]').disabled = end >= filteredKeys.length;
      updateProgress();
    }

    function sortByColumn(col) {
      if (sortColumn === col) {
        if (sortDirection === 'asc') {
          sortDirection = 'desc';
        } else if (sortDirection === 'desc') {
          sortColumn = null;
          sortDirection = null;
        } else {
          sortDirection = 'asc';
        }
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
      const oldValue = allData[td.dataset.lang] && allData[td.dataset.lang][td.dataset.key] ? allData[td.dataset.lang][td.dataset.key] : '';
      if (newValue !== oldValue) {
        vscode.postMessage({ command: 'saveCell', key: td.dataset.key, lang: td.dataset.lang, value: newValue });
      }
      td.classList.toggle('missing', !newValue);
    }

    function handleCellKeydown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCellBlur(e);
        e.target.blur();
      }
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
      const filteredKeys = filterKeys();
      if ((currentPage + 1) * pageSize < filteredKeys.length) {
        currentPage++;
        renderTable();
      }
    }

    function showContextMenu(e, key) {
      e.preventDefault();
      if (contextMenu) contextMenu.remove();
      contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';
      contextMenu.innerHTML = \`
        <div class="context-menu-item" onclick="copyKey('\${key}', false)">
          📋 Copy Plain Key
        </div>
        <div class="context-menu-item" onclick="copyKey('\${key}', true)">
          📋 Copy with Template
        </div>
        <div class="context-menu-item danger" onclick="deleteKey('\${key}')">
          🗑️ Delete Key
        </div>
      \`;
      contextMenu.style.left = (e.clientX + 5) + 'px';
      contextMenu.style.top = (e.clientY + 5) + 'px';
      document.body.appendChild(contextMenu);
      setTimeout(() => {
        document.addEventListener('click', closeContextMenu);
      }, 100);
    }

    function closeContextMenu() {
      if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
      }
      document.removeEventListener('click', closeContextMenu);
    }

    function deleteKey(key) {
      if (confirm(\`Are you sure you want to delete key "\${key}"?\`)) {
        vscode.postMessage({ command: 'deleteKey', key: key });
      }
      closeContextMenu();
    }

    function duplicateKey(key) {
      const newKey = prompt(\`New key name (duplicating "\${key}"):\`, key + '_copy');
      if (newKey && newKey !== key) {
        vscode.postMessage({ command: 'duplicateKey', originalKey: key, newKey: newKey });
      }
      closeContextMenu();
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

    document.getElementById('filterType').addEventListener('change', (e) => {
      filterType = e.target.value;
      currentPage = 0;
      renderTable();
    });

    document.getElementById('filterLanguage').addEventListener('change', (e) => {
      filterLanguage = e.target.value;
      currentPage = 0;
      renderTable();
    });

    document.getElementById('pageSize').addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value);
      currentPage = 0;
      renderTable();
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'f':
            e.preventDefault();
            document.getElementById('search').focus();
            break;
          case 's':
            e.preventDefault();
            vscode.postMessage({command: 'refresh'});
            break;
          case 'n':
            e.preventDefault();
            addKey();
            break;
          case 'l':
            e.preventDefault();
            addLanguage();
            break;
        }
      }
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    });

    populateLanguageFilter();
    renderColumns();
    updateSettingsUI();
    updateWorkspaceInfo();
    renderTable();
  </script>
</body>
</html>
  `;
}