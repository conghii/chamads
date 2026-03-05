import React from 'react';
import { X, AlertTriangle, ArrowRight } from 'lucide-react';
import type { TopCampaign, ConvertingKeyword } from '../../types/analysis';
import { parseCampaignName } from '../../utils/campaignParser';
import { useActionQueue, createNegateAction, createBidChangeAction } from '../../services/actionQueueService';

interface Props {
    campaign: TopCampaign;
    onClose: () => void;
}

const CampaignAnalyzePanel: React.FC<Props> = ({ campaign, onClose }) => {
    const parsed = parseCampaignName(campaign.name);

    // Derived Metrics
    const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
    const formatPercent = (val: number) => `${val.toFixed(1)}%`;

    const cvr = campaign.clicks > 0 ? (campaign.orders / campaign.clicks) * 100 : 0;

    // Analyze Insights
    const bleedingTargets = campaign.keywords?.filter(kw => kw.orders === 0 && kw.spend > 15) || [];
    const highAcosTargets = campaign.keywords?.filter(kw => kw.acos > 30) || [];

    const hasBleeding = bleedingTargets.length > 0;
    const hasHighAcos = highAcosTargets.length > 0;
    const hasLowRoas = campaign.roas > 0 && campaign.roas < 1.0;

    const { addToQueue } = useActionQueue();

    const handleNegateTargets = (targets: ConvertingKeyword[]) => {
        targets.forEach(kw => {
            const action = createNegateAction(
                kw.keyword,
                campaign.name,
                'Auto', // Defaulting to Auto or unknown
                parsed.type,
                'negative_exact',
                {
                    priority: kw.acos > 0 ? 80 : 95,
                    spend: kw.spend,
                    sales: kw.sales,
                    acos: kw.acos,
                    orders: kw.orders,
                    clicks: kw.clicks
                }
            );
            addToQueue(action);
        });
    };

    const handleOptimizeBids = (targets: ConvertingKeyword[]) => {
        targets.forEach(kw => {
            const currentBid = kw.cpc || 1.0;
            const newBid = parseFloat((currentBid * 0.8).toFixed(2)); // Reduce by 20%
            const action = createBidChangeAction(
                kw.keyword,
                campaign.name,
                'Auto',
                kw.matchType || 'Exact',
                newBid,
                {
                    priority: 75,
                    spend: kw.spend,
                    sales: kw.sales,
                    acos: kw.acos,
                    orders: kw.orders,
                    clicks: kw.clicks,
                    currentBid: currentBid
                }
            );
            addToQueue(action);
        });
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[520px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out border-l border-gray-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <h2 className="text-base font-bold text-gray-900 leading-tight">{campaign.name}</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-gray-500 uppercase tracking-wider">{campaign.portfolioName || 'No Portfolio'}</span>
                            <span className="text-gray-300">•</span>
                            <span className={`px-1.5 py-0.5 rounded font-bold tracking-wider ${parsed.type === 'SB' ? 'bg-purple-50 text-purple-600' : parsed.type === 'SD' ? 'bg-indigo-50 text-indigo-600' : parsed.type === 'Auto' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                {parsed.type}
                            </span>
                            {parsed.targeting !== 'Unknown' && (
                                <span className={`px-1.5 py-0.5 rounded font-bold tracking-wider ${parsed.targeting === 'KT' ? 'bg-emerald-50 text-emerald-600' : parsed.targeting === 'PT' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
                                    {parsed.targeting}
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${campaign.state === 'enabled' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                                {campaign.state}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content Body - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50 flex flex-col gap-6">

                {/* Insights Action Banner */}
                {(hasBleeding || hasHighAcos || hasLowRoas) && (
                    <div className="bg-white border text-sm rounded-xl overflow-hidden shadow-sm flex flex-col border-red-200">
                        <div className="bg-red-50 px-4 py-3 flex items-start gap-3 border-b border-red-100">
                            <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-800">Critical Optimization Required</h4>
                                <p className="text-red-600 mt-0.5 text-xs leading-relaxed">
                                    {hasBleeding && `Found ${bleedingTargets.length} bleeding target(s) wasting ${formatCurrency(bleedingTargets.reduce((a, b) => a + b.spend, 0))}. `}
                                    {hasHighAcos && `Found ${highAcosTargets.length} target(s) with ACOS > 30%. `}
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-white flex flex-col gap-2">
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Recommended Actions</h5>
                            {hasBleeding && (
                                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                                    <span className="text-gray-700 text-xs font-medium">Pause or negate bleeding targets</span>
                                    <button
                                        onClick={() => handleNegateTargets(bleedingTargets)}
                                        className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors"
                                    >
                                        Negate Targets
                                    </button>
                                </div>
                            )}
                            {hasHighAcos && (
                                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                                    <span className="text-gray-700 text-xs font-medium">Reduce bids by 20% on high ACOS targets</span>
                                    <button
                                        onClick={() => handleOptimizeBids(highAcosTargets)}
                                        className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-md transition-colors"
                                    >
                                        Optimize Bids
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* KPI Grid */}
                <div>
                    <h3 className="text-sm font-bold text-gray-800 mb-3 ml-1">Performance Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Spend</p>
                            <p className="text-lg font-black text-gray-800 mt-0.5">{formatCurrency(campaign.spend)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sales</p>
                            <p className="text-lg font-black text-gray-800 mt-0.5">{formatCurrency(campaign.sales)}</p>
                        </div>
                        <div className={`p-3 rounded-xl border shadow-sm ${campaign.acos > 30 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${campaign.acos > 30 ? 'text-red-500' : 'text-gray-500'}`}>ACOS</p>
                            <p className={`text-lg font-black mt-0.5 ${campaign.acos > 30 ? 'text-red-700' : 'text-gray-800'}`}>
                                {campaign.sales > 0 ? formatPercent(campaign.acos) : '∞'}
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ROAS</p>
                            <p className="text-lg font-black text-gray-800 mt-0.5">{campaign.roas.toFixed(2)}x</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Orders</p>
                            <p className="text-lg font-black text-gray-800 mt-0.5">{campaign.orders}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">CVR</p>
                            <p className="text-lg font-black text-gray-800 mt-0.5">{cvr.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* Targets Table */}
                <div>
                    <h3 className="text-sm font-bold text-gray-800 mb-3 ml-1">Top Targets ({campaign.keywords?.length || 0})</h3>

                    {campaign.keywords && campaign.keywords.length > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-2.5">Target</th>
                                        <th className="px-4 py-2.5 text-right w-20">Spend</th>
                                        <th className="px-4 py-2.5 text-right w-20">ACOS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {/* Sort keywords by spend for preview */}
                                    {[...campaign.keywords].sort((a, b) => b.spend - a.spend).map((kw, idx) => {
                                        const kwBleeding = kw.orders === 0 && kw.spend > 15;
                                        const kwHighAcos = kw.acos > 30;

                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50/50 ${(kwBleeding || kwHighAcos) ? 'bg-red-50/20' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-800 truncate max-w-[200px]" title={kw.keyword}>
                                                        {kw.keyword}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider flex items-center gap-2">
                                                        <span>{kw.matchType}</span>
                                                        {(kwBleeding || kwHighAcos) && (
                                                            <span className="text-red-500 font-bold">{kwBleeding ? 'Bleeding' : 'High ACOS'}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-600">
                                                    {formatCurrency(kw.spend)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold">
                                                    <span className={kw.acos > 30 ? 'text-red-500' : 'text-gray-700'}>
                                                        {kw.sales > 0 ? formatPercent(kw.acos) : '-'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500 text-sm">
                            No target data available for this campaign.
                        </div>
                    )}
                </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Close
                </button>
                <button className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                    Open in Amazon <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default CampaignAnalyzePanel;
