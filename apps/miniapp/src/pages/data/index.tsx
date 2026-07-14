import { View, Text, Picker } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { trpc } from '../../utils/trpc'

export default function Data() {
  const [patients, setPatients] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [vitals, setVitals] = useState<any[]>([])

  useEffect(() => {
    trpc.patient.list.query({ pageSize: 100, status: 'active' }).then(r => {
      setPatients(r || [])
      if (r && r.length > 0) setSelectedId(r[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    trpc.data.latest.query({ patientId: selectedId }).then(r => setVitals(r || []))
  }, [selectedId])

  const selectedName = patients.find(p => p.id === selectedId)?.name || ''

  return (
    <View className='page'>
      <Picker mode='selector' range={patients.map(p => p.name)} onChange={e => setSelectedId(patients[Number(e.detail.value)]?.id)}>
        <View className='picker'>当前患者: {selectedName}</View>
      </Picker>
      {vitals.length === 0 && <Text className='empty'>暂无数据</Text>}
      {vitals.map(v => (
        <View key={v.metric} className='vital-item'>
          <Text className='vital-metric'>{v.metric}</Text>
          <Text className='vital-value'>{v.value} {v.unit}</Text>
        </View>
      ))}
    </View>
  )
}
