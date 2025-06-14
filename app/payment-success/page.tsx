

'use client'

import Confetti from '@/components/confetti';
import { CheckCircle, } from 'lucide-react';

export default function PaymentSuccessPage() {

  return (
    <div className="flex items-center justify-center px-4">
      <Confetti/>
      <div className="bg-green-50 mt-60 shadow-xl rounded-2xl p-8 max-w-xl w-full text-center">
        <div className="flex flex-col items-center">
          <CheckCircle className="text-green-600 w-16 h-16 mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Payment Successful
          </h1>
          <p className="text-gray-600 mb-6 ">
            Your transaction has been completed successfully.
          </p>
        </div>

      </div>
    </div>
  );
}
