import React, { useState, useEffect } from 'react';
import { UploadComponent } from './UploadComponent';
import { useUploadHistory } from '../services/uploadHistoryService';
import type { MasterKeywordRecord, RawFileType } from '../types';
import classNames from 'classnames';
import { BarChart2, Search, Brain, TrendingUp, CheckCircle, Clock, Trash2, ExternalLink, RefreshCw, Briefcase } from 'lucide-react';

export function DataHub() {
    const { history, getLatestSuccessRecord, deleteRecord } = useUploadHistory();
    const [isProcessing, setIsProcessing] = useState(false);
    const [businessReportSource, setBusinessReportSource] = useState<any>(null);

    useEffect(() => {
        const fetchBusinessReportData = async () => {
            try {
                // Using team1 as default for now to match backend
                const response = await fetch('http://localhost:3000/api/business-report/metadata/team1');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.status) {
                        setBusinessReportSource(data);
                    }
                }
            } catch (error) {
                console.error("Error fetching business report metadata:", error);
            }
        };
        fetchBusinessReportData();
    }, []);

    const handleDataProcessed = (_processedData: MasterKeywordRecord[], _raw: any[], _type: RawFileType) => {
        // UI uses history now, no need to keep huge datasets in local state for preview
    };

    const handleSyncRequest = async (data: MasterKeywordRecord[], rawData: any[], fileType: RawFileType) => {
        setIsProcessing(true);
        try {
            const response = await fetch('http://localhost:3000/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data, rawData, fileType }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                const errorMsg = responseData.details || responseData.error || 'Failed to sync data';
                throw new Error(errorMsg);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const getFreshness = (dateString: string) => {
        const d = new Date(dateString);
        const now = new Date();
        const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

        if (diffHours < 24) return {
            text: diffHours < 1 ? 'Vừa xong' : `${Math.floor(diffHours)} giờ trước`,
            color: 'text-green-600',
            borderColor: 'border-green-500'
        };
        if (diffHours < 168) return {
            text: `${Math.floor(diffHours / 24)} ngày trước`,
            color: 'text-yellow-600',
            borderColor: 'border-yellow-500'
        };
        return {
            text: `${Math.floor(diffHours / 24)} ngày trước`,
            color: 'text-red-500',
            borderColor: 'border-red-500'
        };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const latestBulk = getLatestSuccessRecord(['AMAZON_BULK', 'MULTI_SHEET']);
    const latestST = getLatestSuccessRecord('AMAZON_SEARCH_TERM');
    const latestCerebro = getLatestSuccessRecord(['HELIUM10_CEREBRO_COMP', 'HELIUM10_CEREBRO_MY_ASIN']);
    const latestTracker = getLatestSuccessRecord('HELIUM10_KEYWORD_TRACKER');

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const renderDataSourceCard = (
        title: string,
        icon: React.ReactNode,
        record: any,
        typeText: string
    ) => {
        const hasData = !!record;
        const freshness = record ? getFreshness(record.date) : null;

        return (
            <div className={classNames(
                "bg-white rounded-xl shadow-sm border p-5 flex flex-col justify-between transition-all",
                hasData ? `border-l-4 ${freshness?.borderColor} border-y-gray-200 border-r-gray-200` : "border-l-4 border-l-gray-300 border-y-gray-200 border-r-gray-200 opacity-80"
            )}>
                <div>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <div className={hasData ? "text-slate-800" : "text-slate-400"}>
                                {icon}
                            </div>
                            <h3 className={classNames("font-bold", hasData ? "text-slate-800" : "text-slate-500")}>{title}</h3>
                        </div>
                        {hasData ? (
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle size={10} /> CONNECTED
                            </span>
                        ) : (
                            <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                CHƯA CÓ DATA
                            </span>
                        )}
                    </div>

                    {hasData ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">{record.stats || `${record.rowsCount.toLocaleString()} rows`}</p>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock size={12} /> {formatDate(record.date)}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className={`text-xs font-semibold ${freshness?.color}`}>
                                    {freshness?.text}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-500">Upload file {typeText} để bắt đầu</p>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t flex gap-2">
                    {hasData ? (
                        <>
                            <button onClick={scrollToTop} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                <RefreshCw size={12} /> Cập nhật
                            </button>
                            <a href="https://docs.google.com/spreadsheets/" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 ml-auto">
                                <ExternalLink size={12} /> Sheets
                            </a>
                        </>
                    ) : (
                        <button onClick={scrollToTop} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-md w-full transition-colors">
                            Upload Ngay
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderOnboarding = () => {
        const hasAnyData = latestBulk || latestST || latestCerebro || latestTracker;
        if (hasAnyData || history.length > 0) return null;

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto my-8">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">👋 Chào mừng! Hãy bắt đầu bằng cách upload data</h2>
                    <p className="text-slate-600">Hoàn thành các bước sau để ChamMPPC có đầy đủ dữ liệu phân tích.</p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="mt-1 bg-white border border-blue-200 w-6 h-6 rounded flex items-center justify-center"></div>
                        <div>
                            <h4 className="font-semibold text-slate-800">1. Upload Amazon Bulk Report</h4>
                            <p className="text-sm text-slate-600 mb-2">Để phân tích campaigns PPC và chi phí.</p>
                            <details className="text-xs text-slate-500 bg-white p-3 rounded border">
                                <summary className="cursor-pointer font-medium text-blue-600 outline-none">Xem Hướng dẫn</summary>
                                <ul className="list-disc pl-4 mt-2 space-y-1">
                                    <li>Đăng nhập Amazon Ads Console (advertising.amazon.com)</li>
                                    <li>Vào Campaign Manager → Bulk Operations</li>
                                    <li>Chọn "Download Bulk File" → Sponsored Products</li>
                                    <li>Tải file .xlsx về máy và kéo thả lên trên ↑</li>
                                </ul>
                            </details>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-lg bg-purple-50 border border-purple-100">
                        <div className="mt-1 bg-white border border-purple-200 w-6 h-6 rounded flex items-center justify-center"></div>
                        <div>
                            <h4 className="font-semibold text-slate-800">2. Upload Search Term Report</h4>
                            <p className="text-sm text-slate-600 mb-2">Để tìm keywords harvest/negate tiềm năng.</p>
                            <details className="text-xs text-slate-500 bg-white p-3 rounded border">
                                <summary className="cursor-pointer font-medium text-purple-600 outline-none">Xem Hướng dẫn</summary>
                                <ul className="list-disc pl-4 mt-2 space-y-1">
                                    <li>Tại Amazon Ads Console, vào Reports → Create report</li>
                                    <li>Chọn Report type: Search term</li>
                                    <li>Tải file về máy và kéo thả lên trên ↑</li>
                                </ul>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Data Hub</h1>
                    <p className="text-slate-500 mt-1">Upload and manage your Amazon Ads data</p>
                </div>
                {/* Outdated Data Warning could go here */}
            </div>

            <div className="space-y-8">
                {/* UPLOAD SECTION (Top 40%) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">1. Nguồn Dữ Liệu Mới</h2>
                    <UploadComponent
                        onDataProcessed={handleDataProcessed}
                        onSyncRequest={handleSyncRequest}
                        isProcessing={isProcessing}
                    />
                </div>

                {renderOnboarding()}

                {/* DATA SOURCES OVERVIEW (Bottom 60%) */}
                {(history.length > 0) && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-slate-800 pt-4">2. Data Sources Hiện Tại</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 shadow-sm">
                            {renderDataSourceCard('Amazon Bulk', <BarChart2 size={24} />, latestBulk, 'Bulk Report')}
                            {renderDataSourceCard('Search Term', <Search size={24} />, latestST, 'Search Term')}
                            {renderDataSourceCard('Cerebro', <Brain size={24} />, latestCerebro, 'Cerebro csv')}
                            {renderDataSourceCard('Keyword Tracker', <TrendingUp size={24} />, latestTracker, 'Tracker csv')}
                            {renderDataSourceCard('Business Report', <Briefcase size={24} />, businessReportSource ? {
                                date: businessReportSource.lastUpdated?.toDate ? businessReportSource.lastUpdated.toDate() : businessReportSource.lastUpdated,
                                stats: `$${(businessReportSource.totalSales || 0).toLocaleString()} • ${(businessReportSource.totalUnits || 0).toLocaleString()} units`,
                                _src: 'firestore'
                            } : null, 'Business Report')}
                        </div>

                        {/* UPLOAD HISTORY CACHE */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-slate-800">Lịch Sử Upload</h3>
                                <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                    {history.length} bản ghi
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-500 border-b">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Thời gian</th>
                                            <th className="px-6 py-3 font-medium">File Name</th>
                                            <th className="px-6 py-3 font-medium">Type</th>
                                            <th className="px-6 py-3 font-medium">Rows</th>
                                            <th className="px-6 py-3 font-medium">Status</th>
                                            <th className="px-6 py-3 font-medium"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {history.map(record => (
                                            <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{formatDate(record.date)}</td>
                                                <td className="px-6 py-3 font-medium text-gray-800">{record.fileName}</td>
                                                <td className="px-6 py-3 text-gray-600">
                                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{record.fileType}</span>
                                                </td>
                                                <td className="px-6 py-3 text-gray-600">{record.rowsCount.toLocaleString()}</td>
                                                <td className="px-6 py-3">
                                                    {record.status === 'Success' && <span className="text-green-600 flex items-center gap-1 font-medium"><CheckCircle size={14} /> Success</span>}
                                                    {record.status === 'Failed' && <span className="text-red-600 flex items-center gap-1 font-medium" title={record.errorMsg}><CheckCircle size={14} /> Failed</span>}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={scrollToTop}
                                                            className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1"
                                                        >
                                                            <RefreshCw size={14} /> Re-upload
                                                        </button>
                                                        <button
                                                            onClick={() => deleteRecord(record.id)}
                                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                                            title="Delete record from history"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {history.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                    Chưa có lịch sử upload
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
