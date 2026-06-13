import { useEffect, useState, type KeyboardEvent } from 'react';
import type { CompareData, CompareDataType, CompareModel, CompareModalities } from '../types';
import { fetchCompareData, getPlatformMeta } from '../data';

type CompareMode = 'overall' | 'category' | 'function';

const dataTypeLabels: Record<CompareDataType, string> = {
  text: '文本',
  image: '图像',
  video: '视频',
  audio: '音频',
  music: '音乐',
  speech: '语音',
  embedding: '向量',
  ranking: '排序',
  '3d': '3D',
};

const modeTabs: Array<{ id: CompareMode; label: string }> = [
  { id: 'overall', label: '综合 TOP' },
  { id: 'category', label: '按类别对比' },
  { id: 'function', label: '按功能排序' },
];

const toDomId = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';

const formatTypes = (values: string[] = []) =>
  values.map((value) => dataTypeLabels[value as CompareDataType] ?? value).join(' + ') || '—';

const getScore = (model: CompareModel) => model.overallScore ?? model.score;

const scoreTone = (score?: number) => {
  if (!score) return 'text-slate-500';
  if (score >= 90) return 'text-emerald-700';
  if (score >= 80) return 'text-sky-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-slate-600';
};

const RankBadge = ({ rank }: { rank: number }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
    {rank}
  </span>
);

const PlatformBadge = ({ platformId }: { platformId?: string }) => {
  const platform = getPlatformMeta(platformId);
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${platform.color}`}>
      {platform.name}
    </span>
  );
};

const ModalityBadges = ({ modalities }: { modalities?: CompareModalities }) => {
  if (!modalities) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          能力类型待补充
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" title={modalities.note}>
      <span className={`rounded border px-2 py-0.5 text-xs font-medium ${
        modalities.multimodal
          ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}>
        {modalities.multimodal ? '支持多模态' : '单模态/专用数据'}
      </span>
      <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        输入：{formatTypes(modalities.input)}
      </span>
      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        输出：{formatTypes(modalities.output)}
      </span>
    </div>
  );
};

const ScoreBar = ({ score }: { score?: number }) => {
  if (!score) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-rose-600" style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={`min-w-10 text-right text-sm font-bold ${scoreTone(score)}`}>{score}</span>
    </div>
  );
};

const ModelRow = ({ model, rankFallback }: { model: CompareModel; rankFallback?: number }) => {
  const score = getScore(model);
  const rank = model.rank ?? rankFallback ?? 0;
  const description = model.why ?? model.bestFor;
  const price = model.priceNote ?? model.pricing;
  const headingId = `compare-card-${toDomId(`${rank}-${model.name}`)}`;

  return (
    <div role="article" data-model-card="true" aria-labelledby={headingId} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <RankBadge rank={rank} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={headingId} className="text-base font-semibold text-slate-950">{model.name}</h4>
            <PlatformBadge platformId={model.platform} />
            {model.tag && (
              <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                {model.tag}
              </span>
            )}
          </div>
          {model.modelId && (
            <div className="mt-1 truncate font-mono text-xs text-slate-500" title={model.modelId}>
              {model.modelId}
            </div>
          )}
          <ModalityBadges modalities={model.modalities} />
          {description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>}
          {price && <p className="mt-2 font-mono text-xs text-emerald-700">{price}</p>}
          <ScoreBar score={score} />
        </div>
      </div>
    </div>
  );
};

export const CompareView = () => {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState<CompareMode>('overall');

  const handleModeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = modeTabs.length - 1;
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    else if (event.key === 'ArrowLeft') nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = lastIndex;
    else return;

    event.preventDefault();
    setActiveMode(modeTabs[nextIndex].id);
    document.getElementById(`compare-tab-${modeTabs[nextIndex].id}`)?.focus();
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchCompareData();
        setData(result);
      } catch (error) {
        console.error('Failed to load compare data:', error);
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
        正在加载对比数据...
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-700">对比数据加载失败，请稍后重试。</div>;
  }

  const overallRanking = data.overallRanking ?? [];
  const functionRanking = data.functionRanking ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">模型对比排序</h2>
            <p className="text-sm text-slate-500">综合评分、类别榜和功能场景榜均显式展示多模态与输入/输出数据类型。</p>
          </div>
          <div className="text-xs text-slate-500">更新：{data.lastUpdated}</div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-sky-950">稳定性评分</h3>
            <p className="text-sm leading-relaxed text-sky-800">{data.methodology.stabilityScoring}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-emerald-950">性价比评分</h3>
            <p className="text-sm leading-relaxed text-emerald-800">{data.methodology.valueScoring}</p>
          </div>
        </div>
        <div aria-label="对比模式" role="tablist" className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1">
          {modeTabs.map((tab, index) => (
            <button
              id={`compare-tab-${tab.id}`}
              key={tab.id}
              type="button"
              role="tab"
              data-compare-tab="true"
              aria-selected={activeMode === tab.id}
              aria-controls={`compare-panel-${tab.id}`}
              tabIndex={activeMode === tab.id ? 0 : -1}
              onClick={() => setActiveMode(tab.id)}
              onKeyDown={(event) => handleModeKeyDown(event, index)}
              className={`min-w-32 flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeMode === tab.id
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeMode === 'overall' && (
        <section id="compare-panel-overall" role="tabpanel" aria-labelledby="compare-tab-overall" className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-950">综合 TOP {overallRanking.length}</h3>
            <p className="mt-1 text-sm text-slate-500">跨平台综合排序，适合先快速缩小候选模型范围。</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {overallRanking.map((model, index) => (
              <ModelRow key={`${model.name}-${index}`} model={model} rankFallback={index + 1} />
            ))}
          </div>
        </section>
      )}

      {activeMode === 'category' && (
        <section id="compare-panel-category" role="tabpanel" aria-labelledby="compare-tab-category" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-950">按类别对比</h3>
            <p className="mt-1 text-sm text-slate-500">同一模型可能在多个类别上榜，建议结合价格、上下文和输入/输出类型一起看。</p>
          </div>
          {data.categories.map((category) => (
            <div key={category.categoryId} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-950">{category.categoryName}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{category.summary}</p>
                </div>
                <span className="w-fit rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  胜出方：{category.winner}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {category.models.map((model, index) => (
                  <ModelRow key={`${category.categoryId}-${model.name}-${index}`} model={model} rankFallback={index + 1} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeMode === 'function' && (
        <section id="compare-panel-function" role="tabpanel" aria-labelledby="compare-tab-function" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-950">按功能排序</h3>
            <p className="mt-1 text-sm text-slate-500">按业务场景筛选候选模型，适合从“我要完成什么任务”倒推选型。</p>
          </div>
          {functionRanking.map((section) => (
            <div key={section.functionId} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-slate-950">{section.functionName}</h4>
                {section.description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.description}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {section.topModels.map((model, index) => (
                  <ModelRow key={`${section.functionId}-${model.name}-${index}`} model={model} rankFallback={index + 1} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
