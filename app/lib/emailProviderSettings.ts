import { connectToDatabase } from '@/app/lib/mongodb';

/** Providers this app knows how to send through.
 *
 *  Only Resend is wired up — the domain is verified there and it is the one account in use.
 *  The union and the switch exist so a second provider is a new adapter file plus an entry
 *  in VALID_PROVIDERS, with no change to any send path: the sister project
 *  (quickbooks-interprises) has cycled through six providers after account-level blocks, so
 *  the ability to swap one in without a redeploy has already proved worth the indirection.
 *
 *  Values outside VALID_PROVIDERS stay meaningful for historical emailLogs rows, which record
 *  the provider that actually sent each message. */
export type EmailProvider = 'resend';

export const VALID_PROVIDERS: EmailProvider[] = ['resend'];
const SETTINGS_ID = 'emailProvider';
const DEFAULT_PROVIDER: EmailProvider = 'resend';

/** Which provider handles sends right now. Stored in Mongo rather than an env var so it can
 *  be switched live from the admin panel without a redeploy. Any stored value outside
 *  VALID_PROVIDERS (a provider since removed, say) falls back to the default rather than
 *  needing a DB migration. */
export async function getActiveEmailProvider(): Promise<EmailProvider> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('appSettings').findOne({ _id: SETTINGS_ID as any });
    return VALID_PROVIDERS.includes(doc?.value) ? (doc!.value as EmailProvider) : DEFAULT_PROVIDER;
  } catch (err) {
    console.error('[EmailProviderSettings] Failed to read, defaulting to', DEFAULT_PROVIDER, err);
    return DEFAULT_PROVIDER;
  }
}

export async function setActiveEmailProvider(provider: EmailProvider): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('appSettings').updateOne(
    { _id: SETTINGS_ID as any },
    { $set: { value: provider, updatedAt: new Date() } },
    { upsert: true },
  );
}
