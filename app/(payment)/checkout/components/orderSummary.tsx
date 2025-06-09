'use client'
import { useCreateTransaction } from "@/app/hooks/useCreateTransaction";
import useParamPaymentDetails from "@/app/hooks/useParamPaymentDetails";
import { useSteps } from "@/app/hooks/useSteps";
import { useUserDetails } from "@/app/hooks/useUserDetails";
import React from "react";
import toast from "react-hot-toast";

export default function OrderSummary() {
  const { step } = useSteps();
  const {paymentObj} = useParamPaymentDetails({enableToast: false, noLinkRedirection: true, noLoginRedir:true })

  

  const {userDetails} = useUserDetails()

  const {mutateAsync, isPending, isSuccess, isError, error} = useCreateTransaction()
  const handlePaymentClick = () => {
    console.log(userDetails)
    const linkDetails = btoa(`name=${userDetails.firstName} ${userDetails.lastName}:line1=${userDetails.address}:city=${userDetails.city}:state=${userDetails.state}:postcode=${userDetails.zipCode}:country=us`)

    mutateAsync({buyer_id: userDetails?.guestUserId, deposit_price: userDetails?.deposit_price, deposit_charge: userDetails.deposit_charge}).then((res) => {
      toast.success('Redirecting to payment page')
      const link = `https://actions.stage.trustap.com/f2f/transactions/${res.id}/pay_deposit?redirect_uri=https://www.qbenterprise.us&state=${linkDetails}`
      window.location.href = link
    })
  }

  if(paymentObj==null) return 'loading'
  const {price, edition, year, total, user} = paymentObj
  const hasDiscount = paymentObj?.disc && paymentObj?.disc > 0;

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Order summary</h2>

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900">
              QuickBooks Enterprise Diamond Edition
            </h3>
            <div className="text-sm text-blue-600 space-x-1">
              <span>Edition: {edition}</span>
              <span>|</span>
              <span>Users: {(user)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900">${price} <br />{year} years</p>
          </div>
        </div>

        {hasDiscount && (
          <div className="border border-dashed border-green-400 rounded-md bg-green-50 p-4 mt-4">
            <p className="text-sm text-green-700 font-medium">Discount Applied</p>
            <div className="mt-1 text-sm text-gray-800">
              <p>
                💸 <strong>{paymentObj?.discPer}% off</strong> — You saved <strong>${paymentObj?.disc}</strong> today.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total due today</span>
            <span className="text-lg font-bold text-gray-900">${total}</span>
          </div>
        </div>

        {step === 3 && (
          <button
          disabled={isPending}
            onClick={handlePaymentClick}
            className="mt-8 w-full cursor-pointer bg-[#2ca01c] hover:bg-[#2ca01c] text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            {isPending ? 'Processing...' : 'Pay Now'}
          </button>
        )}
      </div>
    </div>
  );
}
