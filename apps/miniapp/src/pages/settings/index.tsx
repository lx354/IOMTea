import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { trpc } from '../../utils/trpc'

export default function Settings() {
  const [serverUrl, setServerUrl] = useState(Taro.getStorageSync('server_url') || 'http://localhost:3000')

  const save = () => {
    Taro.setStorageSync('server_url', serverUrl)
    Taro.showToast({ title: '已保存', icon: 'success' })
  }

  const logout = () => {
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('refreshToken')
    Taro.redirectTo({ url: '/pages/login/index' })
  }

  const testConn = async () => {
    try {
      const r = await trpc.user.me.query()
      Taro.showToast({ title: `连接成功: ${r?.displayName || 'OK'}`, icon: 'success' })
    } catch {
      Taro.showToast({ title: '连接失败', icon: 'error' })
    }
  }

  return (
    <View className='page'>
      <View className='form-group'>
        <Text className='label'>服务器地址</Text>
        <Input value={serverUrl} onInput={e => setServerUrl(e.detail.value)} placeholder='http://localhost:3000' />
      </View>
      <Button onClick={save}>保存</Button>
      <Button onClick={testConn}>测试连接</Button>
      <Button onClick={logout} style={{ marginTop: '40px', backgroundColor: '#e03131', color: '#fff' }}>退出登录</Button>
    </View>
  )
}
