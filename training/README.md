# YOLOv8 裂缝检测模型训练

使用 YOLOv8 训练裂缝检测模型，基于 Crack500 公开数据集。

## 环境要求

```bash
# 使用后端已有的虚拟环境
cd ../backend
source venv/bin/activate  # Linux/Mac
# 或
.\venv\Scripts\activate   # Windows

# 确认 ultralytics 已安装
python -c "import ultralytics; print(ultralytics.__version__)"
```

## 快速开始

### 1. 准备数据

```bash
cd training

# 自动下载 DeepCrack 数据集（推荐，GitHub 可靠源）
python prepare_data.py

# 或者使用 Crack500（从 Google Drive 下载）
python prepare_data.py --source crack500

# 或者使用本地已有数据
python prepare_data.py --data /path/to/your/dataset
```

数据准备脚本会：
- 下载裂缝数据集（DeepCrack ~50MB / Crack500 ~200MB）
- 将像素级掩码标注转换为 YOLOv8 分割格式
- 自动划分训练/验证/测试集
- 生成 `data/crack_dataset/dataset.yaml` 配置文件

### 2. 开始训练

```bash
# 基础训练（yolov8n + 200轮）
python train.py

# 使用更大模型、更多轮次
python train.py --model yolov8s.pt --epochs 300 --batch 32

# 指定 GPU
python train.py --device 0

# 使用自定义数据集
python train.py --data /path/to/your/dataset.yaml
```

### 3. 查看结果

训练完成后，结果保存在 `training/runs/crack_detection/` 目录：

```
training/runs/crack_detection/
├── weights/
│   ├── best.pt      ← 最佳模型（用于部署）
│   └── last.pt      ← 最后一轮模型
├── results.csv       ← 训练日志
├── confusion_matrix.png
├── results.png       ← 训练曲线图
└── val_batch*.jpg    ← 验证集预测示例
```

## 训练参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--model` | `yolov8n.pt` | 基础模型 (n/s/m/l/x) |
| `--epochs` | 200 | 训练轮数 |
| `--batch` | 16 | 批次大小（根据显存调整） |
| `--imgsz` | 640 | 输入图片尺寸 |
| `--lr0` | 0.01 | 初始学习率 |
| `--device` | cpu | 训练设备（空=自动, 0=第一块GPU） |
| `--name` | crack_detection | 实验名称 |

## 模型选择

| 模型 | 参数量 | 速度 | 精度 | 适用场景 |
|------|--------|------|------|---------|
| `yolov8n.pt` | 3.2M | 最快 | 基础 | 快速实验、移动端 |
| `yolov8s.pt` | 11.2M | 较快 | 较好 | 通用场景 |
| `yolov8m.pt` | 25.9M | 中等 | 更好 | 高精度需求 |

## 使用训练好的模型

训练完成后，将 `runs/crack_detection/weights/best.pt` 复制到后端 `backend/models/` 目录：

```bash
cp runs/crack_detection/weights/best.pt ../backend/models/crack_detector.pt
```

然后在系统前端切换模型即可使用。

## 数据集说明

脚本支持两种公开裂缝数据集：

### DeepCrack（推荐）
由 CVPR 论文提出的深度学习裂缝分割数据集：
- **来源**: GitHub（`yhlleo/DeepCrack`）— 长期维护，链接稳定
- **规模**: 537 张路面裂缝图片
- **标注**: 像素级语义分割
- **下载**: `python prepare_data.py`（默认源）

### Crack500
Temple University 发布的路面裂缝数据集：
- **来源**: Google Drive（通过 gdown 下载）
- **规模**: ~500 张高分辨率路面裂缝图片
- **标注**: 像素级语义分割
- **下载**: `python prepare_data.py --source crack500`
- **注意**: 依赖 Google Drive 可访问性

### 本地数据
如果你有自己的裂缝图片数据，按以下结构放置：
```
/path/to/data/
├── train/img/  (图片)    train/mask/  (像素级掩码)
├── val/img/              val/mask/
└── test/img/             test/mask/
```
然后运行: `python prepare_data.py --data /path/to/data`
