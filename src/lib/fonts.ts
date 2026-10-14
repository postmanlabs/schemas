// Inter faces preloaded from the root route's head(). These must match the
// woff2 URLs in the @font-face blocks in src/styles/app.css. 600 is not
// preloaded: it is only used below the fold or inside popups.
export const INTER_PRELOAD_HREFS = [
  '/assets/fonts/inter-latin-400-normal.woff2',
  '/assets/fonts/inter-latin-700-normal.woff2',
] as const;
