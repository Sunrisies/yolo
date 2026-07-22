export type Severity = 'general' | 'moderate' | 'severe' | 'urgent';

export type DamageType = 
  | 'wall_crack'
  | 'equipment_failure'
  | 'pipe_leak'
  | 'floor_damage'
  | 'lighting_failure'
  | 'custom';

export interface Marker {
  id: string;
  x: number;
  y: number;
  damageType: DamageType;
  customDamageType?: string;
  description: string;
  photos: string[];
  discoveredAt: string;
  severity: Severity;
  status: 'pending' | 'processing' | 'resolved';
  spaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  wall_crack: '墙面开裂',
  equipment_failure: '设备故障',
  pipe_leak: '管道渗漏',
  floor_damage: '地砖破损',
  lighting_failure: '照明故障',
  custom: '自定义类型'
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  general: '一般',
  moderate: '较严重',
  severe: '严重',
  urgent: '紧急'
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  general: '#10b981',
  moderate: '#f59e0b',
  severe: '#ef4444',
  urgent: '#dc2626'
};

export const STATUS_LABELS: Record<Marker['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决'
};
