import { useState, useEffect } from 'react';
import type { FreeModelsData } from '../types';
import { fetchFreeModelsData } from '../data';

const toDomId = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';

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
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500">
        <div className="mr-3 h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
        正在加载本地模型数据...
      </div>
    );
  }
  if (!data) return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-700">本地模型数据加载失败，请稍后重试。</div>;

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-2xl font-bold text-slate-950">{data.categoryName}</h2>
        <p className="text-slate-600">{data.description}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {data.models.map((model) => {
          const headingId = `free-model-card-${toDomId(model.modelId)}`;
          return (
          <div
            key={model.modelId}
            role="article"
            data-model-card="true"
            aria-labelledby={headingId}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="p-6 flex-grow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {model.rank}
                    </span>
                    <h3 id={headingId} className="text-2xl font-bold text-slate-950">{model.name}</h3>
                  </div>
                  <div className="ml-10 font-mono text-sm text-slate-500">{model.baseModel}</div>
                </div>
                <span className="whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {model.vendor}
                </span>
              </div>

              <p className="mb-6 rounded-lg border border-slate-100 bg-slate-50 p-4 text-slate-700">
                {model.notes}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500">架构</div>
                  <div className="text-sm font-medium text-slate-950">{model.architecture}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500">参数量</div>
                  <div className="text-sm font-medium text-slate-950">{model.parameters.total}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500">上下文窗口</div>
                  <div className="text-sm font-medium text-slate-950">{model.context}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500">本地硬件</div>
                  <div className="line-clamp-2 text-sm font-medium text-slate-950" title={model.requirements}>{model.requirements}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">能力标签</div>
                  <div className="flex flex-wrap gap-2">
                    {model.capabilities.map((cap, i) => (
                      <span key={i} className="rounded border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-sm">
                  <div className="mb-1 select-none text-xs text-slate-400"># 安装</div>
                  <div className="text-green-400 mb-4">{model.install}</div>
                  <div className="mb-1 select-none text-xs text-slate-400"># 使用示例</div>
                  <div className="whitespace-pre-wrap text-slate-300">{model.usage}</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm">
              <a href={model.huggingface} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-rose-700 hover:text-rose-900">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                HuggingFace
              </a>
              {model.paper && (
                <a href={model.paper} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-rose-700 hover:text-rose-900">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  论文
                </a>
              )}
              {model.ollamaUrl && (
                <a href={model.ollamaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-rose-700 hover:text-rose-900">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Ollama
                </a>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
