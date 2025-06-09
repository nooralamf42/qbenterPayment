'use client'
import { useAdmin } from '@/app/hooks/useAdmin';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

const AdminLogin = () => {
    const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const admin = useAdmin();
    const router = useRouter(); 

    useEffect(() => {
        const stored = localStorage.getItem('adminAuth');
        if (stored) {
            const parsed = JSON.parse(stored);
            const now = new Date().getTime();

            if (parsed.expires > now && parsed.password === ADMIN_PASS) {
                admin.setAdmin(true);
                router.push('/admin/create-payment-link');
            } else {
                localStorage.removeItem('adminAuth');
            }
        }
    }, []);

    const handleSignIn = (e: React.FormEvent) => {
        e.preventDefault();

        if (password && password === ADMIN_PASS) {
            admin.setAdmin(true);
            router.push('/admin/create-payment-link');

            if (rememberMe) {
                const expires = new Date().getTime() + 7 * 24 * 60 * 60 * 1000; // 7 days
                localStorage.setItem('adminAuth', JSON.stringify({ password, expires }));
            }
        } else {
            toast.error('Invalid password');
        }
    };

    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleSignIn} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                <div className="mb-5">
                    <Image src="/logo.svg" className='mx-auto' alt="Intuit Logo" width={100} height={100} />
                </div>

                <h2 className="text-xl font-semibold text-gray-800 text-center mb-8 font-normal">
                    Let's get you in to QuickBooks
                </h2>

                {/* Password Input */}
                <div className="mb-6 relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter Admin Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value.replace('$', ''))}
                        className="w-full px-4 py-3 border-2 border-[#2ca01c] rounded focus:outline-none focus:border-blue-500 text-gray-700 pr-12"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-900"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>

                {/* Remember Me */}
                <div className="flex items-center mb-6">
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={() => setRememberMe(!rememberMe)}
                        id="rememberMe"
                        className="mr-2"
                    />
                    <label htmlFor="rememberMe" className="text-sm text-gray-700">Remember me</label>
                </div>

                {/* Sign In Button */}
                <button
                    type='submit'
                    className="w-full bg-[#2ca01c] hover:bg-[#2CA01C] text-white py-3 px-4 rounded font-medium transition-colors duration-200 flex items-center justify-center"
                >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Sign in
                </button>

                <p className='text-gray-400 text-xs mt-5 leading-4'>
                    By selecting Sign in for your Intuit Account, you agree to our <Link href="/terms" className='text-blue-600 hover:text-blue-800'>Terms</Link>. Our <Link className='text-blue-600 hover:text-blue-800' href="/privacy">Privacy Policy</Link> applies to your personal data.
                </p>
            </form>
        </div>
    );
};

export default AdminLogin;
