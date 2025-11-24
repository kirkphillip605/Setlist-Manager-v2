import { QueryClient } from "@tanstack/react-query";
import { Persister, createSyncStoragePersister } from "@tanstack/react-query-persist-client";
import { get, set, del } from 'idb-keyval';

// Custom persister using idb-keyval for IndexedDB support (Async storage)
// We need to wrap the async idb-keyval in a sync-like interface or use the async persister creator if available.
// Actually, createSyncStoragePersister is for localStorage. 
// For async storage like IndexedDB, we define the persister manually or use createAsyncStoragePersister 
// (but that is often experimental or requires specific adapter).
// The simplest robust way for React Query v5 is providing a persistFn.

// However, @tanstack/react-query-persist-client provides a createPersister interface.
// Let's create a persister that works with idb-keyval.

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
      // 1. Cache time: How long unused data remains in memory/storage (24 hours)
      gcTime: 1000 * 60 * 60 * 24, 
      
      // 2. Stale time: How long data is considered "fresh" before refetching (5 minutes)
      // This prevents immediate refetching on navigation, utilizing the cache.
      staleTime: 1000 * 60 * 5,

      // 3. Network mode: 'offlineFirst' means if we have data, use it. 
      // If we don't have data and are offline, it won't try to fetch and fail immediately.
      networkMode: 'offlineFirst',
      
      retry: 3,
    },
    mutations: {
      networkMode: 'offlineFirst',
    }
  },
});

export const persister = createIDBPersister();