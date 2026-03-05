import { GoogleSpreadsheet } from 'google-spreadsheet';
import {
    BiddingStrategyData,
    PortfolioNode,
    BidGapPoint,
    PlacementMultiplier,
    IntegrityReport,
    BulkAnalysisData,
    CampaignNode,
    TopCampaign,
    ConvertingKeyword
} from '../types/analysis';

export class BulkAnalysisService {
    private doc: GoogleSpreadsheet;

    constructor(doc: GoogleSpreadsheet) {
        this.doc = doc;
    }

    async getBulkAnalysis(): Promise<BulkAnalysisData> {
        const sheet = this.doc.sheetsByTitle['Raw_Amazon_Bulk'];

        if (!sheet) {
            throw new Error('Raw_Amazon_Bulk sheet not found. Please upload a Bulk file first.');
        }

        const rows = await sheet.getRows();

        if (rows.length > 0) {
            console.log('--- DEBUG: Sheet Headers ---');
            console.log(sheet.headerValues);
            console.log('--- DEBUG: First Row Sample ---');
            console.log(JSON.stringify(rows[0].toObject()));
        } else {
            console.log('--- DEBUG: No rows found in sheet ---');
        }

        return {
            biddingStrategy: this.analyzeBiddingStrategy(rows),
            portfolioHierarchy: this.analyzePortfolioHierarchy(rows),
            bidGaps: this.analyzeBidGaps(rows),
            placements: this.analyzePlacements(rows),
            integrity: this.checkIntegrity(rows),
            topCampaigns: this.analyzeTopCampaigns(rows),
            convertingKeywords: this.extractAllTargets(rows)
                .filter(k => k.orders > 0)
                .sort((a, b) => b.orders - a.orders)
                .slice(0, 20),
            debug: {
                headers: sheet.headerValues,
                firstRow: rows.length > 0 ? rows[0].toObject() : null
            }
        } as any;
    }

    private parseMoney(value: any): number {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        return parseFloat(value.toString().replace(/[$,]/g, '')) || 0;
    }

    private getColumn(row: any, possibleNames: string[]): any {
        for (const name of possibleNames) {
            // Standard property access
            if (row[name] !== undefined) return row[name];

            // Handle objects with .get() method (like GoogleSpreadsheetRow or Map)
            if (typeof row.get === 'function') {
                const val = row.get(name);
                if (val !== undefined) return val;
            }

            // Fallback for case-insensitive match (last resort, expensive)
            // Only do this if we really think headers might be messy
        }
        return undefined;
    }

    private analyzeBiddingStrategy(rows: any[]): BiddingStrategyData[] {
        const campaigns = rows.filter(r => this.getColumn(r, ['Entity', 'Record Type']) === 'Campaign' && this.getColumn(r, ['State', 'Campaign State', 'Campaign State (Informational only)']) === 'enabled');
        const strategyCounts: Record<string, number> = {};

        campaigns.forEach(campaign => {
            const strategy = this.getColumn(campaign, ['Bidding strategy', 'Bidding Strategy']) || 'Unknown';
            strategyCounts[strategy] = (strategyCounts[strategy] || 0) + 1;
        });

        const total = campaigns.length;
        return Object.entries(strategyCounts).map(([strategy, count]) => ({
            strategy: strategy as any,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0
        }));
    }

    private analyzePortfolioHierarchy(rows: any[]): PortfolioNode[] {
        // We need to aggregate performance data from all entities (Keywords, Targets) matching the Campaign Name
        // But Bulk file structure separates Campaign row (settings) from Child rows (performance)
        // Performance columns (Spend, Sales, Orders) usually populated on Campaign row in some reports,
        // but in Bulk file, Campaign row might summarize it OR we have to sum up from keywords.
        // Let's assume Bulk file has performance data on Campaign row if it's a "Bulk Download" with performance.
        // If not, we might need to sum up children.    private analyzePortfolioHierarchy(rows: any[]): PortfolioNode[] {
        const portfolioMap = new Map<string, PortfolioNode>();
        const campaignMap = new Map<string, CampaignNode>();

        // Iterate through ALL rows to aggregate metrics by Campaign
        rows.forEach(row => {
            // Prioritize Informational column because standard "Campaign Name" might be empty in some reports
            const campaignName = this.getColumn(row, ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign']);
            if (!campaignName) return;

            const portfolioName = this.getColumn(row, ['Portfolio Name (Informational only)', 'Portfolio Name', 'Portfolio']) || 'No Portfolio';

            // Initialize Portfolio if needed
            if (!portfolioMap.has(portfolioName)) {
                portfolioMap.set(portfolioName, {
                    name: portfolioName,
                    totalBudget: 0,
                    campaigns: [],
                    spend: 0,
                    sales: 0,
                    orders: 0,
                    clicks: 0,
                    impressions: 0,
                    acos: 0,
                    roas: 0
                });
            }

            // Initialize Campaign if needed
            if (!campaignMap.has(campaignName)) {
                campaignMap.set(campaignName, {
                    name: campaignName,
                    budget: this.parseMoney(this.getColumn(row, ['Daily Budget', 'Budget', 'Ad Group Default Bid'])), // Best effort
                    state: this.getColumn(row, ['Campaign State (Informational only)', 'State', 'Campaign State']) || 'Unknown',
                    biddingStrategy: this.getColumn(row, ['Bidding strategy', 'Bidding Strategy']) || 'Unknown',
                    spend: 0,
                    sales: 0,
                    orders: 0,
                    clicks: 0,
                    impressions: 0,
                    acos: 0,
                    roas: 0
                });
            }

            // Aggregate Metrics from this row
            const campaign = campaignMap.get(campaignName)!;
            campaign.spend += this.parseMoney(this.getColumn(row, ['Spend', 'Cost']));
            campaign.sales += this.parseMoney(this.getColumn(row, ['Sales', '7 Day Total Sales', 'Attributed Sales 7d']));
            campaign.orders += this.parseMoney(this.getColumn(row, ['Orders', '7 Day Total Orders (#)', 'Attributed Units Ordered 7d']));
            campaign.clicks += this.parseMoney(this.getColumn(row, ['Clicks']));
            campaign.impressions += this.parseMoney(this.getColumn(row, ['Impressions']));

            // Update identifying info if we find a "better" row (e.g. actual Campaign entity row)
            const entity = this.getColumn(row, ['Entity', 'Record Type']);
            if (entity === 'Campaign') {
                campaign.budget = this.parseMoney(this.getColumn(row, ['Daily Budget', 'Budget']));
                campaign.state = this.getColumn(row, ['Campaign State (Informational only)', 'State', 'Campaign State']) || campaign.state;
                campaign.biddingStrategy = this.getColumn(row, ['Bidding strategy', 'Bidding Strategy']) || campaign.biddingStrategy;
            }

            // Link campaign to portfolio (last writer wins, usually consistent)
            // We'll process the linkage at the end to avoid duplication
        });

        // Compute ACOS/ROAS for campaigns and link to Portfolios
        rows.forEach(row => {
            const campaignName = this.getColumn(row, ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign']);
            const portfolioName = this.getColumn(row, ['Portfolio Name (Informational only)', 'Portfolio Name', 'Portfolio']) || 'No Portfolio';

            if (campaignName && campaignMap.has(campaignName) && portfolioMap.has(portfolioName)) {
                const portfolio = portfolioMap.get(portfolioName)!;
                const campaign = campaignMap.get(campaignName)!;

                // Only add campaign to portfolio ONCE
                if (!portfolio.campaigns.some(c => c.name === campaignName)) {
                    // Finalize campaign metrics
                    campaign.acos = campaign.sales > 0 ? (campaign.spend / campaign.sales) * 100 : 0;
                    campaign.roas = campaign.spend > 0 ? campaign.sales / campaign.spend : 0;

                    portfolio.campaigns.push(campaign);

                    // Aggregate to Portfolio
                    portfolio.totalBudget += campaign.budget;
                    portfolio.spend += campaign.spend;
                    portfolio.sales += campaign.sales;
                    portfolio.orders += campaign.orders;
                    portfolio.clicks += campaign.clicks;
                    portfolio.impressions += portfolio.impressions;
                }
            }
        });

        // Finalize Portfolio ACOS/ROAS
        return Array.from(portfolioMap.values()).map(p => ({
            ...p,
            acos: p.sales > 0 ? (p.spend / p.sales) * 100 : 0,
            roas: p.spend > 0 ? p.sales / p.spend : 0
        }));
    }

    private analyzeTopCampaigns(rows: any[]): TopCampaign[] {
        const campaignMap = new Map<string, TopCampaign>();

        // First pass: Aggregate Campaign Metrics
        rows.forEach(row => {
            const campaignName = this.getColumn(row, ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign']);
            if (!campaignName) return;

            if (!campaignMap.has(campaignName)) {
                // Try to infer Campaign Type from name (common convention) or Entity column if available
                // Realistically, we need to find the Campaign row to get the type, or infer it.
                // For now, we'll default to 'SP' if unknown, or try to detect from "Sponsored Products" etc.
                // Actually, "Portfolio Name" or specific columns might hint.
                // Let's look for "Product Targeting" vs "Keyword" to hint SP vs SB? 
                // A better way: The 'Entity' column 'Campaign' row usually has 'Campaign Type'.

                campaignMap.set(campaignName, {
                    name: campaignName,
                    state: this.getColumn(row, ['Campaign State (Informational only)', 'State', 'Campaign State']) || 'enabled', // Default to enabled if missing
                    campaignType: this.discriminator(row) || 'SP', // Helper to guess type
                    portfolioName: this.getColumn(row, ['Portfolio Name (Informational only)', 'Portfolio Name', 'Portfolio']),
                    spend: 0,
                    sales: 0,
                    orders: 0,
                    clicks: 0,
                    impressions: 0,
                    acos: 0,
                    roas: 0,
                    keywords: []
                });
            }

            const campaign = campaignMap.get(campaignName)!;

            // Update state/type if we find a better row (e.g. the Campaign entity row)
            const entity = this.getColumn(row, ['Entity', 'Record Type']);
            if (entity === 'Campaign') {
                const state = this.getColumn(row, ['Campaign State (Informational only)', 'State', 'Campaign State']);
                if (state) campaign.state = state;
            }

            const spend = this.parseMoney(this.getColumn(row, ['Spend', 'Cost']));
            const sales = this.parseMoney(this.getColumn(row, ['Sales', '7 Day Total Sales', 'Attributed Sales 7d']));

            campaign.spend += spend;
            campaign.sales += sales;
            campaign.orders += this.parseMoney(this.getColumn(row, ['Orders', '7 Day Total Orders (#)', 'Attributed Units Ordered 7d']));
            campaign.clicks += this.parseMoney(this.getColumn(row, ['Clicks']));
            campaign.impressions += this.parseMoney(this.getColumn(row, ['Impressions']));
        });

        // Second pass: Extract Keywords and assign to Campaigns
        // Get all active targets (Spend > 0 or Orders > 0)
        const allKeywords = this.extractAllTargets(rows);

        allKeywords.forEach(kw => {
            if (campaignMap.has(kw.campaignName)) {
                campaignMap.get(kw.campaignName)!.keywords!.push(kw);
            }
        });

        // Calculate final ACOS/ROAS and sort
        return Array.from(campaignMap.values())
            .map(c => ({
                ...c,
                acos: c.sales > 0 ? (c.spend / c.sales) * 100 : 0,
                roas: c.spend > 0 ? c.sales / c.spend : 0,
                keywords: c.keywords?.sort((a, b) => b.spend - a.spend) // Sort nested keywords by Spend descending (most important for strategy)
            }))
            .sort((a, b) => b.sales - a.sales); // Return ALL campaigns, sorted by sales
    }

    private extractAllTargets(rows: any[]): ConvertingKeyword[] {
        // Filter rows that have activity (Orders > 0 OR Spend > 0)
        // We look for rows that are NOT the main Campaign/Portfolio rows

        const targets = rows.filter(r => {
            const orders = this.parseMoney(this.getColumn(r, ['Orders', '7 Day Total Orders (#)', 'Attributed Units Ordered 7d']));
            const spend = this.parseMoney(this.getColumn(r, ['Spend', 'Cost']));
            const hasKeyword = this.getColumn(r, ['Keyword Text', 'Keyword', 'Product Targeting', 'Product Targeting Expression', 'Targeting']);

            // Return if it has a keyword AND (has converted OR has spent money)
            return hasKeyword && (orders > 0 || spend > 0);
        });

        return targets
            .map(t => {
                const spend = this.parseMoney(this.getColumn(t, ['Spend', 'Cost']));
                const sales = this.parseMoney(this.getColumn(t, ['Sales', '7 Day Total Sales', 'Attributed Sales 7d']));
                const clicks = this.parseMoney(this.getColumn(t, ['Clicks']));

                return {
                    keyword: this.getColumn(t, ['Keyword Text', 'Keyword', 'Product Targeting', 'Product Targeting Expression', 'Targeting']) || 'Unknown',
                    matchType: this.getColumn(t, ['Match Type']) || '-',
                    campaignName: this.getColumn(t, ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign']),
                    spend,
                    sales,
                    orders: this.parseMoney(this.getColumn(t, ['Orders', '7 Day Total Orders (#)', 'Attributed Units Ordered 7d'])),
                    clicks,
                    impressions: this.parseMoney(this.getColumn(t, ['Impressions'])),
                    acos: sales > 0 ? (spend / sales) * 100 : 0,
                    roas: spend > 0 ? sales / spend : 0,
                    cpc: clicks > 0 ? spend / clicks : 0
                };
            });
        // No sort or slice here - return raw list to be processed by caller
    }

    private analyzeBidGaps(rows: any[]): BidGapPoint[] {
        // Filter rows from Guidance tab (not present in standard bulk usually, checking logic)
        // Adjusting to check for rows that have 'Suggested bid' or similar
        const guidanceRows = rows.filter(r => this.getColumn(r, ['Suggested bid', 'Suggested Bid']) && this.getColumn(r, ['Bid', 'Keyword Bid']));

        return guidanceRows.map(row => {
            const currentBid = parseFloat(this.getColumn(row, ['Bid', 'Keyword Bid'])) || 0;
            const suggestedBid = parseFloat(this.getColumn(row, ['Suggested bid', 'Suggested Bid'])) || 0;
            const bidRangeMin = parseFloat(this.getColumn(row, ['Bid range minimum', 'Range Start'])) || 0;
            const bidRangeMax = parseFloat(this.getColumn(row, ['Bid range maximum', 'Range End'])) || 0;

            const bidGapRatio = suggestedBid > 0 ? currentBid / suggestedBid : 1;
            const isUnderBidding = bidGapRatio < 0.8;

            return {
                keyword: this.getColumn(row, ['Keyword', 'Keyword Text', 'Product Targeting', 'Product Targeting Expression']) || 'Unknown',
                matchType: this.getColumn(row, ['Match Type']) || 'Unknown',
                currentBid,
                suggestedBid,
                bidRangeMin,
                bidRangeMax,
                bidGapRatio,
                isUnderBidding
            };
        }).filter(point => point.currentBid > 0 && point.suggestedBid > 0);
    }

    private analyzePlacements(rows: any[]): PlacementMultiplier[] {
        // Filter rows for Placement
        const placementRows = rows.filter(r => {
            // In some bulk files, placement is a "Bidding Adjustment" entity
            const entity = this.getColumn(r, ['Entity', 'Record Type']);
            return entity === 'Bidding Adjustment' || r['Placement Type'] !== undefined;
        });

        const campaignMap = new Map<string, { topOfSearch: number; productPages: number }>();

        placementRows.forEach(row => {
            const campaign = this.getColumn(row, ['Campaign Name', 'Campaign', 'Campaign Name (Informational only)']) || 'Unknown';
            const placementType = this.getColumn(row, ['Placement Type', 'Placement']); // e.g. "Placement Top"
            const adjustment = parseFloat(this.getColumn(row, ['Bidding Adjustment Percentage', 'Percentage'])) || 0;

            if (!campaignMap.has(campaign)) {
                campaignMap.set(campaign, { topOfSearch: 0, productPages: 0 });
            }

            const data = campaignMap.get(campaign)!;
            // Map various placement strings
            if (placementType?.includes('Top of Search') || placementType?.includes('Top')) {
                data.topOfSearch = adjustment;
            } else if (placementType?.includes('Product Pages') || placementType?.includes('Product')) {
                data.productPages = adjustment;
            }
        });

        return Array.from(campaignMap.entries()).map(([campaign, data]) => ({
            campaign,
            topOfSearch: data.topOfSearch,
            productPages: data.productPages
        }));
    }

    private checkIntegrity(rows: any[]): IntegrityReport {
        const alerts: IntegrityReport['alerts'] = [];
        const missingColumns: string[] = [];

        // Count entities (loosely based on available columns)
        // We now primarily care about rows that HAVE a Campaign Name
        const changes = rows.filter(r => this.getColumn(r, ['Campaign Name', 'Campaign', 'Campaign Name (Informational only)']));

        const entityCounts = {
            portfolios: new Set(rows.map(r => this.getColumn(r, ['Portfolio Name', 'Portfolio Name (Informational only)', 'Portfolio'])).filter(Boolean)).size,
            campaigns: new Set(changes.map(r => this.getColumn(r, ['Campaign Name', 'Campaign', 'Campaign Name (Informational only)']))).size,
            adGroups: rows.filter(r => this.getColumn(r, ['Ad Group Name', 'Ad Group', 'Ad Group Name (Informational only)'])).length,
            asins: rows.filter(r => this.getColumn(r, ['ASIN', 'ASIN (Informational only)'])).length,
            keywords: 0 // Hard to count without strict entity type, but we can verify presence
        };

        // Debug: Log unique Entity types found
        const uniqueEntities = new Set(rows.map(r => this.getColumn(r, ['Entity', 'Record Type'])).filter(Boolean));

        // Check for required columns
        // We now require at least one variant of Campaign Name to be present
        const sampleRow = rows.length > 0 ? rows[0] : {};
        console.log('--- DEBUG: sampleRow keys:', Object.keys(sampleRow));
        console.log('--- DEBUG: Testing Campaign Name col:', this.getColumn(sampleRow, ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign']));

        const requiredColumns = [
            ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign'],
            // State is optional if we can't find it
        ];

        requiredColumns.forEach(colNames => {
            if (this.getColumn(sampleRow, colNames) === undefined) {
                missingColumns.push(colNames[0]); // Report the primary name
            }
        });

        if (missingColumns.length > 0) {
            alerts.push({
                type: 'error',
                message: `Missing required columns: ${missingColumns.join(', ')}`
            });
        }

        return {
            entityCounts,
            alerts,
            missingColumns
        };
    }

    private discriminator(row: any): string {
        // Try to determine Campaign Type (SP, SB, SD)
        // 1. Check "Campaign Type" column directly (rare in bulk but possible)
        const type = this.getColumn(row, ['Campaign Type', 'Type']);
        if (type) return type;

        // 2. Infer from other columns
        // Sponsored Brands often has "Creative" or "Headline" columns
        if (this.getColumn(row, ['Creative', 'Creative Type', 'Headline'])) return 'SB';

        // Sponsored Display often has "Cost Type" or "Viewable Impressions"
        if (this.getColumn(row, ['Cost Type', 'Viewable Impressions'])) return 'SD';

        // 3. Infer from Record Type / Entity
        const entity = this.getColumn(row, ['Entity', 'Record Type']);
        if (entity === 'Product Targeting' || entity === 'Keyword') return 'SP'; // Most likely

        return ''; // Unknown, let caller default to SP
    }
}
