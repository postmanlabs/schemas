import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// lib/ is untyped CommonJS; load it with require (same as scripts/generate-schemas.mjs).
const require = createRequire(import.meta.url);

export type Draft = 'draft-04' | 'draft-07';

type JsonSchema = Record<string, unknown> & { definitions?: Record<string, unknown> };

interface Lib {
  validate(inputPath: string, schemaPath: string, schemaDirPath: string, draft: Draft): boolean;
  compile(schemaPath: string, schemaDirPath: string, draft: Draft): JsonSchema;
}

interface LibUtils {
  removeCommentsAndLoadJSON(path: string): JsonSchema;
}

interface AjvInstance {
  addMetaSchema(schema: object): AjvInstance;
  compile(schema: object): unknown;
}

type AjvConstructor = new (options: Record<string, unknown>) => AjvInstance;

export const lib: Lib = require('../lib');
export const utils: LibUtils = require('../lib/utils');
export const Ajv: AjvConstructor = require('ajv');

export const META_SCHEMA: Record<Draft, object> = {
  'draft-04': require('ajv/lib/refs/json-schema-draft-04.json'),
  'draft-07': require('ajv/lib/refs/json-schema-draft-07.json'),
};

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCHEMA_DIR = path.join(ROOT, 'schemas');
export const EXAMPLE_DIR = path.join(ROOT, 'examples');

const listDirs = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

export interface SchemaVersion {
  draft: Draft;
  version: string;
  schemaDir: string;
  schemaPath: string;
}

/** Every schemas/<draft>/<version> that has a collection.json. */
export function schemaVersions(): SchemaVersion[] {
  return listDirs(SCHEMA_DIR).flatMap((draft) =>
    listDirs(path.join(SCHEMA_DIR, draft))
      .map((version) => {
        const schemaDir = path.join(SCHEMA_DIR, draft, version);

        return { draft: draft as Draft, version, schemaDir, schemaPath: path.join(schemaDir, 'collection.json') };
      })
      .filter((v) => fs.existsSync(v.schemaPath)),
  );
}

export interface ExampleCase extends SchemaVersion {
  name: string;
  examplePath: string;
}

/** Every examples/<draft>/<version>/*.json, paired with its schema. */
export function exampleCases(): ExampleCase[] {
  return listDirs(EXAMPLE_DIR).flatMap((draft) =>
    listDirs(path.join(EXAMPLE_DIR, draft)).flatMap((version) => {
      const exampleDir = path.join(EXAMPLE_DIR, draft, version);
      const schemaDir = path.join(SCHEMA_DIR, draft, version);

      return fs
        .readdirSync(exampleDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((name) => ({
          draft: draft as Draft,
          version,
          schemaDir,
          schemaPath: path.join(schemaDir, 'collection.json'),
          name,
          examplePath: path.join(exampleDir, name),
        }));
    }),
  );
}

/** Ajv configured exactly like lib.validate. */
export function createAjv(draft: Draft): AjvInstance {
  const ajv = new Ajv({
    schemaId: draft === 'draft-04' ? 'id' : '$id',
    meta: false, // don't add the draft-06 meta-schema
    allErrors: true,
  });

  ajv.addMetaSchema(META_SCHEMA[draft]);

  return ajv;
}
