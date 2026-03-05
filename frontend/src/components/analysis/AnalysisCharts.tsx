import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { TopCampaign } from '../../types/analysis';
import { BarChart3, PieChart } from 'lucide-react';

interface Props {
    campaigns: TopCampaign[];
    onBinClick?: (min: number, max: number, name: string) => void;
}

export const AnalysisCharts: React.FC<Props> = ({ campaigns, onBinClick }) => {
    const [chartView, setChartView] = useState<'portfolio' | 'acos'>('portfolio');
    const [topN, setTopN] = useState<number | 'ALL'>(15);
    const [sortMode, setSortMode] = useState<'sales' | 'spend' | 'acos'>('sales');

    // Portfolio Data
    const portfolioData = useMemo(() => {
        const pMap = new Map<string, { name: string; spend: number; sales: number }>();

        campaigns.forEach(c => {
            const pName = c.portfolioName || 'No Portfolio';
            if (!pMap.has(pName)) {
                pMap.set(pName, { name: pName, spend: 0, sales: 0 });
            }
            const p = pMap.get(pName)!;
            p.spend += c.spend;
            p.sales += c.sales;
        });

        let pArray = Array.from(pMap.values());

        // Sorting
        pArray.sort((a, b) => {
            if (sortMode === 'spend') return b.spend - a.spend;
            if (sortMode === 'acos') {
                const aAcos = a.sales > 0 ? a.spend / a.sales : Infinity;
                const bAcos = b.sales > 0 ? b.spend / b.sales : Infinity;
                return bAcos - aAcos; // Descending ACOS
            }
            return b.sales - a.sales; // Default to sales desc
        });

        if (topN !== 'ALL') {
            pArray = pArray.slice(0, topN);
        }

        return pArray;
    }, [campaigns, topN, sortMode]);

    // ACOS Distribution Data
    const acosDistribution = useMemo(() => {
        const bins = [
            { name: '0-15%', min: 0, max: 15, count: 0, color: '#22c55e' }, // Green
            { name: '15-30%', min: 15, max: 30, count: 0, color: '#3b82f6' }, // Blue
            { name: '30-50%', min: 30, max: 50, count: 0, color: '#f59e0b' }, // Yellow
            { name: '50-100%', min: 50, max: 100, count: 0, color: '#f97316' }, // Orange
            { name: '100%+', min: 100, max: Infinity, count: 0, color: '#ef4444' } // Red
        ];

        // Need to count campaigns with spend > 0 to have meaningful ACOS
        campaigns.forEach(c => {
            if (c.spend > 0) {
                const acos = c.sales > 0 ? (c.spend / c.sales) * 100 : Infinity;
                const bin = bins.find(b => acos >= b.min && acos < b.max) || bins[bins.length - 1];
                bin.count++;
            }
        });

        return bins;
    }, [campaigns]);

    const formatMoney = (val: number) => `$${val.toLocaleString()}`;

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Performance Visualizer</h3>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                    {chartView === 'portfolio' && (
                        <div className="flex gap-2">
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value as any)}
                                className="text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="sales">Sort: By Sales</option>
                                <option value="spend">Sort: By Spend</option>
                                <option value="acos">Sort: By ACOS</option>
                            </select>
                            <select
                                value={topN.toString()}
                                onChange={(e) => setTopN(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className="text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="10">Top 10</option>
                                <option value="15">Top 15</option>
                                <option value="20">Top 20</option>
                                <option value="50">Top 50</option>
                                <option value="ALL">All Portfolios</option>
                            </select>
                        </div>
                    )}
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setChartView('portfolio')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${chartView === 'portfolio' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <BarChart3 size={14} />
                            Portfolios
                        </button>
                        <button
                            onClick={() => setChartView('acos')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${chartView === 'acos' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <PieChart size={14} />
                            ACOS Dist.
                        </button>
                    </div>
                </div>
            </div>

            <div className={`w-full transition-all ${chartView === 'portfolio' && topN === 'ALL' ? 'h-[800px]' : chartView === 'portfolio' && topN !== 'ALL' && topN > 20 ? 'h-[600px]' : 'h-[280px]'}`}>
                {chartView === 'portfolio' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={portfolioData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                            <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10, fill: '#6B7280' }} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 10, fill: '#374151' }}
                                width={120}
                            />
                            <Tooltip
                                formatter={(value: any) => formatMoney(value)}
                                cursor={{ fill: '#F3F4F6' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#4B5563' }} />
                            <Bar dataKey="sales" name="Sales" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={topN === 'ALL' ? 6 : topN > 20 ? 6 : 12} />
                            <Bar dataKey="spend" name="Spend" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={topN === 'ALL' ? 6 : topN > 20 ? 6 : 12}>
                                <LabelList
                                    dataKey="spend"
                                    content={(props: any) => {
                                        const { x, y, width, height, index } = props;
                                        const p = portfolioData[index];
                                        if (!p) return null;

                                        let labelText = '';
                                        if (p.sales > 0) {
                                            const acos = (p.spend / p.sales) * 100;
                                            labelText = `${acos.toFixed(1)}%`;
                                        } else if (p.spend > 0) {
                                            labelText = '∞';
                                        }

                                        return (
                                            <text
                                                x={x + width + 5}
                                                y={y + height / 2}
                                                fill="#6B7280"
                                                fontSize={10}
                                                fontWeight={500}
                                                alignmentBaseline="middle"
                                            >
                                                {labelText}
                                            </text>
                                        );
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={acosDistribution}
                                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#F3F4F6' }}
                                        formatter={(value: any) => [`${value} Campaigns`, 'Count']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="count"
                                        name="Campaigns"
                                        radius={[4, 4, 0, 0]}
                                        barSize={60}
                                        label={{ position: 'top', fill: '#6B7280', fontSize: 11, fontWeight: 700 }}
                                        cursor="pointer"
                                        onClick={(data: any) => onBinClick?.(data.min, data.max, data.name)}
                                    >
                                        {acosDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 text-center text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-200 py-2 rounded-lg">
                            <span className="inline-flex items-center gap-1 mx-3 text-green-600">
                                🟢 {acosDistribution[0].count + acosDistribution[1].count} profitable (&lt;30% ACOS)
                            </span>
                            <span className="inline-flex items-center gap-1 mx-3 text-amber-500">
                                🟡 {acosDistribution[2].count} warning (30-50% ACOS)
                            </span>
                            <span className="inline-flex items-center gap-1 mx-3 text-red-500">
                                🔴 {acosDistribution[3].count + acosDistribution[4].count} bleeding (&gt;50% ACOS)
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
