import { useState, useEffect } from 'react';
import { CompareData } from '../types';
import { fetchCompareData, getVendorColor } from '../data';

export const CompareView = () => {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchCompareData();
        setData(result);
      } catch (error) {
        console.error('Failed to load compare data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  if (!data) return <div className="text-center p-12 text-red-500">Failed to load data</div>;

  return (
    <div className="space-y-12">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Methodology</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2">Stability Scoring</h3>
            <p>{data.methodology.stabilityScoring}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <h3 className="font-semibold text-green-900 mb-2">Value Scoring</h3>
            <p>{data.methodology.valueScoring}</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500 text-right">Last updated: {data.lastUpdated}</div>
      </div>

      {data.categories.map((category) => (
        <div key={category.categoryId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{category.categoryName}</h2>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full uppercase tracking-wider">
                Winner: {category.winner}
              </span>
            </div>
            <p className="text-gray-600">{category.summary}</p>
          </div>
          
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-semibold w-16">Rank</th>
                    <th className="pb-3 pr-4 font-semibold">Model</th>
                    <th className="pb-3 pr-4 font-semibold hidden md:table-cell">Platform</th>
                    <th className="pb-3 pr-4 font-semibold hidden lg:table-cell">Context</th>
                    <th className="pb-3 pr-4 font-semibold">Score</th>
                    <th className="pb-3 pr-4 font-semibold">Pricing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {category.models.map((model) => (
                    <tr key={model.modelId} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 pr-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${model.rank === 1 ? 'bg-yellow-100 text-yellow-700' : model.rank === 2 ? 'bg-gray-200 text-gray-700' : model.rank === 3 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-500'}`}>
                          {model.rank}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-bold text-gray-900 text-lg mb-1">{model.name}</div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getVendorColor(model.vendor)}`}>{model.vendor}</span>
                          <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]" title={model.modelId}>{model.modelId}</span>
                        </div>
                        <div className="text-sm text-gray-600 line-clamp-1">{model.bestFor}</div>
                      </td>
                      <td className="py-4 pr-4 hidden md:table-cell">
                        <span className="font-medium text-gray-800">{model.platformName}</span>
                      </td>
                      <td className="py-4 pr-4 hidden lg:table-cell text-sm text-gray-600">
                        {model.context}
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-2xl font-black text-gray-900">{model.overallScore}</div>
                          <div className="text-xs text-gray-500">/ 100</div>
                        </div>
                        <div className="flex gap-1 text-xs">
                          <span title={model.stabilityReason} className="cursor-help px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                            Stab: {model.stability}/5
                          </span>
                          <span title={model.valueReason} className="cursor-help px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100">
                            Val: {model.valueScore}/5
                          </span>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-sm">
                        <div className="font-medium text-gray-900">{model.priceNote}</div>
                        <div className="mt-2 space-y-1">
                          {model.pros.slice(0, 2).map((pro, idx) => (
                            <div key={idx} className="flex items-start gap-1 text-green-700 text-xs">
                              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              <span className="line-clamp-1">{pro}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

