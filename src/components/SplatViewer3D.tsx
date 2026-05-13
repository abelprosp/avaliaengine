import { Suspense, useCallback, useState } from 'react'
import { Application, Entity } from '@playcanvas/react'
import { Camera, GSplat, Light } from '@playcanvas/react/components'
import { useSplat } from '@playcanvas/react/hooks'
import { OrbitControls } from '@playcanvas/react/scripts'

function SplatFromUrl({ url, onLoadError }: { url: string; onLoadError: (msg: string | null) => void }) {
  const { asset, loading, error } = useSplat(url)

  useEffect(() => {
    if (error) {
      onLoadError(typeof error === 'string' ? error : 'Não foi possível carregar o splat neste motor.')
    } else {
      onLoadError(null)
    }
  }, [error, onLoadError])

  if (loading || !asset) {
    return null
  }

  return (
    <Entity name="SplatRoot">
      <GSplat asset={asset} />
    </Entity>
  )
}

type Props = {
  splatUrl: string | null
}

/**
 * Gaussian Splat no motor PlayCanvas (@playcanvas/react + GSplat).
 */
export function SplatViewer3D({ splatUrl }: Props) {
  const [loadError, setLoadError] = useState<string | null>(null)
  const onLoadError = useCallback((msg: string | null) => setLoadError(msg), [])

  if (!splatUrl) {
    return (
      <div className="viewer-3d viewer-3d--empty">
        <p className="viewer-empty-msg">
          Carregue um ficheiro de splat (.ply, .sog, .spz, …) para visualizar aqui. O ficheiro é primeiro analisado com{' '}
          <code>@playcanvas/splat-transform</code> (estatísticas para a IA) e depois mostrado com{' '}
          <code>GSplat</code> no motor <code>playcanvas</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="viewer-3d viewer-3d--splat">
      {loadError ? (
        <div className="viewer-error-banner" role="alert">
          {loadError}
        </div>
      ) : null}
      <Application className="pc-app" style={{ width: '100%', height: '100%', display: 'block' }}>
        <Entity name="Sun" rotation={[-55, 40, 0]}>
          <Light type="directional" intensity={1.05} />
        </Entity>
        <Entity name="Fill" position={[2, 4, 6]}>
          <Light type="omni" intensity={0.25} />
        </Entity>

        <Suspense fallback={null}>
          <SplatFromUrl url={splatUrl} onLoadError={onLoadError} />
        </Suspense>

        <Entity name="CamRig" position={[0, 1.2, 6]}>
          <Camera fov={60} nearClip={0.05} farClip={500} />
          <OrbitControls distance={8} distanceMin={1} distanceMax={40} pitchAngleMin={2} pitchAngleMax={88} />
        </Entity>
      </Application>
    </div>
  )
}
