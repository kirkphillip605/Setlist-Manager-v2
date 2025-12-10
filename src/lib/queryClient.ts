import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { storageAdapter } from "@/lib/storageAdapter";

// Configure the Persister to use our universal storage adapter
export const persister = createAsyncStoragePersister({
  storage: storageAdapter,
  key: "REACT_QUERY_OFFLINE_CACHE",
  throttleTime: 1000,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 24 hours until inactive data is removed from memory
      gcTime: 1000 * 60 * 60 * 24, 
      
      // 5 minutes until data is considered "stale" (background refetch needed)
      // Note: Master Catalog hooks will override this to Infinity
      staleTime: 1000 * 60 * 5,

      // Allow queries to run even if browser thinks we are offline
      // (We handle real offline logic via our cached data)
      networkMode: 'offlineFirst',
      
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
    }
  },
});