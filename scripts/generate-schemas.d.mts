// Types for the parts of generate-schemas.mjs imported by TypeScript (tests);
// the root tsconfig has allowJs: false.
export interface SchemaEntry {
  resource: string;
  label: string;
  draft: string;
  version: string;
  status: string;
  id: string;
}

export function writeSchemas(dirs?: { publicDir?: string; schemaOutDir?: string }): {
  entries: SchemaEntry[];
  rawPaths: string[];
};
