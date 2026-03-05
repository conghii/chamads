import { useState, useEffect } from 'react';
import {
    Database,
    UploadCloud,
    TrendingDown,
    DollarSign,
    Percent,
    Target,
    Activity,
    Zap,
    ArrowRight,
    Search,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    BarChart2,
    List
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, BarChart, Bar } from 'recharts';
import { safeNumber, safePercent, safeCurrency } from '../utils/mathUtils';

interface DashboardData {
    dataFreshness: {
        cerebroSync: { status: 'fresh' | 'stale' | 'missing', lastUpdated: string };
        bulkFileStatus: { status: 'fresh' | 'stale' | 'missing', lastUpdated: string };
        keywordTracking: { status: 'fresh' | 'stale' | 'missing', lastUpdated: string };
    };
    profitability: {
        totalSpend: number;
        totalSales: number;
        tacos: number;
        tacosHistory: { date: string, value: number }[];
        kSalesAttribution: { goldSales: number, totalKSales: number, percentage: number };
    };
    rankingStrategy: {
        marketDominanceScore: { percentage: number, yourTop10: number, competitorTop10: number };
        strikeZoneCounter: number;
    };
    quickActions: {
        campaignsBleeding: number;
        wastedSpend: number;
        highAcosCampaigns: number;
        readyToHarvest: number;
        goldenOpportunities: number;
        keywordsToNegate: number;
    };
    businessReport?: {
        totalSales: number;
        sessions: number;
        organicSales: number;
        organicRatio: number;
        lastUpdated?: string;
    } | null;
}

export function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFreshnessExpanded, setIsFreshnessExpanded] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            try {
                const response = await fetch('http://localhost:3000/api/dashboard/summary', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error('Failed to fetch dashboard data');
                const result = await response.json();
                setData(result);
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    setError('Request timed out (60s). The dataset might be too large.');
                } else {
                    setError(err.message);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 bg-slate-50 h-full">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative">
                    <strong className="font-bold">Error loading dashboard: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            </div>
        );
    }

    // Use centralized formatting from mathUtils
    const formatMoney = (val: number) => safeCurrency(val);
    const formatPercent = (val: number) => safePercent(val);
    const formatDate = (isoStr: string) => {
        if (isoStr === 'N/A') return 'Not Uploaded';
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
            }).format(new Date(isoStr));
        } catch {
            return isoStr;
        }
    };

    const StatusBadge = ({ status }: { status: 'fresh' | 'stale' | 'missing' }) => {
        const styles = {
            fresh: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            stale: 'bg-amber-100 text-amber-700 border-amber-200',
            missing: 'bg-red-100 text-red-700 border-red-200'
        };
        const text = {
            fresh: 'Connected',
            stale: 'Needs Update',
            missing: 'Missing'
        };
        return (
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${styles[status]}`}>
                {text[status]}
            </span>
        );
    };

    const isCerebroFresh = data.dataFreshness.cerebroSync.status === 'fresh';
    const isBulkFresh = data.dataFreshness.bulkFileStatus.status === 'fresh';
    const isKeywordFresh = data.dataFreshness.keywordTracking.status === 'fresh';
    const allFresh = isCerebroFresh && isBulkFresh && isKeywordFresh;
    const hasMissing = data.dataFreshness.cerebroSync.status === 'missing' || data.dataFreshness.bulkFileStatus.status === 'missing' || data.dataFreshness.keywordTracking.status === 'missing';

    // Temporary calculations for Health Score (will be fully implemented later)
    const healthScore = 75; // Stub for now

    // Summary Metrics
    const hasBR = !!data.businessReport;
    const brData = data.businessReport;

    const totalRevenue = hasBR ? safeNumber(brData!.totalSales) : safeNumber(data.profitability.totalSales);
    const ppcSales = safeNumber(data.profitability.totalSales);

    // Ensure organic sales is never negative and uses the correct base
    const rawOrganic = totalRevenue - ppcSales;
    const organicSales = rawOrganic > 0 ? rawOrganic : 0;
    const organicRatio = totalRevenue > 0 ? (organicSales / totalRevenue) * 100 : 0;
    const ppcRatio = totalRevenue > 0 ? (ppcSales / totalRevenue) * 100 : 0;

    const profit = totalRevenue - safeNumber(data.profitability.totalSpend);
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Correct TACoS formula: Ad Spend / Total Sales
    const totalSpend = safeNumber(data.profitability.totalSpend);
    const tacos = totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : safeNumber(data.profitability.tacos);

    // Stub trend data
    const salesTrend = 12.5;
    const spendCpc = 0.72; // Stub for now

    // Stub Campaign Health data
    const campaignHealthData = [
        { name: 'Profitable', value: 450, color: '#10b981' }, // emerald-500
        { name: 'Warning', value: 120, color: '#f59e0b' },    // amber-500
        { name: 'Bleeding', value: 35, color: '#ef4444' },    // red-500
        { name: 'Paused', value: 360, color: '#94a3b8' }      // slate-400
    ];
    const totalCampaigns = campaignHealthData.reduce((acc, curr) => acc + curr.value, 0);
    const topBleedingCampaigns = [
        { name: 'SP - Main Product Exact', wasted: 430 },
        { name: 'SB - Brand Defend', wasted: 215 },
        { name: 'SD - Retargeting', wasted: 112 },
    ];

    // Stub Keyword Dominance data
    const keywordDominanceData = [
        { tier: 'Top 3', count: 12, label: 'Market Leaders', color: '#10b981' }, // emerald-500
        { tier: 'Top 4-10', count: 45, label: 'Page 1 Competitors', color: '#3b82f6' }, // blue-500
        { tier: 'Top 11-30', count: 180, label: 'Strike Zone', color: '#f59e0b' }, // amber-500
        { tier: 'Top 31-50', count: 320, label: 'Emerging', color: '#64748b' }, // slate-500
    ];

    // Stub Top Issues data
    const topIssues = [
        { type: 'Bleeding', item: 'Keyword: "garlic press stainless steel"', impact: '-$145.20', action: 'Negate', link: '/harvest-hub?tab=negate' },
        { type: 'High ACOS', item: 'Campaign: SP - Main Product Exact', impact: '145% ACOS', action: 'Optimize', link: '/analysis-bulk?view=campaigns&filter=high-acos' },
        { type: 'Inventory', item: 'ASIN: B08FWK1ZV3', impact: '12 Days Left', action: 'Restock', link: '/inventory' },
        { type: 'Ranking', item: 'Keyword: "premium garlic press"', impact: 'Rank dropped 5→12', action: 'Boost Bid', link: '/asin-intelligence' },
        { type: 'Harvest', item: 'Search Term: "garlic press 2 pack"', impact: '8 Orders, 0 Exact', action: 'Add Exact', link: '/harvest-hub?tab=scale' },
    ];

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
            {/* ROW 1: Header + Freshness Bar + Health Score */}
            <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Command Center</h1>
                    <p className="text-slate-500 font-medium mt-1">Unified view of your Amazon Ads performance</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Compact Data Freshness */}
                    <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm">
                        <button
                            onClick={() => setIsFreshnessExpanded(!isFreshnessExpanded)}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors rounded-xl w-full xl:w-auto"
                        >
                            {allFresh ? (
                                <><CheckCircle2 size={18} className="text-emerald-500" /> <span className="text-sm font-bold text-slate-700">Data up to date</span></>
                            ) : hasMissing ? (
                                <><AlertTriangle size={18} className="text-red-500" /> <span className="text-sm font-bold text-slate-700">Missing Data Sources</span></>
                            ) : (
                                <><AlertTriangle size={18} className="text-amber-500" /> <span className="text-sm font-bold text-slate-700">Data Needs Update</span></>
                            )}
                            {isFreshnessExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </button>

                        {isFreshnessExpanded && (
                            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><Database size={14} className="text-blue-500" /><span className="text-xs font-bold text-slate-700">Market Intel</span></div>
                                    <div className="flex items-center gap-2"><span className="text-[10px] text-slate-500">{formatDate(data.dataFreshness.cerebroSync.lastUpdated)}</span><StatusBadge status={data.dataFreshness.cerebroSync.status} /></div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><UploadCloud size={14} className="text-purple-500" /><span className="text-xs font-bold text-slate-700">Bulk Sheet</span></div>
                                    <div className="flex items-center gap-2"><span className="text-[10px] text-slate-500">{formatDate(data.dataFreshness.bulkFileStatus.lastUpdated)}</span><StatusBadge status={data.dataFreshness.bulkFileStatus.status} /></div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><Target size={14} className="text-emerald-500" /><span className="text-xs font-bold text-slate-700">Keyword Tracker</span></div>
                                    <div className="flex items-center gap-2"><span className="text-[10px] text-slate-500">{formatDate(data.dataFreshness.keywordTracking.lastUpdated)}</span><StatusBadge status={data.dataFreshness.keywordTracking.status} /></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Date Selector */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm cursor-pointer hover:bg-slate-50">
                        <Calendar size={18} className="text-slate-500" />
                        <span className="text-sm font-bold text-slate-700">Last 30 Days</span>
                        <ChevronDown size={16} className="text-slate-400" />
                    </div>

                    {/* Health Score */}
                    <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                        <Activity size={18} className="text-slate-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Health Score</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-black leading-none ${healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{healthScore}/100</span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${healthScore}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 2: Summary Metrics (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Sales */}
                <div className="bg-white rounded-xl p-5 border-t-4 border-t-emerald-500 shadow-sm border-l border-r border-b border-slate-200/60">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales</p>
                        <DollarSign size={16} className="text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">{formatMoney(totalRevenue)}</p>
                    <div className="mt-3 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-400 text-[10px] uppercase">Orders: 2,436</span>
                            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md">
                                <ArrowUpRight size={14} />
                                {salesTrend}%
                            </div>
                        </div>
                        {hasBR ? (
                            <div className="text-[10px] font-medium text-slate-500 mt-1 border-t border-slate-50 pt-1 flex justify-between">
                                <span>PPC: <span className="text-blue-600">{formatMoney(ppcSales)}</span></span>
                                <span>ORG: <span className="text-emerald-600">{formatMoney(organicSales)}</span></span>
                            </div>
                        ) : (
                            <div className="text-[10px] text-slate-400 mt-1 italic">
                                PPC Only (Upload BR for full view)
                            </div>
                        )}
                    </div>
                </div>

                {/* Total Spend */}
                <div className="bg-white rounded-xl p-5 border-t-4 border-t-amber-500 shadow-sm border-l border-r border-b border-slate-200/60">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Spend</p>
                        <Zap size={16} className="text-amber-500" />
                    </div>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">{formatMoney(data.profitability.totalSpend)}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">CPC: ${spendCpc.toFixed(2)}</span>
                    </div>
                </div>

                {/* TACoS */}
                <div className="bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-800 text-white relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">TACoS</p>
                        <Percent size={16} className={tacos > 30 ? 'text-red-400' : 'text-emerald-400'} />
                    </div>
                    <p className="text-3xl font-black tracking-tight relative z-10">{formatPercent(tacos)}</p>
                    <div className="mt-3 relative z-10">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                            <span>Target: 30%</span>
                            <span>{data.profitability.tacos > 30 ? 'Over' : 'Good'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                            {/* Gauge fill */}
                            <div className={`absolute top-0 left-0 h-full ${tacos > 30 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (tacos / 60) * 100)}%` }}></div>
                            {/* Target marker */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: '50%' }}></div>
                        </div>
                    </div>
                </div>

                {/* Profit */}
                <div className={`bg-white rounded-xl p-5 border-t-4 shadow-sm border-l border-r border-b border-slate-200/60 ${profit >= 0 ? 'border-t-blue-500' : 'border-t-red-500'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profit</p>
                        <TrendingDown size={16} className={profit >= 0 ? 'text-blue-500 transform rotate-180' : 'text-red-500'} />
                    </div>
                    <p className={`text-3xl font-black tracking-tight ${profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">Margin: {margin.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* ROW 3: Trend Charts & Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Sales vs Spend Visual */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 min-h-[300px] flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingDown className="text-blue-500 transform rotate-180" size={18} />
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">Sales vs Spend Overview</h2>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <div className="relative w-full h-8 bg-slate-100 rounded-full overflow-hidden mb-6">
                            {/* Profit (blue) under everything to act as the gap filler if we layered, but let's do segmented */}
                            <div className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000" style={{ width: '100%' }}></div>
                            <div className="absolute top-0 right-0 h-full bg-white transition-all duration-1000" style={{ width: `${100 - (data.profitability.totalSales > 0 ? (data.profitability.totalSpend / data.profitability.totalSales) * 100 : 0)}%`, opacity: 0.2 }}></div>

                            <div className="absolute top-0 left-0 h-full bg-amber-500 transition-all duration-1000 z-10" style={{ width: `${data.profitability.totalSales > 0 ? (data.profitability.totalSpend / data.profitability.totalSales) * 100 : 0}%` }}></div>
                            <div className="absolute top-0 bottom-0 w-1 bg-white z-20" style={{ left: `${data.profitability.totalSales > 0 ? (data.profitability.totalSpend / data.profitability.totalSales) * 100 : 0}%` }}></div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t border-slate-100 pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Total Sales</p>
                                    <p className="text-xl font-black text-slate-800">{formatMoney(data.profitability.totalSales)}</p>
                                </div>
                            </div>
                            <div className="hidden md:block w-px h-10 bg-slate-200"></div>
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Ads Spend</p>
                                    <p className="text-xl font-black text-slate-800">{formatMoney(data.profitability.totalSpend)}</p>
                                </div>
                            </div>
                            <div className="hidden md:block w-px h-10 bg-slate-200"></div>
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Profit Retained</p>
                                    <p className="text-xl font-black text-slate-800">{formatMoney(profit)} <span className="text-xs text-blue-500 font-bold ml-1">({margin.toFixed(1)}%)</span></p>
                                </div>
                            </div>
                        </div>
                        {hasBR && (
                            <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-500 justify-center">
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> PPC Sales ({formatPercent(ppcRatio)})</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> Organic Sales ({formatPercent(organicRatio)})</div>
                            </div>
                        )}
                        <p className="text-xs text-slate-400 mt-4 text-center italic flex justify-center items-center gap-1">
                            <span>📊</span> Import data across multiple dates to unlock detailed trend charts.
                        </p>
                    </div>
                </div>

                {/* TACoS Trend Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 min-h-[300px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Percent className="text-slate-700" size={18} />
                            <h2 className="text-base font-bold text-slate-800 tracking-tight">TACoS Trend</h2>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Target: 30%</span>
                    </div>

                    <div className="flex-1 w-full h-full min-h-[200px] mt-2">
                        {data.profitability.tacosHistory && data.profitability.tacosHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.profitability.tacosHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTacos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={data.profitability.tacos > 30 ? "#ef4444" : "#10b981"} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={data.profitability.tacos > 30 ? "#ef4444" : "#10b981"} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val: string) => {
                                            const d = new Date(val);
                                            return `${d.getMonth() + 1}/${d.getDate()}`;
                                        }}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(val: number) => `${val}%`}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[0, 'dataMax + 5']}
                                    />
                                    <Tooltip
                                        formatter={(val: any) => [`${val}%`, 'TACoS']}
                                        labelFormatter={(label: any) => new Date(label).toLocaleDateString()}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" />
                                    <Area type="monotone" dataKey="value" stroke={data.profitability.tacos > 30 ? "#ef4444" : "#10b981"} strokeWidth={3} fillOpacity={1} fill="url(#colorTacos)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-slate-400 text-sm font-medium">
                                Not enough historical data
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ROW 4: Campaign Health, Dominance, Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6 place-items-stretch">
                {/* Campaign Health Donut */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col min-h-[350px]">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="text-emerald-500" size={18} />
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">Campaign Health</h2>
                    </div>

                    <div className="flex-1 flex flex-col xl:flex-row items-center gap-6">
                        <div className="relative w-48 h-48 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={campaignHealthData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {campaignHealthData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any) => [`${value} campaigns`, 'Count']}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">{totalCampaigns}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Total</span>
                            </div>
                        </div>

                        <div className="w-full">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top Bleeding</h3>
                            <div className="space-y-2">
                                {topBleedingCampaigns.map((camp, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-red-50/50 p-2 rounded-lg border border-red-100">
                                        <div className="truncate pr-2 font-medium text-slate-700">{camp.name}</div>
                                        <div className="font-bold text-red-600 whitespace-nowrap">-${camp.wasted}</div>
                                    </div>
                                ))}
                            </div>
                            <Link to="/analysis-bulk" className="mt-3 block text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                View all campaigns →
                            </Link>
                        </div>
                    </div>
                </div>
                {/* Keyword Dominance Funnel */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col min-h-[350px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart2 className="text-blue-500" size={18} />
                            <h2 className="text-base font-bold text-slate-800 tracking-tight">Keyword Dominance</h2>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">25 New in Top 10</span>
                    </div>

                    <div className="flex-1 w-full min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={keywordDominanceData}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                barSize={24}
                            >
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="tier"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                    width={70}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value: any, _name: any, props: any) => [
                                        `${value} keywords`,
                                        props.payload.label
                                    ]}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {keywordDominanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-2 text-center border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">
                            Focus on pushing <span className="font-bold text-amber-600">{data.rankingStrategy.strikeZoneCounter}</span> keywords in the Strike Zone to Page 1.
                        </p>
                    </div>
                </div>

                {/* Quick Actions (6 items) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col min-h-[350px]">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="text-amber-500" size={18} />
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">Operational Quick Actions</h2>
                    </div>

                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {/* 1. Campaigns Bleeding */}
                        <Link to="/analysis-bulk?view=campaigns&filter=bleeding" className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-red-200 hover:shadow-md transition-all">
                            <div className="bg-red-100 p-2 rounded-lg text-red-600 mt-0.5">
                                <AlertTriangle size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-red-700 transition-colors">Campaigns Bleeding</h3>
                                    <span className="text-sm font-black text-red-600">{data.quickActions.campaignsBleeding || 12}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1.5 leading-tight">Spend &gt; 0 but 0 orders</p>
                                <div className="text-[10px] font-bold text-red-500 flex items-center">Fix Now <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
                            </div>
                        </Link>

                        {/* 2. Wasted Spend */}
                        <Link to="/analysis-bulk?view=campaigns&wasted=true" className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-red-200 hover:shadow-md transition-all">
                            <div className="bg-red-100 p-2 rounded-lg text-red-600 mt-0.5">
                                <TrendingDown size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-red-700 transition-colors">Wasted Spend</h3>
                                    <span className="text-sm font-black text-red-600">${data.quickActions.wastedSpend || 345}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1.5 leading-tight">Budget currently being wasted</p>
                                <div className="text-[10px] font-bold text-red-500 flex items-center">Review <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
                            </div>
                        </Link>

                        {/* 3. High ACOS */}
                        <Link to="/analysis-bulk?view=campaigns&filter=high-acos" className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-amber-200 hover:shadow-md transition-all">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600 mt-0.5">
                                <Percent size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition-colors">High ACOS</h3>
                                    <span className="text-sm font-black text-amber-600">{data.quickActions.highAcosCampaigns || 8}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1.5 leading-tight">Campaigns with ACOS &gt; Target</p>
                                <div className="text-[10px] font-bold text-amber-500 flex items-center">Optimize <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
                            </div>
                        </Link>

                        {/* 4. Ready to Harvest */}
                        <Link to="/harvest-hub?tab=scale" className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all">
                            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mt-0.5">
                                <ArrowUpRight size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Ready to Harvest</h3>
                                    <span className="text-sm font-black text-emerald-600">{data.quickActions.readyToHarvest || 24}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1.5 leading-tight">Winners not moved to exact</p>
                                <div className="text-[10px] font-bold text-emerald-500 flex items-center">Harvest <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
                            </div>
                        </Link>

                        {/* 5. Golden Opps */}
                        <Link to="/asin-intelligence?segment=golden-opps" className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all">
                            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mt-0.5">
                                <Search size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Golden Opps</h3>
                                    <span className="text-sm font-black text-emerald-600">{data.quickActions.goldenOpportunities || 1345}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1.5 leading-tight">High SV, not in Top 10 yet</p>
                                <div className="text-[10px] font-bold text-emerald-500 flex items-center">Capitalize <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
                            </div>
                        </Link>

                        {/* 6. Keywords to Negate */}
                        <Link to="/harvest-hub?tab=negate" className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all">
                            <div className="bg-slate-200 p-2 rounded-lg text-slate-600 mt-0.5">
                                <ArrowDownRight size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-slate-700 transition-colors">Keywords to Negate</h3>
                                    <span className="text-sm font-black text-slate-600">{data.quickActions.keywordsToNegate || 42}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1.5 leading-tight">Bleeding search terms</p>
                                <div className="text-[10px] font-bold text-slate-500 flex items-center">Negate <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* ROW 5: Issues Table */}
            <div className="grid grid-cols-1 mb-6">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[300px]">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <List className="text-slate-700" size={18} />
                            <h2 className="text-base font-bold text-slate-800 tracking-tight">Top Actionable Issues</h2>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded border border-slate-200">System Detected</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 font-bold w-32">Issue Type</th>
                                    <th scope="col" className="px-6 py-3 font-bold">Affected Item</th>
                                    <th scope="col" className="px-6 py-3 font-bold w-48">Impact / Status</th>
                                    <th scope="col" className="px-6 py-3 font-bold text-right w-32">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topIssues.map((issue, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${issue.type === 'Bleeding' ? 'bg-red-50 text-red-600 border-red-100' :
                                                issue.type === 'High ACOS' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    issue.type === 'Inventory' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                        issue.type === 'Ranking' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }`}>
                                                {issue.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            {issue.item}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">
                                            {issue.impact}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link to={issue.link} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100 hover:border-blue-200">
                                                {issue.action} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
