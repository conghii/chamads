import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, HelpCircle, AlertCircle } from 'lucide-react';
import { useProfit } from '../../services/profitService';
import classNames from 'classnames';

interface CostSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const CostSettingsDialog: React.FC<CostSettingsDialogProps> = ({ isOpen, onClose }) => {
    const { globalConfig, updateGlobalConfig, costConfigs, updateCostConfig } = useProfit();
    const [margin, setMargin] = useState(globalConfig.defaultProfitMarginBeforeAds || 30);
    const [activeTab, setActiveTab] = useState<'global' | 'products'>('global');
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetch('http://localhost:3000/api/products')
                .then(res => res.json())
                .then(data => setProducts(data.filter((p: any) => p.asin)));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSaveGlobal = () => {
        updateGlobalConfig({
            ...globalConfig,
            defaultProfitMarginBeforeAds: margin
        });
        onClose();
    };

    const handleProductChange = (asin: string, field: string, value: number) => {
        const current = costConfigs[asin] || {
            asin,
            sellingPrice: 0,
            cogs: 0,
            shippingToFba: 0,
            packaging: 0,
            referralFeePercentage: globalConfig.defaultReferralFeePercentage || 15,
            fbaFee: 0,
            storageFee: 0,
            lastUpdated: new Date().toISOString()
        };

        updateCostConfig({
            ...current,
            [field]: value,
            lastUpdated: new Date().toISOString()
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <Calculator className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Cấu hình chi phí</h2>
                            <p className="text-xs font-medium text-slate-500">Thiết lập các tham số để tính toán lợi nhuận ròng.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-8 flex border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('global')}
                        className={classNames(
                            "px-6 py-4 text-sm font-black transition-all border-b-2",
                            activeTab === 'global' ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Global Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={classNames(
                            "px-6 py-4 text-sm font-black transition-all border-b-2",
                            activeTab === 'products' ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Per-Product Costs
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 max-h-[60vh] overflow-y-auto">
                    {activeTab === 'global' ? (
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <HelpCircle size={18} className="text-blue-500" />
                                Cách tính nhanh (Quick Margin)
                            </h3>
                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Profit margin trước ads (Break-even):</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        value={margin}
                                        onChange={(e) => setMargin(Number(e.target.value))}
                                        className="w-24 px-4 py-2 rounded-xl border border-blue-200 text-lg font-black text-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                    <div className="text-2xl font-black text-blue-300">%</div>
                                    <div className="flex-1 text-xs text-blue-600 font-medium leading-relaxed">
                                        Nếu bạn biết Profit Margin gộp (sau khi trừ COGS, FBA, Referral fee), hãy nhập vào đây.
                                        Hệ thống sẽ dùng số này để tính <strong>Break-even ACOS</strong>.
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                    <AlertCircle size={18} className="text-amber-500" />
                                    Chi tiết theo ASIN
                                </h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{products.length} Products Found</span>
                            </div>

                            <div className="space-y-3">
                                {products.map(p => {
                                    const config = costConfigs[p.asin] || {};
                                    return (
                                        <div key={p.asin} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-black text-blue-600 text-xs shadow-sm">
                                                        {p.asin.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-slate-800 truncate max-w-[200px]">{p.name || 'N/A'}</div>
                                                        <div className="text-[10px] font-bold text-slate-400">{p.asin}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">COGS ($)</label>
                                                    <input
                                                        type="number"
                                                        value={config.cogs || ''}
                                                        placeholder="0.00"
                                                        onChange={(e) => handleProductChange(p.asin, 'cogs', Number(e.target.value))}
                                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">FBA Fee ($)</label>
                                                    <input
                                                        type="number"
                                                        value={config.fbaFee || ''}
                                                        placeholder="0.00"
                                                        onChange={(e) => handleProductChange(p.asin, 'fbaFee', Number(e.target.value))}
                                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Referral (%)</label>
                                                    <input
                                                        type="number"
                                                        value={config.referralFeePercentage || ''}
                                                        placeholder="15"
                                                        onChange={(e) => handleProductChange(p.asin, 'referralFeePercentage', Number(e.target.value))}
                                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400">Thay đổi được tự động đồng bộ Firestore.</p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
                        >
                            Đóng
                        </button>
                        {activeTab === 'global' && (
                            <button
                                onClick={handleSaveGlobal}
                                className="px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Save size={18} />
                                Lưu Global Margin
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CostSettingsDialog;
