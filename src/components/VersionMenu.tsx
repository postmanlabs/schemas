import { Menu } from '@base-ui/react/menu';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { schemas } from '../generated/manifest';
import { prefetchSchemaTree } from '../lib/schemaTree';

// Imported only by the docs route, so Base UI stays in that chunk (the viewer
// already bundles Menu there) and out of the root/entry chunk.
export default function VersionMenu({
  resource,
  draft,
  version,
}: {
  resource: string;
  draft: string;
  version: string;
}) {
  const queryClient = useQueryClient();
  // The manifest is already sorted newest first per resource.
  const entries = schemas.filter((s) => s.resource === resource && s.draft === draft);

  if (entries.length < 2) {
    return <code>{version}</code>;
  }

  return (
    <Menu.Root>
      <Menu.Trigger className="version-trigger" aria-label={`Version ${version}, change version`}>
        {/* The same <code> badge as the single-version case, so the look matches exactly. */}
        <code>
          {version}
          <svg className="version-trigger__icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </code>
      </Menu.Trigger>
      <Menu.Portal className="version-menu-portal">
        <Menu.Positioner className="version-menu-positioner" side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className="version-menu">
            {entries.map((entry) => {
              const current = entry.version === version;
              return (
                <Menu.LinkItem
                  key={entry.id}
                  className="version-menu__item"
                  // LinkItem defaults to staying open; the route stays mounted on a
                  // version switch, so close explicitly.
                  closeOnClick
                  aria-current={current ? 'page' : undefined}
                  // Build the schema tree in a Web Worker ahead of the click.
                  onMouseEnter={() => prefetchSchemaTree(queryClient, entry)}
                  onFocus={() => prefetchSchemaTree(queryClient, entry)}
                  render={
                    <Link
                      to="/$resource/json/$version/$draft/docs/index.html"
                      params={{ resource: entry.resource, version: entry.version, draft: entry.draft }}
                    />
                  }
                >
                  <span className="version-menu__check" aria-hidden="true">
                    {current ? '✓' : null}
                  </span>
                  {entry.version}
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
