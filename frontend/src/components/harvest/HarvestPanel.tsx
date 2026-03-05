import React, { useState } from 'react';
import { X, DollarSign, Target, ChevronDown } from 'lucide-react';
import type { SearchTermUsage } from '../../types/analysis';
import { useActionQueue, createHarvestAction } from '../../services/actionQueueService';

interface HarvestPanelProps {
    isOpen: boolean;
    onClose: () => void;
    term: SearchTermUsage | null;
    campaigns: string[];
    adGroupsMap: Record<string, string[]>; // campaignName -> adGroup[]
}

export function HarvestPanel({ isOpen, onClose, term, campaigns, adGroupsMap }: HarvestPanelProps) {
    const { addToQueue } = useActionQueue();

    const [targetCampaign, setTargetCampaign] = useState('');
    const [targetAdGroup, setTargetAdGroup] = useState('');
    const [isNewCampaign, setIsNewCampaign] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState('');
    const [matchType, setMatchType] = useState<'exact' | 'phrase'>('exact');
    const [bid, setBid] = useState(0);
    const [negateFromSource, setNegateFromSource] = useState(true);

    // Reset form when term changes
    React.useEffect(() => {
        if (term) {
            setBid(term.cpc > 0 ? parseFloat(term.cpc.toFixed(2)) : 0.50);
            setTargetCampaign('');
            setTargetAdGroup('');
            setIsNewCampaign(false);
            setNewCampaignName('');
            setMatchType('exact');
            setNegateFromSource(true);
        }
    }, [term]);

    if (!isOpen || !term) return null;

    const handleSubmit = () => {
        const finalCampaign = isNewCampaign ? newCampaignName : targetCampaign;
        if (!finalCampaign) return;

        const action = createHarvestAction(
            term.searchTerm,
            term.campaignName,
            term.adGroupName,
            term.sourceMatchType,
            finalCampaign,
            targetAdGroup || 'Auto',
            matchType,
            bid,
            negateFromSource,
            {
                priority: term.priorityScore,
                spend: term.spend,
                sales: term.sales,
                acos: term.acos,
                orders: term.orders,
                clicks: term.clicks,
                suggestedBid: term.cpc,
            }
        );

        addToQueue(action);
        onClose();
    };

    const availableAdGroups = targetCampaign && adGroupsMap[targetCampaign] ? adGroupsMap[targetCampaign] : [];

    const prioColor = term.priorityScore >= 90 ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : term.priorityScore >= 70 ? 'bg-green-100 text-green-700 border-green-200'
            : term.priorityScore >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                : 'bg-orange-100 text-orange-700 border-orange-200';

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 transition-opacity" />

            {/* Panel */}
            <div
                className="relative w-full max-w-[450px] bg-white h-full shadow-2xl flex flex-col animate-slide-in-right"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'slideInRight 250ms ease-out' }}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Target size={18} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Harvest Search Term</h2>
                            <p className="text-xs text-gray-500">Add to exact campaign for scaling</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {/* Section 1: Search Term Info */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Search Term Info</h3>
                        <p className="text-sm font-bold text-gray-900 mb-3">"{term.searchTerm}"</p>
                        <div className="text-xs text-gray-500 mb-2">
                            Source: <span className="font-medium text-gray-700">{term.campaignName}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Spend</div>
                                <div className="text-sm font-bold text-gray-900">${term.spend.toFixed(2)}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Sales</div>
                                <div className="text-sm font-bold text-emerald-600">${term.sales.toFixed(2)}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">ACOS</div>
                                <div className={`text-sm font-bold ${term.acos > 30 ? 'text-red-500' : 'text-green-600'}`}>{term.acos > 0 ? `${term.acos.toFixed(1)}%` : '-'}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Orders</div>
                                <div className="text-sm font-bold text-gray-900">{term.orders}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">Priority Score:</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prioColor}`}>{Math.round(term.priorityScore)}</span>
                        </div>
                    </div>

                    {/* Section 2: Target Campaign */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Chuyển vào campaign nào?</h3>
                        {!isNewCampaign ? (
                            <>
                                <div className="relative">
                                    <select
                                        value={targetCampaign}
                                        onChange={e => {
                                            if (e.target.value === '__NEW__') {
                                                setIsNewCampaign(true);
                                                setTargetCampaign('');
                                            } else {
                                                setTargetCampaign(e.target.value);
                                                setTargetAdGroup('');
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white pr-10"
                                    >
                                        <option value="">Select campaign...</option>
                                        {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                                        <option value="__NEW__">➕ Tạo campaign mới (nhập tên)</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                                </div>
                                {targetCampaign && availableAdGroups.length > 0 && (
                                    <div className="mt-2">
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">Ad Group</label>
                                        <select
                                            value={targetAdGroup}
                                            onChange={e => setTargetAdGroup(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Auto (create new)</option>
                                            {availableAdGroups.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                                        </select>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div>
                                <input
                                    type="text"
                                    placeholder="Tên campaign mới..."
                                    value={newCampaignName}
                                    onChange={e => setNewCampaignName(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                                <button onClick={() => { setIsNewCampaign(false); setNewCampaignName(''); }} className="text-xs text-blue-600 hover:text-blue-700 mt-1.5">
                                    ← Chọn campaign có sẵn
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Bid */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Bid</h3>
                        <div className="relative">
                            <DollarSign size={14} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="number"
                                step="0.01"
                                min="0.02"
                                max="100.00"
                                value={bid}
                                onChange={e => setBid(parseFloat(e.target.value) || 0)}
                                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5">Gợi ý dựa trên CPC hiện tại (${term.cpc.toFixed(2)}). Điều chỉnh theo chiến lược.</p>
                    </div>

                    {/* Section 4: Match Type */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Match Type</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMatchType('exact')}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${matchType === 'exact' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                            >
                                Exact
                            </button>
                            <button
                                onClick={() => setMatchType('phrase')}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${matchType === 'phrase' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                            >
                                Phrase
                            </button>
                        </div>
                    </div>

                    {/* Section 5: Negate from Source */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={negateFromSource}
                                onChange={e => setNegateFromSource(e.target.checked)}
                                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 mt-0.5"
                            />
                            <div>
                                <span className="text-sm font-medium text-amber-800">
                                    Thêm negative exact vào campaign nguồn
                                </span>
                                <p className="text-[11px] text-amber-600 mt-0.5">
                                    Tránh cannibalization giữa "{term.campaignName}" và campaign đích
                                </p>
                            </div>
                        </label>
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
                        disabled={!targetCampaign && !newCampaignName}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
