import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import './index.scss'

export default function Index() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
    } else {
      setLoggedIn(true)
    }
  }, [])

  if (!loggedIn) return null

  return (
    <View className='index'>
      <View className='header'>
        <Text className='title'>IOMTea</Text>
        <Text className='subtitle'>健康数据平台</Text>
      </View>

      <View className='cards'>
        <View className='card' onClick={() => Taro.navigateTo({ url: '/pages/alerts/index' })}>
          <Text className='card-icon'>🔔</Text>
          <Text className='card-title'>告警中心</Text>
          <Text className='card-desc'>查看实时告警通知</Text>
        </View>

        <View className='card' onClick={() => Taro.navigateTo({ url: '/pages/devices/index' })}>
          <Text className='card-icon'>📱</Text>
          <Text className='card-title'>设备管理</Text>
          <Text className='card-desc'>绑定与管理设备</Text>
        </View>

        <View className='card' onClick={() => Taro.navigateTo({ url: '/pages/data/index' })}>
          <Text className='card-icon'>📊</Text>
          <Text className='card-title'>健康数据</Text>
          <Text className='card-desc'>查看体征趋势</Text>
        </View>

        <View className='card' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <Text className='card-icon'>⚙️</Text>
          <Text className='card-title'>系统设置</Text>
          <Text className='card-desc'>配置与个人信息</Text>
        </View>
      </View>
    </View>
  )
}
