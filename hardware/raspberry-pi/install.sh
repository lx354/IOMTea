#!/bin/bash
# IOMTea 树莓派终端安装脚本
set -e

echo "=== IOMTea 树莓派终端 安装开始 ==="

# 1. 更新包列表
echo "[1/5] 更新系统包列表..."
sudo apt-get update -qq

# 2. 安装系统依赖
echo "[2/5] 安装系统依赖 (python3-pip, python3-venv, libgpiod2)..."
sudo apt-get install -y -qq python3-pip python3-venv libgpiod2

# 3. 创建虚拟环境
echo "[3/5] 创建 Python 虚拟环境..."
python3 -m venv .venv
source .venv/bin/activate

# 4. 安装 Python 依赖
echo "[4/5] 安装 Python 依赖..."
pip3 install -q -r requirements.txt

# 5. 下载 YOLO 模型
echo "[5/5] 下载 YOLOv8n-pose 模型..."
python3 -c "from ultralytics import YOLO; YOLO('yolov8n-pose.pt')"

echo ""
echo "============================================"
echo "  安装完成！"
echo "  请编辑 config.py 配置 PIN 和服务器地址"
echo "  然后运行: sudo python3 main.py"
echo "============================================"
