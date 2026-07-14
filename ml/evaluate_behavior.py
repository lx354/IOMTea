"""
行为识别模型自我评估脚本
利用模拟引擎生成 7 类行为测试数据，送入 behavior-classifier.onnx 评估
"""
import json, math, random, time
from pathlib import Path
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

SEED = int(time.time())
random.seed(SEED); np.random.seed(SEED)

N_KEYPOINTS = 17
BEHAVIORS = ['standing', 'sitting', 'lying', 'walking', 'falling', 'sitting_up', 'wandering']
BEHAVIOR_CN = ['站立', '坐', '躺', '行走', '跌倒', '起身', '徘徊']

# 关键点模板
KEY_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
]

FACE = [(0.47, 0.07), (0.53, 0.07), (0.43, 0.075), (0.57, 0.075)]

def build(base, faces):
    return [base[0]] + faces + list(base[1:])

TEMPLATES = {
    'standing': build([
        (0.50, 0.10), (0.40, 0.25), (0.60, 0.25), (0.35, 0.40), (0.65, 0.40),
        (0.30, 0.55), (0.70, 0.55), (0.42, 0.50), (0.58, 0.50),
        (0.42, 0.70), (0.58, 0.70), (0.42, 0.90), (0.58, 0.90),
    ], FACE),
    'sitting': build([
        (0.50, 0.15), (0.38, 0.30), (0.62, 0.30), (0.32, 0.48), (0.68, 0.48),
        (0.28, 0.55), (0.72, 0.55), (0.42, 0.45), (0.58, 0.45),
        (0.42, 0.58), (0.58, 0.58), (0.42, 0.72), (0.58, 0.72),
    ], [(0.47, 0.12), (0.53, 0.12), (0.43, 0.125), (0.57, 0.125)]),
    'lying': build([
        (0.50, 0.80), (0.25, 0.82), (0.75, 0.82), (0.15, 0.85), (0.85, 0.85),
        (0.05, 0.88), (0.95, 0.88), (0.35, 0.90), (0.65, 0.90),
        (0.35, 0.92), (0.65, 0.92), (0.35, 0.95), (0.65, 0.95),
    ], [(0.47, 0.79), (0.53, 0.79), (0.43, 0.795), (0.57, 0.795)]),
    'walking': build([
        (0.50, 0.10), (0.40, 0.25), (0.60, 0.25), (0.33, 0.42), (0.67, 0.42),
        (0.28, 0.58), (0.72, 0.58), (0.42, 0.50), (0.58, 0.50),
        (0.42, 0.70), (0.55, 0.65), (0.42, 0.90), (0.50, 0.78),
    ], FACE),
    'falling': build([
        (0.50, 0.92), (0.22, 0.85), (0.75, 0.90), (0.10, 0.92), (0.78, 0.86),
        (0.03, 0.97), (0.88, 0.82), (0.38, 0.88), (0.62, 0.95),
        (0.28, 0.96), (0.66, 0.91), (0.22, 0.99), (0.72, 0.94),
    ], [(0.47, 0.91), (0.52, 0.90), (0.44, 0.915), (0.56, 0.91)]),
    'sitting_up': build([
        (0.50, 0.30), (0.35, 0.40), (0.65, 0.40), (0.28, 0.55), (0.72, 0.55),
        (0.22, 0.68), (0.78, 0.68), (0.42, 0.48), (0.58, 0.48),
        (0.40, 0.62), (0.60, 0.62), (0.38, 0.78), (0.62, 0.78),
    ], [(0.47, 0.27), (0.53, 0.27), (0.43, 0.275), (0.57, 0.275)]),
    'wandering': build([
        (0.50, 0.10), (0.38, 0.25), (0.62, 0.25), (0.30, 0.45), (0.70, 0.42),
        (0.25, 0.62), (0.75, 0.58), (0.42, 0.50), (0.58, 0.50),
        (0.40, 0.70), (0.60, 0.68), (0.40, 0.90), (0.56, 0.82),
    ], FACE),
}


def normalize_pose(flat):
    lhx, lhy = flat[22], flat[23]; rhx, rhy = flat[24], flat[25]
    hip_x = (lhx + rhx) / 2.0 if (lhx + rhx) > 0.01 else 0.5
    hip_y = (lhy + rhy) / 2.0 if (lhy + rhy) > 0.01 else 0.5
    shoulder_y = ((flat[10] + flat[12]) / 2.0 if (flat[10] + flat[12]) > 0.01 else 0)
    torso_len = max(0.01, abs(shoulder_y - hip_y))
    result = flat.copy()
    for i in range(N_KEYPOINTS):
        xi, yi = i * 2, i * 2 + 1
        if flat[xi] == 0.0 and flat[yi] == 0.0:
            result[xi] = 0.0; result[yi] = 0.0
        else:
            result[xi] = (flat[xi] - hip_x) / torso_len
            result[yi] = (flat[yi] - hip_y) / torso_len
    return result


def generate_samples(template, n=500):
    """生成带强噪声的测试样本（模拟真实 YOLO 检测误差）"""
    arr = np.array(template, dtype=np.float32)
    samples = []
    for _ in range(n):
        sigma = np.random.uniform(0.05, 0.10)  # 更大噪声模拟 YOLO 误差
        noise = np.random.normal(0, sigma, arr.shape).astype(np.float32)
        scale_x = np.random.uniform(0.80, 1.20)
        scale_y = np.random.uniform(0.80, 1.20)
        noisy = (arr + noise)
        noisy[:, 0] *= scale_x; noisy[:, 1] *= scale_y
        angle = np.random.uniform(-0.12, 0.12)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        rotated = noisy.copy()
        for i in range(len(noisy)):
            x, y = noisy[i][0] - 0.5, noisy[i][1] - 0.5
            rotated[i][0] = x * cos_a - y * sin_a + 0.5
            rotated[i][1] = x * sin_a + y * cos_a + 0.5
        shift_x = np.random.uniform(-0.4, 0.4)
        rotated[:, 0] += shift_x
        rotated = np.clip(rotated, 0, 1)
        n_occ = random.randint(0, 5)  # 更严重的遮挡
        if n_occ > 0:
            for idx in random.sample(range(len(rotated)), n_occ):
                rotated[idx] = [0.0, 0.0]
        flat = normalize_pose(rotated.flatten())
        samples.append(flat)
    return np.array(samples)


def load_scaler():
    path = Path(__file__).parent.parent / 'apps' / 'server' / 'models' / 'behavior-scaler.json'
    with open(path) as f:
        s = json.load(f)
    return np.array(s['mean']), np.array(s['scale'])


def main():
    print('=' * 60)
    print('行为识别模型 — 自我评估报告')
    print('=' * 60)

    model_path = Path(__file__).parent.parent / 'apps' / 'server' / 'models' / 'behavior-classifier.onnx'
    if not model_path.exists():
        print('[ERROR] 模型文件不存在，请先运行 ml/behavior_train.py')
        return

    mean, scale = load_scaler()

    # 加载 ONNX
    import onnxruntime as ort
    sess = ort.InferenceSession(str(model_path))

    # 生成测试数据（独立于训练集）
    print(f'\n[TEST] 生成测试数据 (每类 500 样本, 强噪声+遮挡)...')
    X_test, y_test = [], []
    for li, b in enumerate(BEHAVIORS):
        samples = generate_samples(TEMPLATES[b], n=500)
        X_test.append(samples)
        y_test.append(np.full(len(samples), li))
    X = np.concatenate(X_test); y = np.concatenate(y_test)

    # 标准化
    X_scaled = (X - mean) / scale

    # 推理
    print(f'[INFER] 推理 {len(X)} 个样本...')
    preds = []
    batch_size = 64
    for i in range(0, len(X), batch_size):
        batch = X_scaled[i:i+batch_size].astype(np.float32)
        outputs = sess.run(['output'], {'input': batch})[0]
        preds.extend(np.argmax(outputs, axis=1))

    y_pred = np.array(preds)

    # 整体指标
    acc = accuracy_score(y, y_pred)
    print(f'\n{"=" * 60}')
    print(f'整体准确率: {acc:.2%} ({acc*100:.1f}%)')
    print(f'{"=" * 60}')

    # 分类报告
    print('\n[REPORT] 分类报告:')
    print(classification_report(y, y_pred, target_names=BEHAVIOR_CN, digits=4))

    # 混淆矩阵
    cm = confusion_matrix(y, y_pred)
    print('[MATRIX] 混淆矩阵:')
    print(f'{"":>8}', end='')
    for name in BEHAVIOR_CN: print(f'{name:>6}', end='')
    print()
    for i, row in enumerate(cm):
        print(f'{BEHAVIOR_CN[i]:>6}', end='  ')
        for val in row:
            print(f'{val:>5}', end='')
        print(f'  (正确: {row[i]}/{row.sum()})')

    # 跌倒专项分析
    fall_idx = BEHAVIORS.index('falling')
    fall_tp = cm[fall_idx][fall_idx]
    fall_fn = cm[fall_idx].sum() - fall_tp
    fall_fp = cm[:, fall_idx].sum() - fall_tp
    fall_recall = fall_tp / (fall_tp + fall_fn) if (fall_tp + fall_fn) > 0 else 0
    fall_precision = fall_tp / (fall_tp + fall_fp) if (fall_tp + fall_fp) > 0 else 0

    print(f'\n{"=" * 60}')
    print(f'[FALL] 跌倒检测专项指标:')
    print(f'   精确率 (Precision): {fall_precision:.2%}  — 报警的跌倒中有多少是真跌倒')
    print(f'   召回率 (Recall):    {fall_recall:.2%}  — 真实跌倒中被检测出的比例')
    print(f'   漏报 (False Neg):   {fall_fn} 次  — 真实跌倒未被检出')
    print(f'   误报 (False Pos):   {fall_fp} 次  — 正常行为被误判为跌倒')
    print(f'{"=" * 60}')

    # 保存报告
    report = {
        'accuracy': round(float(acc), 4),
        'fall_recall': round(float(fall_recall), 4),
        'fall_precision': round(float(fall_precision), 4),
        'samples': len(X),
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
    }
    report_path = Path(__file__).parent.parent / 'apps' / 'server' / 'models' / 'behavior-eval.json'
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f'\n[DONE] 报告已保存: {report_path}')


if __name__ == '__main__':
    main()
