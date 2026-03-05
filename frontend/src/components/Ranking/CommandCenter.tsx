import React from 'react';
import type { KeywordRanking } from '../../pages/RankingPage';
import { X, TrendingUp, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CommandCenterProps {
    keyword: KeywordRanking;
    onClose: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ keyword, onClose }) => {
    // Process Real Data for Chart
    const chartData = React.useMemo(() => {
        if (!keyword.history || keyword.history.length === 0) return [];

        return [...keyword.history]
            .sort((a, b) => {
                const [d1, m1] = a.date.split('/').map(Number);
                const [d2, m2] = b.date.split('/').map(Number);
                if (m1 !== m2) return m1 - m2;
                return d1 - d2;
            })
            .map(item => ({
                date: item.date,
                organic: item.organic || null,
                sponsored: item.sponsored || null,
            }));
    }, [keyword.history]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">{keyword.keyword}</h2>
                    <p className="text-sm text-slate-500">{keyword.asin}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                    <X size={20} className="text-slate-500" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 1. Chart */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                        Rank History (30 Days)
                    </h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="date" hide />
                                <YAxis reversed domain={[1, 100]} hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ color: '#64748B' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="organic"
                                    stroke="#F97316"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Organic"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="sponsored"
                                    stroke="#8B5CF6"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Sponsored"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. AI Correlation Insight */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2">AI Insight</h3>
                    <p className="text-sm text-blue-600 leading-relaxed">
                        When you increased bid by <span className="font-bold">15%</span> last week, Sponsored Rank improved to Top 5, driving Organic Rank from #50 to <span className="font-bold">#20</span>.
                    </p>
                </div>

                {/* 3. Action History */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Action History</h3>
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pl-6 pb-2">
                        {[
                            { date: 'Today', action: 'Bid Increased to $1.50', user: 'You' },
                            { date: '2 days ago', action: 'Added to "Summer Sale" Portfolio', user: 'System' },
                            { date: '1 week ago', action: 'Keyword Created', user: 'Import' }
                        ].map((item, idx) => (
                            <div key={idx} className="relative">
                                <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white ring-1 ring-slate-200" />
                                <p className="text-xs text-slate-400 mb-0.5">{item.date}</p>
                                <p className="text-sm font-medium text-slate-700">{item.action}</p>
                                <p className="text-xs text-slate-500 mt-0.5">by {item.user}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center">
                    <DollarSign size={16} className="mr-2" />
                    Optimize Bid
                </button>
            </div>
        </div>
    );
};
