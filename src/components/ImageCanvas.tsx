import { useRef, useState, useEffect } from 'react';
import { Space, Marker, SEVERITY_COLORS } from '../types';
import './ImageCanvas.css';

interface ImageCanvasProps {
  space: Space | undefined;
  markers: Marker[];
  selectedMarkerId: string | null;
  isAddingMarker: boolean;
  onAddMarker: (x: number, y: number) => void;
  onSelectMarker: (id: string) => void;
  onUpdateMarker: (id: string, updates: Partial<Marker>) => void;
  onToggleAddMarker: (val: boolean) => void;
}

export default function ImageCanvas({
  space,
  markers,
  selectedMarkerId,
  isAddingMarker,
  onAddMarker,
  onSelectMarker,
  onUpdateMarker,
  onToggleAddMarker,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

  useEffect(() => {
    if (imgRef.current) {
      const updateSize = () => {
        if (imgRef.current) {
          setImgSize({ width: imgRef.current.offsetWidth, height: imgRef.current.offsetHeight });
        }
      };
      imgRef.current.onload = updateSize;
      if (imgRef.current.complete) updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [space?.image]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingMarker || !containerRef.current || !imgRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const imgRect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      onAddMarker(x, y);
    }
  };

  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    setDraggingMarkerId(markerId);
    onSelectMarker(markerId);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingMarkerId || !containerRef.current || !imgRef.current) return;
      const imgRect = imgRef.current.getBoundingClientRect();
      let x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
      let y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      onUpdateMarker(draggingMarkerId, { x, y });
    };

    const handleMouseUp = () => {
      setDraggingMarkerId(null);
    };

    if (draggingMarkerId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMarkerId, onUpdateMarker]);

  return (
    <div className="image-canvas">
      <div className="canvas-toolbar">
        <button
          className={`toolbar-btn ${isAddingMarker ? 'active' : ''}`}
          onClick={() => onToggleAddMarker(!isAddingMarker)}
        >
          {isAddingMarker ? '✓ 标记模式' : '📍 添加标记'}
        </button>
      </div>
      <div
        className="canvas-container"
        ref={containerRef}
        onClick={handleCanvasClick}
        style={{ cursor: isAddingMarker ? 'crosshair' : 'default' }}
      >
        {space?.image ? (
          <>
            <img ref={imgRef} src={space.image} alt={space.name} className="space-image" />
            {markers.map(marker => (
              <div
                key={marker.id}
                className={`marker-pin ${selectedMarkerId === marker.id ? 'selected' : ''}`}
                style={{
                  left: `calc(${marker.x}% - 16px)`,
                  top: `calc(${marker.y}% - 32px)`,
                  '--severity-color': SEVERITY_COLORS[marker.severity],
                }}
                onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMarker(marker.id);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
            ))}
          </>
        ) : (
          <div className="canvas-empty">
            <div className="empty-icon">🏢</div>
            <p>请先选择或添加一个空间</p>
            <p className="hint">上传实景图后即可开始标记破损位置</p>
          </div>
        )}
      </div>
    </div>
  );
}
