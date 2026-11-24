import crypto from 'crypto';

/**
 * Signed, self-contained invoice links for the receipt email's "View invoice" button.
 *
 * Receipts go out from several places (an order record, the manual Send Email tab, bulk uploads) and
 * many of them have no database row behind them, so the link carries the invoice fields itself
 * instead of an id to look up. The HMAC signature is what stops anyone from editing the link to print
 * an invoice for a different amount or customer — only links this server generated will verify.
 */

export interface InvoiceData {
  customerName: string;
  companyName?: string;
  toEmail?: string;
  orderId: string;
  paidAt: Date;
  amountUSD: number;
  paymentMethodLabel: string;
  planDetails?: string;
  numUsers?: number;
  contractYears?: number;
  licenseNumber?: string;
  productNumber?: string;
  dueDate?: Date;
}

// Short keys keep the URL (and the email's HTML) small.
interface InvoicePayload {
  n: string; c?: string; e?: string; i: string; d: string; a: number; m: string;
  p?: string; u?: number; y?: number; l?: string; k?: string; x?: string;
}

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Read per call, never at module scope — process.env isn't reliably populated at import time on Workers. */
function signingKey(): string | null {
  const key = process.env.INVOICE_LINK_SECRET?.trim() || process.env.MONGODB_URI?.trim();
  return key ? `invoice-link:${key}` : null;
}

function sign(payload: string, key: string): string {
  return b64url(crypto.createHmac('sha256', key).update(payload).digest());
}

/** Returns null when no signing key is configured, so callers can fall back to the old mailto link. */
export function buildInvoiceUrl(data: InvoiceData): string | null {
  const key = signingKey();
  if (!key) return null;

  const body: InvoicePayload = {
    n: data.customerName, c: data.companyName, e: data.toEmail, i: data.orderId,
    d: data.paidAt.toISOString(), a: data.amountUSD, m: data.paymentMethodLabel,
    p: data.planDetails, u: data.numUsers, y: data.contractYears,
    l: data.licenseNumber, k: data.productNumber, x: data.dueDate?.toISOString(),
  };
  const payload = b64url(Buffer.from(JSON.stringify(body), 'utf8'));
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-solutions.com').replace(/\/$/, '');
  return `${base}/api/invoice/${payload}.${sign(payload, key)}`;
}

/** Returns the invoice fields if the token was signed by this server, otherwise null. */
export function verifyInvoiceToken(token: string): InvoiceData | null {
  const key = signingKey();
  const dot = token.lastIndexOf('.');
  if (!key || dot < 1) return null;

  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload, key));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  try {
    const body = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as InvoicePayload;
    return {
      customerName: body.n, companyName: body.c, toEmail: body.e, orderId: body.i,
      paidAt: new Date(body.d), amountUSD: body.a, paymentMethodLabel: body.m,
      planDetails: body.p, numUsers: body.u, contractYears: body.y,
      licenseNumber: body.l, productNumber: body.k, dueDate: body.x ? new Date(body.x) : undefined,
    };
  } catch {
    return null;
  }
}
