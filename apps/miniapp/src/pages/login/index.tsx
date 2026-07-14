import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { trpc } from '../../utils/trpc'

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function handleWechatLogin() {
    setLoading(true)
    try {
      const { code } = await Taro.login()
      // In a real app: send code to backend, get JWT back
      // For now, demo mode: register with a default account
      try {
        const result = await trpc.auth.register.mutate({
          username: `wx_${Date.now()}`,
          password: 'wechat_demo',
          displayName: '微信用户',
        })
        Taro.setStorageSync('token', result.accessToken)
        Taro.setStorageSync('refreshToken', result.refreshToken)
        Taro.redirectTo({ url: '/pages/index/index' })
      } catch {
        // Already registered — try login
        const result = await trpc.auth.login.mutate({
          username: 'demo',
          password: 'demo123',
        })
        Taro.setStorageSync('token', result.accessToken)
        Taro.setStorageSync('refreshToken', result.refreshToken)
        Taro.redirectTo({ url: '/pages/index/index' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login'>
      <View className='logo'>
        <Text className='logo-text'>IOMTea</Text>
        <Text className='logo-sub'>健康数据平台</Text>
      </View>

      <Button
        className='wechat-btn'
        type='primary'
        loading={loading}
        onClick={handleWechatLogin}
      >
        微信一键登录
      </Button>
    </View>
  )
}
