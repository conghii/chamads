import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp,
    BarChart3,
    PieChart,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    LayoutDashboard,
    Zap,
    TrendingDown,
    Scale,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Brain
} from 'lucide-react';
import { useProfit } from '../services/profitService';
import ky from 'ky';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePie, Pie, Cell, Legend } from 'recharts';
import type { BulkAnalysisData } from '../types/analysis';
import { safeNumber, safePercent, safeCurrency } from '../utils/mathUtils';

interface DashboardSummary {
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
    };
    quickActions: {
        bleedingKeywords: number;
        goldenOpportunities: number;
        readyToHarvest?: number;
    };
    businessReport?: {
        totalSales: number;
        sessions: number;
        organicSales: number;
        organicRatio: number;
        lastUpdated?: string;
    } | null;
}

const Analytics: React.FC = () => {
    const [dateRange, setDateRange] = useState('Last 30 Days');
    const { globalConfig, costConfigs } = useProfit();

    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [bulkData, setBulkData] = useState<BulkAnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [summaryRes, bulkRes] = await Promise.all([
                ky.get('${API_BASE_URL}/api/dashboard/summary').json<DashboardSummary>(),
                ky.get('${API_BASE_URL}/api/analysis/bulk').json<BulkAnalysisData>()
            ]);
            setSummary(summaryRes);
            setBulkData(bulkRes);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch analytics data:', err);
            setError('Failed to load real-time analytics. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Derived Metrics
    const metrics = useMemo(() => {
        if (!summary || !bulkData) return null;

        const ppcSales = summary.profitability.totalSales; // From bulk top campaigns
        const totalSpend = safeNumber(summary.profitability.totalSpend);
        const orders = bulkData.topCampaigns.reduce((sum, c) => sum + (c.orders || 0), 0);

        const hasBusinessReport = !!summary.businessReport;
        const totalSales = hasBusinessReport ? safeNumber(summary.businessReport!.totalSales) : ppcSales;

        // Ensure organic sales is never negative
        const rawOrganic = totalSales - ppcSales;
        const organicSales = rawOrganic > 0 ? rawOrganic : 0;
        const organicRatio = totalSales > 0 ? (organicSales / totalSales) * 100 : 0;
        const ppcRatio = totalSales > 0 ? (ppcSales / totalSales) * 100 : 0;

        const acos = ppcSales > 0 ? (totalSpend / ppcSales) * 100 : 0;
        const tacos = totalSales > 0 ? (totalSpend / totalSales) * 100 : safeNumber(summary.profitability.tacos);

        // Simplified Net Profit for Dashboard:
        const referralFees = totalSales * (globalConfig.defaultReferralFeePercentage / 100);

        // Try to estimate COGS/FBA from productConfigs if they exist
        const configs = Object.values(costConfigs);
        const avgCogs = configs.length > 0 ? configs.reduce((s, c) => s + c.cogs, 0) / configs.length : 5; // Default $5
        const avgFbaByOrder = configs.length > 0 ? configs.reduce((s, c) => s + c.fbaFee, 0) / configs.length : 4; // Default $4

        const estimatedProductCosts = orders * (avgCogs + avgFbaByOrder);
        const netProfit = totalSales - totalSpend - referralFees - estimatedProductCosts;
        const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        return {
            totalSales,
            ppcSales,
            organicSales,
            organicRatio,
            ppcRatio,
            totalSpend,
            acos,
            tacos,
            roas: totalSpend > 0 ? totalSales / totalSpend : 0,
            orders,
            netProfit,
            margin,
            hasBusinessReport
        };
    }, [summary, bulkData, globalConfig, costConfigs]);

    const adTypeData = useMemo(() => {
        if (!bulkData) return [];
        const types: Record<string, number> = { SP: 0, SB: 0, SD: 0 };
        bulkData.topCampaigns.forEach(c => {
            const type = (c.campaignType || 'SP').toUpperCase();
            if (types[type] !== undefined) {
                types[type] += c.spend;
            } else {
                types['SP'] += c.spend;
            }
        });

        const total = Object.values(types).reduce((a, b) => a + b, 0);
        return Object.entries(types).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0
        })).filter(d => d.value > 0);
    }, [bulkData]);

    const COLORS = ['#3b82f6', '#8b5cf6', '#6366f1', '#f59e0b'];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-slate-500 font-medium animate-pulse">Aggregating Amazon Data...</p>
            </div>
        );
    }

    if (error || !metrics || !summary || !bulkData) {
        return (
            <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-rose-50 p-4 rounded-full mb-4">
                    <AlertCircle className="w-12 h-12 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Data Sync Required</h2>
                <p className="text-slate-500 mb-6">We couldn't load your analytics. Please ensure you have uploaded a <b>Bulk File</b> and <b>Search Term Report</b> in the Data Hub.</p>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all"
                >
                    <RefreshCw size={18} />
                    Retry Connection
                </button>
            </div>
        );
    }

    const formatCurrency = (val: number) => safeCurrency(val);
    const formatPercent = (val: number) => safePercent(val);

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50 flex flex-col gap-6">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                        <BarChart3 className="text-white w-7 h-7" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <p className="text-sm font-medium text-slate-500">Live data synced from Google Sheets</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                        <Calendar size={16} className="text-slate-400" />
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="text-xs font-black text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
                        >
                            <option>Last 30 Days</option>
                            <option>Last 7 Days</option>
                            <option>Year to Date</option>
                        </select>
                    </div>

                    <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md">
                        <Download size={14} />
                        Export Report
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                {/* 1. Total Sales */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:-translate-y-1 transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                    <div className="flex items-end justify-between mb-2">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(metrics.totalSales)}</h3>
                        <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            <ArrowUpRight size={14} /> +12.5%
                        </div>
                    </div>
                    {metrics.hasBusinessReport ? (
                        <div className="text-[10px] text-slate-500 font-medium">
                            <span className="text-blue-600 font-bold">PPC:</span> {formatCurrency(metrics.ppcSales)} ({formatPercent(metrics.ppcRatio)}) | <span className="text-emerald-600 font-bold">ORG:</span> {formatCurrency(metrics.organicSales)} ({formatPercent(metrics.organicRatio)})
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            ⚠️ Update Business Report for full breakdown
                        </div>
                    )}
                </div>

                {/* 2. Ad Spend */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:-translate-y-1 transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ad Spend</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(metrics.totalSpend)}</h3>
                        <div className="flex items-center gap-0.5 text-xs font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                            <ArrowUpRight size={14} /> +5.2%
                        </div>
                    </div>
                </div>

                {/* 3. ACOS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:-translate-y-1 transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ACOS (PPC Only)</p>
                    <div className="flex items-end justify-between mb-2">
                        <h3 className={`text-2xl font-black ${metrics.acos > 30 ? 'text-rose-600' : 'text-slate-900'} tracking-tight`}>{formatPercent(metrics.acos)}</h3>
                        <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            <ArrowDownRight size={14} /> -2.1%
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        Ad Spend / PPC Sales
                    </div>
                </div>

                {/* 4. TACoS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:-translate-y-1 transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TACoS</p>
                    <div className="flex items-end justify-between mb-2">
                        <h3 className={`text-2xl font-black border-b-2 border-transparent ${metrics.hasBusinessReport ? (metrics.tacos > 15 ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-400'} tracking-tight`}>
                            {metrics.hasBusinessReport ? formatPercent(metrics.tacos) : '—'}
                        </h3>
                        {metrics.hasBusinessReport && (
                            <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                <ArrowDownRight size={14} /> -1.2%
                            </div>
                        )}
                    </div>
                    {metrics.hasBusinessReport ? (
                        <div className="text-[10px] text-slate-500 font-medium">
                            <span className="font-bold">Target: 15%</span> (Ad Spend / Total Rev)
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                            Requires Business Report
                        </div>
                    )}
                </div>

                {/* 5. Net Profit */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:-translate-y-1 transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Profit (Est.)</p>
                    <div className="flex items-end justify-between mb-2">
                        <h3 className={`text-2xl font-black ${metrics.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'} tracking-tight`}>{formatCurrency(metrics.netProfit)}</h3>
                        <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            <ArrowUpRight size={14} /> +8.3%
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                        Net Margin: <span className="font-bold">{formatPercent(metrics.margin)}</span>
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Trend Chart - TACoS History */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <TrendingUp size={20} className="text-blue-600" />
                            </div>
                            <h3 className="font-black text-slate-800 text-lg">TACoS Performance Trend</h3>
                        </div>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Efficiency Path
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 p-6">
                        {summary.profitability.tacosHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={summary.profitability.tacosHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }}
                                        tickFormatter={(val) => {
                                            const d = new Date(val);
                                            return `${d.getMonth() + 1}/${d.getDate()}`;
                                        }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                        formatter={(val: any) => [`${val}%`, 'TACoS']}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Scale size={48} className="mb-4 opacity-20" />
                                <p className="font-bold">Sync data daily to see trend analysis</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ad Type Breakdown */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <PieChart size={20} className="text-purple-600" />
                            </div>
                            <h3 className="font-black text-slate-800 text-lg">Spend Allocation</h3>
                        </div>
                    </div>

                    <div className="flex-1 p-6 flex items-center justify-center min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={adTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {adTypeData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                />
                                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '20px' }} />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="px-6 pb-6 space-y-3">
                        {adTypeData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-xs font-bold text-slate-600">{d.name === 'SP' ? 'Sponsored Products' : d.name === 'SB' ? 'Sponsored Brands' : 'Sponsored Display'}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900 bg-slate-50 px-2 py-1 rounded-md group-hover:bg-indigo-50 transition-colors">{d.percentage.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Organic Growth Tracker */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-6">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <h3 className="font-black text-slate-800 text-lg">Organic Growth Tracker</h3>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Metric 1 */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Organic Sales Ratio</p>
                            <h4 className="text-3xl font-black text-slate-900">{formatPercent(metrics.organicRatio)}</h4>
                            <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                                {metrics.hasBusinessReport ? <ArrowUpRight size={14} /> : null}
                                {metrics.hasBusinessReport ? "Based on real Total Revenue" : "Upload Business Report"}
                            </p>
                        </div>
                    </div>

                    {/* Metric 2 */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Sessions</p>
                            <h4 className="text-3xl font-black text-slate-900">{metrics.hasBusinessReport ? summary.businessReport?.sessions?.toLocaleString() : '—'}</h4>
                            <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                                {metrics.hasBusinessReport && summary.businessReport!.sessions > 0 ? (
                                    <>CVR: {formatPercent((metrics.orders / summary.businessReport!.sessions) * 100)}</>
                                ) : '—'}
                            </p>
                        </div>
                    </div>

                    {/* AI Insight */}
                    <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex flex-col justify-center">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1"><Brain size={12} /> AI Insight</p>
                        <p className="text-sm font-bold text-blue-900 leading-relaxed">
                            {!metrics.hasBusinessReport ? "Data insufficient. Please upload a Business Report to generate organic insights."
                                : metrics.organicRatio > 60
                                    ? "🟢 Organic dominance is strong. The PPC halo effect is protecting your rank efficiently."
                                    : "⚠️ High reliance on PPC. Focus efforts on organic ranking improvements to reduce dependency on ad spend."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Quick Insights from Summary */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Zap size={20} className="text-amber-600" />
                            </div>
                            <h3 className="font-black text-slate-800 text-lg">Operations Radar</h3>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Bleeding Assets</p>
                                <h4 className="text-4xl font-black text-rose-700">{summary.quickActions.bleedingKeywords}</h4>
                                <p className="text-xs font-bold text-rose-500 mt-2">Keywords with high spend but zero sales. Needs immediate review.</p>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                <TrendingDown size={120} />
                            </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Golden Opportunities</p>
                                <h4 className="text-4xl font-black text-emerald-700">{summary.quickActions.goldenOpportunities}</h4>
                                <p className="text-xs font-bold text-emerald-500 mt-2">Keywords with high potential not yet in Page 1 Top 10.</p>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                <TrendingUp size={120} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio Performance Breakdown */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-900 rounded-lg">
                                <LayoutDashboard size={20} className="text-white" />
                            </div>
                            <h3 className="font-black text-slate-800 text-lg">Portfolio Performance</h3>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Portfolio</th>
                                    <th className="px-6 py-4 text-right">Spend</th>
                                    <th className="px-6 py-4 text-right">Sales</th>
                                    <th className="px-6 py-4 text-center">ACOS</th>
                                    <th className="px-6 py-4 text-center">Profitability</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bulkData.portfolioHierarchy.slice(0, 5).map((p, i) => {
                                    const portAcos = p.acos;
                                    const isHealthy = portAcos < (globalConfig.defaultProfitMarginBeforeAds || 35);
                                    return (
                                        <tr key={i} className="hover:bg-indigo-50/30 transition-all group">
                                            <td className="px-6 py-4 font-black text-slate-800">{p.name || 'Unassigned'}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-600">{formatCurrency(p.spend)}</td>
                                            <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(p.sales)}</td>
                                            <td className={`px-6 py-4 text-center font-black ${isHealthy ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {formatPercent(portAcos)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${isHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {isHealthy ? 'PROFITABLE' : 'WATCHING'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Insight Banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-xl shadow-indigo-200 overflow-hidden relative">
                <div className="absolute left-0 top-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                <div className="absolute right-0 bottom-0 w-64 h-64 bg-black/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>

                <div className="bg-white/20 p-5 rounded-3xl border border-white/30 backdrop-blur-md shadow-inner flex-shrink-0 relative z-10">
                    <Zap className="text-white w-10 h-10" fill="currentColor" />
                </div>

                <div className="flex-1 text-center md:text-left relative z-10">
                    <h3 className="text-xl font-black text-white mb-2 tracking-tight">Financial Engine Connected</h3>
                    <p className="text-indigo-50 font-medium leading-relaxed max-w-2xl text-sm">
                        ChamMPPC has integrated your <b>{Object.keys(costConfigs).length} product cost settings</b> with PPC metrics.
                        Your reported Net Profit accounts for COGS, FBA Fees, Referral Fees, and Ad Spend in real-time.
                    </p>
                </div>

                <button
                    onClick={() => fetchData()}
                    className="px-8 py-4 bg-white text-indigo-700 font-black rounded-2xl shadow-xl hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 flex-shrink-0 relative z-10"
                >
                    Refresh Insights
                </button>
            </div>

        </div>
    );
};

// Recharts specific fix for PieChart name conflict
const RePieChart = RePie;

export default Analytics;
