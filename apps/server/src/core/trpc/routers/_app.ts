import { router } from '../index'
import { authRouter } from './auth'
import { userRouter } from './user'
import { patientRouter } from './patient'
import { deviceRouter } from './device'
import { alertRouter } from './alert'
import { dataRouter } from './data'
import { simulatorRouter } from '../../../simulator/trpc/simulator'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  patient: patientRouter,
  device: deviceRouter,
  alert: alertRouter,
  data: dataRouter,
  simulator: simulatorRouter,
})

export type AppRouter = typeof appRouter
