import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD || 'TXBjbjYyJQ==';

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ logs: [] });
    }

    try {
      const { db } = await connectToDatabase();
      const consentLogs = await db
        .collection('admindata')
        .find({})
        .sort({ agreedTimestamp: -1 })
        .toArray();

      const includeEvents = req.nextUrl.searchParams.get('includeEvents') === 'true';
      let groupedSessions: any[] = [];

      if (includeEvents) {
        const userEvents = await db
          .collection('user_events')
          .find({})
          .sort({ timestamp: 1 })
          .toArray();

        const sessionsMap = new Map();
        userEvents.forEach((event: any) => {
          const paymentPart = event.paymentId || 'noid';
          const ipPart = event.ipAddress || 'noip';
          const key = `${paymentPart}__${ipPart}`;

          if (!sessionsMap.has(key)) {
            sessionsMap.set(key, {
              _id: `session_${key}_${event._id}`,
              logType: 'user_session',
              paymentId: event.paymentId,
              ipAddress: event.ipAddress,
              email: event.email,
              planDetails: event.planDetails,
              amount: event.amount,
              agreedTimestamp: event.timestamp,
              events: []
            });
          }
          
          const session = sessionsMap.get(key);
          if (event.email) session.email = event.email;
          if (event.planDetails) session.planDetails = event.planDetails;
          if (event.amount) session.amount = event.amount;
          
          if (event.paymentId) {
            if (event.paymentId.endsWith('GT')) session.paymentGateway = 'Stripe';
            else if (event.paymentId.endsWith('GA')) session.paymentGateway = 'Authorize.net';
            else if (event.paymentId.endsWith('GO')) session.paymentGateway = 'Online Payment';
          }
          
          session.agreedTimestamp = event.timestamp;
          session.events.push(event);
        });

        consentLogs.forEach((log: any) => {
          if (!log.linkToken) return;
          const key = `${log.linkToken}__${log.ipAddress || 'noip'}`;
          if (!sessionsMap.has(key)) return;
          const session = sessionsMap.get(key);
          if (log.status === 'Completed') {
            const timestamp = log.paidAt || log.updatedAt || log.createdAt;
            session.events.push({ event: 'payment_completed', timestamp, detail: { amount: log.amountUSD } });
            session.agreedTimestamp = timestamp;
            session.amount = session.amount || log.amountUSD;
          } else if (log.status === 'Failed') {
            const timestamp = log.failedAt || log.updatedAt || log.createdAt;
            session.events.push({ event: 'payment_failed', timestamp, detail: log.failureReason ? { reason: log.failureReason } : undefined });
            session.agreedTimestamp = timestamp;
          }
        });

        sessionsMap.forEach((session: any) => {
          session.events.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });

        groupedSessions = Array.from(sessionsMap.values());
      }

      const combined = [...consentLogs, ...groupedSessions].sort((a: any, b: any) => {
        return new Date(b.agreedTimestamp || b.createdAt).getTime() - new Date(a.agreedTimestamp || a.createdAt).getTime();
      });

      return NextResponse.json({ logs: combined });
    } catch (dbErr) {
      console.warn('[consent-logs] DB error, returning empty logs:', dbErr);
      return NextResponse.json({ logs: [] });
    }
  } catch (err: any) {
    console.error('[Admin ConsentLogs] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

