/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Work History page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
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
      var records = list.map(function(r) {
        return Object.assign({}, r, {
          checkinTime: r.checkinTime ? (r.checkinTime.length > 10 ? r.checkinTime.substr(11, 5) : r.checkinTime) : '',
        });
      });
      this.setData({ records, loading: false });
    } catch (err) {
      this.setData({ records: [], loading: false });
    }
  },
});
