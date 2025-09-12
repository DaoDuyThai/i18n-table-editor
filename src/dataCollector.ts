// dataCollector.ts
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { flattenJson } from './jsonUtils';

export function collectDataFlat(folderPath: string): { languages: string[], keys: string[], data: Record<string, Record<string, string>> } {
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

export function collectDataNested(folderPath: string, selectedFile: string): { languages: string[], keys: string[], data: Record<string, Record<string, string>> } {
  // Get all language folders
  const languageFolders = fs.readdirSync(folderPath).filter(item => {
    const fullPath = path.join(folderPath, item);
    return fs.statSync(fullPath).isDirectory();
  });

  const allKeys = new Set<string>();
  const data: Record<string, Record<string, string>> = {};
  const validLanguages: string[] = [];

  languageFolders.forEach(lang => {
    const filePath = path.join(folderPath, lang, selectedFile);
    
    // Check if the selected file exists in this language folder
    if (!fs.existsSync(filePath)) {
      return; // Skip this language if file doesn't exist
    }

    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const flattened = flattenJson(json);
      data[lang] = flattened;
      Object.keys(flattened).forEach(k => allKeys.add(k));
      validLanguages.push(lang);
    } catch (e) {
      const error = e as Error;
      vscode.window.showErrorMessage(`Error reading ${lang}/${selectedFile}: ${error.message}`);
    }
  });

  return { 
    languages: validLanguages.sort(), 
    keys: Array.from(allKeys).sort(), 
    data 
  };
}

// Keep the original function for backward compatibility
export function collectData(folderPath: string): { languages: string[], keys: string[], data: Record<string, Record<string, string>> } {
  return collectDataFlat(folderPath);
}