// 骨骼驱动引擎 — 17关键点 → 关节角度 → 3D骨骼动画

export interface JointAngles {
  headTilt: [number, number, number]       // [x, y, z] rotation
  torsoLean: [number, number, number]
  leftShoulder: [number, number, number]
  leftElbow: [number, number, number]
  rightShoulder: [number, number, number]
  rightElbow: [number, number, number]
  leftHip: [number, number, number]
  leftKnee: [number, number, number]
  rightHip: [number, number, number]
  rightKnee: [number, number, number]
}

const DEFAULT_ANGLES: JointAngles = {
  headTilt: [0, 0, 0], torsoLean: [0, 0, 0],
  leftShoulder: [0, 0, 0.1], leftElbow: [0, 0, 0],
  rightShoulder: [0, 0, -0.1], rightElbow: [0, 0, 0],
  leftHip: [0, 0, 0], leftKnee: [0, 0, 0],
  rightHip: [0, 0, 0], rightKnee: [0, 0, 0],
}

function angle2D(a: [number, number], b: [number, number], c: [number, number]): number {
  const v1 = [a[0] - b[0], a[1] - b[1]]
  const v2 = [c[0] - b[0], c[1] - b[1]]
  const dot = v1[0] * v2[0] + v1[1] * v2[1]
  const m1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2)
  const m2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2)
  if (m1 * m2 < 0.001) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2))))
}

function mid(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

export function computeJointAnglesFromKeypoints(
  kps: Record<string, [number, number]> | null,
): JointAngles {
  if (!kps) return DEFAULT_ANGLES

  const get = (name: string): [number, number] | null => {
    const v = kps[name]
    return (v && !(v[0] === 0 && v[1] === 0)) ? v : null
  }

  const nose = get('nose')
  const lsh = get('left_shoulder'); const rsh = get('right_shoulder')
  const lel = get('left_elbow'); const rel = get('right_elbow')
  const lwr = get('left_wrist'); const rwr = get('right_wrist')
  const lhip = get('left_hip'); const rhip = get('right_hip')
  const lkn = get('left_knee'); const rkn = get('right_knee')
  const lank = get('left_ankle'); const rank = get('right_ankle')

  const shMid = lsh && rsh ? mid(lsh, rsh) : null
  const hipMid = lhip && rhip ? mid(lhip, rhip) : null

  // Head tilt: angle of nose-shoulderMid from vertical
  const headTilt: [number, number, number] = nose && shMid
    ? [0, 0, Math.atan2(nose[0] - shMid[0], Math.abs(nose[1] - shMid[1]) + 0.001) * 2]
    : [0, 0, 0]

  // Torso lean: angle of shoulderMid-hipMid from vertical
  const torsoLean: [number, number, number] = shMid && hipMid
    ? [Math.atan2(hipMid[0] - shMid[0], Math.abs(hipMid[1] - shMid[1]) + 0.001), 0, 0]
    : [0, 0, 0]

  // Left shoulder: abduction angle
  const lsa: [number, number, number] = lsh && lel && hipMid
    ? [0, 0, (Math.PI / 2 - angle2D(lel, lsh, [shMid[0], shMid[1] - 0.1])) * 0.8 + 0.1]
    : [0, 0, 0.1]
  // Left elbow: flexion angle
  const lela: [number, number, number] = lel && lwr
    ? [(Math.PI - angle2D(lsh || [0, 0], lel, lwr)) * 0.6, 0, 0]
    : [0, 0, 0]

  // Right shoulder
  const rsa: [number, number, number] = rsh && rel && hipMid
    ? [0, 0, -(Math.PI / 2 - angle2D(rel, rsh, [shMid[0], shMid[1] - 0.1])) * 0.8 - 0.1]
    : [0, 0, -0.1]
  // Right elbow
  const rela: [number, number, number] = rel && rwr
    ? [(Math.PI - angle2D(rsh || [0, 0], rel, rwr)) * 0.6, 0, 0]
    : [0, 0, 0]

  // Left hip: flexion
  const lha: [number, number, number] = lhip && lkn && shMid
    ? [angle2D([shMid[0], shMid[1] + 0.3], lhip, lkn) * 0.6, 0, 0]
    : [0, 0, 0]
  // Left knee
  const lka: [number, number, number] = lkn && lank
    ? [(Math.PI - angle2D(lhip || [0, 0], lkn, lank)) * 0.7, 0, 0]
    : [0, 0, 0]

  // Right hip
  const rha: [number, number, number] = rhip && rkn && shMid
    ? [angle2D([shMid[0], shMid[1] + 0.3], rhip, rkn) * 0.6, 0, 0]
    : [0, 0, 0]
  // Right knee
  const rka: [number, number, number] = rkn && rank
    ? [(Math.PI - angle2D(rhip || [0, 0], rkn, rank)) * 0.7, 0, 0]
    : [0, 0, 0]

  return { headTilt, torsoLean, leftShoulder: lsa, leftElbow: lela, rightShoulder: rsa, rightElbow: rela, leftHip: lha, leftKnee: lka, rightHip: rha, rightKnee: rka }
}
