import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { trpc } from '../../utils/trpc'

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    trpc.alert.list.query({ pageSize: 50 }).then(r => setAlerts(r || []))
  }, [])

  const severityColor: Record<string, string> = { critical: '#e03131', warning: '#f08c00', info: '#1971c2' }

  return (
    <View className='page'>
      {alerts.length === 0 && <Text className='empty'>无告警记录</Text>}
      {alerts.map(a => (
        <View key={a.id} className='alert-item' style={{ borderLeftColor: severityColor[a.severity] || '#999' }}>
          <Text className='alert-type'>{a.metric}</Text>
          <Text className='alert-severity' style={{ color: severityColor[a.severity] }}>{a.severity}</Text>
          <Text className='alert-time'>{new Date(a.recordedAt).toLocaleString()}</Text>
          <Text className='alert-status'>{a.status === 'active' ? '● 活跃' : a.status === 'acknowledged' ? '○ 已确认' : '✓ 已解决'}</Text>
        </View>
      ))}
    </View>
  )
}
