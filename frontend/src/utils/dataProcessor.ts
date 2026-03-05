import type { MasterKeywordRecord, RawFileType, RawFileRow, BulkFileRow, SearchTermRow, CerebroRow, DatasetStats } from '../types';

export const processData = (fileType: RawFileType, rawData: RawFileRow[]): MasterKeywordRecord[] => {
    switch (fileType) {
        case 'AMAZON_BULK':
            return processBulkFile(rawData as BulkFileRow[]);
        case 'AMAZON_SEARCH_TERM':
            return processSearchTermReport(rawData as SearchTermRow[]);
        case 'HELIUM10_CEREBRO_COMP':
        case 'HELIUM10_CEREBRO_MY_ASIN':
            return processCerebroFile(rawData as CerebroRow[]);
        case 'AMAZON_PORTFOLIO':
        case 'AMAZON_BUSINESS_REPORT':
            return []; // No keywords to process, but raw data should still sync
        case 'MULTI_SHEET':
            return processMixedData(rawData);
        default:
            return [];
    }
};

const normalizeCurrency = (value: string | number | undefined): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    // Remove currency symbols ($, £, etc.) and commas
    const cleaned = value.replace(/[^0-9.-]+/g, '');
    return parseFloat(cleaned) || 0;
};

const normalizeNumber = (value: string | number | undefined): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const cleaned = value.replace(/,/g, ''); // Remove commas
    return parseFloat(cleaned) || 0;
};

const normalizePercentage = (value: string | number | undefined): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const cleaned = value.replace(/%/g, '');
    return parseFloat(cleaned) || 0;
};


const createRecordId = (asin: string, keyword: string): string => {
    return `${asin}_${keyword}`.toLowerCase();
};

const processBulkFile = (data: BulkFileRow[]): MasterKeywordRecord[] => {
    // Aggregation needed. Map<Keyword, Record>
    const map = new Map<string, MasterKeywordRecord>();

    data.forEach((row, idx) => {
        const anyRow = row as any;

        // --- CRITICAL FIX: Filter by Entity Type FIRST ---
        const entityType = (anyRow['Entity'] || anyRow['Record Type'] || '').toString().trim().toLowerCase();
        const isKeywordRow = entityType === 'keyword' || entityType.includes('keyword');

        if (!isKeywordRow) {
            if (idx < 10) console.log(`[Bulk] Row ${idx} | Skipping non-keyword entity: "${entityType}"`);
            return; // Skip Bidding Adjustment, Product Ad, Campaign, Ad Group, Portfolio
        }
        // -----------------------------------------------

        // Handle modern Bulk V3 (Keyword Text) and legacy/variations
        const rawKeyword = anyRow['Keyword Text'] || anyRow['Keyword'] || anyRow['Keyword or Product Targeting'] || anyRow['Product Targeting Expression'];

        if (idx < 10) console.log(`[Bulk] Row ${idx} | Keyword Found: "${rawKeyword}" | Entity: "${entityType}"`);

        if (!rawKeyword) return; // Skip if no keyword (e.g. Campaign/AdGroup rows)

        const keyword = rawKeyword.toString().trim().toLowerCase();
        const asin = anyRow.ASIN || anyRow['Advertised ASIN'] || 'UNKNOWN';
        const id = createRecordId(asin, keyword);

        const spend = normalizeCurrency(anyRow.Spend);
        const sales = normalizeCurrency(anyRow.Sales);
        const impressions = normalizeNumber(anyRow.Impressions);
        const clicks = normalizeNumber(anyRow.Clicks);

        const campaign = anyRow['Campaign Name'] || anyRow['Campaign'] || anyRow['Campaign Name (Informational only)'] || null;
        const matchType = anyRow['Match Type'] || null;

        if (map.has(keyword)) {
            const existing = map.get(keyword)!;
            existing.adSpend = (existing.adSpend || 0) + spend;
            existing.adSales = (existing.adSales || 0) + sales;
            existing.impressions = (existing.impressions || 0) + impressions;
            existing.clicks = (existing.clicks || 0) + clicks;
        } else {
            map.set(keyword, {
                id,
                keyword,
                asin,
                matchType,
                campaignName: campaign,
                searchVolume: null,
                wordCount: null,
                cerebroIQScore: null,
                competitorRankAvg: null,
                rankingCompetitorsCount: null,
                organicRank: null,
                sponsoredRank: null,
                adSpend: spend,
                adSales: sales,
                impressions: impressions,
                clicks: clicks,
                ctr: null, // metrics calculated later or ignored for aggregation
                cvr: null,
                lastUpdated: new Date().toISOString(),
            });
        }
    });

    return Array.from(map.values());
};

const processSearchTermReport = (data: SearchTermRow[]): MasterKeywordRecord[] => {
    return data.map(row => {
        const keyword = row['Customer Search Term'];
        if (!keyword) return null;

        const asin = (row['ASIN'] as string) || 'UNKNOWN';

        return {
            id: createRecordId(asin, keyword),
            keyword: keyword,
            asin: asin,
            matchType: row['Match Type'] || null,
            campaignName: row['Campaign Name'] || null,
            searchVolume: null,
            cerebroIQScore: null,
            competitorRankAvg: null,
            rankingCompetitorsCount: null,
            organicRank: null,
            sponsoredRank: null,
            adSpend: normalizeCurrency(row['Spend']),
            adSales: normalizeCurrency(row['7 Day Total Sales'] || row['7 Day Total Sales ']),
            impressions: normalizeNumber(row['Impressions']),
            clicks: normalizeNumber(row['Clicks']),
            ctr: normalizePercentage(row['CTR'] || row['Click-Thru Rate (CTR)']),
            cvr: normalizePercentage(row['Conversion Rate'] || row['7 Day Conversion Rate']),
            lastUpdated: new Date().toISOString(),
        };
    }).filter(r => r !== null) as MasterKeywordRecord[];
};

const processCerebroFile = (data: CerebroRow[]): MasterKeywordRecord[] => {
    return data.map(row => {
        const keyword = row['Keyword Phrase'];
        if (!keyword) return null;

        const asin = (row['ASIN'] as string) || 'UNKNOWN';

        return {
            id: createRecordId(asin, keyword),
            keyword: keyword,
            asin: asin,
            matchType: null,
            campaignName: null,
            searchVolume: normalizeNumber(row['Search Volume']),
            cerebroIQScore: normalizeNumber(row['Cerebro IQ Score']),
            competitorRankAvg: normalizeNumber(row['Competitor Rank (avg)']),
            rankingCompetitorsCount: normalizeNumber(row['Ranking Competitors (count)']),
            organicRank: normalizeNumber(row['Organic Rank'] || row['Organic']),
            sponsoredRank: normalizeNumber(row['Sponsored Rank'] || row['Sponsored Product']),
            adSpend: null,
            adSales: null,
            impressions: null,
            clicks: null,
            ctr: null,
            cvr: null,
            lastUpdated: new Date().toISOString(),
        };
    }).filter(r => r !== null) as MasterKeywordRecord[];
}

const processMixedData = (data: RawFileRow[]): MasterKeywordRecord[] => {
    // Separate by type and process
    const bulkRows: BulkFileRow[] = [];
    const searchTermRows: SearchTermRow[] = [];
    const cerebroRows: CerebroRow[] = [];

    data.forEach(row => {
        const type = (row as any)['__sheetType'];
        if (type === 'AMAZON_BULK') bulkRows.push(row as BulkFileRow);
        else if (type === 'AMAZON_SEARCH_TERM') searchTermRows.push(row as SearchTermRow);
        else if (type && type.includes('HELIUM10')) cerebroRows.push(row as CerebroRow);
        else if (type === 'AMAZON_PORTFOLIO' || type === 'AMAZON_BUSINESS_REPORT') { /* Skip processing as keywords, but kept in rawData */ }
    });

    console.log(`[Mixed] Dispatching: ${bulkRows.length} Bulk, ${searchTermRows.length} STR, ${cerebroRows.length} Cerebro.`);

    // Process each chunk
    const bulkRecords = processBulkFile(bulkRows);
    const strRecords = processSearchTermReport(searchTermRows);
    const cerebroRecords = processCerebroFile(cerebroRows);

    console.log(`[Mixed] Results: ${bulkRecords.length} Bulk Recs, ${strRecords.length} STR Recs, ${cerebroRecords.length} Cerebro Recs.`);

    // Merge Results
    const mergedMap = new Map<string, MasterKeywordRecord>();

    const merge = (records: MasterKeywordRecord[]) => {
        records.forEach(r => {
            if (mergedMap.has(r.id)) {
                const existing = mergedMap.get(r.id)!;

                existing.adSpend = r.adSpend ?? existing.adSpend;
                existing.adSales = r.adSales ?? existing.adSales;
                existing.impressions = r.impressions ?? existing.impressions;
                existing.clicks = r.clicks ?? existing.clicks;
                existing.ctr = r.ctr ?? existing.ctr;
                existing.cvr = r.cvr ?? existing.cvr;
                existing.searchVolume = r.searchVolume ?? existing.searchVolume;
                existing.matchType = r.matchType || existing.matchType;
                existing.campaignName = r.campaignName || existing.campaignName;

                // Cerebro specific
                existing.cerebroIQScore = r.cerebroIQScore ?? existing.cerebroIQScore;
                existing.competitorRankAvg = r.competitorRankAvg ?? existing.competitorRankAvg;
                existing.rankingCompetitorsCount = r.rankingCompetitorsCount ?? existing.rankingCompetitorsCount;
                existing.organicRank = r.organicRank ?? existing.organicRank;
                existing.sponsoredRank = r.sponsoredRank ?? existing.sponsoredRank;

            } else {
                mergedMap.set(r.id, r);
            }
        });
    };

    merge(bulkRecords);
    merge(strRecords);
    merge(cerebroRecords);

    return Array.from(mergedMap.values());
};

export const getDatasetStats = (records: MasterKeywordRecord[]): DatasetStats => {
    const campaigns = new Set<string>();
    // AdGroups not strictly tracked in MasterRecord yet, but we have Campaign.

    let totalAdSpend = 0;
    let totalAdSales = 0;

    records.forEach(r => {
        if (r.campaignName) campaigns.add(r.campaignName);
        totalAdSpend += r.adSpend || 0;
        totalAdSales += r.adSales || 0;
    });

    return {
        totalRecords: records.length,
        totalCampaigns: campaigns.size,
        totalAdGroups: 0, // Placeholder as we don't store AdGroup in MasterRecord yet
        totalKeywords: records.length,
        totalSearchTerms: records.length, // Effectively same as total records in this schema
        totalAdSpend,
        totalAdSales
    };
};

export const enrichRawData = (rawData: RawFileRow[]): RawFileRow[] => {
    // 1. Build Lookup Maps
    const portfolioMap = new Map<string, string>(); // ID -> Name
    const campaignPortfolioMap = new Map<string, string>(); // CampaignID -> PortfolioID
    const campaignNameMap = new Map<string, string>(); // CampaignID -> Name
    const adGroupNameMap = new Map<string, string>(); // AdGroupID -> Name
    const adGroupCampaignMap = new Map<string, string>(); // AdGroupID -> CampaignID
    const adGroupAsinMap = new Map<string, string>(); // AdGroupID -> ASIN

    // Pass 1: Build Hierarchy from Definition Rows
    rawData.forEach((row, idx) => {
        const anyRow = row as any;
        const sheetType = anyRow['__sheetType'];

        // --- Standardize Record Type for mapping ---
        const recordType = (anyRow['Record Type'] || '').toString().trim().toLowerCase();
        const entity = (anyRow['Entity'] || '').toString().trim().toLowerCase();
        const effectiveType = recordType || entity;

        // --- ASIN Detection (from Ads) ---
        const isAd = effectiveType === 'ad' || effectiveType.includes('product ad');
        if (isAd) {
            // Bulk V3 uses 'ASIN (Informational only)', old bulk used 'ASIN' or 'Advertised ASIN'
            const asin = anyRow['ASIN'] || anyRow['Advertised ASIN'] || anyRow['ASIN (Informational only)'];
            const aId = anyRow['Ad Group ID'];

            if (asin && aId) {
                adGroupAsinMap.set(aId.toString(), asin.toString());
            } else if (idx < 20 && isAd) {
                console.log(`[Enrichment] Row ${idx} | Ad found but NO ASIN or AdGroupId. Headers present: ${Object.keys(anyRow).filter(k => k.toLowerCase().includes('asin'))}`);
            }
        }

        // --- Portfolio Definition ---
        if (
            effectiveType === 'portfolio' ||
            sheetType === 'AMAZON_PORTFOLIO' ||
            (anyRow['Portfolio ID'] && anyRow['Portfolio Name'] && !anyRow['Campaign ID'])
        ) {
            const pId = anyRow['Portfolio ID'];
            const pName = anyRow['Portfolio Name'];
            if (pId && pName) portfolioMap.set(pId.toString(), pName.toString());
        }

        // --- Campaign Definition ---
        if (
            effectiveType === 'campaign' ||
            (anyRow['Campaign ID'] && anyRow['Portfolio ID'] && !anyRow['Keyword Text'] && !anyRow['Keyword'])
        ) {
            const cId = anyRow['Campaign ID'];
            const cName = anyRow['Campaign Name'] || anyRow['Campaign'];
            const pId = anyRow['Portfolio ID'];

            if (cId) {
                // Capture Name
                if (cName) campaignNameMap.set(cId.toString(), cName.toString());
                // Capture Portfolio Link
                if (pId) campaignPortfolioMap.set(cId.toString(), pId.toString());
            }
        }

        // --- Ad Group Definition ---
        if (
            effectiveType === 'ad group'
        ) {
            const aId = anyRow['Ad Group ID'];
            const aName = anyRow['Ad Group Name'] || anyRow['Ad Group'];
            const cId = anyRow['Campaign ID'];

            if (aId) {
                if (aName) adGroupNameMap.set(aId.toString(), aName.toString());
                if (cId) adGroupCampaignMap.set(aId.toString(), cId.toString());
            }
        }
    });

    console.log(`[Enrichment] Mapped: ${portfolioMap.size} Portfolios, ${campaignNameMap.size} Campaigns, ${adGroupNameMap.size} AdGroups, ${adGroupAsinMap.size} ASINs.`);

    // Pass 2: Enrichment & Filtering (Conciseness)
    const dataRows = rawData.filter((row, idx) => {
        const anyRow = row as any;
        const recordType = (anyRow['Record Type'] || '').toString().trim().toLowerCase();
        const entity = (anyRow['Entity'] || '').toString().trim().toLowerCase();

        const effectiveType = recordType || entity;

        // Skip metadata/container rows
        const toSkip = ['portfolio', 'campaign', 'ad group'].includes(effectiveType);

        if (idx < 5) {
            console.log(`[Enrichment] Row ${idx} | Entity: "${effectiveType}" | Skip: ${toSkip}`);
        }

        if (toSkip) return false;

        // Keep meaningful data rows OR fallback to keeping everything else 
        // to avoid "empty sheet" disaster.
        return true;
    });

    console.log(`[Enrichment] dataRows count after filter: ${dataRows.length} (from ${rawData.length})`);

    return dataRows.map(row => {
        const anyRow = row as any;
        const newRow = { ...anyRow };

        const cId = anyRow['Campaign ID'] ? anyRow['Campaign ID'].toString() : null;
        const aId = anyRow['Ad Group ID'] ? anyRow['Ad Group ID'].toString() : null;

        // 0. Enrich ASIN
        if (!newRow['ASIN'] && aId) {
            const mappedAsin = adGroupAsinMap.get(aId);
            if (mappedAsin) newRow['ASIN'] = mappedAsin;
        }

        // 1. Enrich Campaign Name
        if (!newRow['Campaign Name (Informational only)'] && !newRow['Campaign'] && cId) {
            const mappedName = campaignNameMap.get(cId);
            if (mappedName) newRow['Campaign Name'] = mappedName;
        }
        if (!newRow['Campaign'] && newRow['Campaign Name']) newRow['Campaign'] = newRow['Campaign Name'];

        // 2. Enrich Ad Group Name
        if (!newRow['Ad Group Name'] && !newRow['Ad Group'] && aId) {
            const mappedName = adGroupNameMap.get(aId);
            if (mappedName) newRow['Ad Group Name'] = mappedName;
        }
        if (!newRow['Ad Group'] && newRow['Ad Group Name']) newRow['Ad Group'] = newRow['Ad Group Name'];

        // 3. Enrich Portfolio (Flattening)
        let pName = anyRow['Portfolio Name'];
        if (!pName) {
            let effectiveCId = cId;
            if (!effectiveCId && aId) effectiveCId = adGroupCampaignMap.get(aId);
            if (effectiveCId) {
                const pId = campaignPortfolioMap.get(effectiveCId);
                if (pId) pName = portfolioMap.get(pId);
            }
        }

        if (pName) {
            // Fill the standard column instead of creating a new "Derived" one for conciseness
            newRow['Portfolio Name'] = pName;
            // Remove the cluttered technical column if it exists from previous logic
            delete newRow['Portfolio Name (Derived)'];
        }

        return newRow;
    });
};
