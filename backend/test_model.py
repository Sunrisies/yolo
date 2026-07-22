#!/usr/bin/env python3
"""
YOLOv7 模型测试脚本（直接加载）
用法: python test_model.py <图片路径> [模型路径]
"""
import sys, os, warnings
warnings.filterwarnings('ignore')

# 直接使用缓存的 YOLOv7 仓库
_Y7 = os.path.expanduser("~/.cache/torch/hub/WongKinYiu_yolov7_main")
if os.path.exists(_Y7):
    sys.path.insert(0, _Y7)

import torch
from PIL import Image, ImageDraw
import numpy as np


def test_model(image_path, model_path="models/yolov7-tiny_bottle_old_100.pt"):
    for p in [model_path, image_path]:
        if not os.path.exists(p): print(f"❌ 不存在: {p}"); return

    print(f"📦 加载: {model_path}")

    # 从 YOLOv7 仓库导入模型工具
    from utils.datasets import letterbox
    from utils.general import check_img_size, non_max_suppression, scale_coords
    from models.yolo import Model

    device = torch.device('cpu')

    # YOLOv7 方式加载
    ckpt = torch.load(model_path, map_location='cpu', weights_only=False)
    model = ckpt['model'].float().eval().to(device)

    # 获取参数
    names = ckpt.get('names', {0: 'bottle'})
    if isinstance(names, dict): names = {int(k): v for k, v in names.items()}
    elif isinstance(names, list): names = {i: n for i, n in enumerate(names)}

    stride = int(model.stride.max()) if hasattr(model, 'stride') else 32
    imgsz = check_img_size(640, stride)
    print(f"🏷️  类别: {list(names.values())}")

    # 收集图片
    images = []
    if os.path.isdir(image_path):
        images = [os.path.join(image_path, f) for f in sorted(os.listdir(image_path))
                   if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
        print(f"📁 {len(images)} 张")
    else:
        images = [image_path]

    for path in images:
        print(f"\n{'='*50}\n📷 {os.path.basename(path)}")

        img0 = np.array(Image.open(path).convert('RGB'))
        img = letterbox(img0, imgsz, stride=stride, auto=True)[0]
        img = img.transpose((2, 0, 1))[::-1]
        img = np.ascontiguousarray(img)
        img = torch.from_numpy(img).float() / 255.0
        img = img.unsqueeze(0).to(device)

        with torch.no_grad():
            pred = model(img)[0]
            pred = non_max_suppression(pred, 0.25, 0.45, None, 100)[0]

        if pred is None or len(pred) == 0:
            print("  未检测到"); continue

        pred[:, :4] = scale_coords(img.shape[2:], pred[:, :4], img0.shape[:2]).round()

        print(f"  检测到 {len(pred)} 个:")
        img_pil = Image.fromarray(img0)
        draw = ImageDraw.Draw(img_pil)
        colors = ['#ff4444', '#ff8800', '#ffdd00', '#44cc44', '#4488ff']

        for i, d in enumerate(pred):
            x1, y1, x2, y2, conf, cls_id = d.tolist()
            nm = names.get(int(cls_id), f"c{int(cls_id)}")
            print(f"  [{i+1}] {nm}  {conf:.2%}  ({x1:.0f},{y1:.0f}→{x2:.0f},{y2:.0f})")
            clr = colors[i % len(colors)]
            draw.rectangle([x1, y1, x2, y2], outline=clr, width=3)
            label = f"{nm} {conf:.0%}"
            draw.rectangle([x1, y1-20, x1+len(label)*8+8, y1], fill=clr)
            draw.text((x1+4, y1-18), label, fill='white')

        out = f"result_{os.path.basename(path)}"
        img_pil.save(out)
        print(f"  💾 {out}")

    print(f"\n{'='*50}\n✅ 完成")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python test_model.py <图片路径> [模型路径]"); sys.exit(1)
    mp = sys.argv[2] if len(sys.argv) > 2 else "models/yolov7-tiny_bottle_old_100.pt"
    test_model(sys.argv[1], mp)
