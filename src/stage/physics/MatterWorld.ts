import Matter from 'matter-js'

/**
 * MatterWorld — physics simulation for visceral cascade effects.
 *
 * Zero gravity. Bodies float. Matter computes positions, Pixi renders them.
 * Max 200 active bodies. Sleeping enabled.
 */

export interface MatterWorldAPI {
  engine: Matter.Engine
  world: Matter.World
  update: (delta: number) => void
  addBody: (body: Matter.Body) => void
  removeBody: (body: Matter.Body) => void
  clear: () => void
  createVessel: (x: number, y: number, type: 'tanker' | 'container' | 'lng') => Matter.Body
  createChokepointWall: (x: number, y: number, w: number, h: number) => Matter.Body
  createCongestionParticle: (x: number, y: number) => Matter.Body
  createCompressionWall: (x: number, y: number, w: number, h: number) => Matter.Body
  createBreathingParticle: (x: number, y: number) => Matter.Body
  applyAttractor: (bodies: Matter.Body[], target: { x: number; y: number }, strength: number) => void
  getBodies: () => Matter.Body[]
  dispose: () => void
}

const VESSEL_DEFS = {
  tanker: { radius: 4, density: 0.001, frictionAir: 0.02 },
  container: { radius: 3, density: 0.001, frictionAir: 0.02 },
  lng: { radius: 5, density: 0.001, frictionAir: 0.02 },
}

export function createMatterWorld(width: number, height: number): MatterWorldAPI {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0 },
    enableSleeping: true,
    constraintIterations: 4,
    positionIterations: 8,
  })

  const world = engine.world

  // Boundary walls
  const walls = [
    Matter.Bodies.rectangle(width / 2, -10, width, 20, { isStatic: true }),
    Matter.Bodies.rectangle(width / 2, height + 10, width, 20, { isStatic: true }),
    Matter.Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true }),
    Matter.Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true }),
  ]
  Matter.Composite.add(world, walls)

  function update(delta: number) {
    Matter.Engine.update(engine, delta * 1000)
  }

  function addBody(body: Matter.Body) {
    Matter.Composite.add(world, body)
  }

  function removeBody(body: Matter.Body) {
    Matter.Composite.remove(world, body)
  }

  function clear() {
    Matter.Composite.clear(world, false)
    Matter.Composite.add(world, walls)
  }

  function createVessel(x: number, y: number, type: 'tanker' | 'container' | 'lng') {
    const def = VESSEL_DEFS[type]
    return Matter.Bodies.circle(x, y, def.radius, {
      density: def.density,
      frictionAir: def.frictionAir,
      restitution: 0.3,
      label: `vessel_${type}`,
      collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0001 },
    })
  }

  function createChokepointWall(x: number, y: number, w: number, h: number) {
    return Matter.Bodies.rectangle(x, y, w, h, {
      isStatic: true,
      label: 'chokepoint_wall',
      collisionFilter: { category: 0x0002, mask: 0x0001 },
    })
  }

  function createCongestionParticle(x: number, y: number) {
    return Matter.Bodies.circle(x, y, 2, {
      density: 0.0005,
      frictionAir: 0.05,
      restitution: 0.1,
      label: 'congestion',
    })
  }

  function createCompressionWall(x: number, y: number, w: number, h: number) {
    return Matter.Bodies.rectangle(x, y, w, h, {
      isStatic: true,
      label: 'compression_wall',
    })
  }

  function createBreathingParticle(x: number, y: number) {
    return Matter.Bodies.circle(x, y, 3, {
      density: 0.0005,
      frictionAir: 0.03,
      restitution: 0.5,
      label: 'breathing',
    })
  }

  function applyAttractor(bodies: Matter.Body[], target: { x: number; y: number }, strength: number) {
    for (const body of bodies) {
      const dx = target.x - body.position.x
      const dy = target.y - body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1) {
        const force = strength * dist
        Matter.Body.applyForce(body, body.position, {
          x: (dx / dist) * force,
          y: (dy / dist) * force,
        })
      }
    }
  }

  function getBodies() {
    return Matter.Composite.allBodies(world)
  }

  function dispose() {
    Matter.Engine.clear(engine)
  }

  return {
    engine,
    world,
    update,
    addBody,
    removeBody,
    clear,
    createVessel,
    createChokepointWall,
    createCongestionParticle,
    createCompressionWall,
    createBreathingParticle,
    applyAttractor,
    getBodies,
    dispose,
  }
}
