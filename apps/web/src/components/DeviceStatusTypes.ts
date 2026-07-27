export interface DeviceStatus {
  id: string; name: string; type: string; pin: string; room: string
  status: 'online' | 'offline' | 'fault' | 'unknown'
  lastSeen: string | null; battery: number | null
  signalStrength: number | null; alertCount: number
  realtimeData?: { smoke: number | null; gas: number | null; temp: number | null; humidity: number | null }
  triggers?: { type: string; time: string; value: string }[]
  behavior?: { posture: string; activity: string; events: string[] }
}

const DEVICE_TYPES: Record<string, { icon: string; label: string; category: 'emergency' | 'safety' | 'life' | 'camera' }> = {
  emergency_button: { icon: '🆘', label: '紧急按钮', category: 'emergency' },
  pull_cord: { icon: '🪢', label: '拉绳报警器', category: 'emergency' },
  call_terminal: { icon: '📞', label: '智能呼叫终端', category: 'emergency' },
  smoke: { icon: '🔥', label: '烟感报警器', category: 'safety' },
  gas: { icon: '💨', label: '燃气报警器', category: 'safety' },
  door_sensor: { icon: '🚪', label: '门窗传感器', category: 'safety' },
  water_leak: { icon: '💧', label: '水浸传感器', category: 'safety' },
  temp_humidity: { icon: '🌡', label: '温湿度传感器', category: 'safety' },
  smart_meter: { icon: '⚡', label: '智能表计', category: 'life' },
  vibration: { icon: '📳', label: '震动传感器', category: 'life' },
  depth_camera: { icon: '📷', label: '深度相机', category: 'camera' },
  mattress: { icon: '🛏', label: '智能床垫', category: 'life' },
}

export function getDeviceTypeInfo(type: string) {
  return DEVICE_TYPES[type] || { icon: '📡', label: type, category: 'life' as const }
}
