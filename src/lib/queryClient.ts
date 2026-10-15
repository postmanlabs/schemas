import { QueryClient } from '@tanstack/react-query';

// Trees never change once built, so default to never-stale, long-lived cache entries.
function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 1000 * 60 * 30,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * One client per browser session; a fresh client per SSR render (no cross-request
 * leakage). No queries run on the server in this app — prefetch is hover-driven — so
 * the server client is effectively just there to satisfy the provider.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeClient();
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}
