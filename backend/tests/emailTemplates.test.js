const { escapeHtml, verificationEmail, passwordResetEmail } = require('../src/services/emailTemplates');

describe('escapeHtml', () => {
  test('neutralises HTML special characters', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;'
    );
  });
});

describe('email templates', () => {
  const link = 'http://localhost:5173/verify-email?token=' + 'a'.repeat(64);

  test('a malicious name cannot inject HTML into the email', () => {
    const { html } = verificationEmail({ name: '<img src=x onerror=alert(1)>', link, hours: 24 });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('contains the link in both the HTML and the plain-text version', () => {
    const mail = verificationEmail({ name: 'Sam', link, hours: 24 });
    expect(mail.subject).toBe('Verify your RateHub email');
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
    expect(mail.text).toContain('24 hours');
  });

  test('reset email states the expiry in minutes', () => {
    const mail = passwordResetEmail({ name: 'Sam', link: 'http://x/reset-password?token=abc', minutes: 60 });
    expect(mail.subject).toBe('Reset your RateHub password');
    expect(mail.text).toContain('60 minutes');
  });
});