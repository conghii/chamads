import React, { useState } from 'react';
import {
    Search, TrendingUp, TrendingDown, Trophy, Target, Hash, Columns, X,
    ChevronDown, Loader2, Play
} from 'lucide-react';
import type { RankType, TrendFilter, RankRange, SVRange } from '../../pages/RankingPage';

interface SummaryData {
    total: number;
    top10: number;
    top10Delta: number;
    top50: number;
    biggestGainer: { keyword: string; delta: number };
    biggestLoser: { keyword: string; delta: number };
}

interface RankingHeaderProps {
    selectedAsin: string;
    onAsinChange: (asin: string) => void;
    availableAsins: string[];
    rankType: RankType;
    onRankTypeChange: (type: RankType) => void;
    dateRange: 7 | 14 | 30;
    onDateRangeChange: (range: 7 | 14 | 30) => void;
    summary: SummaryData;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    rankRange: RankRange;
    onRankRangeChange: (range: RankRange) => void;
    trendFilter: TrendFilter;
    onTrendFilterChange: (filter: TrendFilter) => void;
    svRange: SVRange;
    onSvRangeChange: (range: SVRange) => void;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
    filteredCount: number;
    totalCount: number;
    visibleColumns: Record<string, boolean>;
    onVisibleColumnsChange: (cols: any) => void;
}

// Run Tool button
const RunToolButton = () => {
    const [running, setRunning] = useState(false);
    const handleRun = async () => {
        if (!confirm('Bắt đầu quét xếp hạng Amazon? Quá trình chạy ngầm và có thể mất vài phút.')) return;
        setRunning(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/ranking/run-tool`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
            alert('✅ Ranking tool đã bắt đầu chạy ngầm.');
        } catch { alert('❌ Lỗi khi khởi chạy tool.'); }
        finally { setRunning(false); }
    };
    return (
        <button onClick={handleRun} disabled={running}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${running ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'}`}>
            {running ? <><Loader2 size={12} className="animate-spin" /> Running...</> : <><Play size={12} /> Run Tool</>}
        </button>
    );
};

export const RankingHeader: React.FC<RankingHeaderProps> = (props) => {
    const {
        selectedAsin, onAsinChange, availableAsins, rankType, onRankTypeChange,
        dateRange, onDateRangeChange, summary,
        searchTerm, onSearchChange, rankRange, onRankRangeChange,
        trendFilter, onTrendFilterChange, svRange, onSvRangeChange,
        hasActiveFilters, onClearFilters, filteredCount, totalCount,
        visibleColumns, onVisibleColumnsChange
    } = props;

    const [showColDropdown, setShowColDropdown] = useState(false);

    return (
        <div className="bg-white border-b border-slate-200 shrink-0">
            {/* Top Bar */}
            <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-slate-800">Ranking Tracker</h1>
                    {/* ASIN Selector */}
                    <select value={selectedAsin} onChange={e => onAsinChange(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400">
                        {availableAsins.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <RunToolButton />
                    {/* Date Range */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                        {([7, 14, 30] as const).map(d => (
                            <button key={d} onClick={() => onDateRangeChange(d)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${dateRange === d ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {d}D
                            </button>
                        ))}
                    </div>
                    {/* Rank Type */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                        {(['ORGANIC', 'SPONSORED', 'BOTH'] as const).map(t => (
                            <button key={t} onClick={() => onRankTypeChange(t)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${rankType === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {t === 'ORGANIC' ? 'Org' : t === 'SPONSORED' ? 'Spn' : 'Both'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="px-5 pb-3 grid grid-cols-5 gap-3">
                <SummaryCard label="Tổng Keywords" value={summary.total} icon={Hash} color="blue" />
                <SummaryCard label="Top 10" value={summary.top10} icon={Trophy} color="emerald"
                    badge={summary.top10Delta !== 0 ? `${summary.top10Delta > 0 ? '↑' : '↓'}${Math.abs(summary.top10Delta)} so với hôm qua` : undefined}
                    badgeColor={summary.top10Delta > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'} />
                <SummaryCard label="Top 50" value={summary.top50} icon={Target} color="blue" />
                <SummaryCard label="Tăng mạnh nhất" value={summary.biggestGainer.delta > 0 ? `↑${summary.biggestGainer.delta}` : '-'} icon={TrendingUp} color="emerald"
                    subtext={summary.biggestGainer.delta > 0 ? truncate(summary.biggestGainer.keyword, 25) : undefined} />
                <SummaryCard label="Giảm mạnh nhất" value={summary.biggestLoser.delta < 0 ? `↓${Math.abs(summary.biggestLoser.delta)}` : '-'} icon={TrendingDown} color="red"
                    subtext={summary.biggestLoser.delta < 0 ? truncate(summary.biggestLoser.keyword, 25) : undefined} />
            </div>

            {/* Filter Toolbar */}
            <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 max-w-[240px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Tìm keyword..."
                        value={searchTerm} onChange={e => onSearchChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white" />
                </div>

                {/* Rank Range */}
                <FilterSelect value={rankRange} onChange={v => onRankRangeChange(v as RankRange)}
                    options={[
                        ['ALL', 'Tất cả Rank'], ['TOP_10', 'Top 10'], ['TOP_50', 'Top 50'],
                        ['51_100', '51-100'], ['100+', '100+'], ['UNRANKED', 'Chưa có rank']
                    ]} />

                {/* Trend */}
                <FilterSelect value={trendFilter} onChange={v => onTrendFilterChange(v as TrendFilter)}
                    options={[
                        ['ALL', 'Tất cả Trend'], ['RISING', 'Đang tăng ↑'], ['FALLING', 'Đang giảm ↓'],
                        ['NEW', 'Mới xuất hiện'], ['STABLE', 'Ổn định']
                    ]} />

                {/* SV Range */}
                <FilterSelect value={svRange} onChange={v => onSvRangeChange(v as SVRange)}
                    options={[
                        ['ALL', 'Tất cả SV'], ['GT_10K', '> 10,000'], ['1K_10K', '1,000 - 10,000'], ['LT_1K', '< 1,000']
                    ]} />

                {/* Column Toggle */}
                <div className="relative">
                    <button onClick={() => setShowColDropdown(!showColDropdown)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100">
                        <Columns size={12} /> Cột <ChevronDown size={10} />
                    </button>
                    {showColDropdown && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowColDropdown(false)} />
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 space-y-1">
                                {[
                                    { key: 'trend', label: 'Trend (sparkline)' },
                                    { key: 'sv', label: 'Search Volume' },
                                    { key: 'sp', label: 'Sponsored Position' },
                                    { key: 'bestRank', label: 'Rank tốt nhất' },
                                    { key: 'avgRank', label: 'Rank TB (7 ngày)' },
                                    { key: 'daysTop10', label: 'Số ngày Top 10' },
                                ].map(col => (
                                    <label key={col.key} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer">
                                        <input type="checkbox" checked={(visibleColumns as any)[col.key]}
                                            onChange={e => onVisibleColumnsChange({ ...visibleColumns, [col.key]: e.target.checked })}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Clear Filters + Count */}
                <div className="flex items-center gap-2 ml-auto">
                    {hasActiveFilters && (
                        <button onClick={onClearFilters}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded-lg transition">
                            <X size={12} /> Xóa bộ lọc
                        </button>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium">{filteredCount} / {totalCount} keywords</span>
                </div>
            </div>
        </div>
    );
};

// Small reusable components
const SummaryCard = ({ label, value, icon: Icon, color, badge, badgeColor, subtext }: any) => {
    const colorMap: any = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        red: 'bg-red-50 text-red-600',
    };
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between">
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-bold text-slate-800">{value}</span>
                    {badge && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>{badge}</span>}
                </div>
                {subtext && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtext}</p>}
            </div>
            <div className={`p-1.5 rounded-lg shrink-0 ${colorMap[color] || 'bg-slate-100 text-slate-500'}`}>
                <Icon size={16} />
            </div>
        </div>
    );
};

const FilterSelect = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium">
        {options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
    </select>
);

function truncate(str: string, len: number) {
    return str.length > len ? str.slice(0, len) + '...' : str;
}
