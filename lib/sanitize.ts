import sanitizeHtml from 'sanitize-html';

/**
 * §7 rich text: memorial HTML is sanitised server-side with a strict allowlist
 * before storage AND again before render. Twice, deliberately — the stored
 * value may predate a tightening of this list, and the render-time pass is what
 * actually protects the reader.
 *
 * The allowlist is small on purpose. This is a page of family text and
 * photographs; it does not need tables, forms, iframes or classes.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 'blockquote',
    'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
  },
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https', 'data'] },
  // Links out of a memorial page should not be able to reach back into it.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeMemorialHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
