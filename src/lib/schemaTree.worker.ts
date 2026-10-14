// Web Worker: builds + serializes a json-schema-tree off the main thread.
//
// The expensive part of rendering a schema is populating the tree ($ref deref +
// allOf merge). Doing it here keeps the UI responsive: the main thread only pays for
// (de)serialization and rendering. The worker uses the React-free `/worker` entry of
// the vendored viewer so no UI code is pulled into the worker bundle.
import { buildSerializedTree } from '@postman/json-schema-viewer/worker';
import type { JSONSchema, ViewMode } from '@postman/json-schema-viewer';

export interface WorkerRequest {
  id: number;
  schema: JSONSchema;
  viewMode?: ViewMode;
}

// The DOM lib types `postMessage`/`self` as the Window variants; in a worker they're
// the DedicatedWorkerGlobalScope variants. Cast to the single-argument form.
const post = postMessage as (message: unknown) => void;

addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, schema, viewMode } = event.data;
  try {
    const { tree, nodeCount } = buildSerializedTree(schema, viewMode);
    post({ id, ok: true, tree, nodeCount });
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
