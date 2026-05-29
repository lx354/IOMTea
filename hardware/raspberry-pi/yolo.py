import cv2
import numpy as np


class CameraReader:
    def __init__(self, index=0):
        self.cap = cv2.VideoCapture(index)
        if not self.cap.isOpened():
            raise RuntimeError(f'无法打开摄像头 {index}')
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    def read_frame(self):
        ret, frame = self.cap.read()
        if ret:
            return frame
        return None

    def release(self):
        self.cap.release()


# YOLO 跌倒检测逻辑
# 1. 用关键点(臀部+脚踝)判断身体朝向 → 站立/坐/躺
# 2. 如果前一次是"站立"而当前是"躺" → 标记为跌倒
# 3. 关键点置信度 <0.5 时跳过该帧
#
# 注意: 这只是基本规则引擎，精度有限
#       生产级跌倒检测应使用时序模型（如 LSTM）分析连续帧
class YOLODetector:
    def __init__(self):
        from ultralytics import YOLO
        self.model = YOLO('yolov8n-pose.pt')
        self.last_posture = 'absent'
        self.last_posture_count = 0

    def detect(self, frame, enable_fall=True):
        if frame is None:
            return {'posture': 'absent', 'fall_detected': False}

        results = self.model(frame, verbose=False)
        fall_detected = False
        current_posture = 'absent'
        confidence = 0.0

        for result in results:
            if result.keypoints is None or len(result.keypoints) == 0:
                continue

            for kps in result.keypoints:
                if kps.conf is None:
                    continue

                xy = kps.xy[0].cpu().numpy()
                conf = kps.conf[0].cpu().numpy()

                if len(xy) < 11:
                    continue

                avg_conf = float(np.mean(conf))
                if avg_conf < 0.5:
                    continue

                left_hip = xy[5] if len(xy) > 5 else None
                right_hip = xy[6] if len(xy) > 6 else None
                left_ankle = xy[9] if len(xy) > 9 else None
                right_ankle = xy[10] if len(xy) > 10 else None
                nose = xy[0] if len(xy) > 0 else None

                if left_hip is None or right_hip is None:
                    current_posture = 'unknown'
                    continue

                hip_y = (left_hip[1] + right_hip[1]) / 2

                if nose is not None:
                    nose_y = nose[1]
                    body_height = abs(hip_y - nose_y)

                    if body_height > 100:
                        if nose_y < hip_y - 50:
                            current_posture = 'standing'
                        else:
                            current_posture = 'sitting'
                    else:
                        current_posture = 'lying'
                else:
                    current_posture = 'unknown'

                confidence = float(avg_conf)

        if enable_fall and current_posture == 'lying' and self.last_posture in ('standing', 'walking'):
            fall_detected = True
            print(f'[YOLO] ⚠ 检测到跌倒! 置信度: {confidence:.2f}')

        self.last_posture = current_posture

        return {
            'posture': current_posture,
            'fall_detected': fall_detected,
            'confidence': round(confidence, 2),
        }
