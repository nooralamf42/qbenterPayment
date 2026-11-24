import type { SendEmailParams, ProviderSendResult } from '@/app/lib/emailSender';

/** Resend adapter. Called through sendEmail() in emailSender.ts — nothing should call this
 *  directly, so that the MX pre-check and the provider switch apply to every send path.
 *
 *  Uses Resend's REST API over fetch rather than the `resend` npm package: this runs on
 *  Cloudflare Workers, and a plain fetch keeps the bundle small and avoids any Node-only
 *  dependency the SDK might pull in.
 */
const API_URL = 'https://api.resend.com/emails';

/** Read per call, never at module scope — process.env is not reliably populated at import
 *  time on Workers, so a module-level read can capture undefined on a cold isolate. */
function apiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim();
}

export async function sendViaResend(params: SendEmailParams): Promise<ProviderSendResult> {
  const key = apiKey();
  if (!key) {
    return { error: { message: 'RESEND_API_KEY is not configured' } };
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!res.ok) {
      // Resend returns { name, message } on failure. Surface the message, since it is what
      // tells an admin whether the domain is unverified, the key is wrong, or the recipient
      // was rejected.
      return {
        error: { message: body?.message || `Resend returned HTTP ${res.status}` },
      };
    }

    if (!body?.id) {
      return { error: { message: 'Resend accepted the request but returned no message id' } };
    }

    return { data: { id: body.id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'Could not reach Resend' } };
  }
}
