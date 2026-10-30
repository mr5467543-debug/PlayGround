// Dependency-free Markdown renderer for the static design dossier.
// Supports the subset used by docs/: headings, paragraphs, lists, tables,
// fenced code, blockquotes, rules, and inline code/emphasis/links.

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const unescapeHtml = (value) => String(value)
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&');

export const slugify = (value) => unescapeHtml(value)
  .replace(/<[^>]*>/g, '')
  .toLowerCase()
  .replace(/[`*_~]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'section';

const defaultLink = (href) => href;

function inline(raw, linkTransform = defaultLink) {
  const code = [];
  let text = String(raw).replace(/`([^`]+)`/g, (_, value) => {
    code.push(escapeHtml(value));
    return `\u0000${code.length - 1}\u0000`;
  });

  text = escapeHtml(text);

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, src) =>
    `<img src="${linkTransform(unescapeHtml(src))}" alt="${alt}" loading="lazy">`);

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
    const target = linkTransform(unescapeHtml(href));
    const external = /^https?:\/\//i.test(target);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(target)}"${attrs}>${label}</a>`;
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  text = text.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${code[Number(index)]}</code>`);
  return text;
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*```([\w+-]*)\s*$/;
const RULE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/;

const splitTableRow = (line) => {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map((cell) => cell.trim());
};

const isBlockStart = (line) =>
  HEADING.test(line) || FENCE.test(line) || RULE.test(line) ||
  /^\s*>/.test(line) || LIST_ITEM.test(line) || /^\s*\|/.test(line);

function renderList(items, linkTransform) {
  const roots = { children: [] };
  const stack = [{ indent: -1, node: roots }];
  for (const item of items) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) stack.pop();
    const node = { text: item.text, ordered: item.ordered, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent: item.indent, node });
  }
  const render = (nodes, tag) => `<${tag}>${nodes.map((node) => {
    const childTag = node.ordered ? 'ol' : 'ul';
    const nested = node.children.length ? render(node.children, childTag) : '';
    return `<li>${inline(node.text, linkTransform)}${nested}</li>`;
  }).join('')}</${tag}>`;
  return render(roots.children, roots.children[0]?.ordered ? 'ol' : 'ul');
}

export function renderMarkdown(markdown, options = {}) {
  const linkTransform = options.link || defaultLink;
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const toc = [];
  const usedIds = new Map();
  const html = [];
  let title = '';
  let subtitle = '';

  let index = 0;
  if (options.stripHeader) {
    while (index < lines.length && !lines[index].trim()) index += 1;
    if (HEADING.test(lines[index] || '')) {
      const match = lines[index].match(HEADING);
      if (match[1] === '#') {
        title = match[2].trim();
        index += 1;
        while (index < lines.length && !lines[index].trim()) index += 1;
        if ((lines[index] || '').startsWith('## ')) {
          subtitle = lines[index].replace(/^##\s+/, '').trim();
          index += 1;
        }
      }
    }
  }

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(FENCE);
    if (fence) {
      const language = fence[1] || '';
      index += 1;
      const body = [];
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      const className = language ? ` class="language-${escapeHtml(language)}"` : '';
      html.push(`<pre><code${className}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      let id = slugify(text);
      const seen = usedIds.get(id) || 0;
      usedIds.set(id, seen + 1);
      if (seen) id = `${id}-${seen}`;
      if (level === 2 || level === 3) toc.push({ level, id, text: unescapeHtml(text).replace(/[*_`]/g, '') });
      html.push(`<h${level} id="${id}">${inline(text, linkTransform)}</h${level}>`);
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      html.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${renderMarkdown(quoted.join('\n'), { link: linkTransform }).html}</blockquote>`);
      continue;
    }

    if (line.trim().startsWith('|') && TABLE_SEPARATOR.test(lines[index + 1] || '')) {
      const header = splitTableRow(line);
      const align = splitTableRow(lines[index + 1]).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
      });
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      const head = header.map((cell, cellIndex) => {
        const style = align[cellIndex] ? ` style="text-align:${align[cellIndex]}"` : '';
        return `<th${style}>${inline(cell, linkTransform)}</th>`;
      }).join('');
      const body = rows.map((row) => `<tr>${row.map((cell, cellIndex) => {
        const style = align[cellIndex] ? ` style="text-align:${align[cellIndex]}"` : '';
        return `<td${style}>${inline(cell, linkTransform)}</td>`;
      }).join('')}</tr>`).join('');
      html.push(`<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const items = [];
      while (index < lines.length) {
        const current = lines[index];
        const match = current.match(LIST_ITEM);
        if (match) {
          items.push({
            indent: match[1].replace(/\t/g, '  ').length,
            ordered: /\d/.test(match[2]),
            text: match[3]
          });
          index += 1;
          continue;
        }
        if (!current.trim()) {
          let ahead = index + 1;
          while (ahead < lines.length && !lines[ahead].trim()) ahead += 1;
          if (ahead < lines.length && LIST_ITEM.test(lines[ahead])) { index = ahead; continue; }
          break;
        }
        if (/^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1].text += ` ${current.trim()}`;
          index += 1;
          continue;
        }
        break;
      }
      html.push(renderList(items, linkTransform));
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    // Metadata blocks (one bold label per line) read as a list, not a run-on.
    const labelled = paragraph.length > 1 && paragraph.every((text) => /^\*\*[^*]+:\*\*/.test(text));
    html.push(`<p>${paragraph.map((text) => inline(text, linkTransform)).join(labelled ? '<br>\n' : ' ')}</p>`);
  }

  return { html: html.join('\n'), toc, title, subtitle };
}
