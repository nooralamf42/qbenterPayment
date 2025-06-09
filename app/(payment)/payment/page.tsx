'use client'

import React from 'react'
import IntuitLogin from '../login/page'
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails'

const PaymentPage = () => {
    const {paymentObj} = useParamPaymentDetails({enableToast: true, noLinkRedirection: true})
  return (
    <IntuitLogin/>
  )
}

export default PaymentPage