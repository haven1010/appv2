/**
 * Layer: Mini Program Cloud Database Adapter
 * Responsibility: Provides a single access point for optional CloudBase database usage.
 */
const cloudConfig = require('../config/cloud');

let initialized = false;
let activeEnvId = '';
let lastInitError = null;

function hasCloudApi() {
  return Boolean(
    typeof wx !== 'undefined'
    && wx.cloud
    && typeof wx.cloud.init === 'function'
    && typeof wx.cloud.database === 'function',
  );
}

function normalizeCollectionName(collection) {
  const collections = cloudConfig.collections || {};
  return collections[collection] || collection;
}

function getInitState(overrides = {}) {
  const config = Object.assign({}, cloudConfig.resolveCloudConfig(), overrides);
  if (!config.enabled || !config.envId) {
    return {
      enabled: false,
      initialized: false,
      envId: '',
      reason: 'CloudBase envId is not configured.',
    };
  }

  if (!hasCloudApi()) {
    return {
      enabled: true,
      initialized: false,
      envId: config.envId,
      reason: 'wx.cloud API is not available in the current runtime.',
    };
  }

  return {
    enabled: true,
    initialized,
    envId: config.envId,
    reason: lastInitError ? lastInitError.message : '',
  };
}

function initCloud(overrides = {}) {
  const config = Object.assign({}, cloudConfig.resolveCloudConfig(), overrides);
  if (!config.enabled || !config.envId) {
    return getInitState(config);
  }

  if (!hasCloudApi()) {
    return getInitState(config);
  }

  if (initialized && activeEnvId === config.envId) {
    return getInitState(config);
  }

  try {
    wx.cloud.init({
      env: config.envId,
      traceUser: config.traceUser !== false,
    });
    initialized = true;
    activeEnvId = config.envId;
    lastInitError = null;
  } catch (error) {
    initialized = false;
    activeEnvId = '';
    lastInitError = error;
  }

  return getInitState(config);
}

function getDatabase() {
  const state = initCloud();
  if (!state.initialized) {
    throw new Error(state.reason || 'CloudBase database is not initialized.');
  }
  return wx.cloud.database({
    env: state.envId,
  });
}

function getCollection(collection) {
  const collectionName = normalizeCollectionName(collection);
  if (!collectionName) {
    throw new Error('CloudBase collection name is required.');
  }
  return getDatabase().collection(collectionName);
}

function withTimestamps(data, mode) {
  const db = getDatabase();
  const now = db.serverDate();
  if (mode === 'create') {
    return Object.assign({}, data, {
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    });
  }
  return Object.assign({}, data, {
    updatedAt: data.updatedAt || now,
  });
}

function add(collection, data) {
  return getCollection(collection).add({
    data: withTimestamps(data || {}, 'create'),
  });
}

function get(collection, options = {}) {
  let query = getCollection(collection);
  if (options.where) {
    query = query.where(options.where);
  }
  if (options.orderBy && options.order) {
    query = query.orderBy(options.orderBy, options.order);
  }
  if (typeof options.skip === 'number') {
    query = query.skip(options.skip);
  }
  if (typeof options.limit === 'number') {
    query = query.limit(options.limit);
  }
  return query.get();
}

function getById(collection, id) {
  return getCollection(collection).doc(id).get();
}

function updateById(collection, id, data) {
  return getCollection(collection).doc(id).update({
    data: withTimestamps(data || {}, 'update'),
  });
}

function removeById(collection, id) {
  return getCollection(collection).doc(id).remove();
}

function normalizeError(error) {
  if (!error) return 'Unknown error';
  return error.errMsg || error.message || String(error);
}

function isPermissionError(error) {
  return /(permission|auth|access|denied|not authorized|unauthorized|forbidden)/i.test(normalizeError(error));
}

function dataLength(response) {
  return Array.isArray(response?.data) ? response.data.length : 0;
}

async function runStage2Check(name, task) {
  try {
    const detail = await task();
    return {
      name,
      ok: true,
      detail,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      error: normalizeError(error),
    };
  }
}

async function verifyStage2Setup() {
  const results = [];
  const state = initCloud();
  results.push({
    name: 'cloud_init',
    ok: Boolean(state.initialized),
    detail: state,
  });

  if (!state.initialized) return results;

  results.push(await runStage2Check('app_config_read', async () => {
    const response = await get('appConfig', {
      where: { key: 'cloudbaseSmokeTest' },
      limit: 1,
    });
    const count = dataLength(response);
    if (count < 1) {
      throw new Error('Missing app_config smoke test record.');
    }
    return { count };
  }));

  results.push(await runStage2Check('notices_published_read', async () => {
    const response = await get('notices', {
      where: { status: 'published' },
      orderBy: 'publishAt',
      order: 'desc',
      limit: 5,
    });
    return { count: dataLength(response) };
  }));

  results.push(await runStage2Check('notices_draft_blocked', async () => {
    try {
      const response = await get('notices', {
        where: { status: 'draft' },
        limit: 1,
      });
      const count = dataLength(response);
      if (count > 0) {
        throw new Error(`Draft notices should not be readable; count=${count}.`);
      }
      return { blocked: true, mode: 'empty_result' };
    } catch (error) {
      if (isPermissionError(error)) {
        return { blocked: true, mode: 'permission_denied' };
      }
      throw error;
    }
  }));

  results.push(await runStage2Check('feedbacks_create_read_update', async () => {
    const created = await add('feedbacks', {
      category: 'suggestion',
      content: 'CloudBase stage 2 smoke test',
      status: 'open',
      userRole: 'worker',
      smokeTest: true,
    });
    const id = created._id;
    if (!id) {
      throw new Error('Feedback smoke test did not return an _id.');
    }

    let readResult;
    try {
      readResult = await getById('feedbacks', id);
    } catch (error) {
      throw new Error(`feedback read failed after create: ${normalizeError(error)}`);
    }

    try {
      await updateById('feedbacks', id, {
        status: 'processing',
        smokeChecked: true,
      });
    } catch (error) {
      throw new Error(`feedback update failed after create: ${normalizeError(error)}`);
    }

    return {
      id,
      readable: Boolean(readResult?.data),
      updated: true,
    };
  }));

  results.push(await runStage2Check('client_logs_create_only', async () => {
    const created = await add('clientLogs', {
      level: 'info',
      event: 'cloudbase_stage_2_smoke_test',
      message: 'client log write test',
      page: 'manual-console',
      smokeTest: true,
    });
    if (!created._id) {
      throw new Error('Client log smoke test did not return an _id.');
    }

    try {
      const readResult = await getById('clientLogs', created._id);
      if (readResult?.data) {
        throw new Error('Client logs should not be readable from the mini program.');
      }
    } catch (error) {
      if (!isPermissionError(error)) {
        throw error;
      }
    }

    return {
      id: created._id,
      readBlocked: true,
    };
  }));

  results.push(await runStage2Check('file_assets_create_read_delete', async () => {
    const created = await add('fileAssets', {
      fileId: `cloud://${state.envId}/stage2-smoke-test.txt`,
      ownerUserId: null,
      businessType: 'feedback',
      businessId: 'stage2-smoke-test',
      fileName: 'stage2-smoke-test.txt',
      mimeType: 'text/plain',
      size: 0,
      smokeTest: true,
    });
    const id = created._id;
    if (!id) {
      throw new Error('File asset smoke test did not return an _id.');
    }

    let readResult;
    try {
      readResult = await getById('fileAssets', id);
    } catch (error) {
      throw new Error(`file asset read failed after create: ${normalizeError(error)}`);
    }

    try {
      await removeById('fileAssets', id);
    } catch (error) {
      throw new Error(`file asset delete failed after create: ${normalizeError(error)}`);
    }

    return {
      id,
      readable: Boolean(readResult?.data),
      deleted: true,
    };
  }));

  return results;
}

module.exports = {
  add,
  get,
  getById,
  getCollection,
  getDatabase,
  getInitState,
  initCloud,
  removeById,
  setCloudEnvId: cloudConfig.setCloudEnvId,
  updateById,
  verifyStage2Setup,
};
