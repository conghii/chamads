import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Edit3, Package, Plus, Search, FileText, BarChart2, CheckCircle, AlertTriangle, List, Grid, TrendingUp } from 'lucide-react';
import type { ProductDetail } from '../../types';
import classNames from 'classnames';

import { AsinEditPanel } from './AsinEditPanel';
import { AddProductDialog } from './AddProductDialog';
import { API_BASE_URL } from '../../config/api';

export const MyAsin: React.FC = () => {
    const [products, setProducts] = useState<ProductDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filterBy, setFilterBy] = useState<'ALL' | 'ACTIVE' | 'NEEDS_UPDATE' | 'NO_DATA'>('ALL');
    const [sortBy, setSortBy] = useState<'NAME_ASC' | 'SALES_DESC' | 'ACOS_ASC'>('NAME_ASC');

    // Selection state for Bulk Actions
    const [selectedAsins, setSelectedAsins] = useState<Set<string>>(new Set());

    // Panel States
    const [editingProduct, setEditingProduct] = useState<ProductDetail | string | null>(null); // string for 'NEW' or ASIN
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Mock Performance Data (In real app, fetch from /api/analysis/bulk and /api/ranking)
    const [performanceData, setPerformanceData] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchProducts();
        fetchPerformanceMock();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            const result = await response.json();
            setProducts(result);
        } catch (err: any) {
            console.error(err.message || 'Error loading products');
        } finally {
            setLoading(false);
        }
    };

    const fetchPerformanceMock = async () => {
        // Mocking aggregate data since we don't have a global store yet
        // In real implementation, this would trigger fetches to analysis endpoints
        setTimeout(() => {
            const mockData: Record<string, any> = {
                'B0DTQ34TKQ': { sales: 1473.50, acos: 67.9, top10Kw: 324, bestRank: 2, bestKw: 'positive pickle jar' },
                'B0FVYHB1BG': { sales: 850.00, acos: 45.2, top10Kw: 156, bestRank: 5, bestKw: 'cute gifts' }
            };
            setPerformanceData(mockData);
        }, 1000);
    };

    const handleSaveProduct = async (productData: ProductDetail | ProductDetail[]) => {
        try {
            const productsToSave = Array.isArray(productData) ? productData : [productData];
            const promises = productsToSave.map(p =>
                fetch(`${API_BASE_URL}/api/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(p)
                })
            );

            const responses = await Promise.all(promises);
            const failed = responses.filter(r => !r.ok);

            if (failed.length > 0) throw new Error(`${failed.length} products failed to save`);

            setEditingProduct(null);
            setIsAddDialogOpen(false);
            fetchProducts();
        } catch (err: any) {
            alert('Lỗi khi lưu sản phẩm: ' + err.message);
        }
    };

    const calculateCompleteness = (product: ProductDetail) => {
        let score = 0;
        if (product.title) score += 25;
        if (product.bulletPoints && product.bulletPoints.length > 10) score += 25;
        if (product.description && product.description.length > 10) score += 25;
        if (product.genericKeywords && product.genericKeywords.length > 5) score += 25;
        return score;
    };

    const calculateHealthScore = (product: ProductDetail) => {
        const comp = calculateCompleteness(product);
        const perf = performanceData[product.asin] ? 85 : 0; // Mock perf score
        // Rough formula: 40% listing, 60% perf
        return Math.floor((comp * 0.4) + (perf * 0.6));
    };

    // Filter & Sort Logic
    const processedProducts = useMemo(() => {
        let result = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filterBy === 'ACTIVE') result = result.filter(p => p.status === 'Active');
        if (filterBy === 'NEEDS_UPDATE') result = result.filter(p => calculateCompleteness(p) < 100);
        if (filterBy === 'NO_DATA') result = result.filter(p => !performanceData[p.asin]);

        result.sort((a, b) => {
            if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
            if (sortBy === 'SALES_DESC') return (performanceData[b.asin]?.sales || 0) - (performanceData[a.asin]?.sales || 0);
            if (sortBy === 'ACOS_ASC') {
                const acosA = performanceData[a.asin]?.acos || 999;
                const acosB = performanceData[b.asin]?.acos || 999;
                return acosA - acosB;
            }
            return 0;
        });

        return result;
    }, [products, searchTerm, filterBy, sortBy, performanceData]);

    const activeCount = products.filter(p => p.status === 'Active').length;
    const withDataCount = products.filter(p => performanceData[p.asin]).length;
    const completeCount = products.filter(p => calculateCompleteness(p) === 100).length;

    const toggleSelection = (asin: string) => {
        const newSet = new Set(selectedAsins);
        if (newSet.has(asin)) newSet.delete(asin);
        else newSet.add(asin);
        setSelectedAsins(newSet);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-4">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="animate-pulse tracking-widest uppercase text-xs font-bold">Đang tải danh sách ASIN...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            {/* Header Section */}
            <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Package className="text-blue-600" size={32} />
                        My ASIN Cabinet
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium"> Quản lý nội dung Listing, SKU và định dạng sản phẩm đồng bộ với Google Sheets.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Thêm Sản Phẩm
                    </button>
                </div>
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-lg"><Package size={20} /></div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Tổng ASIN</p>
                        <p className="text-2xl font-black text-slate-800">{products.length}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
                    <div className="bg-green-50 text-green-600 p-3 rounded-lg"><CheckCircle size={20} /></div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Đang Active</p>
                        <p className="text-2xl font-black text-slate-800">{activeCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
                    <div className="bg-purple-50 text-purple-600 p-3 rounded-lg"><BarChart2 size={20} /></div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Có Data PPC</p>
                        <p className="text-2xl font-black text-slate-800">{withDataCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg"><FileText size={20} /></div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Listing 100%</p>
                        <p className="text-2xl font-black text-slate-800">{completeCount}</p>
                    </div>
                </div>
            </div>

            {/* Filters & Toolbar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2">
                    <button onClick={() => setFilterBy('ALL')} className={classNames("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", filterBy === 'ALL' ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>Tất cả</button>
                    <button onClick={() => setFilterBy('ACTIVE')} className={classNames("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", filterBy === 'ACTIVE' ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>Active</button>
                    <button onClick={() => setFilterBy('NEEDS_UPDATE')} className={classNames("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", filterBy === 'NEEDS_UPDATE' ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>Cần Cập Nhật</button>
                    <button onClick={() => setFilterBy('NO_DATA')} className={classNames("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", filterBy === 'NO_DATA' ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>Không Data PPC</button>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5"
                    >
                        <option value="NAME_ASC">Tên A-Z</option>
                        <option value="SALES_DESC">Sales: Cao → Thấp</option>
                        <option value="ACOS_ASC">ACOS: Thấp → Cao</option>
                    </select>

                    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button onClick={() => setViewMode('grid')} className={classNames("p-1.5 transition-colors", viewMode === 'grid' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")} title="Grid View"><Grid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={classNames("p-1.5 transition-colors", viewMode === 'list' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")} title="List View"><List size={18} /></button>
                    </div>
                </div>
            </div>

            {/* Grid Layout */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {processedProducts.length > 0 ? processedProducts.map((product) => {
                        const perf = performanceData[product.asin];
                        const completeness = calculateCompleteness(product);
                        const isMissingName = !product.name || product.name === 'N/A';
                        const score = calculateHealthScore(product);

                        return (
                            <div key={product.asin}
                                className={classNames(
                                    "bg-white rounded-2xl border transition-all duration-200 relative group flex flex-col",
                                    isMissingName ? "border-slate-300 border-dashed opacity-80" : "border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1",
                                    product.status === 'Active' && !isMissingName ? "border-l-4 border-l-green-500" : ""
                                )}
                            >
                                {/* Checkbox for Bulk Actions */}
                                <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <input
                                        type="checkbox"
                                        checked={selectedAsins.has(product.asin)}
                                        onChange={() => toggleSelection(product.asin)}
                                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                                    />
                                </div>
                                {(selectedAsins.has(product.asin)) && (
                                    <div className="absolute top-4 left-4 z-10">
                                        <input type="checkbox" checked={true} onChange={() => toggleSelection(product.asin)} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
                                    </div>
                                )}

                                {/* Health Score Badge */}
                                {!isMissingName && (
                                    <div className="absolute top-4 right-4 z-10">
                                        <div className={classNames(
                                            "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shadow-sm",
                                            score > 75 ? "bg-green-500" : score > 40 ? "bg-yellow-500" : "bg-red-500"
                                        )} title="ASIN Health Score">
                                            {score}
                                        </div>
                                    </div>
                                )}

                                {/* Card Header */}
                                <div className="p-5 flex gap-4 border-b border-slate-100">
                                    <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200 overflow-hidden ml-6">
                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} alt={product.asin} className="w-full h-full object-cover" />
                                        ) : (
                                            <Package size={24} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-8">
                                        {isMissingName ? (
                                            <div className="flex items-center gap-1 text-amber-600 font-bold text-sm mb-1 bg-amber-50 px-2 py-0.5 rounded w-max">
                                                <AlertTriangle size={14} /> Chưa có tên
                                            </div>
                                        ) : (
                                            <h3 className="font-bold text-slate-800 text-base leading-tight mb-2 truncate" title={product.name}>{product.name}</h3>
                                        )}

                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono font-medium border border-slate-200 flex items-center gap-1 cursor-copy" title="Copy ASIN" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(product.asin); }}>
                                                {product.asin}
                                            </span>
                                            {product.sku && (
                                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-mono font-medium border border-blue-100 truncate max-w-[100px]" title={product.sku}>
                                                    {product.sku}
                                                </span>
                                            )}
                                            {product.status === 'Active' && <span className="bg-green-100 text-green-700 w-2 h-2 rounded-full" title="Active"></span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Performance Section */}
                                <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex-1">
                                    {perf ? (
                                        <div className="space-y-3 pl-6">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500 flex items-center gap-1"><BarChart2 size={14} /> Sales:</span>
                                                <span className="font-bold text-slate-800">${perf.sales.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">ACOS:</span>
                                                <span className={classNames("font-bold", perf.acos < 30 ? "text-green-600" : perf.acos < 50 ? "text-yellow-600" : "text-red-600")}>{perf.acos}%</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Keywords in Top 10:</span>
                                                <span className="font-bold text-blue-600">{perf.top10Kw}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Best Rank:</span>
                                                <span className="font-medium text-slate-700 truncate max-w-[120px]" title={perf.bestKw}>#{perf.bestRank} "{perf.bestKw}"</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-4 ml-6">
                                            <BarChart2 size={24} className="mb-2 opacity-50" />
                                            <p className="text-xs">Chưa có data PPC<br />Upload Amazon Bulk để xem</p>
                                        </div>
                                    )}
                                </div>

                                {/* Listing Completeness */}
                                <div className="p-5 pt-4">
                                    <div className="flex justify-between items-center mb-2 pl-6">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Listing Content</span>
                                        <span className="text-xs font-bold text-slate-700">{completeness}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3 ml-6 w-[calc(100%-1.5rem)]">
                                        <div className={classNames("h-full transition-all", completeness === 100 ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${completeness}%` }}></div>
                                    </div>
                                    <div className="flex gap-2 justify-between ml-6">
                                        <span className={classNames("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", product.title ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>Title {product.title ? '✓' : '✗'}</span>
                                        <span className={classNames("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", product.bulletPoints ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>Bullets {product.bulletPoints ? '✓' : '✗'}</span>
                                        <span className={classNames("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", product.description ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>Desc {product.description ? '✓' : '✗'}</span>
                                        <span className={classNames("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", product.genericKeywords ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>KWs {product.genericKeywords ? '✓' : '✗'}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex divide-x divide-slate-200">
                                    <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors py-2">
                                        <BarChart2 size={14} /> Intel
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors py-2">
                                        <TrendingUp size={14} /> Rank
                                    </button>
                                    <button
                                        onClick={() => setEditingProduct(product)}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors py-2 rounded-br-xl"
                                    >
                                        <Edit3 size={14} /> Edit
                                    </button>
                                </div>
                            </div>
                        )
                    }) : (
                        <div className="col-span-1 md:col-span-2 xl:col-span-3 py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700 mb-1">Không tìm thấy ASIN nào</h3>
                            <p className="text-slate-500 text-sm mb-4">Bạn chưa có sản phẩm nào hoặc thử thay đổi bộ lọc tìm kiếm.</p>
                            <button onClick={() => setIsAddDialogOpen(true)} className="text-blue-600 font-semibold hover:underline">Thêm sản phẩm mới</button>
                        </div>
                    )}
                </div>
            )}

            {/* List Layout (Fallback) */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                            <tr>
                                <th className="px-6 py-3 font-semibold">ASIN / SKU</th>
                                <th className="px-6 py-3 font-semibold">Tên Sản Phẩm</th>
                                <th className="px-6 py-3 font-semibold">Performance</th>
                                <th className="px-6 py-3 font-semibold">Listing Score</th>
                                <th className="px-6 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {processedProducts.map(p => (
                                <tr key={p.asin} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-bold text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded w-max mb-1 border border-slate-200">{p.asin}</div>
                                        {p.sku && <div className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max border border-blue-100 truncate max-w-[120px]">{p.sku}</div>}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-800 max-w-[200px] truncate">{p.name || <span className="text-amber-600 font-normal italic">Chưa có tên</span>}</td>
                                    <td className="px-6 py-4">
                                        {performanceData[p.asin] ? (
                                            <div className="text-xs space-y-1">
                                                <span className="font-semibold text-slate-700">${performanceData[p.asin].sales.toLocaleString()}</span> |
                                                <span className={performanceData[p.asin].acos < 50 ? 'text-green-600' : 'text-red-500'}> {performanceData[p.asin].acos}% ACOS</span>
                                            </div>
                                        ) : <span className="text-xs text-slate-400">N/A</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: `${calculateCompleteness(p)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500">{calculateCompleteness(p)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setEditingProduct(p)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"><Edit3 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Floating Bulk Actions Bar */}
            {selectedAsins.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-40 border border-slate-700 animate-in slide-in-from-bottom-5">
                    <div className="font-bold">
                        Đã chọn <span className="text-blue-400">{selectedAsins.size}</span> ASIN
                    </div>
                    <div className="w-px h-6 bg-slate-600"></div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors">So sánh Đỉnh</button>
                        <button className="px-3 py-1.5 rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors">Đổi Status</button>
                        <button className="px-3 py-1.5 rounded-lg hover:bg-red-900/50 text-red-400 text-sm font-medium transition-colors">Xóa</button>
                    </div>
                    <button onClick={() => setSelectedAsins(new Set())} className="ml-2 p-1 hover:bg-slate-700 rounded-full"><Plus className="rotate-45" size={20} /></button>
                </div>
            )}

            {editingProduct && typeof editingProduct !== 'string' && (
                <AsinEditPanel
                    product={editingProduct}
                    onClose={() => setEditingProduct(null)}
                    onSave={handleSaveProduct}
                    performanceData={performanceData[editingProduct.asin]}
                />
            )}

            {isAddDialogOpen && (
                <AddProductDialog
                    onClose={() => setIsAddDialogOpen(false)}
                    onSave={handleSaveProduct}
                    existingAsins={products.map(p => p.asin.toUpperCase())}
                />
            )}
        </div>
    );
};
