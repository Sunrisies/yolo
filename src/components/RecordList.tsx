import { useState, useMemo } from 'react';
import { Marker, Space, DAMAGE_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_COLORS, STATUS_LABELS } from '../types';
import './RecordList.css';

interface RecordListProps {
  markers: Marker[];
  spaces: Space[];
  selectedMarkerId: string | null;
  onSelectMarker: (id: string) => void;
}

export default function RecordList({ markers, spaces, selectedMarkerId, onSelectMarker }: RecordListProps) {
  const [searchText, setSearchText] = useState('');
  const [filterSpace, setFilterSpace] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredMarkers = useMemo(() => {
    return markers.filter(m => {
      const matchesSearch = !searchText || 
        m.description.toLowerCase().includes(searchText.toLowerCase()) ||
        (m.customDamageType?.toLowerCase().includes(searchText.toLowerCase())) ||
        DAMAGE_TYPE_LABELS[m.damageType]?.includes(searchText);
      
      const matchesSpace = !filterSpace || m.spaceId === filterSpace;
      const matchesType = !filterType || m.damageType === filterType;
      const matchesSeverity = !filterSeverity || m.severity === filterSeverity;
      const matchesStatus = !filterStatus || m.status === filterStatus;
      
      const discoveredAt = new Date(m.discoveredAt);
      const matchesFrom = !dateFrom || discoveredAt >= new Date(dateFrom);
      const matchesTo = !dateTo || discoveredAt <= new Date(dateTo + 'T23:59:59');

      return matchesSearch && matchesSpace && matchesType && matchesSeverity && matchesStatus && matchesFrom && matchesTo;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [markers, searchText, filterSpace, filterType, filterSeverity, filterStatus, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearchText('');
    setFilterSpace('');
    setFilterType('');
    setFilterSeverity('');
    setFilterStatus('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="record-list">
      <div className="list-header">
        <h2>破损记录</h2>
        <span className="count">{filteredMarkers.length} 条</span>
      </div>

      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索描述或类型..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="filter-row">
          <select value={filterSpace} onChange={(e) => setFilterSpace(e.target.value)}>
            <option value="">全部空间</option>
            {spaces.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">全部类型</option>
            {Object.entries(DAMAGE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="filter-row">
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="">全部等级</option>
            {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="filter-row">
          <input
            type="date"
            placeholder="开始日期"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            placeholder="结束日期"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <button className="reset-btn" onClick={resetFilters}>重置筛选</button>
      </div>

      <div className="records-container">
        {filteredMarkers.length === 0 ? (
          <div className="empty-list">
            <p>暂无匹配的记录</p>
          </div>
        ) : (
          filteredMarkers.map(marker => {
            const space = spaces.find(s => s.id === marker.spaceId);
            return (
              <div
                key={marker.id}
                className={`record-item ${selectedMarkerId === marker.id ? 'selected' : ''}`}
                onClick={() => onSelectMarker(marker.id)}
              >
                <div className="record-top">
                  <div className="record-title">
                    <span className="type-badge">
                      {marker.customDamageType || DAMAGE_TYPE_LABELS[marker.damageType]}
                    </span>
                    <span className="space-name">{space?.name || '未知空间'}</span>
                  </div>
                  <div className="record-badges">
                    <span className="severity-dot" style={{ background: SEVERITY_COLORS[marker.severity] }} />
                    <span className="status-badge">{STATUS_LABELS[marker.status]}</span>
                  </div>
                </div>
                {marker.description && (
                  <div className="record-desc">{marker.description}</div>
                )}
                <div className="record-meta">
                  <span>📅 {new Date(marker.discoveredAt).toLocaleDateString('zh-CN')}</span>
                  <span>📍 ({marker.x.toFixed(1)}, {marker.y.toFixed(1)})</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
