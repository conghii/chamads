import React, { useState, useMemo, useEffect } from 'react';
import {
    Calculator,
    Settings,
    TrendingUp,
    CheckCircle,
    Info,
    DollarSign,
    BarChart3,
    Zap,
    AlertTriangle,
    ArrowUpRight,
    Search,
    Filter,
    ArrowRight,
    Briefcase,
    TrendingDown
} from 'lucide-react';
import { useProfit } from '../services/profitService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import classNames from 'classnames';
import CostSettingsDialog from '../components/profit/CostSettingsDialog';
import ky from 'ky';
import type { BulkAnalysisData } from '../types/analysis';
import { safeNumber, safePercent, safeCurrency } from '../utils/mathUtils';

const ProfitCalculator: React.FC = () => {
    const { globalConfig, calculateProfit } = useProfit();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [data, setData] = useState<BulkAnalysisData | null>(null);
    const [loading, setLoading] = useState(true);

    // Simulator State
    const [targetAcos, setTargetAcos] = useState(30);
    const [priceAdj, setPriceAdj] = useState(0);
    const [organicIncrease, setOrganicIncrease] = useState(0); // Percentage -50 to 100

    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch actual bulk data to drive calculations
                const [bulkData, summaryData] = await Promise.all([
                    ky.get('http://localhost:3000/api/analysis/bulk').json<BulkAnalysisData>(),
                    ky.get('http://localhost:3000/api/dashboard/summary').json<any>()
                ]);
                setData(bulkData);
                setSummary(summaryData);
            } catch (err) {
                console.error('Failed to fetch profit data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Aggregate Data calculation
    const stats = useMemo(() => {
        if (!data || !data.topCampaigns) return calculateProfit('TOTAL', 0, 0, 0);

        const ppcSales = safeNumber(data.topCampaigns.reduce((sum, c) => sum + (c.sales || 0), 0));
        const totalSpend = safeNumber(data.topCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0));
        const totalOrders = safeNumber(data.topCampaigns.reduce((sum, c) => sum + (c.orders || 0), 0));

        let totalSales = ppcSales;
        let hasBusinessReport = false;
        if (summary?.businessReport) {
            const brSales = safeNumber(summary.businessReport.totalSales);
            // Business report should generally be >= ppc sales, but we take max to be safe
            totalSales = brSales > ppcSales ? brSales : ppcSales;
            hasBusinessReport = brSales > 0;
        }

        const breakdown = calculateProfit('TOTAL', totalSales, totalSpend, totalOrders);
        breakdown.hasBusinessReport = hasBusinessReport;
        breakdown.ppcSales = ppcSales;

        // Apply global override if set
        if (globalConfig.defaultProfitMarginBeforeAds !== undefined) {
            breakdown.breakEvenAcos = globalConfig.defaultProfitMarginBeforeAds; // Actually break-even TACoS
            breakdown.netProfit = (breakdown.revenue * (globalConfig.defaultProfitMarginBeforeAds / 100)) - breakdown.spend;
            breakdown.netMargin = breakdown.revenue > 0 ? (breakdown.netProfit / breakdown.revenue) * 100 : 0;
            breakdown.acosGap = breakdown.acos - breakdown.breakEvenAcos;
        }

        return breakdown;
    }, [calculateProfit, globalConfig, data, summary]);

    // Simulator Logic
    const simulatedStats = useMemo(() => {
        const revenue = stats.revenue;
        const ppcSales = stats.ppcSales || 0;
        const organicSales = Math.max(0, revenue - ppcSales);

        const marginBeforeAds = globalConfig.defaultProfitMarginBeforeAds || 30;

        // Apply organic increase
        const newOrganicSales = organicSales * (1 + organicIncrease / 100);

        // If priceAdj is +$2, revenue increases if volume stays same
        const revenueFactor = stats.orders > 0 ? ((ppcSales + organicSales) / stats.orders + priceAdj) / ((ppcSales + organicSales) / stats.orders) : 1;

        // Target TACoS is on total revenue
        const newPpcSales = ppcSales * revenueFactor;
        const newTotalRevenue = newPpcSales + newOrganicSales;
        const newSpend = newTotalRevenue * (targetAcos / 100);

        const newProfit = (newTotalRevenue * (marginBeforeAds / 100)) - newSpend;
        const improvement = stats.netProfit !== 0 ? ((newProfit - stats.netProfit) / Math.abs(stats.netProfit)) * 100 : 0;

        return {
            profit: newProfit,
            improvement,
            newTotalRevenue,
            newOrganicSales
        };
    }, [stats, targetAcos, priceAdj, organicIncrease, globalConfig]);

    // Portfolio Data
    const portfolioBreakdowns = useMemo(() => {
        if (!data || !data.portfolioHierarchy) return [];
        return data.portfolioHierarchy.map(p => {
            const pb = calculateProfit(p.name, p.sales, p.spend, p.orders);
            if (globalConfig.defaultProfitMarginBeforeAds !== undefined) {
                pb.breakEvenAcos = globalConfig.defaultProfitMarginBeforeAds;
                pb.netProfit = (pb.revenue * (globalConfig.defaultProfitMarginBeforeAds / 100)) - pb.spend;
                pb.netMargin = pb.revenue > 0 ? (pb.netProfit / pb.revenue) * 100 : 0;
            }
            return pb;
        }).sort((a, b) => b.netProfit - a.netProfit);
    }, [data, calculateProfit, globalConfig]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
    );

    const isLoss = stats.netProfit < 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50 flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2.5 rounded-xl border border-emerald-200 shadow-inner">
                        <Calculator className="text-emerald-600 w-7 h-7" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Profit Calculator</h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">Tính lãi ròng thực tế sau tất cả chi phí.</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all active:scale-95"
                >
                    <Settings size={16} />
                    Cài đặt chi phí
                </button>
            </div>

            {/* Profit Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Profit Card */}
                <div className={classNames(
                    "lg:col-span-1 rounded-3xl p-8 border shadow-sm flex flex-col justify-between relative overflow-hidden",
                    isLoss ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
                )}>
                    {/* Background decoration */}
                    <div className="absolute -right-10 -top-10 opacity-10 text-slate-400">
                        <Calculator size={200} />
                    </div>

                    <div className="relative z-10">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Total Revenue</p>
                        <h2 className="text-5xl font-black text-slate-800 tracking-tighter">{safeCurrency(stats.revenue)}</h2>

                        <div className="mt-8 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">Amazon Fees</span>
                                <span className="text-slate-700 font-mono">-{safeCurrency(stats.totalReferralFees)} (15%)</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">COGS</span>
                                <span className="text-slate-700 font-mono">-{safeCurrency(stats.totalCogs)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">FBA Fees</span>
                                <span className="text-slate-700 font-mono">-{safeCurrency(stats.totalFbaFees)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">Ad Spend</span>
                                <span className="text-rose-600 font-mono">-{safeCurrency(stats.totalAdSpend)}</span>
                            </div>
                            <div className="h-px bg-slate-200 my-4"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-base font-black text-slate-800">NET PROFIT</span>
                                <span className={classNames("text-2xl font-black", isLoss ? "text-rose-600" : "text-emerald-600")}>
                                    {safeCurrency(stats.netProfit)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">MARGIN</span>
                                <span className={classNames("text-lg font-black", isLoss ? "text-rose-600" : "text-emerald-600")}>
                                    {safePercent(stats.netMargin)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Warning/Success Banner */}
                    <div className={classNames(
                        "mt-8 p-4 rounded-2xl border flex gap-3",
                        isLoss ? "bg-rose-100/50 border-rose-200" : "bg-emerald-100/50 border-emerald-200"
                    )}>
                        {isLoss ? <AlertTriangle className="text-rose-600 shrink-0" /> : <CheckCircle className="text-emerald-600 shrink-0" />}
                        <p className="text-xs font-medium text-slate-700 leading-relaxed">
                            {isLoss ? (
                                <>Bạn đang lỗ <strong>${Math.abs(stats.netProfit).toLocaleString()}</strong>. Break-even TACoS = {stats.breakEvenAcos.toFixed(1)}%. Cần giảm ít nhất {stats.acosGap.toFixed(1)}pp.</>
                            ) : (
                                <>Lãi ròng <strong>${stats.netProfit.toLocaleString()}</strong>. {stats.hasBusinessReport ? "Based on real Total Revenue!" : "Break-even TACoS reached."}</>
                            )}
                        </p>
                    </div>
                </div>

                {/* Waterfall / Breakdown Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <BarChart3 className="text-blue-500" />
                            Revenue Breakdown
                        </h3>
                    </div>

                    <div className="flex-1 min-h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: 'Revenue', val: stats.revenue, fill: '#10b981' },
                                    { name: 'Fees', val: -stats.totalReferralFees, fill: '#64748b' },
                                    { name: 'COGS', val: -stats.totalCogs, fill: '#94a3b8' },
                                    { name: 'FBA', val: -stats.totalFbaFees, fill: '#cbd5e1' },
                                    { name: 'Ad Spend', val: -stats.totalAdSpend, fill: '#f43f5e' },
                                    { name: 'Net Profit', val: stats.netProfit, fill: stats.netProfit > 0 ? '#10b981' : '#f43f5e' },
                                ]}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Break-even & Sliders Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Break-even Cards */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <TrendingUp size={18} className="text-amber-500" />
                                Break-even ACOS
                            </h4>
                            <Info size={14} className="text-slate-400" />
                        </div>
                        <div className="text-center py-4">
                            <div className="text-4xl font-black text-slate-800">{stats.breakEvenAcos.toFixed(1)}%</div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Max ACOS to stay profitable</p>
                        </div>
                        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <div
                                className={classNames("h-full transition-all duration-500", stats.acos <= stats.breakEvenAcos ? "bg-emerald-500" : "bg-rose-500")}
                                style={{ width: `${Math.min(100, (stats.acos / (stats.breakEvenAcos || 1)) * 50)}%` }}
                            ></div>
                            <div className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10" style={{ left: '50%' }}></div>
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                            <span>BETTER</span>
                            <span>WORSE</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <DollarSign size={18} className="text-blue-500" />
                                Break-even Sales
                            </h4>
                        </div>
                        <div className="text-center py-4">
                            <div className="text-4xl font-black text-slate-800">${stats.breakEvenSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Revenue needed at current ACOS</p>
                        </div>
                    </div>
                </div>

                {/* Scenario Simulator */}
                <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
                        <Zap size={150} />
                    </div>

                    <h3 className="text-xl font-black mb-8 flex items-center gap-2 tracking-tight">
                        <Zap className="text-amber-400" fill="currentColor" />
                        Scenario Simulator
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 relative z-10">
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-2">
                                    <span className="text-slate-400 uppercase tracking-widest">Target ACOS</span>
                                    <span className="text-amber-400 text-lg">{targetAcos}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={targetAcos}
                                    onChange={(e) => setTargetAcos(Number(e.target.value))}
                                    className="w-full accent-amber-400 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-2">
                                    <span className="text-slate-400 uppercase tracking-widest">Price Adjustment (per unit)</span>
                                    <span className="text-blue-400 text-lg">{priceAdj >= 0 ? '+' : ''}${priceAdj.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-10"
                                    max="20"
                                    step="0.5"
                                    value={priceAdj}
                                    onChange={(e) => setPriceAdj(Number(e.target.value))}
                                    className="w-full accent-blue-400 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Organic Sales Slider */}
                            {stats.hasBusinessReport && (
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-slate-400 uppercase tracking-widest">Organic Sales Change</span>
                                        <span className="text-emerald-400 text-lg">{organicIncrease > 0 ? '+' : ''}{organicIncrease}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-50"
                                        max="100"
                                        step="5"
                                        value={organicIncrease}
                                        onChange={(e) => setOrganicIncrease(Number(e.target.value))}
                                        className="w-full accent-emerald-400 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col justify-center items-center bg-slate-800/50 rounded-2xl p-6 border border-slate-700 backdrop-blur-sm shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Simulated Net Profit</p>
                            <div className={classNames(
                                "text-5xl font-black tracking-tighter",
                                simulatedStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                                ${simulatedStats.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className={classNames(
                                "mt-4 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm",
                                simulatedStats.improvement >= 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            )}>
                                {simulatedStats.improvement >= 0 ? <ArrowUpRight size={16} /> : <TrendingDown size={16} />}
                                {simulatedStats.improvement >= 0 ? '+' : ''}{simulatedStats.improvement.toFixed(1)}% vs Current
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Portfolio Analysis Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Briefcase className="text-blue-500" />
                            Portfolio Profitability
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Phân tích lãi lỗ chi tiết theo từng Portfolio.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Tìm Portfolio..."
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 outline-none w-64"
                            />
                        </div>
                        <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500">
                            <Filter size={16} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Portfolio</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Revenue</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Spend</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">ACOS</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">BE ACOS</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Net Profit</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Margin</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {portfolioBreakdowns.map((pb, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-4 border-b border-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center font-bold text-blue-600 text-[10px]">
                                                {pb.entityName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{pb.entityName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-slate-600 border-b border-slate-50">${pb.revenue.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-slate-500 border-b border-slate-50">${pb.spend.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-right font-mono text-sm font-bold text-slate-700 border-b border-slate-50">{pb.acos.toFixed(1)}%</td>
                                    <td className="px-4 py-4 text-right font-mono text-xs text-slate-400 border-b border-slate-50">{pb.breakEvenAcos.toFixed(0)}%</td>
                                    <td className={classNames(
                                        "px-4 py-4 text-right font-mono text-sm font-black border-b border-slate-50",
                                        pb.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        ${pb.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-4 py-4 text-right border-b border-slate-50">
                                        <div className={classNames(
                                            "inline-block px-2 py-1 rounded-lg text-[10px] font-black",
                                            pb.netMargin >= 10 ? "bg-emerald-100 text-emerald-700" :
                                                pb.netMargin >= 0 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                                        )}>
                                            {pb.netMargin.toFixed(1)}%
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 border-b border-slate-50">
                                        {pb.netProfit >= 0 ? (
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase">
                                                <CheckCircle size={12} strokeWidth={3} /> PROFITABLE
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 uppercase">
                                                <AlertTriangle size={12} strokeWidth={3} /> BLEEDING
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-8 py-4 bg-slate-50/50 flex justify-between items-center">
                    <p className="text-xs text-slate-400 font-medium">Showing {portfolioBreakdowns.length} portfolios based on bulk data.</p>
                    <button className="text-xs font-black text-blue-600 flex items-center gap-1 hover:gap-2 transition-all">
                        Xem tất cả ASIN <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            <CostSettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};

export default ProfitCalculator;
