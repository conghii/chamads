import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const DEBUG_LOG_PATH = path.join(process.cwd(), 'debug_backend.log');
function logDebug(msg: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] ${msg}\n`);
}
logDebug('Backend starting or reloaded');
import { spawn } from 'child_process';
import cron from 'node-cron';
import { SheetsService } from './services/sheetsService';
import { BusinessReportService } from './services/businessReportService';
import { cacheService } from './services/cacheService';
import { MasterKeywordRecord, RawFileType } from './types';

dotenv.config();

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, './service-account-key.json');
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath)
        });
        console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase Admin initialization failed:', error);
    }
}

export const app = express();
const port = Number(process.env.PORT) || 3000;

const rankerDir = path.resolve(__dirname, '../../check-ranking-amazon-v7');

/**
 * Starts the Rank Checker UI Server on port 3001
 */
function startRankerService() {
    console.log('🚀 Starting Amazon Rank Checker UI Service...');
    const serverProcess = spawn('node', ['server.js'], {
        cwd: rankerDir,
        stdio: 'inherit',
        env: { ...process.env, PORT: '3001' }
    });

    serverProcess.on('error', (err) => {
        console.error('❌ Failed to start Rank Checker Server:', err);
    });
}

/**
 * Triggers an automated Ranking Check (Full Run)
 */
function triggerRankCheck() {
    console.log('🔍 Triggering automated Ranking Check (Full Run)...');
    const runProcess = spawn('node', ['index.js'], {
        cwd: rankerDir,
        stdio: 'inherit',
        env: {
            ...process.env,
            MODE: 'full',
            TARGET_SHEET_ID: process.env.GOOGLE_SHEET_ID
        }
    });

    runProcess.on('close', (code) => {
        console.log(`✅ Automated Ranking Check finished with code ${code}`);
    });
}

/**
 * Main Rank Checker automation setup
 */
function setupRankCheckerAutomation() {
    startRankerService();

    // 1. Initial run on startup
    triggerRankCheck();

    // 2. Schedule daily run at 20:00 (8:00 PM)
    console.log('⏰ Scheduling daily Ranking Check at 20:00...');
    cron.schedule('0 20 * * *', () => {
        console.log('🕒 Cron Trigger: Starting scheduled 20:00 Ranking Check');
        triggerRankCheck();
    });
}

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for potentially large sync payloads

// Initialize Sheets Service
const sheetId = process.env.GOOGLE_SHEET_ID || '';
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

const sheetsService = new SheetsService(sheetId, clientEmail, privateKey);

app.get('/', (req, res) => {
    res.send('Amazon Master Data Hub API is running');
});

interface SyncRequestBody {
    data: MasterKeywordRecord[];
    rawData?: any[]; // Optional as legacy calls might not have it
    fileType: RawFileType;
}

app.post('/api/sync', async (req, res): Promise<void> => {
    logDebug(`[Sync] Request received at /api/sync`);
    try {
        if (!sheetId || !clientEmail || !privateKey) {
            res.status(500).json({ error: 'Server misconfiguration: Missing Google Sheets credentials' });
            return;
        }

        const { data, rawData, fileType } = req.body as SyncRequestBody;

        logDebug(`[Sync] Received: ${data.length} master records, ${rawData?.length || 0} raw rows, type: ${fileType}`);

        if (!data || !Array.isArray(data)) {
            res.status(400).json({ error: 'Invalid data format' });
            return;
        }

        await sheetsService.initialize();
        await sheetsService.syncData(data, rawData || [], fileType);

        // Clear cache on sync to ensure fresh data for next loads
        cacheService.clear();

        if (fileType === 'AMAZON_BUSINESS_REPORT' && rawData && rawData.length > 0) {
            logDebug(`[Sync] Business Report detected (${rawData.length} rows). Saving metadata for team1...`);
            const businessReportService = new BusinessReportService();
            const teamId = 'team1';
            await businessReportService.saveMetadata(teamId, rawData, 'Raw_Business_Report');
        }

        res.json({ success: true, count: data.length });
    } catch (error: any) {
        console.error('Sync error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});

// Dashboard Summary Endpoint
app.get('/api/dashboard/summary', async (req, res): Promise<void> => {
    try {
        const cacheKey = 'dashboard_summary';
        const cached = cacheService.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        if (!sheetId || !clientEmail || !privateKey) {
            res.status(500).json({ error: 'Server misconfiguration' });
            return;
        }

        await sheetsService.initialize();
        const { DashboardService } = await import('./services/dashboardService');
        const dashboardService = new DashboardService(sheetsService.getDoc());

        const data = await dashboardService.getDashboardSummary();
        cacheService.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('Dashboard Summary API error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Analysis Bulk endpoint
app.get('/api/analysis/bulk', async (req, res): Promise<void> => {
    try {
        const cacheKey = 'bulk_analysis';
        const cached = cacheService.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        if (!sheetId || !clientEmail || !privateKey) {
            res.status(500).json({ error: 'Server misconfiguration' });
            return;
        }

        await sheetsService.initialize();
        const { BulkAnalysisService } = await import('./services/bulkAnalysisService');
        const analysisService = new BulkAnalysisService(sheetsService.getDoc());

        const analysisData = await analysisService.getBulkAnalysis();
        cacheService.set(cacheKey, analysisData);
        res.json(analysisData);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Harvest Hub Analysis
app.get('/api/analysis/harvest', async (req, res): Promise<void> => {
    try {
        const cacheKey = 'harvest_analysis';
        const cached = cacheService.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        if (!sheetId || !clientEmail || !privateKey) {
            res.status(500).json({ error: 'Server misconfiguration' });
            return;
        }

        await sheetsService.initialize();
        const { SearchTermAnalysisService } = await import('./services/searchTermAnalysisService');
        const stService = new SearchTermAnalysisService(sheetsService.getDoc());

        const harvestData = await stService.analyzeSearchTerms();
        cacheService.set(cacheKey, harvestData);
        res.json(harvestData);
    } catch (error) {
        console.error('Harvest Analysis error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Ranking Analysis Endpoint
app.get('/api/ranking', async (req, res): Promise<void> => {
    try {
        const asin = req.query.asin as string | undefined;
        const cacheKey = `ranking_${asin || 'all'}`;
        const cached = cacheService.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        if (!sheetId || !clientEmail || !privateKey) {
            res.status(500).json({ error: 'Server misconfiguration' });
            return;
        }

        await sheetsService.initialize();
        const { RankingService } = await import('./services/rankingService');
        const rankingService = new RankingService(sheetsService.getDoc());

        const data = await rankingService.getRankingData(asin);
        cacheService.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('Ranking API error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ASIN Intelligence Endpoint
app.get('/api/asin-intelligence', async (req, res): Promise<void> => {
    try {
        const cacheKey = 'asin_intelligence';
        const cached = cacheService.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        if (!sheetId || !clientEmail || !privateKey) {
            res.status(500).json({ error: 'Server misconfiguration' });
            return;
        }

        await sheetsService.initialize();
        const { AsinIntelligenceService } = await import('./services/asinIntelligenceService');
        const service = new AsinIntelligenceService(sheetsService.getDoc());

        const data = await service.getIntelligence();
        cacheService.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('ASIN Intelligence API error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Market Dominance Endpoint
app.get('/api/ranking/market-dominance', async (req, res): Promise<void> => {
    try {
        await sheetsService.initialize();
        const { RankingService } = await import('./services/rankingService');
        const rankingService = new RankingService(sheetsService.getDoc());
        const data = await rankingService.getMarketDominanceData();
        res.json(data);
    } catch (error) {
        console.error('Market Dominance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/ranking/domination-audit', async (req, res): Promise<void> => {
    try {
        await sheetsService.initialize();
        const { RankingService } = await import('./services/rankingService');
        const rankingService = new RankingService(sheetsService.getDoc());
        const data = await rankingService.getDominationAuditData();
        res.json(data);
    } catch (error) {
        console.error('Domination Audit error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Ranking Track Endpoint
app.post('/api/ranking/track', async (req, res): Promise<void> => {
    try {
        const { asin, keyword, searchVolume, ads } = req.body;
        await sheetsService.initialize();
        const result = await sheetsService.addKeywordToTracking('Rank Organic', { asin, keyword, searchVolume, ads });
        res.json({ success: true, added: result.added, message: result.message });
    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all tracked keywords
app.get('/api/ranking/tracked-keywords', async (req, res): Promise<void> => {
    try {
        await sheetsService.initialize();
        const keywords = await sheetsService.getTrackedKeywords('Rank Organic');
        res.json({ keywords });
    } catch (error) {
        console.error('Tracked keywords error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Products API
app.get('/api/products', async (req, res): Promise<void> => {
    try {
        await sheetsService.initialize();
        const { ProductService } = await import('./services/productService');
        const productService = new ProductService(sheetsService.getDoc());
        const products = await productService.getProducts();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/products/delete', async (req, res): Promise<void> => {
    try {
        const { asins } = req.body;
        if (!asins || !Array.isArray(asins)) {
            res.status(400).json({ error: 'ASINs array is required' });
            return;
        }
        await sheetsService.initialize();
        const { ProductService } = await import('./services/productService');
        const productService = new ProductService(sheetsService.getDoc());
        await productService.deleteProducts(asins);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete products error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/products', async (req, res): Promise<void> => {
    try {
        await sheetsService.initialize();
        const { ProductService } = await import('./services/productService');
        const productService = new ProductService(sheetsService.getDoc());
        await productService.saveProduct(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Trigger Ranking Tool
app.post('/api/ranking/run-tool', async (req, res): Promise<void> => {
    try {
        triggerRankCheck();
        res.json({ success: true, message: 'Rank checker started.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Profit Configuration Endpoints
app.get('/api/profit/config', async (req, res): Promise<void> => {
    try {
        const { ProfitConfigService } = await import('./services/profitConfigService');
        const service = new ProfitConfigService();
        const globalConfig = await service.getGlobalConfig();
        const productConfigs = await service.getProductConfigs();
        res.json({ globalConfig, productConfigs });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/profit/config/global', async (req, res): Promise<void> => {
    try {
        const { ProfitConfigService } = await import('./services/profitConfigService');
        const service = new ProfitConfigService();
        await service.updateGlobalConfig(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/profit/config/product', async (req, res): Promise<void> => {
    try {
        const { ProfitConfigService } = await import('./services/profitConfigService');
        const service = new ProfitConfigService();
        await service.updateProductConfig(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`=========================================`);
        console.log(`🚀 MASTER DATA HUB SERVER STARTED`);
        console.log(`📍 Port: ${port}`);
        console.log(`=========================================`);
        setupRankCheckerAutomation();
    });
    server.timeout = 600000; // 10 minutes
}
