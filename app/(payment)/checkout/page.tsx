'use client';

import { useEffect, useState } from 'react';

import OrderSummary from './components/orderSummary';
import PaymentForm from './components/paymentForm';

import { useSteps } from '@/app/hooks/useSteps';
import UserData from '@/types/userData';
import { useRouter } from 'next/navigation';

export default function CheckoutForm() {
    const {step} = useSteps()
    const [userData, setUserData] = useState<UserData>({
        firstName: '',
        lastName: '',
        company: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        product_id: '',
        amount: '',
        product_description: '',
        cardNumber: '',
        cardExpirationDate: '',
        cardCode: '',
        email: '',
        cardLastFourDigits: '',
        cardExpiryDate: '',
    });
    const router = useRouter()

    useEffect(() => {
        if (step === 4) {
            router.push('/payment-success');
        }
    }, [step]);

    return (
        <div className="min-h-screen py-8 px-5">
            
            <div className="max-w-7xl mx-auto">
                <img className='max-w-[200px] mb-10 mt-5' src="/quickbooks_logo.svg" alt="" />
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Great! One last step</h1>
                    <p className="text-gray-600">Add your billing information. You can review your cart again before you place the order</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <PaymentForm updateUserDetails={setUserData}/>

                    {/* Order Summary Section */}
                    <div className="lg:col-span-1">
                        <OrderSummary userData={userData}/>
                    </div>
                </div>
            </div>
        </div>
    );
}

