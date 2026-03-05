import { useState, useMemo } from 'react';
import { X, Download, Trash2, CheckCircle, Edit2, AlertTriangle } from 'lucide-react';
import { useActionQueue, exportAmazonBulkCSV } from '../../services/actionQueueService';
import type { PendingAction } from '../../services/actionQueueService';

interface ActionQueuePanelProps {
    isOpen: boolean;
    onClose: () => void;
    onEditHarvest?: (action: PendingAction) => void;
    onEditNegate?: (action: PendingAction) => void;
}

type FilterTab = 'all' | 'harvest' | 'negate';

export function ActionQueuePanel({ isOpen, onClose, onEditHarvest, onEditNegate }: ActionQueuePanelProps) {
    const { actions, stats, removeFromQueue, markAsExported, clearQueue } = useActionQueue();
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [showExportBanner, setShowExportBanner] = useState(false);
    const [exportedCount, setExportedCount] = useState(0);

    const filteredActions = useMemo(() => {
        let result = actions;
        if (activeTab === 'harvest') result = result.filter(a => a.type === 'harvest');
        if (activeTab === 'negate') result = result.filter(a => a.type === 'negate');
        // Show pending first, then exported
        return result.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [actions, activeTab]);

    const pendingActions = actions.filter(a => a.status === 'pending');

    // Harvest summary
    const harvestSummary = useMemo(() => {
        const harvests = pendingActions.filter(a => a.type === 'harvest');
        const targetCampaigns = new Set(harvests.map(a => a.targetCampaign).filter(Boolean));
        return { count: harvests.length, campaigns: targetCampaigns.size };
    }, [pendingActions]);

    const negateSummary = useMemo(() => {
        return pendingActions.filter(a => a.type === 'negate').length;
    }, [pendingActions]);

    if (!isOpen) return null;

    const handleExport = () => {
        const toExport = pendingActions;
        if (toExport.length === 0) return;

        exportAmazonBulkCSV(toExport);
        setExportedCount(toExport.length);
        setShowExportBanner(true);
    };

    const handleMarkExported = () => {
        const ids = pendingActions.map(a => a.id);
        markAsExported(ids);
        setShowExportBanner(false);
    };

    const handleClearAll = () => {
        if (window.confirm('Xóa tất cả actions trong hàng đợi?')) {
            clearQueue();
            setShowExportBanner(false);
        }
    };

    const handleEdit = (action: PendingAction) => {
        if (action.type === 'harvest' && onEditHarvest) onEditHarvest(action);
        if (action.type === 'negate' && onEditNegate) onEditNegate(action);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40" />
            <div
                className="relative w-full max-w-[600px] bg-white h-full shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'slideInRight 250ms ease-out' }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-gray-900">Action Queue</h2>
                        {stats.totalCount > 0 && (
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                {stats.totalCount} actions
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-3 border-b border-gray-200 flex gap-1 bg-white">
                    {([
                        { key: 'all' as FilterTab, label: 'Tất cả', count: actions.length },
                        { key: 'harvest' as FilterTab, label: 'Harvest', count: stats.harvestCount },
                        { key: 'negate' as FilterTab, label: 'Negate', count: stats.negateCount },
                    ]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key
                                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab.label} {tab.count > 0 && <span className="ml-1 font-bold">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Export Banner */}
                {showExportBanner && (
                    <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                        <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-emerald-800">
                                ✅ Đã export {exportedCount} actions
                            </p>
                            <p className="text-[11px] text-emerald-600 mt-0.5">
                                Upload file vào Amazon Ads Console → Campaign Manager → Bulk Operations.
                            </p>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    {filteredActions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <AlertTriangle size={32} className="mb-3 opacity-50" />
                            <p className="text-sm font-medium">No actions in queue</p>
                            <p className="text-xs mt-1">Use "Move to Exact" or "Add Negative" to add actions</p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 text-left font-bold">Search Term</th>
                                    <th className="px-3 py-2.5 text-left font-bold w-20">Type</th>
                                    <th className="px-3 py-2.5 text-left font-bold">Target</th>
                                    <th className="px-3 py-2.5 text-right font-bold w-16">Bid</th>
                                    <th className="px-3 py-2.5 text-right font-bold w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredActions.map(action => (
                                    <tr
                                        key={action.id}
                                        className={`group transition-colors ${action.status === 'exported' ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 truncate max-w-[180px]">{action.searchTerm}</div>
                                            <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{action.sourceCampaign}</div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${action.type === 'harvest'
                                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                {action.type.toUpperCase()}
                                            </span>
                                            {action.status === 'exported' && (
                                                <span className="ml-1 text-[9px] text-gray-400">✓</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="text-gray-700 truncate max-w-[120px]">
                                                {action.type === 'harvest' ? action.targetCampaign : action.sourceCampaign}
                                            </div>
                                            {action.type === 'harvest' && action.negateFromSource && (
                                                <div className="text-[9px] text-amber-600 font-medium">+ negate source</div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right font-medium text-gray-900">
                                            {action.type === 'harvest' ? `$${action.finalBid.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(action)}
                                                    className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => removeFromQueue(action.id)}
                                                    className="p-1 hover:bg-red-100 rounded text-red-600"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Summary + Action Buttons (sticky bottom) */}
                <div className="border-t border-gray-200 bg-gray-50">
                    {/* Summary */}
                    <div className="px-6 py-3 border-b border-gray-100 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-bold text-blue-600">Harvest: {harvestSummary.count} terms</span>
                                {harvestSummary.campaigns > 0 && <span className="text-gray-400"> → {harvestSummary.campaigns} campaigns</span>}
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="font-bold text-red-600">Negate: {negateSummary} terms</span>
                            </div>
                            <div className="text-gray-500">
                                Impact: <span className="font-bold text-gray-800">${stats.totalSpendImpact.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="px-6 py-3 flex items-center gap-3">
                        <button
                            onClick={handleExport}
                            disabled={pendingActions.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={14} /> Export Amazon Bulk CSV
                        </button>
                        <button
                            onClick={handleMarkExported}
                            disabled={pendingActions.length === 0}
                            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            <CheckCircle size={12} className="inline mr-1" /> Đánh dấu đã thực hiện
                        </button>
                        <button
                            onClick={handleClearAll}
                            disabled={actions.length === 0}
                            className="px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            <Trash2 size={12} className="inline mr-1" /> Xóa tất cả
                        </button>
                    </div>
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
