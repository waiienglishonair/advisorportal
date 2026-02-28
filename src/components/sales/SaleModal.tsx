import { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, Check } from 'lucide-react';

export default function SaleModal({
    isOpen,
    onClose,
    onSave,
    products,
    currentSale = null
}: any) {
    const [client, setClient] = useState('');
    const [platform, setPlatform] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]); // array of objects { product, qty, price }
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('Complete');
    const [cxlReason, setCxlReason] = useState('');

    // Dropdown state
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [bundlePicks, setBundlePicks] = useState<Record<string, string[]>>({});
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (currentSale) {
                setClient(currentSale.client || '');
                setPlatform(currentSale.platforms || '');
                setNote(currentSale.note || '');
                setStatus(currentSale.status || 'Complete');
                setCxlReason(currentSale.cxl_reason || '');

                // parse product array if possible
                try {
                    const parsed = JSON.parse(currentSale.product);
                    if (Array.isArray(parsed)) {
                        setSelectedProducts(parsed.map((pName: string) => {
                            const found = products.find((prod: any) => prod.product === pName);
                            return {
                                product: pName,
                                advisor_price: found ? found.advisor_price : 0
                            };
                        }));
                    } else {
                        throw new Error();
                    }
                } catch {
                    // Fallback for old comma separated string
                    if (currentSale.product) {
                        const splitted = String(currentSale.product).split(',').map(s => s.trim());
                        setSelectedProducts(splitted.map(pName => {
                            const found = products.find((prod: any) => prod.product === pName);
                            return {
                                product: pName,
                                advisor_price: found ? found.advisor_price : 0,
                                bundle: found ? found.bundle : 'No',
                                bundle_item: found ? found.bundle_item : ''
                            };
                        }));
                    } else {
                        setSelectedProducts([]);
                    }
                }

                // Parse bundle_item string back to UI state if exists
                if (currentSale.bundle_item) {
                    const parsedPicks: Record<string, string[]> = {};
                    // e.g. "[Item A, Item B] | [Item C]" - this is tied to the selected products in order,
                    // but mapping it back perfectly is hard without structure. 
                    // We'll extract all items inside brackets.
                    try {
                        const productNames = (() => {
                            try { return JSON.parse(currentSale.product) || []; }
                            catch { return String(currentSale.product || '').split(',').map(s => s.trim()); }
                        })();

                        const bundleParts = currentSale.bundle_item.split('|').map((s: string) => s.trim());
                        let bundleIdx = 0;
                        productNames.forEach((pName: string) => {
                            const found = products.find((p: any) => p.product === pName);
                            if (found && (found.bundle || 'No').toLowerCase() === 'yes' && bundleParts[bundleIdx]) {
                                const content = bundleParts[bundleIdx].replace(/^\[|\]$/g, '');
                                parsedPicks[pName] = content.split(',').map((s: string) => s.trim()).filter(Boolean);
                                bundleIdx++;
                            }
                        });
                        setBundlePicks(parsedPicks);
                    } catch (e) {
                        console.error("Failed to parse bundle items", e);
                    }
                } else {
                    setBundlePicks({});
                }
            } else {
                // Reset form
                setClient('');
                setPlatform('');
                setSelectedProducts([]);
                setBundlePicks({});
                setNote('');
                setStatus('Complete');
                setCxlReason('');
            }
        }
    }, [isOpen, currentSale, products]);

    if (!isOpen) return null;

    const totalPrice = selectedProducts.reduce((sum, p) => sum + (Number(p.advisor_price) || 0), 0);
    const totalUnits = selectedProducts.length || 1;

    const handleSubmit = (e: any) => {
        e.preventDefault();

        // Construct the array of just the product names for saving
        const productNames = selectedProducts.map(p => p.product);

        // Construct the bundle_item string
        const bundleStrings: string[] = [];
        selectedProducts.forEach(p => {
            const pName = p.product;
            if ((p.bundle || 'No').toLowerCase() === 'yes') {
                if (bundlePicks[pName] && bundlePicks[pName].length > 0) {
                    bundleStrings.push(`[${bundlePicks[pName].join(', ')}]`);
                } else {
                    bundleStrings.push(`[]`);
                }
            }
        });
        const bundle_item = bundleStrings.join(' | ');

        const payload = {
            client,
            platforms: platform,
            product: productNames.join(', '), // Store as comma-separated string
            bundle_item,
            price: totalPrice,
            unit: totalUnits, // The GS script forced '1', but let's base it on selection length
            note,
            status,
            cxl_reason: status === 'Cancel' ? cxlReason : ''
        };

        onSave(payload);
    };

    const toggleProduct = (prod: any) => {
        if (selectedProducts.find(p => p.product === prod.product)) {
            setSelectedProducts(selectedProducts.filter(p => p.product !== prod.product));
            setBundlePicks(prev => {
                const next = { ...prev };
                delete next[prod.product];
                return next;
            });
        } else {
            setSelectedProducts([...selectedProducts, prod]);
        }
    };

    const toggleBundlePick = (bundleName: string, item: string, checked: boolean) => {
        setBundlePicks(prev => {
            const current = prev[bundleName] || [];
            if (checked && !current.includes(item)) {
                return { ...prev, [bundleName]: [...current, item] };
            } else if (!checked && current.includes(item)) {
                return { ...prev, [bundleName]: current.filter(i => i !== item) };
            }
            return prev;
        });
    };

    const filteredProducts = products.filter((p: any) =>
        p.product?.trim() &&
        p.product?.toLowerCase().includes(productSearch.toLowerCase()) &&
        (p.status || '').toLowerCase() === 'active'
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/70 backdrop-blur-xl text-brand-900 font-bold overflow-y-auto">
            <div className="bg-white w-full max-w-xl rounded-[48px] shadow-2xl overflow-hidden fade-in border-4 border-white font-bold my-auto relative">

                {/* Header */}
                <div className="px-8 md:px-10 py-6 md:py-8 border-b flex justify-between items-center bg-brand-50/50 font-black">
                    <h3 className="text-xl md:text-2xl text-brand-800 tracking-tight uppercase font-bold">
                        {currentSale ? 'Edit Sale Record' : 'New Sale Record'}
                    </h3>
                    <button onClick={onClose} className="text-brand-500 hover:text-brand-800 transition-colors">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 max-h-[75vh] overlay-scroll overflow-y-auto">

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Client Name</label>
                        <input
                            type="text"
                            required
                            value={client}
                            onChange={(e) => setClient(e.target.value)}
                            disabled={currentSale?.status === 'Cancel'}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl focus:border-blue-500 outline-none font-black text-lg disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Sales Channel</label>
                        <select
                            required
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            disabled={currentSale?.status === 'Cancel'}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl font-bold bg-white outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                            <option value="" disabled>Select Source...</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Line">Line</option>
                            <option value="Instagram">IG</option>
                            <option value="TikTok">TikTok</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="relative space-y-1" ref={dropdownRef}>
                        <label className="text-[10px] uppercase font-black text-brand-500">Product(s) Purchased</label>
                        <button
                            type="button"
                            onClick={() => !currentSale?.status?.includes('Cancel') && setIsProductDropdownOpen(!isProductDropdownOpen)}
                            disabled={currentSale?.status === 'Cancel'}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl bg-white flex justify-between items-center outline-none disabled:opacity-50"
                        >
                            <span className="font-bold text-brand-800 truncate pr-4">
                                {selectedProducts.length > 0
                                    ? selectedProducts.map(p => p.product).join(', ')
                                    : <span className="text-brand-400 italic">Select Active SKU...</span>}
                            </span>
                            <ChevronDown className={`w-5 h-5 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isProductDropdownOpen && (
                            <div className="absolute left-0 right-0 top-[110%] bg-white border-2 border-brand-100 rounded-3xl shadow-2xl z-[70] max-h-72 flex flex-col font-bold overflow-hidden">
                                <div className="p-3 border-b border-brand-100 bg-brand-50 font-black relative">
                                    <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-brand-400" />
                                    <input
                                        type="text"
                                        placeholder="Search SKU..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="overflow-y-auto p-2 space-y-1">
                                    {filteredProducts.map((prod: any) => {
                                        const isSelected = selectedProducts.find(p => p.product === prod.product);
                                        return (
                                            <div
                                                key={prod.product}
                                                onClick={() => toggleProduct(prod)}
                                                className={`p-3 rounded-xl flex justify-between items-center cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-brand-50'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">{prod.product}</span>
                                                    <span className="text-[10px] text-brand-500 uppercase">{prod.category}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="font-black">฿{prod.advisor_price}</span>
                                                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bundle Selection Section */}
                    {selectedProducts.some(p => (p.bundle || 'No').toLowerCase() === 'yes') && (
                        <div className="p-6 bg-blue-50/50 rounded-[32px] border-2 border-blue-100 font-black space-y-4 fade-in">
                            <h4 className="text-[10px] uppercase tracking-widest text-blue-600 font-black italic">Bundle Content Selection</h4>
                            <div className="space-y-4">
                                {selectedProducts.filter(p => (p.bundle || 'No').toLowerCase() === 'yes').map(b => {
                                    const bName = b.product;
                                    const subItems = (b.bundle_item || "").split(",").map((x: string) => x.trim()).filter(Boolean);
                                    if (subItems.length === 0) return null;

                                    return (
                                        <div key={bName} className="space-y-2">
                                            <p className="text-xs font-black text-brand-700 uppercase">Items for {bName}:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {subItems.map((item: string) => {
                                                    const isChecked = bundlePicks[bName]?.includes(item);
                                                    return (
                                                        <label key={item} className="cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="hidden peer"
                                                                checked={isChecked || false}
                                                                onChange={(e) => toggleBundlePick(bName, item, e.target.checked)}
                                                            />
                                                            <div className="px-4 py-2 border-2 border-brand-100 bg-white rounded-xl text-[10px] font-black text-brand-500 uppercase transition-all peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 peer-checked:shadow-lg peer-checked:shadow-brand-200">
                                                                {item}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6 font-bold">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black text-brand-500">Total Price (฿)</label>
                            <input
                                type="number"
                                readOnly
                                value={totalPrice}
                                className="w-full px-6 py-4 border-2 border-brand-100 bg-brand-50 rounded-2xl outline-none font-black text-xl text-blue-600"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black text-brand-500">Sale Units</label>
                            <input
                                type="number"
                                disabled
                                value={totalUnits}
                                className="w-full px-6 py-4 border-2 border-brand-100 bg-brand-50 rounded-2xl font-black text-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Note</label>
                        <textarea
                            placeholder="Sale Notes..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={currentSale?.status === 'Cancel'}
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl h-24 resize-none outline-none font-bold text-gray-600 focus:border-blue-500 disabled:opacity-50"
                        ></textarea>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-brand-500">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            disabled={currentSale?.status === 'Cancel'} // Once canceled, cannot un-cancel easily here per old UX
                            className="w-full px-6 py-4 border-2 border-brand-100 rounded-2xl font-bold bg-white outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                            <option value="Complete">Complete</option>
                            <option value="Cancel">Cancel</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>

                    {status === 'Cancel' && (
                        <div className="space-y-1 fade-in">
                            <label className="text-[10px] uppercase font-black text-red-500">Cancellation Reason</label>
                            <input
                                type="text"
                                required={status === 'Cancel'}
                                value={cxlReason}
                                onChange={(e) => setCxlReason(e.target.value)}
                                disabled={currentSale?.status === 'Cancel'}
                                placeholder="Why was this canceled?"
                                className="w-full px-6 py-4 border-2 border-red-200 bg-red-50 rounded-2xl outline-none font-bold text-red-600 placeholder-red-300 disabled:opacity-50"
                            />
                        </div>
                    )}

                    {currentSale?.status === 'Cancel' && (
                        <div className="p-4 bg-red-100 border border-red-200 text-red-600 rounded-2xl font-black text-center text-xs uppercase tracking-widest">
                            🚫 This record is Canceled and cannot be edited.
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={currentSale?.status === 'Cancel' || selectedProducts.length === 0}
                        className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black shadow-xl active:scale-[0.98] uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors mt-4"
                    >
                        Commit Record
                    </button>

                </form>
            </div>
        </div>
    );
}
