import { describe, it, expect } from 'vitest';
import { lib, utils, createAjv, schemaVersions, type Draft } from './helpers';

const versions = schemaVersions();
const cases = versions.map((v) => ({ ...v, label: `${v.draft}/${v.version}` }));

// Guard discovery so a path bug can't make the suite pass vacuously
// (8 draft-04 + 4 draft-07); bump when adding versions.
it('discovers every schema version', () => {
  expect(versions).toHaveLength(12);
});

describe.each(cases)('$label', ({ draft, schemaDir, schemaPath }) => {
  it('compiles to a fully resolvable schema', () => {
    const schema = lib.compile(schemaPath, schemaDir, draft);

    expect(Object.keys(schema.definitions ?? {}).length).toBeGreaterThan(0);
    // ajv throws MissingRefError on any unresolved $ref.
    expect(() => createAjv(draft).compile(schema)).not.toThrow();
  });
});

it('keeps the inline definitions of a self-contained schema (v3)', () => {
  const v3 = versions.find((v) => v.draft === 'draft-07' && v.version === 'v3.0.0')!;
  const raw = utils.removeCommentsAndLoadJSON(v3.schemaPath);

  expect(Object.keys(raw.definitions ?? {})).toHaveLength(61);
  expect(lib.compile(v3.schemaPath, v3.schemaDir, 'draft-07')).toEqual(raw);
});

it('infers the draft from $schema when none is given', () => {
  const v2 = versions.find((v) => v.draft === 'draft-04' && v.version === 'v2.1.0')!;

  expect(Object.keys(lib.compile(v2.schemaPath, v2.schemaDir).definitions ?? {})).toHaveLength(23);
  expect(lib.compile(v2.schemaPath, v2.schemaDir)).toEqual(lib.compile(v2.schemaPath, v2.schemaDir, 'draft-04'));
});

it('rejects an unknown draft with a clear error', () => {
  const v2 = versions.find((v) => v.draft === 'draft-04' && v.version === 'v2.1.0')!;

  expect(() => lib.compile(v2.schemaPath, v2.schemaDir, 'draft-99' as Draft)).toThrow('Unsupported draft version: draft-99');
});
