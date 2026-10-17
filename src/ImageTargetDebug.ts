import * as ecs from '@8thwall/ecs'

ecs.registerComponent({
  name: 'Image Target Debug',

  stateMachine: ({world}) => {
    const panel = document.createElement('div')
    panel.textContent = 'Iniciando diagnóstico AR…'
    Object.assign(panel.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      zIndex: '2147483647',
      maxWidth: 'calc(100vw - 24px)',
      padding: '10px 14px',
      borderRadius: '8px',
      background: 'rgba(0, 0, 0, 0.78)',
      color: '#fff',
      font: '14px/1.4 sans-serif',
      pointerEvents: 'none',
    })
    document.body.appendChild(panel)

    const showTargets = (prefix: string, data: any) => {
      const names = (data?.imageTargets || []).map((target: any) => target.name).join(', ')
      panel.textContent = names ? `${prefix}: ${names}` : prefix
    }

    ecs.defineState('diagnosing')
      .initial()
      .listen(world.events.globalId, ecs.events.REALITY_CAMERA_CONFIGURED, () => {
        panel.textContent = 'Cámara lista; esperando la búsqueda del objetivo…'
      })
      .listen(world.events.globalId, ecs.events.REALITY_IMAGE_LOADING, ({data}) => {
        showTargets('Cargando objetivo', data)
      })
      .listen(world.events.globalId, ecs.events.REALITY_IMAGE_SCANNING, ({data}) => {
        showTargets('Buscando objetivo', data)
      })
      .listen(world.events.globalId, ecs.events.REALITY_IMAGE_FOUND, ({data}) => {
        panel.textContent = `Objetivo detectado: ${(data as any)?.name || 'sin nombre'}`
      })
      .listen(world.events.globalId, ecs.events.REALITY_IMAGE_LOST, ({data}) => {
        panel.textContent = `Objetivo perdido: ${(data as any)?.name || 'sin nombre'}`
      })
      .onExit(() => panel.remove())
  },
})
