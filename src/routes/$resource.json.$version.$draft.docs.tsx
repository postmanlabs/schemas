import { Outlet, createFileRoute } from '@tanstack/react-router';

// Layout for the hosted docs URL scheme:
//   /{resource}/json/{version}/{draft}/docs/index.html
export const Route = createFileRoute(
  '/$resource/json/$version/$draft/docs',
)({
  component: () => <Outlet />,
});
