import { useState } from 'react';
import { ModelListView } from './components/ModelListView';
import { CompareView } from './components/CompareView';
import { FreeModelsView } from './components/FreeModelsView';
import './App.css';

type TabId = 'models' | 'compare' | 'free';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('models');

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">LLM Models Hub</h1>
            </div>
            <nav className="flex space-x-1">
              <button
                onClick={() => setActiveTab('models')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'models' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Model List
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'compare' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Compare & Ranking
              </button>
              <button
                onClick={() => setActiveTab('free')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'free' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Free Local Models
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'models' && <ModelListView />}
        {activeTab === 'compare' && <CompareView />}
        {activeTab === 'free' && <FreeModelsView />}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>LLM Models Hub &copy; {new Date().getFullYear()}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

