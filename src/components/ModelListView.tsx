import { useState, useEffect } from 'react';
import { PlatformData } from '../types';
import { fetchPlatformData, PLATFORMS, getVendorColor } from '../data';

export const ModelListView = () => {
  const [activePlatform, setActivePlatform] = useState(PLATFORMS[0].id);
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await fetchPlatformData(activePlatform);
        setData(result);
      } catch (error) {
        console.error('Failed to load platform data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activePlatform]);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }

  if (!data) {
    return <div className="text-center p-12 text-red-500">Failed to load data</div>;
  }

  const categories = data.categories || [];
  
  const filteredCategories = categories.map(category => {
    if (activeCategory !== 'all' && category.id !== activeCategory) return null;
    
    const filteredModels = category.models.filter(model => {
      const searchLower = searchTerm.toLowerCase();
      return (
        model.name.toLowerCase().includes(searchLower) ||
        model.modelId.toLowerCase().includes(searchLower) ||
        model.vendor.toLowerCase().includes(searchLower)
      );
    });
    
    if (filteredModels.length === 0) return null;
    
    return { ...category, models: filteredModels };
  }).filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(platform => (
            <button
              key={platform.id}
              onClick={() => setActivePlatform(platform.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activePlatform === platform.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {platform.name}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64 relative">
          <input
            type="text"
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => setActiveCategory('all')} 
          className={`px-3 py-1 text-sm rounded-full ${activeCategory === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          All Categories
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1 text-sm rounded-full ${activeCategory === cat.id ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">API Overview - {data.platformName}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div><span className="font-medium">Base URL:</span> {data.apiOverview.baseUrl}</div>
          <div><span className="font-medium">Auth:</span> {data.apiOverview.authentication.header}</div>
          {data.apiOverview.architecture && <div className="md:col-span-2"><span className="font-medium">Architecture:</span> {data.apiOverview.architecture}</div>}
        </div>
      </div>

      {filteredCategories.map((category: any) => (
        <div key={category.id} className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 pb-2 border-b">{category.name}</h2>
          <p className="text-gray-600 mb-6">{category.description}</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {category.models.map((model: any) => (
              <div key={model.modelId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="p-5 flex-grow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-900 truncate pr-2" title={model.name}>{model.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getVendorColor(model.vendor)}`}>
                      {model.vendor}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-4 font-mono truncate" title={model.modelId}>
                    {model.modelId}
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    {model.context && (
                      <div className="flex items-start">
                        <span className="text-gray-400 w-5 inline-block mr-1">⚡</span>
                        <span className="text-gray-700"><span className="font-medium">Context:</span> {model.context}</span>
                      </div>
                    )}
                    {model.pricing && (
                      <div className="flex items-start">
                        <span className="text-gray-400 w-5 inline-block mr-1">💰</span>
                        <span className="text-gray-700 line-clamp-2" title={model.pricing}><span className="font-medium">Price:</span> {model.pricing}</span>
                      </div>
                    )}
                    {model.output && (
                      <div className="flex items-start">
                        <span className="text-gray-400 w-5 inline-block mr-1">📤</span>
                        <span className="text-gray-700"><span className="font-medium">Output:</span> {model.output}</span>
                      </div>
                    )}
                  </div>
                  
                  {model.capabilities && model.capabilities.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {model.capabilities.map((cap: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">{cap}</span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-between items-center">
                  <a 
                    href={model.docsUrl || data.docsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Docs
                  </a>
                  <button 
                    onClick={() => {
                      let curl = '';
                      if (data.platform === 'siliconflow' || data.platform === 'bai') {
                        curl = `curl ${data.apiOverview.baseUrl}/chat/completions \
  -H Authorization: Bearer YOUR_API_KEY \
  -H Content-Type: application/json \
  -d '{
    model: ${model.modelId},
    messages: [
      {role: user, content: Hello!}
    ]
  }'`;
                      } else if (data.platform === 'poyo' && category.id === 'image') {
                        curl = `curl ${data.apiOverview.baseUrl}/api/generate/submit \
  -H Authorization: Bearer YOUR_API_KEY \
  -H Content-Type: application/json \
  -d '{
    model: ${model.modelId},
    input: {
      prompt: A cute cat
    }
  }'`;
                      } else {
                         curl = `curl ${data.apiOverview.baseUrl} \
  -H Authorization: Bearer YOUR_API_KEY \
  -H Content-Type: application/json \
  -d '{
    model: ${model.modelId}
  }'`;
                      }
                      navigator.clipboard.writeText(curl);
                      alert('cURL copied to clipboard!');
                    }}
                    className="text-gray-600 hover:text-gray-900 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium shadow-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    cURL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {filteredCategories.length === 0 && (
        <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-100">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No models found</h3>
          <p>Try adjusting your search or category filter</p>
        </div>
      )}
    </div>
  );
}

