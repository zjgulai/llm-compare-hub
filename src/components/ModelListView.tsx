import { useState, useEffect } from 'react';
import type { Category, ModelVariant, PlatformData } from '../types';
import { fetchPlatformData, PLATFORMS, getVendorColor } from '../data';

const toDomId = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';

const buildCurlExample = (data: PlatformData, category: Category, model: ModelVariant) => {
  if (model.curlExample) return model.curlExample;

  const headers = `  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json"`;
  if (data.platform === 'siliconflow' || data.platform === 'bai' || data.platform === 'easyrouter') {
    return `curl "${data.apiOverview.baseUrl}/chat/completions" \\\n${headers} \\\n  -d '${JSON.stringify({
      model: model.modelId,
      messages: [{ role: 'user', content: '你好，请用一句话介绍这个模型。' }],
    }, null, 2)}'`;
  }

  if (data.platform === 'poyo' && category.id === 'image') {
    return `curl "${data.apiOverview.baseUrl}/api/generate/submit" \\\n${headers} \\\n  -d '${JSON.stringify({
      model: model.modelId,
      input: { prompt: '一只在书桌旁工作的橘猫，写实风格' },
    }, null, 2)}'`;
  }

  return `curl "${data.apiOverview.baseUrl}" \\\n${headers} \\\n  -d '${JSON.stringify({
    model: model.modelId,
  }, null, 2)}'`;
};

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
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activePlatform]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500">
        <div className="mr-3 h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
        正在加载模型数据...
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-700">数据加载失败，请稍后重试。</div>;
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
  }).filter((category): category is Category => Boolean(category));

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(platform => (
            <button
              key={platform.id}
              onClick={() => setActivePlatform(platform.id)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                activePlatform === platform.id
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : `${platform.color} hover:bg-white`
              }`}
            >
              {platform.name}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64 relative">
          <input
            type="text"
            placeholder="搜索模型、Model ID 或厂商"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-4 py-2 pl-10 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => setActiveCategory('all')} 
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'}`}
        >
          全部类别
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeCategory === cat.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="mb-8 rounded-lg border border-rose-100 bg-rose-50 p-4">
        <h3 className="mb-2 font-semibold text-rose-950">调用概览 - {data.platformName}</h3>
        <div className="grid grid-cols-1 gap-4 text-sm text-rose-900 md:grid-cols-2">
          <div><span className="font-medium">Base URL：</span>{data.apiOverview.baseUrl}</div>
          <div><span className="font-medium">认证方式：</span>{data.apiOverview.authentication.header}</div>
          {data.apiOverview.architecture && <div className="md:col-span-2"><span className="font-medium">架构：</span>{data.apiOverview.architecture}</div>}
          {data.apiOverview.asyncModels && <div><span className="font-medium">异步模型：</span>{data.apiOverview.asyncModels}</div>}
          {data.apiOverview.syncModels && <div><span className="font-medium">同步模型：</span>{data.apiOverview.syncModels}</div>}
        </div>
      </div>

      {filteredCategories.map((category) => (
        <div key={category.id} className="mb-12">
          <h2 className="mb-2 border-b border-slate-200 pb-2 text-2xl font-bold text-slate-950">{category.name}</h2>
          <p className="mb-6 text-slate-600">{category.description}</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {category.models.map((model) => {
              const headingId = `model-card-${toDomId(category.id)}-${toDomId(model.modelId)}`;
              return (
              <div
                key={model.modelId}
                role="article"
                data-model-card="true"
                aria-labelledby={headingId}
                className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="p-5 flex-grow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 id={headingId} className="truncate pr-2 text-lg font-bold text-slate-950" title={model.name}>{model.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getVendorColor(model.vendor)}`}>
                      {model.vendor}
                    </span>
                  </div>
                  
                  <div className="mb-4 truncate font-mono text-sm text-slate-500" title={model.modelId}>
                    {model.modelId}
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    {model.context && (
                      <div className="flex items-start">
                        <span className="mr-2 mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                        <span className="text-slate-700"><span className="font-medium">上下文：</span>{model.context}</span>
                      </div>
                    )}
                    {model.pricing && (
                      <div className="flex items-start">
                        <span className="mr-2 mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <span className="line-clamp-2 text-slate-700" title={model.pricing}><span className="font-medium">价格：</span>{model.pricing}</span>
                      </div>
                    )}
                    {model.output && (
                      <div className="flex items-start">
                        <span className="mr-2 mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                        <span className="text-slate-700"><span className="font-medium">输出：</span>{model.output}</span>
                      </div>
                    )}
                  </div>
                  
                  {model.capabilities && model.capabilities.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {model.capabilities.map((cap: string, i: number) => (
                        <span key={i} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{cap}</span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <a 
                    href={model.docsUrl || data.docsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex min-h-8 items-center gap-1 text-sm font-medium text-rose-700 hover:text-rose-900"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    文档
                  </a>
                  <button 
                    onClick={() => {
                      const curl = buildCurlExample(data, category, model);
                      navigator.clipboard.writeText(curl);
                      alert('cURL 已复制到剪贴板');
                    }}
                    className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:text-slate-950"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    复制 cURL
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {filteredCategories.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white py-20 text-center text-slate-500">
          <svg className="mx-auto mb-4 h-16 w-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 className="mb-1 text-lg font-medium text-slate-950">没有匹配模型</h3>
          <p>可以调整搜索词或切换分类继续查看。</p>
        </div>
      )}
    </div>
  );
}
