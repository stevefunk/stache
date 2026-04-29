const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

root.innerHTML = `
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf7ef;color:#171717;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
    <section style="width:min(720px,100%);text-align:center;">
      <p style="letter-spacing:0.18em;text-transform:uppercase;font-size:12px;margin:0 0 16px;">Powered by Sia + indexd</p>
      <h1 style="font-size:72px;line-height:1;margin:0 0 12px;">Stache</h1>
      <p style="font-size:24px;margin:0 0 32px;">Stache that file.</p>

      <label id="dropzone" style="display:block;border:3px dashed #171717;border-radius:28px;background:white;padding:56px 28px;cursor:pointer;box-shadow:0 24px 80px rgba(0,0,0,.08);">
        <input id="fileInput" type="file" style="display:none" />
        <div style="font-size:64px;margin-bottom:16px;">▣</div>
        <h2 style="margin:0 0 8px;font-size:28px;">Drop a file here</h2>
        <p id="fileName" style="margin:0;color:#666;">or click to choose one</p>
      </label>

      <button id="uploadButton" disabled style="margin-top:24px;border:0;border-radius:999px;background:#171717;color:white;padding:16px 28px;font-size:18px;font-weight:700;cursor:pointer;opacity:.45;">
        Stache It
      </button>

      <div id="status" style="margin-top:28px;min-height:90px;"></div>
    </section>
  </main>
`

const fileInput = document.getElementById('fileInput') as HTMLInputElement
const fileName = document.getElementById('fileName') as HTMLParagraphElement
const uploadButton = document.getElementById('uploadButton') as HTMLButtonElement
const status = document.getElementById('status') as HTMLDivElement
const dropzone = document.getElementById('dropzone') as HTMLLabelElement

let selectedFile: File | null = null

function setFile(file: File | null) {
  selectedFile = file
  fileName.textContent = file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : 'or click to choose one'
  uploadButton.disabled = !file
  uploadButton.style.opacity = file ? '1' : '.45'
}

fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] ?? null))

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault()
  dropzone.style.transform = 'scale(1.01)'
})

dropzone.addEventListener('dragleave', () => {
  dropzone.style.transform = 'scale(1)'
})

dropzone.addEventListener('drop', (event) => {
  event.preventDefault()
  dropzone.style.transform = 'scale(1)'
  setFile(event.dataTransfer?.files?.[0] ?? null)
})

uploadButton.addEventListener('click', () => {
  if (!selectedFile) return

  uploadButton.disabled = true
  uploadButton.style.opacity = '.45'
  let progress = 0

  const timer = window.setInterval(() => {
    progress += 10
    status.innerHTML = `
      <div style="font-size:52px;line-height:1;margin-bottom:12px;">▣ 〰</div>
      <div style="font-weight:700;margin-bottom:10px;">Staching your file... ${progress}%</div>
      <div style="height:10px;background:#e8e0d2;border-radius:999px;overflow:hidden;max-width:320px;margin:0 auto;">
        <div style="width:${progress}%;height:100%;background:#171717;"></div>
      </div>
    `

    if (progress >= 100) {
      window.clearInterval(timer)
      const id = Math.random().toString(36).slice(2)
      const url = `${window.location.origin}/file/${id}`
      status.innerHTML = `
        <div style="font-weight:800;font-size:22px;margin-bottom:8px;">Your file is stached.</div>
        <a href="${url}" style="color:#171717;word-break:break-all;">${url}</a>
        <div style="margin-top:16px;color:#666;">Mock upload complete. Real indexd wiring comes next.</div>
      `
    }
  }, 180)
})
