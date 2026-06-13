import type { PlatformData, FreeModelsData, CompareData } from './types';

const PLATFORM_DATA_FILES: Record<string, string> = {
  poyo: 'api-data.json',
  siliconflow: 'siliconflow-data.json',
  bai: 'bai-data.json',
  easyrouter: 'easyrouter-data.json',
};

const dataUrl = (fileName: string) => {
  return new URL(fileName, new URL('.', window.location.href)).toString();
};

export const fetchPlatformData = async (platformId: string): Promise<PlatformData> => {
  const fileName = PLATFORM_DATA_FILES[platformId] ?? `${platformId}-data.json`;
  const response = await fetch(dataUrl(fileName));
  if (!response.ok) {
    throw new Error(`Failed to fetch data for ${platformId}`);
  }
  return response.json();
};

export const fetchFreeModelsData = async (): Promise<FreeModelsData> => {
  const response = await fetch(dataUrl('free-models-data.json'));
  if (!response.ok) {
    throw new Error('Failed to fetch free models data');
  }
  return response.json();
};

export const fetchCompareData = async (): Promise<CompareData> => {
  const response = await fetch(dataUrl('compare-data.json'));
  if (!response.ok) {
    throw new Error('Failed to fetch compare data');
  }
  return response.json();
};

export const VENDORS = [
  { id: 'OpenAI', color: 'bg-blue-100 text-blue-800' },
  { id: 'Anthropic', color: 'bg-orange-100 text-orange-800' },
  { id: 'Google', color: 'bg-blue-100 text-blue-800' },
  { id: 'Kling', color: 'bg-purple-100 text-purple-800' },
  { id: 'Seedream', color: 'bg-green-100 text-green-800' },
  { id: 'Wan', color: 'bg-teal-100 text-teal-800' },
  { id: 'Hailuo', color: 'bg-red-100 text-red-800' },
  { id: 'Runway', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'xAI', color: 'bg-gray-200 text-gray-800' },
  { id: 'Alibaba', color: 'bg-orange-100 text-orange-800' },
  { id: 'MiniMax', color: 'bg-green-100 text-green-800' },
  { id: 'DeepSeek', color: 'bg-green-100 text-green-800' },
  { id: 'Moonshot', color: 'bg-indigo-100 text-indigo-800' },
];

export const getVendorColor = (vendorName: string): string => {
  const vendor = VENDORS.find((v) => v.id.toLowerCase() === vendorName.toLowerCase());
  return vendor ? vendor.color : 'bg-gray-100 text-gray-800';
};

export const PLATFORMS = [
  { id: 'siliconflow', name: '硅基流动', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'poyo', name: 'PoYo.ai', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'bai', name: 'BAI', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'easyrouter', name: 'EasyRouter', color: 'bg-sky-50 text-sky-700 border-sky-200' },
];

export const getPlatformMeta = (platformId?: string) => {
  const platform = PLATFORMS.find((item) => item.id === platformId);
  return platform ?? { id: platformId ?? 'unknown', name: platformId ?? '未知平台', color: 'bg-gray-50 text-gray-700 border-gray-200' };
};
