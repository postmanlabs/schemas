import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { viewerPage, VIEWER_DRAFT, withHomepageRewrite } from './scripts/legacy-urls';

// Prerendered docs pages, computed from schemas/ directly so `vite dev` works
// without a prior generate.
const listDirs = (dir: string) =>
  fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const SCHEMA_DIR = fileURLToPath(new URL('./schemas', import.meta.url));
const versionsByDraft = Object.fromEntries(
  listDirs(SCHEMA_DIR).map((draft) => [draft, listDirs(path.join(SCHEMA_DIR, draft))]),
);
const BUILT_REDIRECTS = fileURLToPath(new URL('./dist/client/_redirects', import.meta.url));

export default defineConfig({
  server: {
    port: 3000,
  },
  // The prerender step starts this preview server and fetches it on
  // 127.0.0.1. On Linux `localhost` can resolve to ::1 first, so the server
  // would listen on IPv6 only and the build fails with ECONNREFUSED
  // (reproduced in node:24-bookworm). Bind to 127.0.0.1 explicitly.
  preview: {
    host: '127.0.0.1',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Always minify CSS (strips comments/whitespace) regardless of the JS
    // `minify` setting. `cssMinify` otherwise defaults to `build.minify`, so
    // pinning it keeps our token/theme CSS comment-free in every build.
    cssMinify: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      srcDirectory: 'src',
      // Static HTML for the homepage and the docs pages, served by Cloudflare as
      // Workers assets without running the Worker (`/` via the `_redirects` rewrite).
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false, // explicit page list; `/` is listed in `pages`
        crawlLinks: false,
        failOnError: true,
      },
      pages: [
        {
          path: '/',
          // Serve the new dist/client/index.html for `/` (see withHomepageRewrite).
          prerender: {
            onSuccess: () => {
              fs.writeFileSync(BUILT_REDIRECTS, withHomepageRewrite(fs.readFileSync(BUILT_REDIRECTS, 'utf8')));
            },
          },
        },
        ...(versionsByDraft[VIEWER_DRAFT] ?? []).map((v) => ({ path: viewerPage(v) })),
      ],
    }),
    viteReact(),
  ],
});
