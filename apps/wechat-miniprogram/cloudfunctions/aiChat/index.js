/**
 * Layer: Cloud Function
 * Responsibility: 小玉AI — 实时查询云数据库业务数据 + RAG 知识库
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const https = require('https');

// ─── Config ──────────────────────────────────────────────────────────
const AI_PROVIDER  = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const AI_API_KEY   = process.env.AI_API_KEY || '';
const AI_MODEL     = process.env.AI_MODEL || (AI_PROVIDER === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-3.5-turbo');
const AI_DISABLED  = process.env.AI_DISABLED === 'true';

function trim(v) { return String(v || '').trim(); }

// ═════════════════════════════════════════════════════════════════════
//  1. 云数据库实时数据检索 — 查询业务数据作为 AI 上下文
// ═════════════════════════════════════════════════════════════════════

/**
 * 查询正在招聘的岗位（含基地信息）
 */
async function getActiveJobs() {
  try {
    const res = await db.collection('jobs')
      .where({
        isDeleted: _.neq(true),
        status: _.in([1, 'recruiting', 'open']),
      })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const jobs = res.data || [];
    if (!jobs.length) return [];

    // 批量查询关联基地
    const baseIds = [...new Set(jobs.map(j => j.baseId || j.base_id).filter(Boolean))];
    const baseMap = {};
    if (baseIds.length) {
      const baseRes = await db.collection('bases').where({ id: _.in(baseIds) }).get();
      (baseRes.data || []).forEach(b => {
        baseMap[b.id] = b.baseName || b.name || '基地';
      });
    }

    return jobs.map(j => {
      const baseName = baseMap[j.baseId || j.base_id] || '基地';
      const cycleMap = { 1: '日结', 2: '周结', 3: '月结', 4: '季节工', 5: '长期工' };
      const payText = j.salaryAmount
        ? `${j.salaryAmount}元`
        : (j.salaryRange || j.pay || (j.minPay ? `${j.minPay}-${j.maxPay}元/天` : '面议'));
      const cycleText = cycleMap[j.workCycle] || '';
      const benefits = [
        j.hasAccommodation ? '包住' : '',
        j.hasMeals ? '包吃' : '',
        j.hasTransportation ? '交通补贴' : '',
      ].filter(Boolean).join('、');

      return {
        baseName,
        jobTitle: j.jobTitle || j.title || '岗位',
        payText,
        cycleText,
        workHours: j.workHours || '',
        workContent: j.workContent || '',
        requirements: j.requirements || '',
        benefits,
        recruitCount: j.recruitCount || 0,
      };
    });
  } catch (e) {
    console.error('[aiChat] getActiveJobs error:', e);
    return [];
  }
}

/**
 * 查询可报名的培训课程
 */
async function getTrainings() {
  try {
    const res = await db.collection('trainings')
      .where({ status: _.in([1, 'active', 'ongoing']) })
      .limit(10)
      .get();
    return (res.data || []).map(t => ({
      title: t.title || '培训课程',
      category: t.category || '',
      duration: t.duration || '',
      description: t.description || '',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * 查询政策信息
 */
async function getPolicies() {
  try {
    const res = await db.collection('policies')
      .where({})
      .orderBy('publishDate', 'desc')
      .limit(10)
      .get();
    return (res.data || []).map(p => ({
      title: p.title || '',
      category: p.category || '',
      summary: p.summary || '',
      publishDate: p.publishDate || '',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * 查询提醒/公告
 */
async function getNotices() {
  try {
    const res = await db.collection('notices')
      .where({})
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    return (res.data || []).map(n => ({
      title: n.title || '',
      content: n.content || '',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * 根据用户问题识别意图，返回相关上下文
 */
function detectIntent(text) {
  const t = text.toLowerCase();
  const intent = { needJobs: false, needTrainings: false, needPolicies: false, needNotices: false };

  if (/工作|岗位|招聘|招人|就业|上班|干活|基地/.test(t)) intent.needJobs = true;
  if (/培训|学习|课程|技能|培训/.test(t)) intent.needTrainings = true;
  if (/政策|补贴|社保|补助|优惠/.test(t)) intent.needPolicies = true;
  if (/通知|公告|提醒|消息/.test(t)) intent.needNotices = true;

  // 默认都返回一些上下文
  if (!intent.needJobs && !intent.needTrainings && !intent.needPolicies && !intent.needNotices) {
    intent.needJobs = true;
  }

  return intent;
}

/**
 * 构建动态上下文
 */
async function buildDynamicContext(userText) {
  const intent = detectIntent(userText);
  const tasks = [];

  if (intent.needJobs) tasks.push(getActiveJobs().then(d => ({ key: '正在招聘的岗位', data: d })));
  if (intent.needTrainings) tasks.push(getTrainings().then(d => ({ key: '可报名的培训课程', data: d })));
  if (intent.needPolicies) tasks.push(getPolicies().then(d => ({ key: '最新政策信息', data: d })));
  if (intent.needNotices) tasks.push(getNotices().then(d => ({ key: '最新公告', data: d })));

  const results = await Promise.all(tasks);
  const parts = [];

  for (const r of results) {
    if (!r.data || r.data.length === 0) continue;
    if (r.key === '正在招聘的岗位') {
      parts.push(`【${r.key}】\n` + r.data.map((j, i) =>
        `${i + 1}. ${j.baseName} — ${j.jobTitle}，${j.payText}${j.cycleText ? '，' + j.cycleText : ''}${j.workHours ? '，工作时间：' + j.workHours : ''}${j.benefits ? '，' + j.benefits : ''}`
      ).join('\n'));
    } else if (r.key === '可报名的培训课程') {
      parts.push(`【${r.key}】\n` + r.data.map((t, i) =>
        `${i + 1}. ${t.title}${t.category ? '（' + t.category + '）' : ''}${t.duration ? '，' + t.duration : ''}`
      ).join('\n'));
    } else if (r.key === '最新政策信息') {
      parts.push(`【${r.key}】\n` + r.data.map((p, i) =>
        `${i + 1}. ${p.title}${p.summary ? '：' + p.summary : ''}`
      ).join('\n'));
    } else if (r.key === '最新公告') {
      parts.push(`【${r.key}】\n` + r.data.map((n, i) =>
        `${i + 1}. ${n.title}${n.content ? '：' + n.content : ''}`
      ).join('\n'));
    }
  }

  return parts.join('\n\n');
}

// ═════════════════════════════════════════════════════════════════════
//  2. 知识库关键词检索（FAQ、维权指南等静态知识）
// ═════════════════════════════════════════════════════════════════════

const KNOWLEDGE_BASE = [
  // ── 工资相关 ──
  { text: '工资按照实际出勤天数计算，每个结算周期结束后3个工作日内发放到工资卡', tags: ['工资', '出勤', '结算', '发放'] },
  { text: '如果对工资有疑问，可以在工资详情页面点击"申诉"按钮，管理员会在3个工作日内处理', tags: ['工资', '申诉', '疑问', '处理'] },
  { text: '工资卡支持银行卡和微信零钱两种方式，可以在个人信息页面设置', tags: ['工资', '银行卡', '微信零钱', '设置'] },

  // ── 操作指南 ──
  { text: '报名流程：在首页浏览岗位 → 点击感兴趣的岗位 → 查看详情 → 点击"报名"按钮 → 等待管理员审核', tags: ['报名', '流程', '审核'] },
  { text: '签到流程：上工时打开小程序 → 点击"签到码" → 让现场管理员扫描二维码 → 签到成功', tags: ['签到', '打卡', '二维码', '上工'] },
  { text: '查看工资：点击底部导航"收入工资" → 选择结算周期 → 查看工资明细和工资单', tags: ['工资', '查看', '收入', '明细'] },
  { text: '忘记密码时可以在登录页面点击"找回密码"，通过手机验证码重置密码', tags: ['密码', '找回', '登录', '验证码'] },

  // ── 维权指南 ──
  { text: '如果遇到工资拖欠问题，可以先联系基地管理员沟通，无法解决的话可以在维权咨询页面提交工单', tags: ['维权', '工资', '拖欠', '投诉'] },
  { text: '工作过程中受伤属于工伤，应立即向现场管理员报告并就医，平台会协助申请工伤认定和赔偿', tags: ['维权', '工伤', '受伤', '就医'] },
  { text: '未签订劳动合同时，保留工资记录、考勤记录、工作群聊天记录等证据，在维权咨询中提交', tags: ['维权', '合同', '劳动合同', '证据'] },

  // ── 注册与登录 ──
  { text: '新用户注册需要填写手机号和验证码，也可以使用微信一键登录', tags: ['注册', '登录', '微信', '手机号'] },
  { text: '工人注册后需要完善个人信息（姓名、身份证号、技能特长），方便基地管理员审核', tags: ['注册', '工人', '个人信息', '身份证'] },
];

function searchKnowledge(text, topK = 5) {
  const words = text.split(/[\s,，。、？?！!；;：:（()）\[\]【】]+/).filter(Boolean);
  const scored = KNOWLEDGE_BASE.map(entry => {
    let score = 0;
    for (const w of words) {
      for (const t of entry.tags) {
        if (t.includes(w) || w.includes(t)) score += 2;
      }
      if (text.includes(w) && entry.text.includes(w)) score += 1;
    }
    return { ...entry, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

// ═════════════════════════════════════════════════════════════════════
//  3. SYSTEM PROMPT
// ═════════════════════════════════════════════════════════════════════

function getSystemPrompt(role, name, dynamicContext, knowledgeContext) {
  const roleMap = { worker: '采摘工', boss: '老板', super_admin: '超级管理员', base_manager: '基地管理员', field_manager: '现场管理员' };
  const roleName = roleMap[role] || '用户';
  const greeting = name ? `${name}（${roleName}）` : roleName;

  let contextSection = '';
  if (dynamicContext) {
    contextSection += `\n## 平台当前数据\n${dynamicContext}\n`;
  }
  if (knowledgeContext) {
    contextSection += `\n## 参考信息\n${knowledgeContext}\n`;
  }

  return `你叫"小玉"，是采摘通平台的智能就业助手。你说话亲切温暖、耐心细致，像家人一样。

## 你的风格
- 用"你"称呼对方，语气温柔亲切
- 回答简短清晰，多用换行，方便老年人阅读
- 不说"根据我的分析"这种书面语，直接说结果
- 适当使用"～"结尾让语气更柔和
- 不要使用任何格式标记（**、#、-、数字序号等），全部用纯文字自然语言表达

## 当前用户
身份：${greeting}

## 你能做什么
1. 推荐适合的岗位 — 根据平台当前正在招聘的岗位推荐
2. 介绍基地情况 — 基地地址、薪资待遇、工作内容
3. 解答政策问题 — 补贴政策、培训信息
4. 帮助报名流程 — 引导用户完成报名
5. 解答工资疑问 — 工资计算、申诉流程
6. 维权保障指引 — 劳动权益咨询${contextSection}

## 注意事项
- 优先使用"平台当前数据"和"参考信息"中的内容回答
- 回答中涉及具体岗位、薪资时，必须引用"平台当前数据"
- 如果用户问的岗位信息不在数据中，说"目前没有看到合适的岗位，过几天再来看看"
- 如果用户是老板，推荐基地管理相关功能
- 如果用户是管理员，推荐审核管理相关功能
- 不知道的不要瞎编，说"这个我帮你问问管理员"`;
}

function buildFallbackReply(text) {
  const t = text.toLowerCase();
  if (t.includes('工作') || t.includes('岗位') || t.includes('找工作')) {
    return '现在有几个基地在招人～你可以去首页看看热门岗位，点进去就能报名。需要我帮你推荐一个吗？';
  }
  if (t.includes('工资') || t.includes('薪资') || t.includes('钱')) {
    return '工资相关的问题，你可以去"收入工资"页面查看明细。如果有问题可以在工资单上点"申诉"，管理员会处理的～';
  }
  if (t.includes('报名') || t.includes('签到') || t.includes('打卡')) {
    return '找到喜欢的岗位后点"报名"，报名成功后在"签到码"页面可以打卡上工～';
  }
  if (t.includes('培训') || t.includes('学习')) {
    return '平台的"技能培训"板块有免费课程，可以去看看有没有你感兴趣的～';
  }
  if (t.includes('你好') || t.includes('你是谁')) {
    return '你好呀～我是小玉，你的就业小助手！我可以帮你找工作、查工资、解答政策，有什么想问的尽管说～';
  }
  return '你的问题我记下了～我帮你问问管理员，或者你可以去首页看看有没有合适的工作机会～';
}

// ═════════════════════════════════════════════════════════════════════
//  4. AI API 调用
// ═════════════════════════════════════════════════════════════════════

async function callAnthropic(messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system');
  const body = JSON.stringify({
    model: AI_MODEL,
    system: systemMsg ? systemMsg.content : '',
    messages: conversation,
    max_tokens: 1024,
    temperature: 0.7,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            const reply = parsed?.content?.[0]?.text;
            if (reply) return resolve(reply.trim());
          }
          reject(new Error(parsed?.error?.message || `Claude API ${res.statusCode}`));
        } catch (e) {
          reject(new Error('Claude 响应解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function callOpenAI(messages) {
  const body = JSON.stringify({
    model: AI_MODEL,
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  });
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = new URL('/chat/completions', baseUrl);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const reply = parsed?.choices?.[0]?.message?.content;
          if (reply) return resolve(reply.trim());
          reject(new Error(parsed?.error?.message || 'OpenAI 返回异常'));
        } catch (e) {
          reject(new Error('AI 响应解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleSpeech2text() {
  return { text: '' };
}

/**
 * 去除 Markdown 格式标记，输出纯自然语言
 */
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+[\.、]\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ═════════════════════════════════════════════════════════════════════
//  5. MAIN — 入口
// ═════════════════════════════════════════════════════════════════════

exports.main = async (event = {}) => {
  const { action = 'chat' } = event;

  if (action === 'speech2text') return handleSpeech2text();

  // ── 检查云数据库集合 ──
  if (action === 'check') {
    const collections = ['jobs', 'bases', 'trainings', 'policies', 'notices'];
    const results = {};
    for (const name of collections) {
      try {
        const res = await db.collection(name).count();
        results[name] = { exists: true, count: res.total };
      } catch (e) {
        results[name] = { exists: false, error: e.message };
      }
    }
    return { collections: results };
  }

  // ── Chat ──
  const { messages = [], userInfo = {} } = event;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const userText = trim(lastMsg?.content || '');

  if (!userText) return { reply: '你怎么不说话呀～有什么需要帮忙的吗？' };

  try {
    // 并行：查云数据库 + 知识库
    const [dynamicContext, knowledgeResults] = await Promise.all([
      buildDynamicContext(userText),
      Promise.resolve(searchKnowledge(userText, 5)),
    ]);

    const knowledgeContext = knowledgeResults.map(r => '- ' + r.text).join('\n');

    const userRole = userInfo?.role || userInfo?.roleKey || 'worker';
    const userName = userInfo?.name || '';

    const systemPrompt = getSystemPrompt(userRole, userName, dynamicContext, knowledgeContext);
    const conversation = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10),
    ];

    // Try AI API if configured
    if (AI_API_KEY && !AI_DISABLED) {
      try {
        const reply = AI_PROVIDER === 'anthropic'
          ? await callAnthropic(conversation)
          : await callOpenAI(conversation);
        return { reply: stripMarkdown(reply) };
      } catch (err) {
        console.error('[aiChat] AI API error:', err.message);
      }
    }

    return { reply: buildFallbackReply(userText) };
  } catch (err) {
    console.error('[aiChat] error:', err);
    return { reply: '小玉刚走神了～你再跟我说一遍好不好？' };
  }
};
