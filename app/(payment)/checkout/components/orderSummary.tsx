'use client'

import { useCreateTransaction } from "@/app/hooks/useCreateTransaction"
import useParamPaymentDetails from "@/app/hooks/useParamPaymentDetails"
import { useSteps } from "@/app/hooks/useSteps"
import { useUserDetails } from "@/app/hooks/useUserDetails"
import React from "react"
import toast from "react-hot-toast"
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import Loader from "@/components/loader"

export default function OrderSummary() {
  const { step } = useSteps()
  const { paymentObj } = useParamPaymentDetails({
    enableToast: false,
    noLinkRedirection: true,
    noLoginRedir: true,
  })
  console.log(paymentObj)

  const { userDetails } = useUserDetails()
  const { mutateAsync, isPending } = useCreateTransaction()

  const handlePaymentClick = () => {
    const linkDetails = btoa(
      `name=${userDetails.firstName} ${userDetails.lastName}:line1=${userDetails.address}:city=${userDetails.city}:state=${userDetails.state}:postcode=${userDetails.zipCode}:country=us`
    )

    const paymentDescription = `QuickBooks Enterprise ${paymentObj.edition} Edition Purchase`
    mutateAsync({
      buyer_id: userDetails?.guestUserId,
      deposit_price: Math.floor(paymentObj.total),
      deposit_charge: userDetails.deposit_charge,
      description: paymentDescription,
    })
      .then((res) => {
        toast.success("Redirecting to payment page")
        const link = `https://actions.trustap.com/f2f/transactions/${res.id}/pay_deposit?redirect_uri=https://www.quickbooks-solutions.com/raise-transaction-dispute?buyerId=${res.buyer_id}&state=${linkDetails}`
        window.location.href = link
      })
      .catch(() => {
        toast.error("Internal Server Error! Try again")
      })
  }

  if (paymentObj == null) return <Loader/>

  const { edition, year, total, user, disc } = paymentObj
  console.log(edition, year)
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
            <p className="font-semibold text-gray-900">${(total/100)+disc}</p>
            {/* <p className="text-xs text-gray-500">
              (per user for {year} year{year > 1 ? "s" : ""})
            </p> */}
          </div>
        </div>

        {/* <div className="text-sm text-gray-700 mt-2">
          <p>
            💡 <strong>Breakdown:</strong> ${price*year}  × {user} user{user > 1 ? "s" : ""} <span className="font-semibold"> = ${total}</span>
          </p>
        </div> */}

        {disc>0 && (
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
            <span className="text-lg font-bold text-gray-900">${total/100}</span>
          </div>
        </div>

        {step === 3 && (
          <button
            disabled={isPending}
            onClick={handlePaymentClick}
            className="mt-8 w-full bg-[#2ca01c] hover:bg-[#228c15] text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            {isPending ? "Processing..." : "Pay Now"}
          </button>
        )}
      </div>
    </div>
  )
}
