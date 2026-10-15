import { deserializeTree, type PrebuiltSchemaTree, type SerializedTree } from '@postman/json-schema-viewer';

/** JSON-safe tree built on the server and sent to the client in the loader data. */
export interface SerializedSchemaTree {
  tree: SerializedTree;
  nodeCount: number;
}

/**
 * Rebuild a `PrebuiltSchemaTree` from the serialized form sent by the server. This is
 * cheap (constructing nodes from already-merged fragments — no `$ref`/`allOf` work), so
 * it's safe to run on the main thread during hydration.
 */
export function deserializeSchemaTree(serialized: SerializedSchemaTree): PrebuiltSchemaTree {
  return { root: deserializeTree(serialized.tree), nodeCount: serialized.nodeCount };
}
