import json
from datetime import datetime, timezone
import paho.mqtt.client as mqtt


class MQTTPublisher:
    def __init__(self, pin, broker, port=1883):
        self.pin = pin
        self.broker = broker
        self.port = port
        self.topic = f'users/{pin}/raspberry-pi/observation'
        self.legacy_topic = f'iomtea/device/rpi-{pin}/events'
        self.client = mqtt.Client()
        self.connected = False

    def connect(self):
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()
            self.connected = True
            print(f'[MQTT] 已连接 {self.broker}:{self.port}')
        except Exception as e:
            print(f'[MQTT] 连接失败: {e}')
            self.connected = False

    def publish(self, metric, value, unit=None):
        if not self.connected:
            return False

        payload = {
            'metric': metric,
            'value': value,
            'recordedAt': datetime.now(timezone.utc).isoformat(),
        }
        if unit:
            payload['unit'] = unit

        try:
            result = self.client.publish(self.topic, json.dumps(payload), qos=1)
            print(f'[MQTT] → {metric}={value} (rc={result.rc})')
            return True
        except Exception as e:
            print(f'[MQTT] 发布失败: {e}')
            return False

    def publish_fall_event(self, confidence=0.0, device_id='rpi-cam-01'):
        if not self.connected:
            return False

        payload = {
            'pin': self.pin,
            'event': 'fallDetected',
            'confidence': confidence,
            'deviceId': device_id,
        }

        try:
            result = self.client.publish(self.legacy_topic, json.dumps(payload), qos=1)
            print(f'[MQTT] ⚠ 跌倒事件已发布 (rc={result.rc})')
            return True
        except Exception as e:
            print(f'[MQTT] 跌倒事件发布失败: {e}')
            return False

    def disconnect(self):
        self.connected = False
        self.client.loop_stop()
        self.client.disconnect()
        print('[MQTT] 已断开')
