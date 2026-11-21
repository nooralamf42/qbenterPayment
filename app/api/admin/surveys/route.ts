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
      return NextResponse.json({ surveys: [] });
    }

    try {
      const { db } = await connectToDatabase();
      const surveys = await db.collection('surveys').find().sort({ submittedAt: -1 }).toArray();

      return NextResponse.json({
        surveys: surveys.map((s: any) => ({
          id: s._id.toString(),
          submittedAt: s.submittedAt,
          customerName: s.customerName || '',
          customerEmail: s.customerEmail || 'unknown',
          companyName: s.companyName || '',
          ipAddress: s.ipAddress || '',
          userAgent: s.userAgent || '',
          score: s.score,
          reason: s.reason || '',
        })),
      });
    } catch (dbErr) {
      return NextResponse.json({ surveys: [] });
    }
  } catch (err: any) {
    console.error('[Admin Surveys] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

