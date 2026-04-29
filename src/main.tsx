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

let sdk: any = null

const status = document.getElementById('status')!

(document.getElementById('connect') as HTMLElement).onclick = async () => {
  const { initSia, Builder, generateRecoveryPhrase } = await import('@siafoundation/sia-storage')

  await initSia()

  const builder = new Builder('https://sia.storage', {
    appId: '0'.repeat(64),
    name: 'Stache',
    description: 'Stache that file',
    serviceUrl: window.location.origin,
  })

  await builder.requestConnection()
  window.open(builder.responseUrl(), '_blank')

  status.innerText = 'Waiting for approval...'
  await builder.waitForApproval()

  const phrase = generateRecoveryPhrase()
  sdk = await builder.register(phrase)

  status.innerText = 'Connected'
}

(document.getElementById('upload') as HTMLElement).onclick = async () => {
  if (!sdk) {
    status.innerText = 'Not connected'
    return
  }

  const file = (document.getElementById('file') as HTMLInputElement).files?.[0]
  if (!file) return

  const { PinnedObject } = await import('@siafoundation/sia-storage')

  status.innerText = 'Uploading...'

  const obj = await sdk.upload(new PinnedObject(), file.stream(), {
    maxInflight: 10,
  })

  await sdk.pinObject(obj)

  const url = await sdk.shareObject(obj, Date.now() + 1000 * 60 * 60 * 24 * 365)

  status.innerHTML = `<a href="${url}" target="_blank">${url}</a>`
}
