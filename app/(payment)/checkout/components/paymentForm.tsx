'use client';

import React, { useState } from 'react';
import { CreditCard, AlertTriangle, Edit} from 'lucide-react';
import toast from 'react-hot-toast';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useSteps } from '@/app/hooks/useSteps';

interface FormData {
  // Company Information
  companyName: string;
  // Contact Information
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  // Payment Information
  cardNumber: string;
  month: string;
  year: string;
  cvv: string;
  // Billing Address
  address: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
}

interface FormErrors {
  [key: string]: string;
}

const PaymentForm = ({updateUserDetails}: {updateUserDetails: (userDetails: any) => void}) => {
  const [formData, setFormData] = useState<FormData>({
    // Company Information
    companyName: '',
    // Contact Information
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    // Payment Information
    cardNumber: '',
    month: '',
    year: '',
    cvv: '',
    // Billing Address
    address: '',
    zipCode: '',
    city: '',
    state: '',
    country: ''
  });

  const { paymentObj } = useParamPaymentDetails({
    enableToast: false,
    noLinkRedirection: true,
    noLoginRedir: true,
  })

  const {setStep, step} = useSteps()
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, setIsPending] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Company Information
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    // Contact Information
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Payment Information
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 16) {
      newErrors.cardNumber = 'Card number is required and must be 16 digits';
    }

    if (!formData.month) {
      newErrors.month = 'Month is required';
    }

    if (!formData.year) {
      newErrors.year = 'Year is required';
    }

    if (!formData.cvv || formData.cvv.length < 3) {
      newErrors.cvv = 'CVV is required and must be 3-4 digits';
    }

    // Billing Address
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.country) {
      newErrors.country = 'Country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatCardNumber = (value: string): string => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts: string[] = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleInputChange = (field: keyof FormData, value: string): void => {
    let processedValue = value;
    
    if (field === 'cardNumber') {
      processedValue = formatCardNumber(value);
    }
    if (field === 'cvv') {
      processedValue = value.replace(/[^0-9]/g, '').slice(0, 4);
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = (): void => {
    if (validateForm()) {
      setIsPending(true);
      // Simulate processing
      setTimeout(() => {
        setIsPending(false);
        setIsSubmitted(true);
        setIsEditing(false);
        updateUserDetails({...formData, product_id: `${paymentObj.edition}${paymentObj.year}y`, product_description: `QuickBooks Enterprise ${paymentObj.edition} Edition of ${paymentObj.year} years for ${paymentObj.user} users`, amount: (paymentObj.total).toString(), cardExpirationDate: `${formData.year}-${formData.month}`, cardNumber: formData.cardNumber.replaceAll(' ', '')})
        setStep(3)
      }, 500);
    } else {
      toast.error('Please fill in all required fields correctly');
    }
  };

  const handleEdit = (): void => {
    setIsEditing(true);
    setIsSubmitted(false);
    setStep(2)
  };


  const months = [
    { value: '01', label: '01' },
    { value: '02', label: '02' },
    { value: '03', label: '03' },
    { value: '04', label: '04' },
    { value: '05', label: '05' },
    { value: '06', label: '06' },
    { value: '07', label: '07' },
    { value: '08', label: '08' },
    { value: '09', label: '09' },
    { value: '10', label: '10' },
    { value: '11', label: '11' },
    { value: '12', label: '12' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);

  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ];

  const countries = [
    { value: 'US', label: 'United States' }
  ];

  const isFormDisabled = isSubmitted && !isEditing;

  return (
    <div className="lg:col-span-2">
      {/* Success Message and Edit Button */}
      {isSubmitted && !isEditing && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-green-800 font-medium">Payment information submitted successfully!</p>
            </div>
            <button
              onClick={handleEdit}
              className="flex items-center space-x-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      )}

      {/* Company Information */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company information</h2>
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
            Company name
          </label>
          <input
            required
            type="text"
            id="companyName"
            disabled={isFormDisabled}
            value={formData.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.companyName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
            } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
          />
          {errors.companyName && !isFormDisabled && (
            <p className="text-red-600 text-sm mt-1">Required</p>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact information</h2>
        <p className="text-sm text-gray-600 mb-6">Contact used for this order</p>
       
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              id="email"
              disabled={isFormDisabled}
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.email && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone number <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="tel"
              id="phone"
              disabled={isFormDisabled}
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isFormDisabled ? 'bg-gray-50 text-gray-600' : ''
              }`}
            />
          </div>
        </div>
       
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
              First name
            </label>
            <input
              type="text"
              required
              id="firstName"
              disabled={isFormDisabled}
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.firstName && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
              Last name
            </label>
            <input
              type="text"
              id="lastName"
              required
              disabled={isFormDisabled}
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.lastName && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment information</h2>
      
      <div className="space-y-4">
        {/* Payment Method */}
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 bg-[#2ca01c] rounded-full flex items-center justify-center mt-0.5">
            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
          </div>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-gray-700" />
            <span className="font-medium text-gray-900">Credit/Debit Card</span>
          </div>
        </div>

        {/* Card Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Card number</label>
          <input
            type="text"
            disabled={isFormDisabled}
            value={formData.cardNumber}
            onChange={(e) => handleInputChange('cardNumber', e.target.value)}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              errors.cardNumber ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
            } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
          />
          {errors.cardNumber && !isFormDisabled && (
            <p className="text-red-600 text-sm mt-1 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.cardNumber}
            </p>
          )}
        </div>

        {/* Month, Year, CVV */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <select
              disabled={isFormDisabled}
              value={formData.month}
              onChange={(e) => handleInputChange('month', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.month ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            >
              <option value="">Month</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            {errors.month && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              disabled={isFormDisabled}
              value={formData.year}
              onChange={(e) => handleInputChange('year', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.year ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            >
              <option value="">Year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {errors.year && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={formData.cvv}
              onChange={(e) => handleInputChange('cvv', e.target.value)}
              placeholder="123"
              maxLength={4}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.cvv ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.cvv && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Required
              </p>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First name</label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.firstName && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last name</label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.lastName && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
          <input
            type="text"
            disabled={isFormDisabled}
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              errors.address ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
            } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
          />
          {errors.address && !isFormDisabled && (
            <p className="text-red-600 text-sm mt-1">Required</p>
          )}
        </div>

        {/* ZIP Code and City */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP code</label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={formData.zipCode}
              onChange={(e) => handleInputChange('zipCode', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.zipCode ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.zipCode && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.city ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            />
            {errors.city && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>
        </div>

        {/* State and Country */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
            <select
              disabled={isFormDisabled}
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.state ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {errors.state && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
            <select
              disabled={isFormDisabled}
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.country ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              } ${isFormDisabled ? 'bg-gray-50 text-gray-600' : ''}`}
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
            {errors.country && !isFormDisabled && (
              <p className="text-red-600 text-sm mt-1">Required</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {step === 2 && (
          <div className="mt-8">
            {!isSubmitted  && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmit}
                className="w-full bg-[#2ca01c] hover:bg-[#228c15] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-medium transition-colors"
              >
                {isPending ? "Processing..." : "Save"}
              </button>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentForm;