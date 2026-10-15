import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyRouteRules, viewerPage, VIEWER_DRAFT } from './scripts/legacy-urls';

// Legacy docs URLs → 301. Computed from schemas/ directly so `vite dev` works
// without a prior generate.
const listDirs = (dir: string) =>
  fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const SCHEMA_DIR = fileURLToPath(new URL('./schemas', import.meta.url));
const versionsByDraft = Object.fromEntries(
  listDirs(SCHEMA_DIR).map((draft) => [draft, listDirs(path.join(SCHEMA_DIR, draft))]),
);
const routeRules = legacyRouteRules(versionsByDraft);

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    // Base UI imports the CJS `use-sync-external-store/shim`. Bundled in the SSR
    // pass, its `require('react')` (react is external there) survives as a
    // runtime `__require("react")`, which workerd can't resolve ("No such module
    // react"). Externalized here, Nitro's final bundle handles it like React
    // itself. Needs the package as a direct dependency so it can be externalized.
    external: ['use-sync-external-store'],
  },
  build: {
    // Always minify CSS (strips comments/whitespace) regardless of the JS
    // `minify` setting. `cssMinify` otherwise defaults to `build.minify`, so
    // pinning it keeps our token/theme CSS comment-free in every build.
    cssMinify: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: 'src',
      // Static HTML for the docs pages, served by Cloudflare as Workers assets
      // without running the Worker. Cloudflare build only: production runs on
      // Workers, and the Node build hangs after prerendering.
      prerender: {
        enabled: process.env.NITRO_PRESET === 'cloudflare_module',
        autoStaticPathsDiscovery: false, // else `/` (a redirect) is written as /index.html
        crawlLinks: false,
        failOnError: true,
      },
      pages: (versionsByDraft[VIEWER_DRAFT] ?? []).map((v) => ({ path: viewerPage(v) })),
    }),
    viteReact(),
    nitro({
      // Deploy target is driven by NITRO_PRESET so local `dev`/`build` stay on
      // the Node preset, while `build:cf` sets `cloudflare_module` to emit a
      // Cloudflare Workers bundle (.output/server + .output/public) and the
      // generated deploy config .output/server/wrangler.json.
      preset: process.env.NITRO_PRESET,
      // Required by the Cloudflare (workerd) runtime; also enables nodejs_compat.
      compatibilityDate: '2025-09-14',
      routeRules,
    }),
  ],
});
