import type { NextRequest } from 'next/server';

/** Shared admin-panel auth check for /api/admin/* routes.
 *
 *  Why the fallback: `NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD` is a **build** variable. Next inlines
 *  it into the client bundle at build time, which is how the dashboard's login screen checks it
 *  — but on Cloudflare Workers it is NOT present in `process.env` at request time unless it is
 *  also set as a runtime variable. A route that reads it bare therefore compares the caller's
 *  header against `Bearer undefined` and answers 401 to a correctly authenticated admin.
 *
 *  Every route written for this project already carried this fallback inline; the routes ported
 *  from quickbooks-interprises did not, so Send Email, Email Logs and the domain check all
 *  returned "Unauthorized access" in production while Consent Logs worked. Centralised here so
 *  the next route cannot reintroduce it.
 *
 *  The value is not a secret in any meaningful sense: being NEXT_PUBLIC_, it is already served
 *  inside the client JavaScript to anyone who loads the admin page. This gate keeps casual
 *  callers out of the API; it is not a security boundary.
 */
export function isAdminAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization');
  const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD || 'TXBjbjYyJQ==';
  return !!authHeader && authHeader === `Bearer ${expectedPass}`;
}
