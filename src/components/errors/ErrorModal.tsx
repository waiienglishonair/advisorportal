import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function ErrorModal({
    isOpen,
    onClose,
    onSave,
    proshipProducts = [],
    user,
    editData = null
}: any) {
    const [customer, setCustomer] = useState('');
    const [platform, setPlatform] = useState('Facebook');
    const [orderTags, setOrderTags] = useState<string[]>([]);
    const [orderInput, setOrderInput] = useState('');
    const [recieveTags, setRecieveTags] = useState<string[]>([]);
    const [recieveInput, setRecieveInput] = useState('');
    const [orderValue, setOrderValue] = useState<number>(0);
    const [scenario, setScenario] = useState('1');

    // Scenario-specific fields
    const [recieveValue, setRecieveValue] = useState<number>(0);
    const [returnFee, setReturnFee] = useState<number>(0);
    const [expFee, setExpFee] = useState<number>(0);

    const isEditMode = !!editData;

    useEffect(() => {
        if (isOpen) {
            if (editData) {
                // Edit mode: pre-fill from fetched record
                setCustomer(editData.customer || '');
                setPlatform(editData.platform || 'Facebook');
                setOrderValue(Number(editData.order_value) || 0);
                setRecieveValue(Number(editData.recieve_value) || 0);
                setReturnFee(Number(editData.return_fee) || 0);
                setExpFee(Number(editData.exp_fee) || 0);

                // Parse comma-separated SKU into tag arrays
                const oTags = (editData.order_sku || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                const rTags = (editData.recieve_sku || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                setOrderTags(oTags);
                setRecieveTags(rTags);
                setOrderInput('');
                setRecieveInput('');

                // Parse scenario: "Scenario 3" → "3", or "3. ให้เก็บของไว้..." → "3"
                let scVal = editData.scenario || '1';
                const match = scVal.toString().match(/(\d+)/);
                if (match) scVal = match[1];
                setScenario(scVal);
            } else {
                // New mode: reset all fields
                setCustomer('');
                setPlatform('Facebook');
                setOrderTags([]);
                setOrderInput('');
                setRecieveTags([]);
                setRecieveInput('');
                setOrderValue(0);
                setScenario('1');
                setRecieveValue(0);
                setReturnFee(0);
                setExpFee(0);
            }
        }
    }, [isOpen, editData]);

    const handleAddTag = (type: 'order' | 'recieve', val: string) => {
        const trimmed = val.trim();
        if (!trimmed) return;
        if (type === 'order') {
            if (!orderTags.includes(trimmed)) setOrderTags([...orderTags, trimmed]);
            setOrderInput('');
        } else {
            if (!recieveTags.includes(trimmed)) setRecieveTags([...recieveTags, trimmed]);
            setRecieveInput('');
        }
    };

    const handleRemoveTag = (type: 'order' | 'recieve', index: number) => {
        if (type === 'order') {
            setOrderTags(prev => prev.filter((_, i) => i !== index));
        } else {
            setRecieveTags(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'order' | 'recieve') => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTag(type, type === 'order' ? orderInput : recieveInput);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'order' | 'recieve') => {
        const val = e.target.value;
        if (type === 'order') setOrderInput(val);
        else setRecieveInput(val);

        if (proshipProducts?.some((p: any) => `${p.name} (${p.sku})` === val)) {
            handleAddTag(type, val);
        }
    };

    // Calculate AmendRev based on Scenario
    // 1: RecieveValue - ExpFee
    // 2: (ReturnFee + ExpFee) * -1
    // 3: (OrderValue - RecieveValue) - ExpFee
    // 4: OrderValue - RecieveValue
    // 5: (OrderValue + ReturnFee) * -1
    const calculateAmendRev = () => {
        const oVal = Number(orderValue) || 0;
        const rVal = Number(recieveValue) || 0;
        const retFee = Number(returnFee) || 0;
        const eFee = Number(expFee) || 0;

        switch (scenario) {
            case '1': return rVal - eFee;
            case '2': return (retFee + eFee) * -1;
            case '3': return (oVal - rVal) - eFee;
            case '4': return oVal - rVal;
            case '5': return (oVal + retFee) * -1;
            default: return 0;
        }
    };

    const amendRev = calculateAmendRev();

    if (!isOpen) return null;

    const scenarioOptions: Record<string, string> = {
        '1': '1. Up-sell ลดราคา 20%',
        '2': '2. ส่งของคืน ส่งของใหม่ไป',
        '3': '3. ให้เก็บของไว้ แล้วส่งของใหม่ไป',
        '4': '4. ปฏิเสธข้อเสนอ ไม่ส่งของคืน',
        '5': '5. คืนของ + คืนเงิน',
    };

    const handleSubmit = (e: any) => {
        e.preventDefault();

        const payload: any = {
            customer,
            platform,
            order_sku: orderTags.join(', '),
            recieve_sku: recieveTags.join(', '),
            order_value: orderValue,
            recieve_value: recieveValue,
            return_fee: returnFee,
            exp_fee: expFee,
            scenario: scenarioOptions[scenario] || `Scenario ${scenario}`,
            amend_rev: amendRev
        };

        // Include record_id for edit mode
        if (isEditMode && editData?.record_id) {
            payload.record_id = editData.record_id;
        }

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-red-900/60 backdrop-blur-xl overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-[56px] shadow-2xl overflow-hidden fade-in border-8 border-white font-bold my-auto relative">

                <div className="px-8 md:px-12 py-8 md:py-10 border-b flex justify-between items-center bg-red-50/50 font-black">
                    <h3 className="text-xl md:text-2xl font-black uppercase text-red-800 flex items-center gap-2">
                        <AlertCircle className="w-6 h-6" /> {isEditMode ? 'Edit Error Record' : 'Error Order'}
                    </h3>
                    <button onClick={onClose} className="text-red-500 hover:text-red-800 transition-colors">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-6 max-h-[80vh] overflow-y-auto font-black text-brand-900">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black text-red-500">Customer Name</label>
                            <input
                                type="text"
                                required
                                value={customer}
                                onChange={e => setCustomer(e.target.value)}
                                className="w-full px-5 py-4 border-2 border-red-100 rounded-3xl outline-none font-bold focus:border-red-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black text-red-500">Platform</label>
                            <select
                                required
                                value={platform}
                                onChange={e => setPlatform(e.target.value)}
                                className="w-full px-5 py-4 border-2 border-red-100 rounded-3xl font-bold bg-white outline-none focus:border-red-500 transition-colors"
                            >
                                <option value="Facebook">Facebook</option>
                                <option value="Tiktok">Tiktok</option>
                                <option value="Line">Line</option>
                                <option value="Shopee">Shopee</option>
                                <option value="Lazada">Lazada</option>
                                <option value="IG">IG</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1 block">
                            <label className="text-[10px] uppercase font-black text-red-500">ของที่ลูกค้าสั่ง (Item Ordered)</label>
                            <div className="p-2 border-2 border-red-100 rounded-3xl bg-white flex flex-wrap gap-2 items-center min-h-[58px] focus-within:border-red-500 transition-colors">
                                {orderTags.map((tag, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold text-xs uppercase tracking-wider">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag('order', i)} className="hover:text-red-500 focus:outline-none">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    list="proship-sku-list"
                                    placeholder="Search/Type SKU..."
                                    value={orderInput}
                                    onChange={(e) => handleChange(e, 'order')}
                                    onKeyDown={(e) => handleKeyDown(e, 'order')}
                                    className="flex-1 min-w-[120px] px-3 py-2 outline-none font-bold bg-transparent text-sm"
                                    required={orderTags.length === 0}
                                />
                            </div>
                        </div>
                        <div className="space-y-1 block">
                            <label className="text-[10px] uppercase font-black text-red-500">ของที่ส่งผิด (Item Sent)</label>
                            <div className="p-2 border-2 border-red-100 rounded-3xl bg-white flex flex-wrap gap-2 items-center min-h-[58px] focus-within:border-red-500 transition-colors">
                                {recieveTags.map((tag, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold text-xs uppercase tracking-wider">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag('recieve', i)} className="hover:text-red-500 focus:outline-none">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    list="proship-sku-list"
                                    placeholder="Search/Type SKU..."
                                    value={recieveInput}
                                    onChange={(e) => handleChange(e, 'recieve')}
                                    onKeyDown={(e) => handleKeyDown(e, 'recieve')}
                                    className="flex-1 min-w-[120px] px-3 py-2 outline-none font-bold bg-transparent text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-red-500">ราคาของที่ลูกค้าสั่ง (Price of Ordered) *</label>
                        <input
                            type="number"
                            required
                            min="0"
                            value={orderValue || ''}
                            onChange={e => setOrderValue(Number(e.target.value))}
                            className="w-full px-5 py-4 border-2 border-red-100 rounded-3xl outline-none font-bold bg-white focus:border-red-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-2 p-6 bg-red-50 rounded-3xl border border-red-100">
                        <label className="text-[10px] uppercase font-black text-red-500">Scenario Selection</label>
                        <select
                            value={scenario}
                            onChange={e => {
                                setScenario(e.target.value);
                                setRecieveValue(0);
                                setReturnFee(0);
                                setExpFee(0);
                            }}
                            className="w-full px-5 py-4 border-2 border-red-200 bg-white rounded-2xl font-black text-red-600 outline-none"
                        >
                            <option value="1">1. Up-sell ลดราคา 20%</option>
                            <option value="2">2. ส่งของคืน ส่งของใหม่ไป</option>
                            <option value="3">3. ให้เก็บของไว้ แล้วส่งของใหม่ไป</option>
                            <option value="4">4. ปฏิเสธข้อเสนอ ไม่ส่งของคืน</option>
                            <option value="5">5. คืนของ + คืนเงิน</option>
                        </select>

                        {/* Dynamic fields based on Scenario */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            {['1', '3', '4'].includes(scenario) && (
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-red-400">ราคาของที่ส่งผิด / ราคาหลังหักส่วนลด*ถ้ามี (฿)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={recieveValue || ''}
                                        onChange={e => setRecieveValue(Number(e.target.value))}
                                        className="w-full px-4 py-3 border-2 border-red-100 rounded-2xl outline-none font-bold"
                                    />
                                </div>
                            )}
                            {['2', '5'].includes(scenario) && (
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-red-400">ค่าส่งกลับจากลูกค้า / Return Fee (฿)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={returnFee || ''}
                                        onChange={e => setReturnFee(Number(e.target.value))}
                                        className="w-full px-4 py-3 border-2 border-red-100 rounded-2xl outline-none font-bold"
                                    />
                                </div>
                            )}
                            {['1', '2', '3'].includes(scenario) && (
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black text-red-400">ค่าส่งของให้ลูกค้า / Del Fee (฿)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={expFee || ''}
                                        onChange={e => setExpFee(Number(e.target.value))}
                                        className="w-full px-4 py-3 border-2 border-red-100 rounded-2xl outline-none font-bold"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1 text-right pt-4">
                        <label className="text-[10px] uppercase font-black text-red-400">Amend Revenue (Auto-calculated)</label>
                        <input
                            type="text"
                            disabled
                            value={`฿${amendRev.toLocaleString()}`}
                            className="text-right w-full px-5 py-4 border-2 border-red-100 bg-red-50/50 rounded-3xl outline-none font-black text-2xl text-red-600"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl shadow-red-200 active:scale-[0.98] transition-all mt-4"
                    >
                        {isEditMode ? 'Update Error Record' : 'Save Error Record'}
                    </button>

                </form>

                <datalist id="proship-sku-list">
                    {proshipProducts?.map((p: any) => (
                        <option key={p.id || p.sku} value={`${p.name} (${p.sku})`} />
                    ))}
                </datalist>

            </div>
        </div>
    );
}
