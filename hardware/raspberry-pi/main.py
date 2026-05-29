import time
import signal
import sys
from config import (
    PIN, MQTT_BROKER, MQTT_PORT,
    READ_INTERVAL, CAMERA_INDEX,
    ENABLE_YOLO, ENABLE_FALL_DETECTION, YOLO_INTERVAL,
)
from mqtt_client import MQTTPublisher

print('''
╔══════════════════════════════════════╗
║  IOMTea 树莓派健康监测终端           ║
║  PIN: {pin}                          ║
║  Broker: {broker}:{port}              ║
╚══════════════════════════════════════╝
'''.format(pin=PIN, broker=MQTT_BROKER, port=MQTT_PORT))

mqtt_pub = MQTTPublisher(PIN, MQTT_BROKER, MQTT_PORT)
mqtt_pub.connect()
time.sleep(1)

sensor_reader = None
pir_reader = None
camera = None
yolo = None

try:
    from sensors import DHT22Reader, PIRReader
    sensor_reader = DHT22Reader()
    pir_reader = PIRReader()
    print('[SENSOR] DHT22 + PIR 已就绪')
except Exception as e:
    print(f'[SENSOR] 传感器初始化失败: {e}')
    print('[SENSOR] 将在无传感器模式下继续运行')

if ENABLE_YOLO:
    try:
        from yolo import CameraReader, YOLODetector
        camera = CameraReader(CAMERA_INDEX)
        yolo = YOLODetector()
        print('[YOLO] 摄像头 + YOLO 已就绪')
    except Exception as e:
        print(f'[YOLO] 初始化失败: {e}')
        print('[YOLO] 将在无视觉模式下继续运行')

running = True


def handle_signal(sig, frame):
    global running
    print('\n[MAIN] 正在停止...')
    running = False


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

loop_count = 0

# 主采集循环（20 秒一轮）
# 每轮:
#   1. 读取 DHT22 温湿度 → MQTT 发布 temperature, humidity
#   2. 读取 PIR 人体感应 → MQTT 发布 motion_index（仅变化时推送）
#   3. 每 N 轮抓取摄像头帧 → YOLO 姿态估计 → MQTT 发布 posture + fall_detected
#   4. 等待至下一轮
try:
    while running:
        loop_count += 1
        print(f'\n[MAIN] === 第 {loop_count} 轮采集 ===')

        if sensor_reader:
            data = sensor_reader.read()
            if data:
                mqtt_pub.publish('temperature', data['temperature'], '°C')
                mqtt_pub.publish('humidity', data['humidity'], '%')

        if pir_reader:
            data = pir_reader.read()
            if data['changed']:
                mqtt_pub.publish('motion_index', data['motion_index'])

        if yolo and camera and (loop_count % YOLO_INTERVAL == 0):
            frame = camera.read_frame()
            if frame is not None:
                result = yolo.detect(frame, enable_fall=ENABLE_FALL_DETECTION)

                posture_map = {
                    'standing': 1, 'sitting': 2,
                    'lying': 3, 'absent': 0, 'unknown': -1,
                }
                posture_code = posture_map.get(result['posture'], -1)
                mqtt_pub.publish('posture', posture_code)

                if result['fall_detected']:
                    mqtt_pub.publish_fall_event(
                        confidence=result.get('confidence', 0.0)
                    )
                    mqtt_pub.publish('fall_detected', 1)
                else:
                    mqtt_pub.publish('fall_detected', 0)

        for _ in range(READ_INTERVAL):
            if not running:
                break
            time.sleep(1)

except KeyboardInterrupt:
    pass
finally:
    print('[MAIN] 清理中...')
    if camera:
        camera.release()
    mqtt_pub.disconnect()
    print('[MAIN] 已停止')
