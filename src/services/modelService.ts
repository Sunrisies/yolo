const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** 单个模型信息 */
export interface ModelInfo {
  name: string;
  path: string;
  type: 'segmentation' | 'detection' | 'unknown';
  size_bytes: number;
}

/** 当前模型信息 */
export interface CurrentModelInfo {
  name: string;
  path: string;
  type: string;
  loaded: boolean;
}

/** 模型列表响应 */
export interface ModelsResponse {
  success: boolean;
  data: {
    models: ModelInfo[];
    current: string;
    total: number;
  };
}

/** 当前模型响应 */
export interface CurrentModelResponse {
  success: boolean;
  data: CurrentModelInfo;
}

/** 切换模型响应 */
export interface SwitchModelResponse {
  success: boolean;
  data: {
    name: string;
    type: string;
    loaded: boolean;
  };
  message: string;
}

/** 模型切换错误 */
export class ModelSwitchError extends Error {
  constructor(
    message: string,
    public code: 'LOAD_FAILED' | 'NOT_FOUND' | 'INVALID_PATH' | 'NETWORK_ERROR'
  ) {
    super(message);
    this.name = 'ModelSwitchError';
  }
}

export const modelService = {
  /** 获取所有可用模型列表 */
  async getModels(): Promise<ModelsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/models`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: '获取模型列表失败' }));
      throw new ModelSwitchError(
        errorBody.detail || '获取模型列表失败',
        'NETWORK_ERROR'
      );
    }
    return response.json();
  },

  /** 获取当前模型信息 */
  async getCurrentModel(): Promise<CurrentModelResponse> {
    const response = await fetch(`${API_BASE_URL}/api/models/current`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new ModelSwitchError('获取当前模型信息失败', 'NETWORK_ERROR');
    }
    return response.json();
  },

  /** 切换模型 */
  async switchModel(modelName: string): Promise<SwitchModelResponse> {
    if (!modelName || typeof modelName !== 'string') {
      throw new ModelSwitchError('模型名称不能为空', 'INVALID_PATH');
    }

    const response = await fetch(`${API_BASE_URL}/api/models/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = responseData?.detail || `模型切换失败: ${modelName}`;
      
      if (response.status === 404) {
        throw new ModelSwitchError(detail, 'NOT_FOUND');
      } else if (response.status === 400) {
        throw new ModelSwitchError(detail, 'INVALID_PATH');
      } else {
        throw new ModelSwitchError(detail, 'LOAD_FAILED');
      }
    }

    return responseData;
  },

  /** 格式化文件大小 */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  },

  /** 获取模型类型的中文标签 */
  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'segmentation': '实例分割',
      'detection': '目标检测',
      'unknown': '未知类型',
    };
    return labels[type] || type;
  },
};
