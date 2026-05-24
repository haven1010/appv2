/**
 * Layer: Mini Program Page
 * Responsibility: Worker-side AI assistant main tab page.
 */
const { resolveRole, isAdminRole } = require('../../utils/role');

Page({
  data: {
    pageReady: false,
    title: '介绍小玉',
    subtitle: '内容由小玉生成',
    quickActions: [
      { id: 'quick', label: '快速', icon: '⚡', prompt: '帮我快速推荐一个适合今天报名的岗位' },
      { id: 'call', label: '联系', icon: '☎', prompt: '帮我整理联系企业时要问的3个问题' },
      { id: 'create', label: '创作', icon: '✦', prompt: '帮我写一段简短的求职自我介绍' },
      { id: 'write', label: '写作', icon: '✎', prompt: '帮我写一段工资申诉说明' },
    ],
    toolActions: [
      { id: 'copy', icon: '复' },
      { id: 'voice', icon: '听' },
      { id: 'save', icon: '存' },
      { id: 'share', icon: '发' },
      { id: 'refresh', icon: '换' },
    ],
    inputValue: '',
    messages: [
      { role: 'user', content: '你是谁' },
      {
        role: 'assistant',
        content: '我是小玉，面向工人、企业和管理员的智能助手。你可以向我咨询岗位、政策、工资、维权，也可以让我帮你生成文案和整理思路。',
      },
    ],
  },

  onLoad() {
    if (this.redirectIfRoleNotWorker()) return;
    this.readyTimer = setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    if (this.redirectIfRoleNotWorker()) return;
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

  onInput(e) {
    this.setData({ inputValue: e.detail.value || '' });
  },

  usePrompt(e) {
    const text = e.currentTarget.dataset.prompt || '';
    if (!text) return;
    this.setData({ inputValue: text });
  },

  tapToolAction(e) {
    const id = e.currentTarget.dataset.id || '';
    const actionMap = {
      copy: '已复制内容',
      voice: '语音播报功能预留',
      save: '收藏功能预留',
      share: '分享功能预留',
      refresh: '已刷新回答',
    };
    wx.showToast({
      title: actionMap[id] || '功能预留中',
      icon: 'none',
    });
  },

  submit() {
    const text = String(this.data.inputValue || '').trim();
    if (!text) return;

    const nextMessages = this.data.messages.concat([
      { role: 'user', content: text },
      {
        role: 'assistant',
        content: '当前为页面布局预留版。后续这里将接入真正的智能问答接口，并结合岗位、政策、工资、维权信息返回答案。',
      },
    ]);

    this.setData({
      inputValue: '',
      messages: nextMessages,
    });
  },
});
