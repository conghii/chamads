import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, ReferenceArea
} from 'recharts';
import type { KeywordRanking } from '../../pages/RankingPage';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// ─── Color Palette ───
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const MAX_SELECTED = 5;

interface KeywordChartProps {
    data: KeywordRanking[];
    dates: string[];
}

// ─── Custom Tooltip ───
const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 text-xs space-y-1">
            <p className="font-semibold text-slate-600 border-b border-slate-100 pb-1">{label}</p>
            {payload.filter((p: any) => p.value != null).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-slate-700 truncate max-w-[180px]">{p.name}</span>
                    <span className="font-bold text-slate-900 ml-auto">#{p.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Stats Table ───
const StatsTable = ({ keywords, dates, colors }: {
    keywords: KeywordRanking[]; dates: string[];
    colors: Record<string, string>;
}) => {
    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2 font-semibold text-slate-500">Keyword</th>
                        <th className="text-center px-3 py-2 font-semibold text-slate-500">Rank hiện tại</th>
                        <th className="text-center px-3 py-2 font-semibold text-slate-500">Rank tốt nhất</th>
                        <th className="text-center px-3 py-2 font-semibold text-slate-500">Rank trung bình</th>
                        <th className="text-center px-3 py-2 font-semibold text-slate-500">Trend 7 ngày</th>
                    </tr>
                </thead>
                <tbody>
                    {keywords.map(kw => {
                        const ranks = dates
                            .map(d => kw.history?.find((h: any) => h.date === d)?.organic)
                            .filter(r => r != null) as number[];

                        const currentRank = ranks.length > 0 ? ranks[0] : null;
                        const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
                        const avgRank = ranks.length > 0 ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length) : null;

                        // Trend: compare newest vs 7 days ago
                        const recent7 = ranks.slice(0, 7);
                        let trend7 = 0;
                        if (recent7.length >= 2) {
                            trend7 = recent7[recent7.length - 1] - recent7[0]; // positive = improved
                        }

                        return (
                            <tr key={kw.keyword} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[kw.keyword] }} />
                                        <span className="font-medium text-slate-700 truncate max-w-[220px]">{kw.keyword}</span>
                                    </div>
                                </td>
                                <td className="text-center px-3 py-2">
                                    {currentRank ? (
                                        <span className={`font-bold ${currentRank <= 10 ? 'text-emerald-600' : currentRank <= 50 ? 'text-slate-700' : 'text-slate-400'}`}>
                                            #{currentRank}
                                        </span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="text-center px-3 py-2">
                                    {bestRank ? (
                                        <span className="font-bold text-emerald-600">#{bestRank}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="text-center px-3 py-2">
                                    {avgRank ? (
                                        <span className="font-medium text-slate-600">#{avgRank}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="text-center px-3 py-2">
                                    {trend7 !== 0 ? (
                                        <span className={`inline-flex items-center gap-0.5 font-bold ${trend7 > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {trend7 > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {trend7 > 0 ? '↑' : '↓'}{Math.abs(trend7)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 inline-flex items-center gap-0.5"><Minus size={12} /> 0</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ─── Main Component ───
export const KeywordChart: React.FC<KeywordChartProps> = ({ data, dates }) => {
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

    // Auto-select top 3 keywords by organic rank on mount
    const allKeywords = useMemo(() => {
        return data.map(d => d.keyword);
    }, [data]);

    // Initialize with top 3 ranked keywords
    React.useEffect(() => {
        if (selectedKeywords.length === 0 && data.length > 0) {
            const sorted = [...data]
                .filter(d => d.organicRank != null)
                .sort((a, b) => (a.organicRank || 999) - (b.organicRank || 999))
                .slice(0, 3);
            setSelectedKeywords(sorted.map(d => d.keyword));
        }
    }, [data]);

    const toggleKeyword = (keyword: string) => {
        setSelectedKeywords(prev => {
            if (prev.includes(keyword)) {
                return prev.filter(k => k !== keyword);
            }
            if (prev.length >= MAX_SELECTED) return prev; // max reached
            return [...prev, keyword];
        });
    };

    // Color mapping for selected keywords
    const colorMap = useMemo(() => {
        const map: Record<string, string> = {};
        selectedKeywords.forEach((kw, i) => {
            map[kw] = COLORS[i % COLORS.length];
        });
        return map;
    }, [selectedKeywords]);

    // Build chart data: [{date, keyword1Rank, keyword2Rank, ...}]
    const chartDates = useMemo(() => [...dates].reverse(), [dates]); // oldest → newest

    const chartData = useMemo(() => {
        return chartDates.map(date => {
            const point: any = { date };
            selectedKeywords.forEach(kw => {
                const item = data.find(d => d.keyword === kw);
                const h = item?.history?.find((h: any) => h.date === date);
                point[kw] = h?.organic ?? null;
            });
            return point;
        });
    }, [chartDates, selectedKeywords, data]);

    // Y-axis domain: find min/max ranks across selected keywords
    const yDomain = useMemo(() => {
        let min = 1, max = 60;
        selectedKeywords.forEach(kw => {
            const item = data.find(d => d.keyword === kw);
            if (item?.history) {
                item.history.forEach((h: any) => {
                    if (h.organic != null) {
                        if (h.organic < min) min = h.organic;
                        if (h.organic > max) max = h.organic;
                    }
                });
            }
        });
        return [Math.max(1, min - 2), Math.min(max + 5, 160)];
    }, [selectedKeywords, data]);

    const selectedData = data.filter(d => selectedKeywords.includes(d.keyword));

    return (
        <div className="space-y-4 p-4">
            {/* ─── Keyword Selector Chips ─── */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chọn Keywords để so sánh</span>
                    <span className="text-[10px] text-slate-400">
                        {selectedKeywords.length}/{MAX_SELECTED} đã chọn
                    </span>
                </div>

                {selectedKeywords.length >= MAX_SELECTED && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                        <span className="text-[10px] text-amber-700">Tối đa {MAX_SELECTED} keywords. Bỏ chọn 1 keyword trước khi thêm mới.</span>
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                    {allKeywords.map(kw => {
                        const isSelected = selectedKeywords.includes(kw);
                        const color = colorMap[kw];
                        const item = data.find(d => d.keyword === kw);
                        const rank = item?.organicRank;

                        return (
                            <button
                                key={kw}
                                onClick={() => toggleKeyword(kw)}
                                disabled={!isSelected && selectedKeywords.length >= MAX_SELECTED}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${isSelected
                                    ? 'border-transparent text-white shadow-sm'
                                    : selectedKeywords.length >= MAX_SELECTED
                                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                    }`}
                                style={isSelected ? { backgroundColor: color } : {}}
                            >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white/60" />}
                                <span className="truncate max-w-[160px]">{kw}</span>
                                {rank && <span className={`text-[9px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>#{rank}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Line Chart ─── */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
                {selectedKeywords.length === 0 ? (
                    <div className="flex items-center justify-center h-[400px] text-slate-400 text-sm">
                        Chọn ít nhất 1 keyword ở trên để hiển thị biểu đồ
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <YAxis
                                reversed
                                domain={yDomain}
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                                tickFormatter={(v: number) => `#${v}`}
                                width={40}
                            />
                            <Tooltip content={<ChartTooltip />} />

                            {/* Top 10 zone (light green background) */}
                            <ReferenceArea y1={1} y2={10} fill="#dcfce7" fillOpacity={0.4} />

                            {/* Milestone lines */}
                            <ReferenceLine
                                y={10}
                                stroke="#22c55e"
                                strokeDasharray="6 3"
                                strokeWidth={1}
                                label={{ value: 'Top 10', position: 'right', fontSize: 10, fill: '#22c55e', fontWeight: 600 }}
                            />
                            <ReferenceLine
                                y={50}
                                stroke="#f59e0b"
                                strokeDasharray="6 3"
                                strokeWidth={1}
                                label={{ value: 'Top 50', position: 'right', fontSize: 10, fill: '#f59e0b', fontWeight: 600 }}
                            />

                            {/* Keyword lines */}
                            {selectedKeywords.map(kw => (
                                <Line
                                    key={kw}
                                    type="monotone"
                                    dataKey={kw}
                                    stroke={colorMap[kw]}
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: colorMap[kw], strokeWidth: 0 }}
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                                    connectNulls
                                    name={kw}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ─── Stats Table ─── */}
            {selectedKeywords.length > 0 && (
                <StatsTable keywords={selectedData} dates={dates} colors={colorMap} />
            )}
        </div>
    );
};
