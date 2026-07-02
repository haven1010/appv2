const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { ensureRealNameReady } = require('../../../utils/realname');

function isDuplicateApplyError(error) {
  if (!error) return false;
  const message = String(error?.message || '');
  return (
    error.statusCode === 400 || error.statusCode === 409
  ) && /已申请|重复|请勿重复|already|duplicate/i.test(message);
}

function getConflictMessage(error) {
  if (!error || Number(error.statusCode) !== 409) return '';
  const message = String(error?.message || '').trim();
  if (message) return message;

  const detail = error.data || error.response?.data || {};
  const baseName = detail.conflictBaseName || '未知基地';
  const jobTitle = detail.conflictJobTitle || '未知岗位';
  return `您已报名【${baseName} / ${jobTitle}】，时间冲突。如需报名此工作，请先取消原报名。`;
}

function encodeText(value) {
  return encodeURIComponent(String(value || ''));
}

function isOpenStatus(status) {
  return status === 1 || status === '1' || status === 'recruiting' || status === 'open';
}

function formatPayType(payType, salaryText = '') {
  if (payType === 1 || payType === '1' || payType === 'fixed') return '固定工资';
  if (payType === 2 || payType === '2' || payType === 'hourly') return '时薪';
  if (payType === 3 || payType === '3' || payType === 'piece') return '计件';

  if (salaryText.includes('/小时')) return '时薪';
  if (salaryText.includes('/件')) return '计件';
  if (salaryText.includes('/天')) return '固定工资';
  return '计件';
}

function formatWorkCycle(workCycle) {
  if (workCycle === 'daily' || workCycle === 1 || workCycle === '1') return '日结';
  if (workCycle === 'weekly' || workCycle === 2 || workCycle === '2') return '周结';
  if (workCycle === 'monthly' || workCycle === 3 || workCycle === '3') return '月结';
  if (workCycle === 4 || workCycle === '4') return '季节工';
  if (workCycle === 5 || workCycle === '5') return '长期工';
  return '月结';
}

function formatSalary(job) {
  const payType = Number(job?.payType);

  if (payType === 1 && job?.salaryAmount != null) return `${job.salaryAmount} 元/天`;
  if (payType === 2 && job?.hourlyRate != null) return `${job.hourlyRate} 元/小时`;
  if (payType === 3 && job?.unitPrice != null) return `${job.unitPrice} 元/件`;

  return '面议';
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolvePresetLocation(address = '') {
  const text = String(address || '');
  if (!text) return null;

  const presets = [
    { keywords: ['烟台'], latitude: 37.4638, longitude: 121.4479, name: '烟台市' },
    { keywords: ['杭州'], latitude: 30.2741, longitude: 120.1551, name: '杭州市' },
    { keywords: ['呼和浩特', '内蒙', '内蒙古'], latitude: 40.8426, longitude: 111.7492, name: '呼和浩特市' },
    { keywords: ['北京'], latitude: 39.9042, longitude: 116.4074, name: '北京市' },
  ];

  for (let i = 0; i < presets.length; i += 1) {
    const item = presets[i];
    const matched = item.keywords.some((keyword) => text.includes(keyword));
    if (matched) return item;
  }

  return null;
}

function normalizeJobInfo(raw, fallbackBaseId = null) {
  const salaryText = formatSalary(raw);
  const open = isOpenStatus(raw && raw.status);
  const recruitCount = Number(raw?.recruitCount || 0);
  const workAddress = raw?.workAddress || raw?.work_address || raw?.base?.address || raw?.address || '';
  const latitude = toFiniteNumber(raw?.latitude ?? raw?.lat ?? raw?.base?.latitude ?? raw?.base?.lat);
  const longitude = toFiniteNumber(raw?.longitude ?? raw?.lng ?? raw?.base?.longitude ?? raw?.base?.lng);
  const hasExactLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const presetLocation = hasExactLocation ? null : resolvePresetLocation(workAddress || raw?.baseName || raw?.base?.baseName);
  const mapLatitude = hasExactLocation ? latitude : toFiniteNumber(presetLocation?.latitude);
  const mapLongitude = hasExactLocation ? longitude : toFiniteNumber(presetLocation?.longitude);
  const baseId =
    fallbackBaseId != null
      ? Number(fallbackBaseId)
      : raw?.baseId != null
      ? Number(raw.baseId)
      : raw?.base?.id != null
      ? Number(raw.base.id)
      : null;

  return {
    ...raw,
    baseId: Number.isFinite(baseId) ? baseId : null,
    jobTitle: raw?.jobTitle || raw?.title || '岗位详情',
    baseName: raw?.base?.baseName || raw?.baseName || '岗位信息',
    payTypeText: formatPayType(raw?.payType, salaryText),
    workCycleText: formatWorkCycle(raw?.workCycle),
    salaryText,
    recruitCount,
    recruitText: `${recruitCount} 人`,
    statusText: open ? '招聘中' : '已关闭',
    statusClass: open ? 'open' : 'closed',
    open,
    jobDescription: raw?.workContent || raw?.jobDescription || '暂无工作内容描述',
    requirements: raw?.requirements || '身体健康，服从现场安排。',
    workAddress: workAddress || '地址待补充',
    mapLatitude,
    mapLongitude,
    hasMapLocation: Number.isFinite(mapLatitude) && Number.isFinite(mapLongitude),
  };
}

Page({
  data: {
    jobId: null,
    baseId: null,
    jobInfo: null,
    canApply: false,
    loading: true,
    applying: false,
  },

  onLoad(options = {}) {
    if (!requireAuth()) return;
    if (!options.id) {
      this.setData({ loading: false });
      return;
    }

    const parsedJobId = Number(options.id);
    const parsedBaseId = options.baseId ? Number(options.baseId) : null;

    this.setData({
      jobId: Number.isFinite(parsedJobId) ? parsedJobId : null,
      baseId: Number.isFinite(parsedBaseId) ? parsedBaseId : null,
    });

    this.loadJobDetail();
  },

  async loadJobDetail() {
    if (!this.data.jobId) {
      this.setData({ loading: false, canApply: false });
      return;
    }

    try {
      const job = await app.request({
        url: `/base/jobs/${this.data.jobId}`,
        method: 'GET',
      });

      const info = normalizeJobInfo(job, this.data.baseId);
      this.setData({
        jobInfo: info,
        baseId: info.baseId,
        canApply: info.open,
        loading: false,
      });
    } catch (error) {
      if (error && error.statusCode === 404 && this.data.baseId) {
        try {
          const list = await app.request({
            url: `/base/${this.data.baseId}/jobs`,
            method: 'GET',
          });

          const matched = (Array.isArray(list) ? list : []).find(
            (item) => Number(item?.id) === Number(this.data.jobId),
          );

          if (matched) {
            const info = normalizeJobInfo(matched, this.data.baseId);
            this.setData({
              jobInfo: info,
              baseId: info.baseId,
              canApply: info.open,
              loading: false,
            });
            return;
          }
        } catch (_) {
          // Keep the original request error handling below.
        }
      }

      console.error('[job/detail] load failed:', error);
      wx.showToast({
        title: error?.message || '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false, canApply: false });
    }
  },

  previewEnvImage(e) {
    const urls = e.currentTarget.dataset.urls;
    const index = Number(e.currentTarget.dataset.index || 0);
    if (urls && urls.length) {
      wx.previewImage({ urls, current: urls[index] || urls[0] });
    }
  },

  openWorkAddress() {
    const info = this.data.jobInfo;
    if (!info) return;

    const latitude = toFiniteNumber(info.mapLatitude);
    const longitude = toFiniteNumber(info.mapLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      wx.showToast({
        title: '暂无可用地图坐标',
        icon: 'none',
      });
      return;
    }

    wx.openLocation({
      latitude,
      longitude,
      name: info.baseName || '工作地点',
      address: info.workAddress || info.baseName || '',
      scale: 16,
    });
  },

  async handleApply() {
    if (this.data.applying) {
      wx.showToast({ title: '报名提交中，请稍候', icon: 'none' });
      return;
    }

    if (!this.data.canApply) {
      wx.showToast({ title: '该岗位暂不可申请', icon: 'none' });
      return;
    }

    const realNameReady = await ensureRealNameReady({
      title: '完成实名后报名',
      content: '报名岗位需要先完善实名信息，提交后即可继续报名。',
    });
    if (!realNameReady) return;

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.navigateTo({ url: '/pages/login/login' });
        },
      });
      return;
    }

    if (!this.data.baseId) {
      wx.showToast({ title: '基地信息缺失', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认申请',
      content: '确定要申请这个岗位吗？',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ applying: true });

        try {
          let signupRecord = null;
          try {
            signupRecord = await app.request({
              url: '/attendance/signup',
              method: 'POST',
              data: {
                baseId: this.data.baseId,
                jobId: this.data.jobId,
                note: '我要报名该岗位',
              },
            });
          } catch (error) {
            const conflictMessage = getConflictMessage(error);
            if (conflictMessage) {
              wx.showModal({
                title: '报名时间冲突',
                content: conflictMessage,
                showCancel: false,
              });
              return;
            }

            if (isDuplicateApplyError(error)) {
              signupRecord = {
                id: 0,
                duplicate: true,
              };
            } else {
              throw error;
            }
          }

          const info = this.data.jobInfo || {};
          const query = [
            `signupId=${Number(signupRecord?.id) || 0}`,
            `baseId=${Number(this.data.baseId) || 0}`,
            `jobId=${Number(this.data.jobId) || 0}`,
            `baseName=${encodeText(info.baseName || '基地')}`,
            `jobTitle=${encodeText(info.jobTitle || '岗位')}`,
            `workDate=${encodeText(signupRecord?.workDate || '')}`,
            `duplicate=${signupRecord?.duplicate ? '1' : '0'}`,
          ].join('&');

          wx.navigateTo({
            url: `/pages/signup/success/success?${query}`,
          });
        } catch (error) {
          const message = error?.message || '报名失败';
          wx.showToast({ title: message, icon: 'none' });
        } finally {
          this.setData({ applying: false });
        }
      },
    });
  },
});
