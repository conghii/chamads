import React, { useState } from 'react';
import { X, Ban } from 'lucide-react';
import type { SearchTermUsage } from '../../types/analysis';
import { useActionQueue, createNegateAction } from '../../services/actionQueueService';

interface NegatePanelProps {
    isOpen: boolean;
    onClose: () => void;
    term: SearchTermUsage | null;
}

export function NegatePanel({ isOpen, onClose, term }: NegatePanelProps) {
    const { addToQueue } = useActionQueue();
    const [negativeMatchType, setNegativeMatchType] = useState<'negative_exact' | 'negative_phrase'>('negative_exact');

    React.useEffect(() => {
        if (term) setNegativeMatchType('negative_exact');
    }, [term]);

    if (!isOpen || !term) return null;

    const handleSubmit = () => {
        const action = createNegateAction(
            term.searchTerm,
            term.campaignName,
            term.adGroupName,
            term.sourceMatchType,
            negativeMatchType,
            {
                priority: term.priorityScore,
                spend: term.spend,
                sales: term.sales,
                acos: term.acos,
                orders: term.orders,
                clicks: term.clicks,
            }
        );
        addToQueue(action);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40" />
            <div
                className="relative w-full max-w-[400px] bg-white h-full shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'slideInRight 250ms ease-out' }}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Ban size={18} className="text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Negate Search Term</h2>
                            <p className="text-xs text-gray-500">Block this term from triggering ads</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {/* Search Term Info */}
                    <div className="bg-red-50/50 rounded-xl p-4 border border-red-100">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Search Term Info</h3>
                        <p className="text-sm font-bold text-gray-900 mb-3">"{term.searchTerm}"</p>
                        <div className="text-xs text-gray-500 mb-2">
                            Campaign: <span className="font-medium text-gray-700">{term.campaignName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-lg p-2 border border-red-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Spend</div>
                                <div className="text-sm font-bold text-red-600">${term.spend.toFixed(2)}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-red-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Sales</div>
                                <div className="text-sm font-bold text-gray-900">${term.sales.toFixed(2)}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-red-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Clicks</div>
                                <div className="text-sm font-bold text-gray-900">{term.clicks}</div>
                            </div>
                        </div>
                    </div>

                    {/* Match Type */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Negative Match Type</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setNegativeMatchType('negative_exact')}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${negativeMatchType === 'negative_exact' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                            >
                                Negative Exact
                            </button>
                            <button
                                onClick={() => setNegativeMatchType('negative_phrase')}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${negativeMatchType === 'negative_phrase' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                            >
                                Negative Phrase
                            </button>
                        </div>
                    </div>

                    {/* Campaign (read-only) */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Campaign (Nguồn)</h3>
                        <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
                            {term.campaignName}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5">Negative sẽ được thêm vào campaign này.</p>
                    </div>

                    {/* Impact Warning */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
                        <Ban size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-amber-800">Tiết kiệm ước tính</p>
                            <p className="text-sm font-bold text-amber-700">${term.spend.toFixed(2)}/period</p>
                            <p className="text-[11px] text-amber-600 mt-0.5">Term này sẽ không trigger ads trong campaign này nữa.</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold transition-colors shadow-sm"
                    >
                        Thêm vào hàng đợi
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
