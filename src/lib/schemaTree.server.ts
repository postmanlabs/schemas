// Server-only: builds the serialized schema tree during SSR so it can be transferred
// to the client and used as React Query initial data (avoiding a redundant, main-thread
// build on first load). Kept in its own module and imported dynamically under an
// `import.meta.env.SSR` guard so this (and the tree-building code it pulls in) is never
// included in the client bundle.
import { buildSerializedTree } from '@postman/json-schema-viewer/worker';
import type { JSONSchema, ViewMode } from '@postman/json-schema-viewer';

import type { SerializedSchemaTree } from './schemaTree';

export function buildSerializedSchemaTree(
  schema: JSONSchema,
  viewMode: ViewMode = 'standalone',
): SerializedSchemaTree {
  const { tree, nodeCount } = buildSerializedTree(schema, viewMode);
  return { tree, nodeCount };
}
