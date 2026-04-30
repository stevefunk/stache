import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Readable } from 'node:stream'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { initSia, Builder, AppKey, PinnedObject, generateRecoveryPhrase } from '@siafoundation/sia-storage'

const INDEXER_URL = process.env.STACHE_INDEXER_URL || 'https://sia.storage'
const STACHE_APP_ID = process.env.STACHE_APP_ID || '7374616368650000000000000000000000000000000000000000000000000000'
const KEY_FILE = process.env.STACHE_KEY_FILE || './stache-key.json'
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 50)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const app = express()
const upload = multer({ limits: { fileSize: MAX_FILE_SIZE_BYTES } })
let pendingBuilder: Builder | null = null
let cachedSdk: any = null

app.use(cors())
app.use(express.json())

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string) {
  const clean = hex.trim().toLowerCase()
  if (!/^[0-9a-f]+$/.test(clean) || clean.length !== 64) throw new Error('Invalid Stache app key')
  return Uint8Array.from(clean.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
}

function readStoredKey() {
  if (process.env.STACHE_APP_KEY) return process.env.STACHE_APP_KEY
  if (!existsSync(KEY_FILE)) return null
  const stored = JSON.parse(readFileSync(KEY_FILE, 'utf8'))
  return stored.appKey || null
}

function writeStoredKey(appKey: string) {
  writeFileSync(KEY_FILE, JSON.stringify({ appKey }, null, 2))
}

function nodeReadableToWeb(readable: Readable) {
  return Readable.toWeb(readable) as unknown as ReadableStream<Uint8Array>
}

function appMeta() {
  return {
    id: Buffer.from(STACHE_APP_ID, 'hex'),
    name: 'Stache',
    description: 'Stache that file',
    serviceUrl: process.env.STACHE_SERVICE_URL || 'http://localhost:5173',
  }
}

async function getSdk() {
  if (cachedSdk) return cachedSdk

  const appKey = readStoredKey()
  if (!appKey) {
    throw new Error('Stache needs one-time owner setup. Visit http://localhost:3001/setup/start first.')
  }

  await initSia()
  const sdk = await new Builder(INDEXER_URL, appMeta()).connected(new AppKey(hexToBytes(appKey)))
  if (!sdk) throw new Error('Could not reconnect Stache to Sia Storage. Re-run setup.')
  cachedSdk = sdk
  return sdk
}

app.get('/', (_req, res) => {
  res.json({ ok: true, configured: Boolean(readStoredKey()), maxFileSizeMB: MAX_FILE_SIZE_MB })
})

app.get('/setup/start', async (_req, res) => {
  try {
    await initSia()
    pendingBuilder = new Builder(INDEXER_URL, appMeta())
    await pendingBuilder.requestConnection()
    res.json({ approvalUrl: pendingBuilder.responseUrl() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Setup failed'
    res.status(500).json({ error: message })
  }
})

app.post('/setup/finish', async (_req, res) => {
  try {
    if (!pendingBuilder) {
      return res.status(400).json({ error: 'No setup in progress. Start setup first.' })
    }

    await pendingBuilder.waitForApproval()
    const sdk = await pendingBuilder.register(generateRecoveryPhrase())
    const appKey = bytesToHex(sdk.appKey().export())
    writeStoredKey(appKey)
    cachedSdk = sdk
    pendingBuilder = null
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Setup finish failed'
    res.status(500).json({ error: message })
  }
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const sdk = await getSdk()
    const stream = nodeReadableToWeb(Readable.from(req.file.buffer))
    const object = await sdk.upload(new PinnedObject(), stream, {
      maxInflight: 15,
      dataShards: 10,
      parityShards: 20,
    })

    await sdk.pinObject(object)

    const url = await sdk.shareObject(object, new Date(Date.now() + 1000 * 60 * 60 * 24 * 365))

    return res.json({ id: object.id().toString(), url: url.toString() })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    res.status(500).json({ error: message })
  }
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File is too large. Max size is ${MAX_FILE_SIZE_MB} MB.` })
  }
  const message = err instanceof Error ? err.message : 'Server error'
  res.status(500).json({ error: message })
})

const PORT = Number(process.env.PORT || 3001)
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
  if (!readStoredKey()) {
    console.log(`One-time Stache owner setup: http://localhost:${PORT}/setup/start`)
  }
})