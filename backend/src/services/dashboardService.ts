import { GoogleSpreadsheet } from 'google-spreadsheet';
import { BulkAnalysisService } from './bulkAnalysisService';
import { AsinIntelligenceService } from './asinIntelligenceService';
import { RankingService } from './rankingService';
import { BusinessReportService } from './businessReportService';
import * as fs from 'fs';
import * as path from 'path';

const DEBUG_LOG_PATH = path.join(process.cwd(), 'debug_backend.log');
function logDebug(msg: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] ${msg}\n`);
}

export interface DashboardSummary {
    dataFreshness: {
        cerebroSync: { status: 'fresh' | 'stale' | 'missing', lastUpdated: string };
        bulkFileStatus: { status: 'fresh' | 'stale' | 'missing', lastUpdated: string };
        keywordTracking: { status: 'fresh' | 'stale' | 'missing', lastUpdated: string };
    };
    profitability: {
        totalSpend: number;
        totalSales: number;
        tacos: number;
        tacosHistory: { date: string, value: number }[];
        kSalesAttribution: { goldSales: number, totalKSales: number, percentage: number };
    };
    rankingStrategy: {
        marketDominanceScore: { percentage: number, yourTop10: number, competitorTop10: number };
        strikeZoneCounter: number;
    };
    quickActions: {
        bleedingKeywords: number;
        goldenOpportunities: number;
    };
    businessReport?: {
        totalSales: number;
        sessions: number;
        organicSales: number;
        organicRatio: number;
        lastUpdated?: string;
    } | null;
}

export class DashboardService {
    private doc: GoogleSpreadsheet;

    constructor(doc: GoogleSpreadsheet) {
        this.doc = doc;
    }

    async getDashboardSummary(): Promise<DashboardSummary> {
        const start = Date.now();
        logDebug('[Dashboard] Starting getDashboardSummary (Parallel Mode)');

        // Init services
        const bulkService = new BulkAnalysisService(this.doc);
        const asinIntelService = new AsinIntelligenceService(this.doc);
        const rankingService = new RankingService(this.doc);
        const brService = new BusinessReportService();

        // 1. Check Sheet presence (sync operation on doc.sheetsByTitle)
        const hasCerebro = !!this.doc.sheetsByTitle['Raw_My_ASIN_Ranking'];
        const hasBulk = !!this.doc.sheetsByTitle['Raw_Amazon_Bulk'];
        const hasRank = !!this.doc.sheetsByTitle['Rank Organic'];

        const dataFreshness = {
            cerebroSync: {
                status: hasCerebro ? 'fresh' : 'missing' as any,
                lastUpdated: hasCerebro ? new Date().toISOString() : 'N/A'
            },
            bulkFileStatus: {
                status: hasBulk ? 'fresh' : 'missing' as any,
                lastUpdated: hasBulk ? new Date().toISOString() : 'N/A'
            },
            keywordTracking: {
                status: hasRank ? 'fresh' : 'missing' as any,
                lastUpdated: hasRank ? new Date().toISOString() : 'N/A'
            }
        };

        // 2. Parallel Data Fetching
        logDebug('[Dashboard] Launching parallel fetches');
        const tasks = [
            // BR Metadata
            (async () => {
                try {
                    const brMeta = await brService.getMetadata('team1');
                    logDebug(`[Dashboard] BR Metadata loaded: ${!!brMeta}`);
                    return brMeta;
                } catch (e) {
                    logDebug(`[Dashboard] BR Metadata error: ${e}`);
                    return null;
                }
            })(),
            // Bulk Analysis
            (async () => {
                if (!hasBulk) return null;
                try {
                    const data = await bulkService.getBulkAnalysis();
                    logDebug('[Dashboard] Bulk Analysis loaded');
                    return data;
                } catch (e) {
                    logDebug(`[Dashboard] Bulk Analysis error: ${e}`);
                    return null;
                }
            })(),
            // Cerebro Intel
            (async () => {
                if (!hasCerebro) return null;
                try {
                    const data = await asinIntelService.getIntelligence();
                    logDebug('[Dashboard] Cerebro Intel loaded');
                    return data;
                } catch (e) {
                    logDebug(`[Dashboard] Cerebro Intel error: ${e}`);
                    return null;
                }
            })(),
            // Market Dominance
            (async () => {
                try {
                    const data = await rankingService.getMarketDominanceData();
                    logDebug('[Dashboard] Market Dominance loaded');
                    return data;
                } catch (e) {
                    logDebug(`[Dashboard] Market Dominance error: ${e}`);
                    return null;
                }
            })(),
            // Summary History
            (async () => {
                try {
                    const logSheet = this.doc.sheetsByTitle['SYSTEM_LOG'] || await this.doc.addSheet({ title: 'SYSTEM_LOG', headerValues: ['Date', 'Type', 'Value'] });
                    await logSheet.loadHeaderRow();
                    const rows = await logSheet.getRows();
                    logDebug(`[Dashboard] System Log loaded (${rows.length} rows)`);
                    return { sheet: logSheet, rows };
                } catch (e) {
                    logDebug(`[Dashboard] System Log error: ${e}`);
                    return null;
                }
            })()
        ];

        const [brMeta, bulkData, intelData, marketData, logData] = await Promise.all(tasks) as [any, any, any, any, any];
        logDebug('[Dashboard] All parallel fetches completed');

        // 3. Process Business Report Data
        let businessReportData: DashboardSummary['businessReport'] = null;
        if (brMeta) {
            businessReportData = {
                totalSales: brMeta.totalSales,
                sessions: brMeta.avgSessions,
                organicSales: 0,
                organicRatio: 0,
                lastUpdated: brMeta.lastUpdated ? new Date((brMeta.lastUpdated as any).toMillis ? (brMeta.lastUpdated as any).toMillis() : brMeta.lastUpdated).toISOString() : undefined
            };
        }

        // 4. Calculate Profitability Metrics
        let totalSpend = 0;
        let totalSales = 0;
        let bleedingKeywords = 0;
        let goldenOpportunities = 0;

        if (bulkData) {
            bulkData.topCampaigns.forEach((c: any) => {
                totalSpend += c.spend;
                totalSales += c.sales;
            });
            bleedingKeywords = bulkData.convertingKeywords.filter((k: any) => k.spend > 10 && k.orders === 0).length;
        }

        let tacos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;

        if (businessReportData) {
            businessReportData.organicSales = Math.max(0, businessReportData.totalSales - totalSales);
            businessReportData.organicRatio = businessReportData.totalSales > 0 ? (businessReportData.organicSales / businessReportData.totalSales) * 100 : 0;
            tacos = businessReportData.totalSales > 0 ? (totalSpend / businessReportData.totalSales) * 100 : 0;
        }

        // 5. Build History
        let tacosHistory: { date: string, value: number }[] = [];
        if (logData) {
            const today = new Date().toISOString().split('T')[0];
            const existingToday = logData.rows.find((r: any) => r.get('Date') === today && r.get('Type') === 'TACOS');

            if (!existingToday && totalSales > 0) {
                await logData.sheet.addRow({ Date: today, Type: 'TACOS', Value: tacos.toFixed(2) });
            }

            tacosHistory = logData.rows
                .filter((r: any) => r.get('Type') === 'TACOS')
                .slice(-7)
                .map((r: any) => ({
                    date: r.get('Date'),
                    value: parseFloat(r.get('Value'))
                }));

            if (!existingToday && totalSales > 0) {
                tacosHistory.push({ date: today, value: parseFloat(tacos.toFixed(2)) });
            }
        }

        // 6. Calculate Ranking & Intelligence Metrics
        let goldSales = 0;
        let totalKSales = 0;
        let strikeZoneCounter = 0;

        if (intelData) {
            intelData.keywords.forEach((k: any) => {
                const sales = k.keywordSales || 0;
                totalKSales += sales;
                if (k.pushPriority > 50) goldSales += sales;
                if (k.organicRank !== null && k.organicRank >= 11 && k.organicRank <= 30) strikeZoneCounter++;
                if (k.organicRank !== null && k.organicRank > 10 && k.pushPriority > 80) goldenOpportunities++;
            });
        }

        const kSalesAttribution = {
            goldSales,
            totalKSales,
            percentage: totalKSales > 0 ? (goldSales / totalKSales) * 100 : 0
        };

        // 7. Calculate Market Dominance
        let yourTop10 = 0;
        let competitorTop10 = 0;

        if (marketData && marketData.competitors?.length > 0) {
            const targetComp = marketData.competitors[0];
            marketData.rows.forEach((r: any) => {
                const compRank = r.competitorRanks?.[targetComp];
                const myRank = r.myRank || r.organicRank;
                if (compRank && compRank <= 10) competitorTop10++;
                if (myRank && myRank <= 10) yourTop10++;
            });
        }

        const marketDominancePercentage = competitorTop10 > 0 ? (yourTop10 / competitorTop10) * 100 : 0;

        const summary: DashboardSummary = {
            dataFreshness,
            profitability: {
                totalSpend,
                totalSales,
                tacos,
                tacosHistory,
                kSalesAttribution
            },
            rankingStrategy: {
                marketDominanceScore: {
                    percentage: marketDominancePercentage,
                    yourTop10,
                    competitorTop10
                },
                strikeZoneCounter
            },
            quickActions: {
                bleedingKeywords,
                goldenOpportunities
            },
            businessReport: businessReportData
        };

        const totalTime = Date.now() - start;
        logDebug(`[Dashboard] Finished getDashboardSummary in ${totalTime}ms`);
        return summary;
    }
}
