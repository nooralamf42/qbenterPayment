'use client'

import React, { useEffect } from 'react'
import IntuitLogin from './(payment)/login/page'
import useParamPaymentDetails from './hooks/useParamPaymentDetails'


const PaymentLoginPage = () => {
  const {paymentObj} = useParamPaymentDetails({enableToast: true, noLinkRedirection: false})
  
  return (
    <div>
      <IntuitLogin/>
     </div>
  )
}

export default PaymentLoginPage