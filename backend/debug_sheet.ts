import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function debugData() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!sheetId || !clientEmail || !privateKey) {
        console.error('Missing credentials');
        return;
    }

    const auth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Raw_Market_Intel'];
    if (!sheet) {
        console.error('Sheet not found');
        return;
    }

    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    const headers = sheet.headerValues;

    headers.forEach((h, i) => console.log(`Header[${i}]: ${h}`));

    const competitorAsins = headers.filter(h => /^B0[A-Z0-9]{8}$/i.test(h));

    if (rows.length > 0) {
        console.log(`Analyzing first ${Math.min(rows.length, 5)} rows...`);
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const row = rows[i];
            const raw = (row as any)._rawData;
            const data: any = {};
            competitorAsins.forEach(asin => {
                const index = headers.indexOf(asin);
                data[asin] = { value: row.get(asin), rawValue: raw[index] };
            });
            console.log(`Row ${i} Data:`, JSON.stringify(data));
        }
    }
}

debugData().catch(console.error);
