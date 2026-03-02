'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, Search, ExternalLink } from 'lucide-react';
import ReviewModal from '@/components/reviews/ReviewModal';

export default function ReviewHub() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewProducts, setReviewProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem('portal_user');
        if (stored) setUser(JSON.parse(stored));

        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch the lookup products mapping for Reviews
            const { data: rpData } = await supabase.from('product_for_review').select('*');
            if (rpData) setReviewProducts(rpData);

            // Fetch actual reviews
            const { data: revData, error } = await supabase
                .from('reviewed')
                .select('*')
                .order('date_time', { ascending: false })
                .limit(200);

            if (error) throw error;
            setReviews(revData || []);
        } catch (err) {
            console.error('Error fetching reviews:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReview = async (payload: any) => {
        try {
            const timestamp = new Date().toISOString();

            const dbPayload = {
                ...payload,
                date_time: timestamp,
                user_name: user?.name || 'Unknown'
            };

            const { error } = await supabase.from('reviewed').insert([dbPayload]);
            if (error) throw error;

            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            console.error('Save failed', err?.message || err);
            alert('Failed to save review: ' + (err?.message || 'Unknown error'));
        }
    };

    const filteredReviews = reviews.filter(rev =>
        rev.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rev.product?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const parseStorageLinks = (storageVal: string) => {
        if (!storageVal) return [];
        try {
            const parsed = JSON.parse(storageVal);
            return Array.isArray(parsed) ? parsed : [storageVal];
        } catch {
            return storageVal.split(',').map(s => s.trim());
        }
    };

    const formatProductDisplay = (productVal: string) => {
        if (!productVal) return '';
        try {
            // Check if it's a legacy JSON array string like '["Product A"]'
            const parsed = JSON.parse(productVal);
            if (Array.isArray(parsed)) return parsed.join(', ');
            return productVal;
        } catch {
            return productVal; // already a plain string
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 font-bold fade-in pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-brand-900 font-black gap-4">
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Review Hub</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-10 py-5 rounded-[24px] font-black hover:bg-blue-700 shadow-xl uppercase tracking-widest text-xs flex items-center gap-2"
                >
                    <Camera className="w-5 h-5" /> Upload Review
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-brand-100 overflow-hidden text-brand-900 font-bold">
                <div className="p-4 border-b border-brand-100 flex justify-end bg-brand-50/30">
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search Client or Product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-brand-100 rounded-xl outline-none focus:border-blue-500 font-bold transition-all text-sm"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-[calc(50%)] text-brand-500 w-4 h-4" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-bold table-auto">
                        <thead className="bg-brand-50/50 border-b border-brand-100 font-black text-[10px] text-brand-500 uppercase tracking-widest">
                            <tr>
                                <th className="px-10 py-6">Date</th>
                                <th className="px-10 py-6">Client</th>
                                <th className="px-10 py-6">From</th>
                                <th className="px-10 py-6">Products</th>
                                <th className="px-10 py-6 text-right w-32">Attachments</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-brand-700 text-sm">
                            {loading && <tr><td colSpan={5} className="text-center py-10">Loading...</td></tr>}
                            {!loading && filteredReviews.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-brand-400">No records found.</td></tr>}
                            {filteredReviews.map((rev) => {
                                const files = parseStorageLinks(rev.storage);
                                return (
                                    <tr key={rev.record_id} className="hover:bg-brand-50 transition-colors">
                                        <td className="px-10 py-4">
                                            <p className="font-black text-brand-900">{rev.date_time ? new Date(rev.date_time).toLocaleDateString() : 'N/A'}</p>
                                            <p className="text-[10px] text-brand-400 uppercase tracking-widest">{rev.user_name}</p>
                                        </td>
                                        <td className="px-10 py-4 font-bold">{rev.client_name}</td>
                                        <td className="px-10 py-4">
                                            <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-lg text-xs uppercase tracking-widest">{rev.source_from}</span>
                                        </td>
                                        <td className="px-10 py-4 text-xs italic text-brand-500 max-w-[200px] truncate" title={formatProductDisplay(rev.product)}>
                                            {formatProductDisplay(rev.product)}
                                        </td>
                                        <td className="px-10 py-4 text-right">
                                            {files.length > 0 ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    {files.map((url: string, idx: number) => {
                                                        const isUrl = url.startsWith('http');
                                                        return isUrl ? (
                                                            <a
                                                                key={idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-bold"
                                                            >
                                                                <ExternalLink className="w-3 h-3" /> {files.length > 1 ? `Folder #${idx + 1}` : 'View Folder'}
                                                            </a>
                                                        ) : (
                                                            <span key={idx} className="text-[10px] text-gray-400" title={url}>Fallback Upload</span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-300">No Image</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <ReviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveReview}
                products={reviewProducts}
                user={user}
            />

        </div>
    );
}
