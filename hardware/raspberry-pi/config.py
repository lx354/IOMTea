# ====================================
# 配置 — 修改这里
# ====================================

# 设备 PIN（需先在服务器注册）
PIN = '000000'

# MQTT 代理地址（服务器 IP 或域名）
MQTT_BROKER = 'localhost'
MQTT_PORT = 1883

# 采集间隔（秒）
READ_INTERVAL = 20

# 摄像头编号（通常是 0）
CAMERA_INDEX = 0

# 是否启用 YOLO 检测
ENABLE_YOLO = True

# 是否启用跌倒检测
ENABLE_FALL_DETECTION = True

# YOLO 检测间隔（每 N 次循环检测一次）
YOLO_INTERVAL = 3
