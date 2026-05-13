import { useCallback, useEffect, useRef, useState } from 'react'
import { Application, Entity } from '@playcanvas/react'
import { Camera, Light } from '@playcanvas/react/components'
import { useApp } from '@playcanvas/react/hooks'
import { OrbitControls } from '@playcanvas/react/scripts'
import {
  ADDRESS_CLAMP_TO_EDGE,
  Color,
  Entity as PcEntity,
  FILTER_LINEAR,
  PIXELFORMAT_RGBA8,
  StandardMaterial,
  Texture,
} from 'playcanvas'

/**
 * Coloca o quadro da câmera numa textura PlayCanvas e faz upload por frame (requisito do motor para vídeo).
 */
function LiveVideoPlane({ video }: { video: HTMLVideoElement }) {
  const app = useApp()

  useEffect(() => {
    const device = app.graphicsDevice
    const texture = new Texture(device, {
      name: 'LiveCamera',
      format: PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: FILTER_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
    })
    texture.flipY = false

    const mat = new StandardMaterial()
    mat.useLighting = false
    mat.diffuse = new Color(0, 0, 0)
    mat.emissive = new Color(1, 1, 1)
    mat.update()

    const wall = new PcEntity('LiveVideoPlane')
    wall.addComponent('render', { type: 'plane', material: mat })

    let wallReady = false

    const applyLayout = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (w < 8 || h < 8) return
      texture.setSource(video)
      texture.upload()
      mat.emissiveMap = texture
      mat.update()
      const aspect = w / h
      wall.setLocalPosition(0, 1.6, 0)
      wall.setLocalEulerAngles(-90, 0, 0)
      wall.setLocalScale(aspect * 2.8, 1, 2.8)
      wallReady = true
    }

    const onMeta = () => applyLayout()
    if (video.videoWidth >= 8) applyLayout()
    else video.addEventListener('loadedmetadata', onMeta)

    const onUpdate = () => {
      if (!wallReady || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
      texture.upload()
    }
    app.on('update', onUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      app.off('update', onUpdate)
      wall.destroy()
      mat.destroy()
      texture.destroy()
    }
  }, [app, video])

  return null
}

/**
 * Câmera → textura dinâmica → plano 3D no motor PlayCanvas (tempo real).
 * Isto é projeção do vídeo em geometria, não reconstrução métrica do espaço (SLAM / splat).
 */
export function LiveCamera3DView() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [liveVideo, setLiveVideo] = useState<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'live' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const v = videoRef.current
    if (v) {
      v.srcObject = null
    }
    setLiveVideo(null)
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const startCamera = async () => {
    setMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (!v) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      v.srcObject = stream
      v.muted = true
      v.setAttribute('playsinline', 'true')
      await v.play()
      setLiveVideo(v)
      setStatus('live')
    } catch {
      setStatus('error')
      setMessage('Não foi possível abrir a câmera (permissões ou HTTPS).')
    }
  }

  return (
    <div className="viewer-3d viewer-live-3d">
      <video ref={videoRef} className="live-feed-source" playsInline muted aria-hidden />

      {status !== 'live' ? (
        <div className="viewer-3d--empty live-3d-overlay">
          <p className="viewer-empty-msg">
            O fluxo da câmera é enviado para uma <strong>textura GPU</strong> no PlayCanvas e desenhado num plano 3D em
            tempo real (orbitar para ver). Não é um modelo 3D reconstruído do ambiente — é o vídeo projetado na cena.
          </p>
          <button type="button" className="btn-secondary" onClick={startCamera}>
            Ativar câmera no 3D
          </button>
          {status === 'error' && message ? <p className="error">{message}</p> : null}
        </div>
      ) : null}

      {liveVideo ? (
        <Application className="pc-app" style={{ width: '100%', height: '100%', display: 'block' }}>
          <Entity name="Sun" rotation={[-50, 40, 0]}>
            <Light type="directional" intensity={0.25} />
          </Entity>
          <Entity name="Fill" position={[3, 4, 2]}>
            <Light type="omni" intensity={0.5} />
          </Entity>

          <LiveVideoPlane video={liveVideo} />

          <Entity name="CamRig" position={[0, 1.8, 5.2]}>
            <Camera fov={55} nearClip={0.05} farClip={100} />
            <OrbitControls distance={5.5} distanceMin={2} distanceMax={14} pitchAngleMin={2} pitchAngleMax={88} />
          </Entity>
        </Application>
      ) : null}

      {status === 'live' ? (
        <div className="live-3d-toolbar">
          <button type="button" className="btn-ghost" onClick={stopCamera}>
            Parar câmera
          </button>
        </div>
      ) : null}
    </div>
  )
}
