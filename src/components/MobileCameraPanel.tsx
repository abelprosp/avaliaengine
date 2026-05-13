import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { mergePropertyForm, parsePropertyQrPayload } from '../lib/scanPropertyPayload'
import type { PropertyFormData } from '../types/property'

type Props = {
  form: PropertyFormData
  onFormChange: (next: PropertyFormData) => void
  photoBase64: string | null
  onPhotoChange: (jpegBase64WithoutPrefix: string | null) => void
}

type CamStatus = 'idle' | 'loading' | 'live' | 'error'

export function MobileCameraPanel({ form, onFormChange, photoBase64, onPhotoChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const formRef = useRef(form)
  const onFormChangeRef = useRef(onFormChange)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    onFormChangeRef.current = onFormChange
  }, [onFormChange])

  const [status, setStatus] = useState<CamStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setScanning(false)
    setStatus('idle')
  }, [])

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
    if (status !== 'live') return
    setMessage(null)
    setScanning((s) => !s)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || status !== 'live') return
    const w = video.videoWidth
    const h = video.videoHeight
    if (w < 16 || h < 16) {
      setMessage('Aguarde o vídeo estabilizar e tente de novo.')
      return
    }
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    const comma = dataUrl.indexOf(',')
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
    if (!b64) return
    onPhotoChange(b64)
    setMessage('Foto capturada: será enviada junto na próxima avaliação (IA com visão).')
  }

  const clearPhoto = () => {
    onPhotoChange(null)
    setMessage(null)
  }

  return (
    <div className="cam-panel">
      <div className="cam-panel-head">
        <h3>Câmera do celular</h3>
        <p className="hint">
          Use um <strong>QR com JSON</strong> dos dados do imóvel ou <strong>fotografe o ambiente</strong> para a IA
          considerar acabamento e conservação aparente.
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
            <button type="button" className={`btn-secondary ${scanning ? 'btn-active' : ''}`} onClick={toggleQrScan}>
              {scanning ? 'Parar leitura de QR' : 'Escanear QR de dados'}
            </button>
            <button type="button" className="btn-secondary" onClick={capturePhoto}>
              Capturar foto do ambiente
            </button>
            <button type="button" className="btn-ghost" onClick={stopStream}>
              Fechar câmera
            </button>
          </>
        ) : null}
      </div>

      {photoBase64 ? (
        <div className="cam-thumb-row">
          <img
            className="cam-thumb"
            src={`data:image/jpeg;base64,${photoBase64}`}
            alt="Prévia da foto capturada"
          />
          <button type="button" className="btn-ghost" onClick={clearPhoto}>
            Remover foto
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
