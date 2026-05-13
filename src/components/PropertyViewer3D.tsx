import { Application, Entity } from '@playcanvas/react'
import { Camera, Light, Render } from '@playcanvas/react/components'
import { OrbitControls } from '@playcanvas/react/scripts'

/**
 * Cena simples de sala para explorar com órbita — representação ilustrativa, não planta cadastral.
 */
export function PropertyViewer3D() {
  return (
    <div className="viewer-3d">
      <Application className="pc-app" style={{ width: '100%', height: '100%', display: 'block' }}>
        <Entity name="Sun" rotation={[-50, 35, 0]}>
          <Light type="directional" intensity={1.15} castShadows />
        </Entity>
        <Entity name="Fill" position={[-4, 3, 4]}>
          <Light type="omni" intensity={0.35} />
        </Entity>

        <Entity name="Floor" position={[0, 0, 0]} scale={[14, 0.12, 10]}>
          <Render type="box" />
        </Entity>
        <Entity name="WallBack" position={[0, 2.2, -5]} scale={[14, 4.4, 0.15]}>
          <Render type="box" />
        </Entity>
        <Entity name="WallLeft" position={[-7, 2.2, 0]} scale={[0.15, 4.4, 10]}>
          <Render type="box" />
        </Entity>
        <Entity name="WallRight" position={[7, 2.2, 0]} scale={[0.15, 4.4, 10]}>
          <Render type="box" />
        </Entity>

        <Entity name="Sofa" position={[2, 0.45, 1]} scale={[3.2, 0.55, 1.2]}>
          <Render type="box" />
        </Entity>
        <Entity name="Table" position={[-1.2, 0.38, 2.2]} scale={[1.6, 0.35, 0.9]}>
          <Render type="box" />
        </Entity>
        <Entity name="Rug" position={[-0.5, 0.07, 1.2]} scale={[4, 0.02, 2.8]}>
          <Render type="box" />
        </Entity>

        <Entity name="CamRig" position={[0, 2.4, 9]}>
          <Camera fov={52} nearClip={0.1} farClip={200} />
          <OrbitControls distance={11} distanceMin={5} distanceMax={22} pitchAngleMin={5} pitchAngleMax={85} />
        </Entity>
      </Application>
    </div>
  )
}
