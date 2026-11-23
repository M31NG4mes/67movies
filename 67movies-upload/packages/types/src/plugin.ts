export type PluginType = 'native' | 'custom_scraper';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  type: PluginType;
  scriptUrl?: string;
  scriptContent?: string;
  isEnabled: boolean;
  priority: number;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
