import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: false
});

// Analysis answers are text-only. Prevent Markdown images from making external
// requests from this private medical application.
markdown.disable('image');

export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
