'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Package, Truck, Star, Search, PlusCircle, Edit, X, ChevronDown } from 'lucide-react';

export default function ManagementHub() {
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('filesold');
    const [loading, setLoading] = useState(true);

    // Data states
    const [fileSoldData, setFileSoldData] = useState<any[]>([]);
    const [proshipProdData, setProshipProdData] = useState<any[]>([]);
    const [reviewProdData, setReviewProdData] = useState<any[]>([]);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Modals + per-modal editing states
    const [fileSoldModalOpen, setFileSoldModalOpen] = useState(false);
    const [editingFileSold, setEditingFileSold] = useState<any>(null);

    const [proshipProdModalOpen, setProshipProdModalOpen] = useState(false);
    const [editingProship, setEditingProship] = useState<any>(null);

    const [reviewProdModalOpen, setReviewProdModalOpen] = useState(false);
    const [editingReview, setEditingReview] = useState<any>(null);

    // Bundle item state
    const [selectedBundleItems, setSelectedBundleItems] = useState<string[]>([]);
    const [bundleDropdownOpen, setBundleDropdownOpen] = useState(false);
    const [bundleValue, setBundleValue] = useState('No');

    useEffect(() => {
        const stored = localStorage.getItem('portal_user');
        if (stored) setUser(JSON.parse(stored));
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [p1, p2, p3] = await Promise.all([
                supabase.from('products_sku').select('*').order('product', { ascending: true }),
                supabase.from('proship_product').select('*').order('name', { ascending: true }),
                supabase.from('product_for_review').select('*').order('product', { ascending: true })
            ]);

            setFileSoldData(p1.data || []);
            setProshipProdData(p2.data || []);
            setReviewProdData(p3.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- Save Handlers ---
    const handleSaveFileSold = async (e: any) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        // Disabled inputs are excluded from FormData, so read from editing state
        const productName = editingFileSold?.product || fd.get('product');

        const payload: any = {
            product: productName,
            category: fd.get('category'),
            full_price: Number(fd.get('full_price')),
            advisor_price: Number(fd.get('advisor_price')),
            status: fd.get('status'),
            bundle: bundleValue,
            bundle_item: bundleValue === 'Yes' ? selectedBundleItems.join(', ') : '',
            note: fd.get('note') || '',
            update_by: user?.name || 'Unknown',
            last_update: new Date().toISOString()
        };

        try {
            if (editingFileSold) {
                // Update by id
                await supabase.from('products_sku').update(payload).eq('id', editingFileSold.id);
            } else {
                // Insert
                await supabase.from('products_sku').insert(payload);
            }
            setFileSoldModalOpen(false);
            fetchData();
        } catch (err) {
            alert('Failed to save product');
        }
    };

    const handleSaveProshipProd = async (e: any) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        // Disabled inputs are excluded from FormData
        const skuValue = editingProship?.sku || fd.get('sku');

        try {
            if (editingProship?.id) {
                // Update — don't overwrite sku
                const updatePayload = {
                    name: fd.get('name'),
                    available: fd.get('available'),
                    sale_price: Number(fd.get('sale_price'))
                };
                await supabase.from('proship_product').update(updatePayload).eq('id', editingProship.id);
            } else {
                // Insert new
                const insertPayload = {
                    id: skuValue,
                    name: fd.get('name'),
                    sku: skuValue,
                    available: fd.get('available'),
                    sale_price: Number(fd.get('sale_price'))
                };
                await supabase.from('proship_product').insert(insertPayload);
            }
            setProshipProdModalOpen(false);
            fetchData();
        } catch (err) {
            alert('Failed to save Proship product');
        }
    };

    const handleSaveReviewProd = async (e: any) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        // Disabled inputs are excluded from FormData
        const productName = editingReview?.product || fd.get('product');

        const payload = {
            product: productName,
            note: fd.get('note') || '',
            update_by: user?.name || 'Unknown',
            last_update: new Date().toISOString()
        };

        try {
            if (editingReview) {
                await supabase.from('product_for_review').update(payload).eq('id', editingReview.id);
            } else {
                await supabase.from('product_for_review').insert(payload);
            }
            setReviewProdModalOpen(false);
            fetchData();
        } catch (err) {
            alert('Failed to save Review product');
        }
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSearchTerm('');
        // Close all modals on tab switch
        setFileSoldModalOpen(false);
        setProshipProdModalOpen(false);
        setReviewProdModalOpen(false);
    };

    // Derived data
    const uniqueCategories = Array.from(new Set(fileSoldData.map((d: any) => d.category).filter(Boolean))).sort() as string[];
    const activeProducts = fileSoldData.filter((d: any) => (d.status || '').toLowerCase() !== 'inactive');

    const openFileSoldModal = (item: any = null) => {
        setEditingFileSold(item);
        if (item) {
            setBundleValue(item.bundle || 'No');
            const items = (item.bundle_item || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            setSelectedBundleItems(items);
        } else {
            setBundleValue('No');
            setSelectedBundleItems([]);
        }
        setBundleDropdownOpen(false);
        setFileSoldModalOpen(true);
    };

    const openProshipModal = (item: any = null) => {
        setEditingProship(item);
        setProshipProdModalOpen(true);
    };

    const openReviewModal = (item: any = null) => {
        setEditingReview(item);
        setReviewProdModalOpen(true);
    };

    const toggleBundleItem = (name: string, checked: boolean) => {
        setSelectedBundleItems(prev =>
            checked ? [...prev, name] : prev.filter(x => x !== name)
        );
    };

    // Filter renders
    const renderFileSoldTab = () => {
        const filtered = fileSoldData.filter(d => d.product?.toLowerCase().includes(searchTerm.toLowerCase()));
        return (
            <div className="space-y-6 fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search SKU..."
                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-brand-100 rounded-2xl outline-none focus:border-brand-500 font-bold transition-all"
                        />
                    </div>
                    <button
                        onClick={() => openFileSoldModal(null)}
                        className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-200 text-xs tracking-widest uppercase flex items-center gap-2"
                    >
                        <PlusCircle className="w-4 h-4" /> Add SKU
                    </button>
                </div>

                <div className="bg-white rounded-[40px] border border-brand-100 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left font-bold text-sm">
                        <thead className="bg-brand-50/50 border-b text-[10px] uppercase text-brand-500 tracking-widest">
                            <tr>
                                <th className="px-10 py-6">Name</th>
                                <th className="px-10 py-6">Category</th>
                                <th className="px-10 py-6">Status</th>
                                <th className="px-10 py-6 text-right">Full Price</th>
                                <th className="px-10 py-6 text-right">Adv Price</th>
                                <th className="px-10 py-6">Notes</th>
                                <th className="px-10 py-6 text-right w-32">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(item => (
                                <tr key={item.id || item.product || Math.random()} className="hover:bg-brand-50 transition-colors">
                                    <td className="px-10 py-4 font-black text-brand-900">{item.product}</td>
                                    <td className="px-10 py-4 text-xs text-brand-500 uppercase tracking-widest">{item.category}</td>
                                    <td className="px-10 py-4">
                                        <span className={`px-2 py-1 text-[10px] uppercase tracking-widest rounded-lg ${(item.status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {item.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-10 py-4 text-right line-through text-brand-400">฿{item.full_price}</td>
                                    <td className="px-10 py-4 text-right font-black text-blue-600">฿{item.advisor_price}</td>
                                    <td className="px-10 py-4 text-xs italic text-red-600 truncate max-w-xs">{item.note || ''}</td>
                                    <td className="px-10 py-4 text-right">
                                        <button
                                            onClick={() => openFileSoldModal(item)}
                                            className="p-2 text-brand-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderProshipTab = () => {
        const filtered = proshipProdData.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
        return (
            <div className="space-y-6 fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Proship Name/SKU..."
                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-brand-100 rounded-2xl outline-none focus:border-brand-500 font-bold transition-all"
                        />
                    </div>
                    <button
                        onClick={() => openProshipModal(null)}
                        className="bg-brand-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-brand-700 shadow-xl flex items-center gap-2 text-xs tracking-widest uppercase"
                    >
                        <PlusCircle className="w-4 h-4" /> Add Proship SKU
                    </button>
                </div>

                <div className="bg-white rounded-[40px] border border-brand-100 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left font-bold text-sm">
                        <thead className="bg-brand-50/50 border-b text-[10px] uppercase text-brand-500 tracking-widest">
                            <tr>
                                <th className="px-10 py-6">Product Name</th>
                                <th className="px-10 py-6">SKU</th>
                                <th className="px-10 py-6">Available</th>
                                <th className="px-10 py-6 text-right">Sale Price</th>
                                <th className="px-10 py-6 text-right w-32">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-brand-50 transition-colors">
                                    <td className="px-10 py-4 font-black">{item.name}</td>
                                    <td className="px-10 py-4 text-brand-500 font-mono text-xs">{item.sku}</td>
                                    <td className="px-10 py-4 text-xs">{String(item.available).toUpperCase()}</td>
                                    <td className="px-10 py-4 text-right font-black text-blue-600">฿{item.sale_price}</td>
                                    <td className="px-10 py-4 text-right">
                                        <button
                                            onClick={() => openProshipModal(item)}
                                            className="p-2 text-brand-500 hover:text-brand-800 hover:bg-brand-100 rounded-xl transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderReviewTab = () => {
        const filtered = reviewProdData.filter(d => d.product?.toLowerCase().includes(searchTerm.toLowerCase()));
        return (
            <div className="space-y-6 fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Source Name..."
                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-brand-100 rounded-2xl outline-none focus:border-brand-500 font-bold transition-all"
                        />
                    </div>
                    <button
                        onClick={() => openReviewModal(null)}
                        className="bg-brand-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-brand-700 shadow-xl flex items-center gap-2 text-xs tracking-widest uppercase"
                    >
                        <PlusCircle className="w-4 h-4" /> Add Review Setup
                    </button>
                </div>

                <div className="bg-white rounded-[40px] border border-brand-100 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left font-bold text-sm">
                        <thead className="bg-brand-50/50 border-b text-[10px] uppercase text-brand-500 tracking-widest">
                            <tr>
                                <th className="px-10 py-6">Product Name</th>
                                <th className="px-10 py-6">Note</th>
                                <th className="px-10 py-6">Last Update</th>
                                <th className="px-10 py-6 text-right w-32">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(item => (
                                <tr key={item.id || item.product || Math.random()} className="hover:bg-brand-50 transition-colors">
                                    <td className="px-10 py-4 font-black">{item.product}</td>
                                    <td className="px-10 py-4 text-xs text-brand-500 max-w-sm truncate">{item.note}</td>
                                    <td className="px-10 py-4 text-[10px] tracking-widest uppercase text-brand-400">
                                        {item.last_update ? new Date(item.last_update).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-10 py-4 text-right">
                                        <button
                                            onClick={() => openReviewModal(item)}
                                            className="p-2 text-brand-500 hover:text-brand-800 hover:bg-brand-100 rounded-xl transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 font-bold fade-in pb-20 md:pb-0">
            <div className="flex items-center gap-4">
                <Settings className="w-10 h-10 text-brand-900" />
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-brand-900">Database Management</h2>
            </div>

            <div className="flex gap-4 md:gap-10 border-b border-brand-100 font-black overflow-x-auto pb-2 custom-scrollbar">
                <button
                    onClick={() => handleTabChange('filesold')}
                    className={`pb-4 font-black uppercase tracking-widest text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${activeTab === 'filesold' ? 'border-brand-900 text-brand-900' : 'border-transparent text-brand-400 hover:text-brand-600'}`}
                >
                    <Package className="w-4 h-4" /> FileSoldProduct
                </button>
                <button
                    onClick={() => handleTabChange('proshipprod')}
                    className={`pb-4 font-black uppercase tracking-widest text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${activeTab === 'proshipprod' ? 'border-brand-900 text-brand-900' : 'border-transparent text-brand-400 hover:text-brand-600'}`}
                >
                    <Truck className="w-4 h-4" /> ProshipProduct
                </button>
                <button
                    onClick={() => handleTabChange('reviewprod')}
                    className={`pb-4 font-black uppercase tracking-widest text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${activeTab === 'reviewprod' ? 'border-brand-900 text-brand-900' : 'border-transparent text-brand-400 hover:text-brand-600'}`}
                >
                    <Star className="w-4 h-4" /> ReviewSetup
                </button>
            </div>

            {loading ? (
                <div className="py-20 text-center text-brand-400">Loading Database...</div>
            ) : (
                <div className="min-h-[500px]">
                    {activeTab === 'filesold' && renderFileSoldTab()}
                    {activeTab === 'proshipprod' && renderProshipTab()}
                    {activeTab === 'reviewprod' && renderReviewTab()}
                </div>
            )}

            {/* Inlined Modals for Management */}
            {/* FileSold Modal */}
            {fileSoldModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/60 backdrop-blur-xl overflow-y-auto">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl fade-in overflow-hidden relative">
                        <div className="p-8 border-b flex justify-between bg-brand-50/50">
                            <h3 className="text-xl uppercase font-black">{editingFileSold ? 'Edit FileSold SKU' : 'New FileSold SKU'}</h3>
                            <button onClick={() => setFileSoldModalOpen(false)}><X className="w-6 h-6" /></button>
                        </div>
                        <form key={editingFileSold?.id || '__new_fs__'} onSubmit={handleSaveFileSold} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Product Name / ID</label>
                                <input name="product" required defaultValue={editingFileSold?.product} disabled={!!editingFileSold} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-blue-500 disabled:opacity-50" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Category</label>
                                <input name="category" list="category-list" required defaultValue={editingFileSold?.category} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-blue-500" />
                                <datalist id="category-list">
                                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-brand-500">Full Price (฿)</label>
                                    <input name="full_price" type="number" required defaultValue={editingFileSold?.full_price} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-brand-500">Advisor Price (฿)</label>
                                    <input name="advisor_price" type="number" required defaultValue={editingFileSold?.advisor_price} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-brand-500">Status</label>
                                    <select name="status" defaultValue={editingFileSold?.status || 'Active'} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl bg-white outline-none">
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-brand-500">Is Bundle?</label>
                                    <select value={bundleValue} onChange={e => { setBundleValue(e.target.value); if (e.target.value === 'No') { setSelectedBundleItems([]); setBundleDropdownOpen(false); } }} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl bg-white outline-none">
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                            </div>
                            {bundleValue === 'Yes' && (
                                <div className="relative space-y-1">
                                    <label className="text-[10px] uppercase font-black text-brand-500">Bundle Content</label>
                                    <button type="button" onClick={() => setBundleDropdownOpen(!bundleDropdownOpen)}
                                        className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl bg-white flex justify-between items-center outline-none">
                                        <span className="font-bold text-brand-500 italic text-xs">
                                            {selectedBundleItems.length ? `${selectedBundleItems.length} Selected` : 'Select Items...'}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 transition-transform ${bundleDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {bundleDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-[100%] bg-white border-2 border-brand-100 rounded-2xl shadow-2xl z-[70] max-h-48 overflow-y-auto p-2 mt-1">
                                            {activeProducts.map((p: any) => (
                                                <label key={p.product} className="flex items-center gap-3 p-3 hover:bg-brand-50 rounded-xl cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={selectedBundleItems.includes(p.product)}
                                                        onChange={e => toggleBundleItem(p.product, e.target.checked)}
                                                        className="w-4 h-4 rounded text-blue-600" />
                                                    <span className="text-sm font-black text-brand-700">{p.product}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Note</label>
                                <textarea name="note" defaultValue={editingFileSold?.note} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none h-24 resize-none"></textarea>
                            </div>
                            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs">Save FileSold SKU</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Proship Modal */}
            {proshipProdModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/60 backdrop-blur-xl overflow-y-auto">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl fade-in overflow-hidden relative">
                        <div className="p-8 border-b flex justify-between bg-brand-50/50">
                            <h3 className="text-xl uppercase font-black">{editingProship ? 'Edit Proship SKU' : 'New Proship SKU'}</h3>
                            <button onClick={() => setProshipProdModalOpen(false)}><X className="w-6 h-6" /></button>
                        </div>
                        <form key={editingProship?.id || '__new_ps__'} onSubmit={handleSaveProshipProd} className="p-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">System Name</label>
                                <input name="name" required defaultValue={editingProship?.name} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-brand-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Proship SKU Code</label>
                                <input name="sku" required defaultValue={editingProship?.sku} disabled={!!editingProship} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-brand-500 disabled:opacity-50 font-mono text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Sale Price (฿)</label>
                                <input name="sale_price" type="number" required defaultValue={editingProship?.sale_price} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-brand-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Available</label>
                                <select name="available" defaultValue={editingProship ? String(editingProship.available).toUpperCase() : 'TRUE'} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl bg-white outline-none focus:border-brand-500">
                                    <option value="TRUE">TRUE</option>
                                    <option value="FALSE">FALSE</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-xl font-black uppercase text-xs mt-4">Save Proship SKU</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Review Setup Modal */}
            {reviewProdModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/60 backdrop-blur-xl overflow-y-auto">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl fade-in overflow-hidden relative">
                        <div className="p-8 border-b flex justify-between bg-brand-50/50">
                            <h3 className="text-xl uppercase font-black">{editingReview ? 'Edit Review Setup' : 'New Review Setup'}</h3>
                            <button onClick={() => setReviewProdModalOpen(false)}><X className="w-6 h-6" /></button>
                        </div>
                        <form key={editingReview?.id || '__new_rv__'} onSubmit={handleSaveReviewProd} className="p-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Label Name / Product</label>
                                <input name="product" required defaultValue={editingReview?.product} disabled={!!editingReview} className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-brand-500 disabled:opacity-50" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-brand-500">Internal Note</label>
                                <input name="note" defaultValue={editingReview?.note} placeholder="Optional notes..." className="w-full px-5 py-3 border-2 border-brand-100 rounded-xl outline-none focus:border-brand-500" />
                            </div>
                            <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-xl font-black uppercase text-xs mt-4">Save Review Setup</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
