import { GoogleSpreadsheet } from 'google-spreadsheet';

interface AsinKeywordRow {
    keyword: string;
    searchVolume: number;
    organicRank: number | null;
    sponsoredRank: number | null;
    cerebroIQScore: number | null;
    competingProducts: number;
    keywordSales: number | null;
    titleDensity: number;
    wordCount: number;
    pushPriority: number;
    strategyTag: 'RANK' | 'PROFIT' | 'SCALE' | 'PUSH';
    rootCluster: string;
    adDominance: 'ORGANIC_ONLY' | 'AD_BOOSTED' | 'AD_DEPENDENT' | 'NO_RANK';
}

interface HealthCards {
    organicDomination: number;
    strikeZone: number;
    indexingCoverage: { covered: number; total: number; percentage: number };
}

interface AsinIntelligenceResponse {
    healthCards: HealthCards;
    keywords: AsinKeywordRow[];
    rootClusters: { name: string; count: number; totalSV: number }[];
}

// Stop words for root clustering
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'to', 'for', 'of', 'in', 'on',
    'with', 'by', 'at', 'is', 'it', 'you', 'from', 'that', 'this',
    'be', 'are', 'was', 'not', 'but', 'what', 'all', 'were', 'we',
    'when', 'your', 'can', 'had', 'have', 'has', 'each', 'which',
    'their', 'do', 'how', 'if', 'will', 'up', 'other', 'about'
]);

function stem(word: string): string {
    const w = word.toLowerCase();
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
    if (w.endsWith('tion')) return w.slice(0, -4);
    if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
    return w;
}

function getRootWord(keyword: string): string {
    const words = keyword.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
        .map(stem);

    if (words.length === 0) return 'other';

    // Use the most significant word (first non-stop word)
    return words[0];
}

export class AsinIntelligenceService {
    private doc: GoogleSpreadsheet;

    constructor(doc: GoogleSpreadsheet) {
        this.doc = doc;
    }

    private parseNumber(value: any): number {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        return parseFloat(String(value).replace(/,/g, '')) || 0;
    }

    private parseRank(value: any): number | null {
        if (!value) return null;
        const str = String(value).trim();
        if (str === '' || str === '-' || str === 'N/A' || str === '0') return null;
        const num = parseInt(str, 10);
        return isNaN(num) || num <= 0 ? null : num;
    }

    async getIntelligence(): Promise<AsinIntelligenceResponse> {
        // Read from Raw_My_ASIN_Ranking (Cerebro My ASIN data)
        const sheet = this.doc.sheetsByTitle['Raw_My_ASIN_Ranking'];
        if (!sheet) {
            console.warn("'Raw_My_ASIN_Ranking' sheet not found.");
            return {
                healthCards: {
                    organicDomination: 0,
                    strikeZone: 0,
                    indexingCoverage: { covered: 0, total: 0, percentage: 0 }
                },
                keywords: [],
                rootClusters: []
            };
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        // Process keywords
        const keywords: AsinKeywordRow[] = [];
        let totalMarketSV = 0;
        let coveredSV = 0;
        const rootClusterMap = new Map<string, { count: number; totalSV: number }>();

        rows.forEach(row => {
            const keyword = (row.get('Keyword Phrase') || '').trim();
            if (!keyword) return;

            const searchVolume = this.parseNumber(row.get('Search Volume'));
            if (searchVolume <= 0) return;

            const organicRank = this.parseRank(row.get('Organic Rank') || row.get('Organic'));
            const sponsoredRank = this.parseRank(row.get('Sponsored Rank') || row.get('Sponsored Product'));
            const cerebroIQScore = this.parseNumber(row.get('Cerebro IQ Score'));
            const competingProducts = this.parseNumber(row.get('Competing Products'));
            const keywordSales = this.parseNumber(row.get('Keyword Sales'));
            const titleDensity = this.parseNumber(row.get('Title Density'));
            const wordCount = keyword.trim().split(/\s+/).length;

            // Estimated CPC from H10 suggestion or fallback
            const estimatedCPC = this.parseNumber(row.get('H10 PPC Sugg. Bid')) || 1.0;

            totalMarketSV += searchVolume;

            // Indexing coverage: keyword is "covered" if it has any organic rank
            if (organicRank !== null && organicRank <= 306) {
                coveredSV += searchVolume;
            }

            // Push Priority = K.Sales * CVR * Rank Weight
            let pushPriority = 0;
            const kSales = keywordSales || 0;
            const cvr = searchVolume > 0 ? (kSales / searchVolume) : 0;

            let rankWeight = 1.0;
            if (organicRank === null || organicRank > 50) {
                rankWeight = 1.0;
            } else if (organicRank >= 11 && organicRank <= 20) {
                rankWeight = 3.0; // Strike zone (ưu tiên cực cao)
            } else if (organicRank >= 21 && organicRank <= 30) {
                rankWeight = 2.0;
            } else if (organicRank >= 31 && organicRank <= 50) {
                rankWeight = 1.5;
            } else if (organicRank >= 1 && organicRank <= 10) {
                rankWeight = 0.5; // Top 10 -> duy trì
            }

            // Score scaled up by 10,000 for integer readability
            pushPriority = Math.round(kSales * cvr * rankWeight * 10000);

            // Strategy Tag
            let strategyTag: 'RANK' | 'PROFIT' | 'SCALE' | 'PUSH' = 'SCALE';

            if (organicRank !== null && organicRank <= 10) {
                strategyTag = 'RANK';
            } else if (organicRank !== null && organicRank >= 11 && organicRank <= 30 && (kSales >= 30 || cvr >= 0.02)) {
                strategyTag = 'PUSH';
            } else if ((organicRank === null || organicRank > 30) && (kSales > 0 || searchVolume >= 1000)) {
                strategyTag = 'SCALE';
            } else {
                strategyTag = 'PROFIT';
            }

            // Ad Dominance
            let adDominance: 'ORGANIC_ONLY' | 'AD_BOOSTED' | 'AD_DEPENDENT' | 'NO_RANK' = 'NO_RANK';
            if (organicRank !== null && sponsoredRank !== null) {
                adDominance = sponsoredRank < organicRank ? 'AD_BOOSTED' : 'ORGANIC_ONLY';
            } else if (organicRank !== null) {
                adDominance = 'ORGANIC_ONLY';
            } else if (sponsoredRank !== null) {
                adDominance = 'AD_DEPENDENT';
            }

            // Root Cluster
            const root = getRootWord(keyword);
            if (!rootClusterMap.has(root)) {
                rootClusterMap.set(root, { count: 0, totalSV: 0 });
            }
            const cluster = rootClusterMap.get(root)!;
            cluster.count++;
            cluster.totalSV += searchVolume;

            keywords.push({
                keyword,
                searchVolume,
                organicRank,
                sponsoredRank,
                cerebroIQScore,
                competingProducts,
                keywordSales,
                titleDensity,
                wordCount,
                pushPriority,
                strategyTag,
                rootCluster: root,
                adDominance
            });
        });

        // Sort by pushPriority desc
        keywords.sort((a, b) => b.pushPriority - a.pushPriority);

        // Health Cards (SV > 300 filter)
        const svThreshold = 300;
        const highSVKeywords = keywords.filter(k => k.searchVolume > svThreshold);
        const organicDomination = highSVKeywords.filter(k => k.organicRank !== null && k.organicRank <= 10).length;
        const strikeZone = highSVKeywords.filter(k => k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 30).length;
        const indexingPercentage = totalMarketSV > 0 ? Math.round((coveredSV / totalMarketSV) * 100) : 0;

        // Root clusters sorted by totalSV desc, filter small ones
        const rootClusters = Array.from(rootClusterMap.entries())
            .map(([name, data]) => ({ name: name.toUpperCase(), count: data.count, totalSV: data.totalSV }))
            .filter(c => c.count >= 3)
            .sort((a, b) => b.totalSV - a.totalSV)
            .slice(0, 20);

        return {
            healthCards: {
                organicDomination,
                strikeZone,
                indexingCoverage: {
                    covered: coveredSV,
                    total: totalMarketSV,
                    percentage: indexingPercentage
                }
            },
            keywords,
            rootClusters
        };
    }
}
