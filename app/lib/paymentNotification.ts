/** Internal "New Successful Payment" alert sent to the business's own inbox on every
 *  completed payment — the counterpart of the same file in quickbooks-interprises.
 *
 *  NOTE: quickbooks-solution has no email provider wired up yet (there is no postal.ts /
 *  sendEmail dispatcher in this repo), so this is currently a no-op that logs instead of
 *  sending. The interface is kept identical to the interprises version so that wiring a
 *  provider in later is a change to this file alone — every gateway webhook already calls
 *  it. Until then, a successful Shopify payment is still recorded in Mongo by the webhook;
 *  only the internal alert email is missing.
 */

export interface PaymentNotificationParams {
  /** Shown in the email heading, e.g. "New Successful Payment (Shopify)". */
  gatewayLabel: string;
  customerName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  planDetails?: string;
  amountUSD: number;
  /** e.g. Shopify order id, Stripe PaymentIntent id. */
  transactionId: string;
  transactionIdLabel?: string;
}

export async function sendPaymentNotificationEmail(
  params: PaymentNotificationParams
): Promise<void> {
  // TODO: wire an email provider in this repo, then send the alert here.
  console.log(
    `[paymentNotification] ${params.gatewayLabel} payment ${params.transactionId} ` +
      `from ${params.customerName} for ${params.amountUSD} — email provider not configured, not sent.`
  );
}
