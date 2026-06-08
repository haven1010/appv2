const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MAX_LIMIT = 100;

async function getAllDocuments(collectionName) {
  let all = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await db.collection(collectionName).skip(offset).limit(MAX_LIMIT).get();
    const batch = Array.isArray(res.data) ? res.data : [];
    all = all.concat(batch);
    offset += batch.length;
    hasMore = batch.length >= MAX_LIMIT;
  }
  return all;
}

async function getNextNumericId(collectionName, field = 'id') {
  const counterKey = `${collectionName}:${field}`;
  try {
    await db.collection('counters').doc(counterKey).update({ data: { seq: _.inc(1) } });
    const doc = await db.collection('counters').doc(counterKey).get();
    return (doc.data && doc.data.seq) || 1;
  } catch (_) {
    const records = await getAllDocuments(collectionName);
    const maxId = records.reduce((currentMax, item) => {
      const nextValue = Number(item && item[field]);
      return Number.isFinite(nextValue) && nextValue > currentMax ? nextValue : currentMax;
    }, 0);
    return maxId + 1;
  }
}

async function findOne(collectionName, field, value) {
  const res = await db.collection(collectionName).where({ [field]: value, isDeleted: _.neq(true) }).limit(1).get();
  return (Array.isArray(res.data) && res.data.length) ? res.data[0] : null;
}

function parseDurationFromWorkHours(workHours) {
  const text = String(workHours || '').trim();
  if (!text) return 8;
  const match = text.match(/(\d{1,2}):(\d{1,2})\s*[-~]\s*(\d{1,2}):(\d{1,2})/);
  if (!match) return 8;
  const start = (Number(match[1]) || 0) * 60 + (Number(match[2]) || 0);
  let end = (Number(match[3]) || 0) * 60 + (Number(match[4]) || 0);
  if (end < start) end += 1440;
  const duration = (end - start) / 60;
  if (!Number.isFinite(duration) || duration <= 0) return 8;
  return Math.max(0.5, Math.round(duration * 10) / 10);
}

exports.main = async (event, context) => {
  console.log('[autoSettle] started');

  const today = new Date().toISOString().slice(0, 10);

  // 1. get all checked-in signups
  const allSignups = await getAllDocuments('signups');
  const candidates = allSignups.filter(s =>
    !s.isDeleted
    && Number(s.status) === 1
    && s.workDate
  );

  if (!candidates.length) {
    return { settled: 0, skipped: 0, failed: 0, total: 0, message: '没有待结算的签到记录' };
  }

  let settled = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const signup of candidates) {
    try {
      // 2. find the job
      const job = await findOne('jobs', 'id', Number(signup.jobId));
      if (!job) { skipped++; continue; }

      // 3. only process jobs with an ended workEndDate
      if (!job.workEndDate) { skipped++; continue; }
      if (job.workEndDate >= today) { skipped++; continue; }
      if (signup.workDate > job.workEndDate) { skipped++; continue; }

      // 4. check if salary already exists (dedup)
      const existed = await db.collection('workerSalaries').where({
        userId: Number(signup.userId),
        baseId: Number(signup.baseId),
        jobId: Number(signup.jobId),
        workDate: signup.workDate,
      }).limit(1).get();

      if (Array.isArray(existed.data) && existed.data.length) {
        skipped++;
        continue;
      }

      // 5. look up user and base
      const user = await findOne('users', 'id', Number(signup.userId));
      const base = await findOne('bases', 'id', Number(signup.baseId));

      // 6. calculate salary based on pay type
      const payType = Number(job.payType || 1);
      let unitPriceSnapshot = 0;
      let totalAmount = 0;
      let workDuration = 0;
      let pieceCount = 0;

      if (payType === 2) {
        // hourly
        unitPriceSnapshot = Number(job.hourlyRate || job.salaryAmount || 0);
        workDuration = parseDurationFromWorkHours(job.workHours);
        totalAmount = unitPriceSnapshot * workDuration;
      } else if (payType === 3) {
        // piecework
        unitPriceSnapshot = Number(job.unitPrice || job.salaryAmount || 0);
        pieceCount = Math.max(1, Number(job.targetCount || 1));
        totalAmount = unitPriceSnapshot * pieceCount;
      } else {
        // fixed daily
        unitPriceSnapshot = Number(job.salaryAmount || 0);
        totalAmount = unitPriceSnapshot;
      }

      // 7. create salary draft
      const id = await getNextNumericId('workerSalaries');
      const now = new Date().toISOString();
      await db.collection('workerSalaries').add({ data: {
        id,
        userId: Number(signup.userId),
        workerUid: user?.uid || '',
        workerName: user?.name || '',
        baseId: Number(signup.baseId),
        baseName: base?.baseName || '',
        jobId: Number(signup.jobId),
        jobTitle: job?.jobTitle || '',
        workDate: signup.workDate || '',
        payType,
        workDuration,
        pieceCount,
        unitPriceSnapshot,
        totalAmount: Number(totalAmount.toFixed(2)),
        bankCard: user?.bankCardNo || '',
        status: 0,
        payoutType: 0,
        paidTime: '',
        workerAppealStatus: 0,
        workerAppealReason: '',
        workerExpectedAmount: null,
        workerAppealedAt: '',
        appealReply: '',
        appealHandledAt: '',
        createdAt: now,
        updatedAt: now,
      }});

      settled++;
    } catch (e) {
      console.error('[autoSettle] error for signup:', signup?.id, e);
      failed++;
      errors.push({ signupId: signup?.id, error: e.message });
    }
  }

  console.log(`[autoSettle] done: settled=${settled}, skipped=${skipped}, failed=${failed}`);

  return {
    settled,
    skipped,
    failed,
    total: candidates.length,
    errors: errors.length ? errors : undefined,
  };
};
