import { QueryClient } from "@tanstack/react-query";
import { Persister } from "@tanstack/react-query-persist-client";
import { get, set, del } from 'idb-keyval';

// Creates a persister using IndexedDB (works in Capacitor WebView)
export const createIDBPersister = (idbValidKey: IDBValidKey = "reactQuery"): Persister => {
  return {
    persistClient: async (client) => {
      try {
        await set(idbValidKey, client);
      } catch (error) {
        console.error("Failed to persist cache", error);
      }
    },
    restoreClient: async () => {
      try {
        return await get(idbValidKey);
      } catch (error) {
        console.error("Failed to restore cache", error);
        return undefined;
      }
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } as Persister;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Time until inactive data is removed from memory (24 hours)
      gcTime: 1000 * 60 * 60 * 24, 
      
      // Time until data is considered "stale" and needs a background refetch
      // We set this fairly high (5 mins) to prevent constant refetching,
      // but specific hooks (useAllSongs) will override this to Infinity.
      staleTime: 1000 * 60 * 5,

      // IMPORTANT: Allows queries to run even if the browser thinks it's offline.
      // We handle the "real" offline logic via our cached data.
      networkMode: 'offlineFirst',
      
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
    }
  },
});

export const persister = createIDBPersister();