import { sendViaResend } from '@/app/lib/resend';
import { getActiveEmailProvider, type EmailProvider } from '@/app/lib/emailProviderSettings';
import { checkDomainHasMailServer } from '@/app/lib/emailValidation';

export interface SendEmailParams {
  /** "Name <address@domain>" or a bare address. The domain must be verified in Resend. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/** What a provider adapter returns — no provider field, since sendEmail() below adds it. */
export interface ProviderSendResult {
  data?: { id: string };
  error?: { message: string };
}

export interface SendEmailResult extends ProviderSendResult {
  /** Which provider actually handled this send. Stored on the log row, so a message id can
   *  later be reconciled against the right provider's API. */
  provider: EmailProvider;
  /** The exact HTML handed to the provider, echoed back so callers can store it on the log
   *  row and the Email Logs view can show what was actually sent. */
  html?: string;
}

/** The single funnel every send path goes through — manual, order-triggered and automatic
 *  alike. Keeping one entry point is what lets the MX pre-check below protect all of them
 *  uniformly, and what makes switching providers a one-line change. */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = await getActiveEmailProvider();

  // Catches a domain with no mail servers at all (a typo like "gmial.com") before spending a
  // real send attempt on it. The provider would bounce it seconds later anyway; failing here
  // is faster and gives a clearer reason than a provider-specific bounce message.
  const mxCheck = await checkDomainHasMailServer(params.to);
  if (!mxCheck.valid) {
    return { error: { message: mxCheck.reason || 'Recipient domain cannot receive email' }, provider };
  }

  const result = await sendViaResend(params);
  return { ...result, provider, html: params.html };
}
