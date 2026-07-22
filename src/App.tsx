import { useState } from 'react';
import './App.css';
import { ImageResult, Detection } from './services/api';
import { ModelProvider } from './contexts/ModelContext';
import ModelSelector from './components/ModelSelector';
import BatchUpload from './components/BatchUpload';
import DetectionResults from './components/DetectionResults';

interface DetectionRecord {
  id: string;
  name: string;
  image: string;
  detections: Detection[];
  createdAt: string;
  totalDetections: number;
}

function App() {
  const [detectionResults, setDetectionResults] = useState<ImageResult[] | null>(null);
  const [records, setRecords] = useState<DetectionRecord[]>(() => {
    const saved = localStorage.getItem('detection_records');
    return saved ? JSON.parse(saved) : [];
  });

  const handleDetectionsComplete = (results: ImageResult[]) => {
    setDetectionResults(results);
  };

  const handleSaveDetections = (spaceData: { name: string; image: string | File; detections: Detection[] }) => {
    const newRecord: DetectionRecord = {
      id: Date.now().toString(),
      name: spaceData.name,
      image: typeof spaceData.image === 'string' ? spaceData.image : spaceData.image.name,
      detections: spaceData.detections,
      createdAt: new Date().toISOString(),
      totalDetections: spaceData.detections.length,
    };
    const updated = [newRecord, ...records];
    setRecords(updated);
    localStorage.setItem('detection_records', JSON.stringify(updated));
    setDetectionResults(null);
  };

  const deleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    localStorage.setItem('detection_records', JSON.stringify(updated));
  };

  return (
    <ModelProvider>
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <h1>大楼维护检测系统</h1>
          </div>
          <div className="header-right">
            <ModelSelector />
          </div>
        </header>

        <main className="app-main">
          <div className="upload-section">
            <BatchUpload onDetectionsComplete={handleDetectionsComplete} />
          </div>

          {records.length > 0 && (
            <section className="records-section">
              <div className="records-header">
                <h2>检测记录</h2>
                <span className="records-count">共 {records.length} 条</span>
              </div>
              <div className="records-grid">
                {records.map(record => (
                  <div key={record.id} className="record-card">
                    <div className="record-card-top">
                      <span className={`record-status ${record.detections.length > 0 ? 'has-damage' : 'no-damage'}`}>
                        {record.detections.length > 0 ? '有破损' : '无破损'}
                      </span>
                      <button
                        className="record-delete-btn"
                        onClick={() => deleteRecord(record.id)}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                    <div className="record-card-body">
                      <h3 className="record-name">{record.name}</h3>
                      <div className="record-meta">
                        <span>{record.detections.length} 处异常</span>
                        <span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      {record.detections.length > 0 && (
                        <div className="record-types">
                          {Array.from(new Set(record.detections.map(d => d.damage_type_name))).map(type => (
                            <span key={type} className="record-type-tag">{type}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        {detectionResults && (
          <DetectionResults
            results={detectionResults}
            onSaveDetections={handleSaveDetections}
            onClose={() => setDetectionResults(null)}
          />
        )}
      </div>
    </ModelProvider>
  );
}

export default App;
