import type { Posture, ActivityLevel } from '../types'

interface TransitionMap {
  [key: string]: { next: Posture; prob: number }[]
}

const transitions: Record<Posture, TransitionMap> = {
  lying: {
    resting: [{ next: 'lying', prob: 0.95 }, { next: 'sitting', prob: 0.05 }],
    light: [{ next: 'lying', prob: 0.1 }, { next: 'sitting', prob: 0.8 }, { next: 'standing', prob: 0.1 }],
    moderate: [{ next: 'sitting', prob: 0.3 }, { next: 'standing', prob: 0.6 }, { next: 'walking', prob: 0.1 }],
    heavy: [{ next: 'standing', prob: 0.3 }, { next: 'walking', prob: 0.7 }],
  },
  sitting: {
    resting: [{ next: 'sitting', prob: 0.8 }, { next: 'lying', prob: 0.2 }],
    light: [{ next: 'sitting', prob: 0.7 }, { next: 'standing', prob: 0.25 }, { next: 'lying', prob: 0.05 }],
    moderate: [{ next: 'sitting', prob: 0.2 }, { next: 'standing', prob: 0.7 }, { next: 'walking', prob: 0.1 }],
    heavy: [{ next: 'standing', prob: 0.4 }, { next: 'walking', prob: 0.6 }],
  },
  standing: {
    resting: [{ next: 'standing', prob: 0.4 }, { next: 'sitting', prob: 0.5 }, { next: 'lying', prob: 0.1 }],
    light: [{ next: 'standing', prob: 0.5 }, { next: 'walking', prob: 0.3 }, { next: 'sitting', prob: 0.2 }],
    moderate: [{ next: 'standing', prob: 0.3 }, { next: 'walking', prob: 0.6 }, { next: 'sitting', prob: 0.1 }],
    heavy: [{ next: 'walking', prob: 0.8 }, { next: 'standing', prob: 0.2 }],
  },
  walking: {
    resting: [{ next: 'walking', prob: 0.1 }, { next: 'standing', prob: 0.7 }, { next: 'sitting', prob: 0.2 }],
    light: [{ next: 'walking', prob: 0.3 }, { next: 'standing', prob: 0.6 }, { next: 'sitting', prob: 0.1 }],
    moderate: [{ next: 'walking', prob: 0.6 }, { next: 'standing', prob: 0.4 }],
    heavy: [{ next: 'walking', prob: 0.9 }, { next: 'standing', prob: 0.1 }],
  },
}

export function generatePosture(
  activity: ActivityLevel,
  hourOfDay: number,
  bedStatus: number,
  previousPosture: Posture,
): Posture {
  if (bedStatus === 1) { return 'lying' }
  const options = transitions[previousPosture][activity] || [{ next: previousPosture, prob: 1 }]
  const r = Math.random()
  let cumulative = 0
  for (const opt of options) {
    cumulative += opt.prob
    if (r <= cumulative) return opt.next
  }
  return options[options.length - 1].next
}
