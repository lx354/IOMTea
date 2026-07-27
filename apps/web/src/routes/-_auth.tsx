import {
  ActionIcon, Anchor, AppShell, Breadcrumbs, Button, Divider,
  Group, Modal, NavLink, Text, ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconActivity, IconAlertTriangle, IconBrain, IconRun,
  IconBuildingFactory, IconChartBar, IconClipboardList, IconClipboardText,
  IconDownload, IconGitBranch, IconHeartbeat, IconLayoutDashboard, IconLogout,
  IconMessageCircle, IconShield, IconSparkles, IconThermometer,
  IconUsers, IconUsersGroup,
} from '@tabler/icons-react'
import { Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'

interface NavItem { label: string; icon: React.ElementType; path: string }
interface NavGroup { label: string; items: NavItem[]; roles: string[] }

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超管', admin: '管理员', family: '家属', nurse: '护理员', doctor: '医生', user: '用户',
}
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'yellow', admin: 'blue', family: 'teal', nurse: 'green', doctor: 'grape', user: 'gray',
}

const navGroups: NavGroup[] = [
  {
    label: '物理层映射',
    items: [
      { label: '生命体征监测', icon: IconHeartbeat, path: '/vital-monitor' },
      { label: '环境安全监测', icon: IconThermometer, path: '/env-monitor' },
      { label: '行为与活动监测', icon: IconRun, path: '/activity-monitor' },
      { label: '设备监控', icon: IconActivity, path: '/device-monitor' },
    ],
    roles: ['super_admin', 'admin', 'nurse', 'doctor'],
  },
  {
    label: '虚拟层映射',
    items: [
      { label: '虚拟镜像', icon: IconActivity, path: '/mirror' },
    ],
    roles: ['super_admin', 'admin', 'family', 'nurse', 'doctor'],
  },
  {
    label: '算法层映射',
    items: [
      { label: '健康趋势图', icon: IconChartBar, path: '/health-trends' },
      { label: '异常事件列表', icon: IconAlertTriangle, path: '/abnormal-events' },
      { label: '认知预测引擎', icon: IconBrain, path: '/cognitive-prediction' },
    ],
    roles: ['super_admin', 'admin', 'nurse', 'doctor'],
  },
  {
    label: '应用层映射',
    items: [
      { label: '对话孪生', icon: IconMessageCircle, path: '/chat' },
      { label: '智慧建议', icon: IconSparkles, path: '/suggestions' },
      { label: '计划管理', icon: IconClipboardList, path: '/plans' },
    ],
    roles: ['super_admin', 'admin', 'family', 'nurse', 'doctor'],
  },
  {
    label: '系统',
    items: [
      { label: '工作台', icon: IconLayoutDashboard, path: '/' },
      { label: '量表管理', icon: IconClipboardText, path: '/forms' },
      { label: '状态矩阵', icon: IconActivity, path: '/twin' },
      { label: '模拟工厂', icon: IconBuildingFactory, path: '/simulation' },
      { label: '警告看板', icon: IconAlertTriangle, path: '/alerts' },
      { label: '关系图谱', icon: IconGitBranch, path: '/node-graph' },
      { label: '数据导出', icon: IconDownload, path: '/data-export' },
      { label: '用户管理', icon: IconUsersGroup, path: '/settings/users' },
      { label: '权限管理', icon: IconShield, path: '/settings/rbac' },
    ],
    roles: ['super_admin', 'admin'],
  },
]

const pageStyles = [
  '@keyframes pageFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
  '.page-fade-in{animation:pageFadeIn .2s ease-out}',
  '.card-hover{transition:transform .2s ease,box-shadow .2s ease}',
  '.card-hover:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08)}',
  '.card-hover:active{transform:translateY(0);box-shadow:0 2px 4px rgba(0,0,0,.04);transition:transform .05s}',
  '.alert-card{transition:transform .15s ease,box-shadow .15s ease}',
  '.alert-card:hover{transform:translateX(3px)}',
  '.anim-stagger-item{opacity:0;animation:fadeUp 0.3s ease-out forwards}',
  '@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
].join('')

export function AuthLayout() {
  const [opened, { toggle }] = useDisclosure()
  const [logoutModal, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.role) ?? 'user'

  const visibleGroups = navGroups.filter((g) => g.roles.includes(role))
  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path))

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text size="xl">🍵</Text>
          <Text fw={700} size="lg">IOMTea</Text>
          <ActionIcon variant="subtle" color="red" onClick={openLogoutModal} visibleFrom="sm">
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <Divider my={6} />}
              <Text size="xs" c="dimmed" fw={600} px="sm" pt={4} pb={2} tt="uppercase">{group.label}</Text>
              {group.items.map((item) => (
                <NavLink key={item.label} label={item.label}
                  leftSection={<item.icon size={18} stroke={1.5} />}
                  active={isActive(item.path)}
                  onClick={() => navigate({ to: item.path })}
                  variant="light" mb={1} style={{ borderRadius: 6 }}
                />
              ))}
            </div>
          ))}
        </div>
        <div>
          <Divider my="xs" />
          <Group px="sm" py="xs" gap="sm" wrap="nowrap">
            <ThemeIcon radius="xl" size="sm" color={ROLE_COLORS[role] || 'gray'} variant="light">
              <IconUsers size={14} />
            </ThemeIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" fw={500}>{ROLE_LABELS[role] || role}</Text>
              <Text size="xs" c={ROLE_COLORS[role] || 'gray'}>{role}</Text>
            </div>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={openLogoutModal} hiddenFrom="sm">
              <IconLogout size={16} />
            </ActionIcon>
          </Group>
        </div>
      </AppShell.Navbar>
      <AppShell.Main>
        <style>{pageStyles}</style>
        <div className="page-fade-in" style={{ minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </div>
      </AppShell.Main>
      <Modal opened={logoutModal} onClose={closeLogoutModal} title="确认退出" size="sm" centered>
        <Text mb="lg">确定要退出登录吗？</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={closeLogoutModal}>取消</Button>
          <Button color="red" onClick={() => { logout(); closeLogoutModal() }}>确认退出</Button>
        </Group>
      </Modal>
    </AppShell>
  )
}

export const authBeforeLoad = ({ location }: { location: { href: string } }) => {
  const state = useAuthStore.getState()
  if (!state.token) throw redirect({ to: '/login', search: { redirect: location.href } })
  const adminRoutes = ['/patients', '/data-export', '/simulation', '/iot/pins', '/plans', '/forms']
  const superAdminRoutes = ['/settings/users', '/settings/rbac']
  const pathname = location.href || ''
  if (superAdminRoutes.some((r) => pathname.startsWith(r)) && state.role !== 'super_admin' && state.role !== 'admin') throw redirect({ to: '/' })
  if (adminRoutes.some((r) => pathname.startsWith(r))) {
    if (state.role !== 'admin' && state.role !== 'super_admin') throw redirect({ to: '/' })
  }
}
