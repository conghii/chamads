import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { BiddingStrategyData } from '../../types/analysis';

interface Props {
    data: BiddingStrategyData[];
}

const BiddingStrategyMix: React.FC<Props> = ({ data }) => {
    // Map colors based on strategy type for semantic meaning
    // Dynamic bids - down only: Generally safe/standard -> Blue/Green
    // Dynamic bids - up and down: Risky -> Red/Orange
    // Fixed bids: Manual control -> Purple/Gray

    const getColor = (strategy: string) => {
        switch (strategy) {
            case 'Dynamic bids - down only': return '#3B82F6'; // Blue
            case 'Dynamic bids - up and down': return '#EF4444'; // Red (High Risk)
            case 'Fixed bids': return '#10B981'; // Green (Stable)
            default: return '#9CA3AF'; // Gray
        }
    };

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-2">Bidding Strategy Mix</h3>
            <p className="text-sm text-gray-400 mb-6">Distribution of bidding strategies across all campaigns</p>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="count"
                            nameKey="strategy"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColor(entry.strategy)} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                            itemStyle={{ color: '#F3F4F6' }}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                {data.map((item) => (
                    <div key={item.strategy} className="p-2 bg-gray-700/50 rounded-lg">
                        <div className="text-2xl font-bold text-white">{item.count}</div>
                        <div className="text-xs text-gray-400 truncate" title={item.strategy}>
                            {item.strategy.replace('Dynamic bids - ', '')}
                        </div>
                        <div className="text-xs font-medium" style={{ color: getColor(item.strategy) }}>
                            {item.percentage.toFixed(1)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BiddingStrategyMix;
