import React, { useState, useMemo } from 'react';
import type { PortfolioNode } from '../../types/analysis';
import { ArrowUpDown, ChevronDown, ChevronRight, Briefcase, Search, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatPercent = (val: number) => `${val.toFixed(2)}%`;

interface Props {
    portfolios: PortfolioNode[];
}

const PortfolioSummary: React.FC<Props> = ({ portfolios }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'spend', direction: 'desc' });
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [healthFilter, setHealthFilter] = useState<'ALL' | 'PROFITABLE' | 'WARNING' | 'BLEEDING' | 'NO_DATA'>('ALL');
    const [productLineFilter, setProductLineFilter] = useState<string>('ALL');
    const [strategyFilter, setStrategyFilter] = useState<string>('ALL');

    // Parse portfolio names to get product lines and strategies
    const { productLines, strategies } = useMemo(() => {
        const lines = new Set<string>();
        const strats = new Set<string>();

        portfolios.forEach(p => {
            const parts = p.name.split('-');
            if (parts.length > 1) {
                // Heuristic: usually Card-Something, so index 1 is theme/product line
                let line = parts[1];
                if (p.name.startsWith('UT')) {
                    line = parts[2]; // e.g. UT0-Card-A-Dadjoke1 -> Card? or Dadjoke? Let's just use part after Card
                }
                if (line) lines.add(line);

                // Strategy is often the last part or contains Broad/Auto/Low
                const lowerName = p.name.toLowerCase();
                if (lowerName.includes('broad')) strats.add('Broad');
                if (lowerName.includes('auto')) strats.add('Auto');
                if (lowerName.includes('low')) strats.add('Low');
                if (lowerName.includes('phrase')) strats.add('Phrase');
            }
        });

        return {
            productLines: Array.from(lines).sort(),
            strategies: Array.from(strats).sort()
        };
    }, [portfolios]);

    // Helper functions for calculated metrics
    const getRoas = (sales: number, spend: number) => spend > 0 ? sales / spend : 0;
    const getAcos = (sales: number, spend: number) => sales > 0 ? (spend / sales) * 100 : 0;

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const toggleRow = (portfolioName: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(portfolioName)) {
            newExpanded.delete(portfolioName);
        } else {
            newExpanded.add(portfolioName);
        }
        setExpandedRows(newExpanded);
    };

    const displayPortfolios = useMemo(() => {
        return portfolios.filter(p => {
            const totalSales = p.campaigns.reduce((sum, c) => sum + (c.sales || 0), 0);
            const totalSpend = p.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
            const pAcos = getAcos(totalSales, totalSpend);
            const hasBleeding = p.campaigns.some(c => c.spend > 0 && (!c.sales || c.sales === 0));

            // Search filter
            if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            // Health filter
            if (healthFilter === 'PROFITABLE' && (pAcos >= 30 || totalSales === 0)) return false;
            if (healthFilter === 'WARNING' && (pAcos < 30 || pAcos >= 60)) return false;
            if (healthFilter === 'BLEEDING' && pAcos < 60 && !hasBleeding) return false;
            if (healthFilter === 'NO_DATA' && (totalSpend > 0 || totalSales > 0)) return false;

            // Product Line filter
            if (productLineFilter !== 'ALL' && !p.name.includes(productLineFilter)) return false;

            // Strategy filter
            if (strategyFilter !== 'ALL' && !p.name.toLowerCase().includes(strategyFilter.toLowerCase())) return false;

            return true;
        }).sort((a, b) => {
            const aSales = a.campaigns.reduce((sum, c) => sum + (c.sales || 0), 0);
            const aSpend = a.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
            const aOrders = a.campaigns.reduce((sum, c) => sum + (c.orders || 0), 0);
            const aProfit = aSales - aSpend;
            const aAcos = getAcos(aSales, aSpend);

            const bSales = b.campaigns.reduce((sum, c) => sum + (c.sales || 0), 0);
            const bSpend = b.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
            const bOrders = b.campaigns.reduce((sum, c) => sum + (c.orders || 0), 0);
            const bProfit = bSales - bSpend;
            const bAcos = getAcos(bSales, bSpend);

            let aVal: any = 0; let bVal: any = 0;

            if (sortConfig.key === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
            else if (sortConfig.key === 'totalSpend') { aVal = aSpend; bVal = bSpend; }
            else if (sortConfig.key === 'totalSales') { aVal = aSales; bVal = bSales; }
            else if (sortConfig.key === 'acos') { aVal = aSales > 0 ? aAcos : Infinity; bVal = bSales > 0 ? bAcos : Infinity; }
            else if (sortConfig.key === 'roas') { aVal = getRoas(aSales, aSpend); bVal = getRoas(bSales, bSpend); }
            else if (sortConfig.key === 'orders') { aVal = aOrders; bVal = bOrders; }
            else if (sortConfig.key === 'profit') { aVal = aProfit; bVal = bProfit; }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [portfolios, sortConfig, searchTerm, healthFilter, productLineFilter, strategyFilter]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Briefcase className="text-blue-600" size={20} />
                        <h2 className="text-lg font-bold text-gray-800">Portfolio Performance</h2>
                        <div className="text-xs font-semibold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full ml-2">
                            {displayPortfolios.length} / {portfolios.length}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1.5 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search portfolios..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                            />
                        </div>
                        <select
                            value={productLineFilter} onChange={e => setProductLineFilter(e.target.value)}
                            className="text-xs border border-gray-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                            <option value="ALL">All Product Lines</option>
                            {productLines.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                        </select>
                        <select
                            value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}
                            className="text-xs border border-gray-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                            <option value="ALL">All Strategies</option>
                            {strategies.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 text-[11px] font-bold">
                    <button onClick={() => setHealthFilter('ALL')} className={`px-3 py-1.5 rounded-md transition-colors ${healthFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                        All
                    </button>
                    <button onClick={() => setHealthFilter('PROFITABLE')} className={`px-3 py-1.5 rounded-md transition-colors ${healthFilter === 'PROFITABLE' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        Profitable (&lt;30%)
                    </button>
                    <button onClick={() => setHealthFilter('WARNING')} className={`px-3 py-1.5 rounded-md transition-colors ${healthFilter === 'WARNING' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                        Warning (30-60%)
                    </button>
                    <button onClick={() => setHealthFilter('BLEEDING')} className={`px-3 py-1.5 rounded-md transition-colors ${healthFilter === 'BLEEDING' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                        Bleeding (&gt;60% or $0 Sales)
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200">
                        <tr>
                            <th className="px-3 py-3 w-8 sticky left-0 bg-gray-100 z-10"></th>
                            <th className="px-3 py-3 font-bold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">Portfolio Name <ArrowUpDown size={12} className={sortConfig.key === 'name' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-3 py-3 font-bold text-center">Camp.</th>
                            <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('totalSpend')}>
                                <div className="flex items-center justify-end gap-1">Spend <ArrowUpDown size={12} className={sortConfig.key === 'totalSpend' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('totalSales')}>
                                <div className="flex items-center justify-end gap-1">Sales <ArrowUpDown size={12} className={sortConfig.key === 'totalSales' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('orders')}>
                                <div className="flex items-center justify-end gap-1">Orders <ArrowUpDown size={12} className={sortConfig.key === 'orders' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('acos')}>
                                <div className="flex items-center justify-end gap-1">ACOS <ArrowUpDown size={12} className={sortConfig.key === 'acos' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('profit')}>
                                <div className="flex items-center justify-end gap-1">Profit <ArrowUpDown size={12} className={sortConfig.key === 'profit' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('roas')}>
                                <div className="flex items-center justify-end gap-1">ROAS <ArrowUpDown size={12} className={sortConfig.key === 'roas' ? 'text-blue-500' : 'text-gray-400'} /></div>
                            </th>
                            <th className="px-4 py-3 font-bold text-center">Issues</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayPortfolios.map((portfolio) => {
                            const isExpanded = expandedRows.has(portfolio.name);
                            const totalSales = portfolio.campaigns.reduce((sum, c) => sum + (c.sales || 0), 0);
                            const totalSpend = portfolio.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
                            const totalOrders = portfolio.campaigns.reduce((sum, c) => sum + (c.orders || 0), 0);
                            const profit = totalSales - totalSpend;
                            const pAcos = getAcos(totalSales, totalSpend);
                            const pRoas = getRoas(totalSales, totalSpend);

                            const hasBleeding = portfolio.campaigns.some(c => c.spend > 0 && (!c.sales || c.sales === 0));

                            // Style calculation based on tier
                            let bgClass = 'bg-white hover:bg-gray-50';
                            let borderClass = 'border-l-4 border-l-transparent';

                            if (totalSpend > 0) {
                                if (pAcos > 100 || (totalSales === 0 && totalSpend > 0)) {
                                    bgClass = 'bg-red-50/50 hover:bg-red-50/80';
                                    borderClass = 'border-l-4 border-l-red-500';
                                } else if (pAcos >= 60) {
                                    bgClass = 'bg-orange-50/30 hover:bg-orange-50/60';
                                    borderClass = 'border-l-4 border-l-orange-500';
                                } else if (pAcos >= 30) {
                                    borderClass = 'border-l-4 border-l-yellow-400';
                                } else {
                                    bgClass = 'bg-green-50/20 hover:bg-green-50/40';
                                    borderClass = 'border-l-4 border-l-green-500';
                                }
                            }

                            return (
                                <React.Fragment key={portfolio.name}>
                                    <tr className={`${bgClass} ${borderClass} transition-colors border-b border-gray-100`}>
                                        <td className="px-3 py-3">
                                            <button
                                                onClick={() => toggleRow(portfolio.name)}
                                                className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors focus:outline-none"
                                            >
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-3 py-3 font-bold text-gray-800 text-sm">
                                            {portfolio.name}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-flex items-center justify-center bg-gray-100 border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                {portfolio.campaigns.length}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-700">{formatCurrency(totalSpend)}</td>
                                        <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrency(totalSales)}</td>
                                        <td className="px-4 py-3 text-right text-gray-700 font-medium">{totalOrders}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${pAcos > 60 ? 'text-red-500' : pAcos > 30 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                            {totalSales > 0 ? formatPercent(pAcos) : (totalSpend > 0 ? '∞' : '-')}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                            {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                                            {profit !== 0 && (
                                                <div className="w-16 h-1 mt-1 ml-auto bg-gray-200 rounded-full overflow-hidden flex justify-end">
                                                    <div className={`h-full ${profit > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: Math.min(100, (Math.abs(profit) / Math.max(totalSpend, 1)) * 100) + '%' }} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 font-medium">
                                            {totalSpend > 0 ? (
                                                <span className={pRoas >= 2.5 ? 'text-emerald-600' : pRoas < 1 ? 'text-red-500' : ''}>
                                                    {pRoas.toFixed(2)}x
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center items-center gap-1">
                                                {hasBleeding && <span className="text-red-500" title="Has bleeding campaigns"><TrendingDown size={14} /></span>}
                                                {pAcos > 30 && !hasBleeding && <span className="text-amber-500" title="ACOS above target"><AlertTriangle size={14} /></span>}
                                                {!hasBleeding && pAcos <= 30 && totalSpend > 0 && <span className="text-green-500" title="Healthy"><CheckCircle2 size={14} /></span>}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Campaigns within Portfolio */}
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={10} className="p-0 bg-gray-50 border-b border-gray-200 shadow-inner">
                                                <div className="pl-12 pr-6 py-4">
                                                    <table className="w-full text-xs bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                        <thead className="bg-gray-100 text-gray-500 border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Campaign</th>
                                                                <th className="px-3 py-2 text-center font-bold uppercase tracking-wider text-[10px]">State</th>
                                                                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px]">Spend</th>
                                                                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px]">Sales</th>
                                                                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px]">Orders</th>
                                                                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px]">Clicks</th>
                                                                <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px]">ACOS</th>
                                                                <th className="px-4 py-2 text-center font-bold uppercase tracking-wider text-[10px]">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {[...portfolio.campaigns]
                                                                .sort((a, b) => (b.spend || 0) - (a.spend || 0))
                                                                .map((c, idx) => {
                                                                    const isBleed = c.spend > 0 && (!c.sales || c.sales === 0);
                                                                    const cAcos = c.sales > 0 ? (c.spend / c.sales) * 100 : Infinity;

                                                                    return (
                                                                        <tr key={idx} className={`${isBleed ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-gray-50'} transition-all`}>
                                                                            <td className="px-4 py-2.5 font-medium text-gray-700 truncate max-w-[250px] border-l-2 border-l-transparent" style={{ borderLeftColor: isBleed ? '#ef4444' : cAcos > 60 ? '#f97316' : cAcos > 30 ? '#eab308' : c.spend > 0 ? '#22c55e' : 'transparent' }}>
                                                                                {c.name}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-center">
                                                                                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded max-w-[60px] truncate text-[9px] font-bold ${c.state?.toLowerCase() === 'enabled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                                    {c.state || 'UNK'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-right font-medium text-gray-600">{formatCurrency(c.spend)}</td>
                                                                            <td className="px-3 py-2.5 text-right font-medium text-gray-800">{formatCurrency(c.sales)}</td>
                                                                            <td className="px-3 py-2.5 text-right text-gray-600">{c.orders || 0}</td>
                                                                            <td className="px-3 py-2.5 text-right text-gray-600">{c.clicks || 0}</td>
                                                                            <td className={`px-3 py-2.5 text-right font-bold ${isBleed ? 'text-red-500' : cAcos > 60 ? 'text-orange-500' : cAcos > 30 ? 'text-yellow-600' : 'text-emerald-500'}`}>
                                                                                {c.sales > 0 ? formatPercent(cAcos) : (c.spend > 0 ? '∞' : '-')}
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-center">
                                                                                <button className="px-2 py-1 bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded text-[10px] font-bold transition-colors">
                                                                                    Analyze
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {displayPortfolios.length === 0 && (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                    No portfolios found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PortfolioSummary;
