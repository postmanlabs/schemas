import {
  deserializeTree,
  type JSONSchema,
  type PrebuiltSchemaTree,
  type SerializedTree,
  type ViewMode,
} from '@postman/json-schema-viewer';
import type { QueryClient } from '@tanstack/react-query';

import type { SchemaEntry } from '../generated/manifest';

// Lazily-created singleton worker (client only). Building it eagerly would break SSR.
let worker: Worker | undefined;
let seq = 0;

interface WorkerSuccess {
  id: number;
  ok: true;
  tree: SerializedTree;
  nodeCount: number;
}
interface WorkerFailure {
  id: number;
  ok: false;
  error: string;
}
type WorkerResponse = WorkerSuccess | WorkerFailure;

const pending = new Map<number, { resolve: (r: WorkerSuccess) => void; reject: (e: Error) => void }>();

/** Structured-clone/JSON-safe tree produced on the server for React Query hydration. */
export interface SerializedSchemaTree {
  tree: SerializedTree;
  nodeCount: number;
}

/**
 * Rebuild a `PrebuiltSchemaTree` from the serialized form transferred by SSR. This is
 * cheap (constructing nodes from already-merged fragments — no `$ref`/`allOf` work), so
 * it's safe to run on the main thread during hydration.
 */
export function deserializeSchemaTree(serialized: SerializedSchemaTree): PrebuiltSchemaTree {
  return { root: deserializeTree(serialized.tree), nodeCount: serialized.nodeCount };
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./schemaTree.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.ok) entry.resolve(data);
      else entry.reject(new Error(data.error));
    });
    worker.addEventListener('error', (event) => {
      // Fail everything in flight; callers fall back to a main-thread build.
      const err = new Error(event.message || 'schema tree worker error');
      for (const [, p] of pending) p.reject(err);
      pending.clear();
    });
  }
  return worker;
}

/**
 * Build a schema tree in the worker and rebuild real node instances on the main
 * thread. The result is stored by React Query (see `schemaTreeQueryOptions`) and
 * handed to the viewer via its `tree` prop — that query cache is the single source of
 * truth for built trees.
 */
export async function buildSchemaTreeViaWorker(
  schema: JSONSchema,
  viewMode: ViewMode = 'standalone',
): Promise<PrebuiltSchemaTree> {
  const w = getWorker();
  const id = ++seq;

  const result = await new Promise<WorkerSuccess>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, schema, viewMode });
  });

  return { root: deserializeTree(result.tree), nodeCount: result.nodeCount };
}

/**
 * React Query options for a schema's tree, keyed by the stable schema id. `loadSchema`
 * resolves the schema JSON — from `entry.load()` when prefetching, or the schema the
 * page already holds. Sharing the key lets a hover prefetch satisfy the later render.
 */
export function schemaTreeQueryOptions(
  schemaId: string,
  loadSchema: () => Promise<JSONSchema> | JSONSchema,
  viewMode: ViewMode = 'standalone',
) {
  return {
    queryKey: ['schemaTree', schemaId, viewMode] as const,
    queryFn: async () => buildSchemaTreeViaWorker(await loadSchema(), viewMode),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  };
}

/**
 * Prefetch (build + cache) a schema's tree ahead of navigation — call on hover/focus
 * of a version-menu link. No-op on the server; React Query dedupes repeated calls.
 */
export function prefetchSchemaTree(
  queryClient: QueryClient,
  entry: SchemaEntry,
  viewMode: ViewMode = 'standalone',
): void {
  if (typeof window === 'undefined') return;
  void queryClient.prefetchQuery(
    schemaTreeQueryOptions(entry.id, () => entry.load() as unknown as Promise<JSONSchema>, viewMode),
  );
}
