/**
 * Layer: Mini Program Page
 * Responsibility: Worker-side service hub with AI, policy, training, and rights entrances.
 */
const { resolveRole, isAdminRole } = require('../../utils/role');

const SERVICE_GROUPS = [
  {
    id: 'ai',
    title: '智能助手',
    subtitle: '像豆包一样提问，帮助找岗、看政策、懂工资',
    items: [
      { id: 'ai-job', label: '帮我找岗位', desc: '根据当前条件给出岗位建议', url: '/pages/job/list/list' },
      { id: 'ai-policy', label: '帮我看政策', desc: '快速理解补贴和申请条件', url: '/pages/policy/list/list' },
      { id: 'ai-rights', label: '帮我维权', desc: '遇到工资和合同问题时先求助', url: '/pages/rights/consult/consult' },
    ],
  },
  {
    id: 'policy',
    title: '政策服务',
    subtitle: '看政策、看条件、提交申请',
    items: [
      { id: 'policy-list', label: '政策列表', desc: '按分类查看扶持和补贴政策', url: '/pages/policy/list/list' },
      { id: 'policy-apply', label: '政策申请', desc: '填写资料并提交申请意向', url: '/pages/policy/apply/apply?policyId=1&title=政策申请' },
    ],
  },
  {
    id: 'training',
    title: '培训学习',
    subtitle: '看课程、报名培训、提升技能',
    items: [
      { id: 'training-list', label: '培训课程', desc: '查看适合自己的培训课程', url: '/pages/training/list/list' },
      { id: 'training-record', label: '学习记录', desc: '查看自己的报名和学习情况', url: '/pages/training/detail/detail?id=1' },
    ],
  },
  {
    id: 'rights',
    title: '维权咨询',
    subtitle: '工资、合同、工伤问题都可以咨询',
    items: [
      { id: 'rights-consult', label: '提交咨询', desc: '描述问题并提交咨询材料', url: '/pages/rights/consult/consult' },
      { id: 'rights-list', label: '查看进度', desc: '查看处理状态和反馈结果', url: '/pages/rights/list/list' },
    ],
  },
];

Page({
  data: {
    pageReady: false,
    serviceGroups: SERVICE_GROUPS,
  },

  onLoad() {
    if (this.redirectIfRoleNotWorker()) return;
    this.readyTimer = setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    if (this.redirectIfRoleNotWorker()) return;
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 2 });
    }
  },

  onUnload() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  },

  redirectIfRoleNotWorker() {
    const userInfo = wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);
    if (role === 'boss') {
      wx.reLaunch({ url: '/pages/base/list/list' });
      return true;
    }
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  goStep(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  },
});
