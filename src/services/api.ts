const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Detection {
  id: string;
  damage_type: string;
  damage_type_name: string;
  severity: string;
  confidence: number;
  x: number;
  y: number;
  bbox: [number, number, number, number];
  mask_area?: number;
  polygon?: Array<[number, number]>;
  description: string;
}

export interface ImageResult {
  filename: string;
  image_path: string;
  width: number;
  height: number;
  detections: Detection[];
  total_detections: number;
  overlay_image?: string;
  model_type?: string;
}

export interface BatchResponse {
  success: boolean;
  data: {
    results: ImageResult[];
    total_images: number;
    total_detections: number;
  };
  timestamp: string;
}

export interface SingleResponse {
  success: boolean;
  data: ImageResult;
  timestamp: string;
}

export const api = {
  async healthCheck(): Promise<{ status: string; model_loaded: boolean }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.json();
  },

  async detectSingle(file: File): Promise<SingleResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/detect/single`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('检测失败');
    }
    
    return response.json();
  },

  async detectBatch(files: File[]): Promise<BatchResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await fetch(`${API_BASE_URL}/api/detect/batch`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('批量检测失败');
    }
    
    return response.json();
  },

  async getDamageTypes(): Promise<{ success: boolean; data: Record<string, string> }> {
    const response = await fetch(`${API_BASE_URL}/api/damage/types`);
    return response.json();
  }
};
