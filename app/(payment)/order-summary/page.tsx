'use client';

import { useState, useRef } from 'react';
import CompanyInfo from '@/app/(payment)/checkout/components/companyInfo';
import ContactInfo from '@/app/(payment)/checkout/components/contactInfo';
import BusinessAddress from '@/app/(payment)/checkout/components/businessAddress';
import OrderSummary from './components/orderSummary';
import StripePaymentForm from './components/StripePaymentForm';
import MorPaymentForm from './components/MorPaymentForm';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import { useSteps } from '@/app/hooks/useSteps';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useAuthorizeCheckout } from '@/app/hooks/useAuthorizeCheckout';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';

export default function OrderSummaryPage() {
    const { paymentObj, paymentBase64 } = useParamPaymentDetails({ enableToast: false, noLinkRedirection: true, noLoginRedir: true });
    const { step, setStep } = useSteps();
    const { setUserDetails } = useUserDetails();
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isSubmittingStripe, setIsSubmittingStripe] = useState(false);
    const [isSubmittingAntom, setIsSubmittingAntom] = useState(false);
    const [isSubmittingShopify, setIsSubmittingShopify] = useState(false);
    const [isSubmittingMor, setIsSubmittingMor] = useState(false);
    const [isSubmittingPaydollar, setIsSubmittingPaydollar] = useState(false);
    const [stripeClientSecret, setStripeClientSecret] = useState<string>('');
    const [stripeLocalOrderId, setStripeLocalOrderId] = useState<string>('');
    const [morCheckoutUrl, setMorCheckoutUrl] = useState<string>('');
    const [clientSignatureBase64, setClientSignatureBase64] = useState<string>('');
    const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const sigCanvas = useRef<SignatureCanvas>(null);

    // Online Payment state
    const [onlinePaymentType, setOnlinePaymentType] = useState<'wire_ach' | 'credit_card' | 'transaction_id' | ''>('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [isSubmittingOnline, setIsSubmittingOnline] = useState(false);

    const updateTypedSignature = (text: string) => {
        setTypedSignature(text);
        if (!text.trim()) {
            setClientSignatureBase64('');
            return;
        }
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.font = '56px "Caveat", cursive';
            const metrics = tempCtx.measureText(text);
            const textWidth = Math.max(metrics.width, 50);
            
            const canvas = document.createElement('canvas');
            canvas.width = textWidth + 20;
            canvas.height = 70;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.font = '56px "Caveat", cursive';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);
                setClientSignatureBase64(canvas.toDataURL('image/png'));
            }
        }
    };

    const [formData, setFormData] = useState({
        companyName: '',
        email:       '',
        phone:       '',
        firstName:   '',
        lastName:    '',
        country:     'US',
        address:     '',
        zipCode:     '',
        city:        '',
        state:       '',
        ein:         '',
    });

    const getTrimmedDataURL = (sigCanvasRef: any) => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return '';
        const canvas = sigCanvasRef.current.getCanvas();
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return canvas.toDataURL('image/png');
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const l = pixels.data.length;
            const bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
            
            for (let i = 0; i < l; i += 4) {
                if (pixels.data[i + 3] > 0) {
                    const x = (i / 4) % canvas.width;
                    const y = Math.floor((i / 4) / canvas.width);
                    if (bound.top === null) bound.top = y;
                    if (bound.left === null) bound.left = x;
                    else if (x < bound.left) bound.left = x;
                    if (bound.right === null) bound.right = x;
                    else if (bound.right < x) bound.right = x;
                    if (bound.bottom === null) bound.bottom = y;
                    else if (bound.bottom < y) bound.bottom = y;
                }
            }
            
            if (bound.top === null || bound.bottom === null || bound.left === null || bound.right === null) return canvas.toDataURL('image/png');
            
            const p = 6;
            const trimHeight = bound.bottom - bound.top + p * 2;
            const trimWidth = bound.right - bound.left + p * 2;
            const trimmed = document.createElement('canvas');
            trimmed.width = trimWidth;
            trimmed.height = trimHeight;
            const tCtx = trimmed.getContext('2d');
            if (tCtx) {
                const sx = Math.max(0, bound.left - p);
                const sy = Math.max(0, bound.top - p);
                const sw = Math.min(canvas.width - sx, trimWidth);
                const sh = Math.min(canvas.height - sy, trimHeight);
                tCtx.putImageData(ctx.getImageData(sx, sy, sw, sh), 0, 0);
            }
            return trimmed.toDataURL('image/png');
        } catch (e) {
            return canvas.toDataURL('image/png');
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const { checkout: authCheckout, isPending: authIsPending } = useAuthorizeCheckout();

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUserDetails({ ...formData });

        fetch('/api/track-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'form_filled',
                paymentId: paymentBase64,
                email: formData.email,
                amount: paymentObj?.total ? paymentObj.total / 100 : undefined,
            }),
        }).catch(console.error);

        try {
            if (paymentObj?.gateway === 'Authorize.net') {
                const amountUSD = paymentObj?.total ? paymentObj.total / 100 : undefined;
                await authCheckout({
                    productPath: 'quickbooks-enterprise',
                    quantity: 1,
                    amountUSD,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    companyName: formData.companyName,
                    ein: formData.ein,
                    phone: formData.phone,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: formData.country,
                    agreedToTerms: agreedToTerms ? 'true' : 'false',
                    clientSignatureBase64: clientSignatureBase64,
                    planDetails: paymentObj?.isService
                        ? paymentObj.serviceName
                        : paymentObj?.edition
                        ? paymentObj.edition.toLowerCase() === 'fsp'
                            ? 'QuickBooks Enterprise FSP Edition'
                            : `QuickBooks Enterprise ${paymentObj.edition.charAt(0).toUpperCase() + paymentObj.edition.slice(1)} Edition`
                        : undefined,
                    linkToken: paymentBase64 || undefined,
                });
            } else if (paymentObj?.gateway === 'Online Payment') {
                if (!onlinePaymentType) {
                    toast.error('Please select a payment method.');
                    return;
                }
                if (!proofFile) {
                    toast.error('Please upload your payment proof (image or PDF).');
                    return;
                }

                setIsSubmittingOnline(true);
                const amountUSD = paymentObj?.total ? paymentObj.total / 100 : 0;
                const planDetails = paymentObj?.isService
                    ? paymentObj.serviceName
                    : paymentObj?.edition
                    ? `QuickBooks Enterprise ${paymentObj.edition}`
                    : undefined;

                const submitRes = await fetch('/api/online-payment/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        email: formData.email,
                        phone: formData.phone,
                        companyName: formData.companyName,
                        ein: formData.ein,
                        address: formData.address,
                        city: formData.city,
                        state: formData.state,
                        zipCode: formData.zipCode,
                        country: formData.country,
                        amountUSD,
                        planDetails,
                        agreedToTerms: agreedToTerms ? 'true' : 'false',
                        clientSignatureBase64,
                        paymentType: onlinePaymentType,
                        linkToken: paymentBase64 || undefined,
                    }),
                });

                if (!submitRes.ok) {
                    throw new Error('Failed to create payment record.');
                }

                const { localOrderId } = await submitRes.json();

                const fd = new FormData();
                fd.append('file', proofFile);
                await fetch(`/api/online-payment/upload-proof?orderId=${localOrderId}`, {
                    method: 'POST',
                    body: fd,
                });

                setIsSubmittingOnline(false);
                toast.success('Payment proof submitted successfully!');
                window.location.href = '/payment-success';
            } else {
                toast.success('Payment authorized successfully!');
                window.location.href = '/payment-success';
            }
        } catch (err: any) {
            setIsSubmittingOnline(false);
            setIsSubmittingStripe(false);
            setIsSubmittingAntom(false);
            setIsSubmittingShopify(false);
            setIsSubmittingPaydollar(false);
            toast.error(err?.message || 'Failed to start checkout. Please try again.');
        }
    };

    return (
        <div className="min-h-screen py-8 px-5">
            <div className="max-w-7xl mx-auto">
                <img className='max-w-[200px] mb-10 mt-5' src="/quickbooks_logo.png" alt="Logo" />
                <div className="mb-8 mt-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
                    <p className="text-gray-600">Enter billing information to proceed.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <form onSubmit={handleSave} className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                            {!stripeClientSecret && !morCheckoutUrl ? (
                                <>
                                    <CompanyInfo
                                        companyName={formData.companyName}
                                        onChange={(v) => handleInputChange('companyName', v)}
                                    />

                            <div className="border-t border-gray-200 my-8" />

                            <ContactInfo
                                email={formData.email}
                                phone={formData.phone}
                                firstName={formData.firstName}
                                lastName={formData.lastName}
                                onChange={handleInputChange}
                            />

                            <div className="border-t border-gray-200 my-8" />

                            <BusinessAddress
                                country={formData.country}
                                address={formData.address}
                                zipCode={formData.zipCode}
                                city={formData.city}
                                state={formData.state}
                                onChange={handleInputChange}
                            />

                            <div className="border-t border-gray-200 my-8" />
                            
                            {/* Signature Pad */}
                            <div className="mt-6 mb-8">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Please sign below to authorize this payment <span className="text-red-500">*</span>
                                </label>
                                
                                <div className="flex space-x-4 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureMode('draw');
                                            if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                                                setClientSignatureBase64(getTrimmedDataURL(sigCanvas));
                                            } else {
                                                setClientSignatureBase64('');
                                            }
                                        }}
                                        className={`px-4 py-2 text-sm font-medium rounded-md ${signatureMode === 'draw' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        Draw Signature
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureMode('type');
                                            updateTypedSignature(typedSignature);
                                        }}
                                        className={`px-4 py-2 text-sm font-medium rounded-md ${signatureMode === 'type' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        Type Signature
                                    </button>
                                </div>

                                {signatureMode === 'draw' ? (
                                    <>
                                        <div className="border-2 border-gray-300 rounded-md bg-white" style={{ height: '150px' }}>
                                            <SignatureCanvas 
                                                ref={sigCanvas}
                                                penColor="black"
                                                canvasProps={{ className: 'w-full h-full' }}
                                                onEnd={() => {
                                                    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                                                        setClientSignatureBase64(getTrimmedDataURL(sigCanvas));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    sigCanvas.current?.clear();
                                                    setClientSignatureBase64('');
                                                }}
                                                className="text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                Clear Signature
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="border border-gray-300 rounded-md bg-white p-6">
                                        <div className="mb-4">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                                Enter your full name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. John Doe"
                                                value={typedSignature}
                                                onChange={(e) => updateTypedSignature(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2ca01c] focus:border-transparent text-gray-900"
                                            />
                                        </div>
                                        
                                        <div className="mt-4">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                                Preview
                                            </label>
                                            <div className="relative bg-gray-50 rounded-md border border-gray-200 h-32 flex items-center justify-center overflow-hidden">
                                                <div className="absolute bottom-8 left-8 right-8 border-b-2 border-gray-300"></div>
                                                <div className="absolute bottom-9 left-8 text-gray-400 font-bold text-lg">X</div>
                                                {typedSignature ? (
                                                    <div 
                                                        className="text-5xl text-black z-10 select-none" 
                                                        style={{ fontFamily: '"Caveat", cursive' }}
                                                    >
                                                        {typedSignature}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-400 text-lg z-10 select-none italic pb-2">
                                                        Your signature will appear here
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Online Payment: Method dropdown */}
                            {paymentObj?.gateway === 'Online Payment' && (
                                <div className="mt-6 mb-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Payment Method <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="online-payment-type"
                                        value={onlinePaymentType}
                                        onChange={(e) => setOnlinePaymentType(e.target.value as 'wire_ach' | 'credit_card' | 'transaction_id')}
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2ca01c] focus:border-transparent text-gray-700 text-sm bg-white cursor-pointer"
                                    >
                                        <option value="" disabled>Select payment method...</option>
                                        <option value="wire_ach">Wire/ACH</option>
                                        <option value="credit_card">Credit Card</option>
                                    </select>
                                </div>
                            )}

                            <div className="mt-6 flex items-start">
                                <input
                                    id="terms"
                                    type="checkbox"
                                    required
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="focus:ring-[#2ca01c] h-4 w-4 text-[#2ca01c] border-gray-300 rounded cursor-pointer mt-0.5"
                                />
                                <label htmlFor="terms" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer select-none">
                                    I agree to the Terms of Service.
                                </label>
                            </div>
                            
                            <div className="mt-6">
                                <p className="text-[10px] leading-snug text-gray-400">
                                    <strong>Disclaimer:</strong> quickbooks-solutions.com is an independent third-party service provider and is NOT affiliated with, endorsed by, or sponsored by Intuit Inc. QuickBooks is a registered trademark of Intuit Inc.
                                </p>
                            </div>

                            {paymentObj?.gateway === 'Online Payment' ? (
                                <div className="mt-8 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Upload Payment Proof <span className="text-red-500">*</span>
                                            <span className="ml-2 text-xs font-normal text-gray-500">(PDF or image — max 10MB)</span>
                                        </label>
                                        <label
                                            htmlFor="payment-proof-file"
                                            className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-[#2ca01c] hover:bg-green-50 transition-colors group"
                                        >
                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-[#2ca01c] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span className="text-sm text-gray-600 group-hover:text-gray-800">
                                                {proofFile ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900">{proofFile.name}</span>
                                                    </span>
                                                ) : 'Click to select file...'}
                                            </span>
                                        </label>
                                        <input
                                            id="payment-proof-file"
                                            type="file"
                                            accept="image/*,application/pdf"
                                            className="sr-only"
                                            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                                        />
                                    </div>

                                    <button
                                        disabled={isSubmittingOnline || !clientSignatureBase64 || !onlinePaymentType || !proofFile}
                                        type="submit"
                                        className="w-full bg-[#2ca01c] hover:bg-[#248a18] text-white px-6 py-2.5 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingOnline ? 'Uploading...' : 'Submit Payment Proof'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    disabled={authIsPending || isSubmittingStripe || isSubmittingAntom || isSubmittingShopify || isSubmittingMor || isSubmittingPaydollar || !clientSignatureBase64}
                                    type="submit"
                                    className="mt-8 bg-[#2ca01c] hover:bg-[#248a18] text-white px-6 py-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {authIsPending || isSubmittingStripe || isSubmittingAntom || isSubmittingShopify || isSubmittingMor || isSubmittingPaydollar ? 'Connecting...' : 'Proceed to Payment'}
                                </button>
                            )}
                            </>
                            ) : stripeClientSecret ? (
                                <StripePaymentForm
                                    clientSecret={stripeClientSecret}
                                    localOrderId={stripeLocalOrderId}
                                />
                            ) : (
                                <MorPaymentForm checkoutUrl={morCheckoutUrl} />
                            )}
                        </div>
                    </form>

                    <div className="lg:col-span-1">
                        <OrderSummary />
                    </div>
                </div>
            </div>
        </div>
    );
}
