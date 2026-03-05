import { GoogleSpreadsheet } from 'google-spreadsheet';

export interface ProductDetail {
    name: string;
    asin: string;
    sku: string;
    title: string;
    bulletPoints: string;
    description: string;
    genericKeywords: string;
    listingPlan: string;
}

export class ProductService {
    private doc: GoogleSpreadsheet;

    constructor(doc: GoogleSpreadsheet) {
        this.doc = doc;
    }

    async getProducts(): Promise<ProductDetail[]> {
        const sheet = this.doc.sheetsByTitle['My_ASIN'];
        if (!sheet) {
            console.warn("'My_ASIN' sheet not found.");
            return [];
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        return rows.map(row => ({
            name: row.get('Ten SP') || row.get('Tên SP') || '',
            asin: row.get('ASIN') || '',
            sku: row.get('SKU') || '',
            title: row.get('Title') || '',
            bulletPoints: row.get('Bullet Points') || '',
            description: row.get('Description') || '',
            genericKeywords: row.get('Generic Keywords') || '',
            listingPlan: row.get('Listing Plan') || ''
        }));
    }

    async saveProduct(product: ProductDetail): Promise<void> {
        const sheet = this.doc.sheetsByTitle['My_ASIN'];
        if (!sheet) {
            throw new Error("'My_ASIN' sheet not found.");
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        // Try to find existing product by ASIN or SKU
        const existingRow = rows.find(r =>
            (product.asin && r.get('ASIN') === product.asin) ||
            (product.sku && r.get('SKU') === product.sku)
        );

        const rowData = {
            'Ten SP': product.name,
            'ASIN': product.asin,
            'SKU': product.sku,
            'Title': product.title,
            'Bullet Points': product.bulletPoints,
            'Description': product.description,
            'Generic Keywords': product.genericKeywords,
            'Listing Plan': product.listingPlan
        };

        if (existingRow) {
            // Update existing row
            Object.assign(existingRow, rowData);
            await existingRow.save();
        } else {
            // Add new row
            await sheet.addRow(rowData);
        }
    }
}
