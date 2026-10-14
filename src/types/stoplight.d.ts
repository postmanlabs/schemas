// Allow importing the viewer's static stylesheet for its side effects. The viewer
// comes from the workspace package `@postman/json-schema-viewer`, which ships a
// plain, Aether-token CSS file (no Mosaic / runtime style injection) that the app
// imports directly (see components/SchemaViewer.tsx).
declare module '@postman/json-schema-viewer/styles.css';
