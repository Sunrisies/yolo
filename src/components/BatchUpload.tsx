import { useState, useRef } from 'react';
import { api, ImageResult } from '../services/api';
import './BatchUpload.css';

interface BatchUploadProps {
  onDetectionsComplete: (results: ImageResult[]) => void;
}

export default function BatchUpload({ onDetectionsComplete }: BatchUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setStatus('');
  };

  const startDetection = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus('正在连接...');

    try {
      const health = await api.healthCheck();
      if (!health.model_loaded) {
        throw new Error('模型未加载');
      }

      setStatus('正在处理...');
      setProgress(20);

      const response = await api.detectBatch(files);
      
      setProgress(100);
      setStatus(`处理完成，共检测到 ${response.data.total_detections} 处异常`);
      
      setTimeout(() => {
        onDetectionsComplete(response.data.results);
      }, 500);

    } catch (error) {
      setStatus(`处理失败: ${(error as Error).message}`);
      console.error('Detection error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="batch-upload">
      <div className="upload-header">
        <h2>批量识别</h2>
        <p>上传图片自动检测</p>
      </div>

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <p className="drop-text">拖拽图片到此处或点击上传</p>
        <p className="drop-hint">支持 JPG、PNG 格式</p>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <span>已选择 {files.length} 张图片</span>
            <button className="clear-btn" onClick={clearAll}>清空</button>
          </div>
          <div className="file-items">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                <button className="remove-file" onClick={() => removeFile(index)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {status && (
        <div className={`status-message ${isProcessing ? 'processing' : 'done'}`}>
          {status}
        </div>
      )}

      {isProcessing && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        className="detect-btn"
        onClick={startDetection}
        disabled={files.length === 0 || isProcessing}
      >
        {isProcessing ? '处理中...' : `开始检测 (${files.length}张)`}
      </button>
    </div>
  );
}
