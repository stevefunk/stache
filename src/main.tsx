const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

const STACHE_APP_ID = '7374616368650000000000000000000000000000000000000000000000000000'
const API_URL = 'http://localhost:3001'

root.innerHTML = `
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf7ef;color:#171717;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
    <section style="width:min(760px,100%);text-align:center;">
      <img src="/mustache.png" alt="Stache mustache" style="display:block;width:260px;max-width:70%;height:auto;margin:0 auto 12px;" />
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px;margin:0 0 16px;color:#6b6255;">Powered by Sia Storage</p>
      <h1 style="font-size:72px;line-height:1;margin:0 0 12px;">Stache</h1>
      <p style="font-size:24px;margin:0 0 32px;color:#3d352c;">Stache that file.</p>
      <button id="connect" style="border:1px solid #171717;border-radius:999px;background:white;color:#171717;padding:12px 18px;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:22px;">Connect Sia Storage</button>
      <label id="dropzone" style="display:block;border:3px dashed #171717;border-radius:28px;background:white;padding:56px 28px;cursor:pointer;box-shadow:0 24px 80px rgba(0,0,0,.08);transition:transform .15s ease;">
        <input id="file" type="file" style="display:none" />
        <div style="font-size:64px;margin-bottom:16px;">▣</div>
        <h2 style="margin:0 0 8px;font-size:28px;">Drop a file here</h2>
        <p id="fileName" style="margin:0;color:#666;">or click to choose one</p>
      </label>
      <button id="upload" disabled style="margin-top:24px;border:0;border-radius:999px;background:#171717;color:white;padding:16px 28px;font-size:18px;font-weight:800;cursor:pointer;opacity:.45;">Stache It</button>
      <div id="status" style="margin-top:28px;min-height:90px;color:#3d352c;"></div>
    </section>
  </main>
`

let sdk: any = null
let selectedFile: File | null = null

const status = document.getElementById('status')!
const fileInput = document.getElementById('file') as HTMLInputElement
const fileName = document.getElementById('fileName')!
const uploadButton = document.getElementById('upload') as HTMLButtonElement
const dropzone = document.getElementById('dropzone')!
const connectButton = document.getElementById('connect') as HTMLButtonElement

function show(message: string) {
  status.innerHTML = `<div style="font-weight:700;">${message}</div>`
}

function showError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  status.innerHTML = `<div style="font-weight:800;color:#8a1f11;">${message}</div>`
}

function setFile(file: File | null) {
  selectedFile = file
  fileName.textContent = file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : 'or click to choose one'
  uploadButton.disabled = !file
  uploadButton.style.opacity = file ? '1' : '.45'
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] ?? null))

dropzone.addEventListener('dragover', event => {
  event.preventDefault()
  dropzone.style.transform = 'scale(1.01)'
})

dropzone.addEventListener('dragleave', () => {
  dropzone.style.transform = 'scale(1)'
})

dropzone.addEventListener('drop', event => {
  event.preventDefault()
  dropzone.style.transform = 'scale(1)'
  setFile(event.dataTransfer?.files?.[0] ?? null)
})

connectButton.onclick = async () => {
  try {
    show('Loading Sia SDK...')
    const { initSia, Builder, generateRecoveryPhrase } = await import('@siafoundation/sia-storage')
    await initSia()
    const builder = new Builder('https://sia.storage', {
      appId: STACHE_APP_ID,
      name: 'Stache',
      description: 'Stache that file',
      serviceUrl: window.location.origin,
    })
    show('Requesting Sia Storage connection...')
    await builder.requestConnection()
    window.open(builder.responseUrl(), '_blank', 'noopener,noreferrer')
    await builder.waitForApproval()
    sdk = await builder.register(generateRecoveryPhrase())
    connectButton.textContent = 'Connected to sia.storage'
    connectButton.style.background = '#171717'
    connectButton.style.color = 'white'
    show('Connected. Pick a file and stache it.')
  } catch (error) {
    showError(error)
  }
}

(document.getElementById('upload') as HTMLElement).onclick = async () => {
  try {
    if (!sdk) {
      show('Connect Sia Storage first.')
      return
    }
    if (!selectedFile) return
    show('Staching your file...')
    const form = new FormData()
    form.append('file', selectedFile)
    form.append('session', bytesToHex(sdk.appKey().export()))
    const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: form })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Upload failed')
    status.innerHTML = `<div style="font-weight:800;font-size:22px;margin-bottom:8px;">Your file is stached.</div><a href="${data.url}" target="_blank" rel="noreferrer" style="color:#171717;word-break:break-all;">${data.url}</a>`
  } catch (error) {
    showError(error)
  }
}
