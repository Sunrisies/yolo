#!/usr/bin/env python3
"""
YOLOv5 → YOLOv8 模型转换工具
用法: python convert_yolov5.py <模型路径>
示例: python convert_yolov5.py models/yolov7-tiny_bottle_old_100.pt
"""
import sys
import os
import torch

def convert_yolov5_to_ultralytics(model_path: str) -> str:
    """
    将 YOLOv5 格式的模型转换为 Ultralytics YOLOv8 可加载的格式。
    转换后的模型保存为 {原文件名}_ultralytics.pt
    """
    if not os.path.exists(model_path):
        print(f"❌ 模型文件不存在: {model_path}")
        sys.exit(1)

    name, ext = os.path.splitext(model_path)
    output_path = f"{name}_ultralytics{ext}"

    print(f"📥 加载原始模型: {model_path}")
    ckpt = torch.load(model_path, map_location='cpu')

    # YOLOv5 检查点结构: {'epoch': ..., 'best_fitness': ..., 'model': ..., ...}
    if 'model' not in ckpt:
        print("❌ 不是标准的 YOLOv5 检查点格式（缺少 'model' 键）")
        print(f"   可用键: {list(ckpt.keys())}")
        sys.exit(1)

    model_state = ckpt['model']
    
    # 如果是模型实例，提取 state_dict
    if hasattr(model_state, 'state_dict'):
        state_dict = model_state.state_dict()
    elif isinstance(model_state, dict):
        state_dict = model_state
    else:
        print(f"❌ 无法解析模型格式: {type(model_state)}")
        sys.exit(1)

    # 构建 Ultralytics 兼容的检查点
    new_ckpt = {
        'model': state_dict,
        'epoch': ckpt.get('epoch', -1),
        'best_fitness': ckpt.get('best_fitness', None),
        'train_results': ckpt.get('train_results', {}),
        'date': ckpt.get('date', ''),
        'version': 8,  # 标记为 YOLOv8 格式
        'names': ckpt.get('names', {0: 'manhole_cover'}),
    }

    # 尝试从模型配置中获取类别名称
    model_conf = ckpt.get('model', None)
    if hasattr(model_conf, 'names'):
        new_ckpt['names'] = model_conf.names
    elif hasattr(model_conf, 'module') and hasattr(model_conf.module, 'names'):
        new_ckpt['names'] = model_conf.module.names

    torch.save(new_ckpt, output_path)
    print(f"✅ 转换成功: {output_path}")
    print(f"   类别: {new_ckpt['names']}")
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python convert_yolov5.py <模型路径>")
        sys.exit(1)
    convert_yolov5_to_ultralytics(sys.argv[1])
