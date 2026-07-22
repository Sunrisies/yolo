#!/usr/bin/env python3
"""
YOLOv8 裂缝检测模型训练脚本

用法:
  # 默认使用 Crack500 数据集，从 pretrained 权重开始训练
  python train.py

  # 指定参数
  python train.py --model yolov8n.pt --epochs 100 --batch 16 --imgsz 640

  # 使用自定义数据集
  python train.py --data /path/to/dataset.yaml
"""
import os
import sys
import argparse
from pathlib import Path
from ultralytics import YOLO


def train(args):
    print("=" * 60)
    print("YOLOv8 裂缝检测模型训练")
    print("=" * 60)

    # 参数
    model_name = args.model
    data_yaml = args.data
    epochs = args.epochs
    batch = args.batch
    imgsz = args.imgsz
    device = args.device
    project = args.project
    name = args.name
    lr0 = args.lr0
    resume = args.resume

    # 数据集配置
    if not os.path.exists(data_yaml):
        print(f"❌ 数据集配置文件不存在: {data_yaml}")
        print("   请先运行 prepare_data.py 准备数据")
        sys.exit(1)

    print(f"\n📋 训练配置:")
    print(f"   ├─ 基础模型: {model_name}")
    print(f"   ├─ 数据集:   {data_yaml}")
    print(f"   ├─ 轮数:     {epochs}")
    print(f"   ├─ Batch:    {batch}")
    print(f"   ├─ 图片尺寸: {imgsz}")
    print(f"   ├─ 学习率:   {lr0}")
    print(f"   ├─ 设备:     {device}")
    print(f"   ├─ 项目目录: {project}")
    print(f"   └─ 实验名称: {name}")

    # 加载模型
    print(f"\n📦 加载模型: {model_name}")
    model = YOLO(model_name)

    # 开始训练
    print(f"\n🚀 开始训练...\n")
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        device=device,
        project=project,
        name=name,
        lr0=lr0,
        resume=resume,
        patience=50,          # early stopping
        save=True,
        save_period=10,       # 每 10 轮保存一次
        val=True,
        amp=True,             # 混合精度训练
        deterministic=False,  # 加速
    )

    # 训练完成
    print(f"\n{'='*60}")
    print(f"✅ 训练完成!")
    print(f"   结果保存于: {project}/{name}")
    print(f"   最佳权重:   {project}/{name}/weights/best.pt")
    print(f"{'='*60}")

    # 验证
    print(f"\n🔍 验证最佳模型...")
    best_model = YOLO(f"{project}/{name}/weights/best.pt")
    val_results = best_model.val(data=data_yaml)
    
    if val_results:
        print(f"\n📊 验证结果:")
        print(f"   mAP50:    {val_results.box.map50:.4f}")
        print(f"   mAP50-95: {val_results.box.map:.4f}")
        if hasattr(val_results, 'box') and hasattr(val_results.box, 'map75'):
            print(f"   mAP75:    {val_results.box.map75:.4f}")

    return results


def main():
    parser = argparse.ArgumentParser(description="YOLOv8 裂缝检测训练")
    
    # 模型参数
    parser.add_argument("--model", type=str, default="yolov8n.pt",
                        help="预训练模型 (yolov8n.pt / yolov8s.pt / yolov8m.pt)")
    parser.add_argument("--data", type=str,
                        default=str(Path(__file__).parent / "data/crack_dataset/dataset.yaml"),
                        help="数据集配置文件路径")
    
    # 训练参数
    parser.add_argument("--epochs", type=int, default=200, help="训练轮数")
    parser.add_argument("--batch", type=int, default=16, help="batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="输入图片尺寸")
    parser.add_argument("--lr0", type=float, default=0.01, help="初始学习率")
    parser.add_argument("--device", type=str, default="", help="训练设备 (0 / cpu)")
    
    # 输出参数
    parser.add_argument("--project", type=str,
                        default=str(Path(__file__).parent / "runs"),
                        help="项目目录")
    parser.add_argument("--name", type=str, default="crack_detection", help="实验名称")
    
    # 其他
    parser.add_argument("--resume", action="store_true", help="从断点恢复训练")
    
    args = parser.parse_args()
    
    # 如果指定了 GPU 设备
    if args.device:
        os.environ["CUDA_VISIBLE_DEVICES"] = args.device
    
    train(args)


if __name__ == "__main__":
    main()
