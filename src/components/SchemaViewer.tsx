import { JsonSchemaViewer, type PrebuiltSchemaTree } from '@postman/json-schema-viewer';
import type { JSONSchema7 } from 'json-schema';
import { useQuery } from '@tanstack/react-query';
// Static, Aether-token stylesheet shipped by the fork. It replaces Mosaic's runtime
// styled-components CSS, so the viewer is fully styled in the SSR HTML (no flash /
// unstyled paint on hydration). Layout/color come from inline styles; this file
// covers markdown + interactive controls.
import '@postman/json-schema-viewer/styles.css';
import { schemaTreeQueryOptions } from '../lib/schemaTree';

export default function SchemaViewer({
  name,
  schema,
  schemaId,
  initialData,
}: {
  name: string;
  schema: Record<string, unknown>;
  schemaId: string;
  /** Tree built during SSR and transferred to the client to seed the query cache. */
  initialData?: PrebuiltSchemaTree;
}) {
  // On the client, prefer a tree built off the main thread (via the Web Worker),
  // shared through React Query so a version-menu hover-prefetch makes this render instant.
  // `initialData` (built during SSR) seeds the cache so the first client render uses it
  // directly — no rebuild, and it matches the SSR HTML. Without it (client navigations),
  // the query is disabled/pending and the viewer builds synchronously from `schema`.
  const { data: tree } = useQuery({
    ...schemaTreeQueryOptions(schemaId, () => schema as unknown as JSONSchema7),
    enabled: typeof window !== 'undefined',
    initialData,
  });

  return (
    <JsonSchemaViewer
      name={name}
      schema={schema as JSONSchema7}
      tree={tree}
      defaultExpandedDepth={0}
      emptyText="No schema defined"
    />
  );
}
