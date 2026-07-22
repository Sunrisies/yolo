# 🏢 大楼维护数字化管理系统 - YOLOv8-seg 实例分割版

## ✨ 功能特性

### 🤖 AI自动识别（增强版）
- **YOLOv8-seg 实例分割模型** - 更精确的破损区域定位
- 批量图片上传与自动检测
- 破损类型智能分类（墙面开裂、设备故障、管道渗漏、地砖破损、照明故障）
- **基于分割掩码面积的严重程度评估**
- **彩色分割掩码可视化** - 直观显示破损区域
- 检测结果可视化预览与选择性保存

### 传统手动标注模式
- 基础空间媒体管理
- 实景图破损标注
- 破损属性标准化录入
- 记录全生命周期管理
- Excel导出功能

## 🚀 快速开始

### 1. 安装Python后端

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动后端服务
python main.py
```

后端服务将在 http://localhost:8000 启动

### 2. 启动前端

```bash
# 回到项目根目录
cd ..

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 http://localhost:5173 启动

## 📁 项目结构

```
yolo/
├── backend/
│   ├── main.py              # FastAPI后端服务 (YOLOv8-seg)
│   ├── train_model.py       # 模型训练脚本
│   ├── requirements.txt    # Python依赖
│   ├── models/          # 模型存储目录
│   └── uploads/         # 上传文件存储
├── src/
│   ├── components/
│   │   ├── BatchUpload.tsx       # 批量上传组件
│   │   ├── DetectionResults.tsx  # 检测结果展示(支持分割掩码)
│   │   ├── SpaceManager.tsx
│   │   ├── ImageCanvas.tsx
│   │   ├── MarkerSidebar.tsx
│   │   └── RecordList.tsx
│   ├── services/
│   │   └── api.ts       # API服务
│   ├── App.tsx
│   └── types.ts
└── ...
```

## 🎯 使用流程

### AI识别模式（推荐）

1. 点击顶部"🤖 AI自动识别"切换到AI模式
2. 拖拽或点击上传多张图片
3. 点击"🚀 开始AI识别"按钮
4. **查看彩色分割掩码效果** - 直观了解破损区域
5. 预览检测结果，选择要保存的破损标记
6. 保存检测结果，自动创建空间和标记

### 手动标注模式

1. 点击"✏️ 手动标注"切换到传统模式
2. 创建空间并上传实景图
3. 在图片上点击添加破损标记
4. 填写破损详细信息
5. 管理和导出记录

## 🔧 技术架构

### 后端技术栈
- **FastAPI**: 高性能Python Web框架
- **YOLOv8-seg (Ultralytics)**: 实例分割模型
- **Pillow**: 图像处理
- **NumPy**: 数值计算
- **CORS支持**: 跨域资源共享

### 前端技术栈
- **React 18**: UI框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具
- **XLSX**: Excel导出

## 📊 AI模型说明

### YOLOv8-seg vs YOLOv8 对比

| 特性 | YOLOv8 (目标检测) | YOLOv8-seg (实例分割) |
|------|------------------|---------------------|
| 定位方式 | 边界框 | 像素级掩码 |
| 面积计算 | 边界框面积 | 实际破损面积 |
| 可视化 | 矩形框 | 彩色掩码 |
| 精度 | 中等 | 更高 |
| 适用场景 | 快速检测 | 精确定量分析 |

### 模型扩展建议

对于生产环境使用，建议：

1. 收集标注的大楼破损数据集（包含分割掩码）
2. 使用`train_model.py`进行微调
3. 替换`models/`目录下的模型文件
4. 根据需要调整检测置信度阈值

## 🎨 分割效果说明

系统使用不同颜色标识不同的破损实例：
- 🔴 红色
- 🟠 橙色
- 🟡 黄色
- 🟢 绿色
- 🔵 蓝色

每个破损区域都有：
- 精确的像素级分割掩码
- 基于实际掩码面积的严重等级
- 置信度评分
- 多边形轮廓数据

## 🛡️ API端点

- `GET /`: 服务状态
- `GET /health`: 健康检查
- `POST /api/detect/single`: 单图检测
- `POST /api/detect/batch`: 批量检测
- `GET /api/damage/types`: 破损类型列表

## 📝 注意事项

- 确保后端服务先启动，再使用前端AI功能
- 首次运行会自动下载YOLOv8-seg模型（约6MB）
- 图片建议使用清晰的实景图以获得更好的检测效果
- 批量处理时建议每次不超过10张图片以获得最佳性能

