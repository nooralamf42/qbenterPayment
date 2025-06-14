"use client"

import { useAdmin } from '@/app/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function QuickBooksPaymentLinkCreator() {
  const [users, setUsers] = useState<number>(1)
  const [totalPrice, setTotalPrice] = useState<number>(0)
  const [selectedEdition, setSelectedEdition] = useState<string>('Silver')
  const [selectedYears, setSelectedYears] = useState<number>(1)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [paymentLink, setPaymentLink] = useState<string>('')

  const router = useRouter()
  const { admin } = useAdmin()

  useEffect(() => {
    if (!admin) {
      router.push('/admin')
    }
  }, [router, admin])

  useEffect(() => {
    setPaymentLink('')
  }, [users, totalPrice, selectedEdition, selectedYears, discountAmount])

  const editions = [
    { name: 'Silver', value: 'silver' },
    { name: 'Gold', value: 'gold' },
    { name: 'Platinum', value: 'platinum' },
    { name: 'Diamond', value: 'diamond' }
  ] as const

  const yearOptions = [
    { value: 1, label: '1 Year' },
    { value: 2, label: '2 Years' },
    { value: 3, label: '3 Years' }
  ] as const

  const calculateTotal = (): number => {
    return Math.max(totalPrice - discountAmount, 0)
  }

  const generatePaymentLink = (): void => {
    if (discountAmount > totalPrice) {
      toast.error('Discount cannot be greater than total price!')
      return
    }

    if (totalPrice <= 0) {
      toast.error('Total price must be greater than 0!')
      return
    }

    const paymentObj = {
      user: users,
      edition: selectedEdition,
      year: selectedYears,
      disc: discountAmount,
      total: calculateTotal(),
      time: Date.now()
    }



    setPaymentLink(window.location.origin + '/?payment=' + btoa(JSON.stringify(paymentObj)))
  }

  const handleUsersChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value) || 1
    setUsers(Math.max(1, value))
  }

  const handleTotalPriceChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseFloat(e.target.value) || 0
    setTotalPrice(Math.max(0, value))
  }

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseFloat(e.target.value) || 0
    
    if (value > totalPrice) {
      toast.error('Discount cannot be greater than total price!')
      return
    }

    setDiscountAmount(Math.max(0, value))
  }

  const handleEditionChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedEdition(e.target.value)
  }

  const handleYearsChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedYears(parseInt(e.target.value))
  }

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(paymentLink)
      toast.success('Payment link copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const isGenerateDisabled = totalPrice <= 0 || discountAmount > totalPrice

  return (
    <div className="pt-8 pb-20">
      <div className="max-w-4xl mx-auto px-4 ">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Payment Link</h1>
          <p className="text-gray-600">Generate a custom payment link for QuickBooks Enterprise</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Config Form */}
          <div className="bg-white border p-6 rounded-lg shadow-[5px_5px_0px_0px_rgba(109,40,217)] space-y-6">
            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Edition</label>
              <select
                value={selectedEdition}
                onChange={handleEditionChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {editions.map((e) => (
                  <option key={e.value} value={e.name}>
                    QuickBooks Enterprise 24.0 {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Number of Users</label>
              <input
                type="number"
                min="1"
                value={users}
                onChange={handleUsersChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Subscription Duration</label>
              <select
                value={selectedYears}
                onChange={handleYearsChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {yearOptions.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Total Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalPrice}
                onChange={handleTotalPriceChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Discount Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={handleDiscountChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Summary + Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 border rounded-lg shadow-[5px_5px_0px_0px_rgba(109,40,217)]">
              <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Edition:</span>
                  <span>QuickBooks 24.0 {selectedEdition}</span>
                </div>
                <div className="flex justify-between">
                  <span>Users:</span>
                  <span>{users}</span>
                </div>
                <div className="flex justify-between">
                  <span>Years:</span>
                  <span>{selectedYears}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="text-red-500">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="bg-white p-6 border rounded-lg shadow-[5px_5px_0px_0px_rgba(109,40,217)]">
              <h3 className="font-semibold text-lg mb-4">Actions</h3>
              {paymentLink ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={paymentLink}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => setPaymentLink('')}
                    className="w-full py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Generate New Link
                  </button>
                </div>
              ) : (
                <button
                  onClick={generatePaymentLink}
                  disabled={isGenerateDisabled}
                  className="w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Generate Payment Link
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}