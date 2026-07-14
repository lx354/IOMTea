import json
import math
import random
from pathlib import Path
from typing import Literal

import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

FEATURE_DIMS = [
    'heart_rate', 'spo2', 'temperature', 'systolic_bp', 'diastolic_bp',
    'glucose', 'motion_index', 'posture', 'night_wandering',
    'repetitive_behavior', 'wandering_risk',
]

THRESHOLDS = {
    'heart_rate':       (60, 100, 50, 120, 0, 200),
    'spo2':             (95, 100, 90, 94, 0, 89),
    'temperature':      (36.1, 37.2, 35.5, 38.0, 0, 42),
    'systolic_bp':      (90, 130, 80, 160, 0, 200),
    'diastolic_bp':     (60, 85, 50, 100, 0, 150),
    'glucose':          (3.9, 6.1, 3.0, 7.0, 0, 30),
    'motion_index':     (0.3, 10, 0.1, 10, 0, 10),
    'night_wandering':  (0, 1, 0, 3, 0, 10),
    'repetitive_behavior': (0, 2, 0, 6, 0, 10),
    'wandering_risk':   (0, 2, 0, 6, 0, 10),
}

PROFILES = {
    'elderly-cardiac': {
        'heart_rate': (78, 8), 'spo2': (96, 2), 'temperature': (36.5, 0.3),
        'systolic_bp': (135, 10), 'diastolic_bp': (85, 6), 'glucose': (5.8, 1.2),
        'respiratory_rate': (16, 3),
    },
    'diabetes': {
        'heart_rate': (72, 7), 'spo2': (97, 1.5), 'temperature': (36.5, 0.3),
        'systolic_bp': (130, 8), 'diastolic_bp': (82, 5), 'glucose': (6.5, 1.5),
        'respiratory_rate': (16, 3),
    },
    'post-surgery': {
        'heart_rate': (82, 10), 'spo2': (95, 2), 'temperature': (36.6, 0.4),
        'systolic_bp': (125, 12), 'diastolic_bp': (80, 7), 'glucose': (5.5, 0.8),
        'respiratory_rate': (18, 4),
    },
    'copd-respiratory': {
        'heart_rate': (85, 10), 'spo2': (93, 3), 'temperature': (36.6, 0.4),
        'systolic_bp': (128, 10), 'diastolic_bp': (78, 6), 'glucose': (5.6, 0.8),
        'respiratory_rate': (22, 5),
    },
    'maternity': {
        'heart_rate': (75, 9), 'spo2': (98, 1.5), 'temperature': (36.7, 0.3),
        'systolic_bp': (110, 8), 'diastolic_bp': (70, 5), 'glucose': (4.8, 0.5),
        'respiratory_rate': (17, 3),
    },
}


def gaussian(mean: float, std: float) -> float:
    return random.gauss(mean, std)


def circadian(hour: int) -> float:
    return math.sin(((hour - 6) / 24) * 2 * math.pi) * 0.15


def gen_vital(metric: str, mean: float, std: float, hour: int) -> float:
    """Mirror TypeScript generators in physiology.ts"""
    if metric == 'heart_rate':
        c = circadian(hour) * 10
        return max(30, min(220, round(gaussian(mean + c, std))))
    if metric == 'spo2':
        return max(70, min(100, round(gaussian(mean, std))))
    if metric == 'temperature':
        c = circadian(hour) * 0.5
        return round(max(34, min(42, gaussian(mean + c, std))), 1)
    if metric == 'systolic_bp':
        c = circadian(hour) * 5
        return max(70, min(220, round(gaussian(mean + c, std))))
    if metric == 'diastolic_bp':
        c = circadian(hour) * 3
        return max(40, min(130, round(gaussian(mean + c, std))))
    if metric == 'glucose':
        return round(max(2.0, min(25.0, gaussian(mean, std))), 1)
    return mean


def gen_behavior(metric: str, hour: int) -> float:
    if metric == 'motion_index':
        return round(max(0, min(1, random.random() * 0.8 + 0.05)), 2)
    if metric == 'posture':
        return random.choice([0, 1, 2, 3])  # standing=0, sitting=1, lying=2, walking=3
    if metric == 'night_wandering':
        is_night = hour >= 22 or hour <= 6
        if not is_night:
            return 0
        return max(0, min(8, round(gaussian(1.5, 1.2))))
    if metric == 'repetitive_behavior':
        return max(0, min(10, round(gaussian(2, 1.5))))
    if metric == 'wandering_risk':
        base = 3 if 10 <= hour <= 16 else 1.5
        return max(0, min(10, round(gaussian(base, 1.5))))
    return 0


def label_row(row: list[float]) -> int:
    """Replicate evaluatePatientState logic → 0=stable 1=watch 2=alert 3=emergency"""
    warning = 0
    critical = 0
    for i, dim in enumerate(FEATURE_DIMS):
        if dim == 'posture':
            continue
        threshold = THRESHOLDS.get(dim)
        if not threshold:
            continue
        nmin, nmax, wlo, whi, clo, chi = threshold
        v = row[i]
        if (clo is not None and v < clo) or (chi is not None and v > chi):
            if not (nmin <= v <= nmax):
                critical += 1
                continue
        if nmin <= v <= nmax:
            continue
        if wlo is not None and v < wlo:
            warning += 1
        elif whi is not None and v > nmax:
            if v <= whi:
                warning += 1
            else:
                critical += 1
        elif v < nmin:
            warning += 1 if v >= (wlo or 0) else 0
        elif v > nmax:
            warning += 1 if v <= (whi or 999) else 0

    if critical:
        return 3  # emergency
    if warning >= 3:
        return 2  # alert
    if warning >= 2:
        return 2  # alert
    if warning >= 1:
        return 1  # watch
    return 0  # stable


def generate_profile_data(profile_name: str, n_steps: int = 1440) -> list[list[float]]:
    """Generate n_steps minutes of data for a profile"""
    p = PROFILES[profile_name]
    rows = []
    for t in range(n_steps):
        hour = (t // 60) % 24
        row = []
        row.append(gen_vital('heart_rate', *p['heart_rate'], hour))
        row.append(gen_vital('spo2', *p['spo2'], hour))
        row.append(gen_vital('temperature', *p['temperature'], hour))
        row.append(gen_vital('systolic_bp', *p['systolic_bp'], hour))
        row.append(gen_vital('diastolic_bp', *p['diastolic_bp'], hour))
        row.append(gen_vital('glucose', *p['glucose'], hour))
        for bm in ['motion_index', 'posture', 'night_wandering', 'repetitive_behavior', 'wandering_risk']:
            row.append(gen_behavior(bm, hour))
        rows.append(row)
    return rows


def inject_scenarios(rows: list[list[float]], pct: float = 0.08) -> list[list[float]]:
    """Inject anomalous values into ~pct of rows to create emergency/alert samples"""
    scenarios = [
        {'idx': 0, 'values': [155, 180, 48, 210]},     # heart_rate extreme
        {'idx': 1, 'values': [82, 85, 88, 78]},          # spo2 low
        {'idx': 3, 'values': [75, 78, 82, 68, 205]},     # systolic_bp abnormal
        {'idx': 5, 'values': [2.3, 2.8, 13.5, 18.0]},   # glucose extreme
        {'idx': 8, 'values': [5, 7, 4, 6]},              # night_wandering high
        {'idx': 10, 'values': [8, 9, 7, 10]},            # wandering_risk high
    ]
    result = [row[:] for row in rows]
    n = len(result)
    inject_count = int(n * pct)
    for _ in range(inject_count):
        s = random.choice(scenarios)
        row_idx = random.randrange(n)
        val = random.choice(s['values'])
        result[row_idx][s['idx']] = val
    return result


def build_windows(rows: list[list[float]], window_size: int = 10) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for i in range(window_size, len(rows)):
        window = np.array(rows[i - window_size : i], dtype=np.float32)
        X.append(window)
        y.append(label_row(rows[i]))
    return np.array(X), np.array(y, dtype=np.int64)


def balance_classes(X: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Downsample majority class (stable) to prevent bias"""
    unique, counts = np.unique(y, return_counts=True)
    min_count = max(counts.min(), 500)
    X_bal, y_bal = [], []
    for cls in unique:
        idx = np.where(y == cls)[0]
        if len(idx) > min_count:
            idx = np.random.choice(idx, min_count, replace=False)
        X_bal.append(X[idx])
        y_bal.append(y[idx])
    return np.concatenate(X_bal), np.concatenate(y_bal)


class RiskLSTM(nn.Module):
    def __init__(self, input_dim: int = 11, hidden_dim: int = 64, num_classes: int = 4):
        super().__init__()
        self.lstm1 = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.dropout = nn.Dropout(0.3)
        self.lstm2 = nn.LSTM(hidden_dim, hidden_dim // 2, batch_first=True)
        self.fc = nn.Linear(hidden_dim // 2, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x, _ = self.lstm1(x)
        x = self.dropout(x)
        x, _ = self.lstm2(x)
        x = self.fc(x[:, -1, :])
        return x


def main():
    OUT_DIR = Path(__file__).resolve().parent.parent / 'apps' / 'server' / 'models'
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print('Generating training data ...')
    all_rows: list[list[float]] = []
    for pname in PROFILES:
        rows = generate_profile_data(pname, n_steps=2880)  # 2 days per profile
        rows = inject_scenarios(rows, pct=0.10)
        all_rows.extend(rows)
        print(f'  {pname}: {len(rows)} rows')

    print(f'Total rows: {len(all_rows)}')

    # Normalize
    arr = np.array(all_rows, dtype=np.float32)
    scaler = StandardScaler()
    arr_scaled = scaler.fit_transform(arr)

    print('Building windows ...')
    X, y = build_windows(arr_scaled.tolist(), window_size=10)
    print(f'Windows: {len(X)}')

    labels, counts = np.unique(y, return_counts=True)
    names = ['stable', 'watch', 'alert', 'emergency']
    for l, c in zip(labels, counts):
        print(f'  {names[l]}: {c}')

    # Balance
    X, y = balance_classes(X, y)
    print(f'Balanced samples: {len(X)}')

    # Split
    n = len(X)
    indices = np.random.permutation(n)
    split = int(n * 0.8)
    X_train, y_train = X[indices[:split]], y[indices[:split]]
    X_val, y_val = X[indices[split:]], y[indices[split:]]
    print(f'Train: {len(X_train)}, Val: {len(X_val)}')

    # DataLoaders
    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))
    train_loader = DataLoader(train_ds, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=64)

    # Model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = RiskLSTM().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    print(f'\nTraining on {device} ...')
    best_acc = 0.0
    for epoch in range(30):
        model.train()
        total_loss = 0.0
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            out = model(bx)
            loss = criterion(out, by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for bx, by in val_loader:
                bx, by = bx.to(device), by.to(device)
                pred = model(bx).argmax(dim=1)
                correct += (pred == by).sum().item()
                total += by.size(0)
        acc = correct / total
        if acc > best_acc:
            best_acc = acc
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f'  epoch {epoch + 1:2d}  loss={total_loss / len(train_loader):.4f}  val_acc={acc:.4f}')

    print(f'\nBest val accuracy: {best_acc:.4f}')

    # Export ONNX
    onnx_path = OUT_DIR / 'risk-lstm.onnx'
    model.eval()
    dummy = torch.randn(1, 10, 11).to(device)
    torch.onnx.export(
        model,
        dummy,
        str(onnx_path),
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=14,
    )
    print(f'\nONNX model exported to: {onnx_path}')

    # Save scaler params
    scaler_path = OUT_DIR / 'risk-scaler.json'
    scaler_path.write_text(json.dumps({
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'feature_order': FEATURE_DIMS,
    }, indent=2))
    print(f'Scaler saved to: {scaler_path}')

    # Save model metadata
    meta_path = OUT_DIR / 'risk-model-meta.json'
    meta_path.write_text(json.dumps({
        'input_shape': [1, 10, 11],
        'output_size': 4,
        'classes': ['stable', 'watch', 'alert', 'emergency'],
        'window_size': 10,
        'feature_order': FEATURE_DIMS,
        'python_model_file': str(Path(__file__).resolve()),
        'accuracy': round(best_acc, 4),
    }, indent=2))
    print(f'Metadata saved to: {meta_path}')


if __name__ == '__main__':
    main()
