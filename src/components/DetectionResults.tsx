import { useState } from 'react';
import { ImageResult, Detection } from '../services/api';
import './DetectionResults.css';

interface DetectionResultsProps {
  results: ImageResult[];
  onSaveDetections: (spaceData: { name: string; image: File | string; detections: Detection[] }) => void;
  onClose: () => void;
}

export default function DetectionResults({ results, onSaveDetections, onClose }: DetectionResultsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDetections, setSelectedDetections] = useState<Set<string>>(new Set());

  const currentResult = results[selectedIndex];

  const toggleDetection = (id: string) => {
    const newSet = new Set(selectedDetections);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedDetections(newSet);
  };

  const selectAll = () => {
    const allIds = currentResult.detections.map(d => d.id);
    setSelectedDetections(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedDetections(new Set());
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      general: '#10b981',
      moderate: '#f59e0b',
      severe: '#ef4444',
      urgent: '#dc2626'
    };
    return colors[severity] || colors.general;
  };

  const handleSave = () => {
    const detectionsToSave = currentResult.detections.filter(d => 
      selectedDetections.size === 0 || selectedDetections.has(d.id)
    );

    const newSpaceName = `${currentResult.filename.split('.')[0]}`;
    
    onSaveDetections({
      name: newSpaceName,
      image: currentResult.filename,
      detections: detectionsToSave
    });
  };

  return (
    <div className="detection-results-overlay">
      <div className="detection-results">
        <div className="results-header">
          <h2>检测结果</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="results-summary">
          <span>共处理 {results.length} 张图片</span>
          <span>检测到 {results.reduce((sum, r) => sum + r.total_detections, 0)} 处破损</span>
          {currentResult.model_name && (
            <span className="model-info">模型: {currentResult.model_name}</span>
          )}
        </div>

        <div className="results-content">
          <div className="thumbnails">
            {results.map((result, index) => (
              <div
                key={index}
                className={`thumbnail ${index === selectedIndex ? 'active' : ''}`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="thumbnail-badge">{result.total_detections}</div>
                <span>{result.filename}</span>
              </div>
            ))}
          </div>

          <div className="main-preview">
            <div className="preview-image-container">
              {currentResult.overlay_image ? (
                <img 
                  src={`data:image/png;base64,${currentResult.overlay_image}`}
                  alt="Segmentation Result"
                  className="segmentation-image"
                />
              ) : (
                <div className="preview-placeholder">
                  <span>📷 {currentResult.filename}</span>
                  <p className="preview-size">{currentResult.width} × {currentResult.height}</p>
                </div>
              )}
              
              {currentResult.detections.map((det) => (
                <div
                  key={det.id}
                  className="detection-marker"
                  style={{
                    left: `${det.x}%`,
                    top: `${det.y}%`,
                    background: getSeverityColor(det.severity)
                  }}
                />
              ))}
            </div>

            <div className="detections-list">
              <div className="list-header">
                <h3>检测到的破损 ({currentResult.detections.length})</h3>
                <div className="select-actions">
                  <button onClick={selectAll}>全选</button>
                  <button onClick={deselectAll}>取消</button>
                </div>
              </div>

              <div className="detection-items">
                {currentResult.detections.map((det) => (
                  <div
                    key={det.id}
                    className={`detection-item ${selectedDetections.has(det.id) ? 'selected' : ''}`}
                    onClick={() => toggleDetection(det.id)}
                  >
                    <div className="detection-checkbox">
                      {selectedDetections.has(det.id) ? '✓' : ''}
                    </div>
                    <div className="detection-info">
                      <div className="detection-type">
                        <span 
                          className="severity-dot" 
                          style={{ background: getSeverityColor(det.severity) }}
                        />
                        {det.damage_type_name}
                      </div>
                      <div className="detection-details">
                        <span>置信度: {(det.confidence * 100).toFixed(1)}%</span>
                        <span>面积: {(det.mask_area || 0) * 100 > 0.1 ? `${((det.mask_area || 0) * 100).toFixed(1)}%` : '< 0.1%'}</span>
                      </div>
                      <div className="detection-description">
                        {det.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="results-actions">
          <button className="secondary-btn" onClick={onClose}>返回</button>
          <button className="primary-btn" onClick={handleSave}>
            💾 保存选中的检测结果
          </button>
        </div>
      </div>
    </div>
  );
}
