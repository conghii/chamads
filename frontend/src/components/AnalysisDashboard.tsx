import React from 'react';
import type { DatasetStats, RawFileType } from '../types';
import { Layers, Target, Search, DollarSign, TrendingUp, FileSpreadsheet } from 'lucide-react';
import classNames from 'classnames';

interface AnalysisDashboardProps {
    stats: DatasetStats;
    fileType: RawFileType | null;
    onSync: () => void;
    syncStatus: 'idle' | 'syncing' | 'success' | 'error';
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ stats, fileType, onSync, syncStatus }) => {

    const StatCard = ({ icon: Icon, label, value, subtext, color }: any) => (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-start space-x-4 hover:bg-gray-800/50 transition-colors">
            <div className={classNames("p-3 rounded-lg bg-opacity-20", color)}>
                <Icon size={24} className={color.replace('bg-', 'text-').replace('/20', '')} />
            </div>
            <div>
                <p className="text-gray-400 text-sm font-medium">{label}</p>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
                {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
            </div>
        </div>
    );

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            {/* Header / File Info */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <FileSpreadsheet className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">File Analysis Ready</h3>
                        <p className="text-sm text-gray-400">
                            Type: <span className="text-blue-400 font-mono">{fileType || 'Unknown'}</span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={onSync}
                    disabled={syncStatus === 'syncing' || syncStatus === 'success'}
                    className={classNames(
                        "px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg",
                        syncStatus === 'idle' ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/20" : "",
                        syncStatus === 'syncing' ? "bg-yellow-600 text-white cursor-wait" : "",
                        syncStatus === 'success' ? "bg-green-600 text-white cursor-default" : "",
                        syncStatus === 'error' ? "bg-red-600 text-white" : ""
                    )}
                >
                    {syncStatus === 'idle' && 'Sync to Master Sheet'}
                    {syncStatus === 'syncing' && 'Syncing...'}
                    {syncStatus === 'success' && 'Sync Complete'}
                    {syncStatus === 'error' && 'Retry Sync'}
                </button>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    icon={Target}
                    label="Total Keywords"
                    value={stats.totalRecords.toLocaleString()}
                    subtext="Unique Targets Found"
                    color="bg-purple-500/20 text-purple-400"
                />
                <StatCard
                    icon={Layers}
                    label="Active Campaigns"
                    value={stats.totalCampaigns.toLocaleString()}
                    subtext="Detected in file"
                    color="bg-blue-500/20 text-blue-400"
                />
                <StatCard
                    icon={Search}
                    label="Search Terms parsed"
                    value={stats.totalSearchTerms.toLocaleString()}
                    subtext="Customer Queries"
                    color="bg-emerald-500/20 text-emerald-400"
                />
                <StatCard
                    icon={DollarSign}
                    label="Total Ad Spend"
                    value={formatCurrency(stats.totalAdSpend)}
                    subtext="In uploaded period"
                    color="bg-red-500/20 text-red-400"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Total Ad Sales"
                    value={formatCurrency(stats.totalAdSales)}
                    subtext="Attributed Sales"
                    color="bg-green-500/20 text-green-400"
                />
            </div>
        </div>
    );
};
