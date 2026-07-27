import json, math, random
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

SEED = 42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

BEHAVIORS = ['standing', 'sitting', 'lying', 'walking', 'falling', 'sitting_up', 'wandering']
N_KEYPOINTS = 17
INPUT_DIM = N_KEYPOINTS * 2  # 34

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
        (0.50, 0.85), (0.30, 0.88), (0.70, 0.88), (0.28, 0.90), (0.72, 0.90),
        (0.30, 0.94), (0.70, 0.94), (0.38, 0.88), (0.62, 0.88),
        (0.38, 0.94), (0.62, 0.94), (0.38, 0.98), (0.62, 0.98),
    ], [(0.47, 0.84), (0.53, 0.84), (0.44, 0.85), (0.56, 0.85)]),
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
        (0.55, 0.10), (0.38, 0.25), (0.62, 0.25), (0.38, 0.38), (0.62, 0.38),
        (0.42, 0.48), (0.58, 0.48), (0.42, 0.50), (0.58, 0.50),
        (0.40, 0.72), (0.60, 0.70), (0.40, 0.93), (0.58, 0.88),
    ], [(0.50, 0.08), (0.56, 0.07), (0.46, 0.09), (0.60, 0.075)]),
}


def normalize_pose_vector(flat):
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


def generate_samples(template, n=3000):
    arr = np.array(template, dtype=np.float32)
    samples = []
    for _ in range(n):
        # Gaussian noise: more for low-confidence keypoints
        confidences = np.random.uniform(0.5, 1.0, len(arr))
        noise_scale = 0.02 + (1.0 - confidences) * 0.08  # low conf → high noise
        noise = np.random.normal(0, 1, arr.shape).astype(np.float32)
        noise[:, 0] *= noise_scale
        noise[:, 1] *= noise_scale
        noisy = arr + noise

        # Body scaling
        noisy[:, 0] *= np.random.uniform(0.82, 1.18)
        noisy[:, 1] *= np.random.uniform(0.82, 1.18)

        # Rotation
        angle = np.random.uniform(-0.10, 0.10)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        rotated = noisy.copy()
        for i in range(len(noisy)):
            x, y = noisy[i][0] - 0.5, noisy[i][1] - 0.5
            rotated[i][0] = x * cos_a - y * sin_a + 0.5
            rotated[i][1] = x * sin_a + y * cos_a + 0.5

        # Horizontal position shift
        rotated[:, 0] += np.random.uniform(-0.4, 0.4)

        # Perspective-like: stretch one side more than the other
        if random.random() < 0.3:
            stretch = np.random.uniform(0.85, 1.15)
            for i in range(len(rotated)):
                if rotated[i][0] > 0.5:
                    rotated[i][0] = 0.5 + (rotated[i][0] - 0.5) * stretch

        rotated = np.clip(rotated, 0, 1)

        # Occlusion (keypoint dropout)
        n_occ = random.randint(0, 4)
        if n_occ > 0:
            for idx in random.sample(range(len(rotated)), n_occ):
                rotated[idx] = [0.0, 0.0]

        flat = normalize_pose_vector(rotated.flatten())
        samples.append(flat)
    return np.array(samples)


class ResidualBlock(nn.Module):
    def __init__(self, dim, dropout=0.2):
        super().__init__()
        self.lin = nn.Linear(dim, dim)
        self.bn = nn.BatchNorm1d(dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        return x + self.dropout(F.relu(self.bn(self.lin(x))))


class ResMLP(nn.Module):
    def __init__(self, input_dim=INPUT_DIM, hidden=256, num_classes=7):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.BatchNorm1d(hidden),
            nn.ReLU(),
            nn.Dropout(0.3),
        )
        self.res1 = ResidualBlock(hidden, 0.3)
        self.res2 = ResidualBlock(hidden, 0.2)
        self.res3 = ResidualBlock(hidden, 0.15)
        self.output = nn.Linear(hidden, num_classes)

    def forward(self, x):
        x = self.input_proj(x)
        x = self.res1(x)
        x = self.res2(x)
        x = self.res3(x)
        return self.output(x)


def main():
    OUT_DIR = Path(__file__).resolve().parent.parent / 'apps' / 'server' / 'models'
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    SAMPLES_PER = 1500
    print(f'Generating data ({N_KEYPOINTS} kp, {SAMPLES_PER * 7} samples)...')
    X_list, y_list = [], []
    for li, b in enumerate(BEHAVIORS):
        s = generate_samples(TEMPLATES[b], n=SAMPLES_PER)
        X_list.append(s); y_list.append(np.full(len(s), li))
        print(f'  {b}: {len(s)}')

    X = np.concatenate(X_list); y = np.concatenate(y_list)
    print(f'Total: {len(X)} samples, {INPUT_DIM} features')

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    idx = np.random.permutation(len(X))
    sp = int(len(X) * 0.8)
    Xtr, ytr = X_scaled[idx[:sp]], y[idx[:sp]]
    Xvl, yvl = X_scaled[idx[sp:]], y[idx[sp:]]

    tr = DataLoader(TensorDataset(torch.from_numpy(Xtr).float(), torch.from_numpy(ytr).long()),
                    batch_size=128, shuffle=True)
    vl = DataLoader(TensorDataset(torch.from_numpy(Xvl).float(), torch.from_numpy(yvl).long()),
                    batch_size=128)

    model = ResMLP(input_dim=INPUT_DIM, hidden=256, num_classes=7)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.002, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer, T_0=20, T_mult=2, eta_min=1e-5)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    best, best_ep = 0.0, 0
    print(f'\nTraining (ResMLP, {SAMPLES_PER}/class, 150 epochs, label_smoothing=0.1)...')
    for ep in range(60):
        model.train(); tl = 0
        for bx, by in tr:
            optimizer.zero_grad()
            loss = criterion(model(bx), by)
            loss.backward()
            optimizer.step()
            tl += loss.item()
        scheduler.step()

        model.eval(); c, t = 0, 0
        with torch.no_grad():
            for bx, by in vl:
                preds = model(bx).argmax(dim=1)
                c += (preds == by).sum().item(); t += by.size(0)
        acc = c / t
        if acc > best: best = acc; best_ep = ep + 1
        if (ep + 1) % 15 == 0 or ep == 0:
            print(f'  ep {ep + 1:3d}  loss={tl / len(tr):.4f}  val_acc={acc:.4f}  lr={scheduler.get_last_lr()[0]:.6f}')

    print(f'\nBest: {best:.4f} @ epoch {best_ep}')

    model.eval()
    dummy = torch.randn(1, INPUT_DIM)
    torch.onnx.export(model, dummy, str(OUT_DIR / 'behavior-classifier.onnx'),
                      input_names=['input'], output_names=['output'],
                      dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}}, opset_version=14)

    (OUT_DIR / 'behavior-scaler.json').write_text(json.dumps(
        {'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(), 'n_keypoints': N_KEYPOINTS}, indent=2))
    (OUT_DIR / 'behavior-meta.json').write_text(json.dumps(
        {'behaviors': BEHAVIORS, 'keypoints': KEY_NAMES, 'input_shape': [1, INPUT_DIM],
         'accuracy': round(best, 4), 'model': 'ResMLP'},
        indent=2, ensure_ascii=False))
    print('Done')


if __name__ == '__main__':
    main()
