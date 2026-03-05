import React from 'react';
import type { TopCampaign, ConvertingKeyword } from '../../types/analysis';
import { ArrowTrendingUpIcon, ShoppingCartIcon } from '@heroicons/react/24/solid';

interface Props {
    campaigns: TopCampaign[];
    keywords: ConvertingKeyword[];
}

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const formatPercent = (val: number) =>
    (val).toFixed(2) + '%';

const TopPerformers: React.FC<Props> = ({ campaigns, keywords }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">

            {/* Top Campaigns Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-6 h-6 text-green-400" />
                    Top Campaigns (by Sales)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Campaign</th>
                                <th className="px-4 py-3">Sales</th>
                                <th className="px-4 py-3">ACOS</th>
                                <th className="px-4 py-3 rounded-r-lg">ROAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map((camp, idx) => (
                                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                    <td className="px-4 py-3 font-medium text-white truncate max-w-[150px]" title={camp.name}>
                                        {camp.name}
                                    </td>
                                    <td className="px-4 py-3 text-green-400 font-bold">
                                        {formatCurrency(camp.sales)}
                                    </td>
                                    <td className={`px-4 py-3 ${camp.acos > 30 ? 'text-red-400' : 'text-blue-400'}`}>
                                        {formatPercent(camp.acos)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-300">
                                        {camp.roas.toFixed(2)}x
                                    </td>
                                </tr>
                            ))}
                            {campaigns.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        No sales data found in recent sync
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Converting Keywords Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ShoppingCartIcon className="w-6 h-6 text-yellow-400" />
                    Winning Keywords (by Orders)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Keyword</th>
                                <th className="px-4 py-3">Orders</th>
                                <th className="px-4 py-3">Sales</th>
                                <th className="px-4 py-3 rounded-r-lg">ACOS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {keywords.map((kw, idx) => (
                                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                    <td className="px-4 py-3 font-medium text-white max-w-[150px]">
                                        <div className="truncate" title={kw.keyword}>{kw.keyword}</div>
                                        <div className="text-xs text-gray-500">{kw.matchType}</div>
                                    </td>
                                    <td className="px-4 py-3 text-yellow-400 font-bold">
                                        {kw.orders}
                                    </td>
                                    <td className="px-4 py-3 text-gray-300">
                                        {formatCurrency(kw.sales)}
                                    </td>
                                    <td className={`px-4 py-3 ${kw.acos > 30 ? 'text-red-400' : 'text-blue-400'}`}>
                                        {formatPercent(kw.acos)}
                                    </td>
                                </tr>
                            ))}
                            {keywords.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        No converting keywords found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TopPerformers;
