/**
 * Safely converts any value to a number. 
 * Returns fallback if the value is NaN, Infinity, or not a valid number string.
 */
export function safeNumber(val: any, fallback = 0): number {
    const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : parseFloat(val);
    return (isFinite(num) && !isNaN(num)) ? num : fallback;
}

/**
 * Formats a number as a percentage string safely.
 */
export function safePercent(val: any, fallback = "0.0%"): string {
    const num = safeNumber(val, NaN);
    if (isNaN(num)) return fallback;
    return `${num.toFixed(1)}%`;
}

/**
 * Formats a number as currency safely.
 */
export function safeCurrency(val: any, fallback = "$0.00"): string {
    const num = safeNumber(val, NaN);
    if (isNaN(num)) return fallback;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
