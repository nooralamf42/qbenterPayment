import { connectToDatabase } from '@/app/lib/mongodb';

/** What the provider last told us about this message.
 *  `accepted` is the state every send starts in: the provider took the message and returned
 *  an id, but nothing is known about delivery yet. Bounces typically land seconds later, so
 *  `accepted` must never be presented to an admin as "delivered". */
export type DeliveryStatus =
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'delayed'
  | 'bounced'
  | 'complained'
  | 'rejected'
  | 'failed';

export type EmailType = 'receipt' | 'reminder' | 'refund' | 'survey' | 'query' | 'other';

export type EmailTrigger =
  | 'admin-manual'
  | 'admin-order'
  | 'shopify-webhook'
  | 'shopify-sync'
  | 'system';

export interface EmailLogEntry {
  /** What kind of email this was. */
  type: EmailType;
  toEmail: string;
  customerName?: string;
  orderId?: string;
  planDetails?: string;
  amountUSD?: number;
  subject: string;
  /** Full message text for free-form 'query' emails, so the log shows what was actually
   *  said, not just the subject line. */
  messageBody?: string;
  /** The exact HTML of the email as sent, so the log can show the real message. Large
   *  (~18 KB), so list queries must exclude it. */
  html?: string;
  /** Where the send was initiated from, for auditing. */
  trigger: EmailTrigger;
  /** The provider's message id. The join key for delivery webhooks — without it a log row
   *  can never be reconciled against what actually happened to the message. */
  providerMessageId?: string;
  /** Which provider providerMessageId belongs to. Only Resend sends today, but the field is
   *  recorded per row so historical rows stay interpretable if another is added. */
  provider?: string;
  /** Set when the send was rejected outright, so the row records the failure rather than
   *  being silently absent from the log. */
  deliveryStatus?: DeliveryStatus;
  /** Human-readable reason for a non-delivery, straight from the provider. */
  deliveryDetail?: string;
}

/** Records that an email was sent, for audit purposes.
 *  Never throws — a logging failure must not block or fail a send. */
export async function logEmailSent(entry: EmailLogEntry): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection('emailLogs').insertOne({
      ...entry,
      deliveryStatus: entry.deliveryStatus ?? 'accepted',
      sentAt: new Date(),
      statusUpdatedAt: new Date(),
    });
  } catch (err) {
    console.error('[EmailLog] Failed to record sent email:', err);
  }
}

/** Applies a delivery event to the matching log row. Never throws — a webhook that 500s gets
 *  retried, and a logging failure is not worth a retry storm. */
export async function updateDeliveryStatus(
  providerMessageId: string,
  status: DeliveryStatus,
  detail?: string,
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('emailLogs').updateOne(
      { providerMessageId },
      {
        $set: {
          deliveryStatus: status,
          ...(detail ? { deliveryDetail: detail } : {}),
          statusUpdatedAt: new Date(),
        },
      },
    );
    return res.matchedCount > 0;
  } catch (err) {
    console.error('[EmailLog] Failed to update delivery status:', err);
    return false;
  }
}

/** Records an open or click event. Kept separate from deliveryStatus — engagement doesn't
 *  replace a terminal delivery state, it is additional information on top of it (a delivered
 *  email can later be opened, then clicked). Only the FIRST occurrence's timestamp is kept;
 *  every occurrence increments a count. Uses a pipeline update so "set only if absent" can be
 *  expressed without a read-then-write race. */
export async function recordEngagement(
  providerMessageId: string,
  kind: 'opened' | 'clicked',
  linkUrl?: string,
): Promise<boolean> {
  // Explicit map, not string interpolation — "opened" + "Count" naively gives "openedCount",
  // but the admin table uses "openCount"/"clickCount".
  const atField = kind === 'opened' ? 'openedAt' : 'clickedAt';
  const countField = kind === 'opened' ? 'openCount' : 'clickCount';
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('emailLogs').updateOne(
      { providerMessageId },
      [
        {
          $set: {
            [atField]: { $ifNull: [`$${atField}`, new Date()] },
            [countField]: { $add: [{ $ifNull: [`$${countField}`, 0] }, 1] },
            ...(linkUrl ? { lastClickedUrl: linkUrl } : {}),
          },
        },
      ],
    );
    return res.matchedCount > 0;
  } catch (err) {
    console.error(`[EmailLog] Failed to record ${kind} event:`, err);
    return false;
  }
}

/** Creates the indexes the admin search and table rely on. Safe to call repeatedly —
 *  createIndex is a no-op when the index already exists with the same spec. */
export async function ensureEmailLogIndexes(): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection('emailLogs');
    await Promise.all([
      col.createIndex({ toEmail: 1 }),
      col.createIndex({ sentAt: -1 }),
      col.createIndex({ providerMessageId: 1 }, { sparse: true }),
      col.createIndex({ provider: 1, deliveryStatus: 1 }, { sparse: true }),
      col.createIndex({ trigger: 1, sentAt: -1 }),
      col.createIndex({ type: 1, toEmail: 1, sentAt: -1 }),
    ]);
  } catch (err) {
    console.error('[EmailLog] Failed to ensure indexes:', err);
  }
}
