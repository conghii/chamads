
export class CacheService {
    private cache: Map<string, { data: any, expiry: number }> = new Map();

    /**
     * @param ttl Time to live in milliseconds (default 5 minutes)
     */
    set(key: string, data: any, ttl: number = 300000): void {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { data, expiry });
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    clear(): void {
        this.cache.clear();
    }

    delete(key: string): void {
        this.cache.delete(key);
    }
}

export const cacheService = new CacheService();
