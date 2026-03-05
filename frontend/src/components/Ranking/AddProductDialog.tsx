import React, { useState } from 'react';
import { X, Save, Plus, FileSpreadsheet, Keyboard } from 'lucide-react';
import type { ProductDetail } from '../../types';
import classNames from 'classnames';

interface AddProductDialogProps {
    onClose: () => void;
    onSave: (product: ProductDetail | ProductDetail[]) => void;
    existingAsins: string[];
}

export const AddProductDialog: React.FC<AddProductDialogProps> = ({ onClose, onSave, existingAsins }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'bulk_detect' | 'textarea'>('manual');

    // Manual Form State
    const [manualForm, setManualForm] = useState<Partial<ProductDetail>>({ asin: '', sku: '', name: '', status: 'Active' });

    // Textarea Form State
    const [bulkText, setBulkText] = useState('');
    const [parsedAsins, setParsedAsins] = useState<string[]>([]);

    const handleManualSave = () => {
        if (!manualForm.asin || manualForm.asin.length !== 10) {
            alert('ASIN hợp lệ phải có 10 ký tự');
            return;
        }
        if (existingAsins.includes(manualForm.asin.toUpperCase())) {
            alert('ASIN này đã tồn tại trong thư viện!');
            return;
        }

        const newProduct: ProductDetail = {
            asin: manualForm.asin.toUpperCase(),
            name: manualForm.name || 'N/A',
            sku: manualForm.sku?.toUpperCase() || '',
            status: manualForm.status as any,
            title: '',
            bulletPoints: '',
            description: '',
            genericKeywords: '',
            listingPlan: '',
            imageUrl: manualForm.imageUrl || ''
        };
        onSave(newProduct);
    };

    const handleTextareaParse = (text: string) => {
        setBulkText(text);
        const matches = text.toUpperCase().match(/[A-Z0-9]{10}/g);
        if (matches) {
            // Deduplicate and filter out existing
            const unique = Array.from(new Set(matches)).filter(asin => !existingAsins.includes(asin));
            setParsedAsins(unique);
        } else {
            setParsedAsins([]);
        }
    };

    const handleTextareaSave = () => {
        const productsToAdd: ProductDetail[] = parsedAsins.map(asin => ({
            asin,
            name: 'N/A',
            sku: '',
            status: 'Active',
            title: '', bulletPoints: '', description: '', genericKeywords: '', listingPlan: '',
            isAutoCreated: true
        }));

        if (productsToAdd.length > 0) {
            // Let the parent handle arrays or we call onSave multiple times. Let's pass array if supported, else loop.
            // Usually it's better to pass array and let parent do Promise.all()
            onSave(productsToAdd as any); // Assuming onSave can handle array in parent update
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <Plus size={24} className="text-blue-600" />
                            Thêm Sản Phẩm Mới
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Chọn phương thức nhập dữ liệu ASIN</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex gap-6 h-[400px]">
                    {/* Left Sidebar Tabs */}
                    <div className="w-1/3 flex flex-col gap-2 border-r border-slate-100 pr-6">
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={classNames("flex items-center gap-3 p-4 rounded-xl text-left transition-all font-bold", activeTab === 'manual' ? "bg-blue-50 text-blue-700 border-l-4 border-l-blue-600" : "text-slate-600 hover:bg-slate-50")}
                        >
                            <Keyboard size={20} className={activeTab === 'manual' ? "text-blue-600" : "text-slate-400"} />
                            <div className="leading-tight">
                                <span>Nhập Thủ Công</span>
                                <span className="block text-[10px] uppercase font-semibold text-slate-400 mt-1">1 ASIN + SKU</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveTab('textarea')}
                            className={classNames("flex items-center gap-3 p-4 rounded-xl text-left transition-all font-bold", activeTab === 'textarea' ? "bg-blue-50 text-blue-700 border-l-4 border-l-blue-600" : "text-slate-600 hover:bg-slate-50")}
                        >
                            <FileSpreadsheet size={20} className={activeTab === 'textarea' ? "text-blue-600" : "text-slate-400"} />
                            <div className="leading-tight">
                                <span>Paste Nhiều ASIN</span>
                                <span className="block text-[10px] uppercase font-semibold text-slate-400 mt-1">Hỗ trợ copy từ Excel</span>
                            </div>
                        </button>
                    </div>

                    {/* Right Content */}
                    <div className="w-2/3 flex flex-col justify-between">
                        {activeTab === 'manual' && (
                            <>
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">ASIN (Bắt buộc) *</label>
                                            <input
                                                type="text"
                                                maxLength={10}
                                                value={manualForm.asin}
                                                onChange={e => setManualForm({ ...manualForm, asin: e.target.value.toUpperCase() })}
                                                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                                                placeholder="B0..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">SKU (Tùy chọn)</label>
                                            <input
                                                type="text"
                                                value={manualForm.sku}
                                                onChange={e => setManualForm({ ...manualForm, sku: e.target.value.toUpperCase() })}
                                                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                                                placeholder="SKU-123"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tên Sản Phẩm (Tùy chọn)</label>
                                        <input
                                            type="text"
                                            value={manualForm.name}
                                            onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                            placeholder="Gõ tên hiển thị..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ảnh Sản Phẩm URL (Tùy chọn)</label>
                                        <input
                                            type="url"
                                            value={manualForm.imageUrl || ''}
                                            onChange={e => setManualForm({ ...manualForm, imageUrl: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-500"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleManualSave}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 mt-4"
                                >
                                    <Save size={20} />
                                    Lưu ASIN Mới
                                </button>
                            </>
                        )}

                        {activeTab === 'textarea' && (
                            <>
                                <div className="space-y-4 animate-in fade-in h-full flex flex-col">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex justify-between">
                                            <span>Danh sách ASINs</span>
                                            {parsedAsins.length > 0 && <span className="text-blue-600">Đã phát hiện {parsedAsins.length} ASIN mới</span>}
                                        </label>
                                        <textarea
                                            value={bulkText}
                                            onChange={e => handleTextareaParse(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase h-48"
                                            placeholder="B0XXXXXX1&#10;B0XXXXXX2&#10;B0XXXXXX3..."
                                        />
                                        <p className="text-[11px] text-slate-400 mt-2">Dán văn bản bất kỳ có chứa mã ASIN. Hệ thống sẽ tự lọc ra các ASIN hợp lệ (10 ký tự Alphanumeric) chưa lưu.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleTextareaSave}
                                    disabled={parsedAsins.length === 0}
                                    className={classNames("w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4", parsedAsins.length > 0 ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" : "bg-slate-100 text-slate-400 cursor-not-allowed")}
                                >
                                    <Save size={20} />
                                    Thêm Hàng Loạt ({parsedAsins.length})
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
