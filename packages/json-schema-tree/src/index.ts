// Public surface of the fork: everything the upstream package exported, plus the
// worker-oriented serde helpers.
export * from './vendor/index.js';
export { serializeTree, deserializeTree, type SerializedTree } from './serde.js';
