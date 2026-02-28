import { X } from 'lucide-react';

interface ViewSaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: any;
}

export default function ViewSaleModal({ isOpen, onClose, sale }: ViewSaleModalProps) {
    if (!isOpen || !sale) return null;

    const bundleParts = sale.bundle_item ? sale.bundle_item.split('|').map((x: string) => x.trim()).filter(Boolean) : [];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-brand-900/60 backdrop-blur-xl overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden fade-in border-8 border-white font-bold relative my-auto">
                {/* Header */}
                <div className="px-8 md:px-12 py-8 md:py-10 border-b flex justify-between items-start bg-blue-50/50 font-black">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">
                            Sales Record Detail
                        </h3>
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl md:text-3xl font-black text-brand-800">
                                {sale.date_time ? new Date(sale.date_time).toLocaleDateString('en-GB', {
                                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                }).replace(',', '') : '-'}
                            </h2>
                            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-lg text-[10px] uppercase font-black">
                                {sale.advisor || 'Unknown'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-brand-500 hover:text-brand-700 transition-colors">
                        <X className="w-8 h-8" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 md:p-12 space-y-8 max-h-[60vh] overflow-y-auto">
                    {/* Client Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <p className="text-[10px] uppercase font-black text-brand-500 mb-1">Client Name</p>
                            <p className="text-lg font-black text-brand-800">{sale.client || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black text-brand-500 mb-1">Platform</p>
                            <p className="text-lg font-black text-brand-800">{sale.platforms || '-'}</p>
                        </div>
                    </div>

                    {/* Product Section */}
                    <div className="bg-brand-50 rounded-3xl p-6 border border-brand-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] uppercase font-black text-brand-500">Products Sold</p>
                            <p className="text-xl font-black text-blue-600 tabular-nums">
                                ฿{(Number(sale.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-sm font-bold text-brand-700 leading-relaxed">
                            {sale.product || '-'}
                        </div>
                    </div>

                    {/* Bundle Section */}
                    {bundleParts.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-black text-brand-500">Bundle Breakdown</p>
                            <div className="flex flex-wrap gap-2">
                                {bundleParts.map((p: string, i: number) => (
                                    <span key={i} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black border border-blue-100 uppercase shadow-sm">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Note Section */}
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase font-black text-brand-500">Note</p>
                        <p className="text-sm font-bold text-gray-600 italic bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                            {sale.note || 'No notes recorded.'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 md:px-12 py-8 bg-brand-50 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 bg-brand-200 hover:bg-brand-300 text-brand-700 rounded-2xl font-black uppercase text-xs transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
