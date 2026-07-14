import { z } from 'zod'
import { DEVICE_TYPES, DEVICE_STATUSES } from '../constants'

export const deviceSchema = z.object({
  id: z.string().uuid(),
  serialNumber: z.string(),
  deviceType: z.enum(DEVICE_TYPES),
  status: z.enum(DEVICE_STATUSES),
  patientId: z.string().uuid().nullable(),
  lastSeen: z.number().nullable(),
  tags: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number(),
})

export const deviceCreateSchema = z.object({
  serialNumber: z.string().min(1).max(100),
  deviceType: z.enum(DEVICE_TYPES),
})

export const deviceUpdateSchema = z.object({
  status: z.enum(DEVICE_STATUSES).optional(),
  patientId: z.string().uuid().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
})

export const deviceListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  deviceType: z.enum(DEVICE_TYPES).optional(),
  status: z.enum(DEVICE_STATUSES).optional(),
})

export type Device = z.infer<typeof deviceSchema>
export type DeviceCreateInput = z.infer<typeof deviceCreateSchema>
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchema>
