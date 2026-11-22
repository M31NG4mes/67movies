import { StreamNormalizer } from './normalizer';
import { VideoStream } from '@cinemaflow/types';

export interface LampaNetworkRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: any;
  dataType?: string;
}

export interface EmulatedLampaContext {
  discoveredStreams: VideoStream[];
  storageMap: Map<string, any>;
  eventListeners: Map<string, Array<(...args: any[]) => void>>;
}

/**
 * Creates a mock Lampa runtime environment for plugin execution
 */
export function createLampaEnvironment(
  pluginId: string,
  pluginName: string,
  context: EmulatedLampaContext,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>
) {
  const Lampa = {
    Manifest: {
      version: '1.9.0',
      app_version: 190,
      platform: 'browser',
    },

    Platform: {
      is: (name: string) => name === 'browser' || name === 'cors',
      type: 'browser',
      desktop: true,
      tv: false,
    },

    Storage: {
      get: (key: string, defaultValue: any) => {
        return context.storageMap.has(key) ? context.storageMap.get(key) : defaultValue;
      },
      set: (key: string, value: any) => {
        context.storageMap.set(key, value);
      },
      field: (key: string) => {
        return context.storageMap.get(key);
      },
      listener: {
        follow: (event: string, callback: (...args: any[]) => void) => {
          // No-op for headless run
        },
      },
    },

    Listener: {
      follow: (event: string, callback: (...args: any[]) => void) => {
        if (!context.eventListeners.has(event)) {
          context.eventListeners.set(event, []);
        }
        context.eventListeners.get(event)!.push(callback);
      },
      send: (event: string, data: any) => {
        const listeners = context.eventListeners.get(event) || [];
        for (const cb of listeners) {
          try {
            cb(data);
          } catch (e) {
            console.error(`[Lampa Listener Error] ${event}:`, e);
          }
        }
      },
    },

    Network: {
      silent: async (
        url: string,
        onSuccess: (response: any) => void,
        onError?: (error: any) => void,
        postData?: any,
        options: Record<string, any> = {}
      ) => {
        try {
          const fetchOptions: RequestInit = {
            method: postData ? 'POST' : 'GET',
            headers: options.headers || {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
          };
          if (postData) {
            fetchOptions.body = typeof postData === 'string' ? postData : JSON.stringify(postData);
          }

          const res = await fetchFn(url, fetchOptions);
          let data: any;
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await res.json();
          } else {
            data = await res.text();
          }

          if (onSuccess) onSuccess(data);
          return data;
        } catch (err) {
          if (onError) onError(err);
          else console.error(`[Lampa.Network.silent error]:`, err);
        }
      },

      native: async (
        url: string,
        onSuccess: (response: any) => void,
        onError?: (error: any) => void,
        postData?: any,
        options?: any
      ) => {
        return Lampa.Network.silent(url, onSuccess, onError, postData, options);
      },
    },

    Arrays: {
      isArray: (v: any) => Array.isArray(v),
      clone: (obj: any) => JSON.parse(JSON.stringify(obj)),
      remove: (arr: any[], elem: any) => {
        const idx = arr.indexOf(elem);
        if (idx !== -1) arr.splice(idx, 1);
      },
    },

    Utils: {
      bytesToSize: (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`,
      clearFileName: (name: string) => name.replace(/[^\w\sа-яА-ЯёЁ.-]/gi, ''),
      strToTime: (str: string) => 0,
      protocol: () => 'https:',
    },

    Component: {
      add: (name: string, component: any) => {
        // Component registration mock
      },
    },

    // Custom CinemaFlow bridge helper for plugins that emit streams
    CinemaFlowBridge: {
      emitStreams: (streams: VideoStream[]) => {
        context.discoveredStreams.push(...streams);
      },
      emitRawString: (raw: string, meta: any) => {
        const parsed = StreamNormalizer.parseMultiQualityString(raw, {
          providerId: pluginId,
          providerName: pluginName,
          title: meta.title || 'Video',
          voiceActing: meta.voiceActing,
          season: meta.season,
          episode: meta.episode,
          headers: meta.headers,
        });
        context.discoveredStreams.push(...parsed);
      },
    },
  };

  return Lampa;
}
