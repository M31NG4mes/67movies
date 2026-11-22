import * as vm from 'vm';
import { createLampaEnvironment, EmulatedLampaContext } from './lampa-mock';
import { SourceSearchQuery, VideoStream } from '@cinemaflow/types';

export interface LampaPluginExecutionOptions {
  pluginId: string;
  pluginName: string;
  scriptContent: string;
  timeoutMs?: number;
  customFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export class LampaPluginSandbox {
  private context: EmulatedLampaContext;
  private lampaEnv: ReturnType<typeof createLampaEnvironment>;
  private vmContext: vm.Context;
  private isInitialized = false;

  constructor(private options: LampaPluginExecutionOptions) {
    this.context = {
      discoveredStreams: [],
      storageMap: new Map(),
      eventListeners: new Map(),
    };

    const fetchImpl = options.customFetch || globalThis.fetch;
    this.lampaEnv = createLampaEnvironment(
      options.pluginId,
      options.pluginName,
      this.context,
      fetchImpl
    );

    // Create sandbox scope
    const sandboxScope = {
      console: {
        log: (...args: any[]) => console.log(`[Plugin:${options.pluginName}]`, ...args),
        warn: (...args: any[]) => console.warn(`[Plugin:${options.pluginName}]`, ...args),
        error: (...args: any[]) => console.error(`[Plugin:${options.pluginName}]`, ...args),
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Lampa: this.lampaEnv,
      window: {
        Lampa: this.lampaEnv,
        location: { protocol: 'https:', host: 'cinemaflow.local' },
      },
      document: {
        createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
      },
      URL,
      URLSearchParams,
      encodeURIComponent,
      decodeURIComponent,
      btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
      atob: (b64: string) => Buffer.from(b64, 'base64').toString('binary'),
    };

    this.vmContext = vm.createContext(sandboxScope);
  }

  /**
   * Initializes the plugin inside the sandbox
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const script = new vm.Script(this.options.scriptContent, {
        filename: `${this.options.pluginId}.js`,
      });

      script.runInContext(this.vmContext, {
        timeout: this.options.timeoutMs || 5000,
      });

      this.isInitialized = true;
    } catch (err: any) {
      throw new Error(`Failed to initialize Lampa plugin [${this.options.pluginName}]: ${err.message}`);
    }
  }

  /**
   * Executes a search on the plugin for streams matching the query
   */
  public async searchStreams(query: SourceSearchQuery): Promise<VideoStream[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Reset streams discovered in this run
    this.context.discoveredStreams = [];

    // Trigger Lampa activity search listeners if any were registered by plugin
    this.lampaEnv.Listener.send('activity', {
      type: 'search',
      query: query.title,
      movie: {
        title: query.title,
        original_title: query.originalTitle,
        year: query.year,
        imdb_id: query.imdbId,
        id: query.tmdbId,
        kp_id: query.kinopoiskId,
      },
      season: query.season,
      episode: query.episode,
    });

    // Wait a brief tick for async hooks to resolve
    await new Promise((resolve) => setTimeout(resolve, 300));

    return [...this.context.discoveredStreams];
  }
}
