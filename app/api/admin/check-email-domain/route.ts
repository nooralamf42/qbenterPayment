import { NextRequest, NextResponse } from 'next/server';
import { checkDomainHasMailServer } from '@/app/lib/emailValidation';
import { isAdminAuthorized } from '@/app/lib/adminAuth';

/** Backs the inline "this domain can't receive mail" warning on the admin Send Email tab —
 *  same MX/A-record check that guards sendEmail() itself, exposed here so the admin sees the
 *  problem before clicking Send instead of after a wasted round trip. */
export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const email = (req.nextUrl.searchParams.get('email') || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ valid: true }); // not our job to validate syntax here
    }

    const result = await checkDomainHasMailServer(email);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Check Email Domain] Error:', err);
    // Fail open — a broken check should never block the admin from sending.
    return NextResponse.json({ valid: true });
  }
}
