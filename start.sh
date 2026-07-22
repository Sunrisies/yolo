#!/bin/bash

echo "🏗️  大楼维护数字化管理系统 - 启动脚本"
echo "=========================================="

# 检查是否在正确目录
if [ ! -d "backend" ] || [ ! -d "src" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 函数：启动后端
start_backend() {
    echo "🔧 启动后端服务..."
    cd backend
    
    # 检查虚拟环境
    if [ ! -d "venv" ]; then
        echo "📦 创建Python虚拟环境..."
        python3 -m venv venv
    fi
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 安装依赖
    echo "📦 安装Python依赖..."
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    
    # 创建必要目录
    mkdir -p models uploads
    
    echo "🚀 后端服务启动中 (http://localhost:8000)..."
    python main.py &
    BACKEND_PID=$!
    
    cd ..
}

# 函数：启动前端
start_frontend() {
    echo "🎨 启动前端服务..."
    
    # 安装npm依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装npm依赖..."
        npm install
    fi
    
    echo "🚀 前端服务启动中 (http://localhost:5173)..."
    npm run dev &
    FRONTEND_PID=$!
}

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo "✅ 所有服务已停止"
    exit 0
}

# 设置清理钩子
trap cleanup SIGINT SIGTERM

# 启动服务
start_backend
sleep 3  # 等待后端启动
start_frontend

echo ""
echo "✅ 服务启动完成！"
echo "📍 后端API: http://localhost:8000"
echo "🌐 前端页面: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待
wait
