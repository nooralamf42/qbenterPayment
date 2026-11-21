import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, paymentId, planDetails, amount, email, detail } = body;

    if (!event) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';

    if (process.env.MONGODB_URI) {
      try {
        const { db } = await connectToDatabase();
        const logEntry = {
          event,
          ipAddress,
          paymentId: paymentId || null,
          planDetails: planDetails || null,
          amount: amount || null,
          email: email || null,
          detail: detail && typeof detail === 'object' ? detail : null,
          timestamp: new Date(),
        };
        await db.collection('user_events').insertOne(logEntry);
      } catch (dbErr) {
        console.warn('[track-event] DB insert skipped:', dbErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API TrackEvent] Error:', err);
    return NextResponse.json({ success: true }); // Always succeed so frontend doesn't hang
  }
}

