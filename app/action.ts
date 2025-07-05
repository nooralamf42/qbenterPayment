'use server'

import { Resend } from "resend"
import  PaymentReceiptEmailTemplate from "../components/PaymentReceiptEmailTemplate"


interface SendEmailProps {
    customerEmail: string;
    amount: string;
    billingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    cardLastFourDigits: string;
    cardExpiryDate: string;
}


export const sendEmail = async ({customerEmail, amount, billingAddress, cardLastFourDigits, cardExpiryDate}: SendEmailProps) => {
    const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY)
    const today = new Date();
    try {
        const { data, error } = await resend.emails.send({
          from: 'QuickBooks <onboarding@resend.dev>',
          to: 'billing@quickbooks-solutions.com',
          subject: 'QuickBooks Enterprise Payment Receipt',
          react: PaymentReceiptEmailTemplate(
            {
              customerEmail: customerEmail, 
              paymentDate: today.toLocaleDateString(),
              amount: amount,
              billingAddress: billingAddress,
              cardLastFourDigits,
              cardExpiryDate,
            }),
        });

    
        if (error) {
          return Response.json({ error }, { status: 500 });
        }
    } catch (error) {
        throw error
    }
}