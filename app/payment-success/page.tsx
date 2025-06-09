'use client';

import { CheckCircle, MailIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const trustapUser = params.get('buyerId')?.split('state')[0]
  const transactionId = params.get('tx_id')
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-xl w-full text-center">
        <div className="flex flex-col items-center">
          <CheckCircle className="text-green-600 w-16 h-16 mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Payment Successful
          </h1>
          <p className="text-gray-600 mb-6">
            Your transaction has been completed successfully. We’ve sent a confirmation email.
          </p>

          <Link
            href={`/raise-transaction-dispute?buyerId=${trustapUser}&tx_id=${transactionId}`}
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200"
          >
            Raise a Transaction Dispute
          </Link>

          <div className="mt-8 text-sm text-gray-500">
            <p className="mb-1">Need immediate help?</p>
            <a
              href="mailto:support@trustap.com"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              <MailIcon className="w-4 h-4" />
              support@trustap.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
