import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { flattenJson } from './jsonUtils';

export function collectData(folderPath: string): { languages: string[], keys: string[], data: Record<string, Record<string, string>> } {
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