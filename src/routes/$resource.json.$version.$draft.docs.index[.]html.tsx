import * as React from 'react';
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { findSchema } from '../generated/manifest';
import SchemaViewer from '../components/SchemaViewer';
import VersionMenu from '../components/VersionMenu';
import { deserializeSchemaTree, type SerializedSchemaTree } from '../lib/schemaTree';

// The Stoplight viewer lives in the workspace package `@postman/json-schema-viewer`,
// an SSR-safe fork (see its hash.ts / lodashLite.ts).
//
// Canonical public host these schemas are served from.
const SCHEMA_BASE_URL = 'https://schema.postman.com';

function schemaJsonUrl({ resource, version, draft }: { resource: string; version: string; draft: string }) {
  return `${SCHEMA_BASE_URL}/${resource}/json/${version}/${draft}/${resource}.json`;
}

export const Route = createFileRoute(
  '/$resource/json/$version/$draft/docs/index.html',
)({
  loader: async ({ params }) => {
    const entry = findSchema(params.resource, params.draft, params.version);

    if (!entry) {
      throw notFound();
    }

    // Docs pages are server-rendered/prerendered only: turn any client navigation
    // into a full page load, so the tree is never built in the browser. Hydration
    // doesn't re-run the loader, so this can't loop.
    if (!import.meta.env.SSR) {
      throw redirect({ to: '/$resource/json/$version/$draft/docs/index.html', params, reloadDocument: true });
    }

    // Build the tree on the server; the client only deserialises it.
    const schema = await entry.load();
    const { buildSerializedSchemaTree } = await import('../lib/schemaTree.server');
    const initialTree: SerializedSchemaTree = buildSerializedSchemaTree(schema as never);

    return {
      initialTree,
      resource: entry.resource,
      label: entry.label,
      draft: entry.draft,
      version: entry.version,
    };
  },
  // The most-nested title wins, so this overrides the root's "Postman Schemas".
  // Without loaderData (not found, or the loader threw) the page keeps the root
  // title.
  head: ({ loaderData }) =>
    loaderData
      ? { meta: [{ title: `Postman ${loaderData.label} Format ${loaderData.version} Schema Documentation` }] }
      : {},
  component: SchemaPage,
  errorComponent: SchemaError,
  notFoundComponent: () => (
    <div className="empty-state">
      <h1>Schema not found</h1>
      <p>
        <Link reloadDocument to="/" className="schema-link">
          View all schemas
        </Link>
      </p>
    </div>
  ),
});

function SchemaPage() {
  const { initialTree, resource, label, version, draft } = Route.useLoaderData();

  // Rebuild the server-built tree (cheap: no $ref/allOf work).
  const tree = React.useMemo(() => deserializeSchemaTree(initialTree), [initialTree]);

  const schemaHref = schemaJsonUrl({ resource, version, draft });

  return (
    <div className="schema-page">
      <header className="schema-page__header">
        <div className="schema-page__title">
          <h1>
            {label} <VersionMenu resource={resource} draft={draft} version={version} />
          </h1>
          <a
            className="schema-link"
            href={schemaHref}
            target="_blank"
            rel="noopener"
          >
            {schemaHref}
          </a>
        </div>
      </header>

      <div className="schema-page__viewer">
        <SchemaViewer name={`${label} ${version}`} tree={tree} />
      </div>
    </div>
  );
}

// Rendered inside the app layout (top bar stays) when the loader or the page
// throws — on the server, or on the client (e.g. a JS chunk that failed to load
// after a redeploy) — instead of TanStack's unstyled default.
function SchemaError({ error }: ErrorComponentProps) {
  const params = Route.useParams();
  const [retrying, setRetrying] = React.useState(false);
  const schemaHref = schemaJsonUrl(params);
  const message = error instanceof Error ? error.message : String(error);
  const label = findSchema(params.resource, params.draft, params.version)?.label ?? params.resource;

  // The page is built on the server, so a full reload is the retry (it also
  // clears a cached failed chunk import after a redeploy).
  const retry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <div className="error-state">
      <h1>Couldn&rsquo;t load this schema</h1>
      <p role="alert">
        Something went wrong while loading {label} <code>{params.version}</code> ({params.draft}).
        Check your connection and try again, or reload the page if it keeps happening.
      </p>
      <div className="error-state__actions">
        <button type="button" className="error-state__retry" onClick={retry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
        <a className="schema-link" href={schemaHref} target="_blank" rel="noopener">
          View raw JSON
        </a>
        <Link reloadDocument to="/" className="schema-link">
          View all schemas
        </Link>
      </div>
      <details className="error-state__details">
        <summary>Technical details</summary>
        <pre>{message}</pre>
      </details>
    </div>
  );
}
