'use client'

import { useState } from 'react';

export default function PaymentForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState(null);

  const [formData, setFormData] = useState({
    cardNumber: '4242424242424242',
    expirationDate: '0842',
    cardCode: '999',
    amount: '99.99'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: formData.amount,
          cardDetails: {
            cardNumber: formData.cardNumber,
            expirationDate: formData.expirationDate,
            cardCode: formData.cardCode
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTransactionId(data.transactionId);
      } else {
        setError(data.error || 'Payment failed');
      }
    } catch (err) {
      setError('Payment processing failed. Please try again.');
      console.error('Payment error:', err);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Payment Details</h2>
      
      {success ? (
        <div className="text-green-600 mb-4">
          <p>Payment processed successfully!</p>
          <p>Transaction ID: {transactionId}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Card Number</label>
            <input
              type="text"
              name="cardNumber"
              value={formData.cardNumber}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="Card Number"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Expiration Date (MMYY)</label>
            <input
              type="text"
              name="expirationDate"
              value={formData.expirationDate}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="MMYY"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 mb-2">CVV</label>
            <input
              type="text"
              name="cardCode"
              value={formData.cardCode}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="CVV"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Amount</label>
            <input
              type="text"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="Amount"
            />
          </div>

          {error && (
            <div className="text-red-600 mb-4">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? 'Processing...' : 'Pay Now'}
          </button>
        </form>
      )}
    </div>
  );
}
