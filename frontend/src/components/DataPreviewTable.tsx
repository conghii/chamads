import React from 'react';
import type { MasterKeywordRecord } from '../types';

interface DataPreviewTableProps {
    data: MasterKeywordRecord[];
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({ data }) => {
    if (data.length === 0) return null;

    const headers = [
        'Keyword', 'ASIN', 'Search Vol', 'Org Rank', 'Spon Rank', 'Ad Spend', 'Ad Sales', 'Impr', 'Clicks', 'CTR', 'CVR'
    ];

    return (
        <div className="mt-8 overflow-x-auto rounded-lg border border-gray-700 bg-gray-900">
            <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-800 text-xs uppercase text-gray-200">
                    <tr>
                        {headers.map(h => (
                            <th key={h} className="px-6 py-3">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 100).map((row, idx) => ( // Limit preview to 100 rows
                        <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-medium text-white">{row.keyword}</td>
                            <td className="px-6 py-4">{row.asin}</td>
                            <td className="px-6 py-4">{row.searchVolume?.toLocaleString() || '-'}</td>
                            <td className="px-6 py-4">{row.organicRank || '-'}</td>
                            <td className="px-6 py-4">{row.sponsoredRank || '-'}</td>
                            <td className="px-6 py-4">{row.adSpend ? `$${row.adSpend.toFixed(2)}` : '-'}</td>
                            <td className="px-6 py-4">{row.adSales ? `$${row.adSales.toFixed(2)}` : '-'}</td>
                            <td className="px-6 py-4">{row.impressions?.toLocaleString() || '-'}</td>
                            <td className="px-6 py-4">{row.clicks?.toLocaleString() || '-'}</td>
                            <td className="px-6 py-4">{row.ctr ? `${row.ctr.toFixed(2)}%` : '-'}</td>
                            <td className="px-6 py-4">{row.cvr ? `${row.cvr.toFixed(2)}%` : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length > 100 && (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-800/20">
                    Showing first 100 of {data.length} records.
                </div>
            )}
        </div>
    );
};
