import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSchemas } from '../scripts/generate-schemas.mjs';
import { buildSerializedTree, deserializeTree } from '../packages/json-schema-viewer/src/worker';
import { buildChoices } from '../packages/json-schema-viewer/src/components/SchemaRow/useChoices';
import type { JSONSchema } from '../packages/json-schema-viewer/src/types';

type SchemaNode = Parameters<typeof buildChoices>[0];

const VERSIONS = ['v1.0.0', 'v2.0.0', 'v2.1.0', 'v3.0.0'];
// The schemas are recursive (item → item-group → item ...); mirrored nodes are
// skipped and the depth is capped so the walk always ends.
const MAX_DEPTH = 40;

type ChoiceSet = { path: string; node: SchemaNode; titles: string[] };

let tmp: string;
const trees: Record<string, SchemaNode> = {};

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'choice-labels-'));
  const schemaOutDir = path.join(tmp, 'schemas');
  writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir });

  for (const version of VERSIONS) {
    const file = path.join(schemaOutDir, 'collection', 'draft-07', `${version}.json`);
    const schema = JSON.parse(fs.readFileSync(file, 'utf8')) as JSONSchema;
    trees[version] = deserializeTree(buildSerializedTree(schema).tree);
  }
  // Compiling every schema and building 4 trees can pass the 10s default on a busy machine.
}, 60_000);

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function nodes(root: SchemaNode): SchemaNode[] {
  const seen = new Set<SchemaNode>();
  const out: SchemaNode[] = [];
  const visit = (node: SchemaNode, depth: number) => {
    if (seen.has(node) || 'mirroredNode' in node || depth > MAX_DEPTH) return;
    seen.add(node);
    out.push(node);
    for (const child of ('children' in node && node.children) || []) visit(child, depth + 1);
  };
  visit(root, 0);
  return out;
}

function choiceSets(version: string): ChoiceSet[] {
  return nodes(trees[version])
    .map(node => ({ node, choices: buildChoices(node) }))
    .filter(({ choices }) => choices.length > 1)
    .map(({ node, choices }) => ({
      path: node.path.join('/'),
      node,
      titles: choices.map(c => c.title),
    }));
}

/** Choice titles of every choice set whose node path ends with `suffix`. */
function titlesAt(version: string, suffix: string): string[][] {
  const sets = choiceSets(version).filter(set => set.path.endsWith(suffix));
  expect(sets.length, `${version} ${suffix}`).toBeGreaterThan(0);
  return sets.map(set => set.titles);
}

/** Every regular node whose path ends with `suffix`. */
function nodesAt(version: string, suffix: string): SchemaNode[] {
  const found = nodes(trees[version]).filter(node => node.path.join('/').endsWith(suffix));
  expect(found.length, `${version} ${suffix}`).toBeGreaterThan(0);
  return found;
}

describe.each(VERSIONS)('%s', version => {
  it('has choice sets to check', () => {
    expect(choiceSets(version).length).toBeGreaterThan(5);
  });

  it('never repeats a label within a dropdown', () => {
    for (const { path: at, titles } of choiceSets(version)) {
      expect(new Set(titles).size, `${at}: ${JSON.stringify(titles)}`).toBe(titles.length);
    }
  });
});

// The required-only anyOf branches are named in the schemas themselves.
describe('named required-only variants', () => {
  const required = (node: SchemaNode) => [...((node as { required?: string[] | null }).required ?? [])].sort();
  const VARIABLE = [
    ['Variable (requires id)', ['id']],
    ['Variable (requires key)', ['key']],
    ['Variable (requires id and key)', ['id', 'key']],
  ] as const;
  const COMMON = ['headers', 'id', 'method', 'name', 'url'];
  const REQUEST = [
    ['Request (requires collectionId)', [...COMMON, 'collectionId'].sort()],
    ['Request (requires collection)', [...COMMON, 'collection'].sort()],
  ] as const;
  const named = (version: string, prefix: string) =>
    choiceSets(version).filter(set => set.titles.every(title => title.startsWith(prefix)));

  it.each(['v1.0.0', 'v2.0.0', 'v2.1.0'])('%s variable: 3 named variants in schema order, each with its keys required', version => {
    const sets = named(version, 'Variable (');

    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets) {
      expect(set.titles, set.path).toEqual(VARIABLE.map(([title]) => title));
      buildChoices(set.node).forEach((choice, i) => expect(required(choice.type), choice.title).toEqual(VARIABLE[i][1]));
    }
  });

  it('v1.0.0 requests: 2 named variants in schema order, common keys + their own required', () => {
    const sets = named('v1.0.0', 'Request (');

    expect(sets.map(set => set.path)).toContain('properties/requests');
    for (const set of sets) {
      expect(set.titles, set.path).toEqual(REQUEST.map(([title]) => title));
      buildChoices(set.node).forEach((choice, i) => expect(required(choice.type), choice.title).toEqual(REQUEST[i][1]));
    }
  });

  it('v1.0.0 variables (oneOf list or null) still offers the list and null', () => {
    const root = choiceSets('v1.0.0').find(set => set.path === 'properties/variables');

    expect(root?.titles).toEqual(['array[Variable]', 'null']);
  });

  it('still sorts other array variants alphabetically (v3.0.0 items)', () => {
    const [titles] = titlesAt('v3.0.0', 'properties/items');

    expect(titles.length).toBeGreaterThan(5);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });
});

describe('colliding labels get distinct, meaningful names', () => {
  it.each([
    // A title that repeats the parent's → the type name.
    ['v1.0.0', 'properties/script/properties/src', ['object', 'string']],
    ['v2.0.0', 'properties/info/properties/version', ['object', 'string']],
    ['v2.1.0', 'properties/info/properties/version', ['object', 'string']],
    ['v2.1.0', 'properties/script/properties/src', ['object', 'string']],
    ['v2.1.0', 'oneOf/0/properties/request', ['object', 'string']],
    ['v2.1.0', 'request/oneOf/0/properties/url', ['object', 'string']],
    ['v2.1.0', 'properties/originalRequest', ['object', 'string']],
    ['v2.0.0', 'response/items/properties/header', ['array[oneOf]', 'string', 'null']],
    ['v2.1.0', 'response/items/properties/header/oneOf/0', ['objects', 'strings']],
    // enum → "<type> (enum)". const → its value is checked separately below.
    ['v1.0.0', 'properties/requests/items/anyOf/0/properties/method', ['string (enum)', 'string']],
    ['v2.1.0', 'request/oneOf/0/properties/method', ['string (enum)', 'string']],
    // Objects told apart by a const property.
    ['v1.0.0', 'properties/requests/items/anyOf/0/properties/data/oneOf/0', ['type: text', 'type: file']],
    ['v2.0.0', 'properties/body/oneOf/0/properties/formdata', ['type: text', 'type: file']],
    ['v2.1.0', 'properties/body/oneOf/0/properties/formdata', ['type: text', 'type: file']],
  ] as const)('%s …%s', (version, at, expected) => {
    for (const titles of titlesAt(version, at)) {
      expect(titles).toEqual(expected);
    }
  });

  it('keeps the default choice for renamed variants (formdata still defaults to text)', () => {
    for (const version of ['v2.0.0', 'v2.1.0']) {
      for (const node of nodesAt(version, 'properties/body/oneOf/0/properties/formdata')) {
        const [first] = buildChoices(node);
        expect(first.title).toBe('type: text');
        expect((first.type.fragment as { properties: { type: { const: string } } }).properties.type.const).toBe('text');
      }
    }
  });

  it('names a const variant by its value (number vs const null)', () => {
    const tree = deserializeTree(buildSerializedTree({ oneOf: [{ type: 'number' }, { type: 'number', const: null }] }).tree);
    const combiner = (tree as SchemaNode & { children: SchemaNode[] }).children[0];

    expect(buildChoices(combiner).map(c => c.title)).toEqual(['number', 'null']);
  });

  it('falls back to an ordinal suffix when no other rule tells the variants apart', () => {
    const tree = deserializeTree(
      buildSerializedTree({ oneOf: [{ title: 'A', type: 'string' }, { title: 'A', type: 'number' }, { title: 'B' }] }).tree,
    );
    const combiner = (tree as SchemaNode & { children: SchemaNode[] }).children[0];

    expect(buildChoices(combiner).map(c => c.title)).toEqual(['A (1)', 'A (2)', 'B']);
  });

  it('keeps labels that do not collide, e.g. v2.1.0 item and auth', () => {
    for (const titles of titlesAt('v2.1.0', 'properties/item')) expect(titles).toEqual(['Folder', 'Item']);
    for (const titles of titlesAt('v2.1.0', 'oneOf/0/properties/auth')) expect(titles).toEqual(['null', 'Auth']);
  });
});
