import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { RawFileType, RawFileRow } from '../types';

export const parseFile = (file: File): Promise<{ data: RawFileRow[]; meta: Papa.ParseMeta; fileType: RawFileType }> => {
    return new Promise((resolve, reject) => {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error('Failed to read file'));
                    return;
                }

                try {
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const allData: RawFileRow[] = [];
                    const foundTypes = new Set<RawFileType>();
                    let primaryHeaders: string[] = [];

                    // Iterate ALL Sheets
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

                        // Header logic
                        let headerRowIndex = 0;
                        for (let i = 0; i < Math.min(allRows.length, 100); i++) {
                            const row = allRows[i];
                            if (!row || row.length === 0) continue;

                            // Check signatures
                            if ((row.includes('Record Type') || row.includes('Entity')) && (row.includes('Campaign') || row.includes('Campaign Name'))) {
                                headerRowIndex = i; break;
                            }
                            if (row.includes('Customer Search Term') && row.includes('Impressions')) {
                                headerRowIndex = i; break;
                            }
                            if (row.includes('Cerebro IQ Score')) {
                                headerRowIndex = i; break;
                            }
                            if (row.includes('Organic Rank') && row.includes('Sponsored Rank')) {
                                headerRowIndex = i; break;
                            }
                            // Portfolio Sheet Check
                            if (row.includes('portfolio id') || row.includes('Portfolio ID')) {
                                headerRowIndex = i; break;
                            }
                        }

                        if (!allRows[headerRowIndex]) {
                            console.log(`[Parser] Sheet '${sheetName}': No valid header row found.`);
                            return;
                        }

                        const headers = allRows[headerRowIndex].map(h => h ? String(h).trim() : '');
                        const sheetType = identifyFileType(headers);

                        console.log(`[Parser] Sheet '${sheetName}': Identified as '${sheetType}' using headers:`, headers);

                        if (sheetType !== 'UNKNOWN') {
                            foundTypes.add(sheetType);
                            if (primaryHeaders.length === 0) primaryHeaders = headers; // Store first valid header as meta default

                            const dataRows = allRows.slice(headerRowIndex + 1);
                            const mappedData = dataRows.map(row => {
                                const obj: any = {};
                                headers.forEach((header, index) => {
                                    if (header && row[index] !== undefined) {
                                        obj[header] = row[index];
                                    }
                                });
                                // Attach Meta
                                obj['__sheetName'] = sheetName;
                                obj['__sheetType'] = sheetType;
                                return obj;
                            });
                            allData.push(...mappedData);
                        }
                    });

                    if (allData.length === 0) {
                        reject(new Error('No valid Amazon/Helium10 data found in any sheet.'));
                        return;
                    }

                    // Determine single vs multi type
                    const finalType = foundTypes.size > 1 ? 'MULTI_SHEET' : Array.from(foundTypes)[0];

                    resolve({
                        data: allData as RawFileRow[],
                        meta: {
                            delimiter: '',
                            linebreak: '',
                            aborted: false,
                            truncated: false,
                            cursor: 0,
                            fields: primaryHeaders
                        },
                        fileType: finalType
                    });

                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        } else {
            // Default to CSV behavior
            parseCSV(file).then(({ data, meta }) => {
                const fileType = identifyFileType(meta.fields || []);
                resolve({ data, meta, fileType });
            }).catch(reject);
        }
    });
};

// Internal CSV parser - Keeping strict for single file
const parseCSV = (file: File): Promise<{ data: RawFileRow[]; meta: Papa.ParseMeta }> => {
    return new Promise((resolve, reject) => {
        // First pass: Parse with header: false to find the real header row
        Papa.parse(file, {
            header: false,
            preview: 100, // Check first 100 lines for a header signature
            skipEmptyLines: true,
            complete: (preResults) => {
                const rows = preResults.data as string[][];
                let headerRowIndex = 0;

                // Heuristic to find the header row
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    // Check for signature columns
                    if ((row.includes('Record Type') || row.includes('Entity')) && (row.includes('Campaign') || row.includes('Campaign Name'))) {
                        headerRowIndex = i;
                        break;
                    }
                    if (row.includes('Customer Search Term') && row.includes('Impressions')) {
                        headerRowIndex = i;
                        break;
                    }
                    if (row.includes('Cerebro IQ Score')) {
                        headerRowIndex = i;
                        break;
                    }
                    if (row.includes('Organic Rank') && row.includes('Sponsored Rank')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                // Second pass
                Papa.parse(file, {
                    header: false, // We'll map manually
                    skipEmptyLines: true,
                    complete: (fullResults) => {
                        const allRows = fullResults.data as string[][];

                        if (headerRowIndex >= allRows.length) {
                            headerRowIndex = 0;
                        }

                        const headers = allRows[headerRowIndex].map(h => h ? h.trim() : '');
                        const dataRows = allRows.slice(headerRowIndex + 1);

                        // Map to objects
                        const mappedData = dataRows.map(row => {
                            const obj: any = {};
                            headers.forEach((header, index) => {
                                if (header && row[index] !== undefined) {
                                    obj[header.trim()] = row[index];
                                }
                            });
                            // Attach Meta (Default CSV assume single type)
                            const type = identifyFileType(headers);
                            obj['__sheetType'] = type;
                            return obj;
                        });

                        resolve({
                            data: mappedData as RawFileRow[],
                            meta: { ...fullResults.meta, fields: headers },
                        });
                    },
                    error: (error) => reject(error),
                });
            },
            error: (error) => reject(error),
        });
    });
};

export const identifyFileType = (headers: string[]): RawFileType => {
    const headerSet = new Set(headers.map(h => h ? h.trim() : ''));
    const lowerHeaders = headers.map(h => h ? h.toLowerCase().trim() : '');
    const lowerHeaderStr = lowerHeaders.join(' ');

    // Amazon Bulk - Relaxed Check
    if (headerSet.has('Record Type') || headerSet.has('Entity')) {
        return 'AMAZON_BULK';
    }

    // Amazon Search Term Report - Handle variations
    // 'Customer Search Term' is standard. 'Search Term' is possible.
    if ((headerSet.has('Customer Search Term') || headerSet.has('Search Term')) && (headerSet.has('Impressions') || headerSet.has('Impressions'))) {
        return 'AMAZON_SEARCH_TERM';
    }

    // Helium 10 Cerebro - More specific detection
    // MY_ASIN files typically have: Organic Rank, Sponsored Rank, but NOT Cerebro IQ Score
    // COMP files have: Search Volume, Competing Products (Cerebro IQ is optional/deprecated in some views)

    const hasOrganicRank = headerSet.has('Organic Rank');
    const hasSponsoredRank = headerSet.has('Sponsored Rank');
    const hasCerebroIQ = headerSet.has('Cerebro IQ Score');
    const hasSearchVolume = headerSet.has('Search Volume');
    const hasCompetingProducts = headerSet.has('Competing Products');

    // If has Search Volume + Competing Products = Competitor Analysis (Relaxed)
    // We prioritize this over MY_ASIN if both exist, but usually MY_ASIN doesn't have Competing Products
    if (hasSearchVolume && hasCompetingProducts) {
        return 'HELIUM10_CEREBRO_COMP';
    }

    // If has Organic Rank + Sponsored Rank but NOT the competitor-specific fields = My ASIN
    // (And didn't match the COMP check above)
    if (hasOrganicRank && hasSponsoredRank) {
        return 'HELIUM10_CEREBRO_MY_ASIN';
    }

    // Fallback: If only has Cerebro IQ Score (older detection)
    if (hasCerebroIQ) {
        return 'HELIUM10_CEREBRO_COMP';
    }

    if (headerSet.has('Portfolio ID') || headerSet.has('portfolio id')) {
        return 'AMAZON_PORTFOLIO';
    }

    // Fallback: If has Campaign + Keyword-like columns, treat as Bulk
    if ((lowerHeaderStr.includes('campaign') || lowerHeaderStr.includes('campaign name')) &&
        (lowerHeaderStr.includes('keyword') || lowerHeaderStr.includes('target'))) {
        console.log('[FileParser] Fallback: Treating as AMAZON_BULK based on Campaign + Keyword columns');
        return 'AMAZON_BULK';
    }

    // Amazon Business Report
    const hasSessions = headerSet.has('Sessions') || headerSet.has('Số phiên');
    const hasSales = headerSet.has('Ordered Product Sales') || headerSet.has('Ordered Product Sales (B2B)') || headerSet.has('Doanh số sản phẩm được đặt hàng');
    const hasPageViews = headerSet.has('Page Views') || headerSet.has('Lượt xem trang');
    const hasBuyBox = headerSet.has('Buy Box Percentage') || headerSet.has('Tỷ lệ hộp mua hàng');
    const hasUnits = headerSet.has('Units Ordered') || headerSet.has('Đơn vị đã đặt hàng');

    if (hasSessions && (hasSales || hasUnits) && (hasPageViews || hasBuyBox)) {
        return 'AMAZON_BUSINESS_REPORT';
    }

    return 'UNKNOWN';
};
