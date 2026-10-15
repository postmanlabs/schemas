/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { INTER_PRELOAD_HREFS } from '../lib/fonts';

// Emitted byte-for-byte as content-hashed files under /assets/ (served
// immutable). `no-inline` keeps them real files even below assetsInlineLimit
// (the logo is 4063 B), so they are never inlined as data: URIs.
import postmanLogo from '../assets/postman-logo-orange.svg?url&no-inline';
// Postman analytics (pmt) SDK — restored from the legacy hosted docs. `?url`
// copies it as-is (not bundled or minified); configured for "schemas" below.
import pmtSdkSrc from '../assets/pmt-sdk.js?url&no-inline';

const pmtConfigScript = `if (location.hostname !== 'localhost' && typeof window.pmt === 'function') {
  window.pmt('setScalp', [{ property: 'schemas' }]);
  window.pmt('scalp', ['pm-analytics', 'load', document.location.pathname]);
  window.pmt('trackClicks', []);
}`;

import appCss from '../styles/app.css?url';
import { usePreferredColorScheme } from '@reactuses/core';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Postman Schemas' },
      {
        name: 'description',
        content:
          "Browse Postman's JSON Schemas",
      },
    ],
    links: [
      // Modern browsers prefer the crisp SVG; .ico/.png are fallbacks. Generated
      // from the Postman logo SVG by scripts/generate-favicon.mjs.
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/svg+xml', href: postmanLogo },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      // Fetch the above-the-fold Inter faces in parallel with app.css instead of
      // after it parses. crossOrigin is required (fonts are CORS fetches) or the
      // browser downloads each font twice.
      ...INTER_PRELOAD_HREFS.map((href) => ({
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous' as const,
        href,
      })),
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

// Sticky (see .topbar in app.css); the dropdown portals sit above it at z-index 1000.
function TopBar() {
  return (
    <header className="topbar">
      <div className="layout__content topbar__inner">
        {/* Out of the tab order: keyboard users reach the wordmark link first;
            the logo stays clickable and keeps its alt text. */}
        <a
          href="https://www.getpostman.com"
          className="brand__logo-link"
          target="_blank"
          rel="noopener"
          tabIndex={-1}
        >
          <img className="brand__logo" src={postmanLogo} alt="Postman" />
        </a>
        {/* `/` is the homepage: every schema version. */}
        <Link reloadDocument to="/" className="brand">
          Postman Schemas
        </Link>
      </div>
    </header>
  );
}

// A sibling of <main> (not inside it) so it keeps the implicit contentinfo
// landmark role. Static: no position/z-index, so popups stack above.
function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="layout__content site-footer__inner">
        {/* The year comes from the server render; ignore a rollover mismatch. */}
        <span suppressHydrationWarning>© {new Date().getFullYear()} Postman, Inc.</span>
        <span>All Rights Reserved</span>
      </div>
    </footer>
  );
}

function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>
        <Link reloadDocument to="/" className="schema-link">
          View all schemas
        </Link>
      </p>
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
    const theme = usePreferredColorScheme();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body data-theme={theme}>
        <div className="layout">
          <TopBar />
          <main className="layout__main">
            <div className="layout__content">{children}</div>
          </main>
          <SiteFooter />
        </div>
        {/* Postman analytics SDK + config (restored from the legacy hosted docs). */}
        <script id="pmtSDK" src={pmtSdkSrc} />
        <script dangerouslySetInnerHTML={{ __html: pmtConfigScript }} />
        <Scripts />
      </body>
    </html>
  );
}
