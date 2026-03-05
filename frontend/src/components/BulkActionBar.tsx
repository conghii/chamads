import { useState } from 'react';
import { X, Target, Ban, Copy, Download, Pause, Play, Tag, ChevronDown } from 'lucide-react';
import type { SearchTermUsage } from '../types/analysis';
import { useActionQueue, createHarvestAction, createNegateAction } from '../services/actionQueueService';

interface BulkActionBarProps {
    selectedCount: number;
    selectedItems: SearchTermUsage[];
    context: 'harvest_hub' | 'analysis_bulk';
    onClearSelection: () => void;
    campaigns?: string[];
    adGroupsMap?: Record<string, string[]>;
}

export function BulkActionBar({
    selectedCount,
    selectedItems,
    context,
    onClearSelection,
    campaigns = [],
    adGroupsMap = {},
}: BulkActionBarProps) {
    const { bulkAddToQueue } = useActionQueue();
    const [showHarvestDialog, setShowHarvestDialog] = useState(false);
    const [showNegateDialog, setShowNegateDialog] = useState(false);

    // Bulk Harvest state
    const [bulkCampaign, setBulkCampaign] = useState('');
    const [bulkAdGroup, setBulkAdGroup] = useState('');
    const [bulkBid, setBulkBid] = useState(0.50);
    const [bulkMatchType, setBulkMatchType] = useState<'exact' | 'phrase'>('exact');
    const [bulkNegateSource, setBulkNegateSource] = useState(true);

    // Bulk Negate state
    const [bulkNegativeMatchType, setBulkNegativeMatchType] = useState<'negative_exact' | 'negative_phrase'>('negative_exact');

    if (selectedCount === 0) return null;

    const handleBulkHarvest = () => {
        if (!bulkCampaign) return;
        const actions = selectedItems.map(term =>
            createHarvestAction(
                term.searchTerm,
                term.campaignName,
                term.adGroupName,
                term.sourceMatchType,
                bulkCampaign,
                bulkAdGroup || 'Auto',
                bulkMatchType,
                bulkBid,
                bulkNegateSource,
                {
                    priority: term.priorityScore,
                    spend: term.spend,
                    sales: term.sales,
                    acos: term.acos,
                    orders: term.orders,
                    clicks: term.clicks,
                    suggestedBid: term.cpc,
                }
            )
        );
        bulkAddToQueue(actions);
        setShowHarvestDialog(false);
        onClearSelection();
    };

    const handleBulkNegate = () => {
        const actions = selectedItems.map(term =>
            createNegateAction(
                term.searchTerm,
                term.campaignName,
                term.adGroupName,
                term.sourceMatchType,
                bulkNegativeMatchType,
                {
                    priority: term.priorityScore,
                    spend: term.spend,
                    sales: term.sales,
                    acos: term.acos,
                    orders: term.orders,
                    clicks: term.clicks,
                }
            )
        );
        bulkAddToQueue(actions);
        setShowNegateDialog(false);
        onClearSelection();
    };

    const handleCopyTerms = () => {
        const text = selectedItems.map(t => t.searchTerm).join('\n');
        navigator.clipboard.writeText(text);
    };

    const availableAdGroups = bulkCampaign && adGroupsMap[bulkCampaign] ? adGroupsMap[bulkCampaign] : [];

    return (
        <>
            {/* Floating Bar */}
            <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-[#1E293B] text-white rounded-xl shadow-2xl border border-gray-700"
                style={{ animation: 'slideUp 200ms ease-out' }}
            >
                {/* Left: Selection info */}
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                        Đã chọn <span className="font-bold text-blue-400">{selectedCount}</span> {context === 'harvest_hub' ? 'terms' : 'campaigns'}
                    </span>
                    <button onClick={onClearSelection} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                        <X size={12} /> Bỏ chọn
                    </button>
                </div>

                <div className="h-6 w-px bg-gray-600" />

                {/* Right: Action buttons */}
                {context === 'harvest_hub' ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const avgCpc = selectedItems.reduce((s, t) => s + t.cpc, 0) / selectedItems.length;
                                setBulkBid(parseFloat(avgCpc.toFixed(2)) || 0.50);
                                setBulkCampaign('');
                                setBulkAdGroup('');
                                setShowHarvestDialog(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Target size={12} /> Bulk Harvest
                        </button>
                        <button
                            onClick={() => { setBulkNegativeMatchType('negative_exact'); setShowNegateDialog(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Ban size={12} /> Bulk Negate
                        </button>
                        <button
                            onClick={handleCopyTerms}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Copy size={12} /> Copy Terms
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-xs font-medium transition-colors">
                            <Pause size={12} /> Pause
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors">
                            <Play size={12} /> Enable
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs font-medium transition-colors">
                            <Download size={12} /> Export
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs font-medium transition-colors">
                            <Tag size={12} /> Tag
                        </button>
                    </div>
                )}
            </div>

            {/* Bulk Harvest Dialog */}
            {showHarvestDialog && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowHarvestDialog(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900">
                                Harvest {selectedCount} search terms
                            </h3>
                            <button onClick={() => setShowHarvestDialog(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Target Campaign</label>
                                <div className="relative">
                                    <select
                                        value={bulkCampaign}
                                        onChange={e => { setBulkCampaign(e.target.value); setBulkAdGroup(''); }}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-10"
                                    >
                                        <option value="">Select campaign...</option>
                                        {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {availableAdGroups.length > 0 && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ad Group</label>
                                    <select
                                        value={bulkAdGroup}
                                        onChange={e => setBulkAdGroup(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Auto (create new)</option>
                                        {availableAdGroups.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Match Type</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setBulkMatchType('exact')}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all ${bulkMatchType === 'exact' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                                        >
                                            Exact
                                        </button>
                                        <button
                                            onClick={() => setBulkMatchType('phrase')}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all ${bulkMatchType === 'phrase' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                                        >
                                            Phrase
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Bid ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.02"
                                        max="100"
                                        value={bulkBid}
                                        onChange={e => setBulkBid(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <input
                                    type="checkbox"
                                    checked={bulkNegateSource}
                                    onChange={e => setBulkNegateSource(e.target.checked)}
                                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-sm text-amber-800 font-medium">Negate tất cả từ campaign nguồn</span>
                            </label>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowHarvestDialog(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                                Hủy
                            </button>
                            <button
                                onClick={handleBulkHarvest}
                                disabled={!bulkCampaign}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Thêm {selectedCount} actions vào hàng đợi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Negate Dialog */}
            {showNegateDialog && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowNegateDialog(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900">
                                Thêm {selectedCount} negative keywords vào hàng đợi?
                            </h3>
                            <button onClick={() => setShowNegateDialog(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Match Type</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setBulkNegativeMatchType('negative_exact')}
                                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${bulkNegativeMatchType === 'negative_exact' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}
                                    >
                                        Negative Exact
                                    </button>
                                    <button
                                        onClick={() => setBulkNegativeMatchType('negative_phrase')}
                                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${bulkNegativeMatchType === 'negative_phrase' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}
                                    >
                                        Negative Phrase
                                    </button>
                                </div>
                            </div>

                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-xs text-red-700">
                                <p className="font-bold mb-1">Tổng spend ảnh hưởng:</p>
                                <p className="text-lg font-bold">${selectedItems.reduce((s, t) => s + t.spend, 0).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowNegateDialog(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                                Hủy
                            </button>
                            <button
                                onClick={handleBulkNegate}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold shadow-sm"
                            >
                                Thêm {selectedCount} negatives vào hàng đợi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </>
    );
}
