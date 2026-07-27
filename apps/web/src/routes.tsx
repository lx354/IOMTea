import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useParams,
} from '@tanstack/react-router'
import { NodeGraph } from './components/NodeGraph'
import { AlertBoard } from './pages/AlertBoard'
import { ChatPanel } from './pages/ChatPanel'
import { DeviceMonitor } from './pages/DeviceMonitor'
import { HealthTrendsPage } from './pages/HealthTrendsPage'
import { AbnormalEventsPage } from './pages/AbnormalEventsPage'
import { CognitivePredictor } from './pages/CognitivePredictor'
import { VitalMonitor } from './pages/VitalMonitor'
import { EnvMonitor } from './pages/EnvMonitor'
import { ActivityMonitor } from './pages/ActivityMonitor'
import { HomeFloorplan } from './pages/HomeFloorplan'
import { SuggestionsPanel } from './pages/SuggestionsPanel'
import { MirrorPage } from './pages/MirrorPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataDashboard } from './pages/DataDashboard'
import { DataExportPage } from './pages/DataExportPage'
import { FormBuilderPage } from './pages/FormBuilderPage'
import { HealthTimeline } from './pages/HealthTimeline'
import { LoginPage } from './pages/LoginPage'
import { PatientAlertRules } from './pages/PatientAlertRules'
import { PatientAlerts } from './pages/PatientAlerts'
import { PatientDetailShell } from './pages/PatientDetailShell'
import { PatientProfile } from './pages/PatientProfile'
import { PatientFormsTab } from './pages/PatientFormsTab'
import { PatientUsers } from './pages/PatientUsers'
import { PatientWall } from './pages/PatientWall'
import { PlanManagementPage } from './pages/PlanManagementPage'
import { RbacManagementPage } from './pages/RbacManagementPage'
import { SimulationPage } from './pages/SimulationPage'
import { TwinStatusMatrix } from './pages/TwinStatusMatrix'
import { UserManagementPage } from './pages/UserManagementPage'
import { AuthLayout, authBeforeLoad } from './routes/-_auth'
import { RootLayout } from './routes/__root'

const rootRoute = createRootRoute({ component: RootLayout })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_auth',
  beforeLoad: authBeforeLoad,
  component: AuthLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  component: DashboardPage,
})

const dataDashboardRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-dashboard',
  component: DataDashboard,
})

const dataExportRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-export',
  component: DataExportPage,
})

const patientsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients',
  component: PatientWall,
})

const patientDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients/$id',
  component: PatientDetailShell,
})

const pOverviewRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/',
})

const pProfileRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/profile',
  component: PatientProfile,
})

const pAlertsRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alerts',
  component: PatientAlerts,
})

const pRulesRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alert-rules',
  component: PatientAlertRules,
})

const pTimelineRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/health-timeline',
  component: HealthTimeline,
})

const pUsersRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/users',
  component: PatientUsers,
})

const pFormsRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/forms',
  component: PatientFormsTab,
})

const alertsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/alerts',
  component: AlertBoard,
})

const twinRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/twin',
  component: TwinStatusMatrix,
})

const chatRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/chat',
  component: ChatPanel,
})

const suggestionsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/suggestions',
  component: SuggestionsPanel,
})

const mirrorRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/mirror',
  component: MirrorPage,
})

const deviceMonitorRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/device-monitor',
  component: DeviceMonitor,
})

const healthTrendsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/health-trends',
  component: HealthTrendsPage,
})

const abnormalEventsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/abnormal-events',
  component: AbnormalEventsPage,
})

const cognitivePredictionRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/cognitive-prediction',
  component: CognitivePredictor,
})

const vitalMonitorRoute = createRoute({
  getParentRoute: () => authRoute, path: '/vital-monitor', component: VitalMonitor,
})
const envMonitorRoute = createRoute({
  getParentRoute: () => authRoute, path: '/env-monitor', component: EnvMonitor,
})
const activityMonitorRoute = createRoute({
  getParentRoute: () => authRoute, path: '/activity-monitor', component: ActivityMonitor,
})

const simRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/simulation',
  component: SimulationPage,
})

const usersRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/settings/users',
  component: UserManagementPage,
})

const rbacRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/settings/rbac',
  component: RbacManagementPage,
})

const nodeGraphRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/node-graph',
  component: NodeGraph,
})

const plansRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/plans',
  component: PlanManagementPage,
})

const formsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forms',
  component: FormBuilderPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    dashboardRoute,
    dataDashboardRoute,
    dataExportRoute,
    alertsRoute,
    simRoute,
    twinRoute,
    chatRoute,
    suggestionsRoute,
    mirrorRoute,
    deviceMonitorRoute,
    healthTrendsRoute,
    abnormalEventsRoute,
    cognitivePredictionRoute,
    vitalMonitorRoute,
    envMonitorRoute,
    activityMonitorRoute,
    usersRoute,
    rbacRoute,
    nodeGraphRoute,
    plansRoute,
    formsRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
