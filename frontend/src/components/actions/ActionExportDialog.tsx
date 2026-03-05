import React, { useState } from 'react';
import { X, Download, AlertTriangle, FileSpreadsheet, ListChecks } from 'lucide-react';
import { useActionQueue } from '../../services/actionQueueService';

interface Props {
    onClose: () => void;
}

const ActionExportDialog: React.FC<Props> = ({ onClose }) => {
    const { actions, exportCSV, markAsExported } = useActionQueue();
    const [exportOnlyPending, setExportOnlyPending] = useState(true);
    const [markAsExportedAfter, setMarkAsExportedAfter] = useState(true);
    const [exportFormat, setExportFormat] = useState<'SP' | 'SB'>('SP');

    const pendingActions = actions.filter(a => a.status === 'pending');
    const exportedActions = actions.filter(a => a.status === 'exported');

    const actionsToExport = exportOnlyPending ? pendingActions : [...pendingActions, ...exportedActions];

    const harvestCount = actionsToExport.filter(a => a.type === 'harvest').length;
    const negateCount = actionsToExport.filter(a => a.type === 'negate').length;
    const pauseCount = actionsToExport.filter(a => a.type === 'pause').length;

    const handleExport = () => {
        exportCSV();

        if (markAsExportedAfter && exportOnlyPending) {
            const pendingIds = pendingActions.map(a => a.id);
            markAsExported(pendingIds);
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Dialog Content */}
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg relative z-10 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Download size={20} className="text-blue-600" />
                        Export Preview
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6 bg-white overflow-y-auto custom-scrollbar max-h-[70vh]">

                    {/* Summary Block */}
                    <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                        <ListChecks className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-200 pointer-events-none" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 pb-2">Operations Summary</h3>

                        <div className="space-y-2 relative z-10">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Harvest (to Exact)
                                </span>
                                <span className="font-bold text-slate-800">{harvestCount} targets</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    Negate
                                </span>
                                <span className="font-bold text-slate-800">{negateCount} keywords</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Pause
                                </span>
                                <span className="font-bold text-slate-800">{pauseCount} campaigns</span>
                            </div>

                            <div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-800">Tổng cộng</span>
                                <span className="text-base font-black text-blue-600">{actionsToExport.length} operations</span>
                            </div>
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-3">Export Options</h3>

                        <div className="space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={exportOnlyPending}
                                        onChange={(e) => setExportOnlyPending(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Chỉ export hàng đợi Pending</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Bỏ qua các items đã được export trước đó để tránh trùng lặp.</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={markAsExportedAfter}
                                        onChange={(e) => setMarkAsExportedAfter(e.target.checked)}
                                        disabled={!exportOnlyPending}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer disabled:opacity-50"
                                    />
                                </div>
                                <div className={!exportOnlyPending ? 'opacity-50' : ''}>
                                    <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Đánh dấu thành "Exported" sau khi tải</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Cập nhật trạng thái tự động để giữ cho Action Queue sạch sẽ.</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Format Selection */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-2">Campaign Format</h3>
                        <div className="flex gap-3">
                            <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${exportFormat === 'SP' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-slate-800">SP Bulk File</span>
                                    <input type="radio" name="format" value="SP" checked={exportFormat === 'SP'} onChange={() => setExportFormat('SP')} className="h-4 w-4 text-blue-600" />
                                </div>
                                <p className="text-xs text-slate-500">Sponsored Products formatting.</p>
                            </label>
                            <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${exportFormat === 'SB' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300 bg-white opacity-50'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-slate-800">SB Bulk File</span>
                                    <input type="radio" name="format" value="SB" checked={exportFormat === 'SB'} onChange={() => setExportFormat('SB')} disabled className="h-4 w-4 text-blue-600" />
                                </div>
                                <p className="text-xs text-slate-500">Sponsored Brands (Coming Soon).</p>
                            </label>
                        </div>
                    </div>

                    {actionsToExport.length === 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2">
                            <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700">Không có dữ liệu nào khớp với tùy chọn export hiện tại. Vui lòng thêm action mới hoặc bỏ chọn "Chỉ export Pending".</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={actionsToExport.length === 0}
                        className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-md flex items-center gap-2"
                    >
                        <FileSpreadsheet size={16} />
                        Tải CSV ({actionsToExport.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionExportDialog;
