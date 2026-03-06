import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Brain, Trophy, Target, BarChart3, TrendingUp,
    Search, Filter, Loader2, Zap, Eye, ShieldAlert,
    Sparkles, X, ArrowUpRight, ArrowDownRight, Minus,
    Crosshair, Layers, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw,
    Plus, Check, Package, Rocket, Play, Download, Copy, ExternalLink, Columns3
} from 'lucide-react';
import { AsinCharts } from './AsinCharts';

// Types
interface AsinKeywordRow {
    keyword: string;
    searchVolume: number;
    organicRank: number | null;
    sponsoredRank: number | null;
    cerebroIQScore: number | null;
    competingProducts: number;
    keywordSales: number | null;
    titleDensity: number;
    wordCount: number;
    pushPriority: number;
    strategyTag: 'RANK' | 'PROFIT' | 'SCALE' | 'PUSH';
    rootCluster: string;
    adDominance: 'ORGANIC_ONLY' | 'AD_BOOSTED' | 'AD_DEPENDENT' | 'NO_RANK';
}

interface HealthCards {
    organicDomination: number;
    strikeZone: number;
    indexingCoverage: { covered: number; total: number; percentage: number };
}

interface RootCluster {
    name: string;
    count: number;
    totalSV: number;
}

interface IntelligenceData {
    healthCards: HealthCards;
    keywords: AsinKeywordRow[];
    rootClusters: RootCluster[];
}

type FilterMode = 'ALL' | 'BLEEDING' | 'GOLDEN' | 'CLUSTER' | 'QUICK_WINS' | 'LONG_TAIL' | 'NOT_INDEXED';
type SortField = 'keyword' | 'searchVolume' | 'keywordSales' | 'organicRank' | 'sponsoredRank' | 'pushPriority' | 'cerebroIQScore' | 'competingProducts';
type SortDirection = 'asc' | 'desc';

type ColumnKey = 'keywordSales' | 'cerebroIQScore' | 'competingProducts' | 'sponsoredRank' | 'adDominance' | 'pushPriority' | 'strategyTag';
const COLUMN_PRESETS: Record<string, ColumnKey[]> = {
    compact: ['strategyTag'],
    full: ['keywordSales', 'cerebroIQScore', 'competingProducts', 'sponsoredRank', 'adDominance', 'pushPriority', 'strategyTag'],
    ppc: ['competingProducts', 'sponsoredRank', 'adDominance'],
};
const ALL_OPTIONAL_COLS: { key: ColumnKey; label: string }[] = [
    { key: 'keywordSales', label: 'K.Sales' },
    { key: 'cerebroIQScore', label: 'CPR' },
    { key: 'competingProducts', label: 'Comp' },
    { key: 'sponsoredRank', label: 'Spn' },
    { key: 'adDominance', label: 'AD DOM.' },
    { key: 'pushPriority', label: 'Push ↓' },
    { key: 'strategyTag', label: 'TAG' },
];

// ──────────────────────────────────────────────
// Health Card Component
// ──────────────────────────────────────────────
const HealthCard = ({ icon: Icon, label, value, subtext, gradient, extra, onClick }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subtext: string;
    gradient: string;
    extra?: React.ReactNode;
    onClick?: () => void;
}) => (
    <div
        className={`relative overflow-hidden rounded-xl p-3 ${gradient} text-white shadow-md ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all' : ''}`}
        onClick={onClick}
    >
        <div className="absolute top-2 right-2 opacity-20">
            <Icon size={28} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{label}</p>
        <p className="text-2xl font-black mt-1">{value}</p>
        <p className="text-[11px] mt-0.5 opacity-70">{subtext}</p>
        {extra && <div className="mt-1">{extra}</div>}
    </div>
);

// ──────────────────────────────────────────────
// Rank Badge
// ──────────────────────────────────────────────
const RankBadge = ({ rank }: { rank: number | null }) => {
    if (rank === null) return <span className="text-slate-300 text-xs">—</span>;

    let bg = 'bg-slate-100 text-slate-600';
    if (rank <= 3) bg = 'bg-emerald-600 text-white font-bold';
    else if (rank <= 10) bg = 'bg-emerald-400 text-white';
    else if (rank <= 20) bg = 'bg-emerald-100 text-emerald-800';
    else if (rank <= 30) bg = 'bg-yellow-100 text-yellow-800';
    else if (rank <= 50) bg = 'bg-orange-100 text-orange-800';
    else if (rank <= 100) bg = 'bg-red-100 text-red-700';
    else bg = 'bg-red-200 text-red-900';

    return (
        <span className={`inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-semibold ${bg}`}>
            {rank > 306 ? '>306' : rank}
        </span>
    );
};

// ──────────────────────────────────────────────
// Strategy Tag Badge
// ──────────────────────────────────────────────
const StrategyBadge = ({ tag }: { tag: string }) => {
    const styles: Record<string, string> = {
        RANK: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        PROFIT: 'bg-amber-100 text-amber-700 border-amber-200',
        SCALE: 'bg-purple-100 text-purple-700 border-purple-200',
        PUSH: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    const icons: Record<string, React.ReactNode> = {
        RANK: <Trophy size={10} />,
        PROFIT: <TrendingUp size={10} />,
        SCALE: <Zap size={10} />,
        PUSH: <Rocket size={10} />,
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[tag] || 'bg-slate-100 text-slate-600'}`}>
            {icons[tag]} {tag}
        </span>
    );
};

// ──────────────────────────────────────────────
// Ad Dominance Badge
// ──────────────────────────────────────────────
const AdDominanceBadge = ({ type }: { type: string }) => {
    const config: Record<string, { label: string; className: string }> = {
        ORGANIC_ONLY: { label: 'Organic', className: 'text-emerald-600 bg-emerald-50' },
        AD_BOOSTED: { label: 'Ad Boost', className: 'text-blue-600 bg-blue-50' },
        AD_DEPENDENT: { label: 'Ad Only', className: 'text-red-600 bg-red-50' },
        NO_RANK: { label: 'No Rank', className: 'text-slate-400 bg-slate-50' },
    };
    const c = config[type] || config['NO_RANK'];
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.className}`}>{c.label}</span>
    );
};

// ──────────────────────────────────────────────
// Action Center Sidebar
// ──────────────────────────────────────────────
const ActionCenter = ({ keyword, onClose }: { keyword: AsinKeywordRow; onClose: () => void }) => (
    <div className="w-80 border-l border-slate-200 bg-white shadow-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2 flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Crosshair size={12} className="text-white" />
                </div>
                <span className="font-bold text-xs text-slate-800">Action Center</span>
            </div>
            <button onClick={onClose} className="p-0.5 hover:bg-slate-100 rounded transition-colors">
                <X size={14} className="text-slate-400" />
            </button>
        </div>

        <div className="p-3 space-y-3">
            {/* Keyword Title */}
            <div>
                <p className="text-sm font-bold text-slate-900 leading-tight">{keyword.keyword}</p>
                <div className="flex items-center gap-1.5 mt-1">
                    <StrategyBadge tag={keyword.strategyTag} />
                    <AdDominanceBadge type={keyword.adDominance} />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase">Search Volume</p>
                    <p className="text-base font-black text-slate-800">{keyword.searchVolume.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase">Organic Rank</p>
                    <p className="text-base font-black text-slate-800">{keyword.organicRank ?? '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase">Sponsored Rank</p>
                    <p className="text-base font-black text-slate-800">{keyword.sponsoredRank ?? '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase">Cerebro IQ</p>
                    <p className="text-base font-black text-slate-800">{keyword.cerebroIQScore ?? '—'}</p>
                </div>
            </div>

            {/* Push Priority Gauge */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-3 border border-violet-100">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">Push Priority</p>
                    <Sparkles size={12} className="text-violet-500" />
                </div>
                <p className="text-xl font-black text-violet-800 mt-1">{keyword.pushPriority.toLocaleString()}</p>
                <div className="w-full bg-violet-200 rounded-full h-1.5 mt-2">
                    <div
                        className="bg-gradient-to-r from-violet-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (keyword.pushPriority / 50000) * 100)}%` }}
                    />
                </div>
            </div>

            {/* Market Context */}
            <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Market Context</p>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-xs text-slate-600">Competing Products</span>
                    <span className="text-xs font-bold text-slate-800">{keyword.competingProducts.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-xs text-slate-600">Title Density</span>
                    <span className="text-xs font-bold text-slate-800">{keyword.titleDensity}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-xs text-slate-600">Word Count</span>
                    <span className="text-xs font-bold text-slate-800">{keyword.wordCount}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-600">Root Cluster</span>
                    <span className="text-xs font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{keyword.rootCluster.toUpperCase()}</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Actions</p>
                <button className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-xs hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5">
                    <Target size={12} /> Mark for PPC
                </button>
                <button className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
                    <ArrowUpRight size={12} /> Add to Listing
                </button>
            </div>
        </div>
    </div>
);

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export const AsinIntelligence: React.FC = () => {
    const [data, setData] = useState<IntelligenceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();

    const getInitialFilter = (): FilterMode => {
        const segment = searchParams.get('segment');
        if (segment === 'golden-opps') return 'GOLDEN';
        if (segment === 'strike-zone') return 'QUICK_WINS';
        if (segment === 'not-indexed') return 'NOT_INDEXED';
        if (segment === 'long-tail') return 'LONG_TAIL';
        return 'ALL';
    };

    const [error, setError] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<FilterMode>(getInitialFilter());

    // Sync filterMode to URL
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);
        let changed = false;

        const segmentMap: Record<FilterMode, string> = {
            'GOLDEN': 'golden-opps',
            'QUICK_WINS': 'strike-zone',
            'NOT_INDEXED': 'not-indexed',
            'LONG_TAIL': 'long-tail',
            'ALL': 'all',
            'BLEEDING': 'bleeding',
            'CLUSTER': 'cluster'
        };

        const mappedSegment = segmentMap[filterMode];

        if (mappedSegment !== 'all') {
            if (newParams.get('segment') !== mappedSegment) {
                newParams.set('segment', mappedSegment);
                changed = true;
            }
        } else {
            if (newParams.has('segment')) {
                newParams.delete('segment');
                changed = true;
            }
        }

        if (changed) {
            setSearchParams(newParams, { replace: true });
        }
    }, [filterMode, searchParams, setSearchParams]);
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedKeyword, setSelectedKeyword] = useState<AsinKeywordRow | null>(null);
    const [sortField, setSortField] = useState<SortField>('pushPriority');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // Advanced Filters
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [orgRankMin, setOrgRankMin] = useState<number>(1);
    const [orgRankMax, setOrgRankMax] = useState<number>(306);
    const [spnRankFilter, setSpnRankFilter] = useState<'all' | 'none' | 'low'>('all'); // all | none (=0) | low (>20)
    const [minSV, setMinSV] = useState<number>(0);
    const [wordCountMin, setWordCountMin] = useState<number>(1);
    const [wordCountMax, setWordCountMax] = useState<number>(10);
    const [adDominanceToggle, setAdDominanceToggle] = useState(false); // Spn < Org
    const [minPushPriority, setMinPushPriority] = useState<number>(0);
    const [strategyFilter, setStrategyFilter] = useState<'ALL' | 'RANK' | 'PROFIT' | 'SCALE' | 'PUSH'>('ALL');

    // Add explicit applied filters state
    const [appliedFilters, setAppliedFilters] = useState({
        orgRankMin: 1, orgRankMax: 306, spnRankFilter: 'all', minSV: 0, wordCountMin: 1, wordCountMax: 10, adDominanceToggle: false, minPushPriority: 0, strategyFilter: 'ALL'
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 100;

    // Tool execution state
    const [isToolRunning, setIsToolRunning] = useState(false);

    // Column visibility
    const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(COLUMN_PRESETS.full));
    const [showColDropdown, setShowColDropdown] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const toggleCol = (col: ColumnKey) => setVisibleCols(prev => {
        const next = new Set(prev);
        next.has(col) ? next.delete(col) : next.add(col);
        return next;
    });
    const applyPreset = (name: string) => setVisibleCols(new Set(COLUMN_PRESETS[name]));
    const isColVisible = (col: ColumnKey) => visibleCols.has(col);

    const handleRunTool = async () => {
        if (!confirm('Start the backend ranking scraper? This might take several minutes and runs in the background.')) return;
        setIsToolRunning(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/ranking/run-tool`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to start tool');
            alert('Ranking tool started successfully in the background.');
        } catch (err: any) {
            console.error(err);
            alert(`Error starting tool: ${err.message}`);
        } finally {
            setIsToolRunning(false);
        }
    };

    // ─── Chart filter handlers ───
    const handleChartFilterRankGroup = (min: number | null, max: number | null) => {
        if (min === null) {
            // No Rank
            setFilterMode('NOT_INDEXED');
        } else {
            setOrgRankMin(min);
            setOrgRankMax(max ?? 306);
            setAppliedFilters(prev => ({ ...prev, orgRankMin: min, orgRankMax: max ?? 306 }));
            setFilterMode('ALL');
        }
        setCurrentPage(1);
    };
    const handleChartSearchKeyword = (keyword: string) => {
        setSearchTerm(keyword);
        setFilterMode('ALL');
        setCurrentPage(1);
    };

    // ─── Export handlers ───
    const exportCSV = () => {
        const headers = ['Keyword', 'SV', 'Org Rank', 'Spn Rank', 'AD DOM', 'Tag'];
        const rows = displayKeywords.map(kw => [
            `"${kw.keyword}"`, kw.searchVolume, kw.organicRank ?? '', kw.sponsoredRank ?? '',
            kw.adDominance, kw.strategyTag
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `asin-keywords-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };
    const exportPPC = () => {
        const headers = ['Keyword', 'Search Volume', 'Tag'];
        const rows = displayKeywords.map(kw => [`"${kw.keyword}"`, kw.searchVolume, kw.strategyTag]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `ppc-keywords-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };
    const copyKeywords = () => {
        const text = displayKeywords.map(kw => kw.keyword).join('\n');
        navigator.clipboard.writeText(text);
        alert(`Copied ${displayKeywords.length} keywords to clipboard!`);
        setShowExportMenu(false);
    };

    const applyFilters = () => {
        setAppliedFilters({
            orgRankMin, orgRankMax, spnRankFilter, minSV, wordCountMin, wordCountMax, adDominanceToggle, minPushPriority, strategyFilter
        });
        setCurrentPage(1); // Reset to first page
        setShowAdvanced(false); // Close panel after applying
    };

    const resetAdvancedFilters = () => {
        setOrgRankMin(1); setOrgRankMax(306);
        setSpnRankFilter('all');
        setMinSV(0); setWordCountMin(1); setWordCountMax(10);
        setAdDominanceToggle(false); setMinPushPriority(0); setStrategyFilter('ALL');
        setAppliedFilters({ orgRankMin: 1, orgRankMax: 306, spnRankFilter: 'all', minSV: 0, wordCountMin: 1, wordCountMax: 10, adDominanceToggle: false, minPushPriority: 0, strategyFilter: 'ALL' });
        setCurrentPage(1);
    };

    const advancedActive = appliedFilters.orgRankMin > 1 || appliedFilters.orgRankMax < 306 || appliedFilters.spnRankFilter !== 'all'
        || appliedFilters.minSV > 0 || appliedFilters.wordCountMin > 1 || appliedFilters.wordCountMax < 10
        || appliedFilters.adDominanceToggle || appliedFilters.minPushPriority > 0 || appliedFilters.strategyFilter !== 'ALL';

    useEffect(() => {
        fetchData();
        fetchTrackedKeywords();
        fetchProducts();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/asin-intelligence`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (!result || !result.keywords) {
                throw new Error("Invalid format received from API");
            }
            setData(result);
        } catch (err: any) {
            console.error('Failed to fetch ASIN Intelligence:', err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Quick Track state
    const [trackedKeywords, setTrackedKeywords] = useState<Set<string>>(new Set());
    const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());

    // Product/ASIN list
    interface ProductItem { name: string; asin: string; sku: string }
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [selectedAsin, setSelectedAsin] = useState<string>('');
    const [isAsinDropdownOpen, setIsAsinDropdownOpen] = useState(false);
    const [asinSearchTerm, setAsinSearchTerm] = useState('');

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/products`);
            const productList = await res.json();
            if (Array.isArray(productList) && productList.length > 0) {
                setProducts(productList);
                setSelectedAsin(productList[0].asin || '');
            }
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    };

    const fetchTrackedKeywords = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/ranking/tracked-keywords`);
            const { keywords } = await res.json();
            setTrackedKeywords(new Set(keywords.map((k: string) => k.toLowerCase())));
        } catch (err) {
            console.error('Failed to fetch tracked keywords:', err);
        }
    };

    const handleTrack = async (kwObj: AsinKeywordRow, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't open Action Center
        const kw = kwObj.keyword;
        if (trackedKeywords.has(kw.toLowerCase()) || trackingInProgress.has(kw.toLowerCase())) return;

        setTrackingInProgress(prev => new Set(prev).add(kw.toLowerCase()));
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/ranking/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    asin: selectedAsin,
                    keyword: kw,
                    searchVolume: kwObj.searchVolume,
                    ads: kwObj.sponsoredRank
                })
            });
            const result = await res.json();
            if (result.success) {
                setTrackedKeywords(prev => new Set(prev).add(kw.toLowerCase()));
            }
        } catch (err) {
            console.error('Failed to track keyword:', err);
        } finally {
            setTrackingInProgress(prev => {
                const next = new Set(prev);
                next.delete(kw.toLowerCase());
                return next;
            });
        }
    };

    // Is a keyword suggested for tracking?
    const isSuggested = (kw: AsinKeywordRow) => {
        if (trackedKeywords.has(kw.keyword.toLowerCase())) return false;
        // Rank ≤ 10 = must-track, or strike zone 11-30 with SV > 300
        return (kw.organicRank !== null && kw.organicRank <= 10)
            || (kw.organicRank !== null && kw.organicRank >= 11 && kw.organicRank <= 30 && kw.searchVolume > 300);
    };

    // Sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <Minus size={10} className="text-slate-300" />;
        return sortDir === 'desc'
            ? <ArrowDownRight size={12} className="text-blue-500" />
            : <ArrowUpRight size={12} className="text-blue-500" />;
    };

    // Filtered + Sorted data
    const displayKeywords = useMemo(() => {
        if (!data) return [];
        let kws = [...data.keywords];

        // Text search with operators: sv>N, "exact", term -exclude
        if (searchTerm) {
            const term = searchTerm.trim();
            // sv>N operator
            const svMatch = term.match(/^sv\s*([><=]+)\s*(\d+)$/i);
            if (svMatch) {
                const op = svMatch[1]; const val = Number(svMatch[2]);
                kws = kws.filter(k => op === '>' ? k.searchVolume > val : op === '<' ? k.searchVolume < val : op === '>=' ? k.searchVolume >= val : k.searchVolume === val);
            } else if (term.startsWith('"') && term.endsWith('"')) {
                // Exact phrase
                const exact = term.slice(1, -1).toLowerCase();
                kws = kws.filter(k => k.keyword.toLowerCase() === exact);
            } else if (term.includes(' -')) {
                // Exclude: "gift -birthday"
                const parts = term.split(' -');
                const include = parts[0].toLowerCase().trim();
                const excludes = parts.slice(1).map(p => p.toLowerCase().trim());
                kws = kws.filter(k => {
                    const kw = k.keyword.toLowerCase();
                    return kw.includes(include) && !excludes.some(ex => kw.includes(ex));
                });
            } else {
                const lower = term.toLowerCase();
                kws = kws.filter(k => k.keyword.toLowerCase().includes(lower));
            }
        }

        // Filter modes
        switch (filterMode) {
            case 'BLEEDING':
                kws = kws.filter(k => k.searchVolume >= 500 && (k.organicRank === null || k.organicRank > 50));
                break;
            case 'GOLDEN':
                kws = kws.filter(k => k.searchVolume >= 1000 && k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 20);
                break;
            case 'QUICK_WINS':
                kws = kws.filter(k => k.searchVolume > 500 && k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 30 && (k.cerebroIQScore === null || k.cerebroIQScore < 300));
                break;
            case 'LONG_TAIL':
                kws = kws.filter(k => k.searchVolume < 500 && k.organicRank !== null && k.organicRank >= 1 && k.organicRank <= 10);
                break;
            case 'NOT_INDEXED':
                kws = kws.filter(k => k.organicRank === null);
                break;
            case 'CLUSTER':
                if (selectedCluster) {
                    kws = kws.filter(k => k.rootCluster.toUpperCase() === selectedCluster);
                }
                break;
        }

        // ─── Advanced Filters ───
        // Organic Rank Range
        if (appliedFilters.orgRankMin > 1 || appliedFilters.orgRankMax < 306) {
            kws = kws.filter(k => {
                if (k.organicRank === null) return appliedFilters.orgRankMax >= 306; // null = not ranked, include only if max is 306
                return k.organicRank >= appliedFilters.orgRankMin && k.organicRank <= appliedFilters.orgRankMax;
            });
        }

        // Sponsored Rank Filter
        if (appliedFilters.spnRankFilter === 'none') {
            kws = kws.filter(k => k.sponsoredRank === null);
        } else if (appliedFilters.spnRankFilter === 'low') {
            kws = kws.filter(k => k.sponsoredRank !== null && k.sponsoredRank > 20);
        }

        // Min Search Volume
        if (appliedFilters.minSV > 0) {
            kws = kws.filter(k => k.searchVolume >= appliedFilters.minSV);
        }

        // Word Count Range
        if (appliedFilters.wordCountMin > 1 || appliedFilters.wordCountMax < 10) {
            kws = kws.filter(k => k.wordCount >= appliedFilters.wordCountMin && k.wordCount <= appliedFilters.wordCountMax);
        }

        // Ad Dominance: Spn < Org (ad pulling rank)
        if (appliedFilters.adDominanceToggle) {
            kws = kws.filter(k => k.sponsoredRank !== null && k.organicRank !== null && k.sponsoredRank < k.organicRank);
        }

        // Min Push Priority
        if (appliedFilters.minPushPriority > 0) {
            kws = kws.filter(k => k.pushPriority >= appliedFilters.minPushPriority);
        }

        // Strategy Tag
        if (appliedFilters.strategyFilter !== 'ALL') {
            kws = kws.filter(k => k.strategyTag === appliedFilters.strategyFilter);
        }

        // Sorting
        kws.sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];
            if (valA === null || valA === undefined) valA = sortDir === 'desc' ? -Infinity : Infinity;
            if (valB === null || valB === undefined) valB = sortDir === 'desc' ? -Infinity : Infinity;
            if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return sortDir === 'asc' ? valA - valB : valB - valA;
        });

        return kws;
    }, [data, filterMode, selectedCluster, searchTerm, sortField, sortDir, appliedFilters]);

    // Calculate Pagination
    const totalPages = Math.ceil(displayKeywords.length / itemsPerPage);
    const paginatedKeywords = displayKeywords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Filter ASINs for dropdown
    const filteredProducts = useMemo(() => {
        if (!asinSearchTerm) return products;
        const lower = asinSearchTerm.toLowerCase();
        return products.filter(p =>
            p.asin.toLowerCase().includes(lower) ||
            (p.name && p.name.toLowerCase().includes(lower))
        );
    }, [products, asinSearchTerm]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-violet-500 mx-auto" />
                    <p className="mt-4 text-slate-500 font-medium">Loading ASIN Intelligence...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
                <ShieldAlert size={48} className="text-red-500" />
                <p className="text-red-600 font-medium max-w-lg text-center">Error loading ASIN Intelligence: {error}</p>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <p className="text-slate-500">No data available. Upload a Cerebro My ASIN file first.</p>
            </div>
        );
    }

    const { healthCards } = data;

    // Computed KPIs
    const top3Count = data.keywords.filter(k => k.organicRank !== null && k.organicRank <= 3).length;
    const strikeZoneSV = data.keywords.filter(k => k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 30 && k.searchVolume > 300).reduce((s, k) => s + k.searchVolume, 0);
    const notIndexedCount = data.keywords.filter(k => k.organicRank === null).length;
    const quickWinsCount = data.keywords.filter(k => k.searchVolume > 500 && k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 30 && (k.cerebroIQScore === null || k.cerebroIQScore < 300)).length;
    const longTailCount = data.keywords.filter(k => k.searchVolume < 500 && k.organicRank !== null && k.organicRank >= 1 && k.organicRank <= 10).length;

    const filters: { mode: FilterMode; label: string; icon: React.ElementType; count?: number; title?: string }[] = [
        { mode: 'ALL', label: 'All Keywords', icon: Layers, count: data.keywords.length },
        { mode: 'BLEEDING', label: 'Bleeding', icon: ShieldAlert, count: data.keywords.filter(k => k.searchVolume >= 500 && (k.organicRank === null || k.organicRank > 50)).length, title: 'Keywords bạn đang rank nhưng competitors rank cao hơn' },
        { mode: 'GOLDEN', label: 'Golden Opps', icon: Sparkles, count: data.keywords.filter(k => k.searchVolume >= 1000 && k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 20).length, title: 'SV cao, competition thấp, chưa ai dominate' },
        { mode: 'QUICK_WINS', label: 'Quick Wins', icon: Rocket, count: quickWinsCount, title: 'SV>500, Rank 11-30, CPR<300 — dễ push lên top 10' },
        { mode: 'LONG_TAIL', label: 'Long Tail', icon: TrendingUp, count: longTailCount, title: 'SV<500, đang rank top 10 — volume thấp nhưng đang rank' },
        { mode: 'NOT_INDEXED', label: 'Not Indexed', icon: Eye, count: notIndexedCount, title: 'Keywords chưa có organic rank' },
        { mode: 'CLUSTER', label: 'Root Clusters', icon: Filter },
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Page Header */}
                <div className="bg-white border-b border-slate-200 px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25">
                                    <Brain size={14} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-black text-slate-900">ASIN Intelligence</h1>
                                    <p className="text-[10px] text-slate-500">Personal ASIN Health Check · Cerebro Analysis</p>
                                </div>
                            </div>
                            {/* ASIN Selector — left side */}
                            <div className="relative ml-2 border-l border-slate-200 pl-3">
                                <button
                                    onClick={() => setIsAsinDropdownOpen(!isAsinDropdownOpen)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors w-64 text-left"
                                >
                                    <Package size={12} className="text-violet-500 shrink-0" />
                                    <span className="truncate flex-1">
                                        {products.find(p => p.asin === selectedAsin)?.name
                                            ? `${products.find(p => p.asin === selectedAsin)?.name} (${selectedAsin})`
                                            : selectedAsin || 'Select Product'}
                                    </span>
                                    <ChevronDown size={12} className={`shrink-0 transition-transform ${isAsinDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isAsinDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsAsinDropdownOpen(false)}
                                        />
                                        <div className="absolute top-full left-3 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                                            <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                                                <Search size={12} className="text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search ASIN or Name..."
                                                    value={asinSearchTerm}
                                                    onChange={e => setAsinSearchTerm(e.target.value)}
                                                    className="w-full text-xs outline-none bg-transparent"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {filteredProducts.length === 0 ? (
                                                    <div className="px-3 py-4 text-center text-xs text-slate-500">No products found</div>
                                                ) : (
                                                    filteredProducts.map(p => (
                                                        <button
                                                            key={p.asin}
                                                            onClick={() => {
                                                                setSelectedAsin(p.asin);
                                                                setIsAsinDropdownOpen(false);
                                                                setAsinSearchTerm('');
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${selectedAsin === p.asin ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <div className="truncate">{p.name || '-'}</div>
                                                            <div className={`text-[10px] ${selectedAsin === p.asin ? 'text-violet-500' : 'text-slate-400'}`}>
                                                                {p.asin}
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400 font-medium">
                                {data.keywords.length} keywords
                            </span>
                            <button
                                onClick={handleRunTool}
                                disabled={isToolRunning}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isToolRunning
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                    }`}
                            >
                                {isToolRunning ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <Play size={12} />
                                        Run Ranking Tool
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">

                    {/* ─── Health Cards ─── */}
                    <div className="grid grid-cols-4 gap-3">
                        <HealthCard
                            icon={Trophy}
                            label="Organic Domination"
                            value={healthCards.organicDomination}
                            subtext={`Top 10 (SV > 300)`}
                            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                            onClick={() => { setFilterMode('ALL'); setOrgRankMin(1); setOrgRankMax(10); setAppliedFilters(prev => ({ ...prev, orgRankMin: 1, orgRankMax: 10 })); setCurrentPage(1); }}
                            extra={<p className="text-[10px] opacity-80">Top 3: {top3Count} keywords</p>}
                        />
                        <HealthCard
                            icon={Target}
                            label="The Strike Zone"
                            value={healthCards.strikeZone}
                            subtext={`rank 11-30 (SV > 300)`}
                            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
                            onClick={() => { setFilterMode('ALL'); setOrgRankMin(11); setOrgRankMax(30); setAppliedFilters(prev => ({ ...prev, orgRankMin: 11, orgRankMax: 30 })); setCurrentPage(1); }}
                            extra={<p className="text-[10px] opacity-80">Tiềm năng SV: {strikeZoneSV.toLocaleString()}</p>}
                        />
                        <div
                            className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
                            onClick={() => { setFilterMode('NOT_INDEXED'); setCurrentPage(1); }}
                        >
                            <div className="absolute top-2 right-2 opacity-20">
                                <BarChart3 size={28} />
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Indexing Coverage</p>
                            <p className="text-2xl font-black mt-1">{healthCards.indexingCoverage.percentage}%</p>
                            <div className="w-full bg-white/20 rounded-full h-1.5 mt-1.5">
                                <div
                                    className="bg-white h-1.5 rounded-full transition-all duration-700"
                                    style={{ width: `${healthCards.indexingCoverage.percentage}%` }}
                                />
                            </div>
                            <p className="text-[10px] mt-1 opacity-80">{notIndexedCount} keywords chưa index</p>
                        </div>
                        <HealthCard
                            icon={Rocket}
                            label="Quick Wins"
                            value={quickWinsCount}
                            subtext="SV>500, Rank 11-30, CPR<300"
                            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
                            onClick={() => { setFilterMode('QUICK_WINS'); setCurrentPage(1); }}
                            extra={<p className="text-[10px] opacity-80">Dễ push lên Top 10</p>}
                        />
                    </div>

                    {/* ─── Charts ─── */}
                    <AsinCharts
                        keywords={data.keywords}
                        onFilterRankGroup={handleChartFilterRankGroup}
                        onSearchKeyword={handleChartSearchKeyword}
                    />

                    {/* ─── Filters ─── */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                placeholder='Search... (sv>1000, "exact", gift -birthday)'
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Filter Pills */}
                        {filters.map(f => (
                            <button
                                key={f.mode}
                                onClick={() => {
                                    setFilterMode(f.mode);
                                    if (f.mode !== 'CLUSTER') setSelectedCluster(null);
                                    setCurrentPage(1);
                                }}
                                title={f.title}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                                    ${filterMode === f.mode
                                        ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600'
                                    }`}
                            >
                                <f.icon size={12} />
                                {f.label}
                                {f.count !== undefined && (
                                    <span className={`ml-0.5 text-[10px] px-1 py-0 rounded-full ${filterMode === f.mode ? 'bg-white/20' : 'bg-slate-100'}`}>
                                        {f.count}
                                    </span>
                                )}
                            </button>
                        ))}

                        {/* Cluster Dropdown */}
                        {filterMode === 'CLUSTER' && (
                            <select
                                className="px-2 py-1.5 bg-white border border-violet-300 rounded-lg text-xs font-semibold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                value={selectedCluster || ''}
                                onChange={e => setSelectedCluster(e.target.value || null)}
                            >
                                <option value="">All Clusters</option>
                                {data.rootClusters.map(c => (
                                    <option key={c.name} value={c.name}>
                                        {c.name} ({c.count} kws · {c.totalSV.toLocaleString()} SV)
                                    </option>
                                ))}
                            </select>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                            {/* Export Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-all"
                                >
                                    <Download size={12} /> Export
                                </button>
                                {showExportMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                                        <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                                            <button onClick={exportCSV} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download size={10} /> Export CSV</button>
                                            <button onClick={exportPPC} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download size={10} /> Export cho PPC</button>
                                            <button onClick={copyKeywords} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Copy size={10} /> Copy Keywords</button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Column Visibility */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowColDropdown(!showColDropdown)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-all"
                                >
                                    <Columns3 size={12} /> Cột
                                </button>
                                {showColDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowColDropdown(false)} />
                                        <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Presets</p>
                                            <div className="flex gap-1 mb-2">
                                                <button onClick={() => applyPreset('compact')} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-violet-100">Compact</button>
                                                <button onClick={() => applyPreset('full')} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-violet-100">Full</button>
                                                <button onClick={() => applyPreset('ppc')} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-violet-100">PPC</button>
                                            </div>
                                            <div className="space-y-0.5">
                                                {ALL_OPTIONAL_COLS.map(col => (
                                                    <label key={col.key} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                                                        <input type="checkbox" checked={isColVisible(col.key)} onChange={() => toggleCol(col.key)} className="w-3 h-3 rounded border-slate-300" />
                                                        <span className="text-xs text-slate-700">{col.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                                    ${showAdvanced || advancedActive
                                        ? 'bg-violet-100 text-violet-700 border border-violet-300'
                                        : 'bg-white border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600'
                                    }`}
                            >
                                <SlidersHorizontal size={12} />
                                Filters
                                {advancedActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                                {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </button>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {displayKeywords.length} keywords
                            </span>
                        </div>
                    </div>

                    {/* ─── Advanced Filter Panel ─── */}
                    {showAdvanced && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Advanced Filters</p>
                                <button
                                    onClick={resetAdvancedFilters}
                                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 transition-colors"
                                >
                                    <RotateCcw size={10} /> Reset All
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">

                                {/* ── Column 1: Rank Range ── */}
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1">
                                        <Target size={10} /> Rank Range
                                    </p>

                                    {/* Organic Rank Range */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Organic Rank</label>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <input
                                                type="number" min={1} max={306}
                                                className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-center font-semibold focus:outline-none focus:ring-1 focus:ring-violet-400"
                                                value={orgRankMin}
                                                onChange={e => setOrgRankMin(Math.max(1, Number(e.target.value)))}
                                            />
                                            <span className="text-[10px] text-slate-400">to</span>
                                            <input
                                                type="number" min={1} max={306}
                                                className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-center font-semibold focus:outline-none focus:ring-1 focus:ring-violet-400"
                                                value={orgRankMax}
                                                onChange={e => setOrgRankMax(Math.min(306, Number(e.target.value)))}
                                            />
                                        </div>
                                        {/* Quick presets */}
                                        <div className="flex gap-1 mt-1">
                                            {[[1, 10], [11, 30], [31, 50], [51, 306]].map(([min, max]) => (
                                                <button
                                                    key={`${min}-${max}`}
                                                    onClick={() => { setOrgRankMin(min); setOrgRankMax(max); }}
                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all ${orgRankMin === min && orgRankMax === max
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-600'
                                                        }`}
                                                >
                                                    {min}-{max > 300 ? '∞' : max}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sponsored Rank Visibility */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Sponsored Visibility</label>
                                        <div className="flex gap-1 mt-0.5">
                                            {(['all', 'none', 'low'] as const).map(opt => {
                                                const labels = { all: 'All', none: 'No Ads', low: 'Rank > 20' };
                                                return (
                                                    <button
                                                        key={opt}
                                                        onClick={() => setSpnRankFilter(opt)}
                                                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${spnRankFilter === opt
                                                            ? 'bg-violet-600 text-white'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-600'
                                                            }`}
                                                    >
                                                        {labels[opt]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Column 2: Market Thresholds ── */}
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                                        <BarChart3 size={10} /> Market Thresholds
                                    </p>

                                    {/* Min Search Volume */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Min Search Volume</label>
                                        <div className="flex gap-1 mt-0.5">
                                            {[0, 100, 300, 500, 1000, 3000].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => setMinSV(v)}
                                                    className={`px-1.5 py-1 rounded text-[10px] font-semibold transition-all ${minSV === v
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-600'
                                                        }`}
                                                >
                                                    {v === 0 ? 'All' : v >= 1000 ? `${v / 1000}k` : v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Word Count */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Word Count</label>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <input
                                                type="number" min={1} max={10}
                                                className="w-12 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-center font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                                                value={wordCountMin}
                                                onChange={e => setWordCountMin(Math.max(1, Number(e.target.value)))}
                                            />
                                            <span className="text-[10px] text-slate-400">to</span>
                                            <input
                                                type="number" min={1} max={10}
                                                className="w-12 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-center font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                                                value={wordCountMax}
                                                onChange={e => setWordCountMax(Math.min(10, Number(e.target.value)))}
                                            />
                                        </div>
                                        <div className="flex gap-1 mt-1">
                                            {[{ l: 'Root (1-2)', min: 1, max: 2 }, { l: 'Mid (2-4)', min: 2, max: 4 }, { l: 'Long (4+)', min: 4, max: 10 }].map(p => (
                                                <button
                                                    key={p.l}
                                                    onClick={() => { setWordCountMin(p.min); setWordCountMax(p.max); }}
                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all ${wordCountMin === p.min && wordCountMax === p.max
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-600'
                                                        }`}
                                                >
                                                    {p.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Column 3: Performance Filters ── */}
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                        <Zap size={10} /> Performance
                                    </p>

                                    {/* Ad Dominance Toggle */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Ad Pulling Rank</label>
                                        <button
                                            onClick={() => setAdDominanceToggle(!adDominanceToggle)}
                                            className={`mt-0.5 flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${adDominanceToggle
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                                }`}
                                        >
                                            <div className={`w-6 h-3.5 rounded-full transition-all relative ${adDominanceToggle ? 'bg-emerald-300' : 'bg-slate-300'
                                                }`}>
                                                <div className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-all ${adDominanceToggle ? 'left-3' : 'left-0.5'
                                                    }`} />
                                            </div>
                                            Spn &lt; Org only
                                        </button>
                                    </div>

                                    {/* Min Push Priority */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Min Push Priority</label>
                                        <div className="flex gap-1 mt-0.5">
                                            {[0, 1000, 5000, 10000].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => setMinPushPriority(v)}
                                                    className={`px-1.5 py-1 rounded text-[10px] font-semibold transition-all ${minPushPriority === v
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                                        }`}
                                                >
                                                    {v === 0 ? 'All' : v >= 1000 ? `${v / 1000}k+` : v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Strategy Tag */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Strategy Tag</label>
                                        <div className="flex gap-1 mt-0.5">
                                            {(['ALL', 'RANK', 'PUSH', 'PROFIT', 'SCALE'] as const).map(t => {
                                                const colors: Record<string, string> = {
                                                    ALL: minPushPriority === 0 && strategyFilter === 'ALL'
                                                        ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500',
                                                    RANK: 'bg-emerald-100 text-emerald-700',
                                                    PUSH: 'bg-rose-100 text-rose-700',
                                                    PROFIT: 'bg-amber-100 text-amber-700',
                                                    SCALE: 'bg-purple-100 text-purple-700',
                                                };
                                                return (
                                                    <button
                                                        key={t}
                                                        onClick={() => setStrategyFilter(t)}
                                                        className={`px-1.5 py-1 rounded text-[10px] font-semibold transition-all ${strategyFilter === t
                                                            ? (t === 'ALL' ? 'bg-slate-700 text-white' : colors[t].replace('100', '600').replace(/text-\w+-700/, 'text-white'))
                                                            : `${colors[t]} hover:opacity-80`
                                                            }`}
                                                    >
                                                        {t}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Apply Filters Button */}
                            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={applyFilters}
                                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold rounded-lg shadow-sm shadow-violet-500/25 transition-all flex items-center gap-1.5"
                                >
                                    <Filter size={12} /> Apply Filters
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── Keyword Table ─── */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                            <button onClick={() => handleSort('keyword')} className="flex items-center gap-1 hover:text-slate-600">
                                                Keyword <SortIcon field="keyword" />
                                            </button>
                                        </th>
                                        <th className="text-right px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                            <button onClick={() => handleSort('searchVolume')} className="flex items-center gap-1 justify-end hover:text-slate-600">
                                                SV <SortIcon field="searchVolume" />
                                            </button>
                                        </th>
                                        {isColVisible('keywordSales') && (
                                            <th className="text-right px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                <button onClick={() => handleSort('keywordSales')} className="flex items-center gap-1 justify-end hover:text-slate-600" title="Keyword Sales">
                                                    K.Sales <SortIcon field="keywordSales" />
                                                </button>
                                            </th>
                                        )}
                                        {isColVisible('cerebroIQScore') && (
                                            <th className="text-right px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                <button onClick={() => handleSort('cerebroIQScore')} className="flex items-center gap-1 justify-end hover:text-slate-600">
                                                    CPR <SortIcon field="cerebroIQScore" />
                                                </button>
                                            </th>
                                        )}
                                        {isColVisible('competingProducts') && (
                                            <th className="text-right px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                <button onClick={() => handleSort('competingProducts')} className="flex items-center gap-1 justify-end hover:text-slate-600">
                                                    Comp <SortIcon field="competingProducts" />
                                                </button>
                                            </th>
                                        )}
                                        <th className="text-center px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                            <button onClick={() => handleSort('organicRank')} className="flex items-center gap-1 justify-center hover:text-slate-600">
                                                Org <SortIcon field="organicRank" />
                                            </button>
                                        </th>
                                        {isColVisible('sponsoredRank') && (
                                            <th className="text-center px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                <button onClick={() => handleSort('sponsoredRank')} className="flex items-center gap-1 justify-center hover:text-slate-600">
                                                    Spn <SortIcon field="sponsoredRank" />
                                                </button>
                                            </th>
                                        )}
                                        {isColVisible('adDominance') && (
                                            <th className="text-center px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                Ad Dom.
                                            </th>
                                        )}
                                        {isColVisible('pushPriority') && (
                                            <th className="text-right px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                <button onClick={() => handleSort('pushPriority')} className="flex items-center gap-1 justify-end hover:text-slate-600">
                                                    Push <SortIcon field="pushPriority" />
                                                </button>
                                            </th>
                                        )}
                                        {isColVisible('strategyTag') && (
                                            <th className="text-center px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                Tag
                                            </th>
                                        )}
                                        <th className="text-center px-1 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider w-20">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedKeywords.map((kw, idx) => (
                                        <tr
                                            key={`${kw.keyword}-${idx}`}
                                            className={`border-b border-slate-50 hover:bg-violet-50/30 transition-colors cursor-pointer group
                                                ${selectedKeyword?.keyword === kw.keyword ? 'bg-violet-50' : ''}`}
                                            onClick={() => setSelectedKeyword(kw)}
                                        >
                                            <td className="px-3 py-1">
                                                <span className="text-xs font-medium text-slate-800 truncate block max-w-[240px]" title={kw.keyword}>
                                                    {kw.keyword}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1 text-right">
                                                <span className={`text-xs font-bold ${kw.searchVolume >= 50000 ? 'text-slate-900' : kw.searchVolume >= 10000 ? 'text-slate-700' : kw.searchVolume >= 1000 ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {kw.searchVolume.toLocaleString()}
                                                </span>
                                            </td>
                                            {isColVisible('keywordSales') && (
                                                <td className="px-2 py-1 text-right">
                                                    <span className="text-xs font-bold text-emerald-600">
                                                        {kw.keywordSales != null ? kw.keywordSales.toLocaleString() : '—'}
                                                    </span>
                                                </td>
                                            )}
                                            {isColVisible('cerebroIQScore') && (
                                                <td className="px-2 py-1 text-right">
                                                    <span className={`text-xs font-bold ${(kw.cerebroIQScore ?? 0) >= 1000 ? 'text-violet-600' : (kw.cerebroIQScore ?? 0) >= 100 ? 'text-blue-600' : 'text-slate-500'}`}>
                                                        {kw.cerebroIQScore != null ? kw.cerebroIQScore.toLocaleString() : '—'}
                                                    </span>
                                                </td>
                                            )}
                                            {isColVisible('competingProducts') && (
                                                <td className="px-2 py-1 text-right">
                                                    <span className={`text-xs font-bold ${kw.competingProducts >= 100000 ? 'text-red-500' : kw.competingProducts >= 10000 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {kw.competingProducts >= 1000 ? `${(kw.competingProducts / 1000).toFixed(0)}k` : kw.competingProducts.toLocaleString()}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-2 py-1 text-center">
                                                <RankBadge rank={kw.organicRank} />
                                            </td>
                                            {isColVisible('sponsoredRank') && (
                                                <td className="px-2 py-1 text-center">
                                                    <RankBadge rank={kw.sponsoredRank} />
                                                </td>
                                            )}
                                            {isColVisible('adDominance') && (
                                                <td className="px-2 py-1 text-center">
                                                    <AdDominanceBadge type={kw.adDominance} />
                                                </td>
                                            )}
                                            {isColVisible('pushPriority') && (
                                                <td className="px-2 py-1 text-right">
                                                    <span className={`text-xs font-bold ${kw.pushPriority > 10000 ? 'text-violet-600' : kw.pushPriority > 5000 ? 'text-blue-600' : 'text-slate-600'}`}>
                                                        {kw.pushPriority.toLocaleString()}
                                                    </span>
                                                </td>
                                            )}
                                            {isColVisible('strategyTag') && (
                                                <td className="px-2 py-1 text-center">
                                                    <StrategyBadge tag={kw.strategyTag} />
                                                </td>
                                            )}
                                            <td className="px-1 py-1 text-center">
                                                <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(kw.keyword); }}
                                                        className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                                        title="Copy keyword"
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                    <a
                                                        href={`https://www.amazon.com/s?k=${encodeURIComponent(kw.keyword)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                                                        title="Search on Amazon"
                                                    >
                                                        <ExternalLink size={11} />
                                                    </a>
                                                    {trackedKeywords.has(kw.keyword.toLowerCase()) ? (
                                                        <Check size={11} className="text-emerald-500" />
                                                    ) : trackingInProgress.has(kw.keyword.toLowerCase()) ? (
                                                        <Loader2 size={11} className="text-violet-500 animate-spin" />
                                                    ) : (
                                                        <button
                                                            onClick={(e) => handleTrack(kw, e)}
                                                            className={`p-0.5 rounded transition-all ${isSuggested(kw)
                                                                ? 'text-emerald-500 hover:bg-emerald-100'
                                                                : 'text-slate-400 hover:text-violet-500 hover:bg-violet-50'
                                                                }`}
                                                            title={isSuggested(kw) ? 'Recommended to track!' : 'Add to tracking'}
                                                        >
                                                            <Plus size={11} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-[10px] text-slate-500">
                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, displayKeywords.length)} of {displayKeywords.length}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-[10px] font-semibold text-slate-700 px-2">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                        {totalPages <= 1 && displayKeywords.length > 0 && (
                            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
                                Showing all {displayKeywords.length} keywords
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Action Center Sidebar ─── */}
            {selectedKeyword && (
                <ActionCenter keyword={selectedKeyword} onClose={() => setSelectedKeyword(null)} />
            )}
        </div>
    );
};
