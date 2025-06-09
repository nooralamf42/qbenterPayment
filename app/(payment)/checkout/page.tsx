'use client';

import { useState } from 'react';
import CompanyInfo from './components/companyInfo';
import ContactInfo from './components/contactInfo';
import OrderSummary from './components/orderSummary';
import BusinessAddress from './components/businessAddress';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import { useRouter } from 'next/navigation';
import { useSteps } from '@/app/hooks/useSteps';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useCreateGuestUser } from '@/app/hooks/useCreateGuestUser';
import toast from 'react-hot-toast';

export default function CheckoutForm() {
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
                <img className='max-w-[200px] mb-10 mt-5' src="/quickbooks_logo.svg" alt="" />
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Great! One last step</h1>
                    <p className="text-gray-600">Add your billing information. You can review your cart again before you place the order</p>
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
                                    className="mt-8 bg-[#2ca01c] hover:bg-[#2ca01c] text-white px-6 py-2 rounded-md font-medium transition-colors cursor-pointer"
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

