import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Emit .d.ts so the package is consumable with full types.
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // All runtime deps (from package.json `dependencies`) are externalized by tsup
  // automatically, so consumers dedupe a single copy.
  //
  // Exception: @stoplight/json-schema-merge-allof (and its json-schema-compare
  // dependency) are CommonJS and use deep requires such as `require('lodash/compact')`.
  // Left external, the downstream Cloudflare (workerd) build keeps those as runtime
  // `__require("lodash/*.js")` calls and every SSR page 500s with
  // `No such module "lodash/compact.js"`. Bundling them here turns the whole CJS
  // graph (merge-allof, json-schema-compare, compute-lcm, lodash modules) into
  // inlined code in our ESM output, so no CJS requires reach the app bundle.
  noExternal: ['@stoplight/json-schema-merge-allof'],
});
