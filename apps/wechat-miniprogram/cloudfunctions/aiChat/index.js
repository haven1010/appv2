/**
 * Layer: Cloud Function
 * Responsibility: AI chat assistant — queries cloud DB for job context and calls AI API.
 *
 * Environment variables:
 *   AI_PROVIDER    - 'anthropic' (Claude) or 'openai' (default)
 *   AI_API_KEY     - Your API key (Claude or OpenAI)
 *   AI_MODEL       - Model name (default: claude-sonnet-4-20250514 for Anthropic, gpt-3.5-turbo for OpenAI)
 *   AI_DISABLED    - Set 'true' to use template-only mode (no API needed)
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

// ─── Helpers ─────────────────────────────────────────────────────────
function trim(v) { return String(v || '').trim(); }

function getSystemPrompt(role, name, jobContext) {
  const roleMap = { worker: '采摘工', boss: '老板', super_admin: '超级管理员', base_manager: '基地管理员', field_manager: '现场管理员' };
  const roleName = roleMap[role] || '用户';
  const greeting = name ? `${name}（${roleName}）` : roleName;

  return `你叫"小玉"，是采摘通平台的智能就业助手。你说话亲切温暖、耐心细致，像家人一样。

## 你的风格
- 用"你"称呼对方，语气温柔亲切
- 回答简短清晰，多用换行，方便老年人阅读
- 不说"根据我的分析"这种书面语，直接说结果
- 适当使用"～"结尾让语气更柔和

## 当前用户
身份：${greeting}

## 当前可报名的岗位
${jobContext || '暂无岗位信息'}

## 你能做什么
1. 推荐适合的岗位 — 根据用户的身份推荐工作
2. 介绍基地情况 — 基地地址、薪资待遇、工作内容
3. 解答政策问题 — 补贴政策、培训信息
4. 帮助报名流程 — 引导用户完成报名
5. 解答工资疑问 — 工资计算、申诉流程
6. 维权保障指引 — 劳动权益咨询

## 注意事项
- 不知道的不要瞎编，说"这个我帮你问问管理员"
- 如果用户是老板，推荐基地管理相关功能
- 如果用户是管理员，推荐审核管理相关功能
- 回答要简洁，不要一次性说太多，根据用户问题逐步引导`;
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

async function queryJobs() {
  try {
    const res = await db.collection('jobs').where({ isDeleted: _.neq(true) }).limit(5).get();
    const jobs = (res.data || []).filter(j => Number(j.status) === 1 || j.status === 'recruiting' || j.status === 'open');
    if (!jobs.length) return '暂无可报名岗位';

    const baseIds = [...new Set(jobs.map(j => j.baseId || j.base_id).filter(Boolean))];
    const basesRes = baseIds.length ? await db.collection('bases').where({ id: _.in(baseIds) }).get() : { data: [] };
    const baseMap = {};
    (basesRes.data || []).forEach(b => { baseMap[b.id] = b.baseName || b.name || '基地'; });

    return jobs.map((j, i) => {
      const baseName = baseMap[j.baseId || j.base_id] || '基地';
      const pay = j.salaryRange || j.pay || (j.minPay ? `${j.minPay}-${j.maxPay}元/天` : '面议');
      return `${i + 1}. ${baseName} — ${j.jobTitle || j.title || '岗位'} ${pay}`;
    }).join('\n');
  } catch (e) {
    console.error('[aiChat] queryJobs error:', e);
    return '暂无岗位信息';
  }
}

// ─── Call Anthropic (Claude) API ────────────────────────────────────
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
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

// ─── Call OpenAI-compatible API ─────────────────────────────────────
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
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

// ─── Speech to Text (placeholder) ───────────────────────────────────
async function handleSpeech2text() {
  return { text: '' };
}

// ─── Main ────────────────────────────────────────────────────────────
exports.main = async (event = {}) => {
  const { action = 'chat' } = event;

  if (action === 'speech2text') return handleSpeech2text();

  // ── Chat ──
  const { messages = [], userInfo = {} } = event;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const userText = trim(lastMsg?.content || '');

  if (!userText) return { reply: '你怎么不说话呀～有什么需要帮忙的吗？' };

  try {
    const [jobContext] = await Promise.all([queryJobs()]);
    const userRole = userInfo?.role || userInfo?.roleKey || 'worker';
    const userName = userInfo?.name || '';

    const systemPrompt = getSystemPrompt(userRole, userName, jobContext);
    const conversation = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10),
    ];

    // Try real AI if API key is configured
    if (AI_API_KEY && !AI_DISABLED) {
      try {
        const reply = AI_PROVIDER === 'anthropic'
          ? await callAnthropic(conversation)
          : await callOpenAI(conversation);
        return { reply };
      } catch (err) {
        console.error('[aiChat] AI API error:', err.message);
      }
    }

    // Template fallback
    return { reply: buildFallbackReply(userText) };
  } catch (err) {
    console.error('[aiChat] error:', err);
    return { reply: '小玉刚走神了～你再跟我说一遍好不好？' };
  }
};
