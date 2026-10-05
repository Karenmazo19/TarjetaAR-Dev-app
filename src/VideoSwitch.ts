import * as ecs from '@8thwall/ecs'

ecs.registerComponent({
  name: 'Video Switch',

  // Attach directly to the plane that displays the videos.
  schema: {
    // @label Enabled
    enabled: ecs.boolean,
    // @label Video 1
    // @asset
    video1: ecs.string,
    // @label Video 2
    // @asset
    video2: ecs.string,
    // @label Play On Start
    playOnStart: ecs.boolean,
    // @label Loop
    loop: ecs.boolean,
    // Start silently; raise Volume in the Inspector for sound.
    // @label Volume
    // @min 0
    // @max 1
    volume: ecs.f32,
  },

  schemaDefaults: {
    enabled: true,
    playOnStart: true,
    loop: true,
    volume: 0,
  },

  stateMachine: ({world, eid, schemaAttribute}) => {
    let current: 1 | 2 = 1
    let selectedSrc = ''
    let nextClickAt = 0
    let lastWarning = ''
    const taps = new Set<number>()
    const maxTapMovement = 0.025

    const getMaterial = () => [ecs.Material, ecs.UnlitMaterial, ecs.VideoMaterial]
      .find(material => material.has(world, eid))

    const warn = (message: string) => {
      if (message !== lastWarning) console.warn(`Video Switch: ${message}`)
      lastWarning = message
    }

    const select = (next: 1 | 2, paused = false) => {
      const options = schemaAttribute.get(eid)
      if (!options.enabled) return false
      const src = (next === 1 ? options.video1 : options.video2).trim()
      if (!src) {
        warn(`Assign Video ${next} in the Inspector.`)
        return false
      }
      const material = getMaterial()
      // The scene may still be creating the plane. Retry on the next tick.
      if (!material) return false
      if (src === selectedSrc && next !== current) {
        warn('Choose two different video files.')
        return false
      }

      ecs.VideoControls.set(world, eid, {
        paused,
        loop: options.loop,
        volume: Math.max(0, Math.min(1, options.volume)),
      })
      material.mutate(world, eid, (cursor) => {
        cursor.textureSrc = src
      })
      current = next
      selectedSrc = src
      lastWarning = ''
      return true
    }

    const sync = () => {
      const options = schemaAttribute.get(eid)
      if (!options.enabled) {
        taps.clear()
        return
      }
      if (!selectedSrc) {
        select(1, !options.playOnStart)
        return
      }
      const src = (current === 1 ? options.video1 : options.video2).trim()
      // Allow changing the active asset from the Inspector during preview.
      if (src && src !== selectedSrc) select(current)
      if (!ecs.VideoControls.has(world, eid)) return
      const controls = ecs.VideoControls.get(world, eid)
      const volume = Math.fround(Math.max(0, Math.min(1, options.volume)))
      if (controls.loop !== options.loop || controls.volume !== volume) {
        ecs.VideoControls.mutate(world, eid, (cursor) => {
          cursor.loop = options.loop
          cursor.volume = volume
        })
      }
    }

    const hitsPlane = (entity: bigint | undefined) => {
      for (let target = entity; target; target = world.getParent(target)) {
        if (ecs.Ui.has(world, target)) return false
        if (target === eid) return true
      }
      return false
    }

    ecs.defineState('ready').initial()
      .onEnter(sync)
      .onTick(sync)
      .onExit(() => taps.clear())
      .listen(world.events.globalId, ecs.input.SCREEN_TOUCH_START, ({data}) => {
        taps.delete(data.pointerId)
        if (schemaAttribute.get(eid).enabled && hitsPlane(data.target)) taps.add(data.pointerId)
      })
      .listen(world.events.globalId, ecs.input.SCREEN_TOUCH_MOVE, ({data}) => {
        const distance = Math.hypot(data.position.x - data.start.x, data.position.y - data.start.y)
        if (distance > maxTapMovement) taps.delete(data.pointerId)
      })
      .listen(world.events.globalId, ecs.input.GESTURE_START, ({data}) => {
        if (data.touchCount > 1) taps.clear()
      })
      .listen(world.events.globalId, ecs.input.SCREEN_TOUCH_END, ({data}) => {
        if (!taps.delete(data.pointerId) || !hitsPlane(data.target) || !hitsPlane(data.endTarget)) return
        const distance = Math.hypot(data.position.x - data.start.x, data.position.y - data.start.y)
        if (distance > maxTapMovement || world.time.elapsed < nextClickAt) return
        if (select(selectedSrc && current === 1 ? 2 : 1)) {
          nextClickAt = world.time.elapsed + 200
        }
      })
      .listen(eid, ecs.events.VIDEO_CAN_PLAY_THROUGH, ({data}) => {
        // Seek only once the new texture is registered, never on the outgoing video.
        if (schemaAttribute.get(eid).enabled && data.src === selectedSrc) {
          ecs.video.setCurrentTime(world, eid, 0, {src: data.src, textureKey: 'textureSrc'})
        }
      })
      .listen(eid, 'video-error', ({data}) => {
        // Rapid changes can cancel a pending play request for the outgoing video.
        if (data.error?.name !== 'AbortError') {
          console.warn('Video Switch: Could not play the video.', data.error)
        }
      })
  },
})
