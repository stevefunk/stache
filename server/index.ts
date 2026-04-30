import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Readable } from 'node:stream'
import { initSia, Builder, AppKey, PinnedObject } from '@siafoundation/sia-storage'

const INDEXER_URL = 'https://sia.storage'
const STACHE_APP_ID = '7374616368650000000000000000000000000000000000000000000000000000'

const app = express()
const upload = multer()

app.use(cors())
app.use(express.json())

function hexToBytes(hex: string) {
  const clean = hex.trim().toLowerCase()
  if (!/^[0-9a-f]+$/.test(clean) || clean.length !== 64) {
    throw new Error('Invalid app key')
  }
  return Uint8Array.from(clean.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
}

function nodeReadableToWeb(readable: Readable) {
  return Readable.toWeb(readable) as unknown as ReadableStream<Uint8Array>
}

app.get('/', (_req, res) => {
  res.json({ ok: true })
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const appKeyHex = req.body.session || req.body.appKey
    if (!appKeyHex) {
      return res.status(400).json({ error: 'Missing app key' })
    }

    await initSia()

    const sdk = await new Builder(INDEXER_URL, {
      id: Buffer.from(STACHE_APP_ID, 'hex'),
      name: 'Stache',
      description: 'Stache that file',
      serviceUrl: 'http://localhost:5173',
    }).connected(new AppKey(hexToBytes(appKeyHex)))

    if (!sdk) {
      return res.status(401).json({ error: 'Could not reconnect to Sia Storage' })
    }

    const stream = nodeReadableToWeb(Readable.from(req.file.buffer))
    const object = await sdk.upload(new PinnedObject(), stream, {
      maxInflight: 15,
      dataShards: 10,
      parityShards: 20,
    })

    await sdk.pinObject(object)

    const oneYearFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    const url = await sdk.shareObject(object, oneYearFromNow)

    return res.json({
      id: object.id().toString(),
      url: url.toString(),
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    res.status(500).json({ error: message })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})