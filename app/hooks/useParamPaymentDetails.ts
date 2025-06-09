import toast from "react-hot-toast"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const useParamPaymentDetails = ({ noLinkRedirection, enableToast, noLoginRedir }: { noLinkRedirection: boolean, enableToast: boolean, noLoginRedir?: boolean}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paymentBase64 = searchParams.get('payment')
  const [paymentObj, setPaymentObj] = useState<any>(null)

  useEffect(() => {
    if (!paymentBase64) {
      if (enableToast) toast.error('No payment link found')
      setPaymentObj({ error: 'No payment link found' })
      if (noLinkRedirection) router.push('/broken-link')

      return
    }

    try {
      const parsed = JSON.parse(atob(paymentBase64))
      setPaymentObj(parsed)
      // ✅ Only push if needed — prevent redirect loop

      if(!noLoginRedir) router.push('/login?payment=' + paymentBase64)

    } catch (error) {
      if (enableToast) toast.error('Invalid payment link')
      setPaymentObj({ error: 'Invalid payment link' })
      router.push('/broken-link')
    }
  }, [paymentBase64, router])

  return { paymentObj, paymentBase64 }
}

export default useParamPaymentDetails
