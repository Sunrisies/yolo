import { useState } from 'react';
import { Space } from '../types';
import './SpaceManager.css';

interface SpaceManagerProps {
  spaces: Space[];
  selectedSpaceId: string | null;
  onSelectSpace: (id: string) => void;
  onAddSpace: (name: string, description: string, image: string | null) => void;
  onDeleteSpace: (id: string) => void;
}

export default function SpaceManager({ spaces, selectedSpaceId, onSelectSpace, onAddSpace, onDeleteSpace }: SpaceManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDesc, setNewSpaceDesc] = useState('');
  const [newSpaceImage, setNewSpaceImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setNewSpaceImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddSpace = () => {
    if (newSpaceName.trim()) {
      onAddSpace(newSpaceName, newSpaceDesc, newSpaceImage);
      setShowAddModal(false);
      setNewSpaceName('');
      setNewSpaceDesc('');
      setNewSpaceImage(null);
    }
  };

  return (
    <div className="space-manager">
      <div className="space-manager-header">
        <h2>空间管理</h2>
        <button className="add-space-btn" onClick={() => setShowAddModal(true)}>
          + 添加空间
        </button>
      </div>
      <div className="space-list">
        {spaces.length === 0 ? (
          <div className="empty-state">
            <p>暂无空间</p>
            <p className="hint">点击上方按钮添加</p>
          </div>
        ) : (
          spaces.map(space => (
            <div
              key={space.id}
              className={`space-item ${selectedSpaceId === space.id ? 'active' : ''}`}
              onClick={() => onSelectSpace(space.id)}
            >
              <div className="space-thumbnail">
                {space.image ? (
                  <img src={space.image} alt={space.name} />
                ) : (
                  <div className="placeholder">📷</div>
                )}
              </div>
              <div className="space-info">
                <div className="space-name">{space.name}</div>
                {space.description && (
                  <div className="space-desc">{space.description}</div>
                )}
              </div>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('确定删除此空间？相关标记也会被删除。')) {
                    onDeleteSpace(space.id);
                  }
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加空间</h3>
            <div className="form-group">
              <label>空间名称 *</label>
              <input
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="例如：1楼大厅"
              />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea
                value={newSpaceDesc}
                onChange={(e) => setNewSpaceDesc(e.target.value)}
                placeholder="可选"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>实景图</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
              {newSpaceImage && (
                <img src={newSpaceImage} className="preview-img" alt="预览" />
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>取消</button>
              <button className="primary" onClick={handleAddSpace}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
