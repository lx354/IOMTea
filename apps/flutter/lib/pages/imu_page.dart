import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../services/imu_sensor_service.dart';
import '../widgets/imu_waveform.dart';

class ImuPage extends StatefulWidget {
  const ImuPage({super.key});
  @override
  State<ImuPage> createState() => _ImuPageState();
}

class _ImuPageState extends State<ImuPage> {
  final _sensor = ImuSensorService();
  StreamSubscription<ImuData>? _sub;
  final List<ImuData> _history = [];
  ImuData? _latest;
  bool _running = false;
  int _sampleCount = 0;

  void _toggle() {
    if (_running) {
      _sub?.cancel(); _sub = null; _sensor.stop();
    } else {
      _sensor.start();
      _sub = _sensor.dataStream.listen((d) {
        setState(() { _latest = d; _history.add(d); _sampleCount++; if (_history.length > 500) _history.removeAt(0); });
      });
    }
    setState(() => _running = !_running);
  }

  @override
  void dispose() { _sub?.cancel(); _sensor.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final mag = _latest?.accelMagnitude ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('IMU 运动监测')),
      body: Column(children: [
        Card(
          margin: const EdgeInsets.all(16),
          child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
            Icon(Icons.sensors, color: _running ? Colors.green : Colors.grey, size: 28),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_running ? '采集中' : '已停止', style: TextStyle(fontWeight: FontWeight.w600, color: _running ? Colors.green : Colors.grey)),
              Text('$_sampleCount 样本 · ${mag.toStringAsFixed(2)} m/s²', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            ]),
            const Spacer(),
            FilledButton.tonal(onPressed: _toggle, child: Text(_running ? '停止' : '开始')),
          ])),
        ),
        if (_latest != null) ...[
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            child: Padding(padding: const EdgeInsets.all(16), child: SizedBox(height: 180, child: ImuWaveform(data: _history))),
          ),
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _Stat('X', _latest!.accelX), _Stat('Y', _latest!.accelY), _Stat('Z', _latest!.accelZ),
            _Stat('陀螺', _latest!.gyroMagnitude),
          ]),
        ] else
          const Expanded(child: Center(child: Text('点击开始监测'))),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label; final double value;
  const _Stat(this.label, this.value);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24),
    child: Column(children: [
      Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      Text(value.toStringAsFixed(2), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
    ]),
  );
}
