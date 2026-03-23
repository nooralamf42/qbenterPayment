// app/api/webhooks/epay/route.ts
// Handles server-to-server webhook callbacks from ePay gateway
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // ePay sends form-encoded data via POST
    const contentType = req.headers.get('content-type') || ''
    let data: Record<string, string> = {}

    if (contentType.includes('application/json')) {
      data = await req.json()
    } else {
      // application/x-www-form-urlencoded
      const text = await req.text()
      const params = new URLSearchParams(text)
      params.forEach((value, key) => {
        data[key] = value
      })
    }

    const {
      transID,
      order_status,
      status,
      bill_amt,
      bill_currency,
      reference,
      mop,
      ccno,
    } = data

    console.log('[ePay Webhook]', {
      transID,
      order_status,
      status,
      bill_amt,
      bill_currency,
      reference,
      mop,
      ccno,
    })

    // order_status: 1 = Approved, 2 = Declined, 9 = Test, 0 = Pending
    // You can add database writes or email notifications here based on order_status

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[ePay Webhook] Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// ePay may also send GET requests for verification
export async function GET() {
  return NextResponse.json({ status: 'ePay webhook endpoint active' }, { status: 200 })
}
