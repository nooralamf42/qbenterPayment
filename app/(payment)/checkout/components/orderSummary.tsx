'use client'

import useParamPaymentDetails from "@/app/hooks/useParamPaymentDetails"
import { useSteps } from "@/app/hooks/useSteps"
import { useUserDetails } from "@/app/hooks/useUserDetails"
import React from "react"
import toast from "react-hot-toast"
import { PhotoProvider, PhotoView } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'
import Loader from "@/components/loader"

export default function OrderSummary() {
  const { step } = useSteps()
  const { paymentObj } = useParamPaymentDetails({
    enableToast: false,
    noLinkRedirection: true,
    noLoginRedir: true,
  })

  const { userDetails } = useUserDetails()

  const handlePaymentClick = () => {
    const publicKey = process.env.NEXT_PUBLIC_EPAY_PUBLIC_KEY
    const terNO = process.env.NEXT_PUBLIC_EPAY_TER_NO
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin

    if (!publicKey || !terNO) {
      toast.error('Payment gateway not configured. Please contact support.')
      return
    }

    const amount = (paymentObj.total / 100).toFixed(2)
    const productName = `QuickBooks Enterprise ${paymentObj.edition} Edition`
    const fullName = `${userDetails.firstName || ''} ${userDetails.lastName || ''}`.trim()
    const reference = String(paymentObj.time)

    // Build and submit a hidden form to ePay checkout (per ePay developer docs)
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = 'https://gtw.online-epayment.com/checkout'
    form.name = 'ePayCheckoutForm'
    form.style.display = 'none'

    const fields: Record<string, string> = {
      public_key: publicKey,
      terNO: terNO,
      source_url: 'https://www.qualitybusinesstech.us',
      retrycount: '5',
      bill_amt: amount,
      bill_currency: 'USD',
      product_name: productName,
      fullname: fullName,
      bill_email: userDetails.email || '',
      bill_address: userDetails.address || '',
      bill_city: userDetails.city || '',
      bill_state: userDetails.state || '',
      bill_country: userDetails.country || 'US',
      bill_zip: userDetails.zipCode || '',
      bill_phone: userDetails.phone || '',
      reference: reference,
      webhook_url: `${baseUrl}/api/webhooks/epay`,
      return_url: `${baseUrl}/payment-success`,
      checkout_url: `${baseUrl}/checkout`,
    }

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    })

    document.body.appendChild(form)
    toast.success('Redirecting to payment page...')
    form.submit()
  }

  if (paymentObj == null) return <Loader/>

  const { edition, year, total, user, disc } = paymentObj
  const imagePath = `/${edition.toLowerCase()}_${year}y.webp`

  return (
    <div className="bg-gray-50 rounded-lg p-6 shadow-md">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>

      <div className="space-y-4">
        <PhotoProvider>
          <PhotoView src={imagePath}>
            <img src={imagePath} alt="Product Image" />
          </PhotoView>
        </PhotoProvider>

        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900">
              QuickBooks Enterprise {edition} Edition
            </h3>
            <div className="text-sm text-blue-600 space-x-1">
              <span>Edition: {edition}</span>
              <span>|</span>
              <span>Users: {user}</span>
              <span>|</span>
              <span>Years: {year}</span>
            </div>
          </div>

          <div className="text-right">
            <p className="font-semibold text-gray-900">${(total / 100) + disc}</p>
          </div>
        </div>

        {disc > 0 && (
          <div className="border border-dashed border-green-400 rounded-md bg-green-50 p-4 mt-4">
            <p className="text-sm text-green-700 font-medium">Discount Applied</p>
            <div className="mt-1 text-sm text-gray-800">
              <p>
                💸 You saved <strong>${disc}</strong> today.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total due today</span>
            <span className="text-lg font-bold text-gray-900">${total / 100}</span>
          </div>
        </div>

        {step === 3 && (
          <button
            onClick={handlePaymentClick}
            className="mt-8 w-full bg-[#2ca01c] hover:bg-[#228c15] text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            Pay Now
          </button>
        )}
      </div>
    </div>
  )
}
