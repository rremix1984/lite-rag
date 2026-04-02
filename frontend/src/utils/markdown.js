import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import DOMPurify from "dompurify";

const md = new MarkdownIt({
  html:       false,
  linkify:    true,
  typographer: true,
  highlight(code, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    try {
      const highlighted = hljs.highlight(code, { language }).value;
      return `<pre class="hljs-code-block"><code class="hljs language-${language}">${highlighted}</code></pre>`;
    } catch {
      return `<pre class="hljs-code-block"><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`;
    }
  },
});

/**
 * 将 Markdown 文本渲染为安全 HTML 字符串
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (!text) return "";
  return DOMPurify.sanitize(md.render(text));
}
