import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendEmail } from '@/app/lib/emailSender';
import { renderPaymentReceiptEmailHtml, renderPaymentFailedEmailHtml } from '@/app/lib/emailTemplates';
import { logEmailSent } from '@/app/lib/emailLog';
import { isAdminAuthorized } from '@/app/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { id, type } = await req.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }
    if (type !== 'success' && type !== 'failed') {
      return NextResponse.json({ error: 'type must be "success" or "failed"' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(id) });

    if (!record) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!record.email) {
      return NextResponse.json({ error: 'Order has no email on file' }, { status: 400 });
    }

    // Order-triggered sends now follow the same admin-selected provider as the manual Send
    // Email tab (previously hardcoded to Postmark regardless of that toggle).
    const customerName = `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'there';

    if (type === 'success') {
      //   from: 'QuickBooks Enterprise <notifications@quickbooks-solutions.com>',
      //   // notifications@ has no mailbox and no receiving MX — without this, a customer
      //   // reply either bounces or silently vanishes. billing@ is the one that's monitored.
      //   replyTo: 'contact@qbenterprise.us',
      //   to: record.email,
      //   subject: 'We received your QuickBooks Enterprise payment!',
      //   html: renderPaymentReceiptEmailHtml({ ... }),
      const receiptData = {
        customerName,
        toEmail: record.email,
        companyName: record.companyName,
        orderId: record._id.toString(),
        paidAt: record.paidAt ? new Date(record.paidAt) : new Date(),
        amountUSD: record.amountUSD || 0,
        paymentMethodLabel: record.paymentMethodLabel || 'Card on file',
        planDetails: record.planDetails,
        licenseNumber: record.licenseNumber || undefined,
        productNumber: record.productNumber || undefined,
      };
      const { data, error, provider, html } = await sendEmail({
        from: 'QuickBooks Enterprise <notifications@quickbooks-solutions.com>',
        replyTo: 'contact@qbenterprise.us',
        to: record.email,
        subject: 'We received your QuickBooks Enterprise payment!',
        html: renderPaymentReceiptEmailHtml(receiptData),
      });

      // Pre-existing gap, not new to this Postmark swap: this route never checked the
      // provider's error before, so a rejected send still returned { success: true }.
      if (error) {
        return NextResponse.json({ error: error.message || 'Email provider rejected the send' }, { status: 502 });
      }

      await logEmailSent({
        type: 'receipt',
        toEmail: record.email,
        customerName,
        orderId: record._id.toString(),
        planDetails: record.planDetails,
        amountUSD: record.amountUSD || 0,
        subject: 'We received your QuickBooks Enterprise payment!',
        trigger: 'admin-order',
        providerMessageId: data?.id,
        provider,
        html,
      });
      // No internal payment-notification alert here on purpose — this order was already
      // paid (that's why it exists), so resending its receipt isn't a new payment event
      // and shouldn't re-notify the business as if one just happened.
    } else {
      const dueDate = record.paidAt ? new Date(record.paidAt) : new Date();
      const cancellationDate = new Date(dueDate);
      cancellationDate.setDate(cancellationDate.getDate() + 7);

      //   from: 'QuickBooks Enterprise <notifications@quickbooks-solutions.com>',
      //   // notifications@ has no mailbox and no receiving MX — without this, a customer
      //   // reply either bounces or silently vanishes. billing@ is the one that's monitored.
      //   replyTo: 'contact@qbenterprise.us',
      //   to: record.email,
      //   subject: 'Action needed: update your QuickBooks Enterprise payment method',
      //   html: renderPaymentFailedEmailHtml({ ... }),
      const reminderData = {
        customerName,
        toEmail: record.email,
        companyName: record.companyName,
        orderId: record._id.toString(),
        amountDueUSD: record.amountUSD || 0,
        paymentMethodLabel: record.paymentMethodLabel || 'the payment method on file',
        dueDate,
        cancellationDate,
        planDetails: record.planDetails,
      };
      const { data, error, provider, html } = await sendEmail({
        from: 'QuickBooks Enterprise <notifications@quickbooks-solutions.com>',
        replyTo: 'contact@qbenterprise.us',
        to: record.email,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        html: renderPaymentFailedEmailHtml(reminderData),
      });

      if (error) {
        return NextResponse.json({ error: error.message || 'Email provider rejected the send' }, { status: 502 });
      }

      await logEmailSent({
        type: 'reminder',
        toEmail: record.email,
        customerName,
        orderId: record._id.toString(),
        planDetails: record.planDetails,
        amountUSD: record.amountUSD || 0,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        trigger: 'admin-order',
        providerMessageId: data?.id,
        provider,
        html,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Send Order Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
