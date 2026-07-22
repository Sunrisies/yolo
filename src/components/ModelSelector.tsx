import { useState, useRef, useEffect, useCallback } from 'react';
import { useModel } from '../contexts/ModelContext';
import { modelService } from '../services/modelService';
import './ModelSelector.css';

export default function ModelSelector() {
  const {
    models,
    currentModel,
    isLoadingList,
    isSwitching,
    error,
    successMessage,
    switchModel,
    clearError,
    clearSuccessMessage,
    refreshModels,
  } = useModel();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 自动清除错误和成功提示
  useEffect(() => {
    if (error) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => clearError(), 8000);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [error, clearError]);

  useEffect(() => {
    if (successMessage) {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => clearSuccessMessage(), 4000);
    }
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [successMessage, clearSuccessMessage]);

  const handleSelect = useCallback(async (modelName: string) => {
    setIsOpen(false);
    await switchModel(modelName);
  }, [switchModel]);

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'segmentation': return 'S';
      case 'detection': return 'D';
      default: return 'M';
    }
  };

  const getStatusColor = (loaded: boolean): string => {
    return loaded ? '#10b981' : '#ef4444';
  };

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        className="model-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        title={`当前模型: ${currentModel?.name || '未加载'}`}
      >
        <span className="model-trigger-icon">
          {isSwitching ? '⏳' : getTypeIcon(currentModel?.type || '')}
        </span>
        <span className="model-trigger-text">
          {isSwitching
            ? '切换中...'
            : currentModel?.name
              ? currentModel.name
              : '选择模型'}
        </span>
        <span
          className="model-status-dot"
          style={{ background: getStatusColor(currentModel?.loaded ?? false) }}
        />
        <span className={`model-arrow ${isOpen ? 'open' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div className="model-dropdown">
          <div className="dropdown-header">
            <span>可用模型 ({models.length})</span>
            <button
              className="refresh-btn"
              onClick={refreshModels}
              disabled={isLoadingList}
              title="刷新模型列表"
            >
              {isLoadingList ? '⟳' : '↻'}
            </button>
          </div>

          {isLoadingList && models.length === 0 ? (
            <div className="dropdown-loading">加载模型中...</div>
          ) : models.length === 0 ? (
            <div className="dropdown-empty">
              <p>暂无可用模型</p>
              <p className="dropdown-empty-hint">请将 .pt 模型文件放入 models/ 目录</p>
            </div>
          ) : (
            <ul className="dropdown-list">
              {models.map((m) => {
                const isActive = currentModel?.name === m.name;
                return (
                  <li
                    key={m.name}
                    className={`dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => !isActive && handleSelect(m.name)}
                  >
                    <span className="item-icon">{getTypeIcon(m.type)}</span>
                    <div className="item-info">
                      <span className="item-name">
                        {m.name}
                        {isActive && <span className="item-badge">当前</span>}
                      </span>
                      <span className="item-meta">
                        {modelService.getTypeLabel(m.type)} · {modelService.formatSize(m.size_bytes)}
                      </span>
                    </div>
                    {isActive && <span className="item-check">✓</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="model-toast model-toast-error">
          <span>{error}</span>
          <button className="toast-close" onClick={clearError}>×</button>
        </div>
      )}

      {/* 成功提示 */}
      {successMessage && (
        <div className="model-toast model-toast-success">
          <span>{successMessage}</span>
          <button className="toast-close" onClick={clearSuccessMessage}>×</button>
        </div>
      )}
    </div>
  );
}
