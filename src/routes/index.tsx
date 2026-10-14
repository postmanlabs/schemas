import { createFileRoute, redirect } from '@tanstack/react-router';
import { defaultSchemaId } from '../generated/manifest';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const [resource, draft, version] = defaultSchemaId.split('/');

    if (resource && draft && version) {
      throw redirect({
        to: '/$resource/json/$version/$draft/docs/index.html',
        params: { resource, draft, version },
      });
    }
  },
  component: () => (
    <div className="empty-state">
      <h1>Postman Schemas</h1>
      <p>No schemas have been generated yet.</p>
    </div>
  ),
});
