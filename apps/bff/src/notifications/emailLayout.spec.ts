import { renderEmail } from './emailLayout';

describe('renderEmail code block', () => {
  const base = { heading: 'Verify your email', preheader: 'Your code is inside.', paragraphs: ['Use this code.'] };

  it('shows the code large and boxed, after the paragraphs and before the button', () => {
    const html = renderEmail({ ...base, code: '482913', button: { label: 'Open', url: 'https://x.test' } });
    const para = html.indexOf('Use this code.');
    const code = html.indexOf('482913');
    const button = html.indexOf('Open</a>');
    expect(code).toBeGreaterThan(para);
    expect(button).toBeGreaterThan(code);
    expect(html).toContain('letter-spacing:8px');
  });

  it('renders nothing extra when no code is given', () => {
    const html = renderEmail(base);
    expect(html).not.toContain('Courier New');
  });

  it('escapes the code like every other text', () => {
    const html = renderEmail({ ...base, code: '<b>1</b>' });
    expect(html).not.toContain('<b>1</b>');
    expect(html).toContain('&lt;b&gt;1&lt;/b&gt;');
  });
});
