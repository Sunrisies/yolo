@echo off
chcp 65001 >nul
echo 🏗️  大楼维护数字化管理系统 - 启动脚本
echo ==========================================

REM 检查是否在正确目录
if not exist "backend" (
    echo ❌ 请在项目根目录运行此脚本
    pause
    exit /b 1
)

echo 🔧 启动后端服务...
cd backend

REM 检查虚拟环境
if not exist "venv" (
    echo 📦 创建Python虚拟环境...
    python -m venv venv
)

REM 激活虚拟环境
call venv\Scripts\activate

REM 安装依赖
echo 📦 安装Python依赖...
pip install -q -r requirements.txt

REM 创建必要目录
if not exist "models" mkdir models
if not exist "uploads" mkdir uploads

echo 🚀 后端服务启动中 (http://localhost:8000)...
start "Backend" cmd /k "python main.py"

cd ..

REM 等待后端启动
timeout /t 3 /nobreak >nul

echo 🎨 启动前端服务...
if not exist "node_modules" (
    echo 📦 安装npm依赖...
    call npm install
)

echo 🚀 前端服务启动中 (http://localhost:5173)...
start "Frontend" cmd /k "npm run dev"

echo.
echo ✅ 服务启动完成！
echo 📍 后端API: http://localhost:8000
echo 🌐 前端页面: http://localhost:5173
echo.
echo 请分别在两个窗口中查看服务状态
pause
