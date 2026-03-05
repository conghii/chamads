import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { DataHub } from './components/DataHub';
import AnalysisBulk from './pages/AnalysisBulk';
import HarvestHub from './pages/HarvestHub';
import RankingPage from './pages/RankingPage';
import { MarketDominance } from './components/Ranking/MarketDominance';
import { MyAsin } from './components/Ranking/MyAsin';
import { AsinIntelligence } from './components/Ranking/AsinIntelligence';
import { ActionQueueProvider } from './services/actionQueueService';
import { UploadHistoryProvider } from './services/uploadHistoryService';
import { ProfitProvider } from './services/profitService';
import ActionQueue from './pages/ActionQueue';
import Analytics from './pages/Analytics';
import ProfitCalculator from './pages/ProfitCalculator';
import './App.css';

function App() {
  return (
    <UploadHistoryProvider>
      <ActionQueueProvider>
        <ProfitProvider>
          <BrowserRouter>
            <div className="flex min-h-screen bg-slate-50">
              {/* Sidebar */}
              <Sidebar />

              {/* Main Content */}
              <div className="ml-64 flex-1">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/data-hub" element={<DataHub />} />
                  <Route path="/analysis-bulk" element={<AnalysisBulk />} />
                  <Route path="/ranking" element={<RankingPage />} />
                  <Route path="/market-dominance" element={<MarketDominance />} />
                  <Route path="/asin-intelligence" element={<AsinIntelligence />} />
                  <Route path="/my-asin" element={<MyAsin />} />
                  <Route path="/harvest-hub" element={<HarvestHub />} />
                  <Route path="/action-queue" element={<ActionQueue />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/profit-calculator" element={<ProfitCalculator />} />
                  <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
                </Routes>
              </div>
            </div>
          </BrowserRouter>
        </ProfitProvider>
      </ActionQueueProvider>
    </UploadHistoryProvider>
  );
}

// Placeholder component for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800">{title}</h1>
      <p className="text-slate-600 mt-2">This page is coming soon...</p>
    </div>
  );
}

export default App;
