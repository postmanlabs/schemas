import { createFileRoute, redirect } from '@tanstack/react-router';

// Bare `/{resource}/json/{version}/{draft}/docs` (and trailing slash) redirects
// to the canonical `index.html` URL used by the hosted docs.
export const Route = createFileRoute(
  '/$resource/json/$version/$draft/docs/',
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$resource/json/$version/$draft/docs/index.html',
      params,
    });
  },
});
