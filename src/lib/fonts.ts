// Inter faces preloaded from the root route's head(). Vite gives these imports
// the same hashed URLs as the woff2 url()s in the @font-face blocks in
// src/styles/app.css (same file, same hash). 600 is not preloaded: it is only
// used below the fold or inside popups.
import inter400 from '../assets/fonts/inter-latin-400-normal.woff2?url';
import inter700 from '../assets/fonts/inter-latin-700-normal.woff2?url';

export const INTER_PRELOAD_HREFS = [inter400, inter700] as const;
