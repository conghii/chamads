import * as admin from 'firebase-admin';
import path from 'path';

export interface ProductCostConfig {
    asin: string;
    sellingPrice: number;
    cogs: number;
    shipping: number;
    referralFee: number;
    fbaFee: number;
}

export interface GlobalProfitConfig {
    defaultProfitMarginBeforeAds?: number; // e.g., 30 for 30%
}

export class ProfitConfigService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = admin.firestore();
    }

    async getGlobalConfig(): Promise<GlobalProfitConfig> {
        const doc = await this.db.collection('profitConfigs').doc('global').get();
        if (!doc.exists) return {};
        return doc.data() as GlobalProfitConfig;
    }

    async updateGlobalConfig(config: GlobalProfitConfig): Promise<void> {
        await this.db.collection('profitConfigs').doc('global').set(config, { merge: true });
    }

    async getProductConfigs(): Promise<ProductCostConfig[]> {
        const snapshot = await this.db.collection('productCosts').get();
        return snapshot.docs.map(doc => doc.data() as ProductCostConfig);
    }

    async updateProductConfig(config: ProductCostConfig): Promise<void> {
        await this.db.collection('productCosts').doc(config.asin).set(config, { merge: true });
    }
}
