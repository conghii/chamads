import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ky from 'ky';
import type { BulkAnalysisData } from '../types/analysis';
import BulkIntegrity from '../components/analysis/BulkIntegrity';
import CampaignStrategyMatrix from '../components/analysis/CampaignStrategyMatrix';
import PerformanceSummary from '../components/analysis/PerformanceSummary';
import { AnalysisCharts } from '../components/analysis/AnalysisCharts';
import PortfolioSummary from '../components/analysis/PortfolioSummary';
import PortfolioHierarchy from '../components/analysis/PortfolioHierarchy';
import { WastedSpendPanel } from '../components/analysis/WastedSpendPanel';
import { EyeOff, Eye, LayoutGrid, Briefcase, Calendar, X } from 'lucide-react';

const AnalysisBulk: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initial derived state 
    const initialViewMode = (searchParams.get('view') as 'campaigns' | 'portfolios') || 'campaigns';
    const initialWasted = searchParams.get('wasted') === 'true';

    // ACOS filter
    const initialAcosMin = searchParams.get('acosMin') ? Number(searchParams.get('acosMin')) : null;
    const initialAcosMax = searchParams.get('acosMax') ? Number(searchParams.get('acosMax')) : null;
    const initialAcosName = searchParams.get('acosName') || null;

    const [data, setData] = useState<BulkAnalysisData | null>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCharts, setShowCharts] = useState(true);
    const [viewMode, setViewMode] = useState<'campaigns' | 'portfolios'>(initialViewMode);
    const [showWastedSpend, setShowWastedSpend] = useState(initialWasted);

    const [acosFilter, setAcosFilter] = useState<{ min: number, max: number, name: string } | null>(
        initialAcosMin !== null && initialAcosMax !== null && initialAcosName
            ? { min: initialAcosMin, max: initialAcosMax, name: initialAcosName }
            : null
    );

    // Sync state to URL
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);
        let changed = false;

        if (viewMode !== 'campaigns') {
            if (newParams.get('view') !== viewMode) {
                newParams.set('view', viewMode);
                changed = true;
            }
        } else {
            if (newParams.has('view')) {
                newParams.delete('view');
                changed = true;
            }
        }

        if (showWastedSpend) {
            if (newParams.get('wasted') !== 'true') {
                newParams.set('wasted', 'true');
                changed = true;
            }
        } else {
            if (newParams.has('wasted')) {
                newParams.delete('wasted');
                changed = true;
            }
        }

        if (acosFilter) {
            if (newParams.get('acosMin') !== acosFilter.min.toString() || newParams.get('acosMax') !== acosFilter.max.toString()) {
                newParams.set('acosMin', acosFilter.min.toString());
                newParams.set('acosMax', acosFilter.max.toString());
                newParams.set('acosName', acosFilter.name);
                changed = true;
            }
        } else {
            if (newParams.has('acosMin')) {
                newParams.delete('acosMin');
                newParams.delete('acosMax');
                newParams.delete('acosName');
                changed = true;
            }
        }

        if (changed) {
            setSearchParams(newParams, { replace: true });
        }
    }, [viewMode, showWastedSpend, acosFilter, searchParams, setSearchParams]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch bulk data and dashboard summary (for true Total Sales/TACoS)
                const [bulkResponse, summaryResponse] = await Promise.all([
                    ky.get('http://localhost:3000/api/analysis/bulk').json<BulkAnalysisData>(),
                    ky.get('http://localhost:3000/api/dashboard/summary').json<any>()
                ]);
                setData(bulkResponse);
                setSummary(summaryResponse);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch analysis data:', err);
                setError('Failed to load analysis data. Please ensure you have synced a Bulk file first.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-white">
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 max-w-md text-center">
                    <h3 className="text-xl font-bold text-red-500 mb-2">Analysis Error</h3>
                    <p className="text-gray-300">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    // Collect all campaigns from portfolios for summary
    const allCampaigns = data.portfolioHierarchy.flatMap(p => p.campaigns);

    // Calculate Wasted Spend (ACOS > 50% or 0 orders with spend > 15)
    // We use allCampaigns (or data.topCampaigns if we want just the top ones, but all gives fuller picture)
    const TARGET_ACOS = 30; // 30% placeholder target
    let wastedSpend = 0;

    // Calculate off topCampaigns since it has keyword-level details if available, 
    // otherwise fallback to campaign-level estimation
    data.topCampaigns?.forEach(c => {
        if (c.keywords && c.keywords.length > 0) {
            c.keywords.forEach(kw => {
                if (kw.acos > TARGET_ACOS || (kw.orders === 0 && kw.spend > 15)) {
                    wastedSpend += kw.spend;
                }
            });
        } else {
            // Campaign level fallback if no keywords parsed
            if (c.acos > TARGET_ACOS || (c.orders === 0 && c.spend > 15)) {
                wastedSpend += c.spend;
            }
        }
    });

    return (
        <div className="w-full px-2 py-4 space-y-6">

            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-800">Bulk Analysis</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                        <Calendar size={14} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-700">Last 30 Days</span>
                    </div>
                    <button
                        onClick={() => setShowCharts(!showCharts)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium shadow-sm transition-all"
                    >
                        {showCharts ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showCharts ? 'Hide Charts' : 'Show Charts'}
                    </button>
                </div>
            </div>

            {/* Performance Summary Cards */}
            <PerformanceSummary
                campaigns={allCampaigns}
                wastedSpend={wastedSpend}
                targetAcos={TARGET_ACOS}
                onWastedSpendClick={() => setShowWastedSpend(true)}
                businessReportTotalSales={summary?.businessReport?.totalSales}
            />

            {/* Charts Section */}
            {showCharts && data.topCampaigns && (
                <AnalysisCharts
                    campaigns={data.topCampaigns}
                    onBinClick={(min, max, name) => setAcosFilter({ min, max, name })}
                />
            )}

            {/* ACOS Filter Active Indicator */}
            {acosFilter && (
                <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-800">
                            Filtering ACOS: <span className="font-bold">{acosFilter.name}</span>
                        </span>
                        <span className="text-xs text-blue-600">
                            (Campaigns with ACOS between {acosFilter.min}% and {acosFilter.max === Infinity ? 'infinity' : acosFilter.max + '%'})
                        </span>
                    </div>
                    <button
                        onClick={() => setAcosFilter(null)}
                        className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-white px-3 py-1 rounded-md border border-blue-200 hover:border-blue-300 shadow-sm"
                    >
                        <X size={14} /> Clear Filter
                    </button>
                </div>
            )}

            {/* View Toggles & Filters Bar */}
            <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-200 mt-6">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    <button
                        onClick={() => setViewMode('campaigns')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'campaigns' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                        <LayoutGrid size={16} />
                        Campaigns
                    </button>
                    <button
                        onClick={() => setViewMode('portfolios')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'portfolios' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                        <Briefcase size={16} />
                        Portfolios
                    </button>
                </div>
            </div>

            {/* Campaign Strategy Matrix or Portfolio View */}
            <section className="mt-4">
                {viewMode === 'campaigns' ? (
                    data.topCampaigns && <CampaignStrategyMatrix campaigns={data.topCampaigns} />
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {data.portfolioHierarchy && data.portfolioHierarchy.length > 0 ? (
                            <>
                                <PortfolioHierarchy data={data.portfolioHierarchy} />
                                <PortfolioSummary portfolios={data.portfolioHierarchy} />
                            </>
                        ) : (
                            <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-gray-500 shadow-sm">
                                No portfolio data available.
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Bulk Integrity & Health */}
            <section>
                <h2 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
                    <span className="p-1 bg-green-500/20 rounded text-green-400">✓</span>
                    Bulk Integrity & Health
                </h2>
                <div className="grid grid-cols-1 gap-6">
                    <BulkIntegrity data={data.integrity} />
                </div>
            </section>

            {/* Slide-out Panels */}
            {data.topCampaigns && (
                <WastedSpendPanel
                    isOpen={showWastedSpend}
                    onClose={() => setShowWastedSpend(false)}
                    campaigns={data.topCampaigns}
                />
            )}
        </div>
    );
};

export default AnalysisBulk;
