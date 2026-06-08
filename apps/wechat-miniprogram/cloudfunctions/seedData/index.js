/**
 * Layer: Cloud Function
 * Responsibility: 初始化云数据库业务数据（培训、政策等）
 * 使用方式：部署后调用一次即可
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const results = {};

  // ─── 培训课程 ─────────────────────────────────────────────
  const trainings = [
    { title: '采摘技能培训', category: '采摘技能', duration: '2小时', description: '学习正确的采摘手法、如何判断果实成熟度、采摘后的保鲜方法', status: 1 },
    { title: '安全生产培训', category: '安全培训', duration: '3小时', description: '农药安全使用、机械操作规程、防暑降温知识', status: 1 },
    { title: '职业素养提升', category: '职业素养', duration: '1.5小时', description: '劳动法规、工人权益、职业道德等内容', status: 0 },
  ];

  try {
    const tRes = await db.collection('trainings').count();
    if (tRes.total === 0) {
      for (const t of trainings) {
        await db.collection('trainings').add({ data: t });
      }
      results.trainings = `已插入 ${trainings.length} 条培训数据`;
    } else {
      results.trainings = `已有 ${tRes.total} 条数据，跳过`;
    }
  } catch (e) {
    results.trainings = `失败：${e.message}`;
  }

  // ─── 政策信息 ─────────────────────────────────────────────
  const policies = [
    { title: '就业困难人员社保补贴政策', category: '就业补贴', summary: '对符合条件的就业困难人员给予社会保险补贴，补贴标准为实际缴纳社会保险费的60%', publishDate: '2026-04-01' },
    { title: '职业技能培训补贴实施办法', category: '培训补贴', summary: '参加职业技能培训并取得证书的劳动者，可申请培训补贴，最高可达2000元', publishDate: '2026-03-15' },
    { title: '创业担保贷款及贴息政策', category: '创业扶持', summary: '符合条件的创业人员可申请最高20万元的创业担保贷款，并享受贴息支持', publishDate: '2026-02-20' },
    { title: '农村合作社就业补贴', category: '就业补贴', summary: '在合作社稳定工作满3个月的工人可申请一次性补贴500元', publishDate: '2026-05-01' },
    { title: '高温天气作业补贴', category: '就业补贴', summary: '气温超过35℃时，户外作业工人每天额外补贴30元', publishDate: '2026-05-15' },
  ];

  try {
    const pRes = await db.collection('policies').count();
    if (pRes.total === 0) {
      for (const p of policies) {
        await db.collection('policies').add({ data: p });
      }
      results.policies = `已插入 ${policies.length} 条政策数据`;
    } else {
      results.policies = `已有 ${pRes.total} 条数据，跳过`;
    }
  } catch (e) {
    results.policies = `失败：${e.message}`;
  }

  return { success: true, results };
};
