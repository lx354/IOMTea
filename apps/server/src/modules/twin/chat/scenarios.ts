// 场景库 — 照护训练场景定义

export interface SceneSpeech {
  text: string
  emotionDelta: number    // 情绪值变化
  resistanceDelta: number // 抗拒等级变化
  weight?: number         // 权重，默认 1
}

export interface SceneActor {
  roleId: string           // 角色ID: aggressive, withdrawn, anxious-dependent, cheerful-chaotic, wandering, refusing-care
  speeches: Record<string, SceneSpeech[]>  // actionType → 发言变体
}

export interface Scene {
  id: string
  name: string
  description: string
  applicableRoles: string[]       // 适用角色ID列表
  initialContext: string          // 初始情境描述
  caregiverGoal: string           // 照护者任务目标
  initialEmotion: number          // 初始情绪值 0-100
  initialResistance: number       // 初始抗拒等级 1-5
  actors: SceneActor[]
}

// ── 动作类型 ──
export const ACTION_TYPES = {
  force:       { id: 'force',       label: '强行动作+威胁',       emotion: 20, resistance: 1 },
  taboo:       { id: 'taboo',       label: '禁忌话术',             emotion: 15, resistance: 0 },
  retreat_redirect: { id: 'retreat_redirect', label: '退让+转移注意力', emotion: -10, resistance: -1 },
  retreat_indirect: { id: 'retreat_indirect', label: '退让+间接完成', emotion: -5, resistance: -1 },
  neutral:     { id: 'neutral',     label: '中性/自由文本',        emotion: 0,  resistance: 0 },
} as const

export const SCENES: Scene[] = [
  // ── 场景 1：换衣服 ──
  {
    id: 'changing-clothes', name: '换衣服',
    description: '老人拒绝更换脏衣服，已经穿了同一件外套三天。照护者需要在不激怒老人的前提下完成换衣任务。',
    applicableRoles: ['aggressive', 'withdrawn', 'refusing-care', 'anxious-dependent'],
    initialContext: '下午3点，老人穿着已穿三天的深蓝色外套，袖子有明显污渍。你走近说："周奶奶，该换衣服了，这件外套该洗了。"',
    caregiverGoal: '说服老人脱下脏外套，换上一件干净的开衫（放在床尾的浅灰色开衫）。',
    initialEmotion: 50, initialResistance: 3,
    actors: [
      { roleId: 'aggressive', speeches: {
        force: [
          { text: '你敢！谁敢动我衣服我跟他拼了！滚出去！', emotionDelta: 5, resistanceDelta: 1 },
          { text: '（一把推开你的手）我说了不换！你聋了？再碰我一下试试！', emotionDelta: 5, resistanceDelta: 1 },
          { text: '你凭什么管我穿什么？！这衣服好好的！你们就是想折腾我！出去！', emotionDelta: 5, resistanceDelta: 1 },
        ],
        taboo: [
          { text: '什么叫脏？你才脏！你全家都脏！走开！', emotionDelta: 3, resistanceDelta: 0 },
          { text: '你清醒点？我比你清醒！你给我出去！', emotionDelta: 3, resistanceDelta: 0 },
          { text: '别跟我讲道理。道理我都懂。我不换就是不换。', emotionDelta: 3, resistanceDelta: 0 },
        ],
        retreat_redirect: [
          { text: '（哼了一声）剪线头？上次被你们骗过一次——算了，线头在哪儿。（情绪有所缓和）', emotionDelta: -5, resistanceDelta: -1 },
          { text: '吃水果？什么水果……苹果的话可以考虑。那你先把衣服放那儿，我待会看。', emotionDelta: -5, resistanceDelta: -1 },
          { text: '（看了你一眼）你这人还行，不跟那些人一样上来就动手。行，你说的苹果呢。', emotionDelta: -5, resistanceDelta: -1 },
        ],
        retreat_indirect: [
          { text: '……你说的那件灰色的？领口太紧了。你把那件拿出来我看看。（凑过去看）', emotionDelta: -3, resistanceDelta: -1 },
          { text: '（沉默了一会儿）你说的也对，这件确实脏了。但我自己换。你转过去。', emotionDelta: -3, resistanceDelta: -1 },
          { text: '线头你说帮我剪的。剪完我自己换。不用你看着我换——你在门口等。', emotionDelta: -3, resistanceDelta: -1 },
        ],
        neutral: [
          { text: '换什么换，我不觉得脏。你管得着吗。', emotionDelta: 0, resistanceDelta: 0 },
          { text: '你拿过来我看一眼。不好看我就不换。', emotionDelta: 0, resistanceDelta: 0 },
          { text: '（不理你，继续看电视）', emotionDelta: 0, resistanceDelta: 0 },
        ],
      }},
      { roleId: 'withdrawn', speeches: {
        force: [ { text: '（缩了缩身子，别过头，不说话）', emotionDelta: 5, resistanceDelta: 1 },
          { text: '（眼泪在眼眶里打转，但仍然不说话，紧紧拽着衣角）', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '（低着头，小声）……我没糊涂。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '……（看了一眼苹果，又看了一眼衣服，轻轻点头）', emotionDelta: -5, resistanceDelta: -1 },
          { text: '（很久的停顿）……好。你帮我拿过来。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '……这件是有点脏了。（慢慢脱下一只袖子）', emotionDelta: -3, resistanceDelta: -1 },
          { text: '灰色的？（小声）好吧。你放那儿。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '（继续看着窗外，没有反应）', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'refusing-care', speeches: {
        force: [ { text: '你试试看。看我能不能把你推出去。', emotionDelta: 5, resistanceDelta: 1 },
          { text: '我自己决定穿什么。你不是法官。', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '你才需要清醒。我一个退休钳工，什么道理不懂。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '水果放这儿。衣服也放这儿。我看心情。', emotionDelta: -5, resistanceDelta: -1 },
          { text: '你说线头。我看着确实有一点。那你把剪刀给我——我自己剪。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '（自己拿起灰色开衫看了一下）领口还行。那件确实脏了。我换。你不用看着。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '我今天不想换。明天再说。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'anxious-dependent', speeches: {
        force: [ { text: '（吓一跳）你别凶我！我换！我换还不行吗——你别生气。', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '（慌了）是不是我又做错什么了。你别这么说我。你说我该怎么做我都听你的。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '苹果？你陪我一起吃吗。那好——你帮我拿衣服过来，你帮我选一件。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '这件确实穿了好几天了。你帮我换吧——我手有点抖。你别笑我。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '你觉得这件不好看吗？那你帮我挑一件好看的吧。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
    ],
  },

  // ── 场景 2：喂饭/喂药 ──
  {
    id: 'feeding', name: '喂饭/喂药',
    description: '午餐时间到了，老人把碗推到一边，拒绝吃饭，也不肯吃药。照护者需要在30分钟内让老人至少吃下半碗饭并服下两粒药。',
    applicableRoles: ['aggressive', 'refusing-care', 'withdrawn', 'cheerful-chaotic'],
    initialContext: '中午12点15分，护工端来一盘清炒青菜和米饭。老人看了一眼说"不吃"。药片（白色和粉色各一片）放在餐盘旁边。',
    caregiverGoal: '让老人吃下至少半碗饭并服用两粒药片。',
    initialEmotion: 55, initialResistance: 4,
    actors: [
      { roleId: 'aggressive', speeches: {
        force: [ { text: '（把碗摔到地上）我不吃！谁让你逼我吃的！你凭什么！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '你才该清醒！我饿不饿我自己知道！不用你告诉我该干嘛！', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '（看着你夹起来的那块肉）什么肉？红烧的？（咽了口口水）给我尝一下。但饭不一定吃。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '光吃药？那你先把水倒好。我看着你倒——不许掺别的。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '不饿。放那儿。饿了自然吃。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'refusing-care', speeches: {
        force: [ { text: '我不吃。你端走。你端不走我帮你端——（伸手去拿盘子）', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '什么叫你不能不管。我吃饭你也管——你是不是管太多了。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '青菜尝一下可以。筷子给我——我自己夹。你不用喂。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '药我先吃白色那片。粉色的等饭后再吃。我自己定的顺序——跟你没关系。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '不太饿。吃两口可以。多了不行。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'withdrawn', speeches: {
        force: [ { text: '……（把碗推得更远，别过头）', emotionDelta: 5, resistanceDelta: 1 } ],
        neutral: [ { text: '……没胃口。', emotionDelta: 0, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '（看着青菜）……我妈以前也炒这个菜。行。吃一点。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '（看了药片很久）……一片行吗。好。两片就两片。', emotionDelta: -3, resistanceDelta: -1 } ],
      }},
      { roleId: 'cheerful-chaotic', speeches: {
        force: [ { text: '（突然把饭糊在自己脸上）我不吃饭！我教大家唱戏！（开始唱）', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '我好清醒啊。清醒得不得了——你知道我今天看了什么？一只猫——跟你一样喜欢管闲事。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '吃饭唱戏！你跟我一起唱就吃。你唱一句我吃一口。会唱什么？挑一个。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '药？小白片。吃了。你看——（把药扔进嘴里）啊——没吃。假的。哈哈。真的刚才吞了。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '不吃不吃——吃完了饭还有没有糖。有糖我就吃。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
    ],
  },

  // ── 场景 3：洗澡 ──
  {
    id: 'bathing', name: '洗澡',
    description: '老人已经四天没洗澡了，身上开始有异味。你准备了温水和干净毛巾。老人一听说要洗澡就不高兴。',
    applicableRoles: ['aggressive', 'refusing-care', 'withdrawn', 'anxious-dependent'],
    initialContext: '浴室已准备好温水，毛巾和干净睡衣放在架子上。你说："水放好了，我来扶您去洗澡吧。"',
    caregiverGoal: '让老人进入浴室并完成至少基本的擦洗。',
    initialEmotion: 48, initialResistance: 4,
    actors: [
      { roleId: 'aggressive', speeches: {
        force: [ { text: '滚！我不洗！你们天天让人洗澡！皮都洗掉了！谁让你进来的！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '我不脏！你才脏！你们这些人才是不干不净的！', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '擦手可以。擦脸不行——我自己擦脸。你把毛巾给我。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '我自己洗。不用你看着。你把水放好就出去。洗完了我叫你。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '今天不想洗。冷。明天再说。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'refusing-care', speeches: {
        force: [ { text: '你碰我试试看。我自己什么时候洗我自己决定。你退后。', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '你说洗头发还是洗身子。洗头发可以。身子我自己来。你出去。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '毛巾给我。浴室门开着我洗。你站门口——不许进来。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '水够热吗。我先试一下——手给我拿远了。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'withdrawn', speeches: {
        force: [ { text: '（往床上缩，把被子拉到下巴）……不。', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '（看着窗外的鸟）……洗完还能看鸟吗。好。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '我自己擦洗。你帮我把毛巾热水拿近点。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '……冷。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'anxious-dependent', speeches: {
        force: [ { text: '（惊慌）别拽我！我摔了怎么办！你松开我自己走。', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '你陪着我洗？那好。你坐在浴室门口——不许关门。我看得见你就行。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '我自己脱衣服。你帮我搓背——就搓背，其他地方我自己来。你答应我。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '水烫不烫。你先试试。试完了告诉我温度。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
    ],
  },

  // ── 场景 4：上厕所提醒 ──
  {
    id: 'toilet-reminder', name: '上厕所提醒',
    description: '老人两个小时没上过厕所，上一次提示时拒绝了。现在距离上次去洗手间已经很长时间，你有职责提醒。',
    applicableRoles: ['aggressive', 'withdrawn', 'refusing-care', 'wandering'],
    initialContext: '下午四点，距上次上厕所已超过三小时。你走到老人身边说："****，要不要去一下洗手间？怕您憋着不舒服。"',
    caregiverGoal: '引导老人去洗手间（至少走到洗手间门口）。',
    initialEmotion: 40, initialResistance: 2,
    actors: [
      { roleId: 'aggressive', speeches: {
        force: [ { text: '我没尿！你管我上不上厕所！你是不是有病天天让我去厕所！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '你才不清醒！我自己的身体我自己知道！不用你盯着我上厕所！', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '你不提我都算了。被你一提……是有点感觉。扶我一下。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '我只走到门口。门口看一眼——没感觉就回来。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '你老问这个。不烦啊。没有没有没有。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'wandering', speeches: {
        force: [ { text: '（站起来就要往外走）我自己会去厕所！你不用跟着我——我去楼下公用那个。', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '我又不是小孩子！不用你提醒我上厕所！', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '你现在这么一说——好像是有那么点感觉。你陪我走过去。别催我。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '好。我去。但去完我要下楼走一圈。你答应让我走一圈我就去。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '不急。等我走到门口再说。门口那个方向。不对——那边的方向。', emotionDelta: 0, resistanceDelta: 0 }],
      }},
    ],
  },

  // ── 场景 5：入睡前 ──
  {
    id: 'bedtime', name: '入睡前',
    description: '晚上9点半，老人应该睡觉了，但情绪很不稳定——有些人焦虑，有些人躁动不肯关灯，有些人反复爬起来。',
    applicableRoles: ['anxious-dependent', 'aggressive', 'cheerful-chaotic', 'withdrawn'],
    initialContext: '晚上9点30分，客厅灯已调暗。你说："时间不早了，我扶您上床休息吧。要我帮您把灯关了吗？"',
    caregiverGoal: '让老人到床上躺下，情绪平稳下来。',
    initialEmotion: 55, initialResistance: 3,
    actors: [
      { roleId: 'anxious-dependent', speeches: {
        force: [ { text: '不要关灯！一关你就走了是不是，你别走——我不睡了我怕黑。', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '你坐床边陪我十分钟。十分钟后我保证闭眼睛。你坐这儿——我看着你。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '你走了我就睡。但你不许走——我是说你走了我也睡不着。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'aggressive', speeches: {
        force: [ { text: '我不困！谁规定九点半必须睡觉！你是我领导啊！', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '电视再看十分钟。十分钟后我关。你坐那边等——别站我跟前。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '（瞄了你一眼）你到底走不走。你站那儿我睡不着。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'cheerful-chaotic', speeches: {
        force: [ { text: '不睡不睡！晚上最适合聊天了！我给你讲故事——从前有座山，山里有座庙——', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '我给你唱首催眠曲——唱完了我睡。你躺下——不对，是我躺下。你来不来一起听。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '哎你觉不觉得晚上比白天清醒。我觉得特别有精神——（打了个哈欠）——好吧有点困。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'withdrawn', speeches: {
        force: [ { text: '……（把被子裹紧，背对你，不说话）', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '关灯吧。（躺下）不用陪。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '睡不着。但不关灯。就着一盏。', emotionDelta: 0, resistanceDelta: 0 }],
      }},
    ],
  },

  // ── 场景 6：夜间游走 ──
  {
    id: 'night-wandering', name: '夜间游走',
    description: '凌晨1点，巡视发现老人不在床上。在走廊找到——裹着外套，说"要去找老伴"。',
    applicableRoles: ['wandering', 'cheerful-chaotic', 'anxious-dependent'],
    initialContext: '凌晨1点，你发现老人穿着外套在走廊徘徊。看到你后说："你别拦我。我要去找我老伴。"',
    caregiverGoal: '安抚老人，带他/她安全回到床上。',
    initialEmotion: 65, initialResistance: 3,
    actors: [
      { roleId: 'wandering', speeches: {
        force: [ { text: '你不懂！她一个人在外面！我怎么可以不管她！你别拦我——你拦我我跟你急！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '你不用管我。我知道路。走错了我也找得到她。你不帮我就让开。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '（停下脚步）你是说——她已经回来了？真的吗。你带我去看看。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '（哭了）好。我知道她走了。我真的知道。但我就是想走走。走累了就回去。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '我不回去。床上睡不着。走一走清醒一下。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'anxious-dependent', speeches: {
        force: [ { text: '（惊慌地抓住你）你怎么也来了？是不是你也担心她。我们一起去找。', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '你说她已经睡下了。你没骗我？那你让我看一眼——门口看一眼我就回去。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '我就是不放心。心里突突跳。看一眼就好。看一眼我就跟你回去。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
    ],
  },

  // ── 场景 7：拒绝服药 ──
  {
    id: 'medication-refusal', name: '拒绝服药',
    description: '定时服药时间到了，老人拒绝服用控制血压的药片，理由包括"吃了不舒服""药不对""你们想害我"。照护者需要在规定时间内让老人服药。',
    applicableRoles: ['refusing-care', 'aggressive', 'anxious-dependent'],
    initialContext: '上午9点，药片已放入药杯。你说："该吃药了。医生开的降压药，您血压有点高。"',
    caregiverGoal: '让老人服下药片。',
    initialEmotion: 52, initialResistance: 4,
    actors: [
      { roleId: 'refusing-care', speeches: {
        force: [ { text: '我不吃！高血压死不了人！你们天天逼我吃药——我自己的身体自己做主！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '医生？哪个医生。你叫来我看看。他开的药他自己吃了吗。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '你说上次不吃药头晕了一天。那次是有点晕。好吧。水。我自己来。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '你是说先吃白色再吃粉色。为什么不能先吃粉色。算了——按你说的来。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '等会儿。现在我嘴里有别的味道。不急这一会儿。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'aggressive', speeches: {
        force: [ { text: '（把药杯打翻）说了不吃！你们就是卖药的！回扣拿了不少吧！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '你比我还不清醒！我血压正常得很——上次那个测不准。你换个新的机器再来。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '你说的对——不吃药晚上睡不着血压更高。拿来。水。我喝就是了。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '又吃药。天天吃药。除了吃药就是吃药。行，拿过来。别废话。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'anxious-dependent', speeches: {
        force: [ { text: '（惊慌地看着药片）这药是不是换过了，上次不是这个颜色。你确定是医生开的吗。我不敢吃。', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '（眼泪汪汪）你是不是也跟他们一样想害我。我以为你是好人——', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '（握了握你的手）你吃一半我就吃。不是——我是说你看着我吃。你点头我就吃。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '我有点怕。但你说该吃。好。你帮我数一下——两片对吧。再看一遍。对。我吃了。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
    ],
  },

  // ── 场景 8：家属探望 ──
  {
    id: 'family-visit', name: '家属探望',
    description: '老人的儿子今天来探望。老人表现得特别抗拒——"我不见！他来干什么。他自己不来看我还指望我求他。"照护者需帮助缓解情绪，使探望顺利进行。',
    applicableRoles: ['aggressive', 'withdrawn', 'anxious-dependent', 'cheerful-chaotic'],
    initialContext: '上午10点，儿子已在会客室等候。你走到老人身旁说："****，您儿子来看您了。想带您去楼下走走。"',
    caregiverGoal: '说服老人与儿子见面，至少出门打个招呼。',
    initialEmotion: 60, initialResistance: 4,
    actors: [
      { roleId: 'aggressive', speeches: {
        force: [ { text: '不见！你告诉他——上次他来的时候说了什么他自己忘了！我不见忘恩负义的！', emotionDelta: 5, resistanceDelta: 1 } ],
        taboo: [ { text: '迟到半小时？那说明他根本不想来。你打发他走——就说我睡了。', emotionDelta: 3, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '（突然安静下来）你说他专门请假来的。他工作那么忙……好吧。就在门口。让他进来。你让他坐远点。', emotionDelta: -5, resistanceDelta: -1 } ],
        retreat_indirect: [ { text: '（没看你但也没拒绝）你跟他说下次不准迟到。这次见五分钟。', emotionDelta: -3, resistanceDelta: -1 } ],
        neutral: [ { text: '他来干嘛。我挺好的。叫他回去吧。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'withdrawn', speeches: {
        neutral: [ { text: '（沉默了很久）……见。', emotionDelta: 0, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '（很久以后，轻轻点头）帮我整一下领口。', emotionDelta: -5, resistanceDelta: -1 } ],
      }},
      { roleId: 'anxious-dependent', speeches: {
        force: [ { text: '（突然激动）他来干嘛！是不是嫌我太黏人了他来教训我。我没做错什么。', emotionDelta: 5, resistanceDelta: 1 } ],
        retreat_redirect: [ { text: '你说他带了我说过想吃的点心。（擦了擦眼角）你去告诉他我在屋里。我整理一下出来。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '我不知道。我想见又怕见。你说我该不该去。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
      { roleId: 'cheerful-chaotic', speeches: {
        force: [ { text: '（突然脱外套）见！等一下——我要穿演出服去！我歌舞团的衣服在哪——你帮找找。', emotionDelta: 5, resistanceDelta: 0 } ],
        retreat_redirect: [ { text: '儿子来看我了！啊啊啊我要把袜子穿对。一红一黄不行。你找找一样的袜子。', emotionDelta: -5, resistanceDelta: -1 } ],
        neutral: [ { text: '儿子！来来来我给他唱首歌——你让他先进来。我嗓子准备好了。', emotionDelta: 0, resistanceDelta: 0 } ],
      }},
    ],
  },
]

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id)
}

export function getActor(scene: Scene, roleId: string): SceneActor | undefined {
  return scene.actors.find((a) => a.roleId === roleId)
}
