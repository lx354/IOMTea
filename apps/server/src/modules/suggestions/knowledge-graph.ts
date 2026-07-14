// 知识图谱 — 从 8 个临床病例提取症状-诱因-干预网络

export interface GraphNode {
  id: string
  type: 'patient' | 'symptom' | 'trigger' | 'intervention' | 'drug'
  label: string
  description: string
  caseIds: string[]  // 关联病例
  importance: number // 1-10 严重程度/优先级
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
  weight: number
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── 从病例档案提取 ──

export function buildKnowledgeGraph(): KnowledgeGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const addNode = (n: GraphNode) => { if (!nodes.find((x) => x.id === n.id)) nodes.push(n) }
  const addEdge = (s: string, t: string, r: string, w: number = 1) => {
    if (!edges.find((e) => e.source === s && e.target === t)) edges.push({ source: s, target: t, relation: r, weight: w })
  }

  // ── 症状定义 ──
  const symptoms = [
    { id: 'sunset_agitation', label: '日落加重', desc: '黄昏时段情绪激越、焦躁不安', cases: ['aggressive'], imp: 8 },
    { id: 'suspicion_poison', label: '被害妄想-中毒', desc: '怀疑饭菜/药物被下毒', cases: ['aggressive', 'aggressive_resistant'], imp: 9 },
    { id: 'verbal_aggression', label: '语言攻击', desc: '辱骂、威胁性语言、吼叫', cases: ['aggressive', 'aggressive_resistant', 'agitated'], imp: 7 },
    { id: 'physical_aggression', label: '肢体攻击', desc: '拍桌子、推人、摔东西', cases: ['aggressive', 'aggressive_resistant'], imp: 9 },
    { id: 'social_withdrawal', label: '社交退缩', desc: '不与人互动、沉默寡言', cases: ['withdrawn'], imp: 6 },
    { id: 'emotional_blunting', label: '情感淡漠', desc: '面部无表情、不笑不哭', cases: ['withdrawn'], imp: 5 },
    { id: 'separation_anxiety', label: '分离焦虑', desc: '照护者离开视线即恐慌', cases: ['anxious_dependent'], imp: 7 },
    { id: 'repetitive_questioning', label: '反复确认', desc: '同一问题反复问多次', cases: ['anxious_dependent', 'obsessive'], imp: 4 },
    { id: 'disinhibition', label: '脱抑制行为', desc: '不合时宜大笑、抱陌生人、脱衣服', cases: ['cheerful_chaotic'], imp: 6 },
    { id: 'elopement_risk', label: '游走风险', desc: '试图离开安全区域、找借口出门', cases: ['wandering', 'anxious_wandering'], imp: 9 },
    { id: 'spatial_disorientation', label: '空间定向丧失', desc: '不认路、无法找到房间', cases: ['wandering', 'anxious_wandering'], imp: 7 },
    { id: 'care_refusal', label: '拒绝照护', desc: '凡事说"不"、拒绝服药/洗澡/进食', cases: ['resistant', 'aggressive_resistant'], imp: 8 },
    { id: 'control_struggle', label: '控制权争夺', desc: '与照护者较劲、测试边界', cases: ['resistant', 'aggressive_resistant'], imp: 7 },
    { id: 'sleep_reversal', label: '昼夜颠倒', desc: '白天昏睡、夜间清醒', cases: ['reversed_sleep'], imp: 6 },
    { id: 'hoarding', label: '收集囤积', desc: '捡拾废弃物品、房间堆满杂物', cases: ['hoarding'], imp: 4 },
    { id: 'regression', label: '退行行为', desc: '行为退化到孩童水平、要抱抱', cases: ['regressed'], imp: 6 },
    { id: 'visual_hallucination', label: '视幻觉', desc: '看到不存在的人/动物', cases: ['hallucinating', 'anxious_wandering'], imp: 8 },
    { id: 'compulsive_routine', label: '强迫仪式', desc: '流程不能被打乱、必须按顺序', cases: ['obsessive'], imp: 5 },
    { id: 'weeping_spells', label: '持续性哭泣', desc: '无明显诱因频繁哭泣', cases: ['weeping'], imp: 7 },
  ]

  // ── 触发因素定义 ──
  const triggers = [
    { id: 'trigger_rush', label: '催促', desc: '照护者催促时症状加重', cases: ['aggressive', 'aggressive_resistant', 'obsessive'], imp: 7 },
    { id: 'trigger_touch', label: '身体接触', desc: '被触碰时产生抗拒', cases: ['aggressive', 'aggressive_resistant', 'resistant'], imp: 8 },
    { id: 'trigger_stranger', label: '陌生人靠近', desc: '对陌生面孔极度警觉', cases: ['aggressive', 'anxious_dependent', 'regressed'], imp: 6 },
    { id: 'trigger_dusk', label: '黄昏5点后', desc: '日落时分症状最严重', cases: ['aggressive'], imp: 9 },
    { id: 'trigger_door', label: '关门声', desc: '关门触发焦虑或游走', cases: ['anxious_dependent', 'wandering', 'aggressive_resistant'], imp: 5 },
    { id: 'trigger_dark', label: '天黑', desc: '天黑时分离焦虑加重', cases: ['anxious_dependent', 'regressed'], imp: 7 },
    { id: 'trigger_command', label: '被命令', desc: '听到"必须""应该"时反弹', cases: ['resistant', 'aggressive_resistant', 'aggressive'], imp: 8 },
    { id: 'trigger_loneliness', label: '独处', desc: '一个人待着时焦虑/哭泣加重', cases: ['anxious_dependent', 'weeping', 'withdrawn'], imp: 6 },
    { id: 'trigger_loud_noise', label: '高声说话', desc: '大声说话/嘈杂环境触发退缩', cases: ['withdrawn'], imp: 4 },
    { id: 'trigger_rain', label: '下雨天', desc: '下雨天焦虑和游走加重', cases: ['anxious_wandering'], imp: 5 },
    { id: 'trigger_children_cry', label: '听到孩子哭声', desc: '听觉触发幻觉或寻找行为', cases: ['anxious_wandering'], imp: 6 },
  ]

  // ── 干预建议定义 ──
  const interventions = [
    { id: 'int_give_choice', label: '给予选择权', desc: '"先吃药还是先喝水？"让老人觉得自己决定', cases: ['resistant', 'aggressive_resistant', 'aggressive'], imp: 9 },
    { id: 'int_taste_first', label: '照护者先尝一口', desc: '先吃一口饭菜/药证明安全', cases: ['aggressive', 'aggressive_resistant'], imp: 8 },
    { id: 'int_accompany_walk', label: '陪伴散步', desc: '陪老人走一段路再引导回来', cases: ['wandering', 'anxious_wandering'], imp: 8 },
    { id: 'int_avoid_17h', label: '避开黄昏任务', desc: '17点后不安排洗澡、换衣等对抗性任务', cases: ['aggressive'], imp: 7 },
    { id: 'int_sit_silently', label: '安静陪伴', desc: '不说话、不靠近，安静坐在旁边', cases: ['withdrawn', 'weeping'], imp: 6 },
    { id: 'int_hold_hand', label: '握手表安全', desc: '轻轻握着手传递"我在"信号', cases: ['anxious_dependent', 'regressed', 'weeping'], imp: 7 },
    { id: 'int_redirect_activity', label: '转移注意力', desc: '"你看窗外那只鸟！"用外界话题打断', cases: ['aggressive', 'cheerful_chaotic', 'wandering'], imp: 6 },
    { id: 'int_leave_door_open', label: '留门不关', desc: '卧室/浴室门微开减少恐惧', cases: ['anxious_dependent', 'regressed'], imp: 5 },
    { id: 'int_maintain_routine', label: '保持固定流程', desc: '每天同一时间做同一件事，打乱会焦躁', cases: ['obsessive'], imp: 7 },
    { id: 'int_use_child_tone', label: '用孩童语气', desc: '像对小孩说话一样温和引导', cases: ['regressed'], imp: 6 },
    { id: 'int_validate_feeling', label: '先认可再引导', desc: '"我知道你心烦"然后转移话题', cases: ['aggressive', 'weeping', 'anxious_dependent'], imp: 8 },
    { id: 'int_warm_water_feet', label: '睡前温水泡脚', desc: '帮助放松、改善夜游症状', cases: ['wandering', 'anxious_wandering', 'reversed_sleep'], imp: 5 },
  ]

  // ── 构建节点 ──
  for (const s of symptoms) {
    addNode({ id: s.id, type: 'symptom', label: s.label, description: s.desc, caseIds: s.cases, importance: s.imp })
    for (const cid of s.cases) addEdge(cid, s.id, '表现', 3)
  }
  for (const t of triggers) {
    addNode({ id: t.id, type: 'trigger', label: t.label, description: t.desc, caseIds: t.cases, importance: t.imp })
    for (const cid of t.cases) addEdge(cid, t.id, '被触发', 2)
  }
  for (const iv of interventions) {
    addNode({ id: iv.id, type: 'intervention', label: iv.label, description: iv.desc, caseIds: iv.cases, importance: iv.imp })
    for (const cid of iv.cases) addEdge(cid, iv.id, '可行干预', 1)
  }

  return { nodes, edges }
}

// ── 图谱查询 ──

let cachedGraph: KnowledgeGraph | null = null

export function getGraph(): KnowledgeGraph {
  if (!cachedGraph) cachedGraph = buildKnowledgeGraph()
  return cachedGraph
}

export function querySymptomsForCase(caseId: string): GraphNode[] {
  return getGraph().nodes.filter((n) => n.type === 'symptom' && n.caseIds.includes(caseId))
}

export function queryTriggersForCase(caseId: string): GraphNode[] {
  return getGraph().nodes.filter((n) => n.type === 'trigger' && n.caseIds.includes(caseId))
}

export function queryInterventionsForCase(caseId: string): GraphNode[] {
  return getGraph().nodes.filter((n) => n.type === 'intervention' && n.caseIds.includes(caseId))
}

export function queryRelatedNodes(caseId: string): { symptoms: GraphNode[]; triggers: GraphNode[]; interventions: GraphNode[] } {
  return {
    symptoms: querySymptomsForCase(caseId),
    triggers: queryTriggersForCase(caseId),
    interventions: queryInterventionsForCase(caseId),
  }
}
