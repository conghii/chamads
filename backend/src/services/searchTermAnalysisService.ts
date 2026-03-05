
import { GoogleSpreadsheet } from 'google-spreadsheet';
import {
    SearchTermAnalysisData,
    SearchTermUsage,
    HarvestStatMetrics,
    TopCampaign
} from '../types/analysis';

export class SearchTermAnalysisService {
    private doc: GoogleSpreadsheet;

    constructor(doc: GoogleSpreadsheet) {
        this.doc = doc;
    }

    async analyzeSearchTerms(): Promise<SearchTermAnalysisData> {
        const stSheet = this.doc.sheetsByTitle['Raw_Search_Terms'];
        const bulkSheet = this.doc.sheetsByTitle['Raw_Amazon_Bulk'];

        if (!stSheet) {
            throw new Error('Raw_Search_Terms sheet not found. Please upload a Search Term Report first.');
        }

        const stRows = await stSheet.getRows();
        const bulkRows = bulkSheet ? await bulkSheet.getRows() : [];

        // 0. Build Search Volume Map from Market Intel
        const svMap = new Map<string, number>();
        const marketSheet = this.doc.sheetsByTitle['Raw_Market_Intel'];
        if (marketSheet) {
            const mRows = await marketSheet.getRows();
            mRows.forEach(r => {
                const kw = String(r.get('Keyword Phrase') || r.get('Keyword') || '').toLowerCase().trim();
                const sv = parseFloat(String(r.get('Search Volume') || '0').replace(/,/g, ''));
                if (kw && !isNaN(sv)) svMap.set(kw, sv);
            });
        }

        // 1. Build a map of Existing Targets from Bulk file for fast lookup
        // Key: CampaignName + AdGroupName + TargetText
        const existingTargets = new Set<string>();

        // Helper to normalize text for comparison
        const normalize = (s: any) => String(s || '').trim().toLowerCase();

        if (bulkRows.length > 0) {
            bulkRows.forEach(row => {
                const entity = row.get('Entity') || row.get('Record Type');
                if (entity === 'Keyword' || entity === 'Product Targeting') {
                    const campaign = normalize(row.get('Campaign Name') || row.get('Campaign'));
                    const adGroup = normalize(row.get('Ad Group Name') || row.get('Ad Group'));
                    const target = normalize(row.get('Keyword Text') || row.get('Targeting'));

                    if (campaign && adGroup && target) {
                        existingTargets.add(`${campaign}|${adGroup}|${target}`);
                    }
                }
            });
        }

        // 2. Process Search Term Rows
        const searchTerms: SearchTermUsage[] = stRows.map(row => {
            const campaignName = row.get('Campaign Name') || '';
            const adGroupName = row.get('Ad Group Name') || '';
            const searchTerm = row.get('Customer Search Term') || row.get('Search Term') || '';
            const matchType = row.get('Match Type') || 'Unknown';
            const portfolioName = row.get('Portfolio Name') || undefined;

            const spend = this.parseMoney(row.get('Spend'));
            const sales = this.parseMoney(row.get('Sales') || row.get('7 Day Total Sales'));
            const orders = this.parseMoney(row.get('Orders') || row.get('7 Day Total Orders (#)'));
            const clicks = this.parseMoney(row.get('Clicks'));
            const impressions = this.parseMoney(row.get('Impressions'));

            const acos = sales > 0 ? (spend / sales) * 100 : 0;
            const roas = spend > 0 ? sales / spend : 0;
            const cpc = clicks > 0 ? spend / clicks : 0;
            // CVR can be > 100% due to Amazon Brand Halo (1 click -> multiple orders over 7 days).
            // This is NOT a bug, but a feature of the attribution window.
            const cvr = clicks > 0 ? (orders / clicks) * 100 : 0;

            // Check if this term is already targeted
            // We use the "targeting" column from ST report if available, or check against our bulk map
            const targeting = normalize(row.get('Targeting') || row.get('Keyword')); // In ST report, this is the keyword that triggered it.
            // But "Is Targeting" means: Do we have this SEARCH TERM as a keyword?
            // Checking exact match against existing targets
            const isTargeting = existingTargets.has(`${normalize(campaignName)}|${normalize(adGroupName)}|${normalize(searchTerm)}`);

            // Determine Source Match Type
            let sourceMatchType: 'AUTO' | 'BROAD' | 'PHRASE' | 'EXACT' | 'UNKNOWN' = 'UNKNOWN';

            // Try to infer from Match Type column in ST report first (some reports have it)
            const rawMatchType = matchType.toUpperCase();
            if (rawMatchType.includes('AUTO') || rawMatchType === '-') sourceMatchType = 'AUTO';
            else if (rawMatchType.includes('BROAD')) sourceMatchType = 'BROAD';
            else if (rawMatchType.includes('PHRASE')) sourceMatchType = 'PHRASE';
            else if (rawMatchType.includes('EXACT')) sourceMatchType = 'EXACT';

            // If still unknown/auto, check the "Targeting" column (The keyword that triggered it)
            if (sourceMatchType === 'UNKNOWN' || sourceMatchType === 'AUTO') {
                // Often Targeting column contains "*" for Auto
                if (targeting === '*') sourceMatchType = 'AUTO';
            }

            // 3. Apply Analysis Logic (Rules)
            const { recommendation, reasons, strategies, priorityScore } = this.analyzeTerm({
                spend, orders, clicks, acos, cvr, sales, isTargeting
            });

            return {
                searchTerm,
                campaignName,
                adGroupName,
                matchType,
                portfolioName,
                spend,
                sales,
                orders,
                clicks,
                impressions,
                acos,
                roas,
                cpc,
                cvr,
                searchVolume: svMap.get(normalize(searchTerm)) || null,
                isTargeting,
                sourceMatchType,
                recommendation,
                reasons,
                strategies,
                priorityScore
            };
        });

        // 4. Calculate Aggregate Stats
        const stats = this.calculateStats(searchTerms);

        return {
            period: 'Last 65 Days', // Default for ST report usually
            stats,
            searchTerms
        };
    }

    private analyzeTerm(metrics: { spend: number, orders: number, clicks: number, acos: number, cvr: number, sales: number, isTargeting: boolean }) {
        const reasons: string[] = [];
        const strategies: ('SCALE' | 'RANK' | 'PROFIT')[] = [];
        let recommendation: 'MOVE_TO_EXACT' | 'NEGATIVE' | 'OPTIMIZE' | 'HOLD' | 'NONE' = 'NONE';

        // Calculate Priority Score
        // Original: (CVR * Orders) / ACoS -> can trigger huge numbers
        // New: Normalized to 0-100 using Log scale
        // Raw Score typically: (20 * 5) / 10 = 10. (900 * 9) / 0.3 = 27000.
        // We want 100 to be "Amazing".
        // Let's use a log cap. 
        let rawScore = metrics.acos > 0 ? (metrics.cvr * metrics.orders * 10) / (metrics.acos + 1) : 0;
        if (metrics.orders === 0) rawScore = 0;

        // Normalize: Log10 of raw score. 
        // If Raw = 100 -> Log = 2.
        // If Raw = 27000 -> Log = 4.4.
        // Let's map 0-5 Log to 0-100.
        const logScore = Math.log10(rawScore + 1);
        const priorityScore = Math.min(100, Math.max(0, logScore * 20)); // Scale log(100,000)=5 -> 100.

        // --- STRATEGY CLASSIFICATION ---
        if (!metrics.isTargeting) {
            // SCALE: Orders >= 3 AND ACoS < 45%
            if (metrics.orders >= 3 && metrics.acos < 45) {
                strategies.push('SCALE');
                recommendation = 'MOVE_TO_EXACT';
                reasons.push('Scale Potential (Orders >= 3, ACoS < 45%)');
            }

            // RANK: CVR > 20% AND Clicks > 10
            if (metrics.cvr > 20 && metrics.clicks > 10) {
                strategies.push('RANK');
                recommendation = 'MOVE_TO_EXACT';
                reasons.push('Unused Rank Juice (CVR > 20%)');
            }
        }

        // PROFIT Rules (always check, regardless of targeting)
        // PROFIT: ACoS > 50% OR (Spend > 25 AND Orders = 0)
        if (metrics.acos > 50 || (metrics.spend > 25 && metrics.orders === 0)) {
            strategies.push('PROFIT');

            if (metrics.orders === 0) {
                recommendation = 'NEGATIVE';
                reasons.push('Bleeding (Spend > $25, 0 Orders)');
            } else {
                recommendation = 'OPTIMIZE';
                reasons.push('Low Profitability (ACoS > 50%)');
            }
        }

        // Default recommendation if no strategy matched but still good
        if (recommendation === 'NONE' && !metrics.isTargeting) {
            if (metrics.orders >= 3 && metrics.acos < 30) {
                recommendation = 'MOVE_TO_EXACT';
                reasons.push('Proven Winner (Default criteria)');
            }
        }

        return { recommendation, reasons, strategies, priorityScore };
    }

    private calculateStats(terms: SearchTermUsage[]): HarvestStatMetrics {
        const bleedingTerms = terms.filter(t => t.recommendation === 'NEGATIVE');
        const harvestTerms = terms.filter(t => t.recommendation === 'MOVE_TO_EXACT');

        const bleedingWaste = bleedingTerms.reduce((sum, t) => sum + t.spend, 0);

        // Efficiency Score: 100 - (Bleeding Spend / Total Spend * 100)
        // User Feedback: Score is too lenient (100/100 even with waste).
        // Fix: Apply a stricter penalty multiplier (2x) to waste, and ensure if there is ANY waste, score cannot be 100.
        const totalSpend = terms.reduce((sum, t) => sum + t.spend, 0);

        let efficiencyScore = 100;
        if (totalSpend > 0) {
            const wasteRatio = (bleedingWaste / totalSpend) * 100;
            // Penalty: 2x the waste percentage. If 5% waste -> 10 point penalty -> 90 Score.
            efficiencyScore = Math.max(0, 100 - (wasteRatio * 2));

            // Hard Cap: If there is ANY bleeding waste, maximum score is 99 (never perfect).
            if (bleedingWaste > 0 && efficiencyScore > 99) {
                efficiencyScore = 99;
            }
        }

        return {
            bleedingWaste,
            harvestPotential: harvestTerms.reduce((sum, t) => sum + t.sales, 0), // Potential sales from these terms
            efficiencyScore,
            totalSearchTerms: terms.length
        };
    }

    private parseMoney(value: any): number {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        return parseFloat(value.toString().replace(/[$,]/g, '')) || 0;
    }
}
