import * as ecs from '@8thwall/ecs'

const SwitchAnimationOnClick = ecs.registerComponent({
  name: 'switch-animation-on-click',
  stateMachine: ({world, eid, defineState}) => {
    defineState('waiting-for-click')
      .initial()
      .listen(eid, ecs.input.SCREEN_TOUCH_START, (event) => {
        // The screen event is shared; only react when animacion1 was actually hit.
        if (event.data.target !== eid) return

        const source = world.three.entityToObject.get(eid)
        const targetEntry = Array.from(world.three.entityToObject.entries()).find(
          ([, object]) => object.name === 'animacion2'
        )

        if (!source || source.name !== 'animacion1' || !targetEntry) {
          console.warn('No se encontró el objeto animacion1 o animacion2 en la escena.')
          return
        }

        const target = targetEntry[1]

        // Copy the local transform so the second animation occupies the same pose and size.
        target.position.copy(source.position)
        target.quaternion.copy(source.quaternion)
        target.scale.copy(source.scale)
        target.visible = true
        source.visible = false
        target.updateMatrix()
        target.updateMatrixWorld(true)
      })
  },
})

export {SwitchAnimationOnClick}
