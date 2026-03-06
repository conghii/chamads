import React, { useMemo } from 'react';
import type { KeywordRanking, RankType, SortField, SortDir } from '../../pages/RankingPage';
import { Plus, Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface RankingMatrixProps {
    data: KeywordRanking[];
    dates: string[];
    rankType: RankType;
    sortField: SortField;
    sortDir: SortDir;
    onSort: (field: SortField) => void;
    expandedRow: string | null;
    onExpandRow: (key: string | null) => void;
    visibleColumns: Record<string, boolean>;
    getTrend: (item: KeywordRanking) => { direction: 'rising' | 'falling' | 'stable'; delta: number; isNew: boolean };
}

// ─── Sparkline SVG ───
const Sparkline = ({ history, dates }: { history: any[]; dates: string[] }) => {
    const W = 100, H = 28, PAD = 2;

    const points = useMemo(() => {
        return dates.slice().reverse().map(d => {
            const h = history?.find((x: any) => x.date === d);
            return { date: d, rank: h?.organic ?? null };
        }).filter(p => p.rank !== null) as { date: string; rank: number }[];
    }, [history, dates]);

    if (points.length < 2) {
        return <div className="w-[100px] h-[28px] flex items-center justify-center text-slate-300 text-[9px]">—</div>;
    }

    const ranks = points.map(p => p.rank);
    const maxR = Math.max(...ranks, 1);
    const minR = Math.min(...ranks, 1);
    const range = Math.max(maxR - minR, 1);

    // Invert Y: rank 1 = top
    const pts = points.map((p, i) => {
        const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
        const y = PAD + ((p.rank - minR) / range) * (H - PAD * 2); // lower rank = higher on chart (rank 1 at top)
        return { x, y, ...p };
    });

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Color: green if newest rank < oldest rank (improved), red if worse
    const newest = points[points.length - 1].rank;
    const oldest = points[0].rank;
    const color = newest < oldest ? '#22c55e' : newest > oldest ? '#ef4444' : '#94a3b8';

    return (
        <svg width={W} height={H} className="block">
            <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} opacity="0.6">
                    <title>{`${p.date}: #${p.rank}`}</title>
                </circle>
            ))}
        </svg>
    );
};

// ─── Rank Cell ───
const RankCell = ({ rank, delta, prevRank, type }: {
    rank: number | null; delta: number; prevRank: number | null; type: 'org' | 'spn'
}) => {
    // Empty cell (no data)
    if (!rank || rank > 150) {
        return <div className="w-full flex-1 flex items-center justify-center min-h-[28px]" />;
    }

    // Badge styling
    let bgClass = 'bg-slate-100 text-slate-600';
    let textClass = 'text-[10px] font-medium';
    let icon = '';

    if (rank <= 3) {
        bgClass = type === 'org' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white';
        textClass = 'text-[10px] font-bold';
        if (rank === 1) icon = '🏆';
    } else if (rank <= 10) {
        bgClass = type === 'org' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800';
        textClass = 'text-[10px] font-semibold';
    } else if (rank <= 50) {
        bgClass = 'bg-slate-100 text-slate-700';
    } else {
        bgClass = '';
        textClass = 'text-[10px] text-slate-400';
    }

    // Delta display
    const isNew = prevRank === null && rank !== null;

    return (
        <div className={`w-full flex-1 rounded flex flex-col items-center justify-center min-h-[28px] ${bgClass}`}>
            <span className={textClass}>
                {icon}{type === 'spn' ? 'Ad ' : ''}{rank}
            </span>
            {isNew ? (
                <span className="text-[7px] font-bold text-violet-500 bg-violet-100 px-1 rounded mt-0.5">NEW</span>
            ) : delta !== 0 ? (
                <span className={`text-[8px] font-bold leading-none mt-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                </span>
            ) : null}
        </div>
    );
};

// ─── Expanded Row Detail ───
const ExpandedDetail = ({ item, dates }: { item: KeywordRanking; dates: string[] }) => {
    // Build chart data (reversed: oldest left → newest right)
    const chartDates = [...dates].reverse();
    const chartData = chartDates.map(d => {
        const h = item.history?.find((x: any) => x.date === d);
        return { date: d, rank: h?.organic ?? null };
    });
    const validData = chartData.filter(d => d.rank !== null) as { date: string; rank: number }[];

    const W = 800, H = 120, PAD = 30;

    let svgContent = null;
    if (validData.length >= 2) {
        const ranks = validData.map(p => p.rank);
        const maxR = Math.max(...ranks, 1);
        const minR = Math.min(...ranks, 1);
        const range = Math.max(maxR - minR, 1);

        const pts = validData.map((p, i) => ({
            x: PAD + (i / (validData.length - 1)) * (W - PAD * 2),
            y: PAD + ((p.rank - minR) / range) * (H - PAD * 2),
            ...p
        }));

        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const color = '#6366f1';

        svgContent = (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[150px]" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(t => {
                    const y = PAD + t * (H - PAD * 2);
                    const label = Math.round(minR + t * range);
                    return (
                        <g key={t}>
                            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
                            <text x={PAD - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">#{label}</text>
                        </g>
                    );
                })}
                <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                    <g key={i}>
                        <circle cx={p.x} cy={p.y} r="3" fill="white" stroke={color} strokeWidth="1.5" />
                        <title>{`${p.date}: #${p.rank}`}</title>
                    </g>
                ))}
                {/* Date labels */}
                {pts.filter((_, i) => i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1).map((p, i) => (
                    <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">{p.date}</text>
                ))}
            </svg>
        );
    }

    return (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-3">
            {/* Chart */}
            <div className="bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600">Lịch sử xếp hạng: {item.keyword}</span>
                    <a href={`https://www.amazon.com/s?k=${encodeURIComponent(item.keyword)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800">
                        <ExternalLink size={10} /> Xem trên Amazon
                    </a>
                </div>
                {svgContent || <p className="text-xs text-slate-400 text-center py-6">Chưa đủ dữ liệu để vẽ biểu đồ</p>}
            </div>

            {/* History Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Ngày</th>
                            <th className="text-center px-3 py-1.5 font-semibold text-slate-500">Rank</th>
                            <th className="text-center px-3 py-1.5 font-semibold text-slate-500">Thay đổi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dates.map((date, i) => {
                            const h = item.history?.find((x: any) => x.date === date);
                            const prevH = i < dates.length - 1 ? item.history?.find((x: any) => x.date === dates[i + 1]) : null;
                            const delta = (h?.organic && prevH?.organic) ? prevH.organic - h.organic : 0;
                            return (
                                <tr key={date} className="border-t border-slate-100">
                                    <td className="px-3 py-1.5 text-slate-600">{date}</td>
                                    <td className="px-3 py-1.5 text-center font-medium">{h?.organic || '-'}</td>
                                    <td className={`px-3 py-1.5 text-center font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                        {delta !== 0 ? `${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}` : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Sortable Header ───
const SortHeader = ({ label, field, sortField, sortDir, onSort, className = '', align = 'left' }: {
    label: string; field: SortField; sortField: SortField; sortDir: SortDir;
    onSort: (f: SortField) => void; className?: string; align?: string;
}) => {
    const isActive = sortField === field;
    return (
        <div onClick={() => onSort(field)}
            className={`cursor-pointer select-none flex items-center gap-0.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''} ${className}`}>
            <span className={`text-[9px] font-bold uppercase tracking-wide ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>{label}</span>
            {isActive && <span className="text-[9px] text-blue-600">{sortDir === 'asc' ? '▲' : '▼'}</span>}
        </div>
    );
};

// ─── Main Matrix ───
export const RankingMatrix: React.FC<RankingMatrixProps> = ({
    data, dates, rankType, sortField, sortDir, onSort, expandedRow, onExpandRow, visibleColumns
}) => {
    // Track keyword handler
    const handleTrackKeyword = async (asin: string, keyword: string, sv?: number, ads?: number | null) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/ranking/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asin, keyword, searchVolume: sv, ads })
            });
            const result = await res.json();
            if (result.success) alert(`✅ Tracked: ${keyword}`);
            else alert(`❌ ${result.error}`);
        } catch { alert('Error tracking keyword'); }
    };

    // Compute extra column data
    const getExtraCols = (item: KeywordRanking) => {
        const organicRanks = dates.map(d => item.history?.find((h: any) => h.date === d)?.organic).filter(r => r != null) as number[];
        const bestRank = organicRanks.length > 0 ? Math.min(...organicRanks) : null;
        const avgRank = organicRanks.length > 0 ? Math.round(organicRanks.reduce((a, b) => a + b, 0) / organicRanks.length) : null;
        const daysTop10 = organicRanks.filter(r => r <= 10).length;
        return { bestRank, avgRank, daysTop10 };
    };

    // Sticky column offsets
    const KEYWORD_W = 220;
    const TREND_W = visibleColumns.trend ? 110 : 0;
    const SV_W = visibleColumns.sv ? 65 : 0;
    const SP_W = visibleColumns.sp ? 45 : 0;
    const BEST_W = visibleColumns.bestRank ? 50 : 0;
    const AVG_W = visibleColumns.avgRank ? 50 : 0;
    const DAYS_W = visibleColumns.daysTop10 ? 55 : 0;

    let stickyLeft = KEYWORD_W;
    const trendLeft = stickyLeft; stickyLeft += TREND_W;
    const svLeft = stickyLeft; stickyLeft += SV_W;
    const spLeft = stickyLeft; stickyLeft += SP_W;
    const bestLeft = stickyLeft; stickyLeft += BEST_W;
    const avgLeft = stickyLeft; stickyLeft += AVG_W;
    const daysLeft = stickyLeft; stickyLeft += DAYS_W;

    const stickyHeaderCl = 'sticky z-40 shrink-0 p-1 bg-slate-50 border-r border-slate-200';
    const stickyCellCl = 'sticky z-10 shrink-0 py-1 px-1.5 border-r border-slate-200 transition-colors';

    return (
        <div className="h-full overflow-auto bg-slate-50">
            {/* ─── Header Row ─── */}
            <div className="sticky top-0 z-30 flex bg-white border-b border-slate-200 shadow-sm w-max min-w-full">
                {/* Keyword Header */}
                <div className={`${stickyHeaderCl} left-0`} style={{ width: KEYWORD_W, minWidth: KEYWORD_W }}>
                    <SortHeader label="Keyword" field="keyword" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                </div>

                {/* Trend Header */}
                {visibleColumns.trend && (
                    <div className={`${stickyHeaderCl}`} style={{ left: trendLeft, width: TREND_W, minWidth: TREND_W }}>
                        <SortHeader label="Trend" field="trend" sortField={sortField} sortDir={sortDir} onSort={onSort} className="justify-center" align="center" />
                    </div>
                )}

                {/* SV Header */}
                {visibleColumns.sv && (
                    <div className={`${stickyHeaderCl}`} style={{ left: svLeft, width: SV_W, minWidth: SV_W }}>
                        <SortHeader label="SV" field="sv" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
                    </div>
                )}

                {/* SP Header */}
                {visibleColumns.sp && (
                    <div className={`${stickyHeaderCl}`} style={{ left: spLeft, width: SP_W, minWidth: SP_W }}>
                        <SortHeader label="SP" field="sp" sortField={sortField} sortDir={sortDir} onSort={onSort} align="center" />
                    </div>
                )}

                {/* Extra columns */}
                {visibleColumns.bestRank && (
                    <div className={`${stickyHeaderCl}`} style={{ left: bestLeft, width: BEST_W, minWidth: BEST_W }}>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Best</span>
                    </div>
                )}
                {visibleColumns.avgRank && (
                    <div className={`${stickyHeaderCl}`} style={{ left: avgLeft, width: AVG_W, minWidth: AVG_W }}>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Avg</span>
                    </div>
                )}
                {visibleColumns.daysTop10 && (
                    <div className={`${stickyHeaderCl}`} style={{ left: daysLeft, width: DAYS_W, minWidth: DAYS_W }}>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Top10d</span>
                    </div>
                )}

                {/* Date headers */}
                <div className="flex">
                    {dates.map(date => (
                        <div key={date} onClick={() => onSort(date)}
                            className="w-12 min-w-[48px] flex flex-col items-center justify-center border-r border-slate-100 bg-white py-1 cursor-pointer hover:bg-blue-50 transition">
                            <span className={`text-[10px] font-medium ${sortField === date ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                                {date}
                            </span>
                            {sortField === date && <span className="text-[8px] text-blue-600">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Matrix Body ─── */}
            <div className="w-max min-w-full pb-10">
                {data.map((item, idx) => {
                    const rowKey = `${item.keyword}-${item.asin}`;
                    const isExpanded = expandedRow === rowKey;
                    const extras = getExtraCols(item);
                    const isOdd = idx % 2 === 1;
                    const rowBg = isOdd ? 'bg-slate-50/50' : 'bg-white';

                    return (
                        <React.Fragment key={rowKey}>
                            <div
                                onClick={() => onExpandRow(isExpanded ? null : rowKey)}
                                className={`flex ${rowBg} hover:bg-blue-50/50 transition-colors border-b border-slate-100 group w-full cursor-pointer`}
                            >
                                {/* Keyword Cell */}
                                <div className={`${stickyCellCl} left-0 ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50`}
                                    style={{ width: KEYWORD_W, minWidth: KEYWORD_W }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className={`text-[8px] ${isExpanded ? 'text-blue-500' : 'text-slate-300'}`}>
                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </span>
                                            <span className="text-[11px] font-medium text-slate-700 truncate" title={item.keyword}>
                                                {item.keyword}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <a href={`https://www.amazon.com/s?k=${encodeURIComponent(item.keyword)}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="p-0.5 hover:bg-slate-200 text-slate-300 hover:text-slate-600 rounded"
                                                title="Search on Amazon"
                                                onClick={e => e.stopPropagation()}>
                                                <Search size={10} />
                                            </a>
                                            <button
                                                className="p-0.5 hover:bg-blue-100 text-slate-300 hover:text-blue-600 rounded"
                                                title="Track"
                                                onClick={e => { e.stopPropagation(); handleTrackKeyword(item.asin, item.keyword, item.searchVolume, item.sponsoredRank); }}>
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Trend Cell */}
                                {visibleColumns.trend && (
                                    <div className={`${stickyCellCl} ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50 flex items-center justify-center`}
                                        style={{ left: trendLeft, width: TREND_W, minWidth: TREND_W }}>
                                        <Sparkline history={item.history || []} dates={dates} />
                                    </div>
                                )}

                                {/* SV Cell */}
                                {visibleColumns.sv && (
                                    <div className={`${stickyCellCl} ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50 flex items-center justify-end`}
                                        style={{ left: svLeft, width: SV_W, minWidth: SV_W }}>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {item.searchVolume ? item.searchVolume.toLocaleString() : ''}
                                        </span>
                                    </div>
                                )}

                                {/* SP Cell */}
                                {visibleColumns.sp && (
                                    <div className={`${stickyCellCl} ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50 flex items-center justify-center`}
                                        style={{ left: spLeft, width: SP_W, minWidth: SP_W }}>
                                        {item.sponsoredRank ? (
                                            <span className="text-[9px] px-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded font-bold">
                                                #{item.sponsoredRank}
                                            </span>
                                        ) : null}
                                    </div>
                                )}

                                {/* Extra Columns */}
                                {visibleColumns.bestRank && (
                                    <div className={`${stickyCellCl} ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50 flex items-center justify-center`}
                                        style={{ left: bestLeft, width: BEST_W, minWidth: BEST_W }}>
                                        <span className="text-[10px] text-slate-600 font-medium">{extras.bestRank || ''}</span>
                                    </div>
                                )}
                                {visibleColumns.avgRank && (
                                    <div className={`${stickyCellCl} ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50 flex items-center justify-center`}
                                        style={{ left: avgLeft, width: AVG_W, minWidth: AVG_W }}>
                                        <span className="text-[10px] text-slate-600 font-medium">{extras.avgRank || ''}</span>
                                    </div>
                                )}
                                {visibleColumns.daysTop10 && (
                                    <div className={`${stickyCellCl} ${isOdd ? 'bg-slate-50/50' : 'bg-white'} group-hover:bg-blue-50/50 flex items-center justify-center`}
                                        style={{ left: daysLeft, width: DAYS_W, minWidth: DAYS_W }}>
                                        <span className="text-[10px] text-slate-600 font-medium">{extras.daysTop10 > 0 ? extras.daysTop10 : ''}</span>
                                    </div>
                                )}

                                {/* Rank Cells */}
                                <div className="flex">
                                    {dates.map((date, di) => {
                                        const historyItem = item.history?.find((h: any) => h.date === date);
                                        const prevDate = di < dates.length - 1 ? dates[di + 1] : null;
                                        const prevItem = prevDate ? item.history?.find((h: any) => h.date === prevDate) : null;

                                        const orgDelta = (historyItem?.organic && prevItem?.organic) ? prevItem.organic - historyItem.organic : 0;
                                        const spnDelta = (historyItem?.sponsored && prevItem?.sponsored) ? prevItem.sponsored - historyItem.sponsored : 0;

                                        return (
                                            <div key={`${item.keyword}-${date}`} className="w-12 min-w-[48px] border-r border-slate-50 flex flex-col items-center justify-center p-0.5 gap-0.5">
                                                {(rankType === 'ORGANIC' || rankType === 'BOTH') && (
                                                    <RankCell rank={historyItem?.organic || null} delta={orgDelta} prevRank={prevItem?.organic ?? null} type="org" />
                                                )}
                                                {(rankType === 'SPONSORED' || rankType === 'BOTH') && (
                                                    <RankCell rank={historyItem?.sponsored || null} delta={spnDelta} prevRank={prevItem?.sponsored ?? null} type="spn" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {isExpanded && <ExpandedDetail item={item} dates={dates} />}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
