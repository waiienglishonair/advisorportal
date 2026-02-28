'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthView() {
    const [view, setView] = useState<'login' | 'register'>('login');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        const form = e.currentTarget;
        const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;

        try {
            const { data, error } = await supabase.from('users').select('*').ilike('email', email);
            if (error) throw error;

            const user = data?.[0];

            if (!user) {
                setError('User not found.');
                return;
            }

            if (!user.password) {
                setError('Please register password first.');
                return;
            }

            if (user.password !== password) {
                setError('Incorrect password.');
                return;
            }

            // Simple session management mirroring the legacy setup
            localStorage.setItem('portal_user', JSON.stringify(user));
            window.location.href = '/';

        } catch (err: any) {
            setError(err.message || 'Login failed');
        }
    };

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const form = e.currentTarget;
        const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value;

        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }

        try {
            // Exactly mirror code.gs: Check if email is authorized
            const { data, error } = await supabase.from('users').select('*').ilike('email', email);
            if (error) throw error;

            const user = data?.[0];

            if (!user) {
                setError("Email not authorized.");
                return;
            }

            if (user.password) {
                setError("Already registered.");
                return;
            }

            // Update the user record with the new password
            const { error: updateError } = await supabase
                .from('users')
                .update({ password })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setSuccess("Registration successful! You can now log in.");
            setView('login');

        } catch (err: any) {
            setError(err.message || 'Registration failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-400 font-medium text-sm text-brand-900">
            <div className="w-full max-w-md p-4">

                {view === 'login' ? (
                    <div className="animate-fade-in bg-white rounded-[40px] shadow-2xl p-8 md:p-12 border border-brand-100 font-bold">
                        <h2 className="text-3xl md:text-4xl font-black text-center mb-6 md:mb-10 text-brand-800 tracking-tighter uppercase">
                            Advisor Portal
                        </h2>

                        {error && (
                            <div className="mb-6 p-5 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-bold">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
                            <input
                                name="email"
                                type="email"
                                placeholder="Work Email"
                                required
                                className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl focus:border-blue-500 outline-none font-bold placeholder:text-gray-400"
                            />
                            <input
                                name="password"
                                type="password"
                                placeholder="Password"
                                required
                                className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl focus:border-blue-500 outline-none font-bold placeholder:text-gray-400"
                            />
                            <div className="flex items-center gap-2 ml-1">
                                <input
                                    type="checkbox"
                                    id="login-remember"
                                    className="w-4 h-4 rounded border-brand-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="login-remember" className="text-xs font-bold text-brand-500 cursor-pointer select-none">
                                    Remember Me
                                </label>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black hover:bg-blue-700 shadow-xl uppercase tracking-widest text-xs transition-colors"
                            >
                                Sign In
                            </button>
                        </form>

                        <p className="mt-8 md:mt-12 text-center text-xs text-brand-500 font-bold uppercase tracking-widest">
                            New staff?{' '}
                            <button
                                onClick={() => setView('register')}
                                className="text-blue-600 cursor-pointer hover:underline font-black"
                            >
                                Register
                            </button>
                        </p>
                    </div>
                ) : (
                    <div className="animate-fade-in bg-white rounded-[40px] shadow-2xl p-8 md:p-12 border border-brand-100 font-bold">
                        <h2 className="text-3xl md:text-4xl font-black text-center mb-6 md:mb-10 text-brand-800 tracking-tighter uppercase">
                            Register
                        </h2>

                        {error && (
                            <div className="mb-6 p-5 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-bold">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="mb-6 p-5 bg-green-50 text-green-700 text-sm rounded-2xl border border-green-100 font-bold">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-4 md:space-y-6">
                            <input
                                name="email"
                                type="email"
                                placeholder="Approved Email"
                                required
                                className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl outline-none font-bold placeholder:text-gray-400 focus:border-blue-500"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                    name="password"
                                    type="password"
                                    placeholder="Password"
                                    required
                                    className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl outline-none font-bold placeholder:text-gray-400 focus:border-blue-500"
                                />
                                <input
                                    name="confirm"
                                    type="password"
                                    placeholder="Confirm"
                                    required
                                    className="w-full px-6 py-4 border-2 border-brand-100 rounded-xl outline-none font-bold placeholder:text-gray-400 focus:border-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-green-600 text-white py-5 rounded-2xl font-black hover:bg-green-700 shadow-lg uppercase tracking-widest text-xs transition-colors"
                            >
                                Activate
                            </button>
                        </form>

                        <p className="mt-8 md:mt-12 text-center text-xs text-brand-500 font-bold uppercase tracking-widest">
                            <button
                                onClick={() => setView('login')}
                                className="text-blue-600 cursor-pointer hover:underline font-black"
                            >
                                Back to Login
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
