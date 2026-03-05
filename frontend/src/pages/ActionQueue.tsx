import React, { useState, useMemo } from 'react';
import { ClipboardList, Download, Trash2, ArrowRight, Pause, Briefcase, Plus, Minus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useActionQueue } from '../services/actionQueueService';
import type { ActionType, ActionStatus } from '../services/actionQueueService';
import ActionExportDialog from '../components/actions/ActionExportDialog';

// Types for UI Filters
type TabFilter = 'all' | 'harvest' | 'negate' | 'pause' | 'exported';

export const ActionQueue: React.FC = () => {
    const { actions, stats, clearQueue, markAsExported, updateAction } = useActionQueue();
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

    // Derived Statistics
    const pendingActions = useMemo(() => actions.filter(a => a.status === 'pending'), [actions]);
    const harvestActions = useMemo(() => pendingActions.filter(a => a.type === 'harvest'), [pendingActions]);
    const negateActions = useMemo(() => pendingActions.filter(a => a.type === 'negate'), [pendingActions]);
    const pauseActions = useMemo(() => pendingActions.filter(a => a.type === 'pause'), [pendingActions]);
    const exportedActions = useMemo(() => actions.filter(a => a.status === 'exported'), [actions]);

    const potentialSalesImpact = harvestActions.reduce((sum, a) => sum + (a.sales || 0), 0);
    const potentialWasteSaved = [...negateActions, ...pauseActions].reduce((sum, a) => sum + (a.spend || 0), 0);

    // Filter Logic
    const filteredActions = useMemo(() => {
        let result = actions;

        // Tab Filter
        if (activeTab === 'harvest') result = result.filter(a => a.type === 'harvest' && a.status === 'pending');
        else if (activeTab === 'negate') result = result.filter(a => a.type === 'negate' && a.status === 'pending');
        else if (activeTab === 'pause') result = result.filter(a => a.type === 'pause' && a.status === 'pending');
        else if (activeTab === 'exported') result = result.filter(a => a.status === 'exported');
        else result = result.filter(a => a.status === 'pending'); // 'all' tab shows pending only

        // Search Filter
        if (searchTerm) {
            const lowerQuery = searchTerm.toLowerCase();
            result = result.filter(a =>
                a.searchTerm.toLowerCase().includes(lowerQuery) ||
                a.sourceCampaign.toLowerCase().includes(lowerQuery)
            );
        }

        // Sort by newest first
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [actions, activeTab, searchTerm]);

    // Formatters
    const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
    const formatRelativeTime = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Vừa thêm';
        if (hours < 24) return `${hours} giờ qua`;
        return `${Math.floor(hours / 24)} ngày qua`;
    };

    // Bulk Actions Setup
    const toggleSelectRow = (id: string) => {
        const newSelected = new Set(selectedActionIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedActionIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedActionIds.size === filteredActions.length) setSelectedActionIds(new Set());
        else setSelectedActionIds(new Set(filteredActions.map(a => a.id)));
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50 flex flex-col gap-6 pb-32">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2.5 rounded-xl border border-blue-200 shadow-inner">
                            <ClipboardList className="text-blue-600 w-7 h-7" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                Action Queue
                                <span className="text-sm font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                                    {pendingActions.length} pending
                                </span>
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">Review và export bulk actions sang Amazon Ads Console.</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => clearQueue({ status: 'exported' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                    >
                        <Trash2 size={16} />
                        Xóa lịch sử đã Export
                    </button>

                    <button
                        onClick={() => setIsExportDialogOpen(true)}
                        disabled={pendingActions.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 border border-transparent text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg relative overflow-hidden group"
                    >
                        <Download size={18} strokeWidth={2.5} className="group-hover:translate-y-0.5 transition-transform" />
                        Export Amazon Bulk CSV
                    </button>
                </div>
            </div>

            {/* Impact Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Harvest Card */}
                <div className="bg-white rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 p-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full mix-blend-multiply opacity-50 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">CẦN HARVEST</p>
                            <h3 className="text-2xl font-black text-slate-800">{harvestActions.length} <span className="text-sm font-medium text-slate-500 lowercase">kiến nghị</span></h3>
                            <p className="text-xs font-semibold text-emerald-600 mt-2 bg-emerald-50 inline-block px-2 py-1 rounded border border-emerald-100">
                                Est. impact: +{formatCurrency(potentialSalesImpact)} sales
                            </p>
                        </div>
                        <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><Plus size={20} strokeWidth={3} /></div>
                    </div>
                </div>

                {/* Negate Card */}
                <div className="bg-white rounded-xl border-l-4 border-l-rose-500 border border-slate-200 p-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full mix-blend-multiply opacity-50 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">CẦN NEGATE</p>
                            <h3 className="text-2xl font-black text-slate-800">{negateActions.length} <span className="text-sm font-medium text-slate-500 lowercase">kiến nghị</span></h3>
                            <p className="text-xs font-semibold text-rose-600 mt-2 bg-rose-50 inline-block px-2 py-1 rounded border border-rose-100">
                                Waste: {formatCurrency(negateActions.reduce((a, b) => a + (b.spend || 0), 0))}
                            </p>
                        </div>
                        <div className="bg-rose-100 text-rose-600 p-2 rounded-lg"><Minus size={20} strokeWidth={3} /></div>
                    </div>
                </div>

                {/* Pause Card */}
                <div className="bg-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 p-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full mix-blend-multiply opacity-50 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">CẦN PAUSE</p>
                            <h3 className="text-2xl font-black text-slate-800">{pauseActions.length} <span className="text-sm font-medium text-slate-500 lowercase">campaigns</span></h3>
                            <p className="text-xs font-semibold text-amber-600 mt-2 bg-amber-50 inline-block px-2 py-1 rounded border border-amber-100">
                                Waste: {formatCurrency(pauseActions.reduce((a, b) => a + (b.spend || 0), 0))}
                            </p>
                        </div>
                        <div className="bg-amber-100 text-amber-600 p-2 rounded-lg"><Pause size={20} className="fill-current" /></div>
                    </div>
                </div>

                {/* Total Impact Card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg text-white relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div className="w-full">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Briefcase size={12} /> TỔNG QUAN ƯỚC TÍNH</p>
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-md border border-slate-700/50">
                                    <span className="text-xs text-slate-300 font-medium">Tiết kiệm phí lãng phí:</span>
                                    <span className="text-sm font-black text-emerald-400">+{formatCurrency(potentialWasteSaved)}/mo</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-md border border-slate-700/50">
                                    <span className="text-xs text-slate-300 font-medium">Doanh thu tiềm năng:</span>
                                    <span className="text-sm font-black text-blue-400">+{formatCurrency(potentialSalesImpact)}/mo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* List & Tabs Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">

                {/* Toolbar */}
                <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex bg-slate-200/60 p-1 rounded-lg self-start">
                        {(['all', 'harvest', 'negate', 'pause', 'exported'] as TabFilter[]).map((tab) => {
                            const counts = {
                                all: pendingActions.length,
                                harvest: harvestActions.length,
                                negate: negateActions.length,
                                pause: pauseActions.length,
                                exported: exportedActions.length
                            };
                            return (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setSelectedActionIds(new Set()); }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${activeTab === tab
                                        ? 'bg-white text-slate-900 shadow-sm border-slate-200 border'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 border border-transparent'
                                        }`}
                                >
                                    {tab === 'all' ? 'Tất cả Pending' : tab}
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                        {counts[tab]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm keyword / campaign..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 overflow-x-auto min-h-[300px]">
                    {filteredActions.length > 0 ? (
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-10 text-center shadow-[inset_0_-1px_0_0_#e2e8f0]">
                                        <input
                                            type="checkbox"
                                            checked={selectedActionIds.size > 0 && selectedActionIds.size === filteredActions.length}
                                            onChange={toggleSelectAll}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer bg-white"
                                        />
                                    </th>
                                    <th className="px-4 py-3 w-24 shadow-[inset_0_-1px_0_0_#e2e8f0]">Entity / Type</th>
                                    <th className="px-4 py-3 min-w-[200px] shadow-[inset_0_-1px_0_0_#e2e8f0]">Mục tiêu (Target / Source)</th>
                                    <th className="px-4 py-3 shadow-[inset_0_-1px_0_0_#e2e8f0]">Kế hoạch Action</th>
                                    <th className="px-4 py-3 w-28 text-center shadow-[inset_0_-1px_0_0_#e2e8f0]">Metadata</th>
                                    <th className="px-4 py-3 w-24 text-center shadow-[inset_0_-1px_0_0_#e2e8f0]">Status</th>
                                    <th className="px-4 py-3 w-16 text-center shadow-[inset_0_-1px_0_0_#e2e8f0]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredActions.map(action => {
                                    const isSelected = selectedActionIds.has(action.id);
                                    return (
                                        <tr key={action.id} className={`hover:bg-slate-50/80 transition-colors group ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectRow(action.id)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                                />
                                            </td>

                                            {/* Type Badge */}
                                            <td className="px-4 py-3">
                                                {action.type === 'harvest' && <span className="inline-flex items-center gap-1 font-bold text-[10px] tracking-wider uppercase text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded"><Plus size={10} /> Harvest</span>}
                                                {action.type === 'negate' && <span className="inline-flex items-center gap-1 font-bold text-[10px] tracking-wider uppercase text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded"><Minus size={10} /> Negate</span>}
                                                {action.type === 'pause' && <span className="inline-flex items-center gap-1 font-bold text-[10px] tracking-wider uppercase text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded"><Pause size={10} className="fill-current" /> Pause</span>}
                                            </td>

                                            {/* Action Info */}
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800 text-sm mb-0.5" title={action.searchTerm}>{action.searchTerm}</div>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-semibold px-1 rounded bg-slate-100 border border-slate-200">Src</span>
                                                    <span className="truncate max-w-[200px]" title={action.sourceCampaign}>{action.sourceCampaign || 'Unknown Campaign'}</span>
                                                </div>
                                            </td>

                                            {/* Resolution / Plan */}
                                            <td className="px-4 py-3">
                                                {action.type === 'harvest' && (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <ArrowRight size={12} className="text-emerald-500" />
                                                            <span className="font-bold text-slate-700 truncate max-w-[200px]">{action.targetCampaign || 'Chưa chọn Target'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 ml-4 font-medium">
                                                            <span className="uppercase tracking-wider border border-slate-200 px-1 rounded bg-slate-50">{action.targetMatchType}</span>
                                                            <span className="text-blue-600 font-bold bg-blue-50 px-1 rounded border border-blue-100">Bid: ${action.finalBid?.toFixed(2) || '0.00'}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {action.type === 'negate' && (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Trash2 size={12} className="text-rose-500" />
                                                            <span className="font-bold text-slate-700">Add Negative Keyword</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 ml-4 font-medium">
                                                            <span className="uppercase tracking-wider border border-slate-200 px-1 rounded bg-slate-50">{action.negativeMatchType}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {action.type === 'pause' && (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Pause size={12} className="text-amber-500" />
                                                            <span className="font-bold text-slate-700">Pause Campaign</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Metadata */}
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] font-bold text-slate-400" title="Thời gian thêm">{formatRelativeTime(action.createdAt)}</span>
                                                    {(action.spend > 0 || action.sales > 0) && (
                                                        <div className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-widest font-semibold">
                                                            S: ${action.sales} / W: ${action.spend}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3 text-center">
                                                {action.status === 'pending' && <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-full">Pending</span>}
                                                {action.status === 'exported' && <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">Exported</span>}
                                                {action.status === 'applied' && <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full">Applied</span>}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Remove from queue"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div className="w-20 h-20 bg-slate-100 border-2 dashed border-slate-300 rounded-full flex items-center justify-center mb-4">
                                <ClipboardList className="text-slate-400 w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có actions nào trong hàng đợi</h3>
                            <p className="text-sm text-slate-500 max-w-sm mb-6">Bạn chưa thêm hành động tối ưu nào. Quay lại Harvest Hub hoặc Analysis Bulk để tìm kiếm cơ hội.</p>
                            <div className="flex gap-3">
                                <Link to="/harvest-hub" className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                                    🌾 Mở Harvest Hub
                                </Link>
                                <Link to="/analysis-bulk" className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                                    📊 Mở Analysis Bulk
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bulk Actions Footer Bar */}
                {selectedActionIds.size > 0 && (
                    <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                        <div className="font-bold text-sm">Đã chọn {selectedActionIds.size} actions</div>
                        <div className="flex items-center gap-3">
                            <button className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded border border-blue-500 transition-colors">
                                Export Selected
                            </button>
                            <button className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded border border-rose-500 transition-colors shadow-sm cursor-pointer">
                                Remove
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Export Dialog */}
            {isExportDialogOpen && (
                <ActionExportDialog
                    onClose={() => setIsExportDialogOpen(false)}
                />
            )}
        </div>
    );
};

export default ActionQueue;
