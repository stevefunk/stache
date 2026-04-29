import { useState } from 'react'
import { uploadFile } from './lib/indexdClient'
import StacheLoader from './components/StacheLoader'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [link, setLink] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    const result = await uploadFile(file, setProgress)
    setLink(result.url)
    setUploading(false)
  }

  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <h1>Stache</h1>
      <p>Stache that file.</p>

      {!uploading && !link && (
        <>
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
          <br /><br />
          <button onClick={handleUpload}>Stache It</button>
        </>
      )}

      {uploading && <StacheLoader progress={progress} />}

      {link && (
        <div>
          <p>Your file is stached:</p>
          <a href={link}>{link}</a>
        </div>
      )}
    </div>
  )
}
