import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const DEBUG_LOG_PATH = path.join(process.cwd(), 'debug_backend.log');
function logDebug(msg: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] ${msg}\n`);
}

export interface BusinessReportMetadata {
    status: 'connected';
    lastUpdated: admin.firestore.FieldValue;
    dateRange: {
        from: string;
        to: string;
    };
    totalSales: number;
    totalUnits: number;
    avgSessions: number;
    reportType: 'by_date' | 'by_child_item';
    sheetId: string | null;
}

export class BusinessReportService {
    private db: admin.firestore.Firestore;

    constructor() {
        if (!admin.apps.length) {
            console.error('[BusinessReportService] Firebase Admin not initialized!');
        }
        this.db = admin.firestore();
    }

    async saveMetadata(teamId: string, rawData: any[], sheetName: string): Promise<void> {
        if (!rawData || rawData.length === 0) {
            logDebug(`[BusinessReportService] Skipping saveMetadata - rawData is empty`);
            return;
        }

        const headers = Object.keys(rawData[0]);
        logDebug(`[BusinessReportService] Analyzing rawData with ${rawData.length} rows. Headers: ${headers.join(', ')}`);

        // Log snapshot of first 3 rows for debugging
        rawData.slice(0, 3).forEach((row, i) => {
            logDebug(`[BusinessReportService] Sample Row ${i}: ${JSON.stringify(row)}`);
        });

        let totalSales = 0;
        let totalUnits = 0;
        let totalSessions = 0;

        const isByDate = !!rawData[0]['Date'] || !!rawData[0]['Ngày'] || !!rawData[0]['Số phiên']; // Some heuristic
        let fromDate = '';
        let toDate = '';

        if (isByDate) {
            const dates = rawData.map(r => {
                const dVal = r['Date'] || r['Ngày'];
                return dVal ? new Date(dVal).getTime() : NaN;
            }).filter(t => !isNaN(t));

            if (dates.length > 0) {
                const min = new Date(Math.min(...dates));
                const max = new Date(Math.max(...dates));
                fromDate = min.toISOString();
                toDate = max.toISOString();
            }
        }

        rawData.forEach(row => {
            const salesVal = row['Ordered Product Sales'] || row['Ordered Product Sales (B2B)'] || row['Doanh số sản phẩm được đặt hàng'] || '0';
            const unitsVal = row['Units Ordered'] || row['Đơn vị đã đặt hàng'] || '0';
            const sessionsVal = row['Sessions'] || row['Số phiên'] || '0';

            // Use more robust parsing for currency strings (e.g. $1,234.56 or 1.234,56)
            const parseVal = (v: any) => {
                if (typeof v === 'number') return v;
                if (!v) return 0;

                let s = v.toString().replace(/[^0-9,.-]/g, '');
                if (!s) return 0;

                const lastComma = s.lastIndexOf(',');
                const lastDot = s.lastIndexOf('.');

                if (lastComma > lastDot) {
                    // EU/VN format: 1.234,56 or 1,23
                    s = s.replace(/\./g, '').replace(',', '.');
                } else {
                    // US format: 1,234.56 or 1.23
                    s = s.replace(/,/g, '');
                }

                const num = parseFloat(s);
                return isFinite(num) ? num : 0;
            };

            const sales = parseVal(salesVal);
            const units = Math.abs(parseInt(unitsVal.toString().replace(/,/g, ''), 10));
            const sessions = Math.abs(parseInt(sessionsVal.toString().replace(/,/g, ''), 10));

            totalSales += !isNaN(sales) ? sales : 0;
            totalUnits += !isNaN(units) ? units : 0;
            totalSessions += !isNaN(sessions) ? sessions : 0;
        });

        const avgSessions = rawData.length > 0 ? Math.round(totalSessions / rawData.length) : 0;

        const metadata: BusinessReportMetadata = {
            status: 'connected',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            dateRange: {
                from: fromDate,
                to: toDate
            },
            totalSales,
            totalUnits,
            avgSessions,
            reportType: isByDate ? 'by_date' : 'by_child_item',
            sheetId: sheetName
        };

        const docRef = this.db.collection('teams').doc(teamId).collection('dataSources').doc('businessReport');

        logDebug(`[BusinessReportService] Attempting to save metadata to: ${docRef.path}. Sales: ${totalSales}, Units: ${totalUnits}`);
        try {
            await docRef.set(metadata, { merge: true });
            logDebug(`[BusinessReportService] Successfully saved metadata for team ${teamId}`);
        } catch (error: any) {
            logDebug(`[BusinessReportService] ERROR SAVING METADATA: ${error.message}`);
            throw error;
        }
    }

    async getMetadata(teamId: string): Promise<BusinessReportMetadata | null> {
        try {
            const docRef = this.db.collection('teams').doc(teamId).collection('dataSources').doc('businessReport');
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                return docSnap.data() as BusinessReportMetadata;
            }
            return null;
        } catch (error) {
            console.error(`[BusinessReportService] Error fetching metadata for team ${teamId}:`, error);
            return null;
        }
    }
}
