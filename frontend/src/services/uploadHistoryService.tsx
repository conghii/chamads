import React, { createContext, useContext, useState, useEffect } from 'react';
import type { RawFileType } from '../types';

export interface UploadRecord {
    id: string;
    date: string;
    fileName: string;
    fileType: RawFileType;
    rowsCount: number;
    status: 'Success' | 'Processing' | 'Failed';
    stats?: string;
    subInfo?: string;
    errorMsg?: string;
}

const STORAGE_KEY = 'chamPPPC_upload_history';

interface UploadHistoryContextType {
    history: UploadRecord[];
    addRecord: (record: Omit<UploadRecord, 'id' | 'date'>) => string;
    updateRecord: (id: string, updates: Partial<UploadRecord>) => void;
    deleteRecord: (id: string) => void;
    clearHistory: () => void;
    getLatestSuccessRecord: (type: RawFileType | RawFileType[]) => UploadRecord | undefined;
}

const UploadHistoryContext = createContext<UploadHistoryContextType | undefined>(undefined);

export const UploadHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [history, setHistory] = useState<UploadRecord[]>([]);

    // Load from local storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setHistory(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to parse upload history from local storage', error);
        }
    }, []);

    // Save to local storage whenever history changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.error('Failed to save upload history to local storage', error);
        }
    }, [history]);

    const addRecord = (record: Omit<UploadRecord, 'id' | 'date'>) => {
        const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newRecord: UploadRecord = {
            ...record,
            id,
            date: new Date().toISOString(),
        };
        // Keep only max 10 entries for history
        setHistory(prev => [newRecord, ...prev].slice(0, 10));
        return id;
    };

    const updateRecord = (id: string, updates: Partial<UploadRecord>) => {
        setHistory(prev => prev.map(record =>
            record.id === id ? { ...record, ...updates, date: updates.date || record.date } : record
        ));
    };

    const deleteRecord = (id: string) => {
        setHistory(prev => prev.filter(record => record.id !== id));
    };

    const clearHistory = () => {
        setHistory([]);
    };

    const getLatestSuccessRecord = (type: RawFileType | RawFileType[]) => {
        const types = Array.isArray(type) ? type : [type];
        return history.find(r => r.status === 'Success' && types.includes(r.fileType));
    };

    return (
        <UploadHistoryContext.Provider
            value={{
                history,
                addRecord,
                updateRecord,
                deleteRecord,
                clearHistory,
                getLatestSuccessRecord
            }}
        >
            {children}
        </UploadHistoryContext.Provider>
    );
};

export const useUploadHistory = () => {
    const context = useContext(UploadHistoryContext);
    if (context === undefined) {
        throw new Error('useUploadHistory must be used within an UploadHistoryProvider');
    }
    return context;
};
