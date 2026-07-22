import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  modelService,
  ModelInfo,
  CurrentModelInfo,
  ModelSwitchError,
} from '../services/modelService';

// --- 类型定义 ---

export interface ModelContextType {
  /** 可用模型列表 */
  models: ModelInfo[];
  /** 当前选中的模型信息 */
  currentModel: CurrentModelInfo | null;
  /** 是否正在加载模型列表 */
  isLoadingList: boolean;
  /** 是否正在切换模型 */
  isSwitching: boolean;
  /** 错误信息 */
  error: string | null;
  /** 成功提示信息 */
  successMessage: string | null;
  /** 刷新模型列表 */
  refreshModels: () => Promise<void>;
  /** 切换模型 */
  switchModel: (modelName: string) => Promise<boolean>;
  /** 清除错误 */
  clearError: () => void;
  /** 清除成功提示 */
  clearSuccessMessage: () => void;
}

// --- 常量 ---

const STORAGE_KEY = 'building_maintenance_selected_model';

// --- Context ---

const ModelContext = createContext<ModelContextType | null>(null);

// --- Provider ---

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<CurrentModelInfo | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 保存上次成功加载的模型名称，用于回滚
  const lastSuccessfulModel = useRef<string | null>(null);

  /** 获取模型列表和当前模型 */
  const refreshModels = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const [modelsRes, currentRes] = await Promise.all([
        modelService.getModels(),
        modelService.getCurrentModel(),
      ]);
      setModels(modelsRes.data.models);
      setCurrentModel(currentRes.data);
      if (currentRes.data.name) {
        lastSuccessfulModel.current = currentRes.data.name;
      }
    } catch (err) {
      const msg = err instanceof ModelSwitchError
        ? err.message
        : '无法连接后端服务，请检查服务是否已启动';
      setError(msg);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  /** 清除错误 */
  const clearError = useCallback(() => setError(null), []);

  /** 清除成功提示 */
  const clearSuccessMessage = useCallback(() => setSuccessMessage(null), []);

  /** 切换模型 */
  const switchModel = useCallback(async (modelName: string): Promise<boolean> => {
    if (isSwitching) return false;
    if (!modelName) {
      setError('模型名称不能为空');
      return false;
    }
    if (currentModel?.name === modelName) {
      return true; // 已经是当前模型，视为成功
    }

    setIsSwitching(true);
    setError(null);
    setSuccessMessage(null);

    // 记录旧模型用于回滚
    const oldModelName = currentModel?.name || lastSuccessfulModel.current;

    try {
      const result = await modelService.switchModel(modelName);
      if (result.success) {
        setCurrentModel({
          name: result.data.name,
          path: '',
          type: result.data.type,
          loaded: result.data.loaded,
        });
        lastSuccessfulModel.current = result.data.name;
        // 持久化到 localStorage
        localStorage.setItem(STORAGE_KEY, result.data.name);
        setSuccessMessage(result.message || `模型切换成功: ${modelName}`);
        return true;
      }
      return false;
    } catch (err) {
      let errorMsg: string;
      if (err instanceof ModelSwitchError) {
        errorMsg = err.message;
      } else if (err instanceof TypeError) {
        errorMsg = '网络连接失败，请检查后端服务是否正常运行';
      } else {
        errorMsg = '模型切换失败，请稍后重试';
      }

      // 尝试回滚
      if (oldModelName && oldModelName !== modelName) {
        try {
          const rollbackResult = await modelService.switchModel(oldModelName);
          if (rollbackResult.success) {
            setCurrentModel({
              name: rollbackResult.data.name,
              path: '',
              type: rollbackResult.data.type,
              loaded: rollbackResult.data.loaded,
            });
            errorMsg += `，已自动回滚至模型：${oldModelName}`;
          }
        } catch {
          errorMsg += '，回滚失败，请手动刷新页面';
        }
      }

      setError(errorMsg);
      return false;
    } finally {
      setIsSwitching(false);
    }
  }, [currentModel, isSwitching]);

  /** 初始化：加载模型列表，并尝试恢复上次选择的模型 */
  useEffect(() => {
    const init = async () => {
      await refreshModels();

      // 检查 localStorage 中是否有上次选择的模型
      const savedModelName = localStorage.getItem(STORAGE_KEY);
      if (savedModelName) {
        try {
          const currentRes = await modelService.getCurrentModel();
          // 如果当前模型不是上次保存的模型，且可用列表中有该模型，则切换
          if (currentRes.data.name !== savedModelName) {
            const modelsRes = await modelService.getModels();
            const modelExists = modelsRes.data.models.some(m => m.name === savedModelName);
            if (modelExists) {
              await modelService.switchModel(savedModelName);
              const updatedCurrent = await modelService.getCurrentModel();
              setCurrentModel(updatedCurrent.data);
              lastSuccessfulModel.current = updatedCurrent.data.name;
            }
          }
        } catch {
          // 恢复失败则保持当前模型，不清除 localStorage 以便重试
        }
      }
    };
    init();
  }, [refreshModels]);

  const value: ModelContextType = {
    models,
    currentModel,
    isLoadingList,
    isSwitching,
    error,
    successMessage,
    refreshModels,
    switchModel,
    clearError,
    clearSuccessMessage,
  };

  return (
    <ModelContext.Provider value={value}>
      {children}
    </ModelContext.Provider>
  );
}

/** 使用模型上下文 */
export function useModel(): ModelContextType {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
