import { createMachine, assign } from 'xstate'
import type { WorldContext, SceneId } from './worldContext'
import { initialContext } from './worldContext'
import type { WorldEvent } from './worldEvents'

export const worldMachine = createMachine({
  id: 'world',
  types: {} as {
    context: WorldContext
    events: WorldEvent
  },
  context: initialContext,
  initial: 'entry',
  states: {
    entry: {
      on: {
        BOOTSTRAP_LOADED: {
          actions: assign({
            bootstrap: ({ event }) => event.data,
            liveParams: ({ event }) => event.data.live_params,
            worldMetrics: ({ context, event }) => ({
              ...context.worldMetrics,
              crisisDay: event.data.live_params.crisis_day,
              oilPriceUsd: (event.data.live_params.parameters.brent_crude_usd?.value as number) ?? context.worldMetrics.oilPriceUsd,
            }),
          }),
        },
        SELECT_COUNTRY: {
          target: 'flyTo',
          actions: assign({
            countryId: ({ event }) => event.countryId,
            scene: () => 'flyTo' as SceneId,
            previousScene: ({ context }) => context.scene,
          }),
        },
      },
    },
    flyTo: {
      on: {
        SELECT_ROLE: {
          target: 'baseline',
          actions: assign({
            roleId: ({ event }) => event.roleId,
            profileId: ({ event }) => event.profileId,
            scene: () => 'baseline' as SceneId,
            previousScene: ({ context }) => context.scene,
            inkKnot: ({ event }) => event.roleId === 'nurse' ? 'nurse_intro' : 'driver_intro',
          }),
        },
      },
    },
    baseline: {
      on: {
        ADVANCE_SCENE: {
          target: 'rupture',
          actions: assign({
            scene: () => 'rupture' as SceneId,
            previousScene: ({ context }) => context.scene,
            inkKnot: () => 'rupture',
          }),
        },
      },
    },
    rupture: {
      on: {
        ADVANCE_SCENE: [
          {
            guard: ({ event }) => event.scene === 'detour',
            target: 'detour',
            actions: assign({
              scene: () => 'detour' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'detour',
            }),
          },
          {
            target: 'detour',
            actions: assign({
              scene: () => 'detour' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'exposure',
            }),
          },
        ],
      },
    },
    detour: {
      on: {
        ADVANCE_SCENE: {
          target: 'cascade',
          actions: assign({
            scene: ({ event }) => (event.scene || 'cascade') as SceneId,
            previousScene: ({ context }) => context.scene,
            inkKnot: ({ event }) =>
              event.scene === 'cascade' ? 'medicine_path' : 'food_path',
          }),
        },
      },
    },
    cascade: {
      on: {
        CASCADE_PATH_RECEIVED: {
          actions: assign({
            currentCascade: ({ event }) => event.data,
            currentNodeId: ({ event }) => event.nodeId,
            visitedNodeIds: ({ context, event }) => [...context.visitedNodeIds, event.nodeId],
          }),
        },
        CONNECTION_DISCOVERED: {
          actions: assign({
            discoveredConnections: ({ context, event }) => [
              ...context.discoveredConnections,
              ...event.connections,
            ],
          }),
        },
        ADVANCE_SCENE: [
          {
            guard: ({ event }) => event.scene === 'yourMonth',
            target: 'yourMonth',
            actions: assign({
              scene: () => 'yourMonth' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'your_month',
            }),
          },
          {
            guard: ({ event }) => event.scene === 'whatNext',
            target: 'whatNext',
            actions: assign({
              scene: () => 'whatNext' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'what_next',
            }),
          },
        ],
      },
    },
    yourMonth: {
      on: {
        HOUSEHOLD_IMPACT_RECEIVED: {
          actions: assign({
            householdImpact: ({ event }) => event.data,
            worldMetrics: ({ context, event }) => ({
              ...context.worldMetrics,
              monthlyHitKsh: event.data.monthly_hit.base,
            }),
          }),
        },
        ADVANCE_SCENE: [
          {
            guard: ({ event }) => event.scene === 'whatNext',
            target: 'whatNext',
            actions: assign({
              scene: () => 'whatNext' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'what_next',
            }),
          },
          {
            guard: ({ event }) => event.scene === 'share',
            target: 'share',
            actions: assign({
              scene: () => 'share' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'share',
            }),
          },
        ],
      },
    },
    whatNext: {
      on: {
        SET_FUTURE: {
          target: 'split',
          actions: assign({
            future: ({ event }) => event.future,
            scene: () => 'split' as SceneId,
            previousScene: ({ context }) => context.scene,
          }),
        },
      },
    },
    split: {
      on: {
        WHAT_IF_RECEIVED: {
          actions: assign({
            whatIfResult: ({ event }) => event.data,
          }),
        },
        TOGGLE_COMPARE: {
          actions: assign({
            compareMode: ({ context }) => !context.compareMode,
          }),
        },
        ADVANCE_SCENE: [
          {
            guard: ({ event }) => event.scene === 'whatNext',
            target: 'whatNext',
            actions: assign({
              scene: () => 'whatNext' as SceneId,
              previousScene: ({ context }) => context.scene,
              future: () => 'baseline' as const,
              compareMode: () => false,
              whatIfResult: () => null,
              inkKnot: () => 'what_next',
            }),
          },
          {
            guard: ({ event }) => event.scene === 'share',
            target: 'share',
            actions: assign({
              scene: () => 'share' as SceneId,
              previousScene: ({ context }) => context.scene,
              inkKnot: () => 'share',
            }),
          },
        ],
      },
    },
    share: {
      on: {
        RESET: {
          target: 'entry',
          actions: assign(initialContext),
        },
      },
    },
  },
  on: {
    SET_LENS: {
      actions: assign({ lens: ({ event }) => event.lens }),
    },
    SET_TIME: {
      actions: assign({ time: ({ event }) => event.time }),
    },
    SET_FUTURE: {
      actions: assign({ future: ({ event }) => event.future }),
    },
    SWITCH_PERSPECTIVE: {
      actions: assign({
        roleId: ({ context }) => context.roleId === 'nurse' ? 'driver' : 'nurse',
        profileId: ({ context }) => {
          if (!context.bootstrap) return context.profileId
          const target = context.roleId === 'nurse' ? 'driver' : 'nurse'
          const prof = context.bootstrap.profiles.find(p => p.role === target)
          return prof?.id ?? context.profileId
        },
      }),
    },
    LIVE_PARAMS_UPDATE: {
      actions: assign({
        liveParams: ({ event }) => event.params,
        worldMetrics: ({ context, event }) => ({
          ...context.worldMetrics,
          crisisDay: event.params.crisis_day,
          oilPriceUsd: (event.params.parameters.brent_crude_usd?.value as number) ?? context.worldMetrics.oilPriceUsd,
        }),
      }),
    },
    SET_INK_KNOT: {
      actions: assign({ inkKnot: ({ event }) => event.knot }),
    },
    SET_VISUAL_DOMAIN: {
      actions: assign({ visualDomain: ({ event }) => event.domain }),
    },
    SET_MORPH_QUEUE: {
      actions: assign({ morphQueue: ({ event }) => event.stages }),
    },
    ADVANCE_MORPH_QUEUE: {
      actions: assign({
        visualDomain: ({ context }) => context.morphQueue[0] ?? context.visualDomain,
        morphQueue: ({ context }) => context.morphQueue.slice(1),
      }),
    },
    FREEZE_FLOW: {
      actions: assign({ flowFrozen: () => true }),
    },
    RESUME_FLOW: {
      actions: assign({ flowFrozen: () => false }),
    },
    PAUSE: {
      actions: assign({ playing: () => false }),
    },
    RESUME: {
      actions: assign({ playing: () => true }),
    },
  },
})
