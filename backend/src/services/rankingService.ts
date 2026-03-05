import { GoogleSpreadsheet } from 'google-spreadsheet';
import { MasterKeywordRecord } from '../types';

interface RankingData {
    keyword: string;
    asin: string;
    searchVolume: number;
    organicRank: number | null;
    sponsoredRank: number | null;
    history: { date: string; organic: number | null; sponsored: number | null }[];
}

export class RankingService {
    private doc: GoogleSpreadsheet;

    constructor(doc: GoogleSpreadsheet) {
        this.doc = doc;
    }

    async getRankingData(asin?: string): Promise<RankingData[]> {
        // 1. Fetch Data from 'Rank Organic' Sheet as requested
        let sheet = this.doc.sheetsByTitle['Rank Organic'];

        // Fallback to 'Raw_My_ASIN_Ranking' if 'Rank Organic' is missing
        if (!sheet) {
            console.warn("'Rank Organic' sheet not found. Attempting fallback to 'Raw_My_ASIN_Ranking'.");
            sheet = this.doc.sheetsByTitle['Raw_My_ASIN_Ranking'];
        }

        if (!sheet) {
            console.warn('No ranking sheet found. Returning empty ranking data.');
            return [];
        }

        await sheet.loadHeaderRow(); // Ensure headers are loaded
        const rows = await sheet.getRows();
        const headers = sheet.headerValues;

        // Identify Date Columns (Format: DD/MM or D/M)
        const dateRegex = /^\d{1,2}\/\d{1,2}$/;
        const dateHeaders = headers.filter(h => dateRegex.test(h));

        // Identify SV and Ads columns
        const svHeader = headers.find(h => h.toLowerCase().includes('search vol'));
        const adsHeader = headers.find(h => h.toLowerCase() === 'ads');

        console.log("HEADERS:", headers);
        console.log("Found SV Header:", svHeader, "Found Ads Header:", adsHeader);

        // Sort dates to ensure chronological order if needed, but usually they are sequential columns
        // For now, assume they are ordered or we process them as is.

        const rankingMap = new Map<string, RankingData>();

        // 2. Process Rows
        let currentAsin: string | null = null;

        rows.forEach(row => {
            const rowAsinRaw = row.get('ASIN');
            const keyword = row.get('Keyword');

            // Handle ASIN Fill-Down
            // If row has ASIN, update current. If not, keep using current.
            if (rowAsinRaw) {
                currentAsin = rowAsinRaw;
            }

            // Skip rows without keywords (e.g. blank separator rows)
            if (!keyword) return;

            // If we still don't have an ASIN (and first rows were empty?), skip or label unknown
            const effectiveAsin = currentAsin || 'Unknown';

            // Filter by ASIN if provided (Strict Check)
            // If user selected specific ASIN, we compare with effectiveAsin
            if (asin && effectiveAsin !== asin) return;

            const key = `${keyword}-${effectiveAsin}`;

            // Parse SV and Ads
            const svRaw = svHeader ? row.get(svHeader) : null;
            const adsRaw = adsHeader ? row.get(adsHeader) : null;

            let parsedSv = 0;
            if (svRaw && !isNaN(parseInt(svRaw.replace(/,/g, ''), 10))) {
                parsedSv = parseInt(svRaw.replace(/,/g, ''), 10);
            }

            let parsedAds: number | null = null;
            if (adsRaw && !isNaN(parseInt(adsRaw, 10))) {
                parsedAds = parseInt(adsRaw, 10);
            }

            // Build History
            const history: { date: string; organic: number | null; sponsored: number | null }[] = [];
            let latestRank: number | null = null;
            let latestAdsRank: number | null = null;

            dateHeaders.forEach(date => {
                const cellValue = row.get(date);
                const ranks = this.parseRankCell(cellValue);

                history.push({
                    date: date,
                    organic: ranks.organic,
                    sponsored: ranks.sponsored
                });

                if (ranks.organic !== null) {
                    latestRank = ranks.organic;
                }
                if (ranks.sponsored !== null) {
                    latestAdsRank = ranks.sponsored;
                }
            });

            // Let's populate the main object
            if (!rankingMap.has(key)) {
                rankingMap.set(key, {
                    keyword,
                    asin: effectiveAsin,
                    searchVolume: parsedSv,
                    organicRank: latestRank,
                    sponsoredRank: latestAdsRank !== null ? latestAdsRank : parsedAds,
                    history: history
                });
            }
        });

        return Array.from(rankingMap.values());
    }

    private parseRank(value: any): number | null {
        // Legacy simple parser
        if (!value || value === '-' || value === 'N/A') return null;
        const num = parseInt(value, 10);
        return isNaN(num) ? null : num;
    }

    private parseRankCell(value: any): { organic: number | null; sponsored: number | null } {
        if (!value) return { organic: null, sponsored: null };
        const strVal = String(value).trim();

        let organic: number | null = null;
        let sponsored: number | null = null;

        // Helper to parse "Page X N Y" formats
        const extractRank = (str: string, regex: RegExp) => {
            if (str === 'Not In Top 150' || str === 'Not found') return 151; // Or null depending on preference, 151 is often used for "not ranked"
            const match = str.match(regex);
            if (match) {
                const page = parseInt(match[1], 10);
                const no = parseInt(match[2], 10);
                return (page - 1) * 50 + no;
            }
            const num = parseInt(str, 10);
            return isNaN(num) ? null : num;
        };

        // Check if it's the new format "Org: ... | Ad: ..."
        if (strVal.includes('Org:') && strVal.includes('Ad:')) {
            const parts = strVal.split('|').map(p => p.trim());
            const orgPart = parts.find(p => p.startsWith('Org:'))?.replace('Org:', '').trim() || '';
            const adPart = parts.find(p => p.startsWith('Ad:'))?.replace('Ad:', '').trim() || '';

            if (orgPart === 'Not In Top 150') {
                organic = 151;
            } else {
                organic = extractRank(orgPart, /Page\s+(\d+)\s+No\s+(\d+)/i);
            }

            if (adPart === 'Not found') {
                sponsored = 151;
            } else {
                sponsored = extractRank(adPart, /Page\s+(\d+)\s+Ad\s+(\d+)/i);
            }
            return { organic, sponsored };
        }

        // Legacy format fallback
        if (strVal === 'Not In Top 150') {
            organic = 151;
        } else {
            organic = extractRank(strVal, /Page\s+(\d+)\s+No\s+(\d+)/i);
        }

        return { organic, sponsored };
    }

    async getKeywordDetails(keyword: string, asin: string) {
        // detailed history would go here
        return {
            keyword,
            asin,
            history: [] // Placeholder
        };
    }

    async getMarketDominanceData(): Promise<{ competitors: string[], rows: any[], stats: any }> {
        const sheet = this.doc.sheetsByTitle['Raw_Market_Intel'];
        if (!sheet) {
            console.warn("'Raw_Market_Intel' sheet not found.");
            return { competitors: [], rows: [], stats: { totalKeywords: 0, totalSV: 0, mustRunCount: 0 } };
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const headers = sheet.headerValues;

        // 1. Identify Competitor ASIN Columns (Headers looking like 'B0...')
        const competitorAsins = headers.filter(h => /^B0[A-Z0-9]{8}$/i.test(h));
        console.log(`[MarketDominance] Found ${competitorAsins.length} competitor ASINs:`, competitorAsins);

        const marketRows: any[] = [];
        let totalSV = 0;
        let mustRunCount = 0;

        rows.forEach(row => {
            const keyword = row.get('Keyword Phrase') || row.get('Keyword');
            if (!keyword) return;

            const wordCount = keyword.trim().split(/\s+/).length;

            const searchVolume = this.parseNumber(row.get('Search Volume'));
            const competingProducts = this.parseNumber(row.get('Competing Products'));
            const cpr = this.parseNumber(row.get('CPR') || row.get('CPR 8-Day Giveaways'));
            const titleDensity = this.parseNumber(row.get('Title Density'));

            // Cerebro built-in aggregate fields
            const cerebroCompCount = this.parseNumber(row.get('Ranking Competitors (count)') || row.get('Ranking Competitors'));
            const cerebroAvgRank = this.parseNumber(row.get('Competitor Rank (avg)') || row.get('Competitor Rank'));

            // Extract ranks for each competitor
            const competitorRanks: Record<string, number | null> = {};
            const rankedCompetitors: number[] = []; // For avg calculation

            competitorAsins.forEach(asin => {
                const rankVal = this.parseNumber(row.get(asin));
                const rank = rankVal > 0 && rankVal <= 150 ? rankVal : null;
                competitorRanks[asin] = rank;

                if (rank !== null) {
                    rankedCompetitors.push(rank);
                }
            });

            // 1. Hybrid Competitor Count (Top 30)
            const top30CountFromAsins = rankedCompetitors.filter(r => r <= 30).length;
            const finalTop30Count = Math.max(top30CountFromAsins, cerebroCompCount);
            const top10Count = rankedCompetitors.filter(r => r <= 10).length;

            // 2. Hybrid Average Rank
            const calculatedAvgRank = rankedCompetitors.length > 0
                ? Math.round(rankedCompetitors.reduce((a, b) => a + b, 0) / rankedCompetitors.length)
                : 0;
            const effectiveAvgRank = calculatedAvgRank > 0 ? calculatedAvgRank : cerebroAvgRank;

            // 3. Relevancy Score (0-10)
            const relevancyScore = finalTop30Count;

            // 4. Calculate Market Opportunity Score
            const opportunityScore = effectiveAvgRank > 0
                ? Math.round(searchVolume / effectiveAvgRank)
                : 0;

            if (relevancyScore >= 8) mustRunCount++;
            totalSV += searchVolume;

            // 5. Launch Intelligence Categorization
            let launchCategory = 'Description';
            if (relevancyScore >= 6) {
                if (searchVolume >= 2000) launchCategory = 'Title';
                else launchCategory = 'Bullet';
            } else if (relevancyScore >= 4) {
                launchCategory = 'Bullet';
            }

            marketRows.push({
                keyword,
                wordCount,
                searchVolume,
                competingProducts,
                cpr,
                titleDensity,
                competitorRanks,
                competitorCount: { top10: top10Count, top30: finalTop30Count },
                relevancyScore,
                avgCompetitorRank: effectiveAvgRank,
                opportunityScore,
                launchCategory
            });
        });

        // Sort by Relevancy Score Desc primary, Search Volume Desc secondary
        marketRows.sort((a, b) => {
            if (b.relevancyScore !== a.relevancyScore) {
                return b.relevancyScore - a.relevancyScore;
            }
            return b.searchVolume - a.searchVolume;
        });

        return {
            competitors: competitorAsins,
            rows: marketRows,
            stats: {
                totalKeywords: marketRows.length,
                totalSV,
                mustRunCount
            }
        };
    }

    async getDominationAuditData(): Promise<any[]> {
        // 1. Get Market Data (Competitors)
        const marketData = await this.getMarketDominanceData();

        // 2. Get User Ranking Data
        const userRanking = await this.getRankingData();
        const userRankingMap = new Map<string, number | null>();
        userRanking.forEach(r => {
            // Store the best rank for each keyword
            const existing = userRankingMap.get(r.keyword);
            if (existing === undefined || (r.organicRank !== null && (existing === null || r.organicRank < existing))) {
                userRankingMap.set(r.keyword, r.organicRank);
            }
        });

        // 3. Merge and Calculate
        const auditRows = marketData.rows.map(row => {
            const myRank = userRankingMap.get(row.keyword) ?? null;
            const saturation = row.competitorCount.top10 / 10;

            // Effective rank for priority calculation (max 100)
            const effectiveRank = (myRank === null || myRank > 100) ? 100 : myRank;

            // Priority Score = (SV * Saturation) / EffectiveRank
            const priorityScore = effectiveRank > 0
                ? Math.round((row.searchVolume * saturation) / effectiveRank)
                : 0;

            // Gap Classification
            let gapCategory = 'Neutral';
            let gapColor = 'slate';

            if (saturation >= 0.8 && (myRank === null || myRank > 100)) {
                gapCategory = 'Critical Gap';
                gapColor = 'red';
            } else if (saturation >= 0.5 && myRank !== null && myRank >= 30 && myRank <= 50) {
                gapCategory = 'Ranking Opportunity';
                gapColor = 'orange';
            } else if (myRank !== null && myRank <= 10 && saturation >= 0.5) {
                gapCategory = 'Defending Zone';
                gapColor = 'emerald';
            }

            return {
                keyword: row.keyword,
                searchVolume: row.searchVolume,
                marketSaturation: saturation,
                yourRank: myRank,
                gapCategory,
                gapColor,
                priorityScore,
                // Action Context (helpful for frontend buttons)
                oppScore: row.opportunityScore
            };
        });

        return auditRows.sort((a, b) => b.priorityScore - a.priorityScore);
    }

    private parseNumber(value: any): number {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        return parseFloat(String(value).replace(/,/g, '')) || 0;
    }
}
