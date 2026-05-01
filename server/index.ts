import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Readable } from 'node:stream'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { initSia, Builder, AppKey, PinnedObject, generateRecoveryPhrase } from '@siafoundation/sia-storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.resolve(__dirname, '../dist')

const INDEXER_URL = process.env.STACHE_INDEXER_URL || 'https://sia.storage'
const STACHE_APP_ID = process.env.STACHE_APP_ID || '7374616368650000000000000000000000000000000000000000000000000000'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3001'
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 50)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
    })
  : null

type StachedFile = {
  id: string
  name: string
  type: string
  size: number
  siaUrl: string
  createdAt: string
}

const app = express()
const upload = multer({ limits: { fileSize: MAX_FILE_SIZE_BYTES } })
let pendingBuilder: Builder | null = null
let pendingApprovalUrl = ''
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

async function initDb() {
  if (!pool) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stache_config (
      id TEXT PRIMARY KEY,
      app_key TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stache_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size BIGINT NOT NULL,
      sia_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function readStoredKey() {
  if (process.env.STACHE_APP_KEY) return process.env.STACHE_APP_KEY
  if (!pool) return null

  const result = await pool.query('SELECT app_key FROM stache_config WHERE id = $1', ['main'])
  return result.rows[0]?.app_key || null
}

async function writeStoredKey(appKey: string) {
  if (!pool) throw new Error('DATABASE_URL is required to persist setup.')

  await pool.query(
    `INSERT INTO stache_config (id, app_key, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET app_key = EXCLUDED.app_key, updated_at = NOW()`,
    ['main', appKey],
  )
}

async function saveFile(file: StachedFile) {
  if (!pool) throw new Error('DATABASE_URL is required to persist file links.')

  await pool.query(
    `INSERT INTO stache_files (id, name, type, size, sia_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [file.id, file.name, file.type, file.size, file.siaUrl, file.createdAt],
  )
}

async function getFile(id: string): Promise<StachedFile | null> {
  if (!pool) return null

  const result = await pool.query(
    'SELECT id, name, type, size, sia_url, created_at FROM stache_files WHERE id = $1',
    [id],
  )
  const row = result.rows[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: Number(row.size),
    siaUrl: row.sia_url,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

function nodeReadableToWeb(readable: Readable) {
  return Readable.toWeb(readable) as unknown as ReadableStream<Uint8Array>
}

function appMeta() {
  return {
    id: Buffer.from(STACHE_APP_ID, 'hex'),
    name: 'Stache',
    description: 'Stache that file',
    serviceUrl: process.env.STACHE_SERVICE_URL || PUBLIC_BASE_URL,
  }
}

function page(body: string) {
  return `<!doctype html><html><head><title>Stache</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="font-family:system-ui,sans-serif;max-width:720px;margin:64px auto;padding:24px;background:#faf7ef;color:#171717;"><h1>Stache</h1>${body}</body></html>`
}

function button(href: string, text: string, dark = false) {
  return `<a style="display:inline-block;${dark ? 'background:#171717;color:white;' : 'border:1px solid #171717;color:#171717;'}padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;margin:6px;" href="${href}">${text}</a>`
}

async function ensureSetupStarted() {
  if (pendingBuilder && pendingApprovalUrl) return pendingApprovalUrl
  await initSia()
  pendingBuilder = new Builder(INDEXER_URL, appMeta())
  await pendingBuilder.requestConnection()
  pendingApprovalUrl = pendingBuilder.responseUrl()
  return pendingApprovalUrl
}

async function finishSetup() {
  if (!pendingBuilder) throw new Error('No setup in progress. Click Start over below.')
  await pendingBuilder.waitForApproval()
  const sdk = await pendingBuilder.register(generateRecoveryPhrase())
  const appKey = bytesToHex(sdk.appKey().export())
  await writeStoredKey(appKey)
  cachedSdk = sdk
  pendingBuilder = null
  pendingApprovalUrl = ''
}

async function getSdk() {
  if (cachedSdk) return cachedSdk
  const appKey = await readStoredKey()
  if (!appKey) throw new Error('Stache needs one-time owner setup. Visit /setup first.')
  await initSia()
  const sdk = await new Builder(INDEXER_URL, appMeta()).connected(new AppKey(hexToBytes(appKey)))
  if (!sdk) throw new Error('Could not reconnect Stache to Sia Storage. Re-run setup.')
  cachedSdk = sdk
  return sdk
}

async function streamToResponse(stream: ReadableStream<Uint8Array>, res: express.Response) {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch (error) {
    res.destroy(error instanceof Error ? error : new Error(String(error)))
  }
}

app.get('/health', async (_req, res) => {
  res.json({ ok: true, configured: Boolean(await readStoredKey()), database: Boolean(pool), maxFileSizeMB: MAX_FILE_SIZE_MB })
})

app.get('/setup', async (_req, res) => {
  try {
    if (await readStoredKey()) return res.send(page(`<p>Stache is already configured.</p>${button('/', 'Open Stache', true)}`))
    const approvalUrl = await ensureSetupStarted()
    res.send(page(`<p>1. Click approve. Sia Storage opens in a new page.</p><p>${button(approvalUrl, 'Approve Stache', true)}</p><p>2. After approval, come back here and click finish.</p><p>${button('/setup/finish', 'Finish setup')}</p><p style="color:#6b6255;">No copying or pasting needed.</p>`))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Setup failed'
    res.status(500).send(page(`<p style="color:#8a1f11;font-weight:800;">${message}</p>${button('/setup/reset', 'Start over')}`))
  }
})

app.get('/setup/start', (_req, res) => res.redirect('/setup'))

app.get('/setup/reset', (_req, res) => {
  pendingBuilder = null
  pendingApprovalUrl = ''
  res.redirect('/setup')
})

app.get('/setup/finish', async (_req, res) => {
  try {
    await finishSetup()
    res.send(page(`<p>Stache is configured and saved permanently.</p>${button('/', 'Open Stache', true)}`))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Setup finish failed'
    res.status(500).send(page(`<p style="color:#8a1f11;font-weight:800;">${message}</p>${button('/setup', 'Back to setup')}${button('/setup/reset', 'Start over')}`))
  }
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const sdk = await getSdk()
    const stream = nodeReadableToWeb(Readable.from(req.file.buffer))
    const object = await sdk.upload(new PinnedObject(), stream, { maxInflight: 15, dataShards: 10, parityShards: 20 })
    await sdk.pinObject(object)
    const siaUrl = await sdk.shareObject(object, new Date(Date.now() + 1000 * 60 * 60 * 24 * 365))
    const id = object.id().toString()
    await saveFile({ id, name: req.file.originalname || 'stached-file', type: req.file.mimetype || 'application/octet-stream', size: req.file.size, siaUrl: siaUrl.toString(), createdAt: new Date().toISOString() })
    return res.json({ id, url: `${PUBLIC_BASE_URL}/f/${id}` })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    res.status(500).json({ error: message })
  }
})

app.get('/f/:id', async (req, res) => {
  const file = await getFile(req.params.id)
  if (!file) return res.status(404).send(page('<p>File not found.</p>'))
  res.send(page(`<p><strong>${file.name}</strong></p><p>${Math.round(file.size / 1024)} KB</p>${button(`/download/${file.id}`, 'Open / download file', true)}<p style="color:#6b6255;">This Stache link works in any normal web browser.</p>`))
})

app.get('/download/:id', async (req, res) => {
  try {
    const file = await getFile(req.params.id)
    if (!file) return res.status(404).send('File not found')
    const sdk = await getSdk()
    const object = await sdk.sharedObject(file.siaUrl)
    const stream = await sdk.download(object)
    res.setHeader('Content-Type', file.type)
    res.setHeader('Content-Disposition', `inline; filename="${file.name.replace(/"/g, '')}"`)
    await streamToResponse(stream, res)
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Download failed'
    res.status(500).send(message)
  }
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File is too large. Max size is ${MAX_FILE_SIZE_MB} MB.` })
  const message = err instanceof Error ? err.message : 'Server error'
  res.status(500).json({ error: message })
})

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

const PORT = Number(process.env.PORT || 3001)

initDb()
  .then(() => {
    app.listen(PORT, async () => {
      console.log(`API running on http://localhost:${PORT}`)
      if (!pool) console.log('DATABASE_URL missing: setup and file links will not persist.')
      if (!(await readStoredKey())) console.log(`One-time Stache owner setup: http://localhost:${PORT}/setup`)
    })
  })
  .catch(error => {
    console.error('Failed to initialize database', error)
    process.exit(1)
  })
