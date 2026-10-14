/**
 * Renders a schema description as markdown.
 *
 * Replaces `@stoplight/markdown-viewer` (which pulled in Mosaic + a React runtime
 * renderer) with `markdown-it`, a pure, SSR-safe markdown→HTML compiler. The output
 * is styled statically via `.jsv-description` (see styles.css) using Aether tokens.
 * `html: false` keeps embedded raw HTML in descriptions from being injected.
 */
import MarkdownIt from 'markdown-it';
import * as React from 'react';

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export const Description: React.FunctionComponent<{ value: unknown }> = ({ value }) => {
  const [showAll, setShowAll] = React.useState(false);

  if (typeof value !== 'string' || value.trim().length === 0) return null;

  const paragraphs = value.split('\n\n');

  if (paragraphs.length <= 1 || showAll) {
    return (
      <div
        className="jsv-description"
        data-test="property-description"
        dangerouslySetInnerHTML={{ __html: md.render(value) }}
      />
    );
  }

  return (
    <div className="jsv-description" data-test="property-description">
      <span dangerouslySetInnerHTML={{ __html: md.renderInline(paragraphs[0]) }} />{' '}
      <button type="button" className="jsv-description__more" onClick={() => setShowAll(true)}>
        Show all...
      </button>
    </div>
  );
};
