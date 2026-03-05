import React, { useState, useEffect, useMemo } from 'react';
import { RankingHeader } from '../components/Ranking/RankingHeader';
import { RankingMatrix } from '../components/Ranking/RankingMatrix';
import { KeywordChart } from '../components/Ranking/KeywordChart';
import { TableProperties, LineChart as LineChartIcon } from 'lucide-react';

// Types
export interface KeywordRanking {
    keyword: string;
    asin: string;
    searchVolume: number;
    organicRank: number | null;
    sponsoredRank: number | null;
    history: { date: string; organic: number | null; sponsored: number | null }[];
}

export type RankType = 'ORGANIC' | 'SPONSORED' | 'BOTH';
export type SortField = 'keyword' | 'sv' | 'sp' | 'trend' | string; // string for dynamic date columns
export type SortDir = 'asc' | 'desc';
export type TrendFilter = 'ALL' | 'RISING' | 'FALLING' | 'NEW' | 'STABLE';
export type RankRange = 'ALL' | 'TOP_10' | 'TOP_50' | '51_100' | '100+' | 'UNRANKED';
export type SVRange = 'ALL' | 'GT_10K' | '1K_10K' | 'LT_1K';

// Fix encoding issues (e.g. "home d◆◆cor" → "home décor")
function fixEncoding(text: string): string {
    if (!text) return text;
    return text
        // Diamond replacement chars (common mojibake)
        .replace(/d[◆�]{1,2}cor/gi, 'décor')
        .replace(/◆◆/g, 'é')
        .replace(/\uFFFD\uFFFD/g, 'é')
        .replace(/\uFFFD/g, 'é')
        // UTF-8 double-encoding patterns
        .replace(/Ã©/g, 'é')
        .replace(/Ã¨/g, 'è')
        .replace(/Ã¢/g, 'â')
        .replace(/Ã®/g, 'î')
        .replace(/â€™/g, "'")
        .replace(/â€"/g, '—')
        .replace(/â€œ/g, '"')
        .replace(/â€\u009d/g, '"');
}

const RankingPage: React.FC = () => {
    // Core Data State
    const [selectedAsin, setSelectedAsin] = useState<string>('ALL');
    const [rankType, setRankType] = useState<RankType>('ORGANIC');
    const [dateRange, setDateRange] = useState<7 | 14 | 30>(30);
    const [rankingData, setRankingData] = useState<KeywordRanking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Sort & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [rankRange, setRankRange] = useState<RankRange>('ALL');
    const [trendFilter, setTrendFilter] = useState<TrendFilter>('ALL');
    const [svRange, setSvRange] = useState<SVRange>('ALL');
    const [sortField, setSortField] = useState<SortField>('sv');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // UI State
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [visibleColumns, setVisibleColumns] = useState({
        trend: true, sv: true, sp: true,
        bestRank: false, avgRank: false, daysTop10: false
    });

    // View mode: table or chart
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

    useEffect(() => { fetchRankingData(); }, []);

    const fetchRankingData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ranking`);
            let data = await response.json();
            if (!data || data.length === 0) data = [];

            // Fix encoding on keywords
            data = data.map((item: KeywordRanking) => ({
                ...item,
                keyword: fixEncoding(item.keyword)
            }));

            setRankingData(data);
        } catch (error) {
            console.error('Error fetching ranking data:', error);
            setRankingData([]);
        } finally {
            setLoading(false);
        }
    };

    // Derived: unique ASINs
    const uniqueAsins = useMemo(() =>
        Array.from(new Set(rankingData.map(r => r.asin))).filter(a => a && a !== 'Unknown'),
        [rankingData]
    );

    // Auto-select first ASIN
    useEffect(() => {
        if ((selectedAsin === 'ALL' || !selectedAsin) && uniqueAsins.length > 0) {
            setSelectedAsin(uniqueAsins[0]);
        }
    }, [uniqueAsins, selectedAsin]);

    // Derived: sorted dates (newest first)
    const dates = useMemo(() => {
        const uniqueDates = new Set<string>();
        rankingData.forEach(row => {
            if (row.history) row.history.forEach((h: any) => uniqueDates.add(h.date));
        });
        let sorted = Array.from(uniqueDates);
        sorted.sort((a, b) => {
            const [d1, m1] = a.split('/').map(Number);
            const [d2, m2] = b.split('/').map(Number);
            if (m1 !== m2) return m2 - m1;
            return d2 - d1;
        });
        return sorted.slice(0, dateRange);
    }, [rankingData, dateRange]);

    // Helper: get trend data for a keyword
    const getTrend = (item: KeywordRanking) => {
        if (!item.history || item.history.length === 0) return { direction: 'stable' as const, delta: 0, isNew: false };

        const relevantHistory = dates.map(d => item.history.find((h: any) => h.date === d)?.organic).filter(r => r != null) as number[];
        if (relevantHistory.length === 0) return { direction: 'stable' as const, delta: 0, isNew: false };
        if (relevantHistory.length === 1) return { direction: 'stable' as const, delta: 0, isNew: true };

        const newest = relevantHistory[0];
        const oldest = relevantHistory[relevantHistory.length - 1];
        const delta = oldest - newest; // positive means improved
        const direction = delta > 0 ? 'rising' as const : delta < 0 ? 'falling' as const : 'stable' as const;

        // Check if "new" (only newest date has data, older dates don't)
        const isNew = relevantHistory.length === 1;

        return { direction, delta, isNew };
    };

    // Filter data
    const filteredData = useMemo(() => {
        return rankingData.filter(item => {
            // ASIN filter
            if (selectedAsin !== 'ALL' && item.asin !== selectedAsin) return false;

            // Search filter
            if (searchTerm && !item.keyword.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            // Rank range filter
            const rank = item.organicRank;
            if (rankRange === 'TOP_10' && (!rank || rank > 10)) return false;
            if (rankRange === 'TOP_50' && (!rank || rank > 50)) return false;
            if (rankRange === '51_100' && (!rank || rank <= 50 || rank > 100)) return false;
            if (rankRange === '100+' && (!rank || rank <= 100)) return false;
            if (rankRange === 'UNRANKED' && rank !== null && rank <= 150) return false;

            // SV range filter
            const sv = item.searchVolume || 0;
            if (svRange === 'GT_10K' && sv < 10000) return false;
            if (svRange === '1K_10K' && (sv < 1000 || sv >= 10000)) return false;
            if (svRange === 'LT_1K' && sv >= 1000) return false;

            // Trend filter
            if (trendFilter !== 'ALL') {
                const trend = getTrend(item);
                if (trendFilter === 'RISING' && trend.direction !== 'rising') return false;
                if (trendFilter === 'FALLING' && trend.direction !== 'falling') return false;
                if (trendFilter === 'NEW' && !trend.isNew) return false;
                if (trendFilter === 'STABLE' && trend.direction !== 'stable') return false;
            }

            return true;
        });
    }, [rankingData, selectedAsin, searchTerm, rankRange, trendFilter, svRange, dates]);

    // Sort data
    const sortedData = useMemo(() => {
        const sorted = [...filteredData];
        sorted.sort((a, b) => {
            let valA: any, valB: any;

            if (sortField === 'keyword') {
                valA = a.keyword.toLowerCase();
                valB = b.keyword.toLowerCase();
            } else if (sortField === 'sv') {
                valA = a.searchVolume || 0;
                valB = b.searchVolume || 0;
            } else if (sortField === 'sp') {
                valA = a.sponsoredRank || 999;
                valB = b.sponsoredRank || 999;
            } else if (sortField === 'trend') {
                valA = getTrend(a).delta;
                valB = getTrend(b).delta;
            } else {
                // Date column sort
                const histA = a.history?.find((h: any) => h.date === sortField);
                const histB = b.history?.find((h: any) => h.date === sortField);
                valA = histA?.organic || 999;
                valB = histB?.organic || 999;
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredData, sortField, sortDir, dates]);

    // Enhanced Summary KPIs
    const summary = useMemo(() => {
        const total = filteredData.length;
        const top10 = filteredData.filter(k => k.organicRank && k.organicRank <= 10).length;
        const top50 = filteredData.filter(k => k.organicRank && k.organicRank <= 50).length;

        // Top 10 delta vs yesterday
        let top10Yesterday = 0;
        if (dates.length >= 2) {
            const yesterdayDate = dates[1]; // second newest
            top10Yesterday = filteredData.filter(k => {
                const hist = k.history?.find((h: any) => h.date === yesterdayDate);
                return hist?.organic && hist.organic <= 10;
            }).length;
        }
        const top10Delta = top10 - top10Yesterday;

        // Biggest gainer & loser
        let biggestGainer = { keyword: '-', delta: 0 };
        let biggestLoser = { keyword: '-', delta: 0 };

        filteredData.forEach(item => {
            const trend = getTrend(item);
            if (trend.delta > biggestGainer.delta) {
                biggestGainer = { keyword: item.keyword, delta: trend.delta };
            }
            if (trend.delta < biggestLoser.delta) {
                biggestLoser = { keyword: item.keyword, delta: trend.delta };
            }
        });

        return { total, top10, top10Delta, top50, biggestGainer, biggestLoser };
    }, [filteredData, dates]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(field === 'keyword' ? 'asc' : 'desc');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setRankRange('ALL');
        setTrendFilter('ALL');
        setSvRange('ALL');
    };

    const hasActiveFilters = searchTerm || rankRange !== 'ALL' || trendFilter !== 'ALL' || svRange !== 'ALL';

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                <RankingHeader
                    selectedAsin={selectedAsin}
                    onAsinChange={setSelectedAsin}
                    availableAsins={uniqueAsins}
                    rankType={rankType}
                    onRankTypeChange={setRankType}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    summary={summary}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    rankRange={rankRange}
                    onRankRangeChange={setRankRange}
                    trendFilter={trendFilter}
                    onTrendFilterChange={setTrendFilter}
                    svRange={svRange}
                    onSvRangeChange={setSvRange}
                    hasActiveFilters={!!hasActiveFilters}
                    onClearFilters={clearFilters}
                    filteredCount={filteredData.length}
                    totalCount={rankingData.filter(i => selectedAsin === 'ALL' || i.asin === selectedAsin).length}
                    visibleColumns={visibleColumns}
                    onVisibleColumnsChange={setVisibleColumns}
                />

                {/* View Mode Tabs */}
                <div className="bg-white border-b border-slate-200 px-5 flex items-center gap-1">
                    <button onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${viewMode === 'table' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <TableProperties size={14} /> Bảng
                    </button>
                    <button onClick={() => setViewMode('chart')}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${viewMode === 'chart' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <LineChartIcon size={14} /> Biểu đồ
                    </button>
                </div>

                <main className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-slate-500">Loading ranking data...</div>
                        </div>
                    ) : viewMode === 'table' ? (
                        <RankingMatrix
                            data={sortedData}
                            dates={dates}
                            rankType={rankType}
                            sortField={sortField}
                            sortDir={sortDir}
                            onSort={handleSort}
                            expandedRow={expandedRow}
                            onExpandRow={setExpandedRow}
                            visibleColumns={visibleColumns}
                            getTrend={getTrend}
                        />
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <KeywordChart data={sortedData} dates={dates} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default RankingPage;
