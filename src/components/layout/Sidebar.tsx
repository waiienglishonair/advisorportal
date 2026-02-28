'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    BarChart3,
    TrendingUp,
    Star,
    AlertTriangle,
    Settings,
    LogOut,
    Database
} from 'lucide-react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

export default function Sidebar({ isOpen, toggleSidebar, user }: { isOpen: boolean, toggleSidebar: () => void, user?: any }) {
    const pathname = usePathname();
    const router = useRouter();

    const hasAdminAccess = () => {
        if (!user || !user.position) return false;
        const pos = user.position.toLowerCase();
        return pos.includes('dev') || pos.includes('manager') || pos.includes('admin');
    };

    const coreItems = [
        { name: 'Dashboard', href: '/', icon: BarChart3, emoji: '📊' },
        { name: 'Sales Hub', href: '/sales', icon: TrendingUp, emoji: '📈' },
        { name: 'Review Hub', href: '/reviews', icon: Star, emoji: '⭐' },
        { name: 'Error Hub', href: '/errors', icon: AlertTriangle, emoji: '⚠️' }
    ];

    const adminItems = [
        { name: 'Management', href: '/admin', icon: Settings, emoji: '⚙️' },
        { name: 'Manager Dash', href: '/admin/dashboard', icon: BarChart3, emoji: '📉' },
        { name: 'Data Import', href: '/admin/import', icon: Database, emoji: '🗄️' }
    ];

    const renderLink = (item: any) => {
        const isActive = pathname === item.href;
        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={() => { if (window.innerWidth < 768) toggleSidebar(); }}
                className={clsx(
                    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold",
                    isActive
                        ? "bg-white text-brand-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]"
                        : "text-white hover:bg-white/10"
                )}
            >
                <span className="text-xl">{item.emoji}</span>
                {item.name}
            </Link>
        );
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                onClick={toggleSidebar}
                className={clsx(
                    "fixed inset-0 bg-brand-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            />

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 w-72 bg-brand-900 border-r border-brand-800 flex flex-col shrink-0 text-white font-bold shadow-2xl z-50 transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-8 relative">
                    <button onClick={toggleSidebar} className="absolute top-4 right-4 text-brand-400 md:hidden">
                        <span className="text-xl">✕</span>
                    </button>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-100 uppercase">
                            {user?.name?.[0] || 'A'}
                        </div>
                        <h1 className="text-xl font-black text-white tracking-tight uppercase">Advisor Hub</h1>
                    </div>

                    <div className="mt-6 p-5 bg-white/10 rounded-3xl border border-white/10 font-bold text-xs truncate backdrop-blur-sm">
                        <p className="font-black text-white">{user?.name || 'Staff Member'}</p>
                        <p className="text-brand-500 uppercase tracking-widest mt-1">{user?.position || 'Advisor'}</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-4">
                    {coreItems.map(renderLink)}

                    {hasAdminAccess() && (
                        <div className="pt-4 mt-2 border-t border-white/10">
                            <div className="px-5 mb-4 text-[10px] font-black tracking-widest text-brand-400 uppercase">
                                Management Level
                            </div>
                            <div className="space-y-2">
                                {adminItems.map(renderLink)}
                            </div>
                        </div>
                    )}
                </nav>

                <div className="p-6 border-t border-white/10 mt-auto">
                    <button
                        onClick={() => {
                            localStorage.removeItem('portal_user');
                            router.push('/login');
                        }}
                        className="w-full flex items-center justify-center gap-3 px-5 py-4 text-white font-black rounded-2xl hover:bg-red-500/10 hover:text-red-400 uppercase tracking-widest text-[10px] transition-all"
                    >
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </aside>
        </>
    );
}
