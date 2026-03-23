'use client';

import { CheckCircle, MailIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function PaymentSuccessPage() {
  const params = useSearchParams();

  // ePay return URL params
  const transID = params.get('transID')
  const status = params.get('status')
  const billAmt = params.get('bill_amt')
  const billCurrency = params.get('bill_currency') || 'USD'
  const reference = params.get('reference')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-xl w-full text-center">
        <div className="flex flex-col items-center">
          <CheckCircle className="text-green-600 w-16 h-16 mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Payment Successful
          </h1>
          <p className="text-gray-600 mb-6">
            Your transaction has been completed successfully. We&apos;ve sent a confirmation email.
          </p>

          {/* Transaction details */}
          {(transID || billAmt) && (
            <div className="w-full bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm text-gray-700 space-y-2">
              {transID && (
                <div className="flex justify-between">
                  <span className="font-medium">Transaction ID:</span>
                  <span className="text-gray-900 font-mono">{transID}</span>
                </div>
              )}
              {status && (
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="text-green-600 font-semibold">{status}</span>
                </div>
              )}
              {billAmt && (
                <div className="flex justify-between">
                  <span className="font-medium">Amount:</span>
                  <span className="text-gray-900">{billCurrency} {billAmt}</span>
                </div>
              )}
              {reference && (
                <div className="flex justify-between">
                  <span className="font-medium">Reference:</span>
                  <span className="text-gray-500 font-mono text-xs">{reference}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            <p className="mb-1">Need help with your order?</p>
            <a
              href="mailto:support@quickbooks-solutions.com"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              <MailIcon className="w-4 h-4" />
              support@quickbooks-solutions.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
