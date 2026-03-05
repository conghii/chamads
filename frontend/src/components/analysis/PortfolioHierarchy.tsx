import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { PortfolioNode } from '../../types/analysis';

interface Props {
    data: PortfolioNode[];
}

const getAcosColor = (spend: number, sales: number): string => {
    if (sales === 0 && spend > 0) return '#ef4444'; // Red - bleeding
    if (sales === 0) return '#d1d5db'; // Gray - no data
    const acos = (spend / sales) * 100;
    if (acos < 30) return '#22c55e';
    if (acos < 60) return '#eab308';
    if (acos < 100) return '#f97316';
    return '#ef4444';
};

const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PortfolioHierarchy: React.FC<Props> = ({ data }) => {
    // Build nested treemap data using SPEND (not budget which is often 0)
    const treeData = data
        .filter(p => p.campaigns.some(c => c.spend > 0))
        .map(p => {
            const totalSpend = p.campaigns.reduce((s, c) => s + (c.spend || 0), 0);
            const totalSales = p.campaigns.reduce((s, c) => s + (c.sales || 0), 0);
            return {
                name: p.name,
                children: p.campaigns
                    .filter(c => c.spend > 0)
                    .map(c => ({
                        name: c.name,
                        size: c.spend,
                        spend: c.spend,
                        sales: c.sales || 0,
                        acos: c.sales > 0 ? (c.spend / c.sales) * 100 : (c.spend > 0 ? Infinity : 0),
                        roas: c.spend > 0 ? (c.sales || 0) / c.spend : 0,
                        color: getAcosColor(c.spend, c.sales || 0),
                    })),
                size: totalSpend,
                spend: totalSpend,
                sales: totalSales,
                acos: totalSales > 0 ? (totalSpend / totalSales) * 100 : (totalSpend > 0 ? Infinity : 0),
                roas: totalSpend > 0 ? totalSales / totalSpend : 0,
                color: getAcosColor(totalSpend, totalSales),
            };
        })
        .sort((a, b) => b.spend - a.spend);

    const CustomContent = (props: any) => {
        const { depth, x, y, width, height, name, color, acos, spend } = props;
        if (width < 3 || height < 3) return null;

        const showLabel = width > 50 && height > 28;
        const showAcos = width > 70 && height > 40;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: color || (depth < 2 ? '#6366f1' : '#a5b4fc'),
                        stroke: depth < 2 ? '#fff' : 'rgba(255,255,255,0.5)',
                        strokeWidth: depth < 2 ? 2 : 1,
                        opacity: 0.9,
                        cursor: 'pointer',
                    }}
                    rx={depth < 2 ? 3 : 1}
                />
                {showLabel && (
                    <text
                        x={x + 6}
                        y={y + 14}
                        fill="#fff"
                        fontSize={depth < 2 ? 11 : 9}
                        fontWeight={depth < 2 ? 700 : 500}
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
                    >
                        {name.length > Math.floor(width / 6) ? name.slice(0, Math.floor(width / 6)) + '…' : name}
                    </text>
                )}
                {showAcos && depth < 2 && (
                    <text
                        x={x + 6}
                        y={y + 28}
                        fill="rgba(255,255,255,0.8)"
                        fontSize={9}
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
                    >
                        {acos != null ? (acos === Infinity ? 'No Sales' : `ACOS: ${acos.toFixed(0)}%`) : ''} {spend != null ? `· ${formatCurrency(spend)}` : ''}
                    </text>
                )}
            </g>
        );
    };

    return (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Portfolio Hierarchy</h3>
                    <p className="text-xs text-gray-500">Size = Spend. Color = ACOS performance.</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> &lt;30%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500"></span> 30-60%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500"></span> 60-100%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> &gt;100%</span>
                </div>
            </div>

            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        stroke="#fff"
                        content={<CustomContent />}
                        animationDuration={300}
                    >
                        <Tooltip
                            content={({ payload }) => {
                                if (payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-xs">
                                            <p className="text-white font-bold mb-1">{d.name}</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-300">
                                                <span>Spend:</span><span className="text-right">{formatCurrency(d.spend)}</span>
                                                <span>Sales:</span><span className="text-right">{formatCurrency(d.sales)}</span>
                                                <span>ACOS:</span><span className={`text-right font-bold ${d.acos > 60 ? 'text-red-400' : d.acos > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {d.acos === Infinity ? '∞' : d.acos.toFixed(1) + '%'}
                                                </span>
                                                <span>ROAS:</span><span className="text-right">{d.roas.toFixed(2)}x</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PortfolioHierarchy;
