/**
 * Simple markdown to HTML renderer — no external dependencies.
 * KSA-93 Phase 7: Renders help content markdown.
 * Supports: headings, bold, italic, lists, code, links, paragraphs.
 */

/** Render markdown string to sanitized HTML. */
export function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    if (trimmed.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 style="font-size:.75rem;margin:12px 0 6px;color:var(--color-text-accent)">${inline(trimmed.slice(3))}</h3>`;
    } else if (trimmed.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2 style="font-size:.8rem;margin:12px 0 6px;color:var(--color-text-accent)">${inline(trimmed.slice(2))}</h2>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { html += '<ul style="padding-left:16px;margin:4px 0">'; inList = true; }
      html += `<li style="font-size:.7rem;margin:2px 0;color:var(--color-text-secondary)">${inline(trimmed.slice(2))}</li>`;
    } else if (trimmed.startsWith('```')) {
      // Skip code fences (simplified)
      continue;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="font-size:.7rem;margin:4px 0;color:var(--color-text-secondary);line-height:1.5">${inline(trimmed)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

/** Process inline markdown: bold, italic, code, links. */
function inline(text) {
  let result = escText(text);
  // Bold: **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--color-text-primary)">$1</strong>');
  // Italic: *text*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code: `text`
  result = result.replace(/`(.+?)`/g,
    '<code style="background:var(--color-bg-primary);padding:1px 4px;border-radius:3px;font-size:.65rem">$1</code>');
  // Links: [text](url) — sanitize href
  result = result.replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
    if (url.startsWith('javascript:')) return text;
    return `<a href="${url}" style="color:var(--color-text-accent)" target="_blank" rel="noopener">${text}</a>`;
  });
  return result;
}

/** Escape text to prevent XSS. */
function escText(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default { renderMarkdown };
