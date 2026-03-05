import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Label } from 'recharts';
import type { BidGapPoint } from '../../types/analysis';

interface Props {
    data: BidGapPoint[];
}

const BidGapScatter: React.FC<Props> = ({ data }) => {
    // Separate data into Under-bidding (Red) and Safe (Green/Blue) for coloring
    const underBiddingData = data.filter(d => d.isUnderBidding);
    const safeData = data.filter(d => !d.isUnderBidding);

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg col-span-2">
            <h3 className="text-xl font-bold text-white mb-2">Market Gap Analysis</h3>
            <p className="text-sm text-gray-400 mb-6">
                Bid vs Guidance. Red dots indicate "Under-bidding" (Bid Gap Ratio &lt; 0.8).
            </p>

            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            type="number"
                            dataKey="currentBid"
                            name="Your Bid"
                            unit="$"
                            stroke="#9CA3AF"
                            tick={{ fill: '#9CA3AF' }}
                            label={{ value: 'Your Current Bid', position: 'bottom', fill: '#9CA3AF' }}
                        />
                        <YAxis
                            type="number"
                            dataKey="suggestedBid"
                            name="Suggested Bid"
                            unit="$"
                            stroke="#9CA3AF"
                            tick={{ fill: '#9CA3AF' }}
                            label={{ value: 'Amazon Suggested Bid', angle: -90, position: 'left', fill: '#9CA3AF' }}
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-gray-900 border border-gray-700 p-3 rounded shadow-lg text-xs z-50">
                                            <p className="text-white font-bold mb-1">{data.keyword}</p>
                                            <p className="text-gray-300">Your Bid: <span className="text-yellow-400">${data.currentBid}</span></p>
                                            <p className="text-gray-300">Suggested: <span className="text-blue-400">${data.suggestedBid}</span></p>
                                            <p className="text-gray-300">Gap Ratio: <span className={data.isUnderBidding ? 'text-red-500' : 'text-green-500'}>{data.bidGapRatio.toFixed(2)}</span></p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {/* Reference Line y=x (Bid matches Suggestion) */}
                        <ReferenceLine
                            segment={[{ x: 0, y: 0 }, { x: 5, y: 5 }]}
                            stroke="#6B7280"
                            strokeDasharray="5 5"
                            ifOverflow="extendDomain"
                        >
                            <Label value="Match Market" position="insideTopLeft" fill="#6B7280" />
                        </ReferenceLine>

                        <Legend verticalAlign="top" height={36} />

                        <Scatter name="Under Bidding (Gap < 0.8)" data={underBiddingData} fill="#EF4444" shape="circle" />
                        <Scatter name="Market Aligned" data={safeData} fill="#10B981" shape="circle" />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BidGapScatter;
