import express from 'express'
import cors from 'cors'
import multer from 'multer'

const app = express()
const upload = multer()

app.use(cors())
app.use(express.json())

// health
app.get('/', (_req, res) => {
  res.json({ ok: true })
})

// upload endpoint (stub for now)
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file' })
  }

  // TODO: replace with real indexd upload
  const id = Math.random().toString(36).slice(2)

  res.json({
    id,
    url: `http://localhost:5173/file/${id}`,
  })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
