//config.ts

import * as vscode from 'vscode';
import { ExtensionConfig } from './types';

export function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('localeLanguagesJsonTableEditor');
  return {
    copyTemplate: config.get('copyTemplate', "t('{key}')"),
    defaultCopyMode: config.get('defaultCopyMode', 'plain'),
    templates: config.get('templates', {
      'react-i18next': "t('{key}')",
      'react-i18next-trans': "'>",
      'vue-i18n': "$t('{key}')",
      'angular-i18n': "{{ '{key}' | translate }}",
      'flutter-intl': "AppLocalizations.of(context)!.{key}",
      'custom': config.get('copyTemplate', "t('{key}')")
    })
  };
}