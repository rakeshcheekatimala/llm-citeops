import fs from 'fs';
import path from 'path';
import { AnswerlintConfig, DEFAULT_WEIGHTS } from '../types/index.js';

const DEFAULT_CONFIG: AnswerlintConfig = {
  audit: {
    aeo_weight: 0.5,
    geo_weight: 0.5,
    custom_weights: { ...DEFAULT_WEIGHTS },
  },
  probe: {
    enabled: false,
    models: ['gpt4o', 'claude'],
    cache_ttl_days: 7,
  },
  ci: {
    threshold: 70,
    fail_on_drop: true,
  },
};

export function loadConfig(configPath?: string): AnswerlintConfig {
  const searchPaths = [
    configPath,
    path.join(process.cwd(), '.answerlint.json'),
    path.join(process.env.HOME ?? '', '.answerlint.json'),
  ].filter(Boolean) as string[];

  let fileConfig: Partial<AnswerlintConfig> = {};

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        fileConfig = JSON.parse(raw) as Partial<AnswerlintConfig>;
        break;
      } catch {
        throw new Error(`Invalid JSON in config file: ${p}`);
      }
    }
  }

  return mergeConfig(DEFAULT_CONFIG, fileConfig);
}

function mergeConfig(
  defaults: AnswerlintConfig,
  override: Partial<AnswerlintConfig>
): AnswerlintConfig {
  return {
    audit: {
      aeo_weight: override.audit?.aeo_weight ?? defaults.audit.aeo_weight,
      geo_weight: override.audit?.geo_weight ?? defaults.audit.geo_weight,
      custom_weights: {
        ...defaults.audit.custom_weights,
        ...(override.audit?.custom_weights ?? {}),
      },
    },
    probe: {
      enabled: override.probe?.enabled ?? defaults.probe.enabled,
      models: override.probe?.models ?? defaults.probe.models,
      cache_ttl_days:
        override.probe?.cache_ttl_days ?? defaults.probe.cache_ttl_days,
    },
    ci: {
      threshold: override.ci?.threshold ?? defaults.ci.threshold,
      fail_on_drop: override.ci?.fail_on_drop ?? defaults.ci.fail_on_drop,
    },
  };
}

export function getWeight(
  config: AnswerlintConfig,
  auditId: string
): number {
  return (
    config.audit.custom_weights[auditId] ??
    DEFAULT_WEIGHTS[auditId] ??
    1.0
  );
}
