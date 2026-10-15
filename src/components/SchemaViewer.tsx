import { JsonSchemaViewer, type PrebuiltSchemaTree } from '@postman/json-schema-viewer';
// Static, Aether-token stylesheet shipped by the fork. It replaces Mosaic's runtime
// styled-components CSS, so the viewer is fully styled in the SSR HTML (no flash /
// unstyled paint on hydration). Layout/color come from inline styles; this file
// covers markdown + interactive controls.
import '@postman/json-schema-viewer/styles.css';

/** Renders the tree built on the server (SSR/prerender) and deserialised on the client. */
export default function SchemaViewer({ name, tree }: { name: string; tree: PrebuiltSchemaTree }) {
  return (
    <JsonSchemaViewer
      name={name}
      tree={tree}
      defaultExpandedDepth={0}
      emptyText="No schema defined"
    />
  );
}
