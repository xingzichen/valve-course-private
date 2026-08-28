import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders common answer structure', () => {
    const html = renderMarkdown('## 建议\n\n1. **记录症状**\n2. 询问医生');

    expect(html).toContain('<h2>建议</h2>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<strong>记录症状</strong>');
  });

  it('does not execute raw HTML or unsafe links', () => {
    const html = renderMarkdown(
      '<script>alert("xss")</script>\n\n[危险链接](javascript:alert("xss"))\n\n![外部图片](https://example.com/tracker.png)'
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<img');
  });
});
