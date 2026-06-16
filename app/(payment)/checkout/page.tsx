'use client';

import { useState } from 'react';
import CompanyInfo from './components/companyInfo';
import ContactInfo from './components/contactInfo';
import OrderSummary from './components/orderSummary';
import BusinessAddress from './components/businessAddress';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSteps } from '@/app/hooks/useSteps';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useCreateGuestUser } from '@/app/hooks/useCreateGuestUser';
import toast from 'react-hot-toast';
import Loader from '@/components/loader';

export default function CheckoutForm() {
    const searchParams = useSearchParams()
    const planParam = searchParams.get('plan')
    const isValidPlan = planParam && ['foundation', 'growth', 'enterprise'].includes(planParam.toLowerCase())

    const {paymentObj} = useParamPaymentDetails({enableToast: false, noLinkRedirection: true , noLoginRedir:true})
    const {setStep, step} = useSteps()


    const {setUserDetails, userDetails} = useUserDetails()
    const [formData, setFormData] = useState({
        companyName: '',
        email: '',
        phone: '',
        firstName: '',
        lastName: '',
        country: '',
        address: '',
        zipCode: '',
        city: '',
        state: ''
    });

    const handleInputChange = (field: any, value: string): void => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const {mutateAsync, isPending, isSuccess} = useCreateGuestUser()

    if (step < 2) {
        return <Loader />;
    }
    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        mutateAsync({firstName: formData.firstName, lastName: formData.lastName, email: formData.email}).then((res) => {
            setUserDetails({...formData, guestUserId: res.id})
            setStep(3)
            toast.success('Saved Details')
        }).catch(()=>{
            toast.error('Internal Server Error! Try again')
        })
    };

    return (
        <div className="min-h-screen py-8 px-5">
            
            <div className="max-w-7xl mx-auto">
                {isValidPlan ? (
                    <div className="overflow-hidden w-[240px] h-[65px] mb-8 mt-5 flex items-center justify-center relative">
                        <img 
                            src="https://cdn.prod.website-files.com/698b7c9f3439798abd8f9be1/69b41eb99fc693b2ed54dd3f_unnamed__10_-removebg-preview-p-500.png" 
                            alt="Quality Business Logo" 
                            className="w-[310px] max-w-none h-auto" 
                        />
                    </div>
                ) : (
                    <img 
                        className='max-w-[200px] mb-10 mt-5 object-contain' 
                        src="https://www.quickbooks-enterprises.com/quickbooks_logo.png" 
                        alt="Logo" 
                    />
                )}
                <div className="mb-8 mt-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {isValidPlan ? 'Complete Your Purchase' : 'Complete Your Payment'}
                    </h1>
                    <p className="text-gray-600">
                        {isValidPlan 
                            ? 'Enter billing information to proceed with your Quality Business plan.' 
                            : 'Enter billing information to proceed.'
                        }
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <form onSubmit={handleSave} className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                            <CompanyInfo
                                companyName={formData.companyName}
                                onChange={(value: string) => handleInputChange('companyName', value)}
                            />

                            <div className="border-t border-gray-200 my-8"></div>

                            <ContactInfo
                                email={formData.email}
                                phone={formData.phone}
                                firstName={formData.firstName}
                                lastName={formData.lastName}
                                onChange={handleInputChange}
                            />

                            <div className="border-t border-gray-200 my-8"></div>

                            <BusinessAddress
                                country={formData.country}
                                address={formData.address}
                                zipCode={formData.zipCode}
                                city={formData.city}
                                state={formData.state}
                                onChange={handleInputChange}
                            />

                            {
                                step !==3 && 
                                (<button
                                    disabled={isPending}
                                    type="submit"
                                    className={`mt-8 text-white px-6 py-2 rounded-md font-medium transition-colors cursor-pointer ${
                                        isValidPlan ? 'bg-black hover:bg-gray-800' : 'bg-[#2ca01c] hover:bg-[#2ca01c]'
                                    }`}
                                >
                                    {isPending ? 'Saving...' : 'Save'}
                                </button>)
                            }
                        </div>
                    </form>

                    {/* Order Summary Section */}
                    <div className="lg:col-span-1">
                        <OrderSummary/>
                    </div>
                </div>
            </div>
        </div>
    );
}

