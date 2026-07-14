import { useState } from 'react'
import { Container, Paper, Title, TextInput, PasswordInput, Button, Text } from '@mantine/core'
import { useAuthStore } from './store/auth'
import { trpc } from './trpc'
import { notifications } from '@mantine/notifications'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const setTokens = useAuthStore((s) => s.setTokens)

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken, data.expiresAt)
      notifications.show({ title: '登录成功', message: '欢迎使用 IOMTea', color: 'green' })
    },
    onError: (err) => {
      notifications.show({ title: '登录失败', message: err.message, color: 'red' })
    },
  })

  const register = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken, data.expiresAt)
      notifications.show({ title: '注册成功', message: '已自动登录', color: 'green' })
    },
    onError: (err) => {
      notifications.show({ title: '注册失败', message: err.message, color: 'red' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isRegister) {
      register.mutate({ username, password, displayName: username })
    } else {
      login.mutate({ username, password })
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center" c="blue">IOMTea</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        健康数据监护平台
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="用户名"
            placeholder="demo"
            required
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          <PasswordInput
            label="密码"
            placeholder="demo123"
            required
            mt="md"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button fullWidth mt="xl" type="submit" loading={login.isPending || register.isPending}>
            {isRegister ? '注册' : '登录'}
          </Button>
          <Button fullWidth mt="xs" variant="subtle" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? '已有账号？登录' : '没有账号？注册'}
          </Button>
        </form>
      </Paper>
    </Container>
  )
}
