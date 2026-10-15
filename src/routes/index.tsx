import { createFileRoute, Link } from '@tanstack/react-router';
import { schemas } from '../generated/manifest';
import { docsLink, homepageGroups, NEW_TAB, rawPath } from '../lib/homepage';

export const Route = createFileRoute('/')({
  component: Homepage,
});

function Homepage() {
  const groups = homepageGroups(schemas);

  return (
    <div className="homepage">
      <h1>Documentation for the various versions of Postman Schemas</h1>

      {groups.length === 0 ? (
        <p className="empty-state">No schemas have been generated yet.</p>
      ) : (
        groups.map((group) => (
          <section key={group.resource} aria-labelledby={`${group.resource}-heading`}>
            <h2 id={`${group.resource}-heading`}>{group.label}s</h2>
            {/* Too wide for 320px screens: scroll inside a focusable region. */}
            <div className="table-scroll" tabIndex={0} role="region" aria-label={`${group.label} versions`}>
              <table className="homepage-table">
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Documentation</th>
                    <th scope="col">Raw Schema</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <code>{entry.version}</code>
                      </td>
                      <td>
                        {/* New tab, full load: the docs pages are prerendered HTML (and no preload). */}
                        <Link reloadDocument {...docsLink(entry)}>
                          View documentation
                        </Link>
                      </td>
                      <td>
                        <a href={rawPath(entry)} {...NEW_TAB}>
                          JSON Schema
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
