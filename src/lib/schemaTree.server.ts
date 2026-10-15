// Server-only: builds the serialized schema tree during SSR/prerender so it can be
// sent to the client in the loader data; the client only deserialises it. Kept in its
// own module and imported dynamically after the loader's `import.meta.env.SSR` guard so
// this (and the tree-building code it pulls in) is never included in the client bundle.
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
