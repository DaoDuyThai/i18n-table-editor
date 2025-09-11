import { ExtensionConfig } from './types';

export function getWebviewContent(languages: string[], keys: string[], data: Record<string, Record<string, string>>, config: ExtensionConfig) {
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
      border-collapse: none;
      border-spacing: 0;
      table-layout: fixed;
    }
    
    th, td {
      border: 2px solid var(--vscode-editorWidget-border);
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
      top: -1px;
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
    
    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
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
      background-color: rgba(128, 128, 128, 0.05);
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
    
    .progress-container {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .progress-bar {
      background-color: rgba(128, 128, 128, 0.2);
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-fill {
      background: linear-gradient(90deg, #10b981, #34d399);
      height: 100%;
      transition: width 0.5s ease;
      border-radius: 4px;
    }
    
    .context-menu {
      position: fixed;
      background: var(--vscode-menu-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-menu-border, var(--vscode-editorWidget-border));
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 150px;
    }
    
    .context-menu-item {
      padding: 8px 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-bottom: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-editorWidget-border));
      font-size: 13px;
    }
    
    .context-menu-item:last-child {
      border-bottom: none;
    }
    
    .context-menu-item:hover {
      background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    }
    
    .context-menu-item.danger:hover {
      background: #dc2626;
      color: white;
    }
    
    .keyboard-shortcuts {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 6px;
      padding: 8px;
      font-size: 11px;
      opacity: 0.7;
      max-width: 200px;
    }

    .key-cell {
      cursor: pointer;
      position: relative;
    }

    .settings-panel {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .template-grid-item {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 4px;
      padding: 8px;
      color: var(--vscode-editor-foreground);
    }

    .template-selected {
      background: var(--vscode-button-background, #0e639c) !important;
      border-color: var(--vscode-button-background, #0e639c) !important;
      box-shadow: 0 0 0 2px var(--vscode-focusBorder, #007acc) !important;
    }

    .template-selected .font-semibold {
      color: var(--vscode-button-foreground, white) !important;
    }

    .template-selected code {
      color: var(--vscode-button-foreground, white) !important;
      opacity: 0.9;
    }

    .hidden {
      display: none !important;
    }

    details summary {
      cursor: pointer;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-editorWidget-border);
    }

    details summary:hover {
      color: var(--vscode-list-hoverForeground);
    }
  </style>
</head>
<body class="p-6">
  <div class="max-w-full mx-auto">
    <h1 class="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
      🌐 Locale Language Json Table Editor
    </h1>
    
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
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let allKeys = ${JSON.stringify(keys)};
    let allData = ${JSON.stringify(data)};
    let languages = ${JSON.stringify(languages)};
    let config = ${JSON.stringify(config)};
    let columnOrder = ['key', ...languages];
    let visibleColumns = new Set(languages);
    let currentPage = 0;
    let pageSize = 50;
    let sortColumn = 'key';
    let sortDirection = 'asc';
    let filterText = '';
    let filterType = 'all';
    let filterLanguage = '';
    let contextMenu = null;

    function addLanguage() { vscode.postMessage({ command: 'addLanguage' }); }
    function addKey() { vscode.postMessage({ command: 'addKey' }); }
    function refreshData() { vscode.postMessage({ command: 'refresh' }); }
    function openSettings() { vscode.postMessage({ command: 'openSettings' }); }

    function updateTemplate(newTemplate) {
      config.copyTemplate = newTemplate;
      vscode.postMessage({ command: 'updateConfig', key: 'copyTemplate', value: newTemplate });
    }

    function updateCopyMode(newMode) {
      config.defaultCopyMode = newMode;
      vscode.postMessage({ command: 'updateConfig', key: 'defaultCopyMode', value: newMode });
      
      // Show/hide template sections based on mode
      const templateInputSection = document.getElementById('templateInputSection');
      const quickTemplatesSection = document.getElementById('quickTemplatesSection');
      
      if (newMode === 'plain') {
        templateInputSection.classList.add('hidden');
        quickTemplatesSection.classList.add('hidden');
      } else {
        templateInputSection.classList.remove('hidden');
        quickTemplatesSection.classList.remove('hidden');
      }
    }

    function setTemplate(template) {
      updateTemplate(template);
    }

    function setTemplateFromData(element) {
      const template = element.getAttribute('data-template');
      
      // Remove previous selection styling
      document.querySelectorAll('.template-grid-item').forEach(item => {
        item.classList.remove('template-selected');
        item.classList.add('hover:bg-gray-600');
        
        // Reset colors
        const title = item.querySelector('.font-semibold');
        const code = item.querySelector('code');
        const selectedIndicator = item.querySelector('.text-blue-200.mt-1');
        
        if (title) title.className = 'font-semibold text-blue-400';
        if (code) code.className = 'text-xs text-green-400 break-all';
        if (selectedIndicator) selectedIndicator.remove();
      });
      
      // Add selection to current item
      element.classList.remove('hover:bg-gray-600');
      element.classList.add('template-selected');
      
      // Update colors for selected item
      const title = element.querySelector('.font-semibold');
      const code = element.querySelector('code');
      
      if (title) title.className = 'font-semibold text-blue-200';
      if (code) code.className = 'text-xs text-green-200 break-all';
      
      // Add selected indicator
      const selectedIndicator = document.createElement('div');
      selectedIndicator.className = 'text-xs text-blue-200 mt-1 font-medium';
      selectedIndicator.textContent = '✓ Currently Selected';
      element.appendChild(selectedIndicator);
      
      setTemplate(template);
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
        // Text search
        const keyMatch = key.toLowerCase().includes(filterText.toLowerCase());
        const valueMatch = languages.some(lang => {
          const value = allData[lang] && allData[lang][key] ? allData[lang][key] : '';
          return value.toLowerCase().includes(filterText.toLowerCase());
        });
        
        if (!keyMatch && !valueMatch) return false;
        
        // Filter type
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
          th.draggable = false;
          th.ondragstart = dragStartHeader;
          th.ondragover = dragOverHeader;
          th.ondrop = dropHeader;
          th.dataset.col = col;
          headerRow.appendChild(th);
        }
      });
      tableHead.appendChild(headerRow);

      // Filter and sort keys
      let filteredKeys = filterKeys();

      // Sort
      filteredKeys.sort((a, b) => {
        if (sortColumn === 'key') {
          return sortDirection === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
        } else {
          const valA = allData[sortColumn] && allData[sortColumn][a] ? allData[sortColumn][a] : '';
          const valB = allData[sortColumn] && allData[sortColumn][b] ? allData[sortColumn][b] : '';
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(a);
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
      
      updateProgress();
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
      const oldValue = allData[td.dataset.lang] && allData[td.dataset.lang][td.dataset.key] ? allData[td.dataset.lang][td.dataset.key] : '';
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
      const filteredKeys = filterKeys();
      if ((currentPage + 1) * pageSize < filteredKeys.length) {
        currentPage++;
        renderTable();
      }
    }

    // Context Menu Functions
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

    // Drag and Drop Functions
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

    // Event Listeners
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

    // Keyboard Shortcuts
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

    // Initialize
    populateLanguageFilter();
    renderColumns();
    renderTable();
  </script>
</body>
</html>
  `;
}