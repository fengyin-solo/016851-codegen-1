import { create } from 'zustand';
import type { AppConfig, ConfigValidation } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { saveConfig, loadConfig } from '../services/storage';
import { validateConfig, validateAPIKey, validateTemperature, validateMaxTokens } from '../utils/validators';

interface ConfigState {
  /** 当前配置 */
  config: AppConfig;
  /** 配置是否有效 */
  isValid: boolean;
  /** 验证错误信息 */
  errors: ConfigValidation['errors'];
  /** 是否已初始化 */
  initialized: boolean;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 更新配置 */
  updateConfig: (updates: Partial<AppConfig>) => void;
  /** 验证当前配置 */
  validateCurrentConfig: () => boolean;
  /** 重置为默认配置 */
  resetConfig: () => void;
  /** 设置 API Key */
  setAPIKey: (apiKey: string) => void;
  /** 设置模型 */
  setModel: (model: string) => void;
  /** 设置 temperature */
  setTemperature: (temperature: number) => void;
  /** 设置 maxTokens */
  setMaxTokens: (maxTokens: number) => void;
}

type ConfigStore = ConfigState & ConfigActions;

export const useConfigStore = create<ConfigStore>((set, get) => ({
  // Initial state
  config: DEFAULT_CONFIG,
  isValid: false,
  errors: {},
  initialized: false,

  // Actions
  initConfig: () => {
    const loadedConfig = loadConfig();
    const validation = validateConfig(loadedConfig);
    
    set({
      config: loadedConfig,
      isValid: validation.isValid && validateAPIKey(loadedConfig.apiKey),
      errors: validation.errors,
      initialized: true,
    });
  },

  updateConfig: (updates) => {
    const { config } = get();
    const newConfig = { ...config, ...updates };
    const validation = validateConfig(newConfig);
    
    // 保存到 localStorage
    try {
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
    
    set({
      config: newConfig,
      isValid: validation.isValid && validateAPIKey(newConfig.apiKey),
      errors: validation.errors,
    });
  },

  validateCurrentConfig: () => {
    const { config } = get();
    const validation = validateConfig(config);
    const isValid = validation.isValid && validateAPIKey(config.apiKey);
    
    set({
      isValid,
      errors: validation.errors,
    });
    
    return isValid;
  },

  resetConfig: () => {
    try {
      saveConfig(DEFAULT_CONFIG);
    } catch (error) {
      console.error('Failed to save default config:', error);
    }
    
    set({
      config: DEFAULT_CONFIG,
      isValid: false,
      errors: {},
    });
  },

  setAPIKey: (apiKey) => {
    const { updateConfig } = get();
    updateConfig({ apiKey });
  },

  setModel: (model) => {
    const { updateConfig } = get();
    updateConfig({ model });
  },

  setTemperature: (temperature) => {
    if (validateTemperature(temperature)) {
      const { updateConfig } = get();
      updateConfig({ temperature });
    }
  },

  setMaxTokens: (maxTokens) => {
    if (validateMaxTokens(maxTokens)) {
      const { updateConfig } = get();
      updateConfig({ maxTokens });
    }
  },
}));
