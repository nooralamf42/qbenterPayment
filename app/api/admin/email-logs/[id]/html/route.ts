import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb';
import { isAdminAuthorized } from '@/app/lib/adminAuth';

/** Returns the email behind one Email Logs row, so the admin can see what was actually sent.
 *
 *  `html` is stored on the row at send time (emailSender echoes back the exact HTML handed to
 *  the provider), so there is nothing to fetch from the provider here. Rows written before a
 *  send failed — or any row where the body was never stored — return html: null, and the UI
 *  shows the row's details instead of a blank frame.
 *
 *  Excluded from the list query because it is ~18 KB a row; this is the per-row fetch. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid log id' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const row = await db
      .collection('emailLogs')
      .findOne({ _id: new ObjectId(id) }, { projection: { html: 1, subject: 1, toEmail: 1 } });

    if (!row) {
      return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    }

    return NextResponse.json({
      html: typeof row.html === 'string' && row.html ? row.html : null,
      subject: row.subject ?? null,
      toEmail: row.toEmail ?? null,
      source: row.html ? 'stored' : null,
    });
  } catch (err: any) {
    console.error('[Email Log HTML] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
