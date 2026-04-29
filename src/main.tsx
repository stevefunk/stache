import { initSia, Builder, generateRecoveryPhrase, AppKey, PinnedObject } from '@siafoundation/sia-storage'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

root.innerHTML = `
  <main style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
    <div style="text-align:center;">
      <h1>Stache</h1>
      <button id="connect">Connect</button>
      <br/><br/>
      <input id="file" type="file" />
      <br/><br/>
      <button id="upload">Stache It</button>
      <div id="status" style="margin-top:20px"></div>
    </div>
  </main>
`

const status = document.getElementById('status') as HTMLElement
const fileInput = document.getElementById('file') as HTMLInputElement

const appMeta = {
  appId: '0'.repeat(64),
  name: 'Stache',
  description: 'Stache that file',
  serviceUrl: window.location.origin,
}

let sdk: any = null

async function connect() {
  await initSia()

  const builder = new Builder('https://sia.storage', appMeta)
  await builder.requestConnection()

  window.open(builder.responseUrl(), '_blank')

  status.innerText = 'Waiting for approval...'
  await builder.waitForApproval()

  const phrase = generateRecoveryPhrase()
  sdk = await builder.register(phrase)

  const key = sdk.appKey().export().toHex()
  localStorage.setItem('stache:key', key)

  status.innerText = 'Connected'
}

async function reconnect() {
  const key = localStorage.getItem('stache:key')
  if (!key) return

  await initSia()
  sdk = await new Builder('https://sia.storage', appMeta)
    .connected(new AppKey(Uint8Array.from(key.match(/.{1,2}/g)!.map(b => parseInt(b,16)))))

  if (sdk) status.innerText = 'Reconnected'
}

async function upload() {
  if (!sdk) {
    status.innerText = 'Not connected'
    return
  }

  const file = fileInput.files?.[0]
  if (!file) return

  status.innerText = 'Uploading...'

  const obj = await sdk.upload(new PinnedObject(), file.stream(), {
    maxInflight: 10,
  })

  await sdk.pinObject(obj)

  const url = await sdk.shareObject(obj, Date.now() + 1000 * 60 * 60 * 24 * 365)

  status.innerHTML = `<a href="${url}" target="_blank">${url}</a>`
}

(document.getElementById('connect') as HTMLElement).onclick = connect
(document.getElementById('upload') as HTMLElement).onclick = upload

reconnect()
