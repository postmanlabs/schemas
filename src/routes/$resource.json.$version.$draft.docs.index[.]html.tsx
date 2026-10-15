import * as React from 'react';
import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
  useRouterState,
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

    const schema = await entry.load();

    // Build the tree once on the server so React Query can hydrate with it on the
    // client instead of rebuilding on the main thread. Skipped on client-side
    // navigations (import.meta.env.SSR === false), which use the worker/prefetch path.
    let initialTree: SerializedSchemaTree | undefined;
    if (import.meta.env.SSR) {
      const { buildSerializedSchemaTree } = await import('../lib/schemaTree.server');
      initialTree = buildSerializedSchemaTree(schema as never);
    }

    return {
      schema,
      id: entry.id,
      initialTree,
      resource: entry.resource,
      label: entry.label,
      draft: entry.draft,
      version: entry.version,
    };
  },
  component: SchemaPage,
  errorComponent: SchemaError,
  notFoundComponent: () => (
    <div className="empty-state">
      <h1>Schema not found</h1>
      <p>
        <Link to="/" className="schema-link">
          View latest schema
        </Link>
      </p>
    </div>
  ),
});

function SchemaPage() {
  const { schema, id, initialTree, resource, label, version, draft } = Route.useLoaderData();

  // Rebuild the SSR-transferred tree (cheap) to seed React Query as initial data.
  const initialData = React.useMemo(
    () => (initialTree ? deserializeSchemaTree(initialTree) : undefined),
    [initialTree],
  );

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
        <SchemaViewer name={`${label} ${version}`} schema={schema} schemaId={id} initialData={initialData} />
      </div>
    </div>
  );
}

// Rendered inside the app layout (top bar stays) when the loader or the page
// throws — typically a schema chunk that failed to load (e.g. hashed files
// replaced by a redeploy) — instead of TanStack's unstyled default.
// Chunk/dynamic-import failures (Chrome, Firefox, Safari wording). Firefox and
// Safari cache a failed dynamic import, so after a redeploy only a full reload helps.
const CHUNK_ERROR_RE = new RegExp(
  [
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Importing a module script failed',
  ].join('|'),
  'i',
);

function SchemaError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const params = Route.useParams();
  // invalidate() remounts this boundary immediately, so local state alone can't
  // hold the pending flag; the router's loading state covers the reload.
  const [reloading, setReloading] = React.useState(false);
  const loading = useRouterState({ select: (s) => s.isLoading });
  const retrying = reloading || loading;
  const schemaHref = schemaJsonUrl(params);
  const message = error instanceof Error ? error.message : String(error);
  const label = findSchema(params.resource, params.draft, params.version)?.label ?? params.resource;

  const retry = () => {
    if (CHUNK_ERROR_RE.test(message)) {
      setReloading(true);
      window.location.reload();
      return;
    }
    // invalidate() re-runs the loader and resets the error boundary.
    void router.invalidate();
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
        <Link to="/" className="schema-link">
          View latest schema
        </Link>
      </div>
      <details className="error-state__details">
        <summary>Technical details</summary>
        <pre>{message}</pre>
      </details>
    </div>
  );
}
