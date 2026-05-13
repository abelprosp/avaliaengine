import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { mergePropertyForm, parsePropertyQrPayload } from '../lib/scanPropertyPayload'
import type { PropertyFormData } from '../types/property'

const SCAN3D_MAX_FRAMES = 12
const SCAN3D_INTERVAL_MS = 650
const SCAN3D_MIN_FRAMES = 3

type Props = {
  form: PropertyFormData
  onFormChange: (next: PropertyFormData) => void
  photoBase64: string | null
  onPhotoChange: (jpegBase64WithoutPrefix: string | null) => void
  scan3dFrames: string[] | null
  onScan3dFramesChange: (frames: string[] | null) => void
}

type CamStatus = 'idle' | 'loading' | 'live' | 'error'

function captureVideoJpegBase64(video: HTMLVideoElement, canvas: HTMLCanvasElement, quality: number): string | null {
  const w = video.videoWidth
  const h = video.videoHeight
  if (w < 16 || h < 16) return null
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : null
}

export function MobileCameraPanel({
  form,
  onFormChange,
  photoBase64,
  onPhotoChange,
  scan3dFrames,
  onScan3dFramesChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const formRef = useRef(form)
  const onFormChangeRef = useRef(onFormChange)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanBufferRef = useRef<string[]>([])

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    onFormChangeRef.current = onFormChange
  }, [onFormChange])

  const [status, setStatus] = useState<CamStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scan3dActive, setScan3dActive] = useState(false)

  const stopScan3dInterval = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    stopScan3dInterval()
    setScan3dActive(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setScanning(false)
    setStatus('idle')
  }, [stopScan3dInterval])

  useEffect(() => () => stopStream(), [stopStream])

  const startCamera = async () => {
    setMessage(null)
    setStatus('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (!v) {
        stopStream()
        return
      }
      v.srcObject = stream
      v.setAttribute('playsinline', 'true')
      v.muted = true
      await v.play()
      setStatus('live')
    } catch {
      setStatus('error')
      setMessage('Não foi possível acessar a câmera. Confira permissões e use HTTPS (ou localhost).')
    }
  }

  useEffect(() => {
    if (!scanning || status !== 'live') return

    let active = true

    const loop = () => {
      if (!active) return

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !streamRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      if (video.readyState < video.HAVE_CURRENT_DATA) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const w = video.videoWidth
      const h = video.videoHeight
      if (w < 16 || h < 16) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      ctx.drawImage(video, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' })

      if (code?.data) {
        const partial = parsePropertyQrPayload(code.data)
        if (partial) {
          onFormChangeRef.current(mergePropertyForm(formRef.current, partial))
          setMessage('QR lido: dados aplicados ao formulário.')
          setScanning(false)
          active = false
          return
        }
        setMessage('QR encontrado, mas o conteúdo não é um JSON de imóvel válido.')
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [scanning, status])

  const toggleQrScan = () => {
    if (status !== 'live' || scan3dActive) return
    setMessage(null)
    setScanning((s) => !s)
  }

  const startScan3d = () => {
    if (status !== 'live') return
    setScanning(false)
    setMessage(null)
    stopScan3dInterval()
    scanBufferRef.current = []
    onScan3dFramesChange(null)
    setScan3dActive(true)

    const snap = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      const b64 = captureVideoJpegBase64(video, canvas, 0.78)
      if (!b64) return
      scanBufferRef.current.push(b64)
      onScan3dFramesChange([...scanBufferRef.current])
      const n = scanBufferRef.current.length
      if (n >= SCAN3D_MAX_FRAMES) {
        stopScan3dInterval()
        setScan3dActive(false)
        setMessage(`Passeio concluído: ${n} vistas salvas. Na avaliação com IA, elas serão lidas em sequência (não é nuvem de pontos 3D).`)
      }
    }

    snap()
    scanIntervalRef.current = setInterval(snap, SCAN3D_INTERVAL_MS)
  }

  const finishScan3dEarly = () => {
    stopScan3dInterval()
    setScan3dActive(false)
    const n = scanBufferRef.current.length
    if (n >= SCAN3D_MIN_FRAMES) {
      onScan3dFramesChange([...scanBufferRef.current])
      setMessage(`Passeio salvo com ${n} vista(s).`)
    } else {
      scanBufferRef.current = []
      onScan3dFramesChange(null)
      setMessage(`Precisa de pelo menos ${SCAN3D_MIN_FRAMES} vistas (ou aguarde o passeio automático até ${SCAN3D_MAX_FRAMES}).`)
    }
  }

  const clearScan3d = () => {
    stopScan3dInterval()
    setScan3dActive(false)
    scanBufferRef.current = []
    onScan3dFramesChange(null)
    setMessage(null)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || status !== 'live') return
    const b64 = captureVideoJpegBase64(video, canvas, 0.82)
    if (!b64) {
      setMessage('Aguarde o vídeo estabilizar e tente de novo.')
      return
    }
    onPhotoChange(b64)
    setMessage('Foto capturada: será enviada junto na próxima avaliação (IA com visão), se não houver passeio 3D.')
  }

  const clearPhoto = () => {
    onPhotoChange(null)
    setMessage(null)
  }

  const scanCount = scan3dFrames?.length ?? 0

  return (
    <div className="cam-panel">
      <div className="cam-panel-head">
        <h3>Câmera do celular</h3>
        <p className="hint">
          <strong>Passeio 3D (leve):</strong> várias fotos em sequência enquanto você gira pelo cômodo — a IA infere
          continuidade e padrão, mas isso <strong>não substitui</strong> escaneamento 3D profissional (LiDAR / nuvem de
          pontos / splats).
        </p>
      </div>

      <div className="cam-preview-wrap">
        <video ref={videoRef} className="cam-video" playsInline muted />
        <canvas ref={canvasRef} className="cam-canvas-hidden" aria-hidden />
        {status === 'idle' || status === 'error' || status === 'loading' ? (
          <div className="cam-placeholder">
            {status === 'loading' ? 'Conectando à câmera…' : 'Prévia da câmera aparece aqui'}
          </div>
        ) : null}
        {scan3dActive ? (
          <div className="cam-scan-overlay" role="status">
            Gravando passeio: {scanCount}/{SCAN3D_MAX_FRAMES} — gire devagar pelo ambiente
          </div>
        ) : null}
      </div>

      <div className="cam-actions">
        {status === 'idle' || status === 'error' ? (
          <button type="button" className="btn-secondary" onClick={startCamera}>
            Abrir câmera
          </button>
        ) : null}
        {status === 'loading' ? (
          <span className="cam-loading">Abrindo câmera…</span>
        ) : null}
        {status === 'live' ? (
          <>
            <button
              type="button"
              className={`btn-secondary ${scanning ? 'btn-active' : ''}`}
              onClick={toggleQrScan}
              disabled={scan3dActive}
            >
              {scanning ? 'Parar leitura de QR' : 'Escanear QR de dados'}
            </button>
            {!scan3dActive ? (
              <button type="button" className="btn-secondary" onClick={startScan3d} disabled={scanning}>
                Passeio 3D para IA
              </button>
            ) : (
              <>
                <button type="button" className="btn-secondary btn-active" onClick={finishScan3dEarly}>
                  Concluir passeio agora
                </button>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={capturePhoto} disabled={scanning || scan3dActive}>
              Uma foto só
            </button>
            <button type="button" className="btn-ghost" onClick={stopStream}>
              Fechar câmera
            </button>
          </>
        ) : null}
      </div>

      {scanCount > 0 ? (
        <div className="cam-scan-strip-wrap">
          <p className="cam-scan-strip-label">
            Vistas do passeio ({scanCount}) — na IA, prioridade sobre “uma foto só”.
          </p>
          <div className="cam-scan-strip">
            {scan3dFrames?.map((f, i) => (
              <img
                key={`${i}-${f.slice(0, 12)}`}
                className="cam-scan-thumb"
                src={`data:image/jpeg;base64,${f}`}
                alt={`Vista ${i + 1} do passeio`}
              />
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={clearScan3d}>
            Limpar passeio 3D
          </button>
        </div>
      ) : null}

      {photoBase64 ? (
        <div className="cam-thumb-row">
          <img className="cam-thumb" src={`data:image/jpeg;base64,${photoBase64}`} alt="Prévia da foto capturada" />
          <button type="button" className="btn-ghost" onClick={clearPhoto}>
            Remover foto única
          </button>
        </div>
      ) : null}

      {message ? <p className="cam-msg">{message}</p> : null}

      <details className="cam-qr-help">
        <summary>Formato do JSON no QR</summary>
        <pre className="cam-qr-sample">
{`{
  "city": "São Paulo",
  "neighborhood": "Moema",
  "areaM2": 85,
  "bedrooms": 3,
  "bathrooms": 2,
  "parking": 1,
  "buildingAgeYears": 8,
  "condition": "bom",
  "notes": "Apartamento alto, face norte"
}`}
        </pre>
        <p className="hint">Também aceita chaves em português: cidade, bairro, quartos, banheiros, vagas, idade.</p>
      </details>
    </div>
  )
}
