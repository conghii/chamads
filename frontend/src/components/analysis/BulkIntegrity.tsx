import React from 'react';
import type { IntegrityReport } from '../../types/analysis';
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface Props {
    data: IntegrityReport;
}

const BulkIntegrity: React.FC<Props> = ({ data }) => {
    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-2">Bulk Integrity & Health</h3>
            <p className="text-sm text-gray-400 mb-6">
                Data quality check and entity counts
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {Object.entries(data.entityCounts).map(([key, value]) => (
                    <div key={key} className="bg-gray-700/50 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-white">{value}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">{key}</div>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-300 uppercase">Integrity Alerts</h4>

                {data.alerts.length === 0 ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        <p className="text-green-400 text-sm">No integrity issues found. File is clean.</p>
                    </div>
                ) : (
                    data.alerts.map((alert, index) => (
                        <div
                            key={index}
                            className={`rounded-lg p-4 flex items-start gap-3 border ${alert.type === 'error'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-yellow-500/10 border-yellow-500/30'
                                }`}
                        >
                            {alert.type === 'error' ? (
                                <XCircleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                            ) : (
                                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mt-0.5" />
                            )}
                            <div>
                                <p className={`text-sm font-medium ${alert.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                                    }`}>
                                    {alert.message}
                                </p>
                                {alert.count && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Affected entities: {alert.count}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BulkIntegrity;
