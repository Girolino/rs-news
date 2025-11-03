import { loadEnv } from "@/config/env";

export type ChannelFeatures = {
  commentary?: boolean;
  chartImg?: boolean;
};

export type ChannelThresholds = {
  maxNewsPerRun?: number;
  relevanceThreshold?: number;
  dedupSimilarityThreshold?: number;
  simhashDistanceThreshold?: number;
};

export type ChannelDiscoverySettings = {
  additionalTopics?: string[];
  whitelist?: string[];
};

export type ChannelFilters = {
  allowedTickers?: string[];
  allowedCategories?: string[];
};

export type ChannelConfig = {
  id: string;
  label: string;
  chatId: string;
  discovery?: ChannelDiscoverySettings;
  thresholds?: ChannelThresholds;
  filters?: ChannelFilters;
  features?: ChannelFeatures;
};

const env = loadEnv();

export const CHANNELS: ChannelConfig[] = [
  {
    id: "default",
    label: "RS News BR",
    chatId: env.TELEGRAM_CHAT_ID,
  },
];
