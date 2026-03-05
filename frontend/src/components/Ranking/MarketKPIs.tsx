import React from 'react';
import { TrendingUp, Target, Crown, Award } from 'lucide-react';

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

interface MarketKPIsProps {
    data: MarketDataRow[];
    competitors: string[];
    myAsin?: string;
}

export const MarketKPIs: React.FC<MarketKPIsProps> = ({ data, competitors, myAsin }) => {
    // 1. Total Market Keywords (High SV)
    const totalKeywords = data.length;
    const highVolKeywords = data.reduce((acc, curr) => acc + curr.searchVolume, 0);

    // Calculate Top 10 SV
    const top10Keywords = data.filter(r => r.competitorCount.top10 > 0);
    const top10Sv = top10Keywords.reduce((acc, curr) => acc + curr.searchVolume, 0);
    const top10Percentage = highVolKeywords > 0 ? Math.round((top10Sv / highVolKeywords) * 100) : 0;

    // 2. Keyword Gaps
    // Keywords where >= 3 competitors rank Top 10, but My ASIN does not rank or ranks > 30.
    let keywordGaps = 0;
    if (myAsin) {
        keywordGaps = data.filter(r => {
            let top10CompCount = 0;
            competitors.forEach(asin => {
                if (asin !== myAsin && r.competitorRanks[asin] && r.competitorRanks[asin]! <= 10) {
                    top10CompCount++;
                }
            });
            const myRank = r.competitorRanks[myAsin];
            const isMyRankPoor = myRank === null || myRank > 30;
            return top10CompCount >= 3 && isMyRankPoor;
        }).length;
    }

    // 3. Top Dominator & 4. My Dominance Score
    const dominatorCounts: Record<string, number> = {};
    competitors.forEach(asin => {
        dominatorCounts[asin] = data.filter(r => {
            const rank = r.competitorRanks[asin];
            return rank !== null && rank <= 10;
        }).length;
    });

    // Find top dominator
    let topDominator = 'None';
    let maxTop10 = 0;
    Object.entries(dominatorCounts).forEach(([asin, count]) => {
        if (count > maxTop10) {
            maxTop10 = count;
            topDominator = asin;
        }
    });

    // Rank of My ASIN relative to competitors based on Top 10 count
    let myRankPosition = 0;
    let myTop10Count = 0;
    const sortedDominators = Object.entries(dominatorCounts).sort((a, b) => b[1] - a[1]);

    if (myAsin) {
        myRankPosition = sortedDominators.findIndex(d => d[0] === myAsin) + 1;
        myTop10Count = dominatorCounts[myAsin] || 0;
    }

    const myDominancePercent = totalKeywords > 0 ? Math.round((myTop10Count / totalKeywords) * 100) : 0;
    const topDominancePercent = totalKeywords > 0 ? Math.round((maxTop10 / totalKeywords) * 100) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI_Card
                title="Market Volume"
                value={totalKeywords.toLocaleString()}
                subValue={`Top 10: ${(top10Sv / 1000).toFixed(0)}K SV (${top10Percentage}% market)`}
                icon={<TrendingUp className="text-blue-600" size={16} />}
                color="blue"
            />
            <KPI_Card
                title="Keyword Gaps"
                value={myAsin ? keywordGaps.toLocaleString() : '-'}
                subValue={myAsin ? `Keywords competitors rank that you miss` : 'Select My ASIN to view'}
                icon={<Target className="text-red-600" size={16} />}
                color="red"
            />
            <KPI_Card
                title="Top Dominator"
                value={topDominator}
                subValue={`You are #${myRankPosition || '-'} in dominance`}
                icon={<Crown className="text-amber-500" size={16} />}
                color="amber"
            />
            <KPI_Card
                title="My Dominance Score"
                value={`${myDominancePercent}%`}
                subValue={`vs ${topDominancePercent}% (Top Dominator)`}
                icon={<Award className="text-emerald-500" size={16} />}
                color="emerald"
                progress={myDominancePercent}
                compareProgress={topDominancePercent}
            />
        </div>
    );
};

interface KPICardProps {
    title: string;
    value: string;
    subValue: string;
    icon: React.ReactNode;
    color: string;
    progress?: number;
    compareProgress?: number;
}

const KPI_Card = ({ title, value, subValue, icon, color, progress, compareProgress }: KPICardProps) => {
    // Dynamic border/bg colors based on prop
    const colorClasses: Record<string, string> = {
        blue: 'border-blue-100 bg-blue-50/50',
        red: 'border-red-100 bg-red-50/50',
        emerald: 'border-emerald-100 bg-emerald-50/50',
        amber: 'border-amber-100 bg-amber-50/50'
    };

    return (
        <div className={`p-3 rounded-lg border ${colorClasses[color]} flex items-center space-x-3 transition-all hover:shadow-sm relative overflow-hidden group`}>
            <div className={`p-2 rounded-md bg-white shadow-sm border border-${color}-100 flex-shrink-0 z-10`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1 z-10">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 truncate">{title}</p>
                <div className="flex items-baseline space-x-2">
                    <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">{value}</h3>
                </div>
                <p className="text-[9px] text-slate-500 mt-0.5 truncate">{subValue}</p>

                {progress !== undefined && compareProgress !== undefined && (
                    <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full flex overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${progress}%` }}></div>
                        <div className="bg-amber-300 h-full opacity-50" style={{ width: `${Math.max(0, compareProgress - progress)}%` }}></div>
                    </div>
                )}
            </div>
        </div>
    );
};
