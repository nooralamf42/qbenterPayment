import { NextRequest, NextResponse } from 'next/server';
import { verifyInvoiceToken } from '@/app/lib/invoiceLink';
import { renderInvoicePdf } from '@/app/lib/invoicePdf';

/** Public on purpose — it's the receipt email's "View invoice" link — but the token is HMAC-signed, so
 *  only invoices this server issued will render (see app/lib/invoiceLink.ts). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const data = verifyInvoiceToken(token);
    if (!data) return new NextResponse('This invoice link is invalid.', { status: 404 });

    const pdf = await renderInvoicePdf(data);
    const fileName = `Invoice_${data.orderId.replace(/[^A-Za-z0-9_-]/g, '')}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[Invoice PDF] Failed to render:', err);
    return new NextResponse('We could not generate this invoice right now.', { status: 500 });
  }
}
