/**
 * 应用配置
 */
export interface AppConfig {
  /** API 密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 温度参数 (0-2) */
  temperature: number;
  /** 最大 Token 数 */
  maxTokens: number;
  /** API 基础 URL */
  baseUrl: string;
}

/**
 * API 请求配置
 */
export interface APIConfig extends AppConfig {
  /** 是否启用流式响应 */
  stream: boolean;
}

/**
 * 可用模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 模型描述 */
  description?: string;
  /** 最大上下文长度 */
  maxContext?: number;
}

/**
 * SiliconFlow 平台支持的模型列表
 */
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'DeepSeek 最新模型，性能强大',
    maxContext: 64000,
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    description: '通义千问大模型',
    maxContext: 32000,
  },
  {
    id: 'Qwen/Qwen2.5-32B-Instruct',
    name: 'Qwen 2.5 32B',
    description: '通义千问中等规模模型',
    maxContext: 32000,
  },
];

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: 0.7,
  maxTokens: 2048,
  baseUrl: 'https://api.siliconflow.com/v1',
};

/**
 * 配置验证结果
 */
export interface ConfigValidation {
  isValid: boolean;
  errors: {
    apiKey?: string;
    temperature?: string;
    maxTokens?: string;
  };
}
