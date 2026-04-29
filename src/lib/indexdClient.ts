export async function uploadFile(file: File, onProgress: (p: number) => void) {
  // MOCK upload for now
  let progress = 0
  return new Promise<{ url: string }>((resolve) => {
    const interval = setInterval(() => {
      progress += 10
      onProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        const fakeId = Math.random().toString(36).slice(2)
        resolve({ url: `https://stache.app/file/${fakeId}` })
      }
    }, 200)
  })
}
