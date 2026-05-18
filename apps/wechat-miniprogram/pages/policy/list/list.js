const app = getApp();

Page({
  data: {
    policies: [],
    loading: true,
    searchKeyword: '',
    categories: [
      { id: 0, name: '全部' },
      { id: 1, name: '就业补贴' },
      { id: 2, name: '培训补贴' },
      { id: 3, name: '创业扶持' },
      { id: 4, name: '社保政策' },
    ],
    activeCategory: 0,
  },

  onLoad() {
    this.loadPolicies();
  },

  onPullDownRefresh() {
    this.loadPolicies().finally(() => wx.stopPullDownRefresh());
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value || '' });
  },

  onSearch() {
    this.loadPolicies();
  },

  onCategoryTap(e) {
    const categoryId = Number(e.currentTarget.dataset.id);
    this.setData({ activeCategory: categoryId });
    this.loadPolicies();
  },

  async loadPolicies() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/policy/list',
        method: 'GET',
        data: {
          keyword: this.data.searchKeyword || undefined,
          category: this.data.activeCategory || undefined,
        },
      });

      const policies = (Array.isArray(res) ? res : res.list || []).map((item, index) => ({
        id: item.id,
        title: item.title || '政策标题',
        category: item.category || '就业政策',
        publishDate: item.publishDate || '',
        summary: item.summary || '',
        delay: `${index * 80}ms`,
      }));

      this.setData({ policies, loading: false });
    } catch (err) {
      console.error('加载政策失败:', err);

      // Mock数据
      const mockPolicies = [
        { id: 1, title: '就业困难人员社保补贴政策', category: '就业补贴', publishDate: '2026-04-01', summary: '对符合条件的就业困难人员给予社会保险补贴，补贴标准为实际缴纳社会保险费的60%' },
        { id: 2, title: '职业技能培训补贴实施办法', category: '培训补贴', publishDate: '2026-03-15', summary: '参加职业技能培训并取得证书的劳动者，可申请培训补贴，最高可达2000元' },
        { id: 3, title: '创业担保贷款及贴息政策', category: '创业扶持', publishDate: '2026-02-20', summary: '符合条件的创业人员可申请最高20万元的创业担保贷款，并享受贴息支持' },
      ].map((item, index) => ({
        ...item,
        delay: `${index * 80}ms`,
      }));

      this.setData({ policies: mockPolicies, loading: false });
    }
  },

  goToPolicyDetail(e) {
    const policyId = Number(e.currentTarget.dataset.id);
    wx.navigateTo({
      url: `/pages/policy/detail/detail?id=${policyId}`,
    });
  },
});
