import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lib, utils, schemaVersions } from './helpers';
import { legacyRouteRules, legacyUrls, latestStable, viewerPage, VIEWER_DRAFT } from '../scripts/legacy-urls';
import { writeSchemas } from '../scripts/generate-schemas.mjs';

const versions = schemaVersions();
const versionsByDraft: Record<string, string[]> = {};

for (const { draft, version } of versions) {
  (versionsByDraft[draft] ??= []).push(version);
}

const { raw, redirects } = legacyUrls(versionsByDraft);
const routeRules = legacyRouteRules(versionsByDraft);
const viewerPages = new Set(versionsByDraft[VIEWER_DRAFT].map(viewerPage));

/** Same rule as generate-schemas.mjs: self-contained schemas as-is, else lib.compile. */
function expectedSchema(draft: string, version: string): unknown {
  const v = versions.find((s) => s.draft === draft && s.version === version);

  if (!v) {
    throw new Error(`unknown schema ${draft}/${version}`);
  }

  const schema = utils.removeCommentsAndLoadJSON(v.schemaPath);

  return schema.definitions && Object.keys(schema.definitions).length > 0
    ? schema
    : lib.compile(v.schemaPath, v.schemaDir, v.draft);
}

let tmp: string;
let written: string[];

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-urls-'));
  written = writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir: path.join(tmp, 'schemas') }).rawPaths;
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Guards so a discovery bug can't pass vacuously. Raw: (8 draft-04 + latest) × 2
// layouts + (4 draft-07 + latest) × 2 layouts. Redirects: one per raw docs URL
// except the 4 draft-07 viewer pages, plus /index.html.
it('covers every legacy URL', () => {
  expect(raw).toHaveLength(28);
  expect(Object.keys(redirects)).toHaveLength(25);
  expect(new Set(raw.map((f) => f.path)).size).toBe(raw.length);
});

it('resolves latest to the highest semver-stable version per draft', () => {
  expect(latestStable(versionsByDraft['draft-07'])).toBe('v3.0.0');
  expect(latestStable(versionsByDraft['draft-04'])).toBe('v2.1.0');
  expect(latestStable(['v2.0.0', 'v10.0.0', 'v11.0.0-rc.1', 'v9.9.9'])).toBe('v10.0.0');
  expect(raw.find((f) => f.path === '/json/collection/latest/collection.json')?.version).toBe('v2.1.0');
  expect(raw.find((f) => f.path === '/json/draft-07/collection/latest/collection.json')?.version).toBe('v3.0.0');
});

it("includes the legacy URLs that 404'd after the rebuild", () => {
  const paths = raw.map((f) => f.path);

  for (const p of [
    '/json/collection/v2.1.0/collection.json',
    '/json/collection/v2.0.0/collection.json',
    '/json/collection/v1.0.0/collection.json',
    '/json/collection/v2.0.0-rc.1/collection.json',
    '/json/collection/v1.1.0-draft.1/collection.json',
    '/json/collection/latest/collection.json',
    '/json/draft-07/collection/v2.1.0/collection.json',
    '/collection/json/latest/draft-07/collection.json',
    '/collection/json/v2.1.0/draft-04/collection.json',
  ]) {
    expect(paths).toContain(p);
  }

  expect(redirects['/json/collection/v2.1.0/docs/index.html']).toBe(viewerPage('v2.1.0'));
  expect(redirects['/index.html']).toBe('/');
});

it('writes exactly the listed raw files', () => {
  expect([...written].sort()).toEqual(raw.map((f) => f.path).sort());
});

describe.each(raw.map((f) => ({ ...f, label: `${f.path} = ${f.draft}/${f.version}` })))(
  '$label',
  ({ path: urlPath, draft, version }) => {
    it('is served with the compiled schema', () => {
      const content = JSON.parse(fs.readFileSync(path.join(tmp, 'public', urlPath), 'utf8'));

      expect(content).toEqual(expectedSchema(draft, version));
    });
  },
);

describe.each(Object.entries(redirects).map(([from, to]) => ({ from, to })))('$from → $to', ({ from, to }) => {
  it('is a single-hop redirect to an existing target', () => {
    const exists = to === '/' || viewerPages.has(to) || fs.existsSync(path.join(tmp, 'public', to));

    expect(routeRules[from]).toEqual({ redirect: { to, status: 301 } });
    expect(exists).toBe(true);
    expect(redirects[to]).toBeUndefined();
    expect(viewerPages.has(from)).toBe(false);
  });
});
