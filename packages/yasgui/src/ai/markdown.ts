/**
 * Small Markdown renderer for answers of the AI assistant. It builds DOM nodes (never HTML strings), so an
 * answer can't inject markup. Supports paragraphs, headings, lists, fenced code, inline code, bold, italics and
 * http(s) links.
 */

export type CodeRenderer = (code: string, language: string) => HTMLElement;

function appendInline(parent: HTMLElement, text: string) {
  // Inline code first, so markers inside code are left alone
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
    if (match[1] !== undefined) {
      const code = document.createElement("code");
      code.textContent = match[1];
      parent.appendChild(code);
    } else if (match[2] !== undefined || match[3] !== undefined) {
      const strong = document.createElement("strong");
      appendInline(strong, match[2] ?? match[3]);
      parent.appendChild(strong);
    } else if (match[4] !== undefined) {
      const em = document.createElement("em");
      appendInline(em, match[4]);
      parent.appendChild(em);
    } else if (match[5] !== undefined) {
      const a = document.createElement("a");
      a.href = match[6];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = match[5];
      parent.appendChild(a);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function defaultCodeRenderer(code: string): HTMLElement {
  const pre = document.createElement("pre");
  const el = document.createElement("code");
  el.textContent = code;
  pre.appendChild(el);
  return pre;
}

export function renderMarkdown(markdown: string, renderCode: CodeRenderer = defaultCodeRenderer): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = (markdown || "").replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: HTMLElement | undefined;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    paragraph.forEach((line, i) => {
      if (i > 0) p.appendChild(document.createElement("br"));
      appendInline(p, line);
    });
    fragment.appendChild(p);
    paragraph = [];
  };
  const closeList = () => {
    list = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```[ \t]*([\w-]*)/);
    if (fence) {
      flushParagraph();
      closeList();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      fragment.appendChild(renderCode(code.join("\n"), fence[1].toLowerCase()));
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      // Answers sit in a narrow panel: all headings get the same small size
      const h = document.createElement("h4");
      appendInline(h, heading[2]);
      fragment.appendChild(h);
      continue;
    }
    const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      flushParagraph();
      const ordered = /\d/.test(item[1]);
      if (!list || (list.tagName === "OL") !== ordered) {
        list = document.createElement(ordered ? "ol" : "ul");
        fragment.appendChild(list);
      }
      const li = document.createElement("li");
      appendInline(li, item[2]);
      list.appendChild(li);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      // Continuation of a list item
      const li = list.lastElementChild as HTMLElement;
      li.appendChild(document.createTextNode(" "));
      appendInline(li, line.trim());
      continue;
    }
    closeList();
    paragraph.push(line);
  }
  flushParagraph();
  return fragment;
}
