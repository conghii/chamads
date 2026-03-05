import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { MasterKeywordRecord, RawFileType } from '../types';

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
];

const HEADERS = [
    'ID', 'Keyword', 'ASIN',
    'Match Type', 'Campaign Name',
    'Search Volume', 'Cerebro IQ Score', 'Competitor Rank (avg)', 'Ranking Competitors (count)',
    'Organic Rank', 'Sponsored Rank',
    'Ad Spend', 'Ad Sales', 'Impressions', 'Clicks', 'CTR', 'CVR',
    'Last Updated'
];

export class SheetsService {
    private doc: GoogleSpreadsheet;

    constructor(sheetId: string, clientEmail: string, privateKey: string) {
        // Sanitize key: remove quotes if accidentally included, trim, replace escaped newlines
        const cleanKey = privateKey.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');

        const jwt = new JWT({
            email: clientEmail,
            key: cleanKey,
            scopes: SCOPES,
        });
        this.doc = new GoogleSpreadsheet(sheetId, jwt);
    }

    public getDoc(): GoogleSpreadsheet {
        return this.doc;
    }

    async initialize() {
        try {
            await this.doc.loadInfo();
        } catch (error) {
            console.error('Error loading Doc Info (Check Auth/ID):', error);
            throw new Error('Failed to load Google Sheet. Check ID and Permissions.');
        }

        // Initialize Master Sheet
        await this.ensureSheet('Master Keyword List', HEADERS);
    }

    private async ensureSheet(title: string, headers: string[]) {
        let sheet = this.doc.sheetsByTitle[title];
        if (!sheet) {
            sheet = await this.doc.addSheet({ title, headerValues: headers });
        } else {
            await sheet.loadHeaderRow();
            // We don't overwrite headers here to avoid checking every time, 
            // but we ensure the sheet exists. 
            // If we are about to clear it in syncRawSheets, the headers will be re-set there.
        }
        return sheet;
    }

    async syncData(data: MasterKeywordRecord[], rawData: any[], fileType: RawFileType) {
        console.log(`[Sync] Starting sync: ${data.length} master records, ${rawData.length} raw rows`);

        // 1. Sync Raw Sheets (by file type)
        await this.syncRawSheets(rawData, fileType);

        /* MASTER SHEET SYNC DISABLED TO PREVENT GOOGLE API QUOTA ERRORS
         * 
         * Issue: Google Sheets API has a limit of 60 write requests per minute.
         * Adding rows individually to Master sheet exceeds this limit for large datasets.
         * 
         * Solution: Disable Master sheet sync until batch update API is implemented.
         * Raw data sync works perfectly and is the primary data source.
         * 
         * TODO: Implement batch update API or alternative aggregation strategy
         */

        console.log('[SyncMaster] Master sheet sync is currently disabled to prevent API quota errors.');
        console.log('[SyncMaster] Raw data has been synced successfully. Master aggregation will be added in future update.');

        /* ORIGINAL CODE - DISABLED
        // 2. Sync Master Record (Aggregation)
        const sheet = this.doc.sheetsByTitle['Master Keyword List'];
        if (!sheet) {
            console.error('[SyncMaster] Master Keyword List sheet not found!');
            return;
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        const existingMap = new Map<string, any>();
        rows.forEach(row => {
            const id = row.get('ID');
            if (id) existingMap.set(id, row);
        });

        const newRows: any[] = [];
        let updates: Promise<void>[] = []; // Changed from const to let to allow clearing

        for (const record of data) {
            if (!record.id) continue;

            if (existingMap.has(record.id)) {
                const row = existingMap.get(record.id);
                let updated = false;

                const updateField = (header: string, value: any) => {
                    if (value !== null && value !== undefined) {
                        if (row.get(header) != value) {
                            row.set(header, value);
                            updated = true;
                        }
                    }
                };

                if (fileType === 'AMAZON_BULK' || fileType === 'AMAZON_SEARCH_TERM') {
                    updateField('Ad Spend', record.adSpend);
                    updateField('Ad Sales', record.adSales);
                    updateField('Impressions', record.impressions);
                    updateField('Clicks', record.clicks);

                    if (record.matchType) updateField('Match Type', record.matchType);
                    if (record.campaignName) updateField('Campaign Name', record.campaignName);
                }
                if (fileType === 'AMAZON_SEARCH_TERM') {
                    updateField('CTR', record.ctr);
                    updateField('CVR', record.cvr);
                }
                if (fileType.includes('HELIUM10_CEREBRO')) {
                    updateField('Search Volume', record.searchVolume);
                    updateField('Organic Rank', record.organicRank);
                    updateField('Sponsored Rank', record.sponsoredRank);
                    updateField('Cerebro IQ Score', record.cerebroIQScore);
                    updateField('Competitor Rank (avg)', record.competitorRankAvg);
                    updateField('Ranking Competitors (count)', record.rankingCompetitorsCount);
                }

                if (updated) {
                    row.set('Last Updated', new Date().toISOString());
                    updates.push(row.save());
                }

            } else {
                newRows.push({
                    'ID': record.id,
                    'Keyword': record.keyword,
                    'ASIN': record.asin,
                    'Match Type': record.matchType || '',
                    'Campaign Name': record.campaignName || '',
                    'Search Volume': record.searchVolume || '',
                    'Cerebro IQ Score': record.cerebroIQScore || '',
                    'Competitor Rank (avg)': record.competitorRankAvg || '',
                    'Ranking Competitors (count)': record.rankingCompetitorsCount || '',
                    'Organic Rank': record.organicRank || '',
                    'Sponsored Rank': record.sponsoredRank || '',
                    'Ad Spend': record.adSpend || '',
                    'Ad Sales': record.adSales || '',
                    'Impressions': record.impressions || '',
                    'Clicks': record.clicks || '',
                    'CTR': record.ctr || '',
                    'CVR': record.cvr || '',
                    'Last Updated': new Date().toISOString(),
                });
            }
        }

        if (newRows.length > 0) {
            console.log(`[SyncMaster] Adding ${newRows.length} new records...`);
            // Chunk addRows too for Master
            for (let i = 0; i < newRows.length; i += 2000) {
                await sheet.addRows(newRows.slice(i, i + 2000));
            }
        }

        // TEMPORARY FIX: Clear updates array to prevent timeout with large datasets
        // TODO: Implement batch update API or use append-only strategy
        if (updates.length > 0) {
            console.log(`[SyncMaster] Skipping ${updates.length} existing record updates to prevent timeout.`);
            console.log(`[SyncMaster] Note: Master sheet is append-only for now. Duplicates may exist.`);
            updates = []; // Clear the array to prevent execution
        }

        /* DISABLED TO PREVENT TIMEOUT
        console.log(`[SyncMaster] Updating ${updates.length} existing records in batches...`);
        // Save all updates in batches to avoid overwhelming the API
        const UPDATE_BATCH_SIZE = 50; // Reduced from 100 to prevent timeout
        for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
            const batch = updates.slice(i, i + UPDATE_BATCH_SIZE);
            console.log(`[SyncMaster] Saving update batch ${Math.floor(i / UPDATE_BATCH_SIZE) + 1}/${Math.ceil(updates.length / UPDATE_BATCH_SIZE)} (${batch.length} rows)...`);
            await Promise.all(batch);
            
            // Add delay to respect rate limits, especially for large datasets
            if (updates.length > 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay for large datasets
            } else if (updates.length > 500) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        */
        // END OF DISABLED CODE
    }

    private async syncRawSheets(rawData: any[], fileType: RawFileType) {
        console.log(`[SyncRaw] Processing ${rawData.length} rows. Default Type: ${fileType}`);

        // Partition data by destination sheet
        const sheetsData: Record<string, any[]> = {};

        const addToSheet = (sheetName: string, row: any) => {
            if (!sheetsData[sheetName]) sheetsData[sheetName] = [];
            sheetsData[sheetName].push(row);
        };

        rawData.forEach((row, index) => {
            // IMPORTANT: Prioritize fileType (user selection) over __sheetType (auto-detection)
            const type: string = fileType || row['__sheetType'];

            // Debug: Log first 3 rows to see what type is being used
            if (index < 3) {
                console.log(`[SyncRaw DEBUG] Row ${index}: type="${type}", __sheetType="${row['__sheetType']}", fileType="${fileType}"`);
            }

            // Check specific types first, then fallback to generic patterns
            if (type === 'AMAZON_BULK' || type === 'AMAZON_PORTFOLIO') {
                addToSheet('Raw_Amazon_Bulk', row);
            } else if (type === 'AMAZON_SEARCH_TERM') {
                addToSheet('Raw_Search_Terms', row);
            } else if (type === 'HELIUM10_CEREBRO_MY_ASIN') {
                // IMPORTANT: Check MY_ASIN before generic HELIUM10 check
                addToSheet('Raw_My_ASIN_Ranking', row);
                if (index < 3) console.log(`[SyncRaw DEBUG] → Routing to Raw_My_ASIN_Ranking`);
            } else if (type === 'HELIUM10_CEREBRO_COMP') {
                addToSheet('Raw_Market_Intel', row);
                if (index < 3) console.log(`[SyncRaw DEBUG] → Routing to Raw_Market_Intel (COMP)`);
            } else if (type === 'AMAZON_BUSINESS_REPORT') {
                addToSheet('Raw_Business_Report', row);
                if (index < 3) console.log(`[SyncRaw DEBUG] → Routing to Raw_Business_Report`);
            } else if (type && type.includes('HELIUM10')) {
                // Fallback for other HELIUM10 types
                addToSheet('Raw_Market_Intel', row);
                if (index < 3) console.log(`[SyncRaw DEBUG] → Routing to Raw_Market_Intel (fallback)`);
            } else {
                addToSheet('Raw_Unknown', row);
            }
        });

        // Write to each sheet
        for (const [sheetName, rows] of Object.entries(sheetsData)) {
            console.log(`[SyncRaw] Sheet '${sheetName}': ${rows.length} rows to sync.`);
            if (rows.length === 0) continue;

            try {
                // Determine headers dynamically from the first valid row that has content
                const sampleRow = rows.find(r => Object.keys(r).some(k => !k.startsWith('__') && r[k] !== null && r[k] !== '')) || rows[0];
                let headers = Object.keys(sampleRow).filter(k => k && !k.startsWith('__') && k !== '');

                // --- COLUMN FILTERING: Keep most columns, filter only truly unnecessary ones ---
                const essentialColumns = [
                    // Core identifiers
                    'Entity', 'Record Type', 'Campaign', 'Campaign Name', 'Campaign ID', 'Campaign Status',
                    'Ad Group', 'Ad Group Name', 'Ad Group ID', 'Portfolio', 'Portfolio ID', 'Portfolio Name',

                    // Keywords & Targets
                    'Keyword', 'Keyword Text', 'Keyword or Product Targeting', 'Target', 'Target ID',
                    'Match Type', 'Targeting Expression', 'Product Targeting Expression', 'Keyword Bid',

                    // Search Term specific
                    'Customer Search Term', 'Search Term', 'Search Term Impression Rank',
                    'Search Term Impression Share', 'Query',

                    // Helium 10 Cerebro - ALL important fields
                    'Keyword Phrase', 'Cerebro IQ Score', 'Search Volume', 'Search Volume Trend',
                    'Competing Products', 'CPR', 'Title Density', 'Organic Rank', 'Sponsored Rank',
                    'Amazon Recommended Rank', 'Relative Rank', 'Giveaways', 'Word Count',
                    'Sponsored ASINs', 'Ranking Competitors', 'Competitor Rank', 'Competitor Performance Score',
                    'H10 PPC Sugg. Bid', 'H10 PPC Sugg. Min Bid', 'H10 PPC Sugg. Max Bid',
                    'ABA Total Click Share', 'ABA Total Conv. Share', 'Keyword Sales',
                    'Amazon Recommended', 'Amazon Choice', 'Highly Rated', 'Top Rated From Our Brand',
                    'Trending Now', 'Sponsored Brand Header', 'Sponsored Brand Video', 'Position',

                    // Performance metrics
                    'Status', 'State', 'Bid', 'Impressions', 'Clicks', 'Spend', 'Sales', 'Orders',
                    '7 Day Total Orders (#)', '7 Day Total Sales', '7 Day Total Units (#)',
                    'CTR', 'CPC', 'ACOS', 'ROAS', 'Conversion Rate', 'CPA',

                    // Business Report metrics
                    'Date', '(Parent) ASIN', '(Child) ASIN', 'Title', 'Sessions', 'Page Views',
                    'Buy Box Percentage', 'Units Ordered', 'Ordered Product Sales', 'Ordered Product Sales (B2B)',
                    'Unit Session Percentage', 'Total Order Items',

                    // Campaign & Budget info
                    'Bidding strategy', 'Daily Budget',

                    // Guidance (Bid suggestions)
                    'Suggested bid', 'Bid range minimum', 'Bid range maximum',

                    // Placements
                    'Placement Type', 'Bidding Adjustment Percentage',

                    // Product info
                    'ASIN', 'Advertised ASIN', 'SKU', 'Product Name',

                    // Dates & Metadata
                    'Start Date', 'End Date', 'Last Updated',
                    '__sheetName', '__sheetType'
                ];

                // More lenient filtering - include if matches any essential column (partial match OK)
                const originalHeaderCount = headers.length;
                headers = headers.filter(h => {
                    const lowerH = h.toLowerCase();

                    // Keep competitor ASIN columns (B0XXXXXXXX format from Helium 10)
                    const isCompetitorASIN = /^B0[A-Z0-9]{8}$/i.test(h);

                    // Include if matches any essential column (exact or partial) OR is a competitor ASIN
                    const matchesEssential = essentialColumns.some(ec =>
                        ec.toLowerCase() === lowerH ||
                        lowerH.includes(ec.toLowerCase()) ||
                        ec.toLowerCase().includes(lowerH)
                    );

                    return matchesEssential || isCompetitorASIN;
                });

                console.log(`[SyncRaw] Filtered headers from ${originalHeaderCount} to ${headers.length} essential columns`);
                // --------------------------------------------------

                console.log(`[SyncRaw] Detected ${headers.length} headers for '${sheetName}':`, headers.slice(0, 5));

                if (headers.length === 0) {
                    console.warn(`[SyncRaw] Skipping sheet '${sheetName}' - No valid headers detected.`);
                    continue;
                }

                // --- NEW APPROACH: Delete and recreate sheet to avoid header row issues ---
                const existingSheet = this.doc.sheetsByTitle[sheetName];
                if (existingSheet) {
                    console.log(`[SyncRaw] Deleting existing sheet '${sheetName}'...`);
                    await existingSheet.delete();
                }

                console.log(`[SyncRaw] Creating fresh sheet '${sheetName}' with ${headers.length} headers...`);

                // CRITICAL FIX: Create sheet with correct column count from the start
                const sheet = await this.doc.addSheet({
                    title: sheetName,
                    gridProperties: {
                        rowCount: 1000,
                        columnCount: Math.max(headers.length, 60) // Ensure enough columns from creation
                    }
                });

                // Now set the header row
                console.log(`[SyncRaw] Setting ${headers.length} header values...`);
                await sheet.setHeaderRow(headers);
                // -----------------------------------------------------------------------

                const cleanRows = rows.map(r => {
                    const clean: any = {};
                    headers.forEach(h => clean[h] = r[h]);
                    return clean;
                });

                // --- PRE-VALIDATION: Ensure sheet can fit all data ---
                const currentColumnCount = sheet.columnCount;
                const requiredColumnCount = headers.length;

                if (requiredColumnCount > currentColumnCount) {
                    console.log(`[SyncRaw] Sheet has ${currentColumnCount} columns but needs ${requiredColumnCount}. Auto-resizing...`);
                    await sheet.resize({
                        columnCount: Math.max(requiredColumnCount, 60), // At least 60 columns for future growth
                        rowCount: Math.max(cleanRows.length + 100, 1000)
                    });
                }
                // -----------------------------------------------------

                // Chunking to avoid timeout/payload limits with large datasets (18k+ rows)
                const CHUNK_SIZE = 2000;
                for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
                    const chunk = cleanRows.slice(i, i + CHUNK_SIZE);
                    console.log(`[SyncRaw] Sheet '${sheetName}': adding rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, cleanRows.length)}...`);

                    try {
                        await sheet.addRows(chunk);
                    } catch (error) {
                        // Graceful error handling: If still fails due to column limit, retry with resize
                        if (error instanceof Error && error.message.includes('not large enough')) {
                            console.warn(`[SyncRaw] Column limit error detected. Attempting emergency resize...`);
                            await sheet.resize({ columnCount: requiredColumnCount + 10, rowCount: sheet.rowCount + chunk.length });
                            await sheet.addRows(chunk); // Retry
                        } else {
                            throw error; // Re-throw other errors
                        }
                    }
                }

                console.log(`[SyncRaw] Sheet '${sheetName}': Successfully created with ${rows.length} rows.`);

            } catch (error) {
                console.error(`[SyncRaw] Error syncing sheet '${sheetName}':`, error);
                const msg = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Sheet '${sheetName}' sync failed: ${msg}`);
            }
        }
    }

    async getTrackedKeywords(sheetName: string): Promise<string[]> {
        const sheet = this.doc.sheetsByTitle[sheetName];
        if (!sheet) return [];

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        const keywords: string[] = [];
        rows.forEach(row => {
            const kw = (row.get('Keyword') || '').trim().toLowerCase();
            if (kw) keywords.push(kw);
        });

        return keywords;
    }

    async addKeywordToTracking(sheetName: string, data: { asin: string, keyword: string, searchVolume?: number, ads?: number | null }): Promise<{ added: boolean; message: string }> {
        const sheet = this.doc.sheetsByTitle[sheetName] || await this.doc.addSheet({ title: sheetName, headerValues: ['ASIN', 'Keyword'] });

        if (!sheet.headerValues || sheet.headerValues.length === 0) {
            await sheet.setHeaderRow(['ASIN', 'Keyword']);
        }

        // Find column letters for ASIN and Keyword
        const headers = sheet.headerValues;
        const asinColIdx = headers.indexOf('ASIN');
        const kwColIdx = headers.indexOf('Keyword');

        const svColIdx = headers.findIndex(h => h.toLowerCase().includes('search vol'));
        const adsColIdx = headers.indexOf('Ads');

        if (asinColIdx === -1 || kwColIdx === -1) {
            throw new Error(`Sheet "${sheetName}" missing ASIN or Keyword column`);
        }
        const colLetter = (idx: number) => String.fromCharCode(65 + idx);
        const asinCol = colLetter(asinColIdx);
        const kwCol = colLetter(kwColIdx);
        const svCol = svColIdx !== -1 ? colLetter(svColIdx) : null;
        const adsCol = adsColIdx !== -1 ? colLetter(adsColIdx) : null;

        const rows = await sheet.getRows();

        // Check for duplicate keyword
        const exists = rows.some(row =>
            (row.get('Keyword') || '').trim().toLowerCase() === data.keyword.trim().toLowerCase()
        );
        if (exists) {
            return { added: false, message: `Keyword "${data.keyword}" already tracked` };
        }

        // Scan rows to find ASIN groups and locate target ASIN's last row
        let currentAsin = '';
        let lastRowOfTargetGroup = -1; // 1-based sheet row number

        for (let i = 0; i < rows.length; i++) {
            const rowAsin = (rows[i].get('ASIN') || '').trim();
            const rowKw = (rows[i].get('Keyword') || '').trim();

            if (!rowAsin && !rowKw) { currentAsin = ''; continue; }
            if (rowAsin) { currentAsin = rowAsin; }

            if (currentAsin.toLowerCase() === data.asin.trim().toLowerCase()) {
                lastRowOfTargetGroup = rows[i].rowNumber;
            }
        }

        if (lastRowOfTargetGroup > 0) {
            // ASIN EXISTS → insert row right after last keyword of this group
            const newRowNum = lastRowOfTargetGroup + 1;

            await sheet.insertDimension('ROWS', {
                startIndex: newRowNum - 1,
                endIndex: newRowNum,
            }, false);

            // Ensure we load cells for SV and Ads as well
            const rangeStart = Math.min(...[kwColIdx, svColIdx, adsColIdx].filter(i => i !== -1));
            const rangeEnd = Math.max(...[kwColIdx, svColIdx, adsColIdx].filter(i => i !== -1));
            await sheet.loadCells(`${colLetter(rangeStart)}${newRowNum}:${colLetter(rangeEnd)}${newRowNum}`);

            const cellKw = sheet.getCellByA1(`${kwCol}${newRowNum}`);
            cellKw.value = data.keyword;

            if (svCol && data.searchVolume !== undefined) {
                sheet.getCellByA1(`${svCol}${newRowNum}`).value = data.searchVolume;
            }
            if (adsCol && data.ads !== undefined && data.ads !== null) {
                sheet.getCellByA1(`${adsCol}${newRowNum}`).value = data.ads;
            }

            await sheet.saveUpdatedCells();

            console.log(`[SheetsService] Inserted "${data.keyword}" at row ${newRowNum} into group "${data.asin}"`);
        } else {
            // NEW ASIN → append at end with blank separator
            let lastDataRowNum = 1;
            for (const row of rows) {
                const a = (row.get('ASIN') || '').trim();
                const k = (row.get('Keyword') || '').trim();
                if (a || k) lastDataRowNum = row.rowNumber;
            }

            const targetRow = rows.length > 0 ? lastDataRowNum + 2 : 2;

            if (targetRow > sheet.rowCount) {
                await sheet.resize({ rowCount: targetRow + 10, columnCount: sheet.columnCount });
            }

            const rangeStart = Math.min(...[asinColIdx, kwColIdx, svColIdx, adsColIdx].filter(i => i !== -1));
            const rangeEnd = Math.max(...[asinColIdx, kwColIdx, svColIdx, adsColIdx].filter(i => i !== -1));

            await sheet.loadCells(`${colLetter(rangeStart)}${targetRow}:${colLetter(rangeEnd)}${targetRow}`);

            sheet.getCellByA1(`${asinCol}${targetRow}`).value = data.asin;
            sheet.getCellByA1(`${kwCol}${targetRow}`).value = data.keyword;

            if (svCol && data.searchVolume !== undefined) {
                sheet.getCellByA1(`${svCol}${targetRow}`).value = data.searchVolume;
            }
            if (adsCol && data.ads !== undefined && data.ads !== null) {
                sheet.getCellByA1(`${adsCol}${targetRow}`).value = data.ads;
            }

            await sheet.saveUpdatedCells();

            console.log(`[SheetsService] New group "${data.asin}" at row ${targetRow} with "${data.keyword}"`);
        }

        return { added: true, message: `Added "${data.keyword}" to tracking` };
    }
}
