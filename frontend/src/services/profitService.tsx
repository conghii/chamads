import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ProductCostConfig, GlobalProfitConfig, ProfitBreakdown } from '../types/profit';
import ky from 'ky';
import { API_BASE_URL } from '../config/api';

const API_BASE = `${API_BASE_URL}/api`;

interface ProfitContextType {
    costConfigs: Record<string, ProductCostConfig>;
    globalConfig: GlobalProfitConfig;
    updateCostConfig: (config: ProductCostConfig) => void;
    updateGlobalConfig: (config: GlobalProfitConfig) => void;
    calculateProfit: (asin: string, sales: number, spend: number, orders: number) => ProfitBreakdown;
    loading: boolean;
}

const ProfitContext = createContext<ProfitContextType | undefined>(undefined);

export const ProfitProvider = ({ children }: { children: ReactNode }) => {
    const [costConfigs, setCostConfigs] = useState<Record<string, ProductCostConfig>>({});
    const [globalConfig, setGlobalConfig] = useState<GlobalProfitConfig>({
        defaultReferralFeePercentage: 15
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const data = await ky.get(`${API_BASE}/profit/config`).json<{
                    globalConfig: GlobalProfitConfig;
                    productConfigs: ProductCostConfig[];
                }>();

                if (data.globalConfig) setGlobalConfig(data.globalConfig);
                if (data.productConfigs) {
                    const configMap = data.productConfigs.reduce((acc, c) => ({
                        ...acc,
                        [c.asin]: c
                    }), {});
                    setCostConfigs(configMap);
                }
            } catch (err) {
                console.error('Failed to load profit configs from backend:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchConfigs();
    }, []);

    const updateCostConfig = async (config: ProductCostConfig) => {
        const newCosts = { ...costConfigs, [config.asin]: config };
        setCostConfigs(newCosts);
        try {
            await ky.post(`${API_BASE}/profit/config/product`, { json: config });
        } catch (err) {
            console.error('Failed to sync product config:', err);
        }
    };

    const updateGlobalConfig = async (config: GlobalProfitConfig) => {
        setGlobalConfig(config);
        try {
            await ky.post(`${API_BASE}/profit/config/global`, { json: config });
        } catch (err) {
            console.error('Failed to sync global config:', err);
        }
    };

    const calculateProfit = (asin: string, sales: number, spend: number, orders: number): ProfitBreakdown => {
        const config = costConfigs[asin] || {
            asin,
            sellingPrice: sales / (orders || 1),
            cogs: 0,
            shippingToFba: 0,
            packaging: 0,
            referralFeePercentage: globalConfig.defaultReferralFeePercentage,
            fbaFee: 0,
            storageFee: 0,
            lastUpdated: new Date().toISOString()
        };

        const totalCogs = config.cogs * orders;
        const totalShipping = config.shippingToFba * orders;
        const totalPackaging = config.packaging * orders;
        const totalReferralFees = sales * (config.referralFeePercentage / 100);
        const totalFbaFees = config.fbaFee * orders;
        const totalAdSpend = spend;

        const totalExpenses = totalCogs + totalShipping + totalPackaging + totalReferralFees + totalFbaFees + totalAdSpend;
        const netProfit = sales - totalExpenses;
        const netMargin = sales > 0 ? (netProfit / sales) * 100 : 0;

        // Profit before ads calculation for break-even
        const profitBeforeAds = sales - (totalCogs + totalShipping + totalPackaging + totalReferralFees + totalFbaFees);
        const marginBeforeAds = sales > 0 ? (profitBeforeAds / sales) * 100 : 0;

        // Break-even ACOS is the margin before ads
        const breakEvenAcos = marginBeforeAds;
        const currentAcos = sales > 0 ? (spend / sales) * 100 : 0;
        const acosGap = currentAcos - breakEvenAcos;

        // Break-even Sales: 
        // netProfit = sales - (fees + cogs + spend)
        // Profit is 0 when spend = profitBeforeAds
        // sales_needed = spend / (margin_before_ads / 100)
        const breakEvenSales = marginBeforeAds > 0 ? (spend / (marginBeforeAds / 100)) : 0;

        return {
            entityName: asin,
            asin,
            revenue: sales,
            spend,
            sales,
            orders,
            clicks: 0,
            impressions: 0,
            acos: currentAcos,
            roas: spend > 0 ? sales / spend : 0,
            totalCogs,
            totalShipping,
            totalPackaging,
            totalReferralFees,
            totalFbaFees,
            totalAdSpend,
            totalExpenses,
            netProfit,
            netMargin,
            breakEvenAcos,
            breakEvenSales,
            acosGap
        };
    };

    return (
        <ProfitContext.Provider value={{ costConfigs, globalConfig, updateCostConfig, updateGlobalConfig, calculateProfit, loading }}>
            {children}
        </ProfitContext.Provider>
    );
};

export const useProfit = () => {
    const context = useContext(ProfitContext);
    if (!context) throw new Error('useProfit must be used within a ProfitProvider');
    return context;
};
