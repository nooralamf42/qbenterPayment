'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

function CheckoutForm({ localOrderId }: { localOrderId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | undefined>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);

        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const base = isLocalhost ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${base}/payment-success?order_id=${localOrderId}`,
            },
        });

        if (error) {
            setErrorMessage(error.message);
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full flex flex-col gap-5">
            <PaymentElement />
            
            {errorMessage && (
                <div className="text-red-500 text-sm mt-2 font-medium bg-red-50 p-3 rounded-md border border-red-100">
                    {errorMessage}
                </div>
            )}

            <button
                disabled={isProcessing || !stripe || !elements}
                onClick={handleSubmit}
                className="w-full bg-[#2ca01c] hover:bg-[#248a18] text-white py-3 px-4 rounded-md font-medium transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
                {isProcessing ? 'Processing Payment...' : 'Pay Now'}
            </button>
        </div>
    );
}

export default function StripePaymentForm({ clientSecret, localOrderId }: { clientSecret: string; localOrderId: string }) {
    if (!clientSecret) return null;

    return (
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Complete Payment</h3>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm localOrderId={localOrderId} />
            </Elements>
        </div>
    );
}

