/**
 * Legacy schema URLs served by the old docson site (schema.getpostman.com /
 * schema.postman.com), restored so existing links and `info.schema` URLs keep
 * working. Pure (no I/O): shared by scripts/generate-schemas.mjs (writes the raw
 * copies), vite.config.ts (Nitro 301 routeRules) and test/legacy-urls.test.ts.
 *
 * Scope matches what production serves today (v{major} aliases, index.json and
 * directory URLs 403 there, so they are not recreated):
 *   raw JSON (static copies, 200):
 *     draft-04: /json/collection/{v}/collection.json, /collection/json/{v}/draft-04/collection.json
 *     draft-07: /json/draft-07/collection/{v}/collection.json (+ the viewer's own
 *               /collection/json/{v}/draft-07/collection.json)
 *     "latest" variants of all of the above.
 *   docs HTML (301): the matching .../docs/index.html URLs → the draft-07 viewer
 *     page for that version, or the version's raw JSON when no viewer page
 *     exists; /index.html → /.
 *
 * Kept free of TS-only runtime syntax so Node can run it with type stripping.
 */

/** The only draft rendered by the viewer (see INCLUDED_DRAFTS in generate-schemas.mjs). */
export const VIEWER_DRAFT = 'draft-07';

const RESOURCE = 'collection';

export interface RawFile {
  /** URL path, e.g. "/json/collection/v2.1.0/collection.json". */
  path: string;
  draft: string;
  /** Concrete version whose content is served (aliases resolved). */
  version: string;
}

export interface LegacyUrls {
  raw: RawFile[];
  /** Exact source path → target path, all 301. */
  redirects: Record<string, string>;
}

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/;

/** The single "latest" rule: highest semver-stable version (pre-releases never win). */
export function latestStable(versions: string[]): string | undefined {
  const key = (v: string): number[] => (STABLE.exec(v) ?? []).slice(1).map(Number);
  const cmp = (a: string, b: string): number => {
    const [x, y] = [key(a), key(b)];

    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  };

  return versions.filter((v) => STABLE.test(v)).sort(cmp).at(-1);
}

/** Old docson layout: draft-04 was the unprefixed default. */
const legacyBase = (draft: string, v: string): string =>
  draft === 'draft-04' ? `/json/${RESOURCE}/${v}` : `/json/${draft}/${RESOURCE}/${v}`;

/** Current layout (also the viewer's layout for VIEWER_DRAFT). */
const newBase = (draft: string, v: string): string => `/${RESOURCE}/json/${v}/${draft}`;

export const viewerPage = (version: string): string => `${newBase(VIEWER_DRAFT, version)}/docs/index.html`;

/**
 * @param versionsByDraft every schemas/{draft}/{version} directory, e.g. { "draft-04": ["v2.1.0", ...] }.
 */
export function legacyUrls(versionsByDraft: Record<string, string[]>): LegacyUrls {
  const viewerVersions = new Set(versionsByDraft[VIEWER_DRAFT] ?? []);
  const viewerPages = new Set([...viewerVersions].map(viewerPage));
  const raw: RawFile[] = [];
  const redirects: Record<string, string> = { '/index.html': '/' };

  for (const [draft, versions] of Object.entries(versionsByDraft)) {
    const latest = latestStable(versions);
    const aliases: [string, string][] = versions.map((v) => [v, v]);

    if (latest) {
      aliases.push(['latest', latest]);
    }

    for (const [alias, version] of aliases) {
      const target = viewerVersions.has(version)
        ? viewerPage(version)
        : `${newBase(draft, version)}/${RESOURCE}.json`;

      for (const base of [legacyBase(draft, alias), newBase(draft, alias)]) {
        raw.push({ path: `${base}/${RESOURCE}.json`, draft, version });

        const docs = `${base}/docs/index.html`;

        // Never shadow a real viewer page.
        if (!viewerPages.has(docs)) {
          redirects[docs] = target;
        }
      }
    }
  }

  return { raw, redirects };
}

/**
 * Nitro `routeRules` for the legacy docs redirects (exact-path keys). h3 v2 reads
 * `redirect.status`; `statusCode` (still shown in the Nitro docs) is ignored → 307.
 */
export function legacyRouteRules(
  versionsByDraft: Record<string, string[]>,
): Record<string, { redirect: { to: string; status: 301 } }> {
  return Object.fromEntries(
    Object.entries(legacyUrls(versionsByDraft).redirects).map(([from, to]) => [
      from,
      { redirect: { to, status: 301 as const } },
    ]),
  );
}
