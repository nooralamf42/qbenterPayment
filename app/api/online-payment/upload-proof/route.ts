import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images (JPG, PNG, GIF, WEBP) and PDF are allowed.' },
        { status: 400 }
      );
    }

    // Accept file and return success
    return NextResponse.json({
      success: true,
      message: 'Payment proof received successfully.',
      orderId,
    });
  } catch (err: any) {
    console.error('[Upload Proof] Error:', err);
    return NextResponse.json({ error: 'Failed to upload proof' }, { status: 500 });
  }
}

