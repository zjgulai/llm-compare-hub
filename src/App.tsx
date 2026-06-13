import { useState } from 'react';
import { ModelListView } from './components/ModelListView';
import { CompareView } from './components/CompareView';
import { FreeModelsView } from './components/FreeModelsView';
import './App.css';

type TabId = 'models' | 'compare' | 'free';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('models');
  const navItems: Array<{ id: TabId; label: string }> = [
    { id: 'models', label: '模型列表' },
    { id: 'compare', label: '对比排序' },
    { id: 'free', label: '免费本地模型' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h16" />
                  <circle cx="18" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">LLM Models Hub</h1>
                <p className="text-xs text-slate-500">大模型 API 选型、对比与本地模型参考</p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'models' && <ModelListView />}
        {activeTab === 'compare' && <CompareView />}
        {activeTab === 'free' && <FreeModelsView />}
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>LLM Models Hub &copy; {new Date().getFullYear()} · 数据用于选型参考，请以官方文档为最终依据。</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
