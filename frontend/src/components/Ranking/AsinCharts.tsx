import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface AsinChartsProps {
    keywords: {
        keyword: string;
        searchVolume: number;
        organicRank: number | null;
    }[];
    onFilterRankGroup: (min: number | null, max: number | null) => void;
    onSearchKeyword: (keyword: string) => void;
}

// ─── Colors ───
const RANK_COLORS: Record<string, string> = {
    'Top 3': '#059669',
    '4-10': '#34d399',
    '11-30': '#fbbf24',
    '31-50': '#fb923c',
    '51-100': '#f87171',
    '100+': '#ef4444',
    'No Rank': '#cbd5e1',
};

// ─── Custom Tooltip ───
const DistTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-bold text-slate-700">{d.name}</p>
            <p className="text-slate-500">{d.count} keywords ({d.pct}%)</p>
        </div>
    );
};

const SVTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-bold text-slate-700 truncate max-w-[200px]">{d.keyword}</p>
            <p className="text-slate-500">SV: {d.searchVolume.toLocaleString()}</p>
            <p className="text-slate-500">Rank: {d.organicRank ? `#${d.organicRank}` : 'N/A'}</p>
        </div>
    );
};

export const AsinCharts: React.FC<AsinChartsProps> = ({ keywords, onFilterRankGroup, onSearchKeyword }) => {

    // ─── Rank Distribution Data ───
    const rankGroups = React.useMemo(() => {
        const groups = [
            { name: 'Top 3', min: 1, max: 3, count: 0 },
            { name: '4-10', min: 4, max: 10, count: 0 },
            { name: '11-30', min: 11, max: 30, count: 0 },
            { name: '31-50', min: 31, max: 50, count: 0 },
            { name: '51-100', min: 51, max: 100, count: 0 },
            { name: '100+', min: 101, max: 99999, count: 0 },
            { name: 'No Rank', min: null as number | null, max: null as number | null, count: 0 },
        ];

        keywords.forEach(kw => {
            if (kw.organicRank === null) {
                groups[6].count++;
            } else {
                for (const g of groups) {
                    if (g.min !== null && g.max !== null && kw.organicRank >= g.min && kw.organicRank <= g.max) {
                        g.count++;
                        break;
                    }
                }
            }
        });

        const total = keywords.length || 1;
        return groups.map(g => ({
            ...g,
            pct: Math.round((g.count / total) * 100),
        }));
    }, [keywords]);

    // ─── Top 10 by SV ───
    const topSV = React.useMemo(() => {
        return [...keywords]
            .sort((a, b) => b.searchVolume - a.searchVolume)
            .slice(0, 10)
            .map(kw => ({
                keyword: kw.keyword.length > 28 ? kw.keyword.slice(0, 28) + '…' : kw.keyword,
                fullKeyword: kw.keyword,
                searchVolume: kw.searchVolume,
                organicRank: kw.organicRank,
                isTop10: kw.organicRank !== null && kw.organicRank <= 10,
            }));
    }, [keywords]);

    return (
        <div className="grid grid-cols-2 gap-3">
            {/* ─── Left: Rank Distribution ─── */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Phân bố Rank</p>
                <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={rankGroups} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                            width={52}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<DistTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Bar
                            dataKey="count"
                            radius={[0, 4, 4, 0]}
                            cursor="pointer"
                            onClick={(data: any) => {
                                onFilterRankGroup(data.min, data.max);
                            }}
                        >
                            {rankGroups.map((entry) => (
                                <Cell key={entry.name} fill={RANK_COLORS[entry.name]} />
                            ))}
                            <LabelList
                                dataKey="count"
                                position="right"
                                formatter={(v: any) => v > 0 ? v : ''}
                                style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ─── Right: Top 10 Keywords by SV ─── */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Top 10 Keywords (Search Volume)</p>
                <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={topSV} layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="keyword"
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            width={145}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<SVTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Bar
                            dataKey="searchVolume"
                            radius={[0, 4, 4, 0]}
                            cursor="pointer"
                            onClick={(data: any) => {
                                onSearchKeyword(data.fullKeyword);
                            }}
                        >
                            {topSV.map((entry, i) => (
                                <Cell key={i} fill={entry.isTop10 ? '#22c55e' : '#f59e0b'} />
                            ))}
                            <LabelList
                                dataKey="organicRank"
                                position="right"
                                formatter={(v: any) => v ? `#${v}` : '—'}
                                style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
