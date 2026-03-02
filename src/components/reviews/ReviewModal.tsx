import { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, Check, UploadCloud } from 'lucide-react';

export default function ReviewModal({
    isOpen,
    onClose,
    onSave,
    products, // from `product_for_review`
    user
}: any) {
    const [clientName, setClientName] = useState('');
    const [sourceChannel, setSourceChannel] = useState('Facebook');
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    // Dropdown state
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
        }
        if (isProductDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProductDropdownOpen]);

    useEffect(() => {
        if (isOpen) {
            setClientName('');
            setSourceChannel('Facebook');
            setSelectedProducts([]);
            setFiles([]);
            setUploading(false);
            setProductSearch('');
            setIsProductDropdownOpen(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if (selectedProducts.length === 0) {
            alert("Please select at least one product.");
            return;
        }
        if (files.length === 0) {
            alert("Please select at least one file.");
            return;
        }

        setUploading(true);

        try {
            // Upload files to Google Drive via our API route
            const formData = new FormData();
            for (const file of files) {
                formData.append('files', file);
            }
            formData.append('clientName', clientName);
            const productNames = selectedProducts.map(p => p.product);
            formData.append('products', JSON.stringify(productNames));

            const uploadRes = await fetch('/api/upload-review', {
                method: 'POST',
                body: formData,
            });

            const uploadResult = await uploadRes.json();

            let finalStorageUrl = '';
            if (uploadResult.success && uploadResult.folderUrl) {
                finalStorageUrl = uploadResult.folderUrl;
            } else if (uploadResult.urls && uploadResult.urls.length > 0) {
                finalStorageUrl = uploadResult.urls[0];
            } else {
                console.warn('Upload to Google Drive returned:', uploadResult);
                finalStorageUrl = `upload-pending://${files[0]?.name || 'unknown'}`;
            }

            const payload = {
                client_name: clientName,
                source_from: sourceChannel,
                product: productNames.join(', '),
                storage: finalStorageUrl,
            };

            await onSave(payload);

        } catch (error) {
            console.error("Error submitting review:", error);
            alert("Failed to submit review.");
        } finally {
            setUploading(false);
        }
    };

    const toggleProduct = (prod: any) => {
        if (selectedProducts.find(p => p.product === prod.product)) {
            setSelectedProducts(selectedProducts.filter(p => p.product !== prod.product));
        } else {
            setSelectedProducts([...selectedProducts, prod]);
        }
    };

    const filteredProducts = products.filter((p: any) =>
        (p.product || '').toLowerCase().includes(productSearch.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/70 backdrop-blur-xl overflow-y-auto">
            <div className="bg-white w-full max-w-xl rounded-[48px] shadow-2xl overflow-hidden fade-in border-4 border-white font-bold my-auto relative">

                <div className="px-8 md:px-10 py-6 md:py-8 border-b flex justify-between items-center bg-brand-50/50 font-black">
                    <h3 className="text-xl md:text-2xl text-brand-800 tracking-tight uppercase font-black">Upload Review</h3>
                    <button onClick={onClose} className="text-brand-500 hover:text-brand-800 transition-colors">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 max-h-[75vh] overflow-y-auto">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Client Name</label>
                        <input
                            type="text"
                            required
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl outline-none font-black focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Source Platform</label>
                        <select
                            required
                            value={sourceChannel}
                            onChange={e => setSourceChannel(e.target.value)}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl font-bold bg-white outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="Facebook">Facebook</option>
                            <option value="Line">Line</option>
                            <option value="Instagram">IG</option>
                            <option value="TikTok">TikTok</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="relative space-y-1" ref={dropdownRef}>
                        <label className="text-[10px] uppercase font-black text-brand-500">Related Products</label>
                        <button
                            type="button"
                            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl bg-white flex justify-between items-center outline-none focus:border-blue-500 transition-colors"
                        >
                            <span className="font-bold text-brand-800 truncate pr-4">
                                {selectedProducts.length > 0
                                    ? selectedProducts.map(p => p.product).join(', ')
                                    : <span className="text-brand-400 italic">Select Products...</span>}
                            </span>
                            <ChevronDown className={`w-5 h-5 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isProductDropdownOpen && (
                            <div className="absolute left-0 right-0 top-[110%] bg-white border-2 border-brand-100 rounded-3xl shadow-2xl z-[70] max-h-48 flex flex-col font-bold overflow-hidden">
                                <div className="p-3 border-b border-brand-100 bg-brand-50 font-black relative">
                                    <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-brand-400" />
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="overflow-y-auto p-2 space-y-1">
                                    {filteredProducts.map((prod: any, idx: number) => {
                                        const isSelected = selectedProducts.find(p => p.product === prod.product);
                                        return (
                                            <div
                                                key={`${prod.product}-${idx}`}
                                                onClick={() => toggleProduct(prod)}
                                                className={`p-3 rounded-xl flex justify-between items-center cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-brand-50'}`}
                                            >
                                                <span className="font-bold text-sm">{prod.product}</span>
                                                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                            </div>
                                        );
                                    })}
                                    {filteredProducts.length === 0 && (
                                        <p className="p-4 text-center text-xs text-brand-400">No review products found.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Review Files (Images/PDF)</label>
                        <div className="relative border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors bg-brand-50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer overflow-hidden">
                            <input
                                type="file"
                                multiple
                                required
                                accept="image/*,application/pdf"
                                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="pointer-events-none flex flex-col items-center gap-2">
                                <UploadCloud className="w-8 h-8 text-brand-400" />
                                <span className="text-xs font-bold text-brand-600 text-center">
                                    {files.length > 0
                                        ? `${files.length} file(s) selected`
                                        : "Click or drag to upload files"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                    >
                        {uploading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Uploading...
                            </>
                        ) : (
                            'Submit Review'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
