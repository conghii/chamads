import React, { useMemo } from 'react';
import { X, AlertTriangle, Download, ArrowRight, TrendingDown, Percent } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { TopCampaign } from '../../types/analysis';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    campaigns: TopCampaign[]; // Pass in data.topCampaigns
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatPercent = (val: number) => `${val.toFixed(1)}%`;

export const WastedSpendPanel: React.FC<Props> = ({ isOpen, onClose, campaigns }) => {
    const TARGET_ACOS = 30; // Could be passed as prop

    // Process campaigns: either keyword-level waste or campaign-level
    const analyzedData = useMemo(() => {
        if (!campaigns) return { items: [], summary: { totalWasted: 0, bleedingCount: 0, bleedingWaste: 0, highAcosCount: 0, highAcosWaste: 0 } };

        let totalWasted = 0;
        let bleedingCount = 0;
        let bleedingWaste = 0;
        let highAcosCount = 0;
        let highAcosWaste = 0;

        const items: any[] = [];

        campaigns.forEach(c => {
            let cWaste = 0;
            let cReasons: string[] = [];
            let isBleeding = false;
            let isHighAcos = false;

            // If we have keyword data, calculate from that for richer insight
            if (c.keywords && c.keywords.length > 0) {
                c.keywords.forEach(kw => {
                    if (kw.acos > TARGET_ACOS) {
                        cWaste += kw.spend;
                        if (!cReasons.includes('High ACOS Targets')) cReasons.push('High ACOS Targets');
                        isHighAcos = true;
                    } else if (kw.orders === 0 && kw.spend > 15) {
                        cWaste += kw.spend;
                        if (!cReasons.includes('Bleeding Targets ($15+ no sales)')) cReasons.push('Bleeding Targets ($15+ no sales)');
                        isBleeding = true;
                    }
                });
            } else {
                // Campaign level fallback
                if (c.acos > TARGET_ACOS) {
                    cWaste = c.spend;
                    cReasons.push('Campaign ACOS > Target');
                    isHighAcos = true;
                } else if (c.orders === 0 && c.spend > 15) {
                    cWaste = c.spend;
                    cReasons.push('Bleeding Campaign');
                    isBleeding = true;
                }
            }

            if (cWaste > 0) {
                totalWasted += cWaste;
                if (isBleeding) {
                    bleedingCount++;
                    bleedingWaste += cWaste;
                } else if (isHighAcos) {
                    highAcosCount++;
                    highAcosWaste += cWaste;
                }

                items.push({
                    campaign: c.name,
                    portfolio: c.portfolioName || 'No Portfolio',
                    spend: c.spend,
                    sales: c.sales,
                    waste: cWaste,
                    orders: c.orders,
                    acos: c.acos,
                    reasons: cReasons
                });
            }
        });

        return {
            items: items.sort((a, b) => b.waste - a.waste).slice(0, 20), // Top 20
            summary: { totalWasted, bleedingCount, bleedingWaste, highAcosCount, highAcosWaste }
        };
    }, [campaigns]);

    const pieData = useMemo(() => [
        { name: 'Bleeding', value: analyzedData.summary.bleedingWaste, color: '#ef4444' }, // Red
        { name: 'High ACOS', value: analyzedData.summary.highAcosWaste, color: '#f59e0b' } // Amber
    ].filter(d => d.value > 0), [analyzedData]);

    const handleExport = () => {
        // Simple CSV export logic
        const headers = ['Campaign', 'Portfolio', 'Spend', 'Sales', 'Waste', 'Orders', 'ACOS', 'Issue'];
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(',') + '\n'
            + analyzedData.items.map(d => `"${d.campaign}","${d.portfolio}",${d.spend},${d.sales},${d.waste},${d.orders},${d.acos},"${d.reasons.join(', ')}"`).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "wasted_spend_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Wasted Spend Breakdown</h2>
                            <p className="text-sm text-gray-500">Top 20 campaigns draining budget with little or no return.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-6">
                    {analyzedData.summary.totalWasted > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Wasted</p>
                                    <p className="text-2xl font-black text-gray-800">{formatCurrency(analyzedData.summary.totalWasted)}</p>
                                </div>
                                <div className="p-3 bg-red-100/50 rounded-full text-red-600">
                                    <TrendingDown size={24} />
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bleeding Campaigns</p>
                                    <p className="text-2xl font-black text-red-600">{analyzedData.summary.bleedingCount}</p>
                                    <p className="text-xs text-red-500 font-medium mt-1">{formatCurrency(analyzedData.summary.bleedingWaste)} wasted</p>
                                </div>
                                <div className="h-16 w-16">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={20} outerRadius={30} dataKey="value" stroke="none">
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val))} contentStyle={{ fontSize: '10px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">High ACOS Campaigns</p>
                                    <p className="text-2xl font-black text-amber-600">{analyzedData.summary.highAcosCount}</p>
                                    <p className="text-xs text-amber-500 font-medium mt-1">{formatCurrency(analyzedData.summary.highAcosWaste)} loss</p>
                                </div>
                                <div className="p-3 bg-amber-100/50 rounded-full text-amber-600">
                                    <Percent size={24} />
                                </div>
                            </div>
                        </div>
                    )}

                    {analyzedData.items.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No wasted spend detected. Great job!
                        </div>
                    ) : (
                        <div className="bg-white border text-left border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Campaign</th>
                                        <th className="px-4 py-3 text-left">Portfolio</th>
                                        <th className="px-4 py-3 text-right">Spend</th>
                                        <th className="px-4 py-3 text-right">Sales</th>
                                        <th className="px-4 py-3 text-right">ACOS</th>
                                        <th className="px-4 py-3 text-right text-red-600">Waste $</th>
                                        <th className="px-4 py-3 text-left">Suggested Fix</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {analyzedData.items.map((d, i) => {
                                        const isBleeding = d.sales === 0;
                                        return (
                                            <tr key={i} className={`hover:bg-red-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate" title={d.campaign}>
                                                    {d.campaign}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[120px]" title={d.portfolio}>
                                                    {d.portfolio}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-600">{formatCurrency(d.spend)}</td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-600">{formatCurrency(d.sales)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-700">
                                                    {d.sales > 0 ? formatPercent(d.acos) : '∞'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-red-600 bg-red-50/50">
                                                    {formatCurrency(d.waste)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div>
                                                            {d.reasons.map((r: string, idx: number) => (
                                                                <span key={idx} className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-sm whitespace-nowrap mr-1 ${r.includes('Bleeding') ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                    {r.includes('Bleeding') ? 'BLEEDING' : 'ACOS > 100%'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="text-[10px] text-gray-600 font-medium">
                                                            {isBleeding ? "Pause hoặc review keywords" : "Giảm bids 20% các targets đắt"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View Campaign Details">
                                                        <ArrowRight size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};
