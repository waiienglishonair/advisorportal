'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Search, Pencil, Trash2 } from 'lucide-react';
import ErrorModal from '@/components/errors/ErrorModal';

export default function ErrorHub() {
    const [errorsData, setErrorsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
    const [proshipProducts, setProshipProducts] = useState<any[]>([]);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('portal_user');
        if (stored) setUser(JSON.parse(stored));

        // Default to this month (handling local timezone offset)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const firstDayStr = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const lastDayStr = new Date(lastDay.getTime() - lastDay.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        setDateFilter({ start: firstDayStr, end: lastDayStr });
    }, []);

    useEffect(() => {
        if (dateFilter.start && dateFilter.end) {
            fetchData();
        }
    }, [dateFilter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const startDate = dateFilter.start + 'T00:00:00.000Z';
            const endDate = dateFilter.end + 'T23:59:59.999Z';

            const { data, error } = await supabase
                .from('error_order')
                .select('*')
                .gte('date_time_record', startDate)
                .lte('date_time_record', endDate)
                .order('date_time_record', { ascending: false });

            if (error) throw error;
            setErrorsData(data || []);

            const { data: pData } = await supabase.from('proship_product').select('*');
            if (pData) setProshipProducts(pData);
        } catch (err) {
            console.error('Error fetching errors:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveError = async (payload: any) => {
        try {
            if (payload.record_id) {
                // Update existing record
                const { record_id, ...updateData } = payload;
                const { error } = await supabase
                    .from('error_order')
                    .update(updateData)
                    .eq('record_id', record_id);
                if (error) throw error;
            } else {
                // Insert new record
                const timestamp = new Date().toISOString();
                const dbPayload = {
                    ...payload,
                    date_time_record: timestamp,
                    record_staff: user?.name || 'Unknown'
                };
                const { error } = await supabase.from('error_order').insert([dbPayload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingRecord(null);
            fetchData();
        } catch (err: any) {
            console.error('Save failed', err?.message || err);
            alert('Failed to save error record: ' + (err?.message || 'Unknown error'));
        }
    };

    const handleEditError = async (recordId: string) => {
        try {
            // Fetch fresh record from DB
            const { data, error } = await supabase
                .from('error_order')
                .select('*')
                .eq('record_id', recordId)
                .single();

            if (error) throw error;
            if (!data) {
                alert('Record not found');
                return;
            }

            setEditingRecord(data);
            setIsModalOpen(true);
        } catch (err: any) {
            console.error('Failed to fetch record for edit:', err?.message || err);
            alert('Failed to load record: ' + (err?.message || 'Unknown error'));
        }
    };

    const handleDeleteError = async (recordId: string) => {
        if (!confirm('Delete this Error Record?')) return;

        try {
            const { error } = await supabase
                .from('error_order')
                .delete()
                .eq('record_id', recordId);

            if (error) throw error;
            fetchData();
        } catch (err: any) {
            console.error('Delete failed', err?.message || err);
            alert('Failed to delete error record: ' + (err?.message || 'Unknown error'));
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const handleOpenNewModal = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const filteredErrors = errorsData.filter(err =>
        (err.customer?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (err.order_sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (err.recieve_sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (err.platform?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    // Summing amend revenue for this period
    const totalAmendRev = filteredErrors.reduce((acc, curr) => acc + (Number(curr.amend_rev) || 0), 0);
    const totalErrors = filteredErrors.length;

    // Check if current user can edit a record
    const canEdit = (err: any) => user?.name && err.record_staff && user.name === err.record_staff;

    return (
        <div className="max-w-6xl mx-auto space-y-10 font-bold fade-in pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-red-900 font-black gap-4">
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase flex items-center gap-3">
                    Error Log
                </h2>
                <button
                    onClick={handleOpenNewModal}
                    className="bg-red-600 text-white px-10 py-5 rounded-[24px] font-black hover:bg-red-700 shadow-xl shadow-red-200 uppercase tracking-widest text-xs flex items-center gap-2"
                >
                    <AlertTriangle className="w-5 h-5" /> Record Error
                </button>
            </div>

            {/* Error Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-red-50 p-6 rounded-[32px] border border-red-100 flex flex-col justify-center relative overflow-hidden h-[180px]">
                    <div className="absolute right-0 top-0 opacity-[0.03] text-[180px] font-black leading-none select-none pointer-events-none -mr-10 -mt-10">
                        ฿
                    </div>
                    <p className="text-[10px] uppercase font-black text-red-400 tracking-widest">Total Amend Revenue</p>
                    <p className="text-4xl md:text-5xl font-black text-red-600 mt-2">฿{totalAmendRev.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-red-100 shadow-sm flex flex-col justify-center h-[180px]">
                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Total Errors Logic</p>
                    <p className="text-4xl md:text-5xl font-black text-brand-800 mt-2">{totalErrors} <span className="text-sm text-gray-400">Cases</span></p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-red-100 shadow-sm flex flex-col justify-center gap-4 h-[180px]">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-black text-gray-400">From</label>
                        <input type="date" value={dateFilter.start} onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-black text-gray-400">To</label>
                        <input type="date" value={dateFilter.end} onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-red-100 overflow-hidden text-brand-900 font-bold">
                <div className="p-4 border-b border-red-100 flex justify-end bg-red-50/20">
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search Customer/SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-red-100 rounded-xl outline-none focus:border-red-500 font-bold transition-all text-sm"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400 w-4 h-4" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-bold table-auto">
                        <thead className="bg-red-50/50 border-b border-red-100 font-black text-[10px] text-red-500 uppercase tracking-widest">
                            <tr>
                                <th className="px-8 py-6">Date</th>
                                <th className="px-8 py-6">Customer</th>
                                <th className="px-8 py-6">Order SKU</th>
                                <th className="px-8 py-6">Recieve SKU</th>
                                <th className="px-8 py-6">Scenario</th>
                                <th className="px-8 py-6 text-right">AmendRev</th>
                                <th className="px-8 py-6 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-red-50 text-brand-700 text-sm">
                            {loading && <tr><td colSpan={7} className="text-center py-10">Loading...</td></tr>}
                            {!loading && filteredErrors.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">No error records found for this period.</td></tr>}
                            {filteredErrors.map((err) => (
                                <tr key={err.record_id} className="hover:bg-red-50/30 transition-colors group">
                                    <td className="px-8 py-4">
                                        <p className="font-black text-brand-900">{err.date_time_record ? new Date(err.date_time_record).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A'}</p>
                                        <p className="text-[10px] text-red-400 uppercase tracking-widest">{err.date_time_record ? new Date(err.date_time_record).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <p className="font-bold">{err.customer}</p>
                                        <p className="text-[10px] text-blue-500 uppercase font-black">{err.platform}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <p className="text-xs text-brand-800 font-black max-w-[180px]">{err.order_sku || '-'}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <p className="text-xs text-brand-800 font-black max-w-[180px]">{err.recieve_sku || '-'}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-[10px] uppercase font-black tracking-widest truncate max-w-[150px] inline-block" title={err.scenario}>
                                            {err.scenario}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-right font-black text-red-600">
                                        ฿{Number(err.amend_rev || 0).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        {canEdit(err) && (
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditError(err.record_id)}
                                                    className="p-2 text-brand-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteError(err.record_id)}
                                                    className="p-2 text-brand-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ErrorModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveError}
                user={user}
                proshipProducts={proshipProducts}
                editData={editingRecord}
            />

        </div>
    );
}
