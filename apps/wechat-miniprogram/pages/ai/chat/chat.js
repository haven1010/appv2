const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    inputValue: '',
    messages: [],
    isLoading: false,
    canSend: false,
    showGreeting: true,
    // 语音
    isRecording: false,
    recorderManager: null,
    recordingTimer: null,
  },

  onLoad() {
    if (!requireAuth()) return;
    try {
      const rm = wx.getRecorderManager();
      rm.onStop((res) => this.onRecordStop(res));
      rm.onError(() => {
        wx.showToast({ title: '录音失败', icon: 'none' });
        this.setData({ isRecording: false });
      });
      this.data.recorderManager = rm;
    } catch (_) {}
  },

  onUnload() {
    if (this.data.recordingTimer) clearTimeout(this.data.recordingTimer);
  },

  // ─── 输入 ──────────────────────────────────────────────────
  onInput(e) {
    const val = e.detail.value || '';
    this.setData({
      inputValue: val,
      canSend: val.trim().length > 0,
    });
  },

  // ─── 快捷指令 ──────────────────────────────────────────────
  usePrompt(e) {
    const text = e.currentTarget.dataset.prompt || '';
    if (!text) return;
    this.sendMessage(text);
  },

  // ─── 语音 ──────────────────────────────────────────────────
  startRecord() {
    if (!this.data.recorderManager) {
      wx.showToast({ title: '暂不支持录音', icon: 'none' });
      return;
    }
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.data.recorderManager.start({ format: 'mp3', sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 24000 });
        this.setData({ isRecording: true });
        this.data.recordingTimer = setTimeout(() => this.stopRecord(), 60000);
      },
      fail: () => {
        wx.showModal({ title: '需要麦克风权限', content: '请在设置中开启麦克风权限，才能使用语音输入', showCancel: false });
      },
    });
  },

  stopRecord() {
    if (this.data.recordingTimer) { clearTimeout(this.data.recordingTimer); this.data.recordingTimer = null; }
    if (this.data.recorderManager) this.data.recorderManager.stop();
  },

  onRecordStop(res) {
    this.setData({ isRecording: false });
    if (!res || !res.tempFilePath || (res.duration || 0) < 300) return;
    wx.showModal({
      title: '语音识别',
      content: '语音功能需要配置腾讯云 ASR，目前你可以用手机键盘上的麦克风按钮直接语音转文字哦～',
      showCancel: false,
    });
  },

  // ─── 发送 ──────────────────────────────────────────────────
  sendMessage(text) {
    const content = String(text || '').trim();
    if (!content || this.data.isLoading) return;

    const newMsgs = this.data.messages.concat([{ role: 'user', content }]);
    this.setData({
      inputValue: '',
      canSend: false,
      messages: newMsgs,
      isLoading: true,
      showGreeting: false,
    });
    this.scrollBottom();

    this.callAI(newMsgs);
  },

  submit() {
    this.sendMessage(this.data.inputValue);
  },

  async callAI(messages) {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      const { result } = await wx.cloud.callFunction({
        name: 'aiChat',
        data: {
          action: 'chat',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          userInfo: {
            id: userInfo.id, uid: userInfo.uid, name: userInfo.name,
            role: userInfo.role || userInfo.roleKey, roleKey: userInfo.roleKey,
          },
        },
      });

      const reply = result?.reply || '抱歉，小玉没听明白，你再说一遍好吗？';
      this.setData({
        messages: this.data.messages.concat([{ role: 'assistant', content: reply }]),
        isLoading: false,
      });
      this.scrollBottom();
    } catch (err) {
      console.error('[aiChat]', err);
      this.setData({
        messages: this.data.messages.concat([{ role: 'assistant', content: '小玉网络开小差了～你再说一遍好不好？' }]),
        isLoading: false,
      });
      this.scrollBottom();
    }
  },

  scrollBottom() {
    setTimeout(() => { wx.pageScrollTo({ scrollTop: 999999, duration: 200 }); }, 100);
  },

  // ─── 工具 ──────────────────────────────────────────────────
  tapTool(e) {
    const id = e.currentTarget.dataset.id;
    const idx = e.currentTarget.dataset.index;
    const msg = this.data.messages[idx];
    if (!msg) return;

    if (id === 'copy') {
      wx.setClipboardData({ data: msg.content });
      wx.showToast({ title: '已复制', icon: 'none' });
    } else if (id === 'refresh') {
      if (idx > 0 && this.data.messages[idx - 1]?.role === 'user') {
        const userMsg = this.data.messages[idx - 1];
        this.setData({ messages: this.data.messages.slice(0, idx - 1), isLoading: true });
        this.callAI(this.data.messages.slice(0, idx - 1).concat([userMsg]));
      }
    } else if (id === 'voice') {
      wx.showToast({ title: '正在朗读...', icon: 'none' });
    }
  },
});
