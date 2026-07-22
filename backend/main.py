from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image, ImageDraw
import io
import os
import uuid
import base64
import numpy as np
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

app = FastAPI(title="Building Maintenance AI Detection API (YOLOv8-seg)", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "../detection_results"
os.makedirs(UPLOAD_DIR, exist_ok=True)

os.makedirs("models", exist_ok=True)

# --- 模型管理模块 ---
# 默认模型
DEFAULT_MODEL_PATH = "models/yolov8n-seg.pt"

# 当前模型状态（使用容器对象实现可变全局）
current_model_info: Dict[str, Any] = {
    "path": "",
    "name": "",
    "type": "",
    "loaded": False
}

# 全局模型实例，初始为 None，启动时加载默认模型
_model_instance: Optional[YOLO] = None

def get_model() -> YOLO:
    """获取当前全局模型实例"""
    global _model_instance
    if _model_instance is None:
        raise RuntimeError("模型尚未加载")
    return _model_instance

def scan_models() -> List[Dict[str, Any]]:
    """扫描 models 目录下的所有 .pt 文件"""
    model_files = []
    if not os.path.exists("models"):
        return model_files
    for f in sorted(os.listdir("models")):
        if f.endswith(".pt"):
            full_path = os.path.join("models", f)
            size_bytes = os.path.getsize(full_path)
            # 根据文件名判断模型类型
            name_lower = f.lower()
            if "seg" in name_lower:
                model_type = "segmentation"
            elif "detect" in name_lower or "yolov8" in name_lower:
                model_type = "detection"
            else:
                model_type = "unknown"
            model_files.append({
                "name": f,
                "path": full_path,
                "type": model_type,
                "size_bytes": size_bytes
            })
    return model_files

def load_model_by_path(model_path: str) -> YOLO:
    """加载指定路径的模型，自动兼容 YOLOv5 格式"""
    global _model_instance
    name = os.path.basename(model_path)
    name_lower = name.lower()
    
    # 先尝试用 YOLO 直接加载
    try:
        new_model = YOLO(model_path)
        _model_instance = new_model
        # 更新模型信息
        if "seg" in name_lower:
            model_type = "segmentation"
        elif "detect" in name_lower or "yolov8" in name_lower:
            model_type = "detection"
        else:
            model_type = "unknown"
        current_model_info["path"] = model_path
        current_model_info["name"] = name
        current_model_info["type"] = model_type
        current_model_info["loaded"] = True
        return new_model
    except Exception:
        # 直接加载失败，尝试 YOLOv5 → YOLOv8 转换
        pass
    
    # --- YOLOv5 兼容加载 ---
    import torch
    print(f"🔄 尝试转换 YOLOv5 模型: {name}")
    
    try:
        ckpt = torch.load(model_path, map_location='cpu', weights_only=False)
        
        if 'model' not in ckpt:
            raise ValueError("模型文件格式不兼容")
        
        model_state = ckpt['model']
        if hasattr(model_state, 'state_dict'):
            state_dict = model_state.state_dict()
        elif isinstance(model_state, dict):
            state_dict = model_state
        else:
            raise ValueError(f"无法解析模型权重: {type(model_state)}")
        
        # 构建 YOLOv8 兼容的检查点
        model_names = {0: 'object'}
        if hasattr(model_state, 'names'):
            model_names = model_state.names
        elif 'names' in ckpt:
            model_names = ckpt['names']
        
        # 保存转换后的模型
        converted_path = model_path.replace('.pt', '_converted.pt')
        torch.save({
            'model': state_dict,
            'epoch': ckpt.get('epoch', -1),
            'best_fitness': ckpt.get('best_fitness', None),
            'names': model_names,
            'version': 8,
        }, converted_path)
        
        # 用 YOLO 加载转换后的模型
        new_model = YOLO(converted_path)
        _model_instance = new_model
        
        model_type = "detection"
        current_model_info["path"] = converted_path
        current_model_info["name"] = name
        current_model_info["type"] = model_type
        current_model_info["loaded"] = True
        
        print(f"✅ YOLOv5 模型转换并加载成功: {name}")
        print(f"   类别: {model_names}")
        return new_model
        
    except Exception as convert_err:
        print(f"❌ 模型转换失败: {convert_err}")
        raise RuntimeError(f"模型 {name} 不兼容且转换失败: {convert_err}")

def load_default_model():
    """加载默认模型，如果不存在则下载"""
    global _model_instance
    try:
        if os.path.exists(DEFAULT_MODEL_PATH):
            _model_instance = load_model_by_path(DEFAULT_MODEL_PATH)
        else:
            _model_instance = YOLO("yolov8n-seg.pt")
            _model_instance.save(DEFAULT_MODEL_PATH)
            _model_instance = load_model_by_path(DEFAULT_MODEL_PATH)
    except Exception as e:
        raise RuntimeError(f"加载默认模型失败: {str(e)}")

# 应用启动时加载默认模型
load_default_model()

DAMAGE_CLASSES = {
    0: "wall_crack",
    1: "equipment_failure", 
    2: "pipe_leak",
    3: "floor_damage",
    4: "lighting_failure"
}

CLASS_NAMES = {
    "wall_crack": "墙面开裂",
    "equipment_failure": "设备故障",
    "pipe_leak": "管道渗漏",
    "floor_damage": "地砖破损",
    "lighting_failure": "照明故障"
}

SEVERITY_MAP = {
    "low": "general",
    "medium": "moderate", 
    "high": "severe",
    "critical": "urgent"
}

def analyze_damage_severity(mask_area: float, confidence: float) -> str:
    """基于分割掩码面积评估严重程度"""
    if mask_area > 0.25 and confidence > 0.7:
        return "urgent"
    elif mask_area > 0.1 and confidence > 0.5:
        return "severe"
    elif mask_area > 0.03:
        return "moderate"
    return "general"

def mask_to_polygon(mask: np.ndarray) -> List[List[float]]:
    """将掩码转换为多边形轮廓"""
    if mask.ndim == 3:
        mask = mask[0]
    
    # 简单的轮廓提取
    coords = np.column_stack(np.where(mask > 0.5))
    if len(coords) == 0:
        return []
    
    # 采样减少点数量
    step = max(1, len(coords) // 50)
    coords = coords[::step]
    
    # 转换坐标 (y,x) -> (x,y)
    return [[float(x), float(y)] for y, x in coords]

def create_overlay_image(image: Image.Image, results, total_detections: int = 0) -> str:
    """创建带分割掩码的叠加图像"""
    # 确保图像为 RGBA 模式以便叠加
    overlay = image.convert('RGBA') if image.mode != 'RGBA' else image.copy()
    
    colors = [
        (255, 0, 0, 128),      # 红色
        (255, 165, 0, 128),    # 橙色
        (255, 255, 0, 128),    # 黄色
        (0, 255, 0, 128),      # 绿色
        (0, 0, 255, 128)       # 蓝色
    ]
    
    detection_count = 0
    for result_idx, result in enumerate(results):
        if result.masks is not None:
            for mask_idx, mask in enumerate(result.masks.data):
                color = colors[(result_idx + mask_idx) % len(colors)]
                detection_count += 1
                
                # 将掩码转换为 PIL 图像
                mask_array = mask.cpu().numpy()
                mask_pil = Image.fromarray((mask_array * 255).astype('uint8'))
                mask_pil = mask_pil.resize(image.size, Image.Resampling.NEAREST)
                
                # 创建彩色掩码
                colored_mask = Image.new('RGBA', image.size, color[:3] + (0,))
                mask_draw = ImageDraw.Draw(colored_mask)
                
                # 应用掩码
                mask_data = mask_pil.load()
                colored_data = colored_mask.load()
                for y in range(image.size[1]):
                    for x in range(image.size[0]):
                        if mask_data[x, y] > 128:
                            colored_data[x, y] = color
                
                # 合并到原图
                overlay = Image.alpha_composite(overlay.convert('RGBA'), colored_mask)
    
    # 在图片左上角添加检测摘要文字
    draw = ImageDraw.Draw(overlay)
    summary = f"AI检测: 共发现 {total_detections} 处破损"
    # 计算文字背景大小
    bbox = draw.textbbox((0, 0), summary, font=None)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # 绘制半透明背景
    draw.rectangle([10, 10, 20 + text_w, 20 + text_h], fill=(0, 0, 0, 180))
    # 绘制文字
    draw.text((15, 12), summary, fill=(255, 255, 255))
    
    # 转换为 base64
    buffer = io.BytesIO()
    overlay.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def process_image(image_bytes: bytes, filename: str) -> Dict[str, Any]:
    image = Image.open(io.BytesIO(image_bytes))
    img_width, img_height = image.size
    
    # 使用当前全局模型进行推理
    current_model = get_model()
    results = current_model(image, conf=0.25)
    
    # 获取模型类别名称（优先使用模型自带的 names）
    try:
        model_names = current_model.names
    except Exception:
        model_names = CLASS_NAMES  # 回退到预设的破损类别
    
    detections = []
    for result in results:
        if result.boxes is None:
            continue
            
        for idx, box in enumerate(result.boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            
            x_center = ((x1 + x2) / 2 / img_width) * 100
            y_center = ((y1 + y2) / 2 / img_height) * 100
            
            # 获取分割掩码并计算面积
            mask_area = 0.0
            polygon = []
            if result.masks is not None and idx < len(result.masks):
                mask = result.masks.data[idx].cpu().numpy()
                mask_area = float(np.sum(mask) / (mask.shape[0] * mask.shape[1]))
                polygon = mask_to_polygon(mask)
            else:
                # 如果没有掩码，使用边界框作为后备
                box_w = (x2 - x1) / img_width
                box_h = (y2 - y1) / img_height
                mask_area = box_w * box_h
            
            damage_type = DAMAGE_CLASSES.get(class_id % len(DAMAGE_CLASSES), "wall_crack")
            # 使用模型自带名称（自定义模型如井盖检测），回退到预设类名
            raw_name = str(model_names.get(class_id, CLASS_NAMES.get(damage_type, damage_type)))
            severity = analyze_damage_severity(mask_area, confidence)
            
            detection = {
                "id": str(uuid.uuid4()),
                "damage_type": damage_type,
                "damage_type_name": raw_name,
                "severity": severity,
                "confidence": confidence,
                "x": round(x_center, 2),
                "y": round(y_center, 2),
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                "mask_area": round(mask_area, 4),
                "polygon": polygon,
                "description": f"检测到{raw_name}，面积占比{mask_area*100:.1f}%，置信度{confidence:.2f}"
            }
            detections.append(detection)
    
    # 创建可视化图像
    overlay_base64 = create_overlay_image(image, results, len(detections))
    
    # 保存原图
    file_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}_{filename}")
    image.save(save_path)
    
    # 保存带分割掩码的可视化图像到磁盘（始终保存为 PNG）
    overlay_filename = f"{file_id}_overlay.png"
    overlay_save_path = os.path.join(UPLOAD_DIR, overlay_filename)
    try:
        overlay_image_data = base64.b64decode(overlay_base64)
        with open(overlay_save_path, "wb") as f:
            f.write(overlay_image_data)
    except Exception:
        overlay_save_path = ""  # 保存失败不阻断主流程
    
    # 在终端打印识别结果
    print(f"\n{'='*60}")
    print(f"📷 文件: {filename}")
    print(f"📐 尺寸: {img_width} x {img_height}")
    print(f"🔍 模型: {current_model_info.get('name', 'unknown')}")
    print(f"📊 检测到 {len(detections)} 处破损")
    if detections:
        print(f"{'─'*60}")
        for i, d in enumerate(detections, 1):
            print(f"  [{i}] {d['damage_type_name']}")
            print(f"      置信度: {d['confidence']:.2%}")
            print(f"      严重程度: {d['severity']}")
            print(f"      位置: ({d['x']:.1f}%, {d['y']:.1f}%)")
            print(f"      区域占比: {d['mask_area']*100:.2f}%")
            print(f"      描述: {d['description']}")
    else:
        print(f"  (未检测到破损目标)")
    print(f"{'='*60}\n")
    
    return {
        "filename": filename,
        "image_path": save_path,
        "overlay_image_path": overlay_save_path,
        "width": img_width,
        "height": img_height,
        "detections": detections,
        "total_detections": len(detections),
        "overlay_image": overlay_base64,
        "model_type": current_model_info.get("type", "unknown"),
        "model_name": current_model_info.get("name", "unknown")
    }

@app.get("/")
async def root():
    return {
        "message": "Building Maintenance AI Detection API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": current_model_info.get("loaded", False),
        "current_model": current_model_info.get("name", ""),
        "model_type": current_model_info.get("type", "")
    }

@app.post("/api/detect/single")
async def detect_single(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        result = process_image(contents, file.filename)
        return JSONResponse(content={
            "success": True,
            "data": result,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/detect/batch")
async def detect_batch(files: List[UploadFile] = File(...)):
    try:
        results = []
        for file in files:
            contents = await file.read()
            result = process_image(contents, file.filename)
            results.append(result)
        
        total_detections = sum(r["total_detections"] for r in results)
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "results": results,
                "total_images": len(results),
                "total_detections": total_detections
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/damage/types")
async def get_damage_types():
    return {
        "success": True,
        "data": CLASS_NAMES
    }

# --- 模型管理 API ---

@app.get("/api/models")
async def list_models():
    """获取所有可用模型列表"""
    try:
        models = scan_models()
        return {
            "success": True,
            "data": {
                "models": models,
                "current": current_model_info.get("name", ""),
                "total": len(models)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/current")
async def get_current_model():
    """获取当前正在使用的模型信息"""
    return {
        "success": True,
        "data": {
            "name": current_model_info.get("name", ""),
            "path": current_model_info.get("path", ""),
            "type": current_model_info.get("type", ""),
            "loaded": current_model_info.get("loaded", False)
        }
    }

@app.post("/api/models/switch")
async def switch_model(data: Dict[str, str]):
    """切换到指定模型"""
    model_name = data.get("name", "")
    if not model_name:
        raise HTTPException(status_code=400, detail="缺少模型名称参数")
    
    model_path = os.path.join("models", model_name)
    
    # 安全检查：防止路径遍历
    real_path = os.path.normpath(model_path)
    if not real_path.startswith(os.path.normpath("models")):
        raise HTTPException(status_code=400, detail="无效的模型路径")
    
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail=f"模型文件不存在: {model_name}")
    
    # 保存旧模型信息以便回滚
    old_name = current_model_info.get("name", "")
    
    try:
        load_model_by_path(model_path)
        return {
            "success": True,
            "data": {
                "name": current_model_info["name"],
                "type": current_model_info["type"],
                "loaded": True
            },
            "message": f"模型切换成功: {model_name}"
        }
    except Exception as e:
        # 切换失败，回滚到旧模型
        try:
            if old_name:
                old_path = os.path.join("models", old_name)
                if os.path.exists(old_path):
                    load_model_by_path(old_path)
        except:
            pass  # 如果回滚也失败，至少尝试重新加载默认模型
            try:
                load_default_model()
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"模型切换失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
