import React, { useState, useMemo } from 'react';
import { Rocket, Layout, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface MarketDataRow {
    keyword: string;
    searchVolume: number;
    relevancyScore: number;
    opportunityScore: number;
    launchCategory: string;
    competitorRanks: Record<string, number | null>;
}

interface LaunchArchitectProps {
    data: MarketDataRow[];
    onClose: () => void;
    productName: string;
    topDominatorAsin: string;
}

export const LaunchArchitect: React.FC<LaunchArchitectProps> = ({ data, onClose, productName, topDominatorAsin }) => {
    const [title, setTitle] = useState('');
    const [bullets, setBullets] = useState(['', '', '', '', '']);
    const [description, setDescription] = useState('');

    // SEO Coverage Calculation
    const totalMarketSV = useMemo(() => data.reduce((acc, row) => acc + row.searchVolume, 0), [data]);

    const usedKeywords = useMemo(() => {
        const fullText = `${title} ${bullets.join(' ')} ${description}`.toLowerCase();
        return new Set(data.filter(row => fullText.includes(row.keyword.toLowerCase())).map(row => row.keyword));
    }, [title, bullets, description, data]);

    const coveredSV = useMemo(() => {
        return data
            .filter(row => usedKeywords.has(row.keyword))
            .reduce((acc, row) => acc + row.searchVolume, 0);
    }, [usedKeywords, data]);

    const coveragePercent = totalMarketSV > 0 ? Math.round((coveredSV / totalMarketSV) * 100) : 0;

    // Dominance Gap: How many of Top Dominator's keywords are we missing?
    const dominatorKeywords = data.filter(row => {
        const rank = row.competitorRanks[topDominatorAsin];
        return rank !== null && rank <= 10;
    });

    const capturedDominatorKWs = dominatorKeywords.filter(row => usedKeywords.has(row.keyword)).length;
    const dominanceGapPercent = dominatorKeywords.length > 0
        ? Math.round((capturedDominatorKWs / dominatorKeywords.length) * 100)
        : 100;

    const handleAddKeyword = (kw: string, slot: string) => {
        if (slot === 'Title') setTitle(prev => prev ? `${prev} ${kw}` : kw);
        else if (slot.startsWith('Bullet')) {
            const idx = parseInt(slot.split(' ')[1]) - 1;
            const newBullets = [...bullets];
            newBullets[idx] = newBullets[idx] ? `${newBullets[idx]} ${kw}` : kw;
            setBullets(newBullets);
        } else {
            setDescription(prev => prev ? `${prev} ${kw}` : kw);
        }
    };

    const categories = [
        { id: 'Title', name: 'TITLE CORE (MUST-HAVE)', color: 'blue' },
        { id: 'Bullet', name: 'BULLET POINTS (BATTLEGROUND)', color: 'emerald' },
        { id: 'Description', name: 'DESCRIPTION & ST (NICHE/SEED)', color: 'slate' }
    ];

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
            {/* Launch Header */}
            <header className="bg-white border-b border-slate-200 p-6 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center space-y-1">
                    <div className="bg-blue-600 p-2 rounded-lg mr-4">
                        <Rocket className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Launch Intelligence Architect</h1>
                        <p className="text-xs text-slate-500 font-medium">ONBOARDING: <span className="text-blue-600 font-bold">{productName}</span> • TARGET: <span className="text-slate-700 font-bold">{topDominatorAsin}</span></p>
                    </div>
                </div>

                <div className="flex space-x-8 mr-12">
                    <div className="flex flex-col items-center">
                        <div className="text-2xl font-black text-blue-600 leading-none">{coveragePercent}%</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-widest">SEO Coverage</div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="text-2xl font-black text-emerald-600 leading-none">{dominanceGapPercent}%</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-widest">Dominance Gap</div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold uppercase transition-all tracking-widest"
                >
                    Exit Builder
                </button>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Left Column: Keyword Inventory */}
                <aside className="w-[450px] bg-white border-r border-slate-200 overflow-y-auto p-6 scrollbar-thin">
                    <div className="flex items-center space-x-2 mb-6">
                        <Layout className="text-slate-400" size={18} />
                        <h2 className="text-sm font-black uppercase text-slate-500 tracking-widest">Keyword Inventory</h2>
                    </div>

                    {categories.map(cat => (
                        <div key={cat.id} className="mb-8">
                            <h3 className={`text-[11px] font-black text-${cat.color}-600 uppercase tracking-[0.2em] mb-4 flex items-center`}>
                                <span className={`w-2 h-2 rounded-full bg-${cat.color}-500 mr-2`}></span>
                                {cat.name}
                            </h3>
                            <div className="space-y-2">
                                {data.filter(row => row.launchCategory === cat.id).slice(0, 30).map(row => {
                                    const isUsed = usedKeywords.has(row.keyword);
                                    return (
                                        <div
                                            key={row.keyword}
                                            className={`p-3 rounded-xl border transition-all flex items-center justify-between group ${isUsed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 border-slate-200">
                                                    <span className={`text-sm font-bold truncate ${isUsed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                                        {row.keyword}
                                                    </span>
                                                    {isUsed && <CheckCircle2 className="text-emerald-500" size={14} />}
                                                </div>
                                                <div className="flex items-center space-x-3 mt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{row.searchVolume.toLocaleString()} SV</span>
                                                    <span className="text-[10px] font-bold text-blue-500/80 bg-blue-50 px-1 rounded">OPP: {row.opportunityScore}</span>
                                                </div>
                                            </div>

                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleAddKeyword(row.keyword, 'Title')}
                                                    className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-700"
                                                    title="Add to Title"
                                                >T</button>
                                                <button
                                                    onClick={() => handleAddKeyword(row.keyword, 'Bullet 1')}
                                                    className="w-7 h-7 flex items-center justify-center bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700"
                                                    title="Add to Bullet"
                                                >B</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </aside>

                {/* Right Column: Drafting Area */}
                <section className="flex-1 overflow-y-auto p-12 bg-slate-50/50 scrollbar-thin">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {/* Title Section */}
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex justify-between">
                                Product Title
                                <span className={title.length > 200 ? 'text-red-500' : 'text-slate-500'}>{title.length}/200</span>
                            </label>
                            <textarea
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Write your optimized product title..."
                                className="w-full h-24 p-6 bg-white border border-slate-200 rounded-3xl text-lg font-bold text-slate-800 placeholder-slate-300 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none resize-none shadow-sm shadow-slate-100"
                            />
                        </div>

                        {/* Bullets Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Tactical Bullet Points</h3>
                            {bullets.map((bullet, idx) => (
                                <div key={idx} className="flex space-x-4 items-start">
                                    <span className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-300 rounded-xl text-xs font-black mt-2">#{idx + 1}</span>
                                    <textarea
                                        value={bullet}
                                        onChange={(e) => {
                                            const newBullets = [...bullets];
                                            newBullets[idx] = e.target.value;
                                            setBullets(newBullets);
                                        }}
                                        placeholder={`Feature ${idx + 1}...`}
                                        className="flex-1 h-16 p-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-300 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all outline-none resize-none shadow-sm shadow-slate-100"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Description Section */}
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Description / Long Tail Content</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Expand on details and long-tail keywords..."
                                className="w-full h-48 p-6 bg-white border border-slate-200 rounded-3xl text-sm font-medium text-slate-700 placeholder-slate-300 focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all outline-none scrollbar-thin shadow-sm shadow-slate-100"
                            />
                        </div>

                        <div className="pt-8 border-t border-slate-200 flex justify-end">
                            <button className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all flex items-center space-x-2 active:scale-95">
                                <ShieldCheck size={20} />
                                <span>Save Launch Draft</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};
