import net from 'node:net'
import { decode } from '@msgpack/msgpack'
import type { DbClient } from '../../core/db'
import { MattressModule } from '../mqtt/mattress'
import type { MattressPayload } from '../mqtt/mattress/parser'

const MAX_BUFFER = 65536       // 64 KiB — drop connection if exceeded
const MAX_CONNECTIONS = 100    // global cap
const SOCKET_TIMEOUT_MS = 60_000 // 60s idle timeout
const RATE_LIMIT_PER_SEC = 50  // max messages/sec per socket

function timeStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

// ─── MessagePack decoder ───
// Frame: [0xAB, 0xCD, len, 0x00, ...msgpack payload len bytes]
// Magic 0xAB 0xCD signals MessagePack encoding.

function decodeMsgpack(payload: Uint8Array): MattressPayload | null {
  try {
    const entry: any = decode(payload)
    const msg: MattressPayload = { sn: '' }

    msg.sn = entry.sn || ''
    const d = entry.d
    if (d) {
      msg.st = d.st || undefined
      msg.hb = d.hb
      msg.br = d.br
      msg.od = d.od === 255 ? -1 : d.od
      msg.we = d.we === 255 ? -1 : d.we
      msg.wt = d.wt === true ? '1' : d.wt === false ? '0' : undefined
      msg.fv = d.fv
      if (Array.isArray(d.p) && d.p.length >= 2) {
        msg.p = `[${d.p[0]},${d.p[1]}]`
      }
    }
    return msg
  } catch {
    return null
  }
}

// ─── TLV fallback decoder ───
// Frame: [0x00, 0x00, len, 0x00, unused x4, ...tlv payload (len-4) bytes]
// TLV key: 0xA1-0xA7 prefix byte where low nibble = key length
// TLV value: follows key bytes. Single byte for most fields.
// Special: 0x92 followed by 2 bytes = position pair [a,c].
// Special: st field can be ASCII char ('0'=off,'1'=on,'2'=mov) or numeric code.

const STATUS_MAP: Record<number, string> = {
  0x00: 'off', 0x30: 'off',  // numeric 0 or ASCII '0'
  0x01: 'on',  0x31: 'on',   // numeric 1 or ASCII '1'
  0x02: 'mov', 0x32: 'mov',  // numeric 2 or ASCII '2'
}

function readMultiByte(payload: Buffer, startIdx: number): { value: number; consumed: number } | null {
  // Attempt to read multi-byte value (big-endian).
  // Scan forward until next TLV key marker (0xA1-0xA7) or end of buffer.
  const bytes: number[] = []
  let i = startIdx
  while (i < payload.length) {
    const b = payload[i]
    if (b >= 0xA1 && b <= 0xA7) break // next key starts here
    bytes.push(b)
    i++
  }
  if (bytes.length === 0) return null
  // Reject if it looks like a single-byte value that just happens to be in TLV range
  // (unlikely for actual multi-byte values which would be > 255)
  if (bytes.length === 1) return null // let single-byte path handle it
  let value = 0
  for (const b of bytes) {
    value = (value << 8) | b
  }
  return { value, consumed: i - startIdx }
}

function decodeTLV(payload: Buffer): MattressPayload | null {
  const msg: MattressPayload = { sn: '' }
  let idx = 0

  while (idx < payload.length) {
    const b = payload[idx]
    idx++

    // Position pair: 0x92 followed by 2 bytes
    if (b === 0x92) {
      if (idx + 1 >= payload.length) break
      msg.p = `[${payload[idx]},${payload[idx + 1]}]`
      idx += 2
      continue
    }

    // TLV key: 0xA1-0xA7
    if (b >= 0xA1 && b <= 0xA7) {
      const len = b - 0xA0
      if (idx + len > payload.length) break
      const key = payload.toString('utf8', idx, idx + len)
      idx += len

      if (idx >= payload.length) break

      // SN field: skip multi-byte parsing, read as string directly
      if (key === 'sn') {
        const snBytes: number[] = [payload[idx]]
        idx++
        while (idx < payload.length) {
          const nb = payload[idx]
          if (nb >= 0xA1 && nb <= 0xA7) break
          snBytes.push(nb)
          idx++
        }
        msg.sn = Buffer.from(snBytes).toString('utf8').trim()
        continue
      }

      // Try multi-byte value first (for fields like hb, br that can exceed 255)
      const mbr = readMultiByte(payload, idx)
      let v: number = 0
      let vb: number = 0
      if (mbr) {
        v = mbr.value
        idx += mbr.consumed
        vb = v & 0xFF // single-byte fallback for char-based fields
      } else {
        vb = payload[idx]
        v = vb
        idx++
      }

      switch (key) {
        case 'hb': msg.hb = v === 255 || v === 0xFFFF ? -1 : v; break
        case 'br': msg.br = v === 255 || v === 0xFFFF ? -1 : v; break
        case 'od': msg.od = v === 255 || v === 0xFFFF ? -1 : v; break
        case 'st': {
          const mapped = STATUS_MAP[vb] || STATUS_MAP[v]
          msg.st = mapped || String.fromCharCode(vb)
          break
        }
        case 'we': msg.we = v === 255 || v === 0xFFFF ? -1 : v; break
        case 'wt': msg.wt = vb === 0xC3 || v === 0xC3 ? '1' : '0'; break
        case 'fv': msg.fv = v; break
      }
    }
  }

  return msg.sn ? msg : null
}

// ─── Frame decoder ───
// Both protocols use a 4-byte header: [b0, b1, len, b3] followed by payload.
// MsgPack: b0=0xAB, b1=0xCD, payload = 4 bytes from header start.
// TLV:     b0≠0xAB or b1≠0xCD, payload = 8 bytes from header start (len-4 effective).

function tryDecode(buf: Buffer): { consumed: number; msg: MattressPayload | null } | null {
  if (buf.length < 4) return null

  if (buf[0] === 0xAB && buf[1] === 0xCD) {
    const len = buf[2]
    const total = 4 + len
    if (buf.length < total) return null
    const payload = buf.subarray(4, total)
    const msg = decodeMsgpack(new Uint8Array(payload))
    return { consumed: total, msg }
  }

  const len = buf[2]
  if (len < 4) return null // invalid frame — would underflow payload offset
  const total = 4 + len
  if (buf.length < total) return null
  const payload = buf.subarray(8, total) // skip 8-byte TLV header prefix
  const msg = decodeTLV(payload)
  return { consumed: total, msg }
}

// ─── TCP server ───

export interface TcpIngestConfig {
  port: number
  preSharedToken?: string
}

export function startTcpIngest(db: DbClient, config: TcpIngestConfig): void {
  const mattress = new MattressModule()
  let activeConnections = 0

  const server = net.createServer((socket) => {
    if (activeConnections >= MAX_CONNECTIONS) {
      socket.destroy()
      return
    }
    activeConnections++

    let authenticated = !config.preSharedToken // if no token configured, allow all
    let buf = Buffer.alloc(0)
    let msgCount = 0
    let rateWindowStart = Date.now()

    socket.setTimeout(SOCKET_TIMEOUT_MS)

    socket.on('data', async (chunk: Buffer) => {
      // Pre-shared token authentication with fragmented delivery support
      if (!authenticated && config.preSharedToken) {
        buf = Buffer.concat([buf, chunk])
        if (buf.length >= config.preSharedToken.length) {
          const candidate = buf.toString('utf8', 0, config.preSharedToken.length)
          if (candidate === config.preSharedToken) {
            authenticated = true
            console.log(`[ingest:tcp] device authenticated from ${socket.remoteAddress}`)
            buf = buf.subarray(config.preSharedToken.length)
            msgCount = 0
            rateWindowStart = Date.now()
            if (buf.length === 0) return
          } else {
            console.warn(`[ingest:tcp] auth failed from ${socket.remoteAddress}`)
            socket.destroy()
            return
          }
        } else {
          return
        }
      } else {
        buf = Buffer.concat([buf, chunk])
      }

      // Rate limit per second (simple sliding window)
      const now = Date.now()
      if (now - rateWindowStart >= 1000) {
        msgCount = 0
        rateWindowStart = now
      }
      msgCount++

      // Buffer overflow protection
      if (buf.length > MAX_BUFFER) {
        console.warn(`[ingest:tcp] buffer overflow from ${socket.remoteAddress}, resetting`)
        buf = Buffer.alloc(0)
        socket.destroy()
        return
      }

      let result
      while ((result = tryDecode(buf)) !== null && msgCount <= RATE_LIMIT_PER_SEC) {
        buf = buf.subarray(result.consumed)
        if (result.msg) {
          try {
            await mattress.process(db, result.msg)
          } catch (err) {
            console.error('[ingest:tcp] mattress process error:', err)
          }
        }
      }
    })

    socket.on('timeout', () => {
      console.log(`[ingest:tcp] socket timeout from ${socket.remoteAddress}`)
      socket.destroy()
    })

    socket.on('error', (err) => {
      console.error('[ingest:tcp] socket error:', err)
    })

    socket.on('close', () => {
      activeConnections--
      console.log(`[ingest:tcp] device disconnected (active: ${activeConnections})`)
    })
  })

  server.listen(config.port, () => {
    console.log(`[ingest:tcp] listening on port ${config.port}${config.preSharedToken ? ' (auth enabled)' : ''}`)
  })

  server.on('error', (err) => {
    console.error('[ingest:tcp] server error:', err)
  })
}
