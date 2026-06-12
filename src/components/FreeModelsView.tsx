import { useState, useEffect } from 'react';
import type { FreeModelsData } from '../types';
import { fetchFreeModelsData } from '../data';

export const FreeModelsView = () => {
  const [data, setData] = useState<FreeModelsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchFreeModelsData();
        setData(result);
      } catch (error) {
        console.error('Failed to load free models data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  if (!data) return <div className="text-center p-12 text-red-500">Failed to load data</div>;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md text-white p-8">
        <h2 className="text-3xl font-bold mb-2">{data.categoryName}</h2>
        <p className="text-indigo-100 text-lg">{data.description}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {data.models.map((model) => (
          <div key={model.modelId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 flex-grow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-sm font-bold">
                      {model.rank}
                    </span>
                    <h3 className="text-2xl font-bold text-gray-900">{model.name}</h3>
                  </div>
                  <div className="text-sm text-gray-500 font-mono ml-9">{model.baseModel}</div>
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium whitespace-nowrap">
                  {model.vendor}
                </span>
              </div>

              <p className="text-gray-700 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                {model.notes}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Architecture</div>
                  <div className="text-sm font-medium text-gray-900">{model.architecture}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Parameters</div>
                  <div className="text-sm font-medium text-gray-900">{model.parameters.total}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Context Window</div>
                  <div className="text-sm font-medium text-gray-900">{model.context}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Hardware Req</div>
                  <div className="text-sm font-medium text-gray-900 line-clamp-2" title={model.requirements}>{model.requirements}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Capabilities</div>
                  <div className="flex flex-wrap gap-2">
                    {model.capabilities.map((cap, i) => (
                      <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-gray-400 mb-1 text-xs select-none"># Installation</div>
                  <div className="text-green-400 mb-4">{model.install}</div>
                  <div className="text-gray-400 mb-1 text-xs select-none"># Usage</div>
                  <div className="text-gray-300 whitespace-pre-wrap">{model.usage}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
              <a href={model.huggingface} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                HuggingFace
              </a>
              {model.paper && (
                <a href={model.paper} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Paper
                </a>
              )}
              {model.ollamaUrl && (
                <a href={model.ollamaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Ollama
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
