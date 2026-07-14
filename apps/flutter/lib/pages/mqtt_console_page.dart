import 'package:flutter/material.dart';
import 'package:mqtt_client/mqtt_client.dart';
import '../services/mqtt_service.dart';

class MqttConsolePage extends StatefulWidget {
  const MqttConsolePage({super.key});
  @override
  State<MqttConsolePage> createState() => _MqttConsolePageState();
}

class _MqttConsolePageState extends State<MqttConsolePage> {
  final _topicCtrl = TextEditingController(text: 'device/test/status');
  final _payloadCtrl = TextEditingController(text: '{"msg":"hello"}');
  final List<String> _log = [];

  void _send() {
    final t = _topicCtrl.text.trim();
    final p = _payloadCtrl.text.trim();
    if (t.isEmpty || p.isEmpty) return;
    try {
      MqttService.instance.publish(topic: t, message: p, qos: MqttQos.atMostOnce);
      setState(() => _log.insert(0, '[${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, "0")}] UP $t'));
    } catch (e) {
      setState(() => _log.insert(0, '[ERR] $e'));
    }
  }

  @override
  void dispose() { _topicCtrl.dispose(); _payloadCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('MQTT'), actions: [IconButton(icon: const Icon(Icons.clear_all), onPressed: () => setState(() => _log.clear()))]),
    body: Column(children: [
      Padding(padding: const EdgeInsets.all(12), child: Column(children: [
        TextField(controller: _topicCtrl, decoration: const InputDecoration(labelText: 'Topic', border: OutlineInputBorder(), isDense: true), style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
        const SizedBox(height: 8),
        TextField(controller: _payloadCtrl, decoration: const InputDecoration(labelText: 'Payload', border: OutlineInputBorder(), isDense: true), maxLines: 2, style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
        const SizedBox(height: 8),
        SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: _send, icon: const Icon(Icons.send, size: 16), label: const Text('发送'))),
      ])),
      const Divider(height: 1),
      Expanded(child: _log.isEmpty ? const Center(child: Text('MQTT 消息', style: TextStyle(color: Colors.grey))) : ListView.builder(itemCount: _log.length, itemBuilder: (_, i) => Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: Text(_log[i], style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: _log[i].startsWith('[ERR]') ? Colors.red : Colors.grey.shade700))))),
    ]),
  );
}
