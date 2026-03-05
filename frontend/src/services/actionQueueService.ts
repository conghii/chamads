import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────

export type ActionType = 'harvest' | 'negate' | 'pause' | 'bid_change';
export type ActionStatus = 'pending' | 'exported' | 'applied';

export interface PendingAction {
    id: string;
    type: ActionType;
    searchTerm: string;
    sourceCampaign: string;
    sourceAdGroup: string;
    sourceMatchType: string; // AUTO, BROAD, PHRASE, EXACT

    // Harvest fields
    targetCampaign: string | null;
    targetAdGroup: string | null;
    targetMatchType: 'exact' | 'phrase';
    suggestedBid: number;
    finalBid: number;
    negateFromSource: boolean;

    // Negate fields
    negativeMatchType: 'negative_exact' | 'negative_phrase';

    // Meta
    priority: number;
    spend: number;
    sales: number;
    acos: number;
    orders: number;
    clicks: number;
    status: ActionStatus;
    createdAt: string; // ISO string
    createdBy: string;
}

export interface QueueStats {
    harvestCount: number;
    negateCount: number;
    totalCount: number;
    totalSpendImpact: number;
}

export interface QueueFilter {
    type?: ActionType;
    status?: ActionStatus;
}

// ─── localStorage Helpers ───────────────────────────────────────────

const STORAGE_KEY = 'chammppc_action_queue';

function loadQueue(): PendingAction[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveQueue(actions: PendingAction[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

// ─── Service Functions (pure, operate on arrays) ────────────────────

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createHarvestAction(
    searchTerm: string,
    sourceCampaign: string,
    sourceAdGroup: string,
    sourceMatchType: string,
    targetCampaign: string,
    targetAdGroup: string,
    targetMatchType: 'exact' | 'phrase',
    finalBid: number,
    negateFromSource: boolean,
    meta: { priority: number; spend: number; sales: number; acos: number; orders: number; clicks: number; suggestedBid: number }
): PendingAction {
    return {
        id: generateId(),
        type: 'harvest',
        searchTerm,
        sourceCampaign,
        sourceAdGroup,
        sourceMatchType,
        targetCampaign,
        targetAdGroup,
        targetMatchType,
        suggestedBid: meta.suggestedBid,
        finalBid,
        negateFromSource,
        negativeMatchType: 'negative_exact',
        priority: meta.priority,
        spend: meta.spend,
        sales: meta.sales,
        acos: meta.acos,
        orders: meta.orders,
        clicks: meta.clicks,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: 'user',
    };
}

export function createNegateAction(
    searchTerm: string,
    sourceCampaign: string,
    sourceAdGroup: string,
    sourceMatchType: string,
    negativeMatchType: 'negative_exact' | 'negative_phrase',
    meta: { priority: number; spend: number; sales: number; acos: number; orders: number; clicks: number }
): PendingAction {
    return {
        id: generateId(),
        type: 'negate',
        searchTerm,
        sourceCampaign,
        sourceAdGroup,
        sourceMatchType,
        targetCampaign: null,
        targetAdGroup: null,
        targetMatchType: 'exact',
        suggestedBid: 0,
        finalBid: 0,
        negateFromSource: false,
        negativeMatchType,
        priority: meta.priority,
        spend: meta.spend,
        sales: meta.sales,
        acos: meta.acos,
        orders: meta.orders,
        clicks: meta.clicks,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: 'user',
    };
}

export function createPauseAction(
    searchTerm: string, // For campaign, this might be the campaign name itself
    sourceCampaign: string,
    sourceAdGroup: string, // 'campaign' if it's a campaign level action
    sourceMatchType: string,
    meta: { priority: number; spend: number; sales: number; acos: number; orders: number; clicks: number }
): PendingAction {
    return {
        id: generateId(),
        type: 'pause',
        searchTerm,
        sourceCampaign,
        sourceAdGroup,
        sourceMatchType,
        targetCampaign: null,
        targetAdGroup: null,
        targetMatchType: 'exact',
        suggestedBid: 0,
        finalBid: 0,
        negateFromSource: false,
        negativeMatchType: 'negative_exact',
        priority: meta.priority,
        spend: meta.spend,
        sales: meta.sales,
        acos: meta.acos,
        orders: meta.orders,
        clicks: meta.clicks,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: 'user',
    };
}

export function createBidChangeAction(
    searchTerm: string,
    sourceCampaign: string,
    sourceAdGroup: string,
    sourceMatchType: string,
    newBid: number,
    meta: { priority: number; spend: number; sales: number; acos: number; orders: number; clicks: number; currentBid: number }
): PendingAction {
    return {
        id: generateId(),
        type: 'bid_change',
        searchTerm,
        sourceCampaign,
        sourceAdGroup,
        sourceMatchType,
        targetCampaign: null,
        targetAdGroup: null,
        targetMatchType: 'exact',
        suggestedBid: meta.currentBid,
        finalBid: newBid,
        negateFromSource: false,
        negativeMatchType: 'negative_exact',
        priority: meta.priority,
        spend: meta.spend,
        sales: meta.sales,
        acos: meta.acos,
        orders: meta.orders,
        clicks: meta.clicks,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: 'user',
    };
}

// ─── CSV Export (Amazon Bulk Upload Format) ──────────────────────────

const BULK_HEADER = 'Product,Entity,Operation,Campaign Id,Ad Group Id,Portfolio Id,Ad Group,Campaign,Campaign Daily Budget,Keyword,Match Type,Bid,Campaign Start Date,Campaign End Date,Campaign Targeting Type,State';

export function exportAmazonBulkCSV(actions: PendingAction[]): void {
    const pending = actions.filter(a => a.status === 'pending' || a.status === 'exported');
    if (pending.length === 0) return;

    const rows: string[] = [BULK_HEADER];

    for (const action of pending) {
        if (action.type === 'harvest') {
            // Add keyword to target campaign
            rows.push(
                `Sponsored Products,Keyword,Create,,,,"${action.targetAdGroup || 'Auto'}","${action.targetCampaign || ''}",,${action.searchTerm},${action.targetMatchType === 'exact' ? 'Exact' : 'Phrase'},${action.finalBid.toFixed(2)},,,,enabled`
            );
            // If negateFromSource, also add negative to source campaign
            if (action.negateFromSource) {
                rows.push(
                    `Sponsored Products,Negative Keyword,Create,,,,"${action.sourceAdGroup}","${action.sourceCampaign}",,${action.searchTerm},Negative Exact,,,,,enabled`
                );
            }
        } else if (action.type === 'negate') {
            const matchType = action.negativeMatchType === 'negative_exact' ? 'Negative Exact' : 'Negative Phrase';
            rows.push(
                `Sponsored Products,Negative Keyword,Create,,,,"${action.sourceAdGroup}","${action.sourceCampaign}",,${action.searchTerm},${matchType},,,,,enabled`
            );
        } else if (action.type === 'pause') {
            const entity = action.sourceAdGroup === 'campaign' ? 'Campaign' : 'Keyword';
            rows.push(
                `Sponsored Products,${entity},Update,,,,"${action.sourceAdGroup === 'campaign' ? '' : action.sourceAdGroup}","${action.sourceCampaign}",,${action.sourceAdGroup === 'campaign' ? '' : action.searchTerm},,,,paused`
            );
        } else if (action.type === 'bid_change') {
            rows.push(
                `Sponsored Products,Keyword,Update,,,,"${action.sourceAdGroup}","${action.sourceCampaign}",,${action.searchTerm},,${action.finalBid.toFixed(2)},,,,enabled`
            );
        }
    }

    // UTF-8 BOM + CSV content
    const BOM = '\uFEFF';
    const csv = BOM + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `ChamMPPC_Bulk_${dateStr}_${timeStr}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── React Context ──────────────────────────────────────────────────

interface ActionQueueContextValue {
    actions: PendingAction[];
    stats: QueueStats;
    addToQueue: (action: PendingAction) => void;
    bulkAddToQueue: (newActions: PendingAction[]) => void;
    removeFromQueue: (actionId: string) => void;
    updateAction: (actionId: string, updates: Partial<PendingAction>) => void;
    getQueue: (filter?: QueueFilter) => PendingAction[];
    markAsExported: (actionIds: string[]) => void;
    clearQueue: (filter?: QueueFilter) => void;
    exportCSV: () => void;
}

const ActionQueueContext = createContext<ActionQueueContextValue | null>(null);

export function ActionQueueProvider({ children }: { children: ReactNode }) {
    const [actions, setActions] = useState<PendingAction[]>(loadQueue);

    // Persist to localStorage whenever actions change
    useEffect(() => {
        saveQueue(actions);
    }, [actions]);

    const stats: QueueStats = React.useMemo(() => {
        const pending = actions.filter(a => a.status === 'pending');
        return {
            harvestCount: pending.filter(a => a.type === 'harvest').length,
            negateCount: pending.filter(a => a.type === 'negate').length,
            totalCount: pending.length,
            totalSpendImpact: pending.reduce((sum, a) => sum + a.spend, 0),
        };
    }, [actions]);

    const addToQueue = useCallback((action: PendingAction) => {
        setActions(prev => [...prev, action]);
    }, []);

    const bulkAddToQueue = useCallback((newActions: PendingAction[]) => {
        setActions(prev => [...prev, ...newActions]);
    }, []);

    const removeFromQueue = useCallback((actionId: string) => {
        setActions(prev => prev.filter(a => a.id !== actionId));
    }, []);

    const updateAction = useCallback((actionId: string, updates: Partial<PendingAction>) => {
        setActions(prev => prev.map(a => a.id === actionId ? { ...a, ...updates } : a));
    }, []);

    const getQueue = useCallback((filter?: QueueFilter): PendingAction[] => {
        let result = actions;
        if (filter?.type) result = result.filter(a => a.type === filter.type);
        if (filter?.status) result = result.filter(a => a.status === filter.status);
        return result;
    }, [actions]);

    const markAsExported = useCallback((actionIds: string[]) => {
        const idSet = new Set(actionIds);
        setActions(prev => prev.map(a => idSet.has(a.id) ? { ...a, status: 'exported' as ActionStatus } : a));
    }, []);

    const clearQueue = useCallback((filter?: QueueFilter) => {
        if (!filter) {
            setActions([]);
            return;
        }
        setActions(prev => prev.filter(a => {
            if (filter.type && a.type !== filter.type) return true;
            if (filter.status && a.status !== filter.status) return true;
            return false;
        }));
    }, []);

    const exportCSV = useCallback(() => {
        exportAmazonBulkCSV(actions);
    }, [actions]);

    const value: ActionQueueContextValue = {
        actions,
        stats,
        addToQueue,
        bulkAddToQueue,
        removeFromQueue,
        updateAction,
        getQueue,
        markAsExported,
        clearQueue,
        exportCSV,
    };

    return React.createElement(ActionQueueContext.Provider, { value }, children);
}

export function useActionQueue(): ActionQueueContextValue {
    const ctx = useContext(ActionQueueContext);
    if (!ctx) throw new Error('useActionQueue must be used within ActionQueueProvider');
    return ctx;
}
