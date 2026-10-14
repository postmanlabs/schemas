import { describe, it, expect } from 'vitest';
import { lib, utils, createAjv, schemaVersions } from './helpers';

const versions = schemaVersions();
const cases = versions.map((v) => ({ ...v, label: `${v.draft}/${v.version}` }));

// Guard discovery so a path bug can't make the suite pass vacuously
// (8 draft-04 + 4 draft-07); bump when adding versions.
it('discovers every schema version', () => {
  expect(versions).toHaveLength(12);
});

describe.each(cases)('$label', ({ draft, schemaDir, schemaPath }) => {
  it('compiles to a fully resolvable schema', () => {
    // Same rule as scripts/generate-schemas.mjs: self-contained schemas (e.g. v3)
    // are used as-is, since lib.compile would replace their inline definitions.
    const raw = utils.removeCommentsAndLoadJSON(schemaPath);
    const schema =
      raw.definitions && Object.keys(raw.definitions).length > 0 ? raw : lib.compile(schemaPath, schemaDir, draft);

    expect(Object.keys(schema.definitions ?? {}).length).toBeGreaterThan(0);
    // ajv throws MissingRefError on any unresolved $ref.
    expect(() => createAjv(draft).compile(schema)).not.toThrow();
  });
});
