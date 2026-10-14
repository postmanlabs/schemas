import { describe, it, expect } from 'vitest';
import { lib, exampleCases } from './helpers';

const cases = exampleCases();

// Guard discovery so a path bug can't make the suite pass vacuously.
it('discovers every example (70 draft-07 + 94 draft-04)', () => {
  expect(cases).toHaveLength(164);
});

describe.each(['draft-04', 'draft-07'] as const)('%s examples', (draft) => {
  it.each(cases.filter((c) => c.draft === draft).map((c) => ({ ...c, label: `${c.version}/${c.name}` })))(
    'validates $label',
    ({ examplePath, schemaPath, schemaDir }) => {
      expect(lib.validate(examplePath, schemaPath, schemaDir, draft)).toBe(true);
    },
  );
});
