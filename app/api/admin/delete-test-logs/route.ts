import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD || 'TXBjbjYyJQ==';

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('admindata').deleteMany({
      $or: [
        { email: { $regex: /@example\.com$/i } },
        { email: { $in: ['info@qualitybusinesstech.us', 'nick.powerjobs@gmail.com', 'contact@qbenterprise.us'] } }
      ]
    });

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('Delete test logs error:', error);
    return NextResponse.json({ error: 'Failed to delete test logs' }, { status: 500 });
  }
}

