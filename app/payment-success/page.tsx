

'use client'

import { AutoConfettiWrapper } from '@/components/AutoConfettiWrapper';
import { CheckCircle, } from 'lucide-react';
import { useSteps } from '../hooks/useSteps';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';


export default function PaymentSuccessPage() {
  const router = useRouter()
  const {step} = useSteps()
  useEffect(()=>{
    if(step!==4){
      router.push('/')
    }
  },[step])
  return (
    <AutoConfettiWrapper delay={1000} duration={4000}>
    <div className="flex items-center justify-center px-4">

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
    </AutoConfettiWrapper>
  );
}
