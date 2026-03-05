import React from 'react';
import type { CampaignNode, TopCampaign } from '../../types/analysis';
import { BanknotesIcon, ChartBarIcon, CurrencyDollarIcon, ShoppingBagIcon, FireIcon } from '@heroicons/react/24/solid';

interface Props {
    campaigns: CampaignNode[] | TopCampaign[];
    wastedSpend?: number;
    targetAcos?: number;
    onWastedSpendClick?: () => void;
    businessReportTotalSales?: number;
}

const PerformanceSummary: React.FC<Props> = ({ campaigns, wastedSpend = 0, targetAcos = 30, onWastedSpendClick, businessReportTotalSales }) => {
    // Calculate totals
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalSales = campaigns.reduce((sum, c) => sum + (c.sales || 0), 0);
    const totalOrders = campaigns.reduce((sum, c) => sum + (c.orders || 0), 0);
    const totalClics = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalBudget = campaigns.reduce((sum, c) => sum + (('budget' in c ? (c as any).budget : 0) || 0), 0);

    // Derived metrics
    const overallACOS = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
    const overallROAS = totalSpend > 0 ? totalSales / totalSpend : 0;
    const overallCPC = totalClics > 0 ? totalSpend / totalClics : 0;
    const overallCVR = totalClics > 0 ? (totalOrders / totalClics) * 100 : 0;
    const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
    const wastedSpendPercent = totalSpend > 0 ? (wastedSpend / totalSpend) * 100 : 0;
    const bleedingCampaignsCount = campaigns.filter(c => c.spend > 0 && (!c.sales || c.sales === 0)).length;

    // TACoS Calculation
    const overallTACoS = businessReportTotalSales && businessReportTotalSales > 0
        ? (totalSpend / businessReportTotalSales) * 100
        : null;

    const cards = [
        {
            title: 'Total Sales',
            value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales),
            subValue: `${totalOrders} Orders`,
            icon: CurrencyDollarIcon,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            trend: <span className="text-gray-500 font-medium">— Avg ${(totalSales / 7).toFixed(0)}/day</span>
        },
        {
            title: 'Total Spend',
            value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSpend),
            subValue: `CPC: $${overallCPC.toFixed(2)}`,
            icon: BanknotesIcon,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
            borderColor: 'border-amber-200',
            trend: budgetUtilization > 0 ? <span className="text-gray-500 font-medium">Usage: {budgetUtilization.toFixed(1)}%</span> : null
        },
        {
            title: 'ACOS' + (overallTACoS !== null ? ' (PPC)' : ''),
            value: `${overallACOS.toFixed(2)}%`,
            subValue: `ROAS: ${overallROAS.toFixed(2)}x` + (overallTACoS !== null ? ` | TACoS: ${overallTACoS.toFixed(1)}%` : ''),
            icon: ChartBarIcon,
            color: overallACOS > targetAcos ? 'text-rose-600' : 'text-blue-600',
            bgColor: overallACOS > targetAcos ? 'bg-rose-50' : 'bg-blue-50',
            borderColor: overallACOS > targetAcos ? 'border-rose-200' : 'border-blue-200',
            trend: (
                <div className="flex items-center gap-2 mt-1 w-full relative">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden flex min-w-[60px]">
                        <div className="h-full bg-green-500" style={{ width: Math.min(30, overallACOS) + '%' }} />
                        {overallACOS > 30 && <div className="h-full bg-yellow-500" style={{ width: Math.min(20, overallACOS - 30) + '%' }} />}
                        {overallACOS > 50 && <div className="h-full bg-red-500" style={{ width: Math.min(50, overallACOS - 50) + '%' }} />}
                    </div>
                    <span className="text-gray-500 font-medium whitespace-nowrap hidden sm:inline">Target: {targetAcos}%</span>
                </div>
            )
        },
        {
            title: 'Orders',
            value: totalOrders,
            subValue: `${totalClics} Clicks`,
            icon: ShoppingBagIcon,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            trend: <span className="text-gray-500 font-medium">CVR: {overallCVR.toFixed(2)}%</span>
        },
        {
            title: 'Wasted Spend',
            value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(wastedSpend),
            subValue: `${wastedSpendPercent.toFixed(1)}% of total spend`,
            icon: FireIcon,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            trend: <span className="text-red-500 font-medium font-medium">{bleedingCampaignsCount} bleeding campaigns</span>
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {cards.map((card, idx) => {
                const isWastedSpend = card.title === 'Wasted Spend';
                return (
                    <div
                        key={idx}
                        className={`rounded-xl p-3.5 border ${card.borderColor} ${card.bgColor} shadow-sm transition-all hover:shadow-md flex flex-col justify-between min-h-[120px] ${isWastedSpend && onWastedSpendClick ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}`}
                        onClick={isWastedSpend ? onWastedSpendClick : undefined}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1.5 opacity-90">
                                <p className={`text-xs font-bold uppercase tracking-wider ${card.color}`}>{card.title}</p>
                                <card.icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                            <div className="text-[26px] leading-[30px] font-black text-gray-800 mb-0.5 tracking-tight truncate whitespace-nowrap" title={String(card.value)}>
                                {card.value}
                            </div>
                            <div className={`text-xs font-medium text-gray-500 truncate`}>
                                {card.subValue}
                            </div>
                        </div>
                        {card.trend && (
                            <div className="mt-2 text-xs truncate flex items-end">
                                {card.trend}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    );
};

export default PerformanceSummary;
