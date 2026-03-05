
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ky from 'ky';
import type { SearchTermAnalysisData, SearchTermUsage } from '../types/analysis';
import {
    Search, Filter,
    TrendingUp, TrendingDown, Target,
    ArrowUpDown, AlertTriangle,
    ChevronDown, ChevronRight, Ban, ClipboardList, Calendar
} from 'lucide-react';
import { useActionQueue } from '../services/actionQueueService';
import { HarvestPanel } from '../components/harvest/HarvestPanel';
import { NegatePanel } from '../components/harvest/NegatePanel';
import { ActionQueuePanel } from '../components/harvest/ActionQueuePanel';
import { BulkActionBar } from '../components/BulkActionBar';

type TabType = 'SCALE' | 'RANK' | 'PROFIT' | 'ALL' | 'NEGATE' | 'ASIN';

const TAB_TOOLTIPS: Record<TabType, string> = {
    SCALE: 'Search terms đã có sales, ACOS tốt. Harvest sang exact campaign để scale volume.',
    RANK: 'Search terms quan trọng cho organic rank. Chấp nhận ACOS cao để đẩy rank.',
    PROFIT: 'Search terms có ACOS rất thấp, tập trung vào lợi nhuận.',
    ALL: 'Tất cả search terms, không lọc.',
    NEGATE: 'Search terms có clicks nhưng 0 orders hoặc ACOS quá cao. Cần negate để tiết kiệm.',
    ASIN: 'Search terms là ASIN codes (product targeting), phân tích riêng.'
};

const isAsinTerm = (term: string) => /^[Bb]0[A-Za-z0-9]{8,}$/.test(term.trim());

const HarvestHub: React.FC = () => {
    const [data, setData] = useState<SearchTermAnalysisData | null>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    // Filters
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab')?.toUpperCase() || 'SCALE') as TabType;

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);

    // Sync activeTab to URL
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);
        let changed = false;

        if (activeTab !== 'SCALE') {
            if (newParams.get('tab') !== activeTab.toLowerCase()) {
                newParams.set('tab', activeTab.toLowerCase());
                changed = true;
            }
        } else {
            if (newParams.has('tab')) {
                newParams.delete('tab');
                changed = true;
            }
        }

        if (changed) {
            setSearchParams(newParams, { replace: true });
        }
    }, [activeTab, searchParams, setSearchParams]);
    const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
    const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

    // Action Queue (from context)
    const { stats: queueStats } = useActionQueue();

    // Panels
    const [showHarvestPanel, setShowHarvestPanel] = useState(false);
    const [showNegatePanel, setShowNegatePanel] = useState(false);
    const [showQueuePanel, setShowQueuePanel] = useState(false);
    const [panelTerm, setPanelTerm] = useState<SearchTermUsage | null>(null);

    const [hideExisting, setHideExisting] = useState(true);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof SearchTermUsage; direction: 'asc' | 'desc' | null }>({ key: 'priorityScore', direction: 'desc' });



    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(100);

    useEffect(() => {
        fetchData();
    }, []);

    // ... fetchData ...
    // Note: ensure fetchData is preserved or I need to span across it. 
    // The previous code had fetchData between useEffect and handleSort. 
    // I will try to match the block exactly.

    const fetchData = async () => {
        try {
            setLoading(true);
            const [harvestResponse, summaryResponse] = await Promise.all([
                ky.get('http://localhost:3000/api/analysis/harvest', {
                    timeout: 120000 // Increase timeout to 120s for large datasets
                }).json<SearchTermAnalysisData>(),
                ky.get('http://localhost:3000/api/dashboard/summary', {
                    timeout: 60000 // Increase timeout to 60s
                }).json<any>()
            ]);
            setData(harvestResponse);
            setSummary(summaryResponse);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch harvest data:', err);
            setError('Failed to load analysis. Please ensure you have synced a Search Term Report.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof SearchTermUsage) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };



    const handleAddKeyword = (term: SearchTermUsage) => {
        setPanelTerm(term);
        setShowHarvestPanel(true);
    };

    // Advanced Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [minClicks, setMinClicks] = useState<number | ''>('');
    const [maxAcos, setMaxAcos] = useState<number | ''>('');
    const [minOrders, setMinOrders] = useState<number | ''>('');
    const [matchTypes, setMatchTypes] = useState<string[]>([]); // Empty = All

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, hideExisting, minClicks, maxAcos, minOrders, matchTypes]);

    const toggleMatchType = (type: string) => {
        setMatchTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const resetFilters = () => {
        setMinClicks('');
        setMaxAcos('');
        setMinOrders('');
        setMatchTypes([]);
        setSearchTerm('');
        setHideExisting(true);
    };

    // Derived unique campaigns/adgroups for dropdowns
    const uniqueCampaigns = useMemo(() => {
        if (!data) return [];
        return Array.from(new Set(data.searchTerms.map(t => t.campaignName))).sort();
    }, [data]);

    // Build ad groups map for panels
    const adGroupsMap = useMemo(() => {
        if (!data) return {} as Record<string, string[]>;
        const map: Record<string, Set<string>> = {};
        data.searchTerms.forEach(t => {
            if (!map[t.campaignName]) map[t.campaignName] = new Set();
            map[t.campaignName].add(t.adGroupName);
        });
        return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.from(v).sort()]));
    }, [data]);

    const filteredTerms = useMemo(() => {
        if (!data) return [];
        let result = data.searchTerms;

        // 1. Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(t =>
                t.searchTerm.toLowerCase().includes(lower) ||
                t.campaignName.toLowerCase().includes(lower)
            );
        }

        // 2. Hide Existing Targets
        if (hideExisting) {
            result = result.filter(t => !t.isTargeting);
        }

        // 3. Tab Filter
        if (activeTab === 'NEGATE') {
            result = result.filter(t => (t.clicks > 0 && t.orders === 0) || t.acos > 100);
        } else if (activeTab === 'ASIN') {
            result = result.filter(t => isAsinTerm(t.searchTerm));
        } else if (activeTab !== 'ALL') {
            result = result.filter(t => t.strategies.includes(activeTab as any));
        }

        // 4. Advanced Filters
        if (minClicks !== '') {
            result = result.filter(t => t.clicks >= Number(minClicks));
        }
        if (maxAcos !== '') {
            result = result.filter(t => t.acos <= Number(maxAcos) && t.acos > 0);
        }
        if (minOrders !== '') {
            result = result.filter(t => t.orders >= Number(minOrders));
        }
        if (matchTypes.length > 0) {
            result = result.filter(t => matchTypes.includes(t.sourceMatchType));
        }

        // 5. Sort
        return result.sort((a, b) => (
            ((a[sortConfig.key] as number) > (b[sortConfig.key] as number) ? 1 : -1) * (sortConfig.direction === 'asc' ? 1 : -1)
        ));
    }, [data, searchTerm, hideExisting, activeTab, sortConfig, minClicks, maxAcos, minOrders, matchTypes]);

    // Negate tab default sort by spend desc
    const effectiveSortConfig = activeTab === 'NEGATE' && sortConfig.key === 'priorityScore'
        ? { key: 'spend' as keyof SearchTermUsage, direction: 'desc' as const }
        : sortConfig;

    const sortedFilteredTerms = useMemo(() => {
        return [...filteredTerms].sort((a, b) => (
            ((a[effectiveSortConfig.key] as number) > (b[effectiveSortConfig.key] as number) ? 1 : -1) * (effectiveSortConfig.direction === 'asc' ? 1 : -1)
        ));
    }, [filteredTerms, effectiveSortConfig]);

    const themeColor = useMemo(() => {
        if (activeTab === 'SCALE') return 'blue';
        if (activeTab === 'RANK') return 'purple';
        if (activeTab === 'PROFIT') return 'yellow';
        if (activeTab === 'NEGATE') return 'red';
        if (activeTab === 'ASIN') return 'violet';
        return 'gray';
    }, [activeTab]);

    const themeClasses = useMemo(() => {
        if (activeTab === 'SCALE') return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', button: 'bg-blue-600 hover:bg-blue-700', light: 'bg-blue-100' };
        if (activeTab === 'RANK') return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', button: 'bg-purple-600 hover:bg-purple-700', light: 'bg-purple-100' };
        if (activeTab === 'PROFIT') return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', button: 'bg-yellow-600 hover:bg-yellow-700', light: 'bg-yellow-100' };
        if (activeTab === 'NEGATE') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', button: 'bg-red-600 hover:bg-red-700', light: 'bg-red-100' };
        if (activeTab === 'ASIN') return { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', button: 'bg-violet-600 hover:bg-violet-700', light: 'bg-violet-100' };
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', button: 'bg-gray-800 hover:bg-gray-900', light: 'bg-gray-100' };
    }, [activeTab]);

    // Computed stats
    const negateTerms = useMemo(() => data ? data.searchTerms.filter(t => (t.clicks > 0 && t.orders === 0) || t.acos > 100) : [], [data]);
    const totalSpend = useMemo(() => data ? data.searchTerms.reduce((s, t) => s + t.spend, 0) : 0, [data]);
    const harvestReadyCount = useMemo(() => data ? data.searchTerms.filter(t => t.recommendation === 'MOVE_TO_EXACT').length : 0, [data]);
    const negateWaste = useMemo(() => negateTerms.reduce((s, t) => s + t.spend, 0), [negateTerms]);

    // Bulk selection helpers
    const toggleSelectTerm = (term: string) => {
        const n = new Set(selectedTerms);
        n.has(term) ? n.delete(term) : n.add(term);
        setSelectedTerms(n);
    };
    const toggleSelectAll = () => {
        if (selectedTerms.size === sortedFilteredTerms.length) setSelectedTerms(new Set());
        else setSelectedTerms(new Set(sortedFilteredTerms.map(t => t.searchTerm)));
    };
    const toggleExpandTerm = (term: string) => {
        const n = new Set(expandedTerms);
        n.has(term) ? n.delete(term) : n.add(term);
        setExpandedTerms(n);
    };

    // Add to pending queue (now opens panel)
    const addToPending = (_type: 'harvest' | 'negate', term: SearchTermUsage) => {
        setPanelTerm(term);
        if (_type === 'negate') {
            setShowNegatePanel(true);
        } else {
            setShowHarvestPanel(true);
        }
    };

    // Export is now handled by ActionQueuePanel

    // Priority score breakdown
    const getPriorityBreakdown = (term: SearchTermUsage) => {
        const maxSales = data ? Math.max(...data.searchTerms.map(t => t.sales), 1) : 1;
        const maxClicks = data ? Math.max(...data.searchTerms.map(t => t.clicks), 1) : 1;
        const salesImpact = Math.min(40, Math.round((term.sales / maxSales) * 40));
        const efficiency = term.acos < 15 ? 30 : term.acos < 30 ? 20 : 10;
        const volume = Math.min(20, Math.round((term.clicks / maxClicks) * 20));
        const consistency = Math.min(10, term.orders >= 3 ? 10 : term.orders * 3);
        return { salesImpact, efficiency, volume, consistency };
    };

    const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
    const formatPercent = (val: number) => `${val.toFixed(1)}%`;
    const formatScore = (val: number) => Math.round(val);


    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${themeColor}-500`}></div>
        </div>
    );

    if (error) return (
        <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg border border-red-200 m-4">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
            <h3 className="text-lg font-bold mb-2">Analysis Error</h3>
            <p>{error}</p>
            <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-red-700">Retry</button>
        </div>
    );

    return (
        <div className={`w-full px-4 py-6 space-y-6 min-h-screen ${activeTab === 'PROFIT' ? 'bg-yellow-50/30' : 'bg-gray-50'}`}>
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Harvest Hub</h1>
                    <p className="text-gray-500 mt-1">Search Term Optimization & "Hunt & Kill" Workflow</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowQueuePanel(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all border ${queueStats.totalCount > 0
                            ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 animate-pulse'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <ClipboardList size={14} />
                        Queue ({queueStats.totalCount})
                    </button>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                        <Calendar size={14} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-700">{data?.period || 'Last 60 Days'}</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Bleeding Waste */}
                <button onClick={() => setActiveTab('NEGATE')} className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative overflow-hidden text-left hover:shadow-md transition-shadow group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -mr-2 -mt-2"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 text-red-600 font-semibold mb-2">
                            <TrendingDown size={18} /> Bleeding Waste
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{formatCurrency(data?.stats.bleedingWaste || 0)}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-bold text-gray-400">
                                {summary?.businessReport?.totalSales ?
                                    (((data?.stats.bleedingWaste || 0) / summary.businessReport.totalSales) * 100).toFixed(2) + '% of Total Revenue' :
                                    totalSpend > 0 ? ((data?.stats.bleedingWaste || 0) / totalSpend * 100).toFixed(1) + '% of PPC Spend' : ''}
                            </span>
                            {(data?.stats.bleedingWaste || 0) / Math.max(summary?.businessReport?.totalSales || totalSpend, 1) * 100 < 5
                                ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">🎉 Xuất sắc!</span>
                                : <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">⚠️ Review {negateTerms.length} terms</span>
                            }
                        </div>
                    </div>
                </button>

                {/* Harvest Potential */}
                <button onClick={() => setActiveTab('SCALE')} className="bg-white p-5 rounded-xl border border-green-100 shadow-sm relative overflow-hidden text-left hover:shadow-md transition-shadow group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full -mr-2 -mt-2"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 text-green-600 font-semibold mb-2">
                            <Target size={18} /> Harvest Potential
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{formatCurrency(data?.stats.harvestPotential || 0)}</div>
                        <p className="text-[10px] text-gray-500 mt-1"><span className="font-bold text-green-600">{harvestReadyCount}</span> terms chưa harvest</p>
                    </div>
                </button>

                {/* Efficiency Score */}
                <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-2 -mt-2"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold mb-2">
                            <TrendingUp size={18} /> Efficiency Score
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{data?.stats.efficiencyScore.toFixed(0)}/100</div>
                        <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full" style={{ width: `${data?.stats.efficiencyScore || 0}%` }}></div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Profit vs. Waste ratio</p>
                    </div>
                </div>

                {/* Actions Pending */}
                <button onClick={() => setShowQueuePanel(true)} className={`bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden text-left hover:shadow-md transition-shadow group ${queueStats.totalCount > 0 ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gray-50 rounded-bl-full -mr-2 -mt-2"></div>
                    <div className="relative">
                        <div className="flex items-center gap-2 text-gray-700 font-semibold mb-2">
                            <ClipboardList size={18} /> Actions Pending
                            {queueStats.totalCount > 0 && (
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            )}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{queueStats.totalCount}</div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-blue-600 font-bold">{queueStats.harvestCount} harvest</span>
                            <span className="text-[10px] text-red-600 font-bold">{queueStats.negateCount} negate</span>
                        </div>
                    </div>
                </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-2 pt-2 shadow-sm">
                {(['SCALE', 'RANK', 'PROFIT', 'NEGATE', 'ASIN', 'ALL'] as TabType[]).map(tab => {
                    const icons: Record<TabType, string> = { SCALE: '🚀', RANK: '🏆', PROFIT: '💰', ALL: '', NEGATE: '🚫', ASIN: '📦' };
                    const colors: Record<TabType, { active: string, border: string }> = {
                        SCALE: { active: 'text-blue-600 bg-blue-50/50', border: 'border-blue-500' },
                        RANK: { active: 'text-purple-600 bg-purple-50/50', border: 'border-purple-500' },
                        PROFIT: { active: 'text-yellow-600 bg-yellow-50/50', border: 'border-yellow-500' },
                        NEGATE: { active: 'text-red-600 bg-red-50/50', border: 'border-red-500' },
                        ASIN: { active: 'text-violet-600 bg-violet-50/50', border: 'border-violet-500' },
                        ALL: { active: 'text-gray-800 bg-gray-50', border: 'border-gray-500' },
                    };
                    return (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedTerms(new Set()); }}
                            title={TAB_TOOLTIPS[tab]}
                            className={`px-4 py-3 font-medium text-xs focus:outline-none border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === tab
                                ? `${colors[tab].border} ${colors[tab].active}`
                                : 'border-transparent text-gray-400 hover:text-gray-700'
                                }`}
                        >
                            {tab} {icons[tab]}
                        </button>
                    );
                })}
            </div>

            {/* NEGATE Tab Summary */}
            {activeTab === 'NEGATE' && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
                    <span className="text-sm text-red-700 font-medium">💸 {negateTerms.length} terms đang lãng phí {formatCurrency(negateWaste)}</span>
                    <span className="text-xs text-red-500">Sort: Wasted $ giảm dần</span>
                </div>
            )}

            {/* Main Action Area */}
            <div className={`bg-white rounded-lg border shadow-sm rounded-tr-none rounded-tl-none border-t-0 overflow-hidden ${themeClasses.border}`}>

                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search terms or campaigns..."
                                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideExisting}
                                onChange={(e) => setHideExisting(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            Hide Existing Targets
                        </label>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        >
                            <Filter size={16} /> Advanced Filters
                        </button>
                    </div>
                </div>

                {/* ADVANCED FILTER PANEL */}
                {showFilters && (
                    <div className="bg-gray-50 border-b border-gray-200 p-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                            {/* Metric Filters */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Min Clicks</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 5"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                    value={minClicks}
                                    onChange={(e) => setMinClicks(e.target.value ? Number(e.target.value) : '')}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Max ACoS (%)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 40"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                    value={maxAcos}
                                    onChange={(e) => setMaxAcos(e.target.value ? Number(e.target.value) : '')}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Min Orders</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 2"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                    value={minOrders}
                                    onChange={(e) => setMinOrders(e.target.value ? Number(e.target.value) : '')}
                                />
                            </div>

                            {/* Match Type & Reset */}
                            <div className="space-y-3 flex flex-col justify-between">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Source Match Type</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {['AUTO', 'BROAD', 'PHRASE', 'EXACT'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => toggleMatchType(type)}
                                                className={`px-2 py-1 text-xs rounded border transition-colors ${matchTypes.includes(type)
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={resetFilters}
                                    className="text-xs text-red-500 hover:text-red-700 underline self-start"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className={`bg-gray-50 border-b border-gray-200 uppercase text-xs ${themeClasses.text} ${themeClasses.bg}`}>
                            <tr>
                                <th className="px-2 py-3 w-8">
                                    <input type="checkbox" checked={selectedTerms.size > 0 && selectedTerms.size === sortedFilteredTerms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length} onChange={toggleSelectAll} className="rounded border-gray-300" />
                                </th>
                                <th className="px-2 py-3 w-6"></th>
                                <th className="px-4 py-3 font-medium w-64 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('searchTerm')}>
                                    Search Term <ArrowUpDown size={10} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sourceMatchType')}>
                                    Source <ArrowUpDown size={10} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('clicks')}>Clicks</th>
                                <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('spend')}>Spend</th>
                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sales')}>Sales</th>
                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('orders')}>Orders</th>
                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('acos')}>ACOS</th>
                                <th className="px-4 py-3 font-medium text-right">CVR</th>
                                <th className="px-4 py-3 font-medium text-right">CPC</th>
                                <th className="px-4 py-3 font-medium text-center cursor-pointer" onClick={() => handleSort('priorityScore')}>Priority</th>
                                <th className="px-4 py-3 font-medium text-center">Strategy</th>
                                <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedFilteredTerms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((term: SearchTermUsage, idx: number) => {
                                const isAsin = isAsinTerm(term.searchTerm);
                                const isExpanded = expandedTerms.has(term.searchTerm);
                                const isSelected = selectedTerms.has(term.searchTerm);
                                const breakdown = getPriorityBreakdown(term);
                                const prioColor = term.priorityScore >= 90 ? 'bg-emerald-100 text-emerald-800' : term.priorityScore >= 70 ? 'bg-green-100 text-green-700' : term.priorityScore >= 50 ? 'bg-yellow-100 text-yellow-700' : term.priorityScore >= 30 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600';

                                // Find other campaigns this term appears in
                                const otherCampaigns = data?.searchTerms.filter(t => t.searchTerm === term.searchTerm && t.campaignName !== term.campaignName) || [];

                                return (
                                    <React.Fragment key={`${term.searchTerm}-${idx}`}>
                                        <tr className={`hover:bg-gray-50 group transition-colors ${isSelected ? 'bg-blue-50/50' : ''} ${activeTab === 'NEGATE' ? 'bg-red-50/20' : ''}`}>
                                            <td className="px-2 py-3">
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelectTerm(term.searchTerm)} className="rounded border-gray-300" />
                                            </td>
                                            <td className="px-1 py-3">
                                                {(otherCampaigns.length > 0) && (
                                                    <button onClick={() => toggleExpandTerm(term.searchTerm)} className="text-gray-400 hover:text-gray-600">
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium text-gray-900">{term.searchTerm}</span>
                                                    {isAsin && <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded border border-violet-200">📦 ASIN</span>}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                                                    <span className="truncate max-w-[150px]" title={term.campaignName}>{term.campaignName}</span>
                                                    {term.isTargeting && <span className="text-blue-600 bg-blue-50 px-1 rounded text-[10px] border border-blue-100">Targeted</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${term.sourceMatchType === 'AUTO' ? 'bg-purple-50 text-purple-700 border-purple-100' : term.sourceMatchType === 'BROAD' ? 'bg-orange-50 text-orange-700 border-orange-100' : term.sourceMatchType === 'PHRASE' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>{term.sourceMatchType}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 font-medium">{term.clicks.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-gray-900 font-medium">{formatCurrency(term.spend)}</td>
                                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(term.sales)}</td>
                                            <td className="px-4 py-3 text-right text-gray-900 font-medium">{term.orders}</td>
                                            <td className={`px-4 py-3 text-right font-medium ${term.acos > 30 ? 'text-red-500' : 'text-green-600'}`}>
                                                {term.sales > 0 ? formatPercent(term.acos) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600" title={term.cvr > 100 ? 'CVR vượt 100% do Amazon attribution window' : ''}>
                                                {term.cvr > 100 ? <span className="text-amber-600 font-medium">{term.orders}/{term.clicks}</span> : (term.cvr > 0 ? formatPercent(term.cvr) : '-')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 font-medium">{formatCurrency(term.cpc)}</td>
                                            <td className="px-4 py-3 text-center relative">
                                                <div className="group/priority inline-block">
                                                    <span className={`text-[10px] font-bold w-8 h-8 rounded-full inline-flex items-center justify-center ${prioColor}`}>
                                                        {formatScore(term.priorityScore)}
                                                    </span>
                                                    <div className="hidden group-hover/priority:block absolute z-30 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-left -translate-x-1/2 left-1/2 top-full mt-1 w-48">
                                                        <div className="text-[10px] font-bold mb-2">Priority: {formatScore(term.priorityScore)}/100</div>
                                                        <div className="space-y-1.5 text-[9px]">
                                                            <div className="flex justify-between"><span>Sales Impact</span><span>{breakdown.salesImpact}/40</span></div>
                                                            <div className="h-1 bg-gray-700 rounded"><div className="h-full bg-blue-400 rounded" style={{ width: `${breakdown.salesImpact / 40 * 100}%` }}></div></div>
                                                            <div className="flex justify-between"><span>Efficiency</span><span>{breakdown.efficiency}/30</span></div>
                                                            <div className="h-1 bg-gray-700 rounded"><div className="h-full bg-green-400 rounded" style={{ width: `${breakdown.efficiency / 30 * 100}%` }}></div></div>
                                                            <div className="flex justify-between"><span>Volume</span><span>{breakdown.volume}/20</span></div>
                                                            <div className="h-1 bg-gray-700 rounded"><div className="h-full bg-yellow-400 rounded" style={{ width: `${breakdown.volume / 20 * 100}%` }}></div></div>
                                                            <div className="flex justify-between"><span>Consistency</span><span>{breakdown.consistency}/10</span></div>
                                                            <div className="h-1 bg-gray-700 rounded"><div className="h-full bg-purple-400 rounded" style={{ width: `${breakdown.consistency / 10 * 100}%` }}></div></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {term.strategies && term.strategies.length > 0 && (
                                                    <div className="flex flex-col items-center gap-1">
                                                        {term.strategies.includes('SCALE') && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SCALE 🚀</span>}
                                                        {term.strategies.includes('RANK') && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">RANK 🏆</span>}
                                                        {term.strategies.includes('PROFIT') && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">PROFIT 💰</span>}
                                                    </div>
                                                )}
                                                {(!term.strategies || term.strategies.length === 0) && term.recommendation !== 'NONE' && (
                                                    <div className="flex flex-col items-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${term.recommendation === 'NEGATIVE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{term.recommendation.replace(/_/g, ' ')}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {activeTab === 'NEGATE' || term.recommendation === 'NEGATIVE' ? (
                                                    <button onClick={() => addToPending('negate', term)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 shadow-sm transition-all">
                                                        <Ban size={10} className="inline mr-1" /> Add Negative
                                                    </button>
                                                ) : term.recommendation === 'MOVE_TO_EXACT' ? (
                                                    <button onClick={() => handleAddKeyword(term)} className={`text-xs text-white px-3 py-1.5 rounded shadow-sm transition-all ${themeClasses.button}`}>
                                                        Move to Exact
                                                    </button>
                                                ) : term.recommendation === 'OPTIMIZE' ? (
                                                    <button className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 shadow-sm">Reduce Bid</button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        {/* Expanded Row - other campaigns */}
                                        {isExpanded && otherCampaigns.length > 0 && (
                                            <tr>
                                                <td colSpan={14} className="p-0 bg-gray-50 border-b border-gray-200">
                                                    <div className="pl-16 pr-6 py-3">
                                                        <div className="text-[10px] font-bold text-gray-500 mb-2">📍 Term này xuất hiện trong {otherCampaigns.length + 1} campaigns. Consolidate về 1 exact campaign.</div>
                                                        <table className="w-full text-xs">
                                                            <thead className="text-gray-500 bg-white border-b">
                                                                <tr>
                                                                    <th className="px-3 py-1.5 text-left">Campaign</th>
                                                                    <th className="px-3 py-1.5 text-left">Match</th>
                                                                    <th className="px-3 py-1.5 text-right">Clicks</th>
                                                                    <th className="px-3 py-1.5 text-right">Spend</th>
                                                                    <th className="px-3 py-1.5 text-right">Sales</th>
                                                                    <th className="px-3 py-1.5 text-right">ACOS</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {[term, ...otherCampaigns].map((t, i) => (
                                                                    <tr key={i} className={i === 0 ? 'bg-blue-50/30 font-medium' : ''}>
                                                                        <td className="px-3 py-1.5 truncate max-w-[200px]">{t.campaignName}</td>
                                                                        <td className="px-3 py-1.5">{t.sourceMatchType}</td>
                                                                        <td className="px-3 py-1.5 text-right">{t.clicks}</td>
                                                                        <td className="px-3 py-1.5 text-right">{formatCurrency(t.spend)}</td>
                                                                        <td className="px-3 py-1.5 text-right">{formatCurrency(t.sales)}</td>
                                                                        <td className={`px-3 py-1.5 text-right ${t.acos > 30 ? 'text-red-500' : 'text-green-600'}`}>{t.sales > 0 ? formatPercent(t.acos) : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {filteredTerms.length === 0 && (
                                <tr>
                                    <td colSpan={13} className="p-8 text-center text-gray-400">
                                        No terms found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
                    <div>
                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedFilteredTerms.length)} - {Math.min(currentPage * itemsPerPage, sortedFilteredTerms.length)} of {sortedFilteredTerms.length} terms
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >Previous</button>
                        <span className="px-3 py-1 bg-gray-100 rounded text-gray-700">Page {currentPage} of {Math.ceil(sortedFilteredTerms.length / itemsPerPage)}</span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedFilteredTerms.length / itemsPerPage), p + 1))}
                            disabled={currentPage >= Math.ceil(sortedFilteredTerms.length / itemsPerPage)}
                            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >Next</button>
                    </div>
                </div>
            </div>

            {/* BulkActionBar (replaces old floating bar) */}
            <BulkActionBar
                selectedCount={selectedTerms.size}
                selectedItems={sortedFilteredTerms.filter(t => selectedTerms.has(t.searchTerm))}
                context="harvest_hub"
                onClearSelection={() => setSelectedTerms(new Set())}
                campaigns={uniqueCampaigns}
                adGroupsMap={adGroupsMap}
            />

            {/* Harvest Panel (replaces old modal) */}
            <HarvestPanel
                isOpen={showHarvestPanel}
                onClose={() => setShowHarvestPanel(false)}
                term={panelTerm}
                campaigns={uniqueCampaigns}
                adGroupsMap={adGroupsMap}
            />

            {/* Negate Panel */}
            <NegatePanel
                isOpen={showNegatePanel}
                onClose={() => setShowNegatePanel(false)}
                term={panelTerm}
            />

            {/* Action Queue Panel (replaces old pending panel) */}
            <ActionQueuePanel
                isOpen={showQueuePanel}
                onClose={() => setShowQueuePanel(false)}
            />
        </div>
    );
};

export default HarvestHub;
