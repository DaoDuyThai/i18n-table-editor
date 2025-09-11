
export interface ExtensionConfig {
  copyTemplate: string;
  defaultCopyMode: 'plain' | 'template';
  templates: Record<string, string>;
}