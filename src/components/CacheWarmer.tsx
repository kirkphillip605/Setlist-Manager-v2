import { useSyncedSongs, useSyncedSetlists } from "@/hooks/useSyncedData";
import { useAuth } from "@/context/AuthContext";

/**
 * This component renders invisibly to ensure the "Master Catalog"
 * hooks are active and fetching data as soon as the user logs in.
 */
export const CacheWarmer = () => {
  const { session } = useAuth();
  
  // These hooks will trigger the fetch (if not already cached)
  // and set up Realtime subscriptions.
  useSyncedSongs();
  useSyncedSetlists();

  if (!session) return null;

  return null;
};