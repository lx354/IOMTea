// 指标中英文映射
const MAP: Record<string, string> = {
  heart_rate: '心率', spo2: '血氧', systolic_bp: '收缩压', diastolic_bp: '舒张压',
  temperature: '体温', resp_rate: '呼吸频率', glucose: '血糖',
  posture: '姿态', motion_index: '活动指数', bed_status: '离床状态',
  behavior: '行为', chat_assessment: '对话评估', fusion_score: '融合评分',
  alert: '告警', state_transition: '状态变更', observation: '检测',
  standing: '站立', sitting: '坐', lying: '躺', walking: '行走',
  falling: '跌倒', sitting_up: '起身', wandering: '徘徊',
  bed_exit: '离床', night_wandering: '夜间漫游', repetitive_behavior: '重复行为',
  emergency: '紧急', critical: '危急', warning: '警告', info: '提示',
  simulator: '模拟器', iot: '设备', manual: '手动', behavior_model: '行为模型',
  yolo_pose: '姿态检测', mirror_engine: '镜像引擎', chat_twin: '对话孪生',
  calm: '平静', anxious: '焦虑', depressed: '抑郁', confused: '困惑', agitated: '激越',
  stable: '稳定', watch: '注意', alert: '警告',
}

export function tr(metric: string): string {
  return MAP[metric] || metric
}
