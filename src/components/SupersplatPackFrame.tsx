import { useEffect, useRef, useState } from 'react'

/**
 * Empacotamento oficial do viewer SuperSplat (@playcanvas/supersplat-viewer).
 * Carrega html+css+js sob demanda (chunk separado).
 */
export function SupersplatPackFrame() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const m = await import('@playcanvas/supersplat-viewer')
        if (cancelled || !iframeRef.current) return
        const doc =
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${m.css}</style></head><body>${m.html}<script type="module">${m.js}</script></body></html>`
        iframeRef.current.srcdoc = doc
        setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setErrMsg(e instanceof Error ? e.message : String(e))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="pack-frame-wrap">
      <p className="hint pack-frame-hint">
        Viewer empacotado do pacote <code>@playcanvas/supersplat-viewer</code> (mesmo ecossistema do{' '}
        <a href="https://github.com/playcanvas/supersplat" target="_blank" rel="noreferrer">
          SuperSplat
        </a>
        ). Pode demorar a carregar na primeira vez.
      </p>
      {status === 'error' ? <p className="error">{errMsg}</p> : null}
      {status === 'loading' ? <p className="cam-loading">A carregar pacote do viewer…</p> : null}
      <iframe
        ref={iframeRef}
        title="SuperSplat viewer (pacote npm)"
        className="pack-frame"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
