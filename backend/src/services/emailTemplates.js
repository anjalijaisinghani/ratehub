// User-controlled text (like a name) must be escaped before it goes into HTML,
// or someone could register as "<script>..." or "<a href=evil>" and inject content into our email.
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildEmail = ({ subject, name, intro, buttonText, link, outro }) => {
  const text = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `${buttonText}: ${link}`,
    '',
    outro,
    '',
    '- The RateHub team',
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f5ff;font-family:Arial,Helvetica,sans-serif;color:#1b1f3b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0"
               style="background:#ffffff;border-radius:12px;padding:28px;">
          <tr><td>
            <h2 style="margin:0 0 16px;color:#1e6bff;">RateHub</h2>
            <p>Hi ${escapeHtml(name)},</p>
            <p>${escapeHtml(intro)}</p>
            <p style="margin:24px 0;">
              <a href="${escapeHtml(link)}"
                 style="background:#1e6bff;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block;">
                ${escapeHtml(buttonText)}
              </a>
            </p>
            <p style="font-size:13px;color:#6b7194;">If the button does not work, copy this address into your browser:<br>
              <span style="word-break:break-all;">${escapeHtml(link)}</span></p>
            <p style="font-size:13px;color:#6b7194;">${escapeHtml(outro)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};

const verificationEmail = ({ name, link, hours }) =>
  buildEmail({
    subject: 'Verify your RateHub email',
    name,
    intro: 'Welcome to RateHub! Please confirm your email address to activate your account.',
    buttonText: 'Verify my email',
    link,
    outro: `This link works once and expires in ${hours} hours. If you did not create an account, you can ignore this email.`,
  });

const passwordResetEmail = ({ name, link, minutes }) =>
  buildEmail({
    subject: 'Reset your RateHub password',
    name,
    intro: 'We received a request to reset your password.',
    buttonText: 'Choose a new password',
    link,
    outro: `This link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this email. Your password will not change.`,
  });

module.exports = { escapeHtml, verificationEmail, passwordResetEmail };