import mqtt from 'mqtt'
import type { DbClient } from '../../core/db'
import { MattressModule } from './mattress'

interface MqttConfig {
  broker: string
  username?: string
  password?: string
}

export function startMqttIngest(db: DbClient, config: MqttConfig): void {
  const client = mqtt.connect(config.broker, {
    username: config.username,
    password: config.password,
    clientId: `iomtea-ingest-${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    keepalive: 60,
    clean: true,
  })

  const mattress = new MattressModule()

  client.on('connect', () => {
    console.log(`[ingest] MQTT connected to ${config.broker}`)
    client.subscribe('device/+/data', { qos: 1 })
    console.log('[ingest] subscribed to device/+/data')
  })

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString())
      if (!payload.sn) return

      await mattress.process(db, payload)
    } catch (err) {
      console.error('[ingest] message processing error:', err)
    }
  })

  client.on('error', (err) => {
    console.error('[ingest] MQTT error:', err)
  })

  client.on('close', () => {
    console.log('[ingest] MQTT disconnected')
  })
}
