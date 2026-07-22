#!/usr/bin/env python3
"""
裂缝数据集准备脚本 — 下载并转换为 YOLOv8 训练格式

支持的公开数据集:
  1. DeepCrack (GitHub, 推荐 — 自动下载)
  2. Crack500 (Google Drive, 需 gdown)
  3. 本地数据 (手动放置)

用法:
  # 自动下载 DeepCrack 数据集（推荐）
  python prepare_data.py

  # 使用 Crack500（从 Google Drive 下载）
  python prepare_data.py --source crack500

  # 使用本地已有数据
  python prepare_data.py --data /path/to/crack500

本地数据目录结构要求:
  /path/to/dataset/
    train/img/   train/mask/
    val/img/     val/mask/
    test/img/    test/mask/
  其中 mask 为像素级标注（白色=裂缝，黑色=背景）
"""
import os
import sys
import argparse
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm

# ── 配置 ──
DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = DATA_DIR / "crack_dataset"
IMAGES_DIR = OUTPUT_DIR / "images"
LABELS_DIR = OUTPUT_DIR / "labels"

CLASS_NAMES = ["crack"]
MIN_AREA = 50  # 最小掩码面积


def check_deps():
    """检查依赖"""
    missing = []
    for pkg, name in [('cv2', 'opencv-python'), ('tqdm', 'tqdm')]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(name)
    if missing:
        print(f"❌ 缺少依赖: {', '.join(missing)}")
        print(f"   安装: pip install {' '.join(missing)}")
        sys.exit(1)


# ══════════════════════════════════════════════════════════
# DeepCrack 数据集（GitHub, 可靠源）
# ══════════════════════════════════════════════════════════

DEEPCRACK_URL = "https://github.com/yhlleo/DeepCrack/archive/master.zip"
DEEPCRACK_DIR = DATA_DIR / "deepcrack_source"


def download_deepcrack():
    """下载 DeepCrack 数据集（GitHub, 537张路面裂缝图）"""
    print("\n📥 下载 DeepCrack 数据集...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    zip_path = DATA_DIR / "deepcrack.zip"
    if not zip_path.exists():
        try:
            import requests
            r = requests.get(DEEPCRACK_URL, stream=True, timeout=30)
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            with open(zip_path, "wb") as f:
                with tqdm(total=total, unit="B", unit_scale=True, desc="  DeepCrack") as pbar:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                        pbar.update(len(chunk))
            print("  ✅ 下载完成")
        except Exception as e:
            print(f"  ❌ 下载失败: {e}")
            return False

    # 解压
    if DEEPCRACK_DIR.exists():
        shutil.rmtree(DEEPCRACK_DIR)
    import zipfile
    print("  解压中...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(DATA_DIR)
    # 重命名去掉 master 后缀
    extracted = DATA_DIR / "DeepCrack-master"
    if extracted.exists():
        extracted.rename(DEEPCRACK_DIR)
    return True


def prepare_deepcrack():
    """准备 DeepCrack 数据集"""
    if not DEEPCRACK_DIR.exists():
        if not download_deepcrack():
            return False

    # DeepCrack 的 dataset 目录内还有一个 DeepCrack.zip
    inner_zip = DEEPCRACK_DIR / "dataset" / "DeepCrack.zip"
    if not inner_zip.exists():
        print(f"  ❌ 未找到数据集文件: {inner_zip}")
        return False

    # 解压内层 zip
    import zipfile
    extract_dir = DEEPCRACK_DIR / "extracted"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)

    print("  解压数据集...")
    with zipfile.ZipFile(inner_zip, "r") as zf:
        zf.extractall(extract_dir)

    # DeepCrack 结构:
    #   train_img/  train_lab/   test_img/  test_lab/
    # 图片: *.jpg     标注: *_lab.png
    # 没有 val 集，从 train 中划分 20% 作为 val
    splits = {
        'train_img': ('train', 'image'),
        'train_lab': ('train', 'label'),
        'test_img': ('test', 'image'),
        'test_lab': ('test', 'label'),
    }

    # 收集所有图片-标注对
    import random
    train_pairs, test_pairs = [], []

    for dir_name, (split, kind) in splits.items():
        dir_path = extract_dir / dir_name
        if not dir_path.exists():
            print(f"  ⚠️  跳过 {dir_name}")
            continue

        if kind == 'image':
            target_split = split
            for img_path in sorted(dir_path.glob("*.jpg")):
                stem = img_path.stem
                # 找对应标注: train_lab/ 目录下同名 .png
                lab_dir = extract_dir / f"{split}_lab"
                if not lab_dir.exists():
                    continue
                lab_path = lab_dir / f"{stem}.png"
                if lab_path.exists():
                    pair = (img_path, lab_path)
                    if split == 'train':
                        train_pairs.append(pair)
                    else:
                        test_pairs.append(pair)

    if not train_pairs and not test_pairs:
        print(f"  ❌ 未找到图片-标注对，请检查数据集结构")
        return False

    # 划分 train/val (80% / 20%)
    random.seed(42)
    random.shuffle(train_pairs)
    val_count = max(1, len(train_pairs) // 5)
    val_pairs = train_pairs[:val_count]
    train_pairs = train_pairs[val_count:]

    print(f"  训练: {len(train_pairs)} 张, 验证: {len(val_pairs)} 张, 测试: {len(test_pairs)} 张")

    # 写入各 split
    total = 0
    for split_name, pairs in [('train', train_pairs), ('val', val_pairs), ('test', test_pairs)]:
        if not pairs:
            continue
        img_dir = IMAGES_DIR / split_name
        label_dir = LABELS_DIR / split_name
        img_dir.mkdir(parents=True, exist_ok=True)
        label_dir.mkdir(parents=True, exist_ok=True)

        count = 0
        for img_path, lab_path in tqdm(pairs, desc=f"  写入 {split_name}"):
            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]

            segments = mask_to_yolo_seg(lab_path, w, h)
            if not segments:
                continue

            stem = img_path.stem
            with open(label_dir / f"{stem}.txt", "w") as f:
                for cls_id, pts in segments:
                    f.write(f"{cls_id} " + " ".join(f"{p:.6f}" for p in pts) + "\n")
            shutil.copy2(img_path, img_dir / img_path.name)
            count += 1

        print(f"  {split_name}: {count} 张")
        total += count

    print(f"\n  ✅ DeepCrack 准备完成，共 {total} 张")
    return total > 0


# ══════════════════════════════════════════════════════════
# Crack500 数据集（Google Drive）
# ══════════════════════════════════════════════════════════

CRACK500_DIR = DATA_DIR / "crack500_source"
# 这些是 Crack500 常用的 Google Drive 文件 ID
CRACK500_FILES = {
    "train": {"id": "1u9C84oRkjHhM1Vx_aUmyR0BmO3AaiujA", "zip": "crack500_train.zip"},
    "val":   {"id": "1lKtBPyhMquhPRGNpQcYtNiBdQHdrxUKX", "zip": "crack500_val.zip"},
    "test":  {"id": "1BQ_pOXF6B_WM-bFahVND73U8htPO8VjW", "zip": "crack500_test.zip"},
}


def download_crack500_gdrive():
    """通过 Google Drive 下载 Crack500（需 gdown）"""
    print("\n📥 通过 Google Drive 下载 Crack500...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    try:
        import gdown
    except ImportError:
        print("  ❌ 需要 gdown: pip install gdown")
        return False

    for split, info in CRACK500_FILES.items():
        zip_path = DATA_DIR / info["zip"]
        if zip_path.exists():
            print(f"  [跳过] {info['zip']} 已存在")
            continue
        print(f"  下载 {split}...")
        try:
            gdown.download(id=info["id"], output=str(zip_path), quiet=False)
            print(f"  ✅ {split} 下载完成")
        except Exception as e:
            print(f"  ❌ 下载失败: {e}")
            return False
    return True


def prepare_crack500():
    """准备 Crack500 数据集"""
    if not download_crack500_gdrive():
        print("\n  ⚠️  Crack500 下载失败，可能原因:")
        print("    - Google Drive 链接已失效")
        print("    - 网络无法访问 Google Drive")
        print("    - 请使用 --source deepcrack 或 --data 本地模式")
        return False

    # 解压
    raw_dir = DATA_DIR / "crack500_raw"
    if raw_dir.exists():
        shutil.rmtree(raw_dir)

    for info in CRACK500_FILES.values():
        zip_path = DATA_DIR / info["zip"]
        if zip_path.exists():
            import zipfile
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(raw_dir)

    # 处理每个 split
    total = 0
    for split in ['train', 'val', 'test']:
        img_dir = IMAGES_DIR / split
        label_dir = LABELS_DIR / split
        img_dir.mkdir(parents=True, exist_ok=True)
        label_dir.mkdir(parents=True, exist_ok=True)

        # Crack500 结构: raw_dir/train/img/  raw_dir/train/mask/
        src = raw_dir / split
        if not src.exists():
            print(f"  ⚠️  跳过 {split}: 无数据")
            continue

        img_src = src / "img"
        mask_src = src / "mask"
        if not img_src.exists() or not mask_src.exists():
            print(f"  ⚠️  {split}: 缺少 img 或 mask 目录")
            continue

        images = sorted(img_src.glob("*.*"))
        count = 0
        for img_path in tqdm(images, desc=f"  处理 {split}"):
            if img_path.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
                continue

            stem = img_path.stem
            mask_path = mask_src / f"{stem}.png"
            if not mask_path.exists():
                continue

            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]

            segments = mask_to_yolo_seg(mask_path, w, h)
            if not segments:
                continue

            with open(label_dir / f"{stem}.txt", "w") as f:
                for cls_id, pts in segments:
                    f.write(f"{cls_id} " + " ".join(f"{p:.6f}" for p in pts) + "\n")
            shutil.copy2(img_path, img_dir / img_path.name)
            count += 1

        print(f"  {split}: {count} 张")
        total += count

    print(f"\n  ✅ Crack500 准备完成，共 {total} 张")
    return total > 0


# ══════════════════════════════════════════════════════════
# 通用工具函数
# ══════════════════════════════════════════════════════════

def mask_to_yolo_seg(mask_path: Path, img_width: int, img_height: int) -> list:
    """将像素级掩码转换为 YOLOv8 分割格式的多边形"""
    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return []

    _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    results = []
    for contour in contours:
        if cv2.contourArea(contour) < MIN_AREA:
            continue

        epsilon = 0.002 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)

        if len(approx) > 200:
            indices = np.linspace(0, len(approx) - 1, 200, dtype=int)
            approx = approx[indices]

        points = approx.squeeze().reshape(-1, 2).astype(np.float32)
        points[:, 0] = np.clip(points[:, 0] / img_width, 0, 1)
        points[:, 1] = np.clip(points[:, 1] / img_height, 0, 1)
        results.append((0, points.flatten().tolist()))

    return results


def write_dataset_yaml():
    """生成 YOLOv8 数据集配置文件"""
    yaml_path = OUTPUT_DIR / "dataset.yaml"
    with open(yaml_path, "w") as f:
        f.write(f"# 裂缝检测数据集\n")
        f.write(f"path: {OUTPUT_DIR.resolve()}\n")
        f.write(f"train: images/train\n")
        f.write(f"val: images/val\n")
        f.write(f"test: images/test\n")
        f.write(f"nc: {len(CLASS_NAMES)}\n")
        f.write(f"names: {CLASS_NAMES}\n")
    print(f"   📋 配置文件: {yaml_path}")
    return yaml_path


# ══════════════════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════════════════

def prepare_local_data(source_dir: Path):
    """使用本地已有数据"""
    print(f"\n📂 使用本地数据: {source_dir}")

    if not source_dir.exists():
        print(f"❌ 路径不存在: {source_dir}")
        return False

    total = 0
    for split in ['train', 'val', 'test']:
        img_src = source_dir / split / "img"
        mask_src = source_dir / split / "mask"

        if not img_src.exists():
            # 尝试其他常见结构
            img_src = source_dir / split / "images"
            mask_src = source_dir / split / "masks"
        if not img_src.exists():
            img_src = source_dir / split
            mask_src = source_dir / split / "mask"
        if not img_src.exists():
            continue

        img_dir = IMAGES_DIR / split
        label_dir = LABELS_DIR / split
        img_dir.mkdir(parents=True, exist_ok=True)
        label_dir.mkdir(parents=True, exist_ok=True)

        extensions = ('*.jpg', '*.jpeg', '*.png', '*.bmp')
        images = []
        for ext in extensions:
            images.extend(sorted(img_src.glob(ext)))

        count = 0
        for img_path in tqdm(images, desc=f"  处理 {split}"):
            stem = img_path.stem
            mask_paths = [
                mask_src / f"{stem}.png",
                mask_src / f"{stem}.jpg",
                mask_src / f"{stem}_mask.png",
                mask_src / f"{stem}_seg.png",
            ]
            mask_path = next((p for p in mask_paths if p.exists()), None)
            if mask_path is None:
                continue

            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]

            segments = mask_to_yolo_seg(mask_path, w, h)
            if not segments:
                continue

            with open(label_dir / f"{stem}.txt", "w") as f:
                for cls_id, pts in segments:
                    f.write(f"{cls_id} " + " ".join(f"{p:.6f}" for p in pts) + "\n")
            shutil.copy2(img_path, img_dir / img_path.name)
            count += 1

        print(f"  {split}: {count} 张")
        total += count

    print(f"\n  ✅ 共 {total} 张")
    return total > 0


def main():
    parser = argparse.ArgumentParser(description="裂缝数据集准备")
    parser.add_argument("--source", choices=["deepcrack", "crack500"], default="deepcrack",
                        help="数据源 (默认: deepcrack, 更可靠的 GitHub 源)")
    parser.add_argument("--data", type=str, default=None,
                        help="本地数据目录路径")
    args = parser.parse_args()

    check_deps()

    # 清空旧输出
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

    print("=" * 50)
    print("裂缝数据集准备工具")
    print("=" * 50)

    if args.data:
        ok = prepare_local_data(Path(args.data))
    elif args.source == "crack500":
        ok = prepare_crack500()
    else:
        ok = prepare_deepcrack()

    if not ok:
        print("\n❌ 数据准备失败")
        print("\n替代方案:")
        print("  1. python prepare_data.py --source deepcrack  (GitHub, 更可靠)")
        print("  2. python prepare_data.py --data /your/data/path  (本地数据)")
        sys.exit(1)

    write_dataset_yaml()

    total_images = sum(len(list(d.glob("*"))) for d in [IMAGES_DIR / s for s in ['train', 'val', 'test'] if (IMAGES_DIR / s).exists()])
    total_labels = sum(len(list(d.glob("*"))) for d in [LABELS_DIR / s for s in ['train', 'val', 'test'] if (LABELS_DIR / s).exists()])

    print(f"\n{'='*50}")
    print(f"✅ 准备完成!")
    print(f"   输出目录: {OUTPUT_DIR}")
    print(f"   图片: {total_images} 张")
    print(f"   标签: {total_labels} 个")
    print(f"   类别: {CLASS_NAMES}")
    print(f"   配置文件: {OUTPUT_DIR / 'dataset.yaml'}")
    print(f"\n开始训练: python train.py")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
