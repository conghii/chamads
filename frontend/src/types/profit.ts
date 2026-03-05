import type { PerformanceMetrics } from './analysis';

export interface ProductCostConfig {
    asin: string;
    sellingPrice: number;
    cogs: number;
    shippingToFba: number;
    packaging: number;
    referralFeePercentage: number; // e.g. 15 for 15%
    fbaFee: number;
    storageFee: number;
    lastUpdated: string;
}

export interface GlobalProfitConfig {
    defaultReferralFeePercentage: number;
    defaultProfitMarginBeforeAds?: number;
}

export interface ProfitBreakdown extends PerformanceMetrics {
    entityName: string;
    asin?: string;

    // Revenue & Costs
    revenue: number;
    ppcSales?: number;
    hasBusinessReport?: boolean;
    totalCogs: number;
    totalShipping: number;
    totalPackaging: number;
    totalReferralFees: number;
    totalFbaFees: number;
    totalAdSpend: number;

    // Net Results
    totalExpenses: number;
    netProfit: number;
    netMargin: number;

    // Analysis
    breakEvenAcos: number;
    breakEvenSales: number;
    acosGap: number;
}

export interface ProfitScenario {
    id: string;
    name: string;
    targetAcos: number;
    priceAdjustment: number;
    cogsAdjustment: number;
    orderVolumeMultiplier: number;
}
