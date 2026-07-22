import { useState, useEffect } from 'react';
import { Marker, DAMAGE_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_COLORS, STATUS_LABELS } from '../types';
import './MarkerSidebar.css';

interface MarkerSidebarProps {
  marker: Marker | undefined;
  onUpdateMarker: (updates: Partial<Marker>) => void;
  onDeleteMarker: () => void;
}

export default function MarkerSidebar({ marker, onUpdateMarker, onDeleteMarker }: MarkerSidebarProps) {
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (marker) {
      setPhotos(marker.photos || []);
    }
  }, [marker?.id]);

  if (!marker) {
    return (
      <div className="marker-sidebar">
        <div className="sidebar-header">
          <h2>破损详情</h2>
        </div>
        <div className="sidebar-empty">
          <div className="empty-icon">📍</div>
          <p>请选择一个标记点</p>
          <p className="hint">或点击添加标记创建新记录</p>
        </div>
      </div>
    );
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newPhotos = [...photos, e.target?.result as string];
        setPhotos(newPhotos);
        onUpdateMarker({ photos: newPhotos });
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onUpdateMarker({ photos: newPhotos });
  };

  return (
    <div className="marker-sidebar">
      <div className="sidebar-header">
        <h2>破损详情</h2>
        <div className="severity-badge" style={{ background: SEVERITY_COLORS[marker.severity] }}>
          {SEVERITY_LABELS[marker.severity]}
        </div>
      </div>

      <div className="sidebar-content">
        <div className="form-group">
          <label>破损类型</label>
          <select
            value={marker.damageType}
            onChange={(e) => onUpdateMarker({ damageType: e.target.value as any })}
          >
            {Object.entries(DAMAGE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {marker.damageType === 'custom' && (
          <div className="form-group">
            <label>自定义类型名称</label>
            <input
              type="text"
              value={marker.customDamageType || ''}
              onChange={(e) => onUpdateMarker({ customDamageType: e.target.value })}
              placeholder="请输入自定义破损类型"
            />
          </div>
        )}

        <div className="form-group">
          <label>严重等级</label>
          <select
            value={marker.severity}
            onChange={(e) => onUpdateMarker({ severity: e.target.value as any })}
          >
            {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>处理状态</label>
          <select
            value={marker.status}
            onChange={(e) => onUpdateMarker({ status: e.target.value as any })}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>发现时间</label>
          <input
            type="datetime-local"
            value={new Date(marker.discoveredAt).toISOString().slice(0, 16)}
            onChange={(e) => onUpdateMarker({ discoveredAt: new Date(e.target.value).toISOString() })}
          />
        </div>

        <div className="form-group">
          <label>破损描述</label>
          <textarea
            value={marker.description}
            onChange={(e) => onUpdateMarker({ description: e.target.value })}
            placeholder="详细描述破损情况..."
            rows={6}
          />
        </div>

        <div className="form-group">
          <label>现场照片</label>
          <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} />
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img src={photo} alt={`现场照片 ${index + 1}`} />
                <button className="remove-photo" onClick={() => removePhoto(index)}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group meta-info">
          <div className="meta-item">
            <span className="label">坐标：</span>
            <span>({marker.x.toFixed(2)}, {marker.y.toFixed(2)})</span>
          </div>
          <div className="meta-item">
            <span className="label">创建时间：</span>
            <span>{new Date(marker.createdAt).toLocaleString('zh-CN')}</span>
          </div>
        </div>

        <button className="delete-marker-btn" onClick={onDeleteMarker}>
          删除此标记
        </button>
      </div>
    </div>
  );
}
