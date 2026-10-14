import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { SCHEMA_DIR, utils } from './helpers';

// The required-only anyOf branches carry a title naming the keys that set them
// apart, so the viewer lists them as distinct variants (both drafts).
const SITES = ['draft-04', 'draft-07'].flatMap((draft) => [
  ...['v1.0.0', 'v2.0.0', 'v2.1.0'].map((version) => ({ draft, version, file: 'variable.json', parent: 'Variable' })),
  { draft, version: 'v1.0.0', file: 'request.json', parent: 'Request' },
]);

describe.each(SITES.map((s) => ({ ...s, label: `${s.draft}/${s.version}/${s.file}` })))('$label', (site) => {
  const schema = utils.removeCommentsAndLoadJSON(path.join(SCHEMA_DIR, site.draft, site.version, 'collection', site.file));
  const branches = schema.anyOf as { title?: string; required: string[] }[];

  it('names each required-only branch after the keys that set it apart', () => {
    expect(schema.title).toBe(site.parent);
    expect(branches.length).toBeGreaterThan(1);

    const common = branches[0].required.filter((key) => branches.every((b) => b.required.includes(key)));

    for (const branch of branches) {
      expect(Object.keys(branch).sort()).toEqual(['required', 'title']);
      const own = branch.required.filter((key) => !common.includes(key));
      expect(branch.title).toBe(`${site.parent} (requires ${own.join(' and ')})`);
    }
  });
});

it('covers all 8 sites', () => {
  expect(SITES).toHaveLength(8);
});
