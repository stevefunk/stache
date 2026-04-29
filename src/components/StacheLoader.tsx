export default function StacheLoader({ progress }: { progress: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>
        📄 <span style={{ animation: 'wiggle 1s infinite' }}>🥸</span>
      </div>

      <p>Staching your file... {progress}%</p>

      <div style={{ width: 200, height: 6, background: '#eee', margin: 'auto' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'black' }} />
      </div>

      <style>{`
        @keyframes wiggle {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(5deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
