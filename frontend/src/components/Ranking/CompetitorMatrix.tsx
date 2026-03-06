import React, { useMemo, useState } from 'react';
import { Plus, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

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

interface CompetitorMatrixProps {
    data: MarketDataRow[];
    competitors: string[];
    viewMode: 'table' | 'heatmap';
    myAsin?: string;
    hiddenAsins?: string[];
}

export const CompetitorMatrix: React.FC<CompetitorMatrixProps> = ({
    data,
    competitors,
    viewMode,
    myAsin,
    hiddenAsins = []
}) => {
    const visibleCompetitors = competitors.filter(c => !hiddenAsins.includes(c));

    // Sort competitors to put myAsin first if it's visible
    const sortedVisibleCompetitors = useMemo(() => {
        if (!myAsin || !visibleCompetitors.includes(myAsin)) return visibleCompetitors;
        return [myAsin, ...visibleCompetitors.filter(c => c !== myAsin)];
    }, [visibleCompetitors, myAsin]);

    const [sortConfig, setSortConfig] = useState<{ key: keyof MarketDataRow | string, direction: 'asc' | 'desc' | null }>({
        key: 'relevancyScore',
        direction: 'desc'
    });

    const sortedData = useMemo(() => {
        if (!sortConfig.direction) return data;

        return [...data].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'top10') {
                aValue = a.competitorCount.top10;
                bValue = b.competitorCount.top10;
            } else if (sortConfig.key === 'top30') {
                aValue = a.competitorCount.top30;
                bValue = b.competitorCount.top30;
            } else if (competitors.includes(sortConfig.key as string)) {
                aValue = a.competitorRanks[sortConfig.key as string] ?? 999;
                bValue = b.competitorRanks[sortConfig.key as string] ?? 999;
            } else {
                aValue = a[sortConfig.key as keyof MarketDataRow];
                bValue = b[sortConfig.key as keyof MarketDataRow];
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig, competitors]);

    const requestSort = (key: keyof MarketDataRow | string) => {
        let direction: 'asc' | 'desc' | null = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={10} className="ml-1 opacity-20 group-hover:opacity-50" />;
        if (sortConfig.direction === 'asc') return <ArrowUp size={10} className="ml-1 text-blue-500" />;
        if (sortConfig.direction === 'desc') return <ArrowDown size={10} className="ml-1 text-blue-500" />;
        return <ArrowUpDown size={10} className="ml-1 opacity-20" />;
    };

    const handleAddToListingPlan = async (keyword: string) => {
        try {
            const asin = prompt('Enter ASIN to add this keyword to Listing Plan:', myAsin || '');
            if (!asin) return;

            const response = await fetch(`${API_BASE_URL}/api/products`);
            const products = await response.json();
            const product = products.find((p: any) => p.asin === asin);

            if (!product) {
                alert(`Product with ASIN ${asin} not found in My ASIN list.`);
                return;
            }

            const currentPlan = product.listingPlan ? product.listingPlan.split(',').map((k: string) => k.trim()) : [];
            if (currentPlan.includes(keyword)) {
                alert(`Keyword "${keyword}" is already in the Listing Plan for ${asin}.`);
                return;
            }

            product.listingPlan = [...currentPlan, keyword].join(', ');

            const saveResponse = await fetch(`${API_BASE_URL}/api/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            if (saveResponse.ok) {
                alert(`✅ Added "${keyword}" to Listing Plan for ${asin}!`);
            } else {
                alert('❌ Failed to update Listing Plan.');
            }
        } catch (err) {
            console.error(err);
            alert('Error adding to listing plan');
        }
    };

    const handleTrackKeyword = async (keyword: string, searchVolume?: number) => {
        try {
            const asin = prompt('Enter ASIN to track this keyword for:', myAsin || '');
            if (!asin) return;

            const response = await fetch(`${API_BASE_URL}/api/ranking/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asin, keyword, searchVolume })
            });

            const res = await response.json();
            if (res.success) {
                alert(`✅ Added "${keyword}" to Rank Organic tracking!`);
            } else {
                alert(`❌ Failed: ${res.error}`);
            }
        } catch (err) {
            console.error(err);
            alert('Error tracking keyword');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 relative">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="sticky top-0 bg-white z-40 shadow-sm">
                        <tr className="bg-slate-50 border-b border-slate-200 text-[9px] text-slate-500 uppercase tracking-wider">
                            <th
                                className="p-2 font-semibold w-56 sticky left-0 bg-slate-50 z-50 border-r border-slate-200 cursor-pointer group"
                                onClick={() => requestSort('keyword')}
                            >
                                <div className="flex items-center">Keyword <SortIcon columnKey="keyword" /></div>
                            </th>
                            <th
                                className="p-1.5 font-semibold w-16 text-right border-r border-slate-200 cursor-pointer group"
                                onClick={() => requestSort('searchVolume')}
                            >
                                <div className="flex items-center justify-end">SV <SortIcon columnKey="searchVolume" /></div>
                            </th>
                            <th
                                className="p-1.5 font-semibold w-16 text-right border-r border-slate-200 cursor-pointer group"
                                onClick={() => requestSort('competingProducts')}
                            >
                                <div className="flex items-center justify-end">Comp <SortIcon columnKey="competingProducts" /></div>
                            </th>
                            <th
                                className="p-1.5 font-semibold w-20 text-center border-r border-slate-200 cursor-pointer group group-hover:bg-slate-100"
                                onClick={() => requestSort('opportunityScore')}
                                title="Opportunity Score: higher is better"
                            >
                                <div className="flex items-center justify-center">Opp <SortIcon columnKey="opportunityScore" /></div>
                            </th>
                            <th
                                className="p-1.5 font-semibold w-28 text-center border-r border-slate-200 cursor-pointer group"
                                onClick={() => requestSort('relevancyScore')}
                                title="Competitors in Top 30 (MKL Relevancy)"
                            >
                                <div className="flex items-center justify-center relative group">
                                    Relevancy <SortIcon columnKey="relevancyScore" />
                                </div>
                            </th>
                            <th
                                className="p-1.5 font-semibold w-24 text-center border-r border-slate-200 cursor-pointer group"
                                onClick={() => requestSort('top30')}
                                title="Competitors in Top 10 / Total analyzed"
                            >
                                <div className="flex items-center justify-center">Count <SortIcon columnKey="top30" /></div>
                            </th>

                            {/* ASIN Headers */}
                            {sortedVisibleCompetitors.map(asin => {
                                const isMyAsin = asin === myAsin;
                                return (
                                    <th
                                        key={asin}
                                        className={`p-1.5 font-semibold text-center w-20 min-w-[5rem] cursor-pointer group transition-colors relative
                                            ${isMyAsin ? 'bg-amber-50/50 border-t-2 border-t-amber-500' : ''}`}
                                        onClick={() => requestSort(asin)}
                                    >
                                        <div className="flex flex-col items-center">
                                            {isMyAsin && <span className="text-[7px] font-black text-amber-600 mb-0.5">MY ASIN</span>}
                                            <div className="group/popover relative">
                                                <a
                                                    href={`https://www.amazon.com/dp/${asin}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`hover:text-amber-600 transition-colors ${isMyAsin ? 'text-amber-700 font-bold' : ''}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {asin.substring(0, 8)}..
                                                </a>

                                                {/* Tooltip on hover */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 p-3 hidden group-hover/popover:block z-50 opacity-0 group-hover/popover:opacity-100 transition-opacity">
                                                    <div className="text-left">
                                                        <p className="font-bold text-slate-800 text-xs mb-1">{asin}</p>
                                                        <a href={`https://www.amazon.com/dp/${asin}`} target="_blank" className="text-[10px] text-blue-500 hover:underline">View on Amazon ↗</a>
                                                    </div>
                                                </div>
                                            </div>
                                            <SortIcon columnKey={asin} />
                                        </div>
                                    </th>
                                );
                            })}
                            <th className="p-1.5 font-semibold w-12 text-center sticky right-0 bg-slate-50 z-50 border-l border-slate-200">
                                +
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                        {sortedData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                {/* Keyword Context */}
                                <td className="p-2 sticky left-0 bg-white group-hover:bg-slate-50/80 z-30 border-r border-slate-100 font-medium text-slate-700">
                                    <div className="flex items-center space-x-1.5">
                                        <div className="truncate w-44" title={row.keyword}>{row.keyword}</div>
                                        <a
                                            href={`https://www.amazon.com/s?k=${encodeURIComponent(row.keyword)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-300 hover:text-blue-500 transition-colors flex-shrink-0"
                                            title="Search on Amazon"
                                        >
                                            <ExternalLink size={11} />
                                        </a>
                                    </div>
                                </td>

                                {/* Search Volume */}
                                <td className="p-1.5 text-right text-slate-600 border-r border-slate-100">
                                    {row.searchVolume.toLocaleString()}
                                </td>

                                {/* Competing Products */}
                                <td className="p-1.5 text-right text-slate-500 border-r border-slate-100 italic font-mono text-[10px]">
                                    {row.competingProducts > 0 ? row.competingProducts.toLocaleString() : '-'}
                                </td>

                                {/* Opportunity Score (Dot Rating) */}
                                <td className="p-1.5 text-center border-r border-slate-100 cursor-help" title={`Raw Score: ${row.opportunityScore}`}>
                                    <OppScoreDots score={row.opportunityScore} />
                                </td>

                                {/* Relevancy Score */}
                                <td className="p-1.5 text-center border-r border-slate-100 cursor-help relative group/badge">
                                    <RelevancyBadge score={row.relevancyScore} />
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-slate-800 text-white text-[9px] p-1.5 rounded opacity-0 invisible group-hover/badge:opacity-100 group-hover/badge:visible transition-all z-50 pointer-events-none text-center">
                                        Level {row.relevancyScore}/10
                                    </div>
                                </td>

                                {/* Competitor Count (Progress Bar) */}
                                <td className="p-1.5 text-center border-r border-slate-100" title={`${row.competitorCount.top10} competitors rank Top 10 out of ${competitors.length} total analyzed`}>
                                    <CompCountProgressBar top10={row.competitorCount.top10} total={competitors.length} />
                                </td>

                                {/* Competitor Rank Cells */}
                                {sortedVisibleCompetitors.map(asin => {
                                    const isMyAsin = asin === myAsin;
                                    return (
                                        <td
                                            key={asin}
                                            className={`p-0 text-center border-r border-slate-100 ${isMyAsin ? 'bg-amber-50/30' : ''}`}
                                        >
                                            <HeatmapRankCell
                                                rank={row.competitorRanks[asin]}
                                                viewMode={viewMode}
                                                keyword={row.keyword}
                                                asin={asin}
                                                isMyAsin={isMyAsin}
                                            />
                                        </td>
                                    );
                                })}

                                {/* Action Buttons */}
                                <td className="p-1 text-center sticky right-0 bg-white group-hover:bg-slate-50/80 z-30 border-l border-slate-100">
                                    <div className="flex items-center justify-center space-x-1">
                                        <button
                                            onClick={() => handleAddToListingPlan(row.keyword)}
                                            className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded transition-all"
                                            title="Add to Listing Plan"
                                        >
                                            <FileText size={12} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => handleTrackKeyword(row.keyword, row.searchVolume)}
                                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded transition-all"
                                            title="Add to Rank Organic tracking"
                                        >
                                            <Plus size={12} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Subcomponents ---

const OppScoreDots = ({ score }: { score: number }) => {
    // Determine 1-5 rating based on raw score distribution (heuristic logic)
    // 0-10: 1 dot, 11-50: 2 dots, 51-100: 3 dots, 101-200: 4 dots, 201+: 5 dots
    let dots = 0;
    if (score >= 200) dots = 5;
    else if (score >= 100) dots = 4;
    else if (score >= 50) dots = 3;
    else if (score >= 10) dots = 2;
    else if (score > 0) dots = 1;

    return (
        <div className="flex items-center justify-center space-x-0.5 text-blue-500">
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`text-[14px] leading-none ${i <= dots ? 'text-blue-500' : 'text-slate-200'}`}>
                    ●
                </span>
            ))}
        </div>
    );
};

const RelevancyBadge = ({ score }: { score: number }) => {
    let bgClass = 'bg-slate-100 text-slate-500 border border-slate-200';
    let label = 'Low';
    let icon = '❄️';

    if (score >= 8) {
        bgClass = 'bg-red-100 text-red-700 font-bold border border-red-200';
        label = 'Hot';
        icon = '🔥';
    } else if (score >= 6) {
        bgClass = 'bg-orange-100 text-orange-700 font-bold border border-orange-200';
        label = 'Battleground';
        icon = '⚔️';
    } else if (score >= 4) {
        bgClass = 'bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200';
        label = 'Opportunity';
        icon = '🎯';
    } else if (score >= 1) {
        bgClass = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
        label = 'Seed';
        icon = '🌱';
    }

    return (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${bgClass} whitespace-nowrap flex items-center justify-center space-x-1`}>
            <span>{score}</span>
            <span className="text-[8px] mx-0.5">•</span>
            <span>{icon} {label}</span>
        </span>
    );
};

const CompCountProgressBar = ({ top10, total }: { top10: number, total: number }) => {
    // Prevents division by zero
    const max = Math.max(total, 1);
    const percentage = Math.round((Math.min(top10, max) / max) * 100);

    let colorClass = 'bg-slate-300';
    if (top10 >= 3) colorClass = 'bg-emerald-500';
    else if (top10 >= 1) colorClass = 'bg-blue-500';

    return (
        <div className="flex flex-col items-center justify-center space-y-1 px-1">
            <span className="text-[9px] font-medium text-slate-600">{top10}/{total}</span>
            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                    className={`h-full ${colorClass} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const HeatmapRankCell = ({
    rank,
    viewMode,
    keyword,
    asin,
    isMyAsin
}: {
    rank: number | null,
    viewMode: 'table' | 'heatmap',
    keyword: string,
    asin: string,
    isMyAsin: boolean
}) => {
    if (rank === null || rank === 0) {
        return (
            <div className={`w-full h-full min-h-[40px] flex flex-col items-center justify-center ${viewMode === 'heatmap' ? 'bg-slate-50/50' : ''}`}>
                <span className="text-slate-200">-</span>
            </div>
        );
    }

    // Uniform rank colors
    let bgHex = ''; // For Heatmap background
    let bgClass = 'bg-slate-50 text-slate-500 border border-slate-200'; // For Table badge
    let isBadge = true;

    if (rank <= 3) {
        bgHex = '#065f46'; // emerald-800
        bgClass = 'bg-emerald-800 text-white font-bold ring-2 ring-emerald-200 shadow-sm';
    } else if (rank <= 10) {
        bgHex = '#22c55e'; // emerald-500
        bgClass = 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-100 shadow-sm';
    } else if (rank <= 20) {
        bgHex = '#eab308'; // yellow-500
        bgClass = 'bg-yellow-400 text-yellow-900 font-bold';
    } else if (rank <= 50) {
        bgHex = '#f97316'; // orange-500
        bgClass = 'bg-orange-400 text-white font-semibold';
    } else {
        bgHex = '#fca5a5'; // red-300
        bgClass = 'text-slate-400 bg-transparent';
        isBadge = false;
    }

    // Outer highlight for My ASIN
    const outerRingClass = isMyAsin && isBadge ? 'ring-2 ring-offset-1 ring-amber-400' : '';

    if (viewMode === 'heatmap') {
        // Heatmap cell
        return (
            <div
                className={`w-full h-full min-h-[40px] flex flex-col items-center justify-center text-white text-[11px] font-medium cursor-help ${isMyAsin ? 'border-l-2 border-l-amber-500 box-border' : ''}`}
                style={{ backgroundColor: bgHex }}
                title={`${keyword} — ${asin}: Rank #${rank}`}
            >
                {rank}
            </div>
        );
    }

    // Table Mode
    return (
        <div className="w-full h-full min-h-[40px] flex items-center justify-center py-1">
            {isBadge ? (
                <div
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] ${bgClass} ${outerRingClass} transition-transform hover:scale-110 cursor-help`}
                    title={`Rank #${rank}`}
                >
                    {rank}
                </div>
            ) : (
                <span className={`text-[10px] font-medium ${bgClass}`}>{rank}</span>
            )}
        </div>
    );
};
