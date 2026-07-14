"""Pose detector: image → YOLO11-pose → 17 COCO keypoints → JSON
Usage: python detect_pose.py <image_path>
Output: JSON with detected persons and their keypoints

Requirements: pip install ultralytics
"""
import json
import sys
from pathlib import Path
from ultralytics import YOLO

MODEL_DIR = Path(__file__).resolve().parent.parent / 'apps' / 'server' / 'models'
MODEL_PATH = MODEL_DIR / 'yolo11n-pose.onnx'

# COCO keypoint names (17)
KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
]


def normalize_keypoints(kpts, img_w, img_h):
    """Normalize keypoints to [0, 1] range"""
    result = {}
    for i, name in enumerate(KEYPOINT_NAMES):
        x = kpts[i][0]
        y = kpts[i][1]
        result[name] = [round(x / img_w, 4), round(y / img_h, 4)]
    return result


def detect(image_path: str):
    """Detect persons and return keypoints"""
    is_url = image_path.startswith('http://') or image_path.startswith('https://')
    if not is_url and not Path(image_path).exists():
        return {'error': f'File not found: {image_path}', 'persons': []}

    model = YOLO(str(MODEL_PATH))  # Use ONNX model
    results = model(image_path, verbose=False)

    persons = []
    for result in results:
        if result.keypoints is None or result.keypoints.data is None:
            continue

        img_h, img_w = result.orig_shape
        kpts_data = result.keypoints.data  # Tensor [N, 17, 3]

        for i, person_kpts in enumerate(kpts_data):
            kpts_xy = person_kpts[:, :2].tolist()  # [17, 2]
            confs = person_kpts[:, 2].tolist()       # [17]
            avg_conf = sum(confs) / len(confs) if confs else 0
            keypoints = normalize_keypoints(kpts_xy, img_w, img_h)

            # Also compute bounding box from keypoints
            xs = [k[0] for k in kpts_xy]
            ys = [k[1] for k in kpts_xy]
            persons.append({
                'id': i,
                'keypoints': keypoints,
                'confidence': round(avg_conf, 4),
                'bbox': {
                    'x': round(min(xs) / img_w, 4),
                    'y': round(min(ys) / img_h, 4),
                    'w': round((max(xs) - min(xs)) / img_w, 4),
                    'h': round((max(ys) - min(ys)) / img_h, 4),
                },
            })

    return {'persons': persons, 'count': len(persons), 'image_size': [img_w, img_h]}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python detect_pose.py <image_path>', 'persons': []}))
        sys.exit(1)

    result = detect(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False))
