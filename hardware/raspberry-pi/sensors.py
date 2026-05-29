import time
import board
import adafruit_dht


class DHT22Reader:
    def __init__(self, pin=board.D4):
        self.dht = adafruit_dht.DHT22(pin, use_pulseio=False)

    def read(self):
        try:
            temperature = self.dht.temperature
            humidity = self.dht.humidity
            if temperature is not None and humidity is not None:
                return {
                    'temperature': round(temperature, 1),
                    'humidity': round(humidity, 1),
                }
        except RuntimeError:
            pass
        except Exception as e:
            print(f'[DHT22] 读取错误: {e}')
        return None


class PIRReader:
    def __init__(self, pin=17):
        from gpiozero import MotionSensor
        self.pir = MotionSensor(pin, pull_up=False)
        self.last_state = 0

    def read(self):
        current = 1 if self.pir.motion_detected else 0
        changed = current != self.last_state
        self.last_state = current
        return {
            'motion_index': current,
            'changed': changed,
        }
