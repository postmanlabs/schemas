import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSchemas, type SchemaEntry } from '../scripts/generate-schemas.mjs';
// Import the package source, not its gitignored (and possibly stale) dist.
import {
  deserializeTree,
  isMirroredNode,
  isRegularNode,
  SchemaTree,
  serializeTree,
  type RegularNode,
  type SchemaNode,
} from '../packages/json-schema-tree/src';

function buildTree(schema: object) {
  const tree = new SchemaTree(schema, { mergeAllOf: true });

  tree.populate();

  return tree.root;
}

const isCombiner = (node: RegularNode) => node.combiners?.[0] === 'anyOf' || node.combiners?.[0] === 'oneOf';

/**
 * Every anyOf/oneOf node, found without descending into mirrored nodes (their
 * targets are visited as regular nodes, and their lazy children never end).
 */
function combinerNodes(root: SchemaNode): RegularNode[] {
  const found: RegularNode[] = [];
  const walk = (node: SchemaNode) => {
    if (isMirroredNode(node)) return;
    if (isRegularNode(node) && isCombiner(node)) found.push(node);
    for (const child of ('children' in node ? node.children : null) ?? []) walk(child);
  };

  walk(root);

  return found;
}

/** Paths of combiner nodes that have a child which isn't one of their branches. */
function withNonBranchChildren(root: SchemaNode): string[] {
  return combinerNodes(root)
    .filter((node) => (node.children ?? []).some((child) => child.subpath[0] !== node.combiners![0]))
    .map((node) => node.path.join('/'));
}

describe('json-schema-tree oneOf/anyOf nodes', () => {
  it('keep the combiner annotations but none of its structural keywords', () => {
    const root = buildTree({
      title: 'T',
      description: 'D',
      deprecated: true,
      readOnly: true,
      default: 1,
      'x-foo': 1,
      type: 'object',
      required: ['a'],
      properties: { a: { type: 'string' } },
      oneOf: [{ title: 'A' }, {}],
    });
    const node = root.children[0] as RegularNode;

    expect(node.title).toBe('T');
    expect(node.annotations.description).toBe('D');
    expect(node.annotations.default).toBe(1);
    expect(node.deprecated).toBe(true);
    expect(node.validations.readOnly).toBe(true);
    expect((node.fragment as Record<string, unknown>)['x-foo']).toBe(1);
    expect(node.types).toBeNull();
    expect(node.required).toBeNull();

    const branches = node.children ?? [];

    expect(branches).toHaveLength(2);
    expect(branches.map((child) => child.subpath[0])).toEqual(['oneOf', 'oneOf']);

    // The structural keywords still reach the branches through the merge.
    const second = branches[1] as RegularNode;

    expect(second.title).toBe('T');
    expect(second.children?.map((child) => child.subpath.join('/'))).toContain('properties/a');
  });

  describe('generated schemas', () => {
    let tmp: string;
    let entries: SchemaEntry[];
    const load = (entry: SchemaEntry) =>
      JSON.parse(fs.readFileSync(path.join(tmp, 'schemas', `${entry.id}.json`), 'utf8'));

    beforeAll(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-combiners-'));
      entries = writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir: path.join(tmp, 'schemas') }).entries;
    });

    afterAll(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    // Builds a tree per viewer schema; slow on a busy machine, so it gets more than the 5s default.
    it('have no combiner with a non-branch child', { timeout: 30_000 }, () => {
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        const root = buildTree(load(entry));

        expect(combinerNodes(root).length, entry.id).toBeGreaterThan(0);
        expect(withNonBranchChildren(root), entry.id).toEqual([]);
      }
    });

    it('have no combiner with a non-branch child after a serde round-trip (v2.1.0)', () => {
      const entry = entries.find((e) => e.version === 'v2.1.0')!;
      const root = deserializeTree(serializeTree(buildTree(load(entry))));

      expect(combinerNodes(root).length).toBeGreaterThan(0);
      expect(withNonBranchChildren(root)).toEqual([]);
    });

    it('give the v2.1.0 variable items exactly its 3 anyOf branches', () => {
      const entry = entries.find((e) => e.version === 'v2.1.0')!;
      // `variable` is reached from several places; the first visit is a regular
      // node and later ones mirror it, so check every regular occurrence.
      const nodes = combinerNodes(buildTree(load(entry))).filter((node) =>
        node.path.join('/').endsWith('/variable/items'),
      );

      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) {
        // These are the schema's 3 required-only anyOf branches (id, key, or both).
        // Folding them into a single choice would intentionally change this count.
        expect(node.children?.map((child) => child.subpath.join('/'))).toEqual(['anyOf/0', 'anyOf/1', 'anyOf/2']);
      }
    });
  });
});
