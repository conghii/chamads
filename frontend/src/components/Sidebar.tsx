import { Home, Database, BarChart3, Settings, PieChart, Target, Globe, Brain, Layers, LineChart, ClipboardList, Calculator } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function Sidebar() {
    const location = useLocation();

    const navGroups = [
        {
            title: "Overview",
            items: [
                { path: '/', icon: Home, label: 'Dashboard' },
                { path: '/my-asin', icon: Target, label: 'My ASIN' },
                { path: '/profit-calculator', icon: Calculator, label: 'Profit Calculator' },
                { path: '/data-hub', icon: Database, label: 'Data Hub' }
            ]
        },
        {
            title: "Intelligence",
            items: [
                { path: '/asin-intelligence', icon: Brain, label: 'ASIN Intelligence' },
                { path: '/ranking', icon: BarChart3, label: 'Ranking' },
                { path: '/market-dominance', icon: Globe, label: 'Market Dominance' }
            ]
        },
        {
            title: "Operations",
            items: [
                { path: '/analysis-bulk', icon: PieChart, label: 'Analysis Bulk' },
                { path: '/harvest-hub', icon: Layers, label: 'Harvest Hub' },
                { path: '/action-queue', icon: ClipboardList, label: 'Action Queue' },
                { path: '/analytics', icon: LineChart, label: 'Analytics' }
            ]
        },
        {
            title: "System",
            items: [
                { path: '/settings', icon: Settings, label: 'Settings' }
            ]
        }
    ];

    return (
        <div className="w-64 bg-slate-50 border-r border-slate-200 h-screen fixed left-0 top-0 overflow-y-auto">
            {/* Logo/Header */}
            <div className="p-6">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Cham<span className="text-blue-600">MPPC</span>
                </h1>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-1">Ads Manager</p>
            </div>

            {/* Navigation */}
            <nav className="px-4 pb-28 space-y-7">
                {navGroups.map((group) => (
                    <div key={group.title} className="space-y-2">
                        <h2 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            {group.title}
                        </h2>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`
                                            flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-bold text-[13px] tracking-tight
                                            ${isActive
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 active:scale-95'
                                                : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="sticky bottom-0 left-0 w-full p-6 bg-slate-50 border-t border-slate-100 backdrop-blur-md bg-opacity-80">
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    <p>Version 1.0.0</p>
                    <p className="mt-1 opacity-60">© 2026 ChamMPPC</p>
                </div>
            </div>
        </div>
    );
}
