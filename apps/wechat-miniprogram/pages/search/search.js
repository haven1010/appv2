const app = getApp();

const SEARCH_DEBOUNCE_MS = 300;

function toText(value) {
  return String(value || '').trim();
}

Page({
  data: {
    keyword: '',
    results: [],
    loading: true,
    allJobs: [],
    allBases: [],
    allPolicies: [],
  },

  onLoad() {
    this.loadAllData();
  },

  onShow() {
    if (this.data.allJobs.length || this.data.allBases.length || this.data.allPolicies.length) {
      this.doSearch();
    }
  },

  async loadAllData() {
    this.setData({ loading: true });
    try {
      const [bases, policies] = await Promise.all([
        app.request({ url: '/base?withOpenJobs=1', method: 'GET' }).catch(() => []),
        app.request({ url: '/policy/list', method: 'GET' }).catch(() => []),
      ]);

      const baseList = Array.isArray(bases) ? bases : [];
      const policyList = Array.isArray(policies) ? policies : (policies?.list || []);

      const jobs = [];
      baseList.forEach((base) => {
        const openJobs = base.openJobs || [];
        openJobs.forEach((job) => {
          jobs.push({
            id: Number(job.id),
            title: job.jobTitle || job.title || '未命名岗位',
            baseId: Number(base.id),
            baseName: base.baseName || '未命名基地',
            address: toText(base.address) || '地址待补充',
            salary: base.salaryRange || '面议',
            type: 'job',
          });
        });
      });

      const basesForSearch = baseList.map((base) => ({
        id: Number(base.id),
        title: base.baseName || '未命名基地',
        address: toText(base.address) || '地址待补充',
        category: base.category,
        type: 'base',
      }));

      const policiesForSearch = policyList.map((p) => ({
        id: p.id,
        title: p.title || '政策标题',
        category: p.category || '政策',
        summary: p.summary || '',
        type: 'policy',
      }));

      this.setData({
        allJobs: jobs,
        allBases: basesForSearch,
        allPolicies: policiesForSearch,
        loading: false,
      });

      this.doSearch();
    } catch (err) {
      console.error('[search] load data failed:', err);
      this.setData({ loading: false });
    }
  },

  onInput(e) {
    const keyword = toText(e.detail.value);
    this.setData({ keyword });

    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.doSearch();
    }, SEARCH_DEBOUNCE_MS);
  },

  doSearch() {
    const kw = this.data.keyword.toLowerCase();
    if (!kw) {
      this.setData({ results: [] });
      return;
    }

    const match = (text) => toText(text).toLowerCase().includes(kw);

    const matchedJobs = this.data.allJobs.filter((j) =>
      match(j.title) || match(j.baseName) || match(j.address)
    );

    const matchedBases = this.data.allBases.filter((b) =>
      match(b.title) || match(b.address)
    );

    const matchedPolicies = this.data.allPolicies.filter((p) =>
      match(p.title) || match(p.category) || match(p.summary)
    );

    const results = [
      ...matchedJobs.map((j) => ({ ...j, section: '岗位' })),
      ...matchedBases.map((b) => ({ ...b, section: '基地' })),
      ...matchedPolicies.map((p) => ({ ...p, section: '政策' })),
    ];

    this.setData({ results });
  },

  onClear() {
    this.setData({ keyword: '', results: [] });
  },

  onTapResult(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    if (item.type === 'job') {
      wx.navigateTo({ url: `/pages/job/detail/detail?id=${item.id}&baseId=${item.baseId}` });
    } else if (item.type === 'base') {
      wx.navigateTo({ url: `/pages/base/detail/detail?id=${item.id}` });
    } else if (item.type === 'policy') {
      wx.navigateTo({ url: `/pages/policy/detail/detail?id=${item.id}` });
    }
  },
});
