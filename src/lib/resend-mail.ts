/**
 * Sends transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY in the environment. Optional EMAIL_FROM (default: Resend test sender onboarding@resend.dev).
 */

export async function sendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
}): Promise<{ ok: boolean; errorMessage?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, errorMessage: 'RESEND_API_KEY not set' };
  }

  // Resend free/dev: only onboarding@resend.dev is allowed until you verify a domain.
  const from = process.env.EMAIL_FROM?.trim() || 'onboarding@resend.dev';

  const safeLink = params.resetLink;
  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a2e;">
    <p>You requested a password reset for your ShelfSight account.</p>
    <p><a href="${safeLink}" style="color: #1b2a4a; font-weight: 600;">Reset your password</a></p>
    <p style="font-size: 12px; color: #666;">This link expires in one hour. If you did not request this, you can ignore this email.</p>
    <p style="font-size: 12px; color: #666;">If the button does not work, copy and paste this URL into your browser:<br/>${safeLink}</p>
  </body>
</html>
`.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: 'Reset your ShelfSight password',
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const errorMessage = `[resend] ${res.status} ${body}`;
      console.error(errorMessage);
      return { ok: false, errorMessage };
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[resend] request failed:', msg);
    return { ok: false, errorMessage: msg };
  }
}
