import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, TrendingUp, TrendingDown, Search, ArrowUpDown, Pause } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { TopCampaign } from '../../types/analysis';
import { parseCampaignName } from '../../utils/campaignParser';
import CampaignAnalyzePanel from './CampaignAnalyzePanel';
import { useActionQueue, createPauseAction } from '../../services/actionQueueService';

interface Props {
    campaigns: TopCampaign[];
}

type SortKey = 'name' | 'spend' | 'sales' | 'orders' | 'acos' | 'roas';
type IssueType = 'High ACOS' | 'Bleeding' | 'Low ROAS';

const CampaignStrategyMatrix: React.FC<Props> = ({ campaigns }) => {
    // State for expanded rows
    const [searchParams, setSearchParams] = useSearchParams();

    // Init state from URL
    const getInitialIssues = (): IssueType[] => {
        const filterParam = searchParams.get('filter');
        if (filterParam === 'bleeding') return ['Bleeding'];
        if (filterParam === 'high-acos') return ['High ACOS'];
        return [];
    };

    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [selectedAnalysisCampaign, setSelectedAnalysisCampaign] = useState<TopCampaign | null>(null);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [filterState, setFilterState] = useState('enabled'); // Default to enabled
    const [filterType, setFilterType] = useState('All Types');
    const [filterIssues, setFilterIssues] = useState<IssueType[]>(getInitialIssues());
    const [filterPortfolio, setFilterPortfolio] = useState('All Portfolios');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'sales', direction: 'desc' });
    const [isIssueDropdownOpen, setIsIssueDropdownOpen] = useState(false);

    // Sync url params
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);
        let changed = false;

        if (filterIssues.length === 1 && filterIssues[0] === 'Bleeding') {
            if (newParams.get('filter') !== 'bleeding') { newParams.set('filter', 'bleeding'); changed = true; }
        } else if (filterIssues.length === 1 && filterIssues[0] === 'High ACOS') {
            if (newParams.get('filter') !== 'high-acos') { newParams.set('filter', 'high-acos'); changed = true; }
        } else {
            if (newParams.has('filter')) { newParams.delete('filter'); changed = true; }
        }

        if (searchTerm) {
            if (newParams.get('search') !== searchTerm) { newParams.set('search', searchTerm); changed = true; }
        } else if (newParams.has('search')) {
            newParams.delete('search'); changed = true;
        }

        if (changed) {
            setSearchParams(newParams, { replace: true });
        }
    }, [filterIssues, searchTerm, searchParams, setSearchParams]);

    // Outside click ref for dropdown
    const issueDropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (issueDropdownRef.current && !issueDropdownRef.current.contains(event.target as Node)) {
                setIsIssueDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Toggle row expansion
    const toggleRow = (campaignName: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(campaignName)) {
            newExpanded.delete(campaignName);
        } else {
            newExpanded.add(campaignName);
        }
        setExpandedRows(newExpanded);
    };

    const toggleSelectRow = (campaignName: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(campaignName)) {
            newSelected.delete(campaignName);
        } else {
            newSelected.add(campaignName);
        }
        setSelectedRows(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedRows.size === sortedCampaigns.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(sortedCampaigns.map(c => c.name)));
        }
    };

    // Get unique portfolios
    const uniquePortfolios = useMemo(() => {
        const portfolios = new Set(campaigns.map(c => c.portfolioName).filter(Boolean));
        return Array.from(portfolios).sort();
    }, [campaigns]);

    const getIssues = (campaign: TopCampaign): IssueType[] => {
        const issues: IssueType[] = [];
        if (campaign.acos > 30) issues.push('High ACOS');
        if (campaign.orders === 0 && campaign.spend > 15) issues.push('Bleeding');
        if (campaign.roas < 1.0 && campaign.spend > 0) issues.push('Low ROAS');
        return issues;
    };

    // Filter logic
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesState = filterState === 'All States' || c.state === filterState;
            const matchesType = filterType === 'All Types' || c.campaignType === filterType;
            const matchesPortfolio = filterPortfolio === 'All Portfolios' || c.portfolioName === filterPortfolio;

            const cIssues = getIssues(c);
            // If filterIssues is empty, match all. 
            // If not empty, campaign must have AT LEAST ONE of the selected issues.
            const matchesIssue = filterIssues.length === 0 || filterIssues.some(issue => cIssues.includes(issue));

            const acosMinStr = searchParams.get('acosMin');
            const acosMaxStr = searchParams.get('acosMax');
            let matchesAcos = true;
            if (acosMinStr && acosMaxStr) {
                const acosMin = Number(acosMinStr);
                const acosMax = Number(acosMaxStr);
                const cAcos = c.sales > 0 ? (c.spend / c.sales) * 100 : Infinity;

                if (c.spend === 0) {
                    matchesAcos = false; // Only include campaigns with spend in the histogram filter
                } else {
                    matchesAcos = cAcos >= acosMin && cAcos < acosMax;
                }
            }

            return matchesSearch && matchesState && matchesType && matchesIssue && matchesPortfolio && matchesAcos;
        });
    }, [campaigns, searchTerm, filterState, filterType, filterIssues, filterPortfolio, searchParams]);

    // Sort logic
    const sortedCampaigns = useMemo(() => {
        return [...filteredCampaigns].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredCampaigns, sortConfig]);

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const { addToQueue } = useActionQueue();

    const handlePauseCampaign = (campaign: TopCampaign) => {
        const action = createPauseAction(
            campaign.name,
            campaign.name, // entityName
            'campaign',
            'UNKNOWN',
            {
                priority: campaign.acos > 0 ? 70 : 90,
                spend: campaign.spend,
                sales: campaign.sales,
                acos: campaign.acos,
                orders: campaign.orders,
                clicks: campaign.clicks
            }
        );
        addToQueue(action);
    };

    const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
    const formatPercent = (val: number) => `${val.toFixed(1)}%`;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden pb-[100px] relative">
            {/* Header / Filter Bar - Dense Layout */}
            <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-800 whitespace-nowrap">Strategy Matrix</h3>
                    <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">{filteredCampaigns.length}</span>
                </div>

                <div className="flex items-center gap-2 flex-grow justify-end">
                    {/* Search */}
                    <div className="relative w-48 md:w-64">
                        <input
                            type="text"
                            placeholder="Search campaigns..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                    </div>

                    {/* Filters */}
                    {uniquePortfolios.length > 0 && (
                        <select
                            value={filterPortfolio}
                            onChange={(e) => setFilterPortfolio(e.target.value)}
                            className="text-xs border border-gray-300 rounded-md py-1.5 pl-2 pr-6 bg-white hover:bg-gray-50 cursor-pointer focus:ring-1 focus:ring-blue-500 max-w-[150px]"
                        >
                            <option value="All Portfolios">All Portfolios</option>
                            {uniquePortfolios.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    )}

                    <select
                        value={filterState}
                        onChange={(e) => setFilterState(e.target.value)}
                        className="text-xs border border-gray-300 rounded-md py-1.5 pl-2 pr-6 bg-white hover:bg-gray-50 cursor-pointer focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="enabled">Enabled</option>
                        <option value="paused">Paused</option>
                        <option value="archived">Archived</option>
                        <option value="All States">All States</option>
                    </select>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="text-xs border border-gray-300 rounded-md py-1.5 pl-2 pr-6 bg-white hover:bg-gray-50 cursor-pointer focus:ring-1 focus:ring-blue-500"
                    >
                        <option>All Types</option>
                        <option value="SP">Sponsored Products</option>
                        <option value="SB">Sponsored Brands</option>
                        <option value="SD">Sponsored Display</option>
                    </select>

                    {/* Multi-Issue Dropdown */}
                    <div className="relative" ref={issueDropdownRef}>
                        <button
                            onClick={() => setIsIssueDropdownOpen(!isIssueDropdownOpen)}
                            className="text-xs border border-gray-300 rounded-md py-1.5 pl-3 pr-2 bg-white hover:bg-gray-50 flex items-center gap-2 min-w-[120px] justify-between focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <span className="truncate max-w-[90px]">
                                {filterIssues.length === 0 ? 'All Issues' : `${filterIssues.length} Issues Selected`}
                            </span>
                            <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
                        </button>

                        {isIssueDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl w-48 z-50 p-2 flex flex-col gap-1">
                                {['High ACOS', 'Bleeding', 'Low ROAS'].map(opt => (
                                    <label key={opt} className="flex items-center gap-2 text-xs p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filterIssues.includes(opt as IssueType)}
                                            onChange={(e) => {
                                                if (e.target.checked) setFilterIssues([...filterIssues, opt as IssueType]);
                                                else setFilterIssues(filterIssues.filter(x => x !== opt));
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                        />
                                        {opt === 'Bleeding' && <AlertTriangle size={12} className="text-red-500" />}
                                        {opt === 'High ACOS' && <TrendingUp size={12} className="text-orange-500" />}
                                        {opt === 'Low ROAS' && <TrendingDown size={12} className="text-yellow-600" />}
                                        <span className="font-medium text-gray-700">{opt}</span>
                                    </label>
                                ))}
                                {filterIssues.length > 0 && (
                                    <div className="pt-2 mt-1 border-t border-gray-100">
                                        <button
                                            onClick={() => setFilterIssues([])}
                                            className="w-full text-center text-xs text-blue-600 font-medium hover:text-blue-800"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Matrix Table - Compact Density */}
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-3 py-2.5 w-8 sticky top-0 left-0 bg-gray-50 z-30 shadow-[inset_-1px_0_0_0_rgba(229,231,235,1),inset_0_-1px_0_0_rgba(229,231,235,1)] text-center">
                                <input
                                    type="checkbox"
                                    checked={selectedRows.size > 0 && selectedRows.size === sortedCampaigns.length}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                />
                            </th>
                            <th className="px-3 py-2.5 w-8 sticky top-0 left-8 bg-gray-50 z-30 shadow-[inset_-1px_0_0_0_rgba(229,231,235,1),inset_0_-1px_0_0_rgba(229,231,235,1)]"></th>
                            <th
                                className="px-3 py-2.5 font-bold min-w-[200px] cursor-pointer hover:bg-gray-100 select-none group transition-colors sticky top-0 left-16 bg-gray-50 z-30 shadow-[inset_-1px_0_0_0_rgba(229,231,235,1),inset_0_-1px_0_0_rgba(229,231,235,1)]"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-1">
                                    Campaign
                                    <ArrowUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig.key === 'name' ? 'opacity-100 text-blue-500' : ''}`} />
                                </div>
                            </th>
                            <th className="px-3 py-2.5 font-bold text-left sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]">Portfolio</th>
                            <th
                                className="px-3 py-2.5 font-bold text-right cursor-pointer hover:bg-gray-100 select-none group transition-colors sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]"
                                onClick={() => handleSort('spend')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Spend
                                    <ArrowUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig.key === 'spend' ? 'opacity-100 text-blue-500' : ''}`} />
                                </div>
                            </th>
                            <th
                                className="px-3 py-2.5 font-bold text-right cursor-pointer hover:bg-gray-100 select-none group transition-colors sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]"
                                onClick={() => handleSort('sales')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Sales
                                    <ArrowUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig.key === 'sales' ? 'opacity-100 text-blue-500' : ''}`} />
                                </div>
                            </th>
                            <th
                                className="px-3 py-2.5 font-bold text-right cursor-pointer hover:bg-gray-100 select-none group transition-colors sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]"
                                onClick={() => handleSort('orders')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Orders
                                    <ArrowUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig.key === 'orders' ? 'opacity-100 text-blue-500' : ''}`} />
                                </div>
                            </th>
                            <th
                                className="px-3 py-2.5 font-bold text-right cursor-pointer hover:bg-gray-100 select-none group transition-colors sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]"
                                onClick={() => handleSort('acos')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    ACOS
                                    <ArrowUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig.key === 'acos' ? 'opacity-100 text-blue-500' : ''}`} />
                                </div>
                            </th>
                            <th
                                className="px-3 py-2.5 font-bold text-right cursor-pointer hover:bg-gray-100 select-none group transition-colors sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]"
                                onClick={() => handleSort('roas')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    ROAS
                                    <ArrowUpDown size={12} className={`text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${sortConfig.key === 'roas' ? 'opacity-100 text-blue-500' : ''}`} />
                                </div>
                            </th>
                            <th className="px-3 py-2.5 font-bold text-center sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]">Trend</th>
                            <th className="px-3 py-2.5 font-bold text-center sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]">State</th>
                            <th className="px-3 py-2.5 font-bold text-center sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]">Issues</th>
                            <th className="px-3 py-2.5 font-bold text-center w-[80px] sticky top-0 bg-gray-50 z-20 shadow-[inset_0_-1px_0_0_rgba(229,231,235,1)]">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedCampaigns.map((campaign) => {
                            const isExpanded = expandedRows.has(campaign.name);
                            const isSelected = selectedRows.has(campaign.name);
                            const issues = getIssues(campaign);
                            const parsed = parseCampaignName(campaign.name);

                            // Performance Tiers styling
                            const isBleeding = campaign.orders === 0 && campaign.spend > 15;
                            const hasHighAcos = campaign.acos > 30;
                            const isHealthy = campaign.roas > 2.5;

                            let tierBgClass = 'bg-white hover:bg-gray-50';
                            if (isSelected) tierBgClass = 'bg-blue-50/60 hover:bg-blue-100/60';
                            else if (isBleeding) tierBgClass = 'bg-rose-50/50 hover:bg-rose-100/50';
                            else if (hasHighAcos) tierBgClass = 'bg-orange-50/50 hover:bg-orange-100/50';
                            else if (isHealthy) tierBgClass = 'bg-emerald-50/30 hover:bg-emerald-50/70';

                            // Dummy dummy trend points (7 data points)
                            const trendPoints = Array.from({ length: 7 }, () => Math.floor(Math.random() * 40) + 10);
                            const trendColor = campaign.acos > 30 ? '#f43f5e' : campaign.roas > 2 ? '#10b981' : '#3b82f6';

                            return (
                                <React.Fragment key={campaign.name}>
                                    {/* Parent Row */}
                                    <tr className={`${tierBgClass} group/row transition-colors ${isExpanded ? 'shadow-[inset_4px_0_0_0_#3b82f6]' : ''}`}>
                                        <td className="px-3 py-2 sticky left-0 z-10 bg-inherit shadow-[inset_-1px_0_0_0_rgba(243,244,246,1)] text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectRow(campaign.name)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-3 py-2 sticky left-8 z-10 bg-inherit shadow-[inset_-1px_0_0_0_rgba(243,244,246,1)]">
                                            <button
                                                onClick={() => toggleRow(campaign.name)}
                                                className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                                            >
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 sticky left-16 z-10 bg-inherit shadow-[inset_-1px_0_0_0_rgba(243,244,246,1)]">
                                            <div className="font-semibold text-gray-900 truncate max-w-[300px] mb-1" title={campaign.name}>
                                                {parsed.theme || campaign.name}
                                                {parsed.tags.map(tag => (
                                                    <span key={tag} className="ml-1.5 text-[9px] font-bold bg-gray-100 text-gray-500 px-1 py-0.5 rounded border border-gray-200 uppercase tracking-wider">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                <span className={`px-1 rounded border font-bold tracking-wider ${parsed.type === 'SB' ? 'bg-purple-50 text-purple-600 border-purple-100' : parsed.type === 'SD' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : parsed.type === 'Auto' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    {parsed.type}
                                                </span>
                                                {parsed.targeting !== 'Unknown' && (
                                                    <span className={`px-1 rounded border font-bold tracking-wider ${parsed.targeting === 'KT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : parsed.targeting === 'PT' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                                        {parsed.targeting}
                                                    </span>
                                                )}
                                                {parsed.bid && (
                                                    <span className="px-1 rounded text-gray-400 font-medium">
                                                        Bid: ${parsed.bid.toFixed(2)}
                                                    </span>
                                                )}
                                                {parsed.bid && <span className="text-gray-300">•</span>}
                                                <span className="font-medium text-gray-400">{campaign.keywords?.length || 0} Targets</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {campaign.portfolioName ? (
                                                <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[120px] block" title={campaign.portfolioName}>
                                                    {campaign.portfolioName}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-[10px]">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-700">{formatCurrency(campaign.spend)}</td>
                                        <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(campaign.sales)}</td>
                                        <td className="px-3 py-2 text-right text-gray-700">{campaign.orders}</td>
                                        <td className={`px-3 py-2 text-right font-bold ${campaign.acos > 30 ? 'text-red-500' : 'text-green-600'}`}>
                                            {campaign.sales > 0 ? formatPercent(campaign.acos) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600 font-medium">
                                            {campaign.spend > 0 ? (
                                                <span className={campaign.roas > 2 ? 'text-emerald-600' : campaign.roas < 1 ? 'text-red-500' : ''}>
                                                    {campaign.roas.toFixed(2)}x
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="flex justify-center items-center h-5 w-16 mx-auto">
                                                <svg viewBox="0 0 100 20" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                                                    <polyline
                                                        fill="none"
                                                        stroke={trendColor}
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        points={trendPoints.map((p, i) => `${(i / 6) * 100},${20 - (p / 50 * 20)}`).join(' ')}
                                                    />
                                                </svg>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${campaign.state === 'enabled' ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                                {campaign.state}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap w-24">
                                                {issues.length === 0 ? (
                                                    <span className="text-emerald-600 text-[10px] font-bold tracking-wider uppercase">Healthy</span>
                                                ) : (
                                                    issues.map(iss => {
                                                        if (iss === 'Bleeding') return <span key={iss} title="Bleeding: High Spend & 0 Orders" className="text-red-600 bg-red-50 border border-red-200 p-1 rounded-md shadow-sm"><AlertTriangle size={12} strokeWidth={2.5} /></span>;
                                                        if (iss === 'High ACOS') return <span key={iss} title="High ACOS: > 30%" className="text-orange-500 bg-orange-50 border border-orange-200 p-1 rounded-md shadow-sm"><TrendingUp size={12} strokeWidth={2.5} /></span>;
                                                        if (iss === 'Low ROAS') return <span key={iss} title="Low ROAS: < 1.0x" className="text-yellow-600 bg-yellow-50 border border-yellow-200 p-1 rounded-md shadow-sm"><TrendingDown size={12} strokeWidth={2.5} /></span>;
                                                        return null;
                                                    })
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center h-full">
                                            <div className="flex gap-1 justify-center items-center">
                                                <button
                                                    onClick={() => setSelectedAnalysisCampaign(campaign)}
                                                    className="text-[10px] font-bold bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-md transition-colors shadow-sm"
                                                >
                                                    Analyze
                                                </button>
                                                <button
                                                    onClick={() => handlePauseCampaign(campaign)}
                                                    className="p-1.5 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-md transition-colors shadow-sm group/pause"
                                                    title="Add Pause Action to Queue"
                                                >
                                                    <Pause size={12} className="group-hover/pause:fill-current" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Child Row (Expanded) */}
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={11} className="bg-gray-50/50 p-0 border-b border-gray-100 shadow-inner">
                                                <div className="pl-12 pr-4 py-3">
                                                    <div className="bg-white rounded border border-gray-200 overflow-hidden">
                                                        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
                                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Performance</h4>
                                                        </div>

                                                        {campaign.keywords && campaign.keywords.length > 0 ? (
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-white text-gray-500 border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="px-3 py-1.5 text-left font-medium w-64">Keyword / Target</th>
                                                                        <th className="px-3 py-1.5 text-center font-medium">Match</th>
                                                                        <th className="px-3 py-1.5 text-right font-medium">Spend</th>
                                                                        <th className="px-3 py-1.5 text-right font-medium">Sales</th>
                                                                        <th className="px-3 py-1.5 text-right font-medium">Orders</th>
                                                                        <th className="px-3 py-1.5 text-right font-medium">ACOS</th>
                                                                        <th className="px-3 py-1.5 text-right font-medium">Impressions</th>
                                                                        <th className="px-3 py-1.5 text-right font-medium">Clicks</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {campaign.keywords.map((kw, idx) => {
                                                                        const kwBleeding = kw.orders === 0 && kw.spend > 10;
                                                                        return (
                                                                            <tr key={idx} className={`hover:bg-gray-50/80 ${kwBleeding ? 'bg-red-50/30' : ''}`}>
                                                                                <td className="px-3 py-1.5 font-medium text-gray-800 truncate max-w-[250px]" title={kw.keyword}>
                                                                                    {kw.keyword}
                                                                                    {kwBleeding && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600 uppercase">Bleeding</span>}
                                                                                </td>
                                                                                <td className="px-3 py-1.5 text-center text-gray-400">
                                                                                    <span className="text-[10px] uppercase">{kw.matchType}</span>
                                                                                </td>
                                                                                <td className="px-3 py-1.5 text-right text-gray-600 font-medium">{formatCurrency(kw.spend)}</td>
                                                                                <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(kw.sales)}</td>
                                                                                <td className="px-3 py-1.5 text-right text-gray-600">{kw.orders}</td>
                                                                                <td className={`px-3 py-1.5 text-right font-medium ${kw.acos > 30 ? 'text-red-600' : 'text-gray-700'}`}>
                                                                                    {kw.sales > 0 ? formatPercent(kw.acos) : '-'}
                                                                                </td>
                                                                                <td className="px-3 py-1.5 text-right text-gray-500 text-[10px]">{kw.impressions.toLocaleString()}</td>
                                                                                <td className="px-3 py-1.5 text-right text-gray-500 text-[10px]">{kw.clicks.toLocaleString()}</td>
                                                                            </tr>
                                                                        )
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        ) : (
                                                            <div className="p-4 text-center text-gray-400 text-xs italic">
                                                                No active targets found in this campaign.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {filteredCampaigns.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        No campaigns found matching your filters.
                    </div>
                )}
            </div>

            {/* Slide-out Analyze Panel */}
            {selectedAnalysisCampaign && (
                <>
                    <div
                        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => setSelectedAnalysisCampaign(null)}
                    />
                    <CampaignAnalyzePanel
                        campaign={selectedAnalysisCampaign}
                        onClose={() => setSelectedAnalysisCampaign(null)}
                    />
                </>
            )}
        </div>
    );
};

export default CampaignStrategyMatrix;
