'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Menu, Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Exclude the login route from redirection
        if (pathname === '/login') {
            setLoading(false);
            return;
        }

        const session = localStorage.getItem('portal_user');
        if (!session) {
            router.push('/login');
        } else {
            setUser(JSON.parse(session));
            setLoading(false);
        }
    }, [pathname, router]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-brand-400">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
        );
    }

    // Don't render sidebar shell on login page
    if (pathname === '/login') {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen bg-brand-400 overflow-hidden text-brand-900">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                user={user}
            />

            <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-brand-50 via-brand-100 to-brand-200">
                {/* Mobile Header */}
                <header className="md:hidden bg-brand-900 text-white p-4 flex justify-between items-center shadow-md z-30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg">
                            A
                        </div>
                        <h1 className="text-sm font-black text-white tracking-tight uppercase">Advisor Hub</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white">
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-6 md:p-12 pb-20 md:pb-12">
                    {children}
                </main>
            </div>
        </div>
    );
}
