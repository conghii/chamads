import React, { useEffect, useState } from 'react';
import { MarketKPIs } from './MarketKPIs';
import { CompetitorMatrix } from './CompetitorMatrix';
import { KeywordClusterSearch } from './KeywordClusterSearch';
import { DominanceChart } from './DominanceChart';
import { Loader2, ChevronDown, ChevronUp, RotateCcw, Rocket, Filter as Filters, LayoutGrid, List } from 'lucide-react';
import { LaunchArchitect } from './LaunchArchitect';

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
    launchCategory: string;
}

interface MarketDominanceData {
    competitors: string[];
    rows: MarketDataRow[];
}

const SEASONAL_KEYWORDS = ['valentine', 'christmas', 'halloween', 'easter', 'thanksgiving', 'new year', 'black friday', 'cyber monday'];

export const MarketDominance: React.FC = () => {
    const [data, setData] = useState<MarketDominanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // View & Context states
    const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('table');
    const [myAsin, setMyAsin] = useState<string>('');
    const [hiddenAsins] = useState<string[]>([]);

    // Filter states
    const [showFilters, setShowFilters] = useState(false);
    const [minCompetitorsT30, setMinCompetitorsT30] = useState(0);
    const [hideSeasonal, setHideSeasonal] = useState(false);
    const [minSearchVolume, setMinSearchVolume] = useState(0);
    const [maxAvgRank, setMaxAvgRank] = useState(100);

    // Cluster states
    const [clusteredData, setClusteredData] = useState<MarketDataRow[] | null>(null);

    // Launch Architect states
    const [isLaunchMode, setIsLaunchMode] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [launchConfig, setLaunchConfig] = useState({ productName: '', topDominator: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${import.meta.env.VITE_API_URL || '${API_BASE_URL}'}/api/ranking/market-dominance`);
            if (!response.ok) throw new Error('Failed to fetch market data');
            const result = await response.json();
            setData(result);
            if (result.competitors && result.competitors.length > 0) {
                // Default to first competitor for demo purposes
                setMyAsin(result.competitors[0]);
            }
        } catch (err: any) {
            setError(err.message || 'Error loading market data');
        } finally {
            setLoading(false);
        }
    };

    const resetFilters = () => {
        setMinCompetitorsT30(0);
        setHideSeasonal(false);
        setMinSearchVolume(0);
        setMaxAvgRank(100);
    };

    // Apply clustering and filters to data
    const filteredData = data ? {
        ...data,
        rows: (clusteredData || data.rows).filter(row => {
            // Filter 1: Min competitors in Top 30 (Relevancy)
            if (row.relevancyScore < minCompetitorsT30) return false;

            // Filter 2: Hide seasonal keywords
            if (hideSeasonal) {
                const lowerKeyword = row.keyword.toLowerCase();
                if (SEASONAL_KEYWORDS.some(seasonal => lowerKeyword.includes(seasonal))) {
                    return false;
                }
            }

            // Filter 3: Min search volume
            if (row.searchVolume < minSearchVolume) return false;

            // Filter 4: Max average rank
            if (row.avgCompetitorRank > 0 && row.avgCompetitorRank > maxAvgRank) return false;

            return true;
        })
    } : null;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-4">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p>Analyzing Market Dominance...</p>
            </div>
        );
    }

    if (error || !data || !filteredData) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-red-500 space-y-4">
                <p>Error: {error}</p>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (isLaunchMode) {
        return (
            <LaunchArchitect
                data={data.rows}
                onClose={() => setIsLaunchMode(false)}
                productName={launchConfig.productName}
                topDominatorAsin={launchConfig.topDominator}
            />
        );
    }

    return (
        <div className="p-4 h-full flex flex-col overflow-hidden bg-slate-50/50">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                    Market Dominance
                    <span className="ml-3 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded uppercase tracking-wide">Beta</span>
                </h1>

                <div className="flex items-center space-x-3">
                    {/* View Mode Toggle */}
                    <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center px-2 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Table View"
                        >
                            <List size={14} className="mr-1" />
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('heatmap')}
                            className={`flex items-center px-2 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'heatmap' ? 'bg-emerald-100 text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Heatmap View"
                        >
                            <LayoutGrid size={14} className="mr-1" />
                            Heatmap
                        </button>
                    </div>

                    {/* My ASIN Selector */}
                    <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-xs font-bold text-slate-600">MY ASIN:</span>
                        <select
                            className="bg-transparent text-xs font-medium text-amber-600 focus:outline-none appearance-none pr-4 cursor-pointer"
                            value={myAsin}
                            onChange={(e) => setMyAsin(e.target.value)}
                        >
                            {data.competitors.map(asin => (
                                <option key={asin} value={asin}>{asin}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowOnboarding(true)}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-100 uppercase"
                    >
                        <Rocket size={14} />
                        <span className="hidden sm:inline">Launch New Product</span>
                    </button>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700 shadow-sm"
                    >
                        <Filters size={14} />
                        <span className="hidden sm:inline">Filters</span>
                        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {(minCompetitorsT30 !== 0 || hideSeasonal || minSearchVolume !== 0 || maxAvgRank !== 100) && (
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        )}
                    </button>
                </div>
            </div>

            {/* Onboarding Modal */}
            {showOnboarding && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 space-y-6">
                            <div className="space-y-2 text-center">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-200">
                                    <Rocket size={32} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase">Start Launch Mission</h2>
                                <p className="text-slate-500 text-xs font-medium">Define your product identity to begin tactical listing construction.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Identity</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Positive Pickle - Handmade - Crochet"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 text-sm"
                                        value={launchConfig.productName}
                                        onChange={(e) => setLaunchConfig({ ...launchConfig, productName: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Competitor (Dominator Source)</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 appearance-none text-sm"
                                        value={launchConfig.topDominator}
                                        onChange={(e) => setLaunchConfig({ ...launchConfig, topDominator: e.target.value })}
                                    >
                                        <option value="">Select Market Leader...</option>
                                        {data?.competitors.map(asin => (
                                            <option key={asin} value={asin}>{asin}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Launching Goal</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="p-3 border-2 border-blue-500 bg-blue-50 rounded-xl text-left transition-all">
                                            <div className="text-[10px] font-black text-blue-700 uppercase mb-0.5 tracking-tight">Rapid Indexing</div>
                                            <div className="text-[9px] text-blue-600/70 font-bold uppercase leading-tight">Max niche coverage</div>
                                        </button>
                                        <button className="p-3 border-2 border-slate-100 bg-slate-50 rounded-xl text-left opacity-40 grayscale transition-all">
                                            <div className="text-[10px] font-black text-slate-700 uppercase mb-0.5 tracking-tight">Main Rank</div>
                                            <div className="text-[9px] text-slate-500/70 font-bold uppercase leading-tight self-start text-left">Focus core volume</div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    onClick={() => setShowOnboarding(false)}
                                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >Cancel</button>
                                <button
                                    onClick={() => {
                                        setShowOnboarding(false);
                                        setIsLaunchMode(true);
                                    }}
                                    disabled={!launchConfig.productName || !launchConfig.topDominator}
                                    className="flex-[2] px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200"
                                >Deploy Architect</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyword Cluster Search */}
            <div className="mb-3">
                <KeywordClusterSearch
                    data={data.rows}
                    onCluster={(cluster) => setClusteredData(cluster)}
                    onClear={() => setClusteredData(null)}
                />
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Filter Keywords</h3>
                        <button
                            onClick={resetFilters}
                            className="flex items-center space-x-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            <RotateCcw size={10} />
                            <span>Reset</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Min Competitors in Top 30 */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                                Relevancy (Top 30): {minCompetitorsT30}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={minCompetitorsT30}
                                onChange={(e) => setMinCompetitorsT30(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Min Search Volume */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                                Min Search Volume
                            </label>
                            <input
                                type="number"
                                value={minSearchVolume}
                                onChange={(e) => setMinSearchVolume(Number(e.target.value))}
                                className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* Max Avg Rank */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                                Max Avg Rank: {maxAvgRank}
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="150"
                                value={maxAvgRank}
                                onChange={(e) => setMaxAvgRank(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Hide Seasonal */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="hideSeasonal"
                                checked={hideSeasonal}
                                onChange={(e) => setHideSeasonal(e.target.checked)}
                                className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mr-2"
                            />
                            <label htmlFor="hideSeasonal" className="text-[10px] font-medium text-slate-600">
                                Hide Seasonal
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="mb-3">
                <MarketKPIs data={filteredData.rows} competitors={data.competitors} myAsin={myAsin} />
            </div>

            {/* Dominance Chart */}
            <DominanceChart data={filteredData.rows} competitors={data.competitors} myAsin={myAsin} />

            {/* Main Matrix */}
            <div className="flex-1 min-h-0 flex flex-col">
                <CompetitorMatrix
                    data={filteredData.rows}
                    competitors={data.competitors}
                    viewMode={viewMode}
                    myAsin={myAsin}
                    hiddenAsins={hiddenAsins}
                />
            </div>
        </div>
    );
};
