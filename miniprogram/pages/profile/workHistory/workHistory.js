// pages/profile/workHistory/workHistory.js
const app = getApp();

Page({
  data: {
    records: [],
    loading: true,
  },

  onLoad() {
    this.loadRecords();
  },

  async loadRecords() {
    try {
      const res = await app.request({ url: '/attendance/worker/records', method: 'GET' });
      const list = Array.isArray(res) ? res : [];
      const records = list.map(r => ({
        ...r,
        checkinTime: r.checkinTime ? (r.checkinTime.length > 10 ? r.checkinTime.substr(11, 5) : r.checkinTime) : '',
      }));
      this.setData({ records, loading: false });
    } catch (err) {
      this.setData({ records: [], loading: false });
    }
  },
});
