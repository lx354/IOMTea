import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class VisionPage extends StatefulWidget {
  const VisionPage({super.key});
  @override
  State<VisionPage> createState() => _VisionPageState();
}

class _VisionPageState extends State<VisionPage> {
  static const _modelPath = 'assets/models/yolo11n_int8.tflite';
  bool _active = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('视觉检测')),
    body: Column(children: [
      Expanded(
        flex: 3,
        child: _active
          ? YOLOView(modelPath: _modelPath, task: YOLOTask.detect)
          : Container(color: Colors.grey.shade900, alignment: Alignment.center, child: const Icon(Icons.videocam_off, size: 48, color: Colors.white38)),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: FilledButton.icon(
          onPressed: () => setState(() => _active = !_active),
          icon: Icon(_active ? Icons.stop : Icons.play_arrow),
          label: Text(_active ? '停止' : '开始检测'),
        ),
      ),
    ]),
  );
}
