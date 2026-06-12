export interface ModelVariant {
  modelId: string;
  name: string;
  vendor: string;
  type?: string;
  pricing?: string;
  docsUrl?: string;
  curlExample?: string;
  capabilities?: string[];
  variants?: string[];
  input?: Record<string, string>;
  notes?: string;
  output?: string;
  context?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  auth: string;
  commonParams: Record<string, string>;
  models: ModelVariant[];
}

export interface PlatformData {
  platform: string;
  platformName: string;
  platformUrl: string;
  docsUrl: string;
  apiOverview: {
    baseUrl: string;
    authentication: {
      type: string;
      header: string;
      note: string;
    };
    architecture?: string;
    asyncModels?: string;
    syncModels?: string;
  };
  categories: Category[];
}

export interface FreeModel {
  rank: number;
  modelId: string;
  name: string;
  vendor: string;
  baseModel: string;
  type: string;
  architecture: string;
  parameters: {
    total: string;
    experts?: number;
    activePerToken?: string;
  };
  context: string;
  capabilities: string[];
  license: string;
  huggingface: string;
  notes: string;
  output: string;
  install: string;
  baseModelUrl: string;
  diskSize: string;
  ramUsage: string;
  speed: string;
  requirements: string;
  quantization?: {
    method?: string;
    via?: string;
    recommended?: string;
    available?: string[];
    recommendedSize?: string;
    technique?: string;
    groupSize?: number;
    calibration?: string;
  };
  sampler?: {
    chat?: string;
    reasoning?: string;
    vision?: string;
    thinking?: string;
  };
  usage: string;
  paper?: string;
  ollamaUrl?: string;
}

export interface FreeModelsData {
  categoryId: string;
  categoryName: string;
  nameEn: string;
  description: string;
  models: FreeModel[];
}

export type CompareDataType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "music"
  | "speech"
  | "embedding"
  | "ranking"
  | "3d";

export interface CompareModalities {
  multimodal: boolean;
  input: CompareDataType[];
  output: CompareDataType[];
  note: string;
}

export interface CompareModel {
  rank: number;
  name: string;
  modelId?: string;
  platform: string;
  platformName?: string;
  vendor?: string;
  category?: string;
  capabilities?: string[];
  context?: string;
  inputPrice?: number;
  outputPrice?: number;
  priceNote?: string;
  stability?: number;
  stabilityReason?: string;
  valueScore?: number;
  valueReason?: string;
  overallScore?: number;
  score?: number;
  tag?: string;
  why?: string;
  pricing?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
  docsUrl?: string;
  modalities?: CompareModalities;
}

export interface CompareCategory {
  categoryId: string;
  categoryName: string;
  icon: string;
  winner: string;
  summary: string;
  models: CompareModel[];
}

export interface CompareFunctionRanking {
  functionId: string;
  functionName: string;
  icon: string;
  description?: string;
  topModels: CompareModel[];
}

export interface CompareData {
  lastUpdated: string;
  methodology: {
    stabilityScoring: string;
    valueScoring: string;
  };
  categories: CompareCategory[];
  overallRanking: CompareModel[];
  functionRanking: CompareFunctionRanking[];
}
