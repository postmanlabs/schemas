#!/usr/bin/env node
/**
 * Compiles every JSON schema into a single schema (sibling definition files
 * merged into `definitions`; `$ref`s are kept, not dereferenced) and emits it,
 * along with a manifest, into `src/generated/` so the TanStack Start app can load
 * them for the Stoplight JSON Schema Viewer.
 *
 * Schemas all live under the local `schemas/` tree. Two layouts are supported:
 *   - Legacy: `collection.json` references sibling definition files that are
 *     merged into `definitions` by `tools.compile` (e.g. v1/v2).
 *   - Self-contained: `collection.json` already carries its own `definitions`
 *     (e.g. v3), so it is emitted verbatim.
 *
 * Output layout (per resource kind, e.g. "collection"):
 *   src/generated/schemas/{resource}/{draft}/{version}.json   (viewer bundle, INCLUDED_DRAFTS only)
 *   public/{resource}/json/{version}/{draft}/{resource}.json  (raw download, every draft)
 *   public/json/...                                           (legacy raw URLs, see legacy-urls.ts)
 *   public/_redirects                                         (legacy docs URL 301s, see legacy-urls.ts)
 *
 * Run as a script to regenerate everything; import `writeSchemas` to write the
 * schema files elsewhere (used by tests).
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { VIEWER_DRAFT, legacyRedirectsFile, legacyUrls } from './legacy-urls.ts';

const require = createRequire(import.meta.url);
const semver = require('semver');
const tools = require('../lib'); // { compile, validate, versions }

const DEFAULT_DRAFT = 'draft-07';

// Only these JSON Schema drafts are surfaced in the viewer.
const INCLUDED_DRAFTS = [VIEWER_DRAFT];

// Human-readable labels and ordering for the resource kinds we surface.
const RESOURCE_LABELS = { collection: 'Collection' };
const RESOURCE_ORDER = ['collection'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'schemas');
const OUT_DIR = path.join(ROOT, 'src', 'generated');
const SCHEMA_OUT_DIR = path.join(OUT_DIR, 'schemas');
const PUBLIC_DIR = path.join(ROOT, 'public');

/** @param {string} p */
const isDir = (p) => fs.statSync(p).isDirectory();

function statusForVersion(version) {
  const sv = new semver.SemVer(version);

  return Array.isArray(sv.prerelease) && sv.prerelease.length ? String(sv.prerelease[0]) : 'stable';
}

function isStable(version) {
  return /v\d+\.\d+\.\d+$/i.test(version);
}

/** @param {string} file @param {string} content */
function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** @returns {Record<string, string[]>} every schemas/{draft}/{version} with a collection.json, newest first. */
function listVersions() {
  /** @type {Record<string, string[]>} */
  const versionsByDraft = {};

  for (const draft of fs.readdirSync(SCHEMA_DIR).filter((d) => isDir(path.join(SCHEMA_DIR, d)))) {
    const draftPath = path.join(SCHEMA_DIR, draft);

    versionsByDraft[draft] = fs
      .readdirSync(draftPath)
      .filter((v) => isDir(path.join(draftPath, v)))
      .filter((v) => {
        const exists = fs.existsSync(path.join(draftPath, v, 'collection.json'));

        if (!exists) {
          console.warn('Skipping %s/%s (no collection.json)', draft, v);
        }

        return exists;
      })
      .sort(semver.rcompare);
  }

  return versionsByDraft;
}

/** Compiled collection schema for schemas/{draft}/{version}. */
function loadSchema(draft, version) {
  const versionSchemaDir = path.join(SCHEMA_DIR, draft, version);
  const schemaFile = path.join(versionSchemaDir, 'collection.json');
  const raw = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));

  if (raw.definitions && Object.keys(raw.definitions).length > 0) {
    // Self-contained: `definitions` are already inline, emit as-is.
    console.info('Bundling collection %s/%s (self-contained) ...', draft, version);

    return raw;
  }

  // Legacy: `definitions` live in sibling files, merged by compile().
  console.info('Compiling collection %s/%s ...', draft, version);

  return tools.compile(schemaFile, versionSchemaDir, draft);
}

/**
 * Writes the viewer bundle (INCLUDED_DRAFTS only) into `schemaOutDir` and every
 * raw download (current + legacy URLs, all drafts) into `publicDir`. Does not
 * clean either directory.
 *
 * @param {{publicDir?: string, schemaOutDir?: string}} [dirs]
 * @returns {{entries: import('./generate-schemas.d.mts').SchemaEntry[], rawPaths: string[]}}
 */
export function writeSchemas({ publicDir = PUBLIC_DIR, schemaOutDir = SCHEMA_OUT_DIR } = {}) {
  const versionsByDraft = listVersions();
  /** @type {Map<string, string>} `${draft}/${version}` → serialized schema */
  const serialized = new Map();
  const entries = [];

  for (const [draft, versions] of Object.entries(versionsByDraft)) {
    for (const version of versions) {
      const content = JSON.stringify(loadSchema(draft, version), null, 2);

      serialized.set(`${draft}/${version}`, content);

      if (!INCLUDED_DRAFTS.includes(draft)) {
        continue;
      }

      // Bundled copy consumed by the viewer via the manifest.
      writeFile(path.join(schemaOutDir, 'collection', draft, `${version}.json`), content);
      entries.push({
        resource: 'collection',
        label: RESOURCE_LABELS.collection,
        draft,
        version,
        status: statusForVersion(version),
        id: `collection/${draft}/${version}`
      });
    }
  }

  // Static copies at every hosted URL, incl. /collection/json/{version}/{draft}/collection.json.
  const { raw } = legacyUrls(versionsByDraft);

  for (const file of raw) {
    writeFile(path.join(publicDir, file.path), serialized.get(`${file.draft}/${file.version}`));
  }

  // Legacy docs URLs → 301, applied by Cloudflare before the assets and the Worker.
  writeFile(path.join(publicDir, '_redirects'), legacyRedirectsFile(versionsByDraft));

  return { entries, rawPaths: raw.map((f) => f.path) };
}

function main() {
  // Clean previous output.
  fs.rmSync(SCHEMA_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SCHEMA_OUT_DIR, { recursive: true });
  for (const resource of RESOURCE_ORDER) {
    fs.rmSync(path.join(PUBLIC_DIR, resource, 'json'), { recursive: true, force: true });
  }
  // Legacy /json/... layout.
  fs.rmSync(path.join(PUBLIC_DIR, 'json'), { recursive: true, force: true });

  const { entries, rawPaths } = writeSchemas();

  // Order by resource kind, then newest version first.
  entries.sort((a, b) => {
    const ra = RESOURCE_ORDER.indexOf(a.resource);
    const rb = RESOURCE_ORDER.indexOf(b.resource);

    if (ra !== rb) {
      return ra - rb;
    }

    return semver.rcompare(a.version, b.version);
  });

  // Pick a sensible default: latest stable collection, else first entry.
  const defaultEntry =
    entries.find((e) => e.resource === 'collection' && e.draft === DEFAULT_DRAFT && isStable(e.version)) ||
    entries.find((e) => isStable(e.version)) ||
    entries[0];

  writeManifest(entries, defaultEntry);

  console.info('\nGenerated %d schema(s) into %s', entries.length, path.relative(ROOT, SCHEMA_OUT_DIR));
  console.info('Wrote %d raw schema file(s) into %s', rawPaths.length, path.relative(ROOT, PUBLIC_DIR));
  console.info('Default schema: %s', defaultEntry ? defaultEntry.id : '(none)');
}

function writeManifest(entries, defaultEntry) {
  const lines = [];

  lines.push('// AUTO-GENERATED by scripts/generate-schemas.mjs — do not edit by hand.');
  lines.push('');
  lines.push('export interface SchemaEntry {');
  lines.push('  /** Resource kind, e.g. "collection" or "environment". */');
  lines.push('  resource: string;');
  lines.push('  /** Human-readable resource label, e.g. "Collection". */');
  lines.push('  label: string;');
  lines.push('  /** JSON Schema draft directory, e.g. "draft-07". */');
  lines.push('  draft: string;');
  lines.push('  /** Schema version, e.g. "v2.1.0". */');
  lines.push('  version: string;');
  lines.push('  /** Release status derived from the semver pre-release tag. */');
  lines.push("  status: 'stable' | 'rc' | 'draft' | string;");
  lines.push('  /** Stable identifier: `${resource}/${draft}/${version}`. */');
  lines.push('  id: string;');
  lines.push('  /** Lazily loads the compiled schema JSON (`$ref`s kept, not dereferenced). */');
  lines.push('  load: () => Promise<Record<string, unknown>>;');
  lines.push('}');
  lines.push('');
  lines.push('export const schemas: SchemaEntry[] = [');

  for (const e of entries) {
    const importPath = `./schemas/${e.resource}/${e.draft}/${e.version}.json`;

    lines.push('  {');
    lines.push(`    resource: ${JSON.stringify(e.resource)},`);
    lines.push(`    label: ${JSON.stringify(e.label)},`);
    lines.push(`    draft: ${JSON.stringify(e.draft)},`);
    lines.push(`    version: ${JSON.stringify(e.version)},`);
    lines.push(`    status: ${JSON.stringify(e.status)},`);
    lines.push(`    id: ${JSON.stringify(e.id)},`);
    lines.push(`    load: () => import(${JSON.stringify(importPath)}).then((m) => m.default as Record<string, unknown>),`);
    lines.push('  },');
  }

  lines.push('];');
  lines.push('');
  lines.push(`export const defaultSchemaId = ${JSON.stringify(defaultEntry ? defaultEntry.id : '')};`);
  lines.push('');
  lines.push('export function findSchema(');
  lines.push('  resource: string,');
  lines.push('  draft: string,');
  lines.push('  version: string,');
  lines.push('): SchemaEntry | undefined {');
  lines.push('  return schemas.find(');
  lines.push('    (s) => s.resource === resource && s.draft === draft && s.version === version,');
  lines.push('  );');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.ts'), lines.join('\n'));
}

// Only generate when run as a script, not when imported (e.g. by tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
