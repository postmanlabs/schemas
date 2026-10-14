import { defineConfig } from 'tsup';

export default defineConfig({
  // `worker` is a React-free entry meant to run inside a Web Worker; keeping it
  // separate avoids pulling React into the worker bundle.
  entry: ['src/index.ts', 'src/worker.ts'],
  format: ['esm'],
  // Emit .d.ts so the package is consumable with full types.
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // react/react-dom are peers; all runtime deps (from package.json `dependencies`)
  // are externalized by tsup automatically, so consumers dedupe a single copy.
  external: ['react', 'react-dom'],
});
