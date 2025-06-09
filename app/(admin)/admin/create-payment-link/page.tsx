"use client"

import { useAdmin } from '@/app/hooks/useAdmin';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function QuickBooksPaymentLinkCreator() {
  const [users, setUsers] = useState(1);
  const [pricePerUser, setPricePerUser] = useState('');
  const [selectedEdition, setSelectedEdition] = useState('Silver');
  const [selectedYears, setSelectedYears] = useState(1);
  const [customDiscount, setCustomDiscount] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  const router = useRouter()  
const {admin} = useAdmin();
  useEffect(() => {
    if(!admin){
      router.push('/admin')
    }
  }, [router, admin]);

  useEffect(() => {
    setPaymentLink('');
  }, [users, pricePerUser, selectedEdition, selectedYears, customDiscount]);
  


  const editions = [
    {
      name: 'Silver',
      value: 'silver',
      features: ['Up to 30 users', 'Basic reporting', 'Industry editions']
    },
    {
      name: 'Gold', 
      value: 'gold',
      features: ['Advanced reporting', 'Advanced pricing', 'Enhanced payroll']
    },
    {
      name: 'Platinum',
      value: 'platinum', 
      features: ['Advanced inventory', 'Enhanced CRM', 'Workflow max']  
    },
    {
      name: 'Diamond',
      value: 'diamond',
      features: ['All Platinum features', 'Priority support', 'Advanced customization']
    }
  ];

  const yearOptions = [
    { value: 1, label: '1 Year' },
    { value: 2, label: '2 Years' },
    { value: 3, label: '3 Years' }
  ];

  const calculateSubtotal = () => {
    const basePrice = parseFloat(pricePerUser) || 0;
    return basePrice * users * selectedYears;
  };

  const calculateDiscount = () => {
    const discount = parseFloat(customDiscount) || 0;
    const subtotal = calculateSubtotal();
    return (subtotal * discount) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const generatePaymentLink = () => {
    const paymentLink = customDiscount?  {
      user:users,
      price:pricePerUser,
      edition:selectedEdition,
      year:selectedYears,
      discPer:customDiscount,
      disc:calculateDiscount(),  
      total: calculateTotal()
    } : {
      user:users,
      price:pricePerUser,
      edition:selectedEdition,
      year:selectedYears,
      total: calculateTotal()
    }

    setPaymentLink(window.location.origin + '/?payment=' + btoa(JSON.stringify(paymentLink)))
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Payment Link</h1>
          <p className="text-gray-600">Generate a custom payment link for QuickBooks Enterprise subscriptions</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Configuration</h2>
            
            <div className="space-y-6">

              {/* QuickBooks Edition */}
              <div>
                <label htmlFor="edition" className="block text-sm font-medium text-gray-700 mb-2">
                  QuickBooks Enterprise Edition
                </label>
                <select
                  id="edition"
                  value={selectedEdition}
                  onChange={(e) => setSelectedEdition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {editions.map(edition => (
                    <option key={edition.value} value={edition.name}>
                      QuickBooks Enterprise 24.0 {edition.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Number of Users */}
              <div>
                <label htmlFor="users" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Users
                </label>
                <input
                  type="number"
                  id="users"
                  min="1"
                  max="100"
                  value={users}
                  onChange={(e) => setUsers(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter number of users"
                />
              </div>

              {/* Price per User */}
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                  Price per User per Year ($)
                </label>
                <input
                  type="number"
                  id="price"
                  step="0.01"
                  min="0"
                  value={pricePerUser}
                  onChange={(e) => setPricePerUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter price per user"
                />
              </div>

              {/* Subscription Years */}
              <div>
                <label htmlFor="years" className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Duration
                </label>
                <select
                  id="years"
                  value={selectedYears}
                  onChange={(e) => setSelectedYears(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Discount */}
              <div>
                <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Percentage (%)
                </label>
                <input
                  type="number"
                  id="discount"
                  step="0.01"
                  min="0"
                  max="100"
                  value={customDiscount}
                  onChange={(e) => setCustomDiscount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter discount percentage (optional)"
                />
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Product:</span>
                  <span className="font-medium text-gray-900">QuickBooks Enterprise 24.0 {selectedEdition}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Users:</span>
                  <span className="font-medium text-gray-900">{users}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price per user:</span>
                  <span className="font-medium text-gray-900">${pricePerUser || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">{selectedYears} year(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">${calculateSubtotal().toFixed(2)}</span>
                </div>
                {parseFloat(customDiscount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount ({customDiscount}%):</span>
                    <span className="font-medium text-red-600">-${calculateDiscount().toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-base font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-blue-600">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              
              <div className="space-y-3">
                {paymentLink ? (
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center space-x-2 w-full">
                      <input
                        type="text"
                        value={paymentLink}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {navigator.clipboard.writeText(paymentLink); toast.success('Payment link copied to clipboard'); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : (
                <button
                  onClick={generatePaymentLink}
                  disabled={!pricePerUser}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                >
                  Generate Payment Link
                </button>
                )}                  
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}