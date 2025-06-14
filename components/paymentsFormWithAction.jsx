// app/components/PaymentFormWithActions.js
'use client';

import { useState, useTransition } from 'react';
import { processPayment, validateCard } from '@/app/actions/payment';

export default function PaymentFormWithActions() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [cardValid, setCardValid] = useState(null);

  async function handleSubmit(formData) {
    setMessage('');
    
    startTransition(async () => {
      try {
        const result = await processPayment(formData);
        
        if (result.success) {
          setMessage(`Payment successful! Transaction ID: ${result.transactionId}`);
          // Reset form or redirect
          document.getElementById('payment-form').reset();
        } else {
          setMessage(`Payment failed: ${result.errorText || result.error}`);
        }
      } catch (error) {
        setMessage('An unexpected error occurred');
      }
    });
  }

  async function handleCardValidation(e) {
    const cardNumber = e.target.value;
    if (cardNumber.length >= 13) {
      const isValid = await validateCard(cardNumber);
      setCardValid(isValid);
    } else {
      setCardValid(null);
    }
  }

  return (
    <form 
      id="payment-form"
      action={handleSubmit} 
      className="max-w-lg mx-auto p-6 space-y-4"
    >
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium mb-2">
          First Name
        </label>
        <input
          id="firstName"
          name="firstName"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="lastName" className="block text-sm font-medium mb-2">
          Last Name
        </label>
        <input
          id="lastName"
          name="lastName"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="cardNumber" className="block text-sm font-medium mb-2">
          Card Number
        </label>
        <input
          id="cardNumber"
          name="cardNumber"
          required
          onChange={handleCardValidation}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            cardValid === false ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="1234 5678 9012 3456"
          maxLength="19"
        />
        {cardValid === false && (
          <p className="mt-1 text-sm text-red-600">Invalid card number</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expirationDate" className="block text-sm font-medium mb-2">
            Expiration Date
          </label>
          <input
            id="expirationDate"
            name="expirationDate"
            required
            pattern="(0[1-9]|1[0-2])\/\d{2}"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="MM/YY"
            maxLength="5"
          />
        </div>

        <div>
          <label htmlFor="cvv" className="block text-sm font-medium mb-2">
            CVV
          </label>
          <input
            id="cvv"
            name="cvv"
            required
            pattern="[0-9]{3,4}"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123"
            maxLength="4"
          />
        </div>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium mb-2">
          Amount ($)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="10.00"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Processing...' : 'Pay Now'}
      </button>

      {message && (
        <div className={`p-4 rounded-md ${
          message.includes('successful') 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}
    </form>
  );
}
