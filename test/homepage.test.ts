import { describe, it, expect } from 'vitest';
import { docsLink, groupByResource, homepageGroups, NEW_TAB, rawPath, type HomepageEntry } from '../src/lib/homepage';

// Newest first, like the generated manifest; a second resource interleaved.
const entries: HomepageEntry[] = [
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v3.0.0' },
  { resource: 'environment', label: 'Environment', draft: 'draft-07', version: 'v1.0.0' },
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v2.2.0-rc.1' },
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v2.1.0' },
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v2.0.0' },
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v1.0.0' },
];

describe('groupByResource', () => {
  it('groups by resource in first-seen order, keeping the newest-first order', () => {
    const groups = groupByResource(entries);

    expect(groups.map((g) => [g.resource, g.label])).toEqual([
      ['collection', 'Collection'],
      ['environment', 'Environment'],
    ]);
    expect(groups[0].entries.map((e) => e.version)).toEqual([
      'v3.0.0',
      'v2.2.0-rc.1',
      'v2.1.0',
      'v2.0.0',
      'v1.0.0',
    ]);
    expect(groups[1].entries.map((e) => e.version)).toEqual(['v1.0.0']);
  });

  it('returns no groups for an empty manifest', () => {
    expect(groupByResource([])).toEqual([]);
  });
});

describe('homepageGroups', () => {
  it('lists only v3.0.0 and v2.1.0, newest first, still grouped by resource', () => {
    const groups = homepageGroups(entries);

    expect(groups.map((g) => g.resource)).toEqual(['collection']);
    expect(groups[0].entries.map((e) => e.version)).toEqual(['v3.0.0', 'v2.1.0']);
  });

  it('skips a listed version that is missing from the manifest', () => {
    const withoutV21 = entries.filter((e) => e.version !== 'v2.1.0');

    expect(homepageGroups(withoutV21)[0].entries.map((e) => e.version)).toEqual(['v3.0.0']);
    expect(homepageGroups([])).toEqual([]);
  });
});

describe('links', () => {
  it('points to the draft-07 viewer page and the raw schema', () => {
    // Exactly what index.tsx spreads onto <Link>; filled in, it's the viewer URL.
    const link = docsLink(entries[0]);
    expect(link).toEqual({
      to: '/$resource/json/$version/$draft/docs/index.html',
      params: { resource: 'collection', version: 'v3.0.0', draft: 'draft-07' },
      target: '_blank',
      rel: 'noopener',
    });
    expect(link.to.replace(/\$(\w+)/g, (_, k: keyof typeof link.params) => link.params[k])).toBe(
      '/collection/json/v3.0.0/draft-07/docs/index.html',
    );
    expect(rawPath(entries[0])).toBe('/collection/json/v3.0.0/draft-07/collection.json');
    expect(rawPath(entries[1])).toBe('/environment/json/v1.0.0/draft-07/environment.json');
  });

  it('opens both links in a new tab', () => {
    // index.tsx spreads NEW_TAB onto the raw <a>; docsLink already includes it.
    expect(NEW_TAB).toEqual({ target: '_blank', rel: 'noopener' });
    expect(docsLink(entries[0])).toMatchObject(NEW_TAB);
  });
});
