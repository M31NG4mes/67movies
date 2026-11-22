export type PluginType = 'native' | 'lampa' | 'custom_scraper';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  type: PluginType;
  scriptUrl?: string; // For remote Lampa plugins
  scriptContent?: string;
  isEnabled: boolean;
  priority: number;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LampaPluginMeta {
  url: string;
  name?: string;
  description?: string;
  version?: string;
  status: 'active' | 'error' | 'disabled';
  lastError?: string;
}
