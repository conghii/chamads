import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseFile } from '../utils/fileParser';
import { processData, enrichRawData } from '../utils/dataProcessor';
import type { MasterKeywordRecord, RawFileType } from '../types';
import classNames from 'classnames';
import { UploadCloud, FileSpreadsheet, Search, Brain, TrendingUp, AlertTriangle, CheckCircle, FileCheck, XCircle } from 'lucide-react';
import { useUploadHistory } from '../services/uploadHistoryService';

interface UploadComponentProps {
    onDataProcessed: (data: MasterKeywordRecord[], rawData: any[], fileType: RawFileType) => void;
    onSyncRequest: (data: MasterKeywordRecord[], rawData: any[], fileType: RawFileType) => Promise<void>;
    isProcessing: boolean;
}

type CardType = 'AMAZON_BULK' | 'AMAZON_SEARCH_TERM' | 'HELIUM10_CEREBRO' | 'HELIUM10_KEYWORD_TRACKER' | 'AMAZON_BUSINESS_REPORT' | null;

export const UploadComponent: React.FC<UploadComponentProps> = ({ onDataProcessed, onSyncRequest, isProcessing }) => {
    const { addRecord } = useUploadHistory();
    const [selectedCard, setSelectedCard] = useState<CardType>(null);
    const [h10Subtype, setH10Subtype] = useState<'HELIUM10_CEREBRO_COMP' | 'HELIUM10_CEREBRO_MY_ASIN'>('HELIUM10_CEREBRO_COMP');

    // State for the 3 steps
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [processedData, setProcessedData] = useState<MasterKeywordRecord[]>([]);
    const [detectedType, setDetectedType] = useState<RawFileType | 'UNKNOWN'>('UNKNOWN');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const file = acceptedFiles[0];

        // Step 1 check size > 50MB
        if (file.size > 50 * 1024 * 1024) {
            alert('File is too large (> 50MB). Please select a smaller file.');
            return;
        }

        setFileInfo({ name: file.name, size: file.size });
        setStep(1); // Parsing stage

        try {
            let { data, fileType } = await parseFile(file);

            // Override with card selection if applicable
            if (selectedCard === 'AMAZON_BULK') fileType = 'AMAZON_BULK';
            if (selectedCard === 'AMAZON_SEARCH_TERM') fileType = 'AMAZON_SEARCH_TERM';
            if (selectedCard === 'HELIUM10_KEYWORD_TRACKER') fileType = 'HELIUM10_KEYWORD_TRACKER';
            if (selectedCard === 'AMAZON_BUSINESS_REPORT') fileType = 'AMAZON_BUSINESS_REPORT';
            if (selectedCard === 'HELIUM10_CEREBRO') {
                fileType = h10Subtype;
            }

            if (fileType === 'UNKNOWN') {
                alert('Could not auto-detect file type. Please select a format manually from the cards.');
                setFileInfo(null);
                return;
            }

            setDetectedType(fileType);

            // Enrich & process
            const enrichedData = (fileType === 'AMAZON_BULK' || fileType === 'MULTI_SHEET' || fileType === 'AMAZON_PORTFOLIO')
                ? enrichRawData(data as any[])
                : data;

            const processed = processData(fileType, enrichedData as any);

            setParsedData(enrichedData);
            setProcessedData(processed);
            onDataProcessed(processed, enrichedData, fileType);

            // Move to Step 2: Preview
            setStep(2);
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error parsing file.');
            setFileInfo(null);
        }
    }, [selectedCard, h10Subtype, onDataProcessed]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
        },
        disabled: isProcessing || step === 3,
        multiple: false
    });

    const handleUploadClick = async () => {
        setStep(3);
        setUploadProgress(10);
        setUploadError(null);

        try {
            setUploadProgress(45); // Fake progress
            await onSyncRequest(processedData, parsedData, detectedType);
            setUploadProgress(100);

            // Log success to history
            addRecord({
                fileName: fileInfo?.name || 'Unknown File',
                fileType: detectedType,
                rowsCount: parsedData.length,
                status: 'Success',
                stats: `${processedData.length} records processed`,
            });

        } catch (err: any) {
            setUploadProgress(0);
            setUploadError(err.message || 'Error syncing data');
            setStep(2); // Go back to preview

            // Log failure to history
            addRecord({
                fileName: fileInfo?.name || 'Unknown File',
                fileType: detectedType,
                rowsCount: parsedData.length,
                status: 'Failed',
                errorMsg: err.message || 'Error syncing data'
            });
        }
    };

    const resetUpload = () => {
        setStep(1);
        setFileInfo(null);
        setParsedData([]);
        setProcessedData([]);
        setDetectedType('UNKNOWN');
        setUploadProgress(0);
        setUploadError(null);
        onDataProcessed([], [], 'UNKNOWN');
    };

    const renderFileTypeCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <button
                onClick={() => setSelectedCard(selectedCard === 'AMAZON_BULK' ? null : 'AMAZON_BULK')}
                className={classNames("p-4 border rounded-xl text-left transition-all",
                    selectedCard === 'AMAZON_BULK' ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-gray-200 hover:border-blue-300 bg-white"
                )}
            >
                <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className={selectedCard === 'AMAZON_BULK' ? "text-blue-600" : "text-gray-500"} size={20} />
                    <span className="font-semibold text-gray-800 text-sm">Amazon Bulk Report</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Sponsored Products / Brands campaigns</p>
                <p className="text-[10px] text-gray-400">Từ: Amazon Ads Console → Bulk Operations → Download</p>
            </button>

            <button
                onClick={() => setSelectedCard(selectedCard === 'AMAZON_SEARCH_TERM' ? null : 'AMAZON_SEARCH_TERM')}
                className={classNames("p-4 border rounded-xl text-left transition-all",
                    selectedCard === 'AMAZON_SEARCH_TERM' ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200" : "border-gray-200 hover:border-purple-300 bg-white"
                )}
            >
                <div className="flex items-center gap-2 mb-2">
                    <Search className={selectedCard === 'AMAZON_SEARCH_TERM' ? "text-purple-600" : "text-gray-500"} size={20} />
                    <span className="font-semibold text-gray-800 text-sm">Search Term Report</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">SP Search Term & Targeting reports</p>
                <p className="text-[10px] text-gray-400">Từ: Amazon Ads Console → Reports → Search Term</p>
            </button>

            <div className={classNames("p-4 border rounded-xl transition-all",
                selectedCard === 'HELIUM10_CEREBRO' ? "border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200" : "border-gray-200 hover:border-yellow-300 bg-white"
            )}
            >
                <button
                    onClick={() => setSelectedCard(selectedCard === 'HELIUM10_CEREBRO' ? null : 'HELIUM10_CEREBRO')}
                    className="w-full text-left"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Brain className={selectedCard === 'HELIUM10_CEREBRO' ? "text-yellow-600" : "text-gray-500"} size={20} />
                        <span className="font-semibold text-gray-800 text-sm">Helium 10 Cerebro</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Keyword research — 1 ASIN hoặc multi-ASIN</p>
                </button>
                {selectedCard === 'HELIUM10_CEREBRO' && (
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setH10Subtype('HELIUM10_CEREBRO_COMP'); }}
                            className={classNames("px-2 py-1 text-[10px] rounded-md font-medium flex-1 text-center",
                                h10Subtype === 'HELIUM10_CEREBRO_COMP' ? "bg-yellow-600 text-white" : "bg-yellow-100 text-yellow-800")}
                        >Multi-ASIN</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setH10Subtype('HELIUM10_CEREBRO_MY_ASIN'); }}
                            className={classNames("px-2 py-1 text-[10px] rounded-md font-medium flex-1 text-center",
                                h10Subtype === 'HELIUM10_CEREBRO_MY_ASIN' ? "bg-yellow-600 text-white" : "bg-yellow-100 text-yellow-800")}
                        >Single ASIN</button>
                    </div>
                )}
            </div>

            <button
                onClick={() => setSelectedCard(selectedCard === 'HELIUM10_KEYWORD_TRACKER' ? null : 'HELIUM10_KEYWORD_TRACKER')}
                className={classNames("p-4 border rounded-xl text-left transition-all",
                    selectedCard === 'HELIUM10_KEYWORD_TRACKER' ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200" : "border-gray-200 hover:border-emerald-300 bg-white"
                )}
            >
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={selectedCard === 'HELIUM10_KEYWORD_TRACKER' ? "text-emerald-600" : "text-gray-500"} size={20} />
                    <span className="font-semibold text-gray-800 text-sm">Keyword Tracker</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Ranking data theo ngày</p>
                <p className="text-[10px] text-gray-400">Export từ: Helium 10 → Keyword Tracker</p>
            </button>

            <button
                onClick={() => setSelectedCard(selectedCard === 'AMAZON_BUSINESS_REPORT' ? null : 'AMAZON_BUSINESS_REPORT')}
                className={classNames("p-4 border rounded-xl text-left transition-all",
                    selectedCard === 'AMAZON_BUSINESS_REPORT' ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200" : "border-gray-200 hover:border-orange-300 bg-white"
                )}
            >
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={selectedCard === 'AMAZON_BUSINESS_REPORT' ? "text-orange-600" : "text-gray-500"} size={20} />
                    <span className="font-semibold text-gray-800 text-sm">Business Report</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Tổng Sales & Traffic (organic + PPC)</p>
                <p className="text-[10px] text-gray-400">Từ: Seller Central → Business Reports</p>
            </button>
        </div>
    );

    const renderPreviewTable = () => {
        if (!parsedData || parsedData.length === 0) return null;
        const columns = Object.keys(parsedData[0]).slice(0, 6); // Max 6 cols for preview

        return (
            <div className="mt-6 border border-gray-200 rounded-xl bg-white overflow-hidden text-sm">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-gray-700">
                        <FileCheck size={16} className="text-green-600" />
                        <span className="font-medium text-gray-900">Data Preview (First 5 rows)</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        {parsedData.length.toLocaleString()} rows total
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                {columns.map(col => (
                                    <th key={col} className="px-4 py-2 text-left font-medium">{col}</th>
                                ))}
                                {Object.keys(parsedData[0]).length > 6 && <th className="px-4 py-2 text-left font-medium">...</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {parsedData.slice(0, 5).map((row, i) => (
                                <tr key={i}>
                                    {columns.map(col => (
                                        <td key={col} className="px-4 py-2 text-gray-700 max-w-[150px] truncate">{row[col]?.toString() || ''}</td>
                                    ))}
                                    {Object.keys(parsedData[0]).length > 6 && <td className="px-4 py-2 text-gray-400">...</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderBusinessReportPreview = () => {
        if (detectedType !== 'AMAZON_BUSINESS_REPORT' || !parsedData || parsedData.length === 0) return null;

        // Calculate stats
        let totalSales = 0;
        let totalUnits = 0;
        let totalSessions = 0;

        const isByDate = !!parsedData[0]['Date'];

        parsedData.forEach(row => {
            const sales = parseFloat((row['Ordered Product Sales'] || row['Ordered Product Sales (B2B)'] || '0').toString().replace(/[^0-9.-]+/g, ''));
            const units = parseInt((row['Units Ordered'] || '0').toString().replace(/,/g, ''), 10);
            const sessions = parseInt((row['Sessions'] || '0').toString().replace(/,/g, ''), 10);

            totalSales += !isNaN(sales) ? sales : 0;
            totalUnits += !isNaN(units) ? units : 0;
            totalSessions += !isNaN(sessions) ? sessions : 0;
        });

        const avgSessions = parsedData.length > 0 ? Math.round(totalSessions / parsedData.length) : 0;

        let dateRangeStr = 'N/A';
        if (isByDate && parsedData.length > 0) {
            // Sort to find min/max dates if needed, or assume sorted. 
            // In Amazon reports they usually are sorted, but let's grab min/max just in case
            const dates = parsedData.map(r => new Date(r['Date']).getTime()).filter(t => !isNaN(t));
            if (dates.length > 0) {
                const min = new Date(Math.min(...dates)).toLocaleDateString('vi-VN');
                const max = new Date(Math.max(...dates)).toLocaleDateString('vi-VN');
                dateRangeStr = `${min} — ${max}`;
            }
        }

        return (
            <div className="mt-4 mb-6 bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="text-orange-600" size={20} />
                    <h4 className="font-bold text-slate-800">Business Report Summary</h4>
                    <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-semibold ml-2">
                        {isByDate ? 'By Date' : 'By Child Item'}
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {isByDate && (
                        <div className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">📅 Date Range</p>
                            <p className="font-bold text-slate-800 text-sm whitespace-nowrap">{dateRangeStr}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{parsedData.length} days</p>
                        </div>
                    )}
                    <div className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                        <p className="text-xs text-slate-500 font-medium mb-1">💰 Total Sales</p>
                        <p className="font-black text-indigo-700 text-lg">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                        <p className="text-xs text-slate-500 font-medium mb-1">📦 Total Units</p>
                        <p className="font-bold text-slate-800 text-lg">{totalUnits.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                        <p className="text-xs text-slate-500 font-medium mb-1">👁 Avg Sessions/day</p>
                        <p className="font-bold text-slate-800 text-lg">{avgSessions.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Step 1: Pre-upload selection */}
            {(!fileInfo || step === 1) && (
                <>
                    {renderFileTypeCards()}

                    <div
                        {...getRootProps()}
                        className={classNames(
                            "relative group border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 bg-slate-50",
                            "hover:border-blue-500 hover:bg-blue-50/50",
                            isDragActive ? "border-blue-500 bg-blue-50 scale-[1.02]" : "border-slate-300"
                        )}
                        style={{ minHeight: '160px' }}
                    >
                        <input {...getInputProps()} />
                        <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
                            <div className={classNames(
                                "p-3 rounded-full transition-colors duration-300",
                                isDragActive ? "bg-blue-100 text-blue-600" : "bg-white border text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:border-blue-200"
                            )}>
                                <UploadCloud size={32} />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-700 mb-1">
                                    {isDragActive
                                        ? "Kéo thả file vào đây!"
                                        : selectedCard
                                            ? `Kéo thả file ${selectedCard.replace(/_/g, ' ')} vào đây`
                                            : "Kéo thả file hoặc click để chọn — Auto-detect format"}
                                </h3>
                                <p className="text-slate-500 text-xs">
                                    Supports: Amazon Bulk, Search Term Reports, Cerebro (.xlsx, .csv)
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Step 2: Validation & Preview */}
            {fileInfo && step === 2 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg text-green-700">
                                <FileCheck size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">{fileInfo.name}</h3>
                                <p className="text-sm text-gray-500">
                                    Detected: <span className="font-medium text-gray-700">{detectedType}</span> • {parsedData.length.toLocaleString()} rows
                                </p>
                            </div>
                        </div>
                        <button onClick={resetUpload} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1">
                            <XCircle size={14} /> Remove
                        </button>
                    </div>

                    {uploadError && (
                        <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle size={16} />
                            <span>{uploadError}</span>
                        </div>
                    )}

                    {/* Custom Preview for Business Report */}
                    {detectedType === 'AMAZON_BUSINESS_REPORT' ? renderBusinessReportPreview() : renderPreviewTable()}

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleUploadClick}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                        >
                            Upload to Google Sheets
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Processing Upload */}
            {step === 3 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
                    {uploadProgress < 100 ? (
                        <div className="max-w-md mx-auto">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Đang upload l\u00ean Google Sheets...</h3>
                            <p className="text-sm text-gray-500 mb-6">Xin vui l\u00f2ng ch\u1edd, vi\u1ec7c n\u00e0y c\u00f3 th\u1ec3 m\u1ea5t v\u00e0i gi\u00e2y đ\u1ebfn m\u1ed9t ph\u00fat.</p>

                            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-md mx-auto">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Th\u00e0nh C\u00f4ng!</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Đ\u00e3 t\u1ea3i l\u00ean {parsedData.length.toLocaleString()} rows th\u00e0nh c\u00f4ng. Data s\u1ebd hi\u1ec3n th\u1ecb tr\u00ean c\u00e1c trang kh\u00e1c ng\u00e0y l\u1eadp t\u1ee9c.
                            </p>

                            <button
                                onClick={resetUpload}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-2 rounded-lg font-medium transition-colors"
                            >
                                Upload file kh\u00e1c
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
