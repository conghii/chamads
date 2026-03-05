import React, { useState } from 'react';
import { Search, X, Package } from 'lucide-react';

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

interface ClusterData {
    seed: string;
    keywords: MarketDataRow[];
    totalSV: number;
    count: number;
    avgCompetitors: number;
    topOpportunities: MarketDataRow[];
}

interface KeywordClusterSearchProps {
    data: MarketDataRow[];
    onCluster: (cluster: MarketDataRow[]) => void;
    onClear: () => void;
}

export const KeywordClusterSearch: React.FC<KeywordClusterSearchProps> = ({ data, onCluster, onClear }) => {
    const [seedKeyword, setSeedKeyword] = useState('');
    const [clusterData, setClusterData] = useState<ClusterData | null>(null);

    const handleSearch = () => {
        if (!seedKeyword.trim()) {
            handleClear();
            return;
        }

        const normalized = seedKeyword.toLowerCase().trim();
        const cluster = data.filter(row =>
            row.keyword.toLowerCase().includes(normalized)
        );

        if (cluster.length === 0) {
            setClusterData(null);
            onClear();
            return;
        }

        const totalSV = cluster.reduce((sum, k) => sum + k.searchVolume, 0);
        const avgCompetitors = cluster.reduce((sum, k) => sum + k.competitorCount.top30, 0) / cluster.length;
        const topOpportunities = cluster
            .sort((a, b) => b.opportunityScore - a.opportunityScore)
            .slice(0, 3);

        const clusterInfo: ClusterData = {
            seed: seedKeyword,
            keywords: cluster,
            totalSV,
            count: cluster.length,
            avgCompetitors: Math.round(avgCompetitors),
            topOpportunities
        };

        setClusterData(clusterInfo);
        onCluster(cluster);
    };

    const handleClear = () => {
        setSeedKeyword('');
        setClusterData(null);
        onClear();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="space-y-2">
            {/* Search Input */}
            <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm">
                <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            value={seedKeyword}
                            onChange={(e) => setSeedKeyword(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Find related keywords... (e.g., 'st patrick')"
                            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                    >
                        Search
                    </button>
                    {clusterData && (
                        <button
                            onClick={handleClear}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-xs font-medium flex items-center space-x-1"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Cluster Summary Card */}
            {clusterData && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-2.5">
                    <div className="flex items-start space-x-3">
                        <div className="p-2 bg-white rounded-md shadow-sm border border-blue-50 flex-shrink-0">
                            <Package className="text-blue-600" size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[11px] font-semibold text-slate-800 truncate">
                                    Cluster: "{clusterData.seed}"
                                </h3>
                                <div className="flex items-center space-x-2 text-[9px] text-slate-600">
                                    <span className="px-1.5 py-0.5 bg-white rounded-md border border-slate-100">
                                        <strong>{clusterData.count}</strong> keywords
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-white rounded-md border border-slate-100">
                                        <strong>{(clusterData.totalSV / 1000).toFixed(0)}K</strong> total SV
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-white rounded-md border border-slate-100">
                                        <strong>{clusterData.avgCompetitors}</strong> avg comp
                                    </span>
                                </div>
                            </div>

                            {/* Top Opportunities Preview */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {clusterData.topOpportunities.map((kw, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between text-[10px] bg-white/60 rounded-md px-2 py-1 border border-white/40"
                                    >
                                        <span className="text-slate-700 font-medium truncate mr-2" title={kw.keyword}>{kw.keyword}</span>
                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                            <span className="text-slate-500 font-bold">
                                                {kw.opportunityScore.toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
