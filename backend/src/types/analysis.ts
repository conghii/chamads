export interface BiddingStrategyData {
    strategy: 'Dynamic bids - down only' | 'Dynamic bids - up and down' | 'Fixed bids';
    count: number;
    percentage: number;
}

export interface PerformanceMetrics {
    spend: number;
    sales: number;
    orders: number;
    clicks: number;
    impressions: number;
    acos: number;
    roas: number;
}

export interface CampaignNode extends PerformanceMetrics {
    name: string;
    budget: number;
    state: string;
    biddingStrategy: string;
}

export interface PortfolioNode extends PerformanceMetrics {
    name: string;
    totalBudget: number;
    campaigns: CampaignNode[];
}

export interface ConvertingKeyword {
    keyword: string;
    matchType: string;
    campaignName: string;
    spend: number;
    sales: number;
    orders: number;
    clicks: number;
    impressions: number;
    acos: number;
    roas: number;
    cpc: number;
}

export interface TopCampaign extends PerformanceMetrics {
    name: string;
    state: string;
    campaignType: string; // SP, SB, SD
    portfolioName?: string;
    keywords?: ConvertingKeyword[];
}

export interface BidGapPoint {
    keyword: string;
    matchType: string;
    currentBid: number;
    suggestedBid: number;
    bidRangeMin: number;
    bidRangeMax: number;
    bidGapRatio: number;
    isUnderBidding: boolean;
}

export interface PlacementMultiplier {
    campaign: string;
    topOfSearch: number;
    productPages: number;
}

export interface EntityCounts {
    portfolios: number;
    campaigns: number;
    adGroups: number;
    asins: number;
    keywords: number;
}

export interface IntegrityAlert {
    type: 'error' | 'warning';
    message: string;
    count?: number;
}

export interface IntegrityReport {
    entityCounts: EntityCounts;
    alerts: IntegrityAlert[];
    missingColumns: string[];
}

export interface BulkAnalysisData {
    biddingStrategy: BiddingStrategyData[];
    portfolioHierarchy: PortfolioNode[];
    bidGaps: BidGapPoint[];
    placements: PlacementMultiplier[];
    integrity: IntegrityReport;
    topCampaigns: TopCampaign[];
    convertingKeywords: ConvertingKeyword[];
}

export interface SearchTermUsage {
    searchTerm: string;
    campaignName: string;
    adGroupName: string;
    matchType: string; // 'Unknown' if not in Bulk
    portfolioName?: string;

    // Performance
    spend: number;
    sales: number;
    orders: number;
    clicks: number;
    impressions: number;
    acos: number;
    roas: number;
    cpc: number;
    cvr: number;
    searchVolume: number | null;

    // Analysis
    isTargeting: boolean; // TRUE if this exact term exists as a keyword in this campaign
    sourceMatchType: 'AUTO' | 'BROAD' | 'PHRASE' | 'EXACT' | 'UNKNOWN'; // The match type of the target that triggered this term
    recommendation: 'MOVE_TO_EXACT' | 'NEGATIVE' | 'OPTIMIZE' | 'HOLD' | 'NONE';
    reasons: string[]; // e.g. "Bleeding: High Spend 0 Orders", "Golden: Low ACOS"
}

export interface HarvestStatMetrics {
    bleedingWaste: number; // Total spend of Negative candidates
    harvestPotential: number; // Count or Potential Sales of Harvest candidates
    efficiencyScore: number; // (Profit / Waste) * 100 or similar metric
    totalSearchTerms: number;
}

export interface SearchTermAnalysisData {
    period: string;
    stats: HarvestStatMetrics;
    searchTerms: SearchTermUsage[];
}
