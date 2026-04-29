const API_URL = 'http://localhost:3001'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

root.innerHTML = `
  <main style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
    <div style="text-align:center;">
      <h1>Stache</h1>
      <input id="file" type="file" />
      <br/><br/>
      <button id="btn">Stache It</button>
      <div id="status" style="margin-top:20px"></div>
    </div>
  </main>
`

const fileInput = document.getElementById('file')
const btn = document.getElementById('btn')
const status = document.getElementById('status')

btn.onclick = async () => {
  const file = fileInput.files[0]
  if (!file) return

  const form = new FormData()
  form.append('file', file)

  status.innerText = 'Uploading...'

  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: form
  })

  const data = await res.json()

  status.innerHTML = `<a href="${data.url}">${data.url}</a>`
}
