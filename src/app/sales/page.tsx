'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Search, Truck, FileText } from 'lucide-react';
import SaleModal from '@/components/sales/SaleModal';
import ViewSaleModal from '@/components/sales/ViewSaleModal';

export default function SalesHub() {
    const [salesData, setSalesData] = useState<any[]>([]);
    const [proshipData, setProshipData] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // User/Auth
    const [user, setUser] = useState<any>(null);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<any>(null);
    const [viewingSale, setViewingSale] = useState<any>(null);

    const [searchTerms, setSearchTerms] = useState({ sales: '', proship: '' });
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('portal_user');
        if (stored) setUser(JSON.parse(stored));

        // Use local timezone explicit padding to avoid UTC .toISOString() shifts
        // Since getMonth() / getDate() uses local timezone:
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const today = `${y}-${m}-${d}`;

        setDateRange({ start: today, end: today });
    }, []);

    useEffect(() => {
        if (dateRange.start && dateRange.end) {
            fetchData();
        }
    }, [dateRange]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const offset = new Date().getTimezoneOffset();
            const sign = offset > 0 ? '-' : '+';
            const absOffset = Math.abs(offset);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const minutes = String(absOffset % 60).padStart(2, '0');
            const tzString = `${sign}${hours}:${minutes}`;

            const startDate = `${dateRange.start}T00:00:00${tzString}`;
            const endDate = `${dateRange.end}T23:59:59${tzString}`;

            const d1 = new Date(startDate).getTime().toString();
            const d2 = new Date(endDate).getTime().toString();
            const payload = { from: d1, to: d2 };

            await fetch('/api/sync/proship', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error("Proship Sync error:", e));

        } catch (err) {
            console.error('Error triggering sync:', err);
        } finally {
            setIsSyncing(false);
            fetchData();
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get local timezone offset, e.g. +07:00 for Thailand
            const offset = new Date().getTimezoneOffset();
            const sign = offset > 0 ? '-' : '+';
            const absOffset = Math.abs(offset);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const minutes = String(absOffset % 60).padStart(2, '0');
            const tzString = `${sign}${hours}:${minutes}`;

            const startDate = `${dateRange.start}T00:00:00${tzString}`;
            const endDate = `${dateRange.end}T23:59:59${tzString}`;

            // Helper to fetch paginated records
            const fetchAll = async (table: string, dateCol: string, isDesc = false) => {
                let allData: any[] = [];
                let rStart = 0;
                const rCount = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data } = await supabase
                        .from(table)
                        .select('*')
                        .gte(dateCol, startDate)
                        .lte(dateCol, endDate)
                        .order(dateCol, { ascending: !isDesc })
                        .range(rStart, rStart + rCount - 1);

                    if (data && data.length > 0) {
                        allData = allData.concat(data);
                        rStart += rCount;
                        if (data.length < rCount) hasMore = false;
                    } else {
                        hasMore = false;
                    }
                }
                return allData;
            };

            // Fetch Products (no pagination for small lookup tables)
            const { data: prodData } = await supabase.from('products_sku').select('*');
            if (prodData) setProducts(prodData);

            // Fetch Sales
            const sData = await fetchAll('sales_report', 'date_time', true);
            setSalesData(sData);

            // Fetch Proship
            const pData = await fetchAll('proship_db', 'created_at', true);
            setProshipData(pData);

            // Fetch Reviews
            // Revert table name to reviewed instead of reviews ? wait, originally it said `reviews` table?
            // Actually it was querying `reviews` which doesn't exist, it's `reviewed`.
            const rData = await fetchAll('reviewed', 'date_time', false);
            setReviews(rData);
        } catch (error) {
            console.error('Error fetching sales hub data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSale = async (payload: any) => {
        try {
            const timestamp = new Date().toISOString();

            const dbPayload = {
                ...payload,
                date_time: editingSale?.date_time || timestamp,
                advisor: user?.name || 'Unknown',
            };

            if (editingSale) {
                // Update existing record
                const { error } = await supabase
                    .from('sales_report')
                    .update(dbPayload)
                    .eq('record_id', editingSale.record_id);
                if (error) throw error;
            } else {
                // Insert new — let Supabase auto-generate UUID for record_id/id
                const { error } = await supabase
                    .from('sales_report')
                    .insert([dbPayload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingSale(null);
            fetchData(); // Refresh table
        } catch (err: any) {
            console.error('Save failed', err?.message || err);
            alert('Failed to save sale: ' + (err?.message || 'Unknown error'));
        }
    };

    const isManager = user?.position?.toLowerCase().includes('manager') || user?.position?.toLowerCase().includes('admin');

    const myName = (user?.name || '').toLowerCase().trim();
    const myEmail = (user?.email || '').toLowerCase().trim();

    // 1. Summary should be each staff value (File Sold)
    const staffSales = salesData.filter(s => {
        if (isManager) return true; // managers see all
        if (!myName) return false; // user not loaded yet — show nothing
        const adv = String(s.advisor || '').toLowerCase().trim();
        return adv === myName || adv === myEmail;
    });

    // 2. Proship should show only each staff (Table & Summary)
    const staffProship = proshipData.filter(p => {
        if (isManager) return true;
        if (!myName) return false;
        const pUser = String(p.user_name || p.user || '').toLowerCase().trim();
        return pUser === myName || pUser === myEmail;
    });

    // --- Metrics Computations ---
    // Only tally if NOT canceled/spam/test for the current staff member
    const validSales = staffSales.filter(s => {
        const cxl = (s.cxl_reason || '').toLowerCase();
        return !['spam', 'test', 'cancel', 'double'].includes(cxl);
    });

    const fileRevenue = validSales.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    const fileUnits = validSales.reduce((acc, curr) => acc + (Number(curr.unit) || 1), 0);

    // For Proship, gross sale is 'sale_amount'. Only tally if Status !='Cancel'
    const validProship = staffProship.filter(p => {
        if (String(p.remarks || '').toLowerCase().includes('exclude')) return false;
        const s = String(p.status || '').toUpperCase();
        return !['DRAFT', 'BLACKLISTED', 'CANCELLED', 'ERROR', 'CANCELLED_SYS', 'RETURNED', 'RETURN_TO_SENDER'].includes(s);
    });
    const proshipRevenue = validProship.reduce((acc, curr) => acc + (Number(curr.sale_amount) || 0), 0);
    const proshipCOD = validProship.reduce((acc, curr) => acc + (Number(curr.cod_amount) || 0), 0);
    const proshipUnits = validProship.length; // Assuming 1 row = 1 unit for Proship DB?

    const totalRevenue = fileRevenue + proshipRevenue;
    const totalUnits = fileUnits + proshipUnits;

    // Filter Reviews for current user
    const userReviewsCount = reviews.filter(r => {
        const u = r.user_name?.toLowerCase() || r.user?.toLowerCase() || '';
        const name = user?.name?.toLowerCase() || '';
        const email = user?.email?.toLowerCase() || '';
        return u === name || u === email;
    }).length;

    // Filtered lists for tables
    // 3. The list of file sold should show every staff (unfiltered `salesData`)
    const filteredSales = salesData.filter(s => s.client?.toLowerCase().includes(searchTerms.sales.toLowerCase()));
    const filteredProship = staffProship.filter(p => p.receiver_name?.toLowerCase().includes(searchTerms.proship.toLowerCase()) || p.tracking?.toLowerCase().includes(searchTerms.proship.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto space-y-8 font-bold fade-in pb-20 md:pb-0">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-brand-900 gap-4">
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Sales Hub</h2>
                <button
                    onClick={() => { setEditingSale(null); setIsModalOpen(true); }}
                    className="bg-blue-600 text-white px-10 py-5 rounded-[24px] font-black hover:bg-blue-700 shadow-xl uppercase tracking-widest text-xs flex items-center gap-2"
                >
                    <PlusCircle className="w-5 h-5" /> Record New Sale
                </button>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-brand-100 flex flex-col justify-between relative overflow-hidden h-[250px] lg:col-span-2">
                    <div className="absolute right-0 top-0 opacity-[0.03] text-[180px] font-black leading-none select-none pointer-events-none -mr-10 -mt-10">
                        ฿
                    </div>
                    <div className="z-10 mt-auto">
                        <p className="text-[9px] uppercase font-black text-brand-500 tracking-widest mb-0">Total Revenue</p>
                        <p className="text-5xl lg:text-5xl font-black text-blue-600 tracking-tighter italic">฿{totalRevenue.toLocaleString()}</p>
                        <div className="mt-4 pt-3 border-t border-brand-100 flex flex-wrap gap-3 text-[10px] font-bold text-brand-500">
                            <span className="flex items-center gap-1 px-2 py-1 bg-brand-50 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                File: <span className="text-brand-800 text-xs">฿{fileRevenue.toLocaleString()}</span>
                            </span>
                            <span className="flex items-center gap-1 px-2 py-1 bg-brand-50 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                                Proship: <span className="text-brand-800 text-xs">฿{proshipRevenue.toLocaleString()} </span>
                                <span className="text-[10px] text-brand-700 ml-1">(COD: ฿{proshipCOD.toLocaleString()})</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 h-[250px]">
                    <div className="bg-white px-5 py-4 rounded-[24px] shadow-sm border border-brand-100 flex flex-col justify-center flex-1">
                        <p className="text-[9px] uppercase font-black text-brand-500 tracking-widest">Total Units</p>
                        <p className="text-3xl font-black text-brand-800 leading-none mt-1">{totalUnits}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 w-full">
                            <div className="bg-blue-50/50 rounded-xl p-2 text-center border border-blue-50">
                                <p className="text-[7px] uppercase font-black text-blue-400 mb-0.5">Files</p>
                                <p className="text-xs font-black text-blue-600">{fileUnits}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
                                <p className="text-[7px] uppercase font-black text-gray-400 mb-0.5">Proship</p>
                                <p className="text-xs font-black text-gray-600">{proshipUnits}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white px-5 py-4 rounded-[24px] shadow-sm border border-brand-100 flex flex-col justify-center relative overflow-hidden group hover:border-brand-200 transition-all flex-1">
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-brand-500 transition-opacity"></div>
                        <p className="text-[9px] uppercase font-black text-brand-500 tracking-widest z-10">Reviews</p>
                        <p className="text-3xl font-black text-brand-600 z-10 mt-1">{userReviewsCount}</p>
                        <div className="mt-1 text-[10px] uppercase font-bold text-brand-500 z-10">Verified</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-[32px] shadow-sm border border-brand-100 flex flex-col justify-between h-auto md:h-[250px]">
                    <div className="space-y-3 pt-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-brand-500 font-black uppercase ml-1">From</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2 bg-brand-50 border border-brand-100 rounded-xl text-[10px] font-black outline-none focus:border-blue-500 transition-all text-gray-700"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-brand-500 font-black uppercase ml-1">To</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2 bg-brand-50 border border-brand-100 rounded-xl text-[10px] font-black outline-none focus:border-blue-500 transition-all text-gray-700"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={`w-full py-3 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-brand-600 active:scale-[0.98]'}`}
                    >
                        {isSyncing ? (
                            <>
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                Syncing...
                            </>
                        ) : 'Sync Data'}
                    </button>
                </div>
            </div>

            {/* Sales Table */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-black text-brand-800 uppercase tracking-tight ml-4 flex items-center gap-2">
                        <FileText className="text-brand-500 w-5 h-5" /> Files Sales
                    </h3>
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search Customer..."
                            value={searchTerms.sales}
                            onChange={(e) => setSearchTerms({ ...searchTerms, sales: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-brand-100 rounded-xl outline-none focus:border-blue-500 font-bold transition-all text-sm mb-2"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-[calc(50%+4px)] text-brand-500 w-4 h-4" />
                    </div>
                </div>

                <div className="bg-white rounded-[40px] shadow-sm border border-brand-100 overflow-hidden text-brand-900">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-bold table-auto">
                            <thead className="bg-brand-50/50 border-b border-brand-100 font-black text-[10px] text-brand-500 uppercase tracking-widest">
                                <tr>
                                    <th className="px-10 py-6">Date & Advisor</th>
                                    <th className="px-10 py-6">Client</th>
                                    <th className="px-10 py-6">Products</th>
                                    <th className="px-10 py-6 text-right">Price</th>
                                    <th className="px-10 py-6 text-right">Status</th>
                                    <th className="px-10 py-6 text-right w-32">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-brand-700 text-sm">
                                {loading && <tr><td colSpan={6} className="text-center py-10">Loading...</td></tr>}
                                {!loading && filteredSales.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-brand-400">No records found.</td></tr>}
                                {filteredSales.map((sale) => (
                                    <tr key={sale.record_id} className="hover:bg-brand-50 transition-colors">
                                        <td className="px-10 py-4">
                                            <p className="font-black text-brand-900">{sale.date_time ? new Date(sale.date_time).toLocaleDateString() : 'N/A'}</p>
                                            <p className="text-[10px] text-brand-400 uppercase tracking-widest">{sale.advisor}</p>
                                        </td>
                                        <td className="px-10 py-4">
                                            <p className="font-bold">{sale.client}</p>
                                            <p className="text-[10px] text-blue-500 uppercase font-black">{sale.platforms}</p>
                                        </td>
                                        <td className="px-10 py-4 text-xs italic text-brand-500 max-w-xs truncate">
                                            {sale.product}
                                        </td>
                                        <td className="px-10 py-4 text-right font-black text-blue-600">
                                            ฿{(Number(sale.price) || 0).toLocaleString()}
                                        </td>
                                        <td className="px-10 py-4 text-right">
                                            <span className={`px-2 py-1 rounded text-xs uppercase tracking-widest ${sale.status === 'Cancel' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                                {sale.status}
                                            </span>
                                            {sale.cxl_reason && <p className="text-[9px] text-red-400 mt-1 uppercase max-w-[100px] truncate">{sale.cxl_reason}</p>}
                                        </td>
                                        <td className="px-10 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => setViewingSale(sale)}
                                                className="text-[10px] uppercase font-black text-blue-600 hover:underline transition-colors px-2 py-1"
                                            >
                                                View
                                            </button>
                                            {(() => {
                                                const isOwner = (sale.advisor || '').toLowerCase().trim() === myName || (sale.advisor || '').toLowerCase().trim() === myEmail;
                                                const canEdit = (isManager || isOwner) && sale.status !== 'Cancel';
                                                return (
                                                    <button
                                                        onClick={() => { setEditingSale(sale); setIsModalOpen(true); }}
                                                        className={`text-[10px] uppercase font-black px-2 py-1 transition-colors ${canEdit ? 'text-brand-600 hover:underline' : 'text-gray-400 opacity-50 cursor-not-allowed'}`}
                                                        disabled={!canEdit}
                                                    >
                                                        Edit
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Proship Table */}
            <div className="space-y-4 pt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-black text-brand-800 uppercase tracking-tight ml-4 flex items-center gap-2">
                        <Truck className="text-brand-500 w-5 h-5" /> Proship Log
                    </h3>
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search Track/Client..."
                            value={searchTerms.proship}
                            onChange={(e) => setSearchTerms({ ...searchTerms, proship: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-brand-100 rounded-xl outline-none focus:border-brand-500 font-bold transition-all text-sm mb-2"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-[calc(50%+4px)] text-brand-500 w-4 h-4" />
                    </div>
                </div>

                <div className="bg-white rounded-[40px] shadow-sm border border-brand-100 overflow-hidden text-brand-900">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-bold table-auto">
                            <thead className="bg-brand-50/50 border-b border-brand-100 font-black text-[10px] text-brand-500 uppercase tracking-widest">
                                <tr>
                                    <th className="px-10 py-6">Date</th>
                                    <th className="px-10 py-6">Status / Track</th>
                                    <th className="px-10 py-6">Customer</th>
                                    <th className="px-10 py-6">Details</th>
                                    <th className="px-10 py-6 text-right">Sale Total</th>
                                    <th className="px-10 py-6 text-right">COD</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-brand-700 text-sm">
                                {loading && <tr><td colSpan={6} className="text-center py-10">Loading...</td></tr>}
                                {!loading && filteredProship.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-brand-400">No records found.</td></tr>}
                                {filteredProship.map((row) => (
                                    <tr key={row.id} className="hover:bg-brand-50 transition-colors">
                                        <td className="px-10 py-4 font-black">
                                            {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-10 py-4">
                                            <span className="text-[10px] px-2 py-1 bg-brand-100 text-brand-700 rounded-lg uppercase tracking-widest">{row.status}</span>
                                            <p className="text-xs text-brand-500 font-mono mt-1">{row.tracking_no}</p>
                                        </td>
                                        <td className="px-10 py-4">
                                            <p>{row.receiver_name}</p>
                                            <p className="text-[10px] text-brand-400">{row.phone}</p>
                                        </td>
                                        <td className="px-10 py-4">
                                            <p className="text-xs truncate max-w-[200px]" title={row.name}>{row.name}</p>
                                            <p className="text-[10px] text-brand-400">{row.sku}</p>
                                        </td>
                                        <td className="px-10 py-4 text-right font-black text-blue-600">
                                            ฿{(Number(row.actual_sales) || 0).toLocaleString()}
                                        </td>
                                        <td className="px-10 py-4 text-right text-xs">
                                            {Number(row.cod_amount) > 0 && (
                                                <p>COD: ฿{Number(row.cod_amount).toLocaleString()}</p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <SaleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveSale}
                products={products}
                currentSale={editingSale}
            />

            <ViewSaleModal
                isOpen={!!viewingSale}
                onClose={() => setViewingSale(null)}
                sale={viewingSale}
            />

        </div>
    );
}
