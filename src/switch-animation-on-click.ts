import * as ecs from '@8thwall/ecs'

type VideoSwapSettings = {
  firstVideo: string
  secondVideo: string
}

type PlaneState = VideoSwapSettings & {
  switched: boolean
  initializedFirstVideo?: string
}

const planeStates = new WeakMap<object, PlaneState>()
const listeners = new WeakMap<object, (event: any) => void>()

const setVideo = (world: ecs.World, eid: ecs.Eid, url: string) => {
  if (!ecs.VideoMaterial.has(world, eid)) return false

  ecs.VideoMaterial.mutate(world, eid, (material) => {
    material.textureSrc = url
    return false
  })

  // Keep the selected clip playing after replacing the video texture.
  if (ecs.VideoControls.has(world, eid)) {
    ecs.VideoControls.mutate(world, eid, (controls) => {
      controls.paused = false
      return false
    })
  } else {
    ecs.VideoControls.set(world, eid, {paused: false})
  }
  return true
}

const registerClickListener = (world: ecs.World, eid: ecs.Eid) => {
  const plane = world.three.entityToObject.get(eid)
  if (!plane || listeners.has(plane)) return

  const onTouchStart = (event: any) => {
    const state = planeStates.get(plane)
    if (!state || state.switched) return

    const hitEid = event.data?.target
    if (hitEid === undefined) return

    const hitObject = world.three.entityToObject.get(hitEid)
    let hitPlane = hitEid === eid
    let ancestor = hitObject
    while (!hitPlane && ancestor) {
      if (ancestor === plane) hitPlane = true
      ancestor = ancestor.parent
    }
    if (!hitPlane) return

    if (!setVideo(world, eid, state.secondVideo)) {
      console.error('El plano necesita tener el componente Video Material para cambiar el video.')
      return
    }

    state.switched = true
  }

  listeners.set(plane, onTouchStart)
  world.events.addListener(world.events.globalId, ecs.input.SCREEN_TOUCH_START, onTouchStart)
}

const SwitchVideoOnClick = ecs.registerComponent({
  name: 'switch-video-on-click',
  schema: {
    // @label Video inicial (ruta en assets)
    firstVideo: ecs.string,
    // @label Video al hacer clic (ruta en assets)
    secondVideo: ecs.string,
  },
  schemaDefaults: {
    firstVideo: 'assets/Animacion_1_1.mp4',
    secondVideo: 'assets/Animacion_2_1.mp4',
  },
  add: (world, {eid, schema}) => {
    const plane = world.three.entityToObject.get(eid)
    if (plane) {
      planeStates.set(plane, {...schema, switched: false})
    }
    registerClickListener(world, eid)
  },
  tick: (world, {eid, schema}) => {
    const plane = world.three.entityToObject.get(eid)
    if (plane) {
      let state = planeStates.get(plane)
      if (!state) {
        state = {...schema, switched: false}
        planeStates.set(plane, state)
      }

      const firstVideoChanged = schema.firstVideo !== state.firstVideo
      state.firstVideo = schema.firstVideo
      state.secondVideo = schema.secondVideo

      if (firstVideoChanged || !state.initializedFirstVideo) {
        if (setVideo(world, eid, schema.firstVideo)) {
          state.initializedFirstVideo = schema.firstVideo
          state.switched = false
        }
      }
    }
    registerClickListener(world, eid)
  },
  remove: (world, {eid}) => {
    const plane = world.three.entityToObject.get(eid)
    const listener = plane && listeners.get(plane)
    if (listener) {
      world.events.removeListener(world.events.globalId, ecs.input.SCREEN_TOUCH_START, listener)
      listeners.delete(plane)
    }
    if (plane) planeStates.delete(plane)
  },
})

export {SwitchVideoOnClick}
