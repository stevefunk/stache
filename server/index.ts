import express from 'express'
import cors from 'cors'
import multer from 'multer'

const app = express()
const upload = multer()

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ ok: true })
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file

    // READY FOR REAL SDK
    // Replace this with @siafoundation/sia-storage
    // Example shape:
    // const client = new SiaStorage(...)
    // const result = await client.upload(file.buffer)

    const id = Math.random().toString(36).slice(2)

    return res.json({
      id,
      url: `http://localhost:5173/file/${id}`,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
