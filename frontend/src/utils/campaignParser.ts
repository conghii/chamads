export interface ParsedCampaign {
    type: 'SP' | 'SB' | 'SD' | 'Auto' | 'SBV' | 'Unknown';
    targeting: 'KT' | 'PT' | 'Auto' | 'Unknown';
    bid: number | null;
    theme: string;
    tags: string[];
}

export function parseCampaignName(name: string): ParsedCampaign {
    if (!name) {
        return { type: 'Unknown', targeting: 'Unknown', bid: null, theme: '', tags: [] };
    }

    const result: ParsedCampaign = {
        type: 'Unknown',
        targeting: 'Unknown',
        bid: null,
        theme: '',
        tags: []
    };

    const upperName = name.toUpperCase();

    // 1. Parse Type
    if (upperName.includes('SBV') || upperName.includes('VIDEO')) {
        result.type = 'SBV';
    } else if (upperName.includes('SB') || upperName.includes('BRAND')) {
        result.type = 'SB';
    } else if (upperName.includes('SD') || upperName.includes('DISPLAY')) {
        result.type = 'SD';
    } else if (upperName.includes('AUTO')) {
        result.type = 'Auto';
    } else if (upperName.includes('SP') || upperName.includes('PRODUCT')) {
        result.type = 'SP';
    } else {
        result.type = 'SP'; // Default fallback assumption
    }

    // 2. Parse Targeting
    if (upperName.includes('AUTO')) {
        result.targeting = 'Auto';
    } else if (upperName.includes('PT') || upperName.includes('ASIN') || upperName.includes('CATEGORY')) {
        result.targeting = 'PT';
    } else if (upperName.includes('KT') || upperName.includes('KEYWORD') || upperName.includes('BROAD') || upperName.includes('EXACT') || upperName.includes('PHRASE')) {
        result.targeting = 'KT';
    }

    // 3. Parse Bid (looks for decimals like 0.45, 1.2)
    const bidMatch = name.match(/(?:^|[-_\s])(\d+\.\d{1,2})(?:[-_\s]|$)/);
    if (bidMatch) {
        result.bid = parseFloat(bidMatch[1]);
    }

    // 4. Parse Tags (looks for (OLD1), -Test, -New)
    const tagsMatch = name.match(/\(([^)]+)\)/g);
    if (tagsMatch) {
        result.tags.push(...tagsMatch.map(t => t.replace(/[()]/g, '').trim()));
    }
    const suffixTags = name.match(/-(Test|New|Old\d*|Top\s?\d+)/ig);
    if (suffixTags) {
        result.tags.push(...suffixTags.map(t => t.replace(/^-/, '').trim()));
    }

    // 5. Parse Theme (heuristic: everything else that isn't a tag, type, or bid)
    // Simplify: just remove known patterns
    let themeStr = name
        .replace(/\b(SP|SB|SD|SBV|Auto|KT|PT)\b/gi, '') // Remove types
        .replace(/(?:^|[-_\s])(\d+\.\d{1,2})(?:[-_\s]|$)/, ' ') // Remove bid
        .replace(/\([^)]+\)/g, '') // Remove parenthesis tags
        .replace(/-(Test|New|Old\d*|Top\s?\d+)/ig, '') // Remove hyphen tags
        .replace(/[-_\|\s]+/g, ' ') // Replace separators with space
        .trim();

    result.theme = themeStr || name; // fallback to full name if empty

    return result;
}
