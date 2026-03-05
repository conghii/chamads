export interface MasterKeywordRecord {
    id: string; // ASIN + Keyword
    keyword: string;
    asin: string;

    // Context
    matchType: string | null;
    campaignName: string | null;

    // Market Intelligence
    searchVolume: number | null;
    wordCount: number | null;
    cerebroIQScore: number | null;
    competitorRankAvg: number | null;
    rankingCompetitorsCount: number | null;

    // Ranking
    organicRank: number | null;
    sponsoredRank: number | null;

    // Ad Performance
    adSpend: number | null;
    adSales: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    cvr: number | null;

    lastUpdated: string; // ISO Date string
}

export type RawFileType = 'AMAZON_BULK' | 'AMAZON_SEARCH_TERM' | 'AMAZON_PORTFOLIO' | 'HELIUM10_CEREBRO_COMP' | 'HELIUM10_CEREBRO_MY_ASIN' | 'HELIUM10_KEYWORD_TRACKER' | 'AMAZON_BUSINESS_REPORT' | 'MULTI_SHEET' | 'UNKNOWN';


export interface BulkFileRow {
    'Record Type'?: string; // Standard Bulk
    'Entity'?: string; // Old Bulk
    'Campaign'?: string;
    'Campaign Name'?: string;
    'Ad Group'?: string;
    'Ad Group Name'?: string;
    'Keyword Text'?: string;
    'Product Targeting Expression'?: string;
    'Keyword or Product Targeting'?: string;
    'Keyword'?: string;
    'Match Type'?: string;
    'Spend': string | number;
    'Sales': string | number;
    'Orders': string | number;
    'Clicks': string | number;
    'Impressions': string | number;
    [key: string]: any;
}

export interface SearchTermRow {
    'Start Date': string;
    'End Date': string;
    'Portfolio name': string;
    'Currency': string;
    'Campaign Name': string;
    'Ad Group Name': string;
    'Targeting': string;
    'Match Type': string;
    'Customer Search Term': string;
    'Impressions': string | number;
    'Clicks': string | number;
    'Click-Thru Rate (CTR)': string | number;
    'Cost Per Click (CPC)': string | number;
    'Spend': string | number;
    '7 Day Total Sales ': string | number; // Note space at end
    'Total Advertising Cost of Sales (ACOS) ': string | number; // Note space
    'Total Return on Advertising Spend (ROAS)': string | number;
    '7 Day Total Orders (#)': string | number;
    '7 Day Total Units (#)': string | number;
    '7 Day Conversion Rate': string | number;
    [key: string]: any;
}

export interface CerebroRow {
    'Keyword Phrase': string;
    'Cerebro IQ Score'?: string | number;
    'Search Volume': string | number;
    'Sponsored Rank'?: string | number;
    'Organic Rank'?: string | number;
    'Organic'?: string | number; // Alias in some exports
    'Sponsored Product'?: string | number; // Alias for Sponsored Rank
    'Competitor Rank (avg)'?: string | number;
    'Ranking Competitors (count)'?: string | number;
    'ABA Total Click Share'?: string | number;
    'ABA Total Conv. Share'?: string | number;
    [key: string]: any;
}

export interface BusinessReportRow {
    'Date'?: string;
    '(Parent) ASIN'?: string;
    '(Child) ASIN'?: string;
    'Title'?: string;
    'Sessions': string | number;
    'Page Views'?: string | number;
    'Buy Box Percentage'?: string | number;
    'Units Ordered': string | number;
    'Ordered Product Sales': string | number;
    'Ordered Product Sales (B2B)'?: string | number;
    'Unit Session Percentage'?: string | number;
    'Total Order Items'?: string | number;
    [key: string]: any;
}

export type RawFileRowSelection = BulkFileRow | SearchTermRow | CerebroRow | BusinessReportRow;
export type RawFileRow = RawFileRowSelection;


export interface DominationAuditRow {
    keyword: string;
    searchVolume: number;
    marketSaturation: number;
    yourRank: number | null;
    gapCategory: 'Critical Gap' | 'Ranking Opportunity' | 'Defending Zone' | 'Neutral';
    gapColor: string;
    priorityScore: number;
    oppScore: number;
}

export interface RootKeywordStats {
    totalKeywords: number;
    totalSV: number;
    mustRunCount: number;
}

export interface DatasetStats {
    totalRecords: number;
    totalCampaigns: number;
    totalAdGroups: number;
    totalKeywords: number;
    totalSearchTerms: number;
    totalAdSpend: number;
    totalAdSales: number;
}

export interface ProductDetail {
    name: string;
    asin: string;
    sku: string;
    title: string;
    bulletPoints: string;
    description: string;
    genericKeywords: string;
    listingPlan: string;
    status?: 'Active' | 'Inactive' | 'Discontinued';
    imageUrl?: string;
    notes?: string;
    isAutoCreated?: boolean;
}
