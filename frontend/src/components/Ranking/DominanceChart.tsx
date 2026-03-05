import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface MarketDataRow {
    keyword: string;
    searchVolume: number;
    competingProducts: number;
    cpr: number;
    titleDensity: number;
    competitorRanks: Record<string, number | null>;
    competitorCount: { top10: number, top30: number };
    relevancyScore: number;
    avgCompetitorRank: number;
    opportunityScore: number;
}

interface DominanceChartProps {
    data: MarketDataRow[];
    competitors: string[];
    myAsin?: string;
}

// Consistent colors for chart
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#f43f5e', '#84cc16'];

export const DominanceChart: React.FC<DominanceChartProps> = ({ data, competitors, myAsin }) => {
    const [chartType, setChartType] = useState<'stacked' | 'radar'>('stacked');

    // Sort competitors to ensure myAsin is first and has a consistent color
    const sortedCompetitors = useMemo(() => {
        if (!myAsin) return competitors;
        return [myAsin, ...competitors.filter(c => c !== myAsin)];
    }, [competitors, myAsin]);

    const getAsinColor = (asin: string, index: number) => {
        if (asin === myAsin) return '#f59e0b'; // Amber/Orange for My ASIN
        // Shift index to avoid reusing the amber color for the second competitor
        const colorIndex = index === 0 && asin !== myAsin ? 1 : (asin === myAsin ? 0 : index);
        return COLORS[colorIndex % COLORS.length];
    };

    // Calculate Stacked Data
    const stackedData = useMemo(() => {
        const ranges = [
            { label: '>10K SV', min: 10000, max: Infinity },
            { label: '1K-10K SV', min: 1000, max: 10000 },
            { label: '100-1K SV', min: 100, max: 1000 },
            { label: '<100 SV', min: 0, max: 100 },
        ];

        return ranges.map(range => {
            const rangeData: any = { name: range.label };
            const rowsInRange = data.filter(r => r.searchVolume >= range.min && r.searchVolume < range.max);

            sortedCompetitors.forEach(asin => {
                const top10Count = rowsInRange.filter(r => r.competitorRanks[asin] && r.competitorRanks[asin]! <= 10).length;
                rangeData[asin] = top10Count;
            });
            return rangeData;
        });
    }, [data, sortedCompetitors]);

    // Calculate Radar Data
    const radarData = useMemo(() => {
        // Find top dominator to scale values sensibly if needed, or use absolute values
        // Metrics: Top 10 Kw, Avg Rank (inverted), SV Coverage (x1000), Must-Have Kw
        const metrics = sortedCompetitors.slice(0, 5).map(asin => {
            const top10 = data.filter(r => r.competitorRanks[asin] && r.competitorRanks[asin]! <= 10);
            const ranks = data.map(r => r.competitorRanks[asin]).filter(r => r !== null) as number[];
            const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 100;
            const svCoverage = top10.reduce((a, curr) => a + curr.searchVolume, 0);
            const mustHaveKw = data.filter(r => r.relevancyScore >= 8 && r.competitorRanks[asin] && r.competitorRanks[asin]! <= 10).length;

            return {
                asin,
                top10: top10.length,
                avgRankScore: Math.max(0, 100 - avgRank), // higher is better (inverted rank)
                svCoverageRatio: data.length > 0 ? Math.round((svCoverage / data.reduce((a, c) => a + c.searchVolume, 0)) * 100) : 0,
                mustHaveKw
            };
        });

        // Shape it for Recharts Radar
        return [
            { subject: 'Top 10 Keywords', ...metrics.reduce((acc, curr) => ({ ...acc, [curr.asin]: curr.top10 }), {}) },
            { subject: 'Rank Score', ...metrics.reduce((acc, curr) => ({ ...acc, [curr.asin]: curr.avgRankScore }), {}) },
            { subject: 'SV Share %', ...metrics.reduce((acc, curr) => ({ ...acc, [curr.asin]: curr.svCoverageRatio }), {}) },
            { subject: 'Must-Have KW', ...metrics.reduce((acc, curr) => ({ ...acc, [curr.asin]: curr.mustHaveKw }), {}) },
        ];
    }, [data, sortedCompetitors]);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-3">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Dominance Insight</h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setChartType('stacked')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartType === 'stacked' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Market Distribution
                    </button>
                    <button
                        onClick={() => setChartType('radar')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartType === 'radar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Strength Comparison
                    </button>
                </div>
            </div>

            <div className="h-64 w-full">
                {chartType === 'stacked' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={stackedData}
                            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f8fafc' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            {sortedCompetitors.map((asin, index) => (
                                <Bar
                                    key={asin}
                                    dataKey={asin}
                                    stackId="a"
                                    fill={getAsinColor(asin, index)}
                                    name={asin === myAsin ? `${asin} (My ASIN)` : asin}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #e2e8f0' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            {sortedCompetitors.slice(0, 5).map((asin, index) => (
                                <Radar
                                    key={asin}
                                    name={asin === myAsin ? `${asin} (My ASIN)` : asin}
                                    dataKey={asin}
                                    stroke={getAsinColor(asin, index)}
                                    fill={getAsinColor(asin, index)}
                                    fillOpacity={asin === myAsin ? 0.4 : 0.1}
                                    strokeWidth={asin === myAsin ? 3 : 2}
                                />
                            ))}
                        </RadarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};
