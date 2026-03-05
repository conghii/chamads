import React, { useState, useEffect } from 'react';
import { X, Save, ExternalLink, Activity, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import type { ProductDetail } from '../../types';
import classNames from 'classnames';

interface AsinEditPanelProps {
    product: ProductDetail;
    onClose: () => void;
    onSave: (updatedProduct: ProductDetail) => void;
    performanceData?: any; // Pass mocked performance from parent
}

export const AsinEditPanel: React.FC<AsinEditPanelProps> = ({ product, onClose, onSave, performanceData }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'listing' | 'performance' | 'links'>('info');
    const [formData, setFormData] = useState<ProductDetail>(product);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Ensure state updates if product prop changes while panel is open
    useEffect(() => {
        setFormData(product);
        setHasUnsavedChanges(false);
    }, [product]);

    const handleFieldChange = (field: keyof ProductDetail, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true);
    };

    const handleSave = () => {
        onSave(formData);
        setHasUnsavedChanges(false);
    };

    const countBytes = (str: string) => {
        return new Blob([str]).size;
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Slide-out Panel */}
            <div className="fixed top-0 right-0 bottom-0 w-full max-w-[550px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            {formData.name || 'ASIN Mới'}
                            {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-amber-500" title="Chưa lưu"></span>}
                        </h2>
                        <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded">{formData.asin}</span>
                            {formData.sku && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{formData.sku}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={!hasUnsavedChanges}
                            className={classNames(
                                "flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition-all",
                                hasUnsavedChanges ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            <Save size={16} /> Lưu
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 hide-scrollbar overflow-x-auto">
                    {[
                        { id: 'info', label: 'Thông tin' },
                        { id: 'listing', label: 'Listing Content' },
                        { id: 'performance', label: 'Performance' },
                        { id: 'links', label: 'Liên kết' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={classNames(
                                "py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors",
                                activeTab === tab.id
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">

                    {/* INFO TAB */}
                    {activeTab === 'info' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex gap-6">
                                <div className="w-32 h-32 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden relative group">
                                    {formData.imageUrl ? (
                                        <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <ImageIcon size={32} className="mb-2" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">No Image</span>
                                        </>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">Upload</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tên hiển thị nội bộ</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => handleFieldChange('name', e.target.value)}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">ASIN</label>
                                            <input type="text" value={formData.asin} readOnly disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-500 cursor-not-allowed" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">SKU</label>
                                            <input
                                                type="text"
                                                value={formData.sku}
                                                onChange={e => handleFieldChange('sku', e.target.value)}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Trạng Thái</label>
                                    <select
                                        value={formData.status || 'Active'}
                                        onChange={e => handleFieldChange('status', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    >
                                        <option value="Active">🟢 Active</option>
                                        <option value="Inactive">🟡 Inactive</option>
                                        <option value="Discontinued">🔴 Discontinued</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Image URL</label>
                                    <input
                                        type="url"
                                        value={formData.imageUrl || ''}
                                        onChange={e => handleFieldChange('imageUrl', e.target.value)}
                                        placeholder="https://..."
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ghi chú Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={e => handleFieldChange('notes', e.target.value)}
                                    placeholder="Thêm ghi chú nội bộ cho ASIN này..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px]"
                                />
                            </div>
                        </div>
                    )}

                    {/* LISTING CONTENT TAB */}
                    {activeTab === 'listing' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 pb-10">

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase">Title</label>
                                    <span className={classNames("text-xs font-mono", (formData.title?.length || 0) > 200 ? "text-red-500 font-bold" : "text-slate-400")}>
                                        {formData.title?.length || 0} / 200
                                    </span>
                                </div>
                                <textarea
                                    value={formData.title || ''}
                                    onChange={e => handleFieldChange('title', e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
                                />
                                {performanceData?.bestKw && (
                                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                        <Activity size={12} /> Suggestion: Ensure "{performanceData.bestKw}" is included.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Bullet Points</label>
                                <textarea
                                    value={formData.bulletPoints || ''}
                                    onChange={e => handleFieldChange('bulletPoints', e.target.value)}
                                    placeholder="Bullet 1&#10;Bullet 2&#10;..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[150px]"
                                />
                                <p className="text-[11px] text-slate-400 mt-1 text-right">Mỗi dòng 1 bullet. Giới hạn ~500 chars/bullet.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Product Description</label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={e => handleFieldChange('description', e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[120px]"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase">Search Terms (Backend Keywords)</label>
                                    <span className={classNames("text-xs font-mono", countBytes(formData.genericKeywords || '') > 249 ? "text-red-500 font-bold" : "text-slate-400")}>
                                        {countBytes(formData.genericKeywords || '')} / 249 bytes
                                    </span>
                                </div>
                                <textarea
                                    value={formData.genericKeywords || ''}
                                    onChange={e => handleFieldChange('genericKeywords', e.target.value)}
                                    placeholder="keyword1 keyword2 keyword3..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Amazon tính theo <b>bytes</b>, không phải số lượng ký tự. Cách nhau bằng dấu cách, không dùng dấu phẩy.
                                </p>
                            </div>

                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                <label className="block text-xs font-bold text-emerald-800 uppercase mb-2">Listing Plan / Hướng tối ưu</label>
                                <textarea
                                    value={formData.listingPlan || ''}
                                    onChange={e => handleFieldChange('listingPlan', e.target.value)}
                                    placeholder="Ghi chú các keywords cần thêm vào lần update tới..."
                                    className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[80px] bg-white text-emerald-900"
                                />
                            </div>

                        </div>
                    )}

                    {/* PERFORMANCE TAB */}
                    {activeTab === 'performance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            {!performanceData ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                                    <AlertTriangle className="mx-auto text-amber-500 mb-2" size={32} />
                                    <h4 className="font-bold text-amber-800 mb-1">Chưa có Data Hiệu Suất</h4>
                                    <p className="text-sm text-amber-700">Dữ liệu PPC và Ranking của ASIN này chưa được cập nhật từ Google Sheets. Hãy vào Data Hub để upload báo cáo.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                                        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 border-b border-blue-200/50 pb-2">PPC Performance (30 Days)</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-blue-600 font-medium mb-1">Total Sales</p>
                                                <p className="text-2xl font-black text-slate-800">${performanceData.sales.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-blue-600 font-medium mb-1">ACOS</p>
                                                <p className={classNames("text-2xl font-black", performanceData.acos < 30 ? "text-green-600" : performanceData.acos < 50 ? "text-yellow-600" : "text-red-500")}>
                                                    {performanceData.acos}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                                        <h3 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-4 border-b border-purple-200/50 pb-2">Organic & Sponsored Ranking</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-purple-600 font-medium mb-1">Keywords in Top 10</p>
                                                <p className="text-2xl font-black text-slate-800">{performanceData.top10Kw}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-purple-600 font-medium mb-1">Best Rank Keyword</p>
                                                <p className="text-lg font-bold text-slate-800 truncate" title={performanceData.bestKw}>
                                                    <span className="text-purple-600">#{performanceData.bestRank}</span> "{performanceData.bestKw}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 flex gap-2">
                                        <Activity size={16} className="text-slate-400 mt-0.5" />
                                        <p>Các chỉ số này được tổng hợp tự động từ Analysis Bulk và Ranking Tracker. Đảm bảo dữ liệu Google Sheets đã được cập nhật mới nhất.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* LINKS TAB */}
                    {activeTab === 'links' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Internal ChamMPPC Modules</h3>
                                <div className="space-y-2">
                                    <a href={`/asin-intelligence?asin=${formData.asin}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors group">
                                        <span className="font-bold">📊 ASIN Intelligence</span>
                                        <ExternalLink size={16} className="text-slate-400 group-hover:text-blue-500" />
                                    </a>
                                    <a href={`/ranking-tracker?search=${formData.asin}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors group">
                                        <span className="font-bold">📈 Ranking Tracker</span>
                                        <ExternalLink size={16} className="text-slate-400 group-hover:text-blue-500" />
                                    </a>
                                    <a href={`/harvest-hub?search=${formData.asin}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors group">
                                        <span className="font-bold">🌾 Harvest Hub (Tìm Search Terms)</span>
                                        <ExternalLink size={16} className="text-slate-400 group-hover:text-blue-500" />
                                    </a>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">External Links</h3>
                                <div className="space-y-2">
                                    <a href={`https://amazon.com/dp/${formData.asin}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                                        <span className="font-semibold flex items-center gap-2">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg" alt="Amazon" className="w-4 h-4" />
                                            Xem trên Amazon
                                        </span>
                                        <ExternalLink size={16} className="text-slate-400" />
                                    </a>
                                    <a href={`https://members.helium10.com/cerebro?asin=${formData.asin}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                                        <span className="font-semibold flex items-center gap-2">
                                            <span className="bg-blue-600 text-white text-[10px] px-1 rounded font-black">H10</span>
                                            Mở trong Cerebro
                                        </span>
                                        <ExternalLink size={16} className="text-slate-400" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
