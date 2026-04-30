const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

const STACHE_APP_ID = '7374616368650000000000000000000000000000000000000000000000000000'

root.innerHTML = `
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf7ef;color:#171717;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
    <section style="width:min(760px,100%);text-align:center;">

      <img src="/mustache.png" alt="Stache mustache" style="display:block;width:260px;max-width:70%;height:auto;margin:0 auto 12px;" />

      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px;margin:0 0 16px;color:#6b6255;">Powered by Sia Storage</p>
      <h1 style="font-size:72px;line-height:1;margin:0 0 12px;">Stache</h1>
      <p style="font-size:24px;margin:0 0 32px;color:#3d352c;">Stache that file.</p>

      <button id="connect" style="border:1px solid #171717;border-radius:999px;background:white;color:#171717;padding:12px 18px;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:22px;">
        Connect Sia Storage
      </button>

      <label id="dropzone" style="display:block;border:3px dashed #171717;border-radius:28px;background:white;padding:56px 28px;cursor:pointer;box-shadow:0 24px 80px rgba(0,0,0,.08);transition:transform .15s ease;">
        <input id="file" type="file" style="display:none" />
        <div style="font-size:64px;margin-bottom:16px;">▣</div>
        <h2 style="margin:0 0 8px;font-size:28px;">Drop a file here</h2>
        <p id="fileName" style="margin:0;color:#666;">or click to choose one</p>
      </label>

      <button id="upload" disabled style="margin-top:24px;border:0;border-radius:999px;background:#171717;color:white;padding:16px 28px;font-size:18px;font-weight:800;cursor:pointer;opacity:.45;">
        Stache It
      </button>

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

async function getUploadDiagnostics() {
  const diagnostics: string[] = []

  try {
    const hosts = await sdk.hosts()
    const goodHosts = Array.isArray(hosts) ? hosts.filter((host: any) => host.goodForUpload || host.good_for_upload) : []
    diagnostics.push(`${goodHosts.length}/${Array.isArray(hosts) ? hosts.length : 0} hosts good for upload`)

    if (goodHosts.length === 0) {
      throw new Error(`No storage hosts are currently marked good for upload by sia.storage (${diagnostics.join(', ')}).`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No storage hosts')) throw error
    diagnostics.push(`host check failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    const account = await sdk.account()
    diagnostics.push(`account: ${JSON.stringify(account)}`)
  } catch (error) {
    diagnostics.push(`account check failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return diagnostics
}

function formatUploadError(error: unknown, diagnostics: string[]) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('no more hosts available')) {
    return `sia.storage has no usable upload hosts for this account right now. ${diagnostics.join(' | ')}`
  }

  return `${message}${diagnostics.length ? ` (${diagnostics.join(' | ')})` : ''}`
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

    const approvalUrl = builder.responseUrl()
    window.open(approvalUrl, '_blank', 'noopener,noreferrer')

    await builder.waitForApproval()

    const phrase = generateRecoveryPhrase()
    sdk = await builder.register(phrase)

    connectButton.textContent = 'Connected to sia.storage'
    connectButton.style.background = '#171717'
    connectButton.style.color = 'white'

    show('Connected. Pick a file and stache it.')
  } catch (error) {
    showError(error)
  }
}

(document.getElementById('upload') as HTMLElement).onclick = async () => {
  let diagnostics: string[] = []

  try {
    if (!sdk) {
      show('Connect Sia Storage first.')
      return
    }
    if (!selectedFile) return

    const { PinnedObject } = await import('@siafoundation/sia-storage')

    show('Checking sia.storage upload hosts...')
    diagnostics = await getUploadDiagnostics()

    show('Staching your file...')
    const obj = await sdk.upload(new PinnedObject(), selectedFile.stream(), { maxInflight: 1 })
    await sdk.pinObject(obj)
    const url = await sdk.shareObject(obj, Date.now() + 1000 * 60 * 60 * 24 * 365)

    status.innerHTML = `<div style="font-weight:800;font-size:22px;margin-bottom:8px;">Your file is stached.</div><a href="${url}" target="_blank" rel="noreferrer" style="color:#171717;word-break:break-all;">${url}</a>`
  } catch (error) {
    showError(formatUploadError(error, diagnostics))
  }
}
