// React-free entry point intended to run inside a Web Worker (and on the main thread
// for deserialization). It builds a populated json-schema-tree and serializes it into
// a structured-clone-safe shape that can be posted back to the main thread, where
// `deserializeTree` rebuilds real node instances.
import { deserializeTree, SchemaTree as JsonSchemaTree, serializeTree, type SerializedTree } from '@postman/json-schema-tree';

import { shouldNodeBeIncluded } from './tree/utils';
import type { JSONSchema, ViewMode } from './types';

export interface BuiltSerializedTree {
  tree: SerializedTree;
  nodeCount: number;
}

/**
 * Populate the schema tree (the expensive part: `$ref` deref + `allOf` merge) and
 * serialize it. This is a pure function of `schema` + `viewMode` and applies the same
 * node filtering the viewer uses, so the resulting tree matches a locally-built one.
 */
export function buildSerializedTree(schema: JSONSchema, viewMode: ViewMode = 'standalone'): BuiltSerializedTree {
  const jsonSchemaTree = new JsonSchemaTree(schema, { mergeAllOf: true });

  let nodeCount = 0;
  jsonSchemaTree.walker.hookInto('filter', (node) => {
    if (shouldNodeBeIncluded(node, viewMode)) {
      nodeCount++;
      return true;
    }
    return false;
  });
  jsonSchemaTree.populate();

  return { tree: serializeTree(jsonSchemaTree.root), nodeCount };
}

export { deserializeTree, type SerializedTree };
