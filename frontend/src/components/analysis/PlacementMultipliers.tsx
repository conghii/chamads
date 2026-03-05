import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PlacementMultiplier } from '../../types/analysis';

interface Props {
    data: PlacementMultiplier[];
}

const PlacementMultipliers: React.FC<Props> = ({ data }) => {
    // Filter out campaigns with no multipliers to reduce noise
    const activeData = data.filter(d => d.topOfSearch > 0 || d.productPages > 0)
        .sort((a, b) => (b.topOfSearch + b.productPages) - (a.topOfSearch + a.productPages))
        .slice(0, 20); // Top 20 campaigns by accumulated multiplier

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-2">Placement Multiplier Map</h3>
            <p className="text-sm text-gray-400 mb-6">
                Top of Search vs Product Pages adjustments (Top 20 Campaigns)
            </p>

            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={activeData}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                        <XAxis type="number" stroke="#9CA3AF" unit="%" />
                        <YAxis
                            type="category"
                            dataKey="campaign"
                            width={120}
                            stroke="#9CA3AF"
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            interval={0}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                            itemStyle={{ color: '#F3F4F6' }}
                            cursor={{ fill: '#374151', opacity: 0.4 }}
                        />
                        <Legend />
                        <Bar dataKey="topOfSearch" name="Top of Search" stackId="a" fill="#8B5CF6" />
                        <Bar dataKey="productPages" name="Product Pages" stackId="a" fill="#3B82F6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {activeData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-500">No placement multipliers found in data</p>
                </div>
            )}
        </div>
    );
};

export default PlacementMultipliers;
