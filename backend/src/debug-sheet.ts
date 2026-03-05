
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
];

async function testInsert() {
    console.log('=== TEST INSERT INTO EXISTING GROUP ===\n');

    const key = require('./service-account-key.json');
    const jwt = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: SCOPES,
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, jwt);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Rank Organic'];
    if (!sheet) { console.error('Sheet not found!'); return; }

    await sheet.loadHeaderRow();
    const headers = sheet.headerValues;
    const asinColIdx = headers.indexOf('ASIN');
    const kwColIdx = headers.indexOf('Keyword');
    const colLetter = (idx: number) => String.fromCharCode(65 + idx);
    const asinCol = colLetter(asinColIdx);
    const kwCol = colLetter(kwColIdx);
    console.log(`ASIN col: ${asinCol}, Keyword col: ${kwCol}`);

    // Step 1: Clean test data
    console.log('\nStep 1: Cleaning old test data...');
    let rows = await sheet.getRows();
    for (let i = rows.length - 1; i >= 0; i--) {
        const asin = (rows[i].get('ASIN') || '').trim();
        const kw = (rows[i].get('Keyword') || '').trim();
        if (asin === 'TEST_DEBUG' || asin === 'B0TEST123' ||
            kw === 'keyword_1' || kw === 'keyword_2' || kw === 'test_keyword_debug' ||
            kw === 'bible verse jar' || kw === 'bible verse cards' || kw === 'decorative jars' ||
            kw === 'bible verse' || kw === 'motivational gifts' || kw === 'biblical' ||
            kw === 'bible things' || kw === 'the scriptures bible' || kw === 'scripture jar' ||
            kw === 'bible verses cards' || kw === 'read' || kw === 'bible verses in a jar' ||
            kw === 'oke brou') {
            console.log(`  Deleting: ASIN="${asin}" Keyword="${kw}"`);
            await rows[i].delete();
        }
    }

    // Step 2: Show current state
    rows = await sheet.getRows();
    console.log(`\nStep 2: Current state (${rows.length} rows):`);
    for (const row of rows) {
        const a = (row.get('ASIN') || '').trim();
        const k = (row.get('Keyword') || '').trim();
        console.log(`  Row ${row.rowNumber}: ASIN="${a}" | Keyword="${k}"`);
    }

    // Step 3: Find B0FVYHB1OK group and insert keyword
    console.log('\nStep 3: Finding B0FVYHB1OK group...');
    const targetAsin = 'B0FVYHB1OK';
    let currentAsin = '';
    let lastRowOfGroup = -1;

    for (let i = 0; i < rows.length; i++) {
        const rowAsin = (rows[i].get('ASIN') || '').trim();
        const rowKw = (rows[i].get('Keyword') || '').trim();
        if (!rowAsin && !rowKw) { currentAsin = ''; continue; }
        if (rowAsin) { currentAsin = rowAsin; }
        if (currentAsin === targetAsin) {
            lastRowOfGroup = rows[i].rowNumber;
        }
    }

    if (lastRowOfGroup > 0) {
        console.log(`  Found! Last row of ${targetAsin} group: ${lastRowOfGroup}`);

        const newRowNum = lastRowOfGroup + 1;
        console.log(`  Inserting at row ${newRowNum}...`);

        await sheet.insertDimension('ROWS', {
            startIndex: newRowNum - 1,
            endIndex: newRowNum,
        }, false);

        await sheet.loadCells(`${kwCol}${newRowNum}:${kwCol}${newRowNum}`);
        const cellKw = sheet.getCellByA1(`${kwCol}${newRowNum}`);
        cellKw.value = 'TEST_INSERT_KEYWORD';
        await sheet.saveUpdatedCells();

        console.log(`  Done! Wrote "TEST_INSERT_KEYWORD" at ${kwCol}${newRowNum}`);
    } else {
        console.log(`  ${targetAsin} NOT FOUND in sheet!`);
    }

    // Step 4: Verify
    console.log('\nStep 4: Final state:');
    const finalRows = await sheet.getRows();
    for (const row of finalRows) {
        const a = (row.get('ASIN') || '').trim();
        const k = (row.get('Keyword') || '').trim();
        console.log(`  Row ${row.rowNumber}: ASIN="${a}" | Keyword="${k}"`);
    }
}

testInsert().catch(console.error);
