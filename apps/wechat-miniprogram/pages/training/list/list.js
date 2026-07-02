const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    courses: [],
    loading: true,
    categories: [
      { id: 0, name: '全部' },
      { id: 1, name: '采摘技能' },
      { id: 2, name: '安全培训' },
      { id: 3, name: '职业素养' },
    ],
    activeCategory: 0,
  },

  onLoad() {
    if (!requireAuth()) return;
    this.loadCourses();
  },

  onPullDownRefresh() {
    this.loadCourses().finally(() => wx.stopPullDownRefresh());
  },

  onCategoryTap(e) {
    const categoryId = Number(e.currentTarget.dataset.id);
    this.setData({ activeCategory: categoryId });
    this.loadCourses(categoryId);
  },

  catMap: { 1: '采摘技能', 2: '安全培训', 3: '职业素养' },

  async loadCourses(categoryId) {
    const catId = categoryId ?? this.data.activeCategory;
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/training/courses',
        method: 'GET',
        data: {
          category: catId || undefined,
        },
      });

      const courses = (Array.isArray(res) ? res : res.list || [])
        .filter(item => catId === 0 || item.category === this.catMap[catId])
        .map((item, index) => ({
        id: item.id,
        title: item.title || '培训课程',
        category: item.category || '技能培训',
        duration: item.duration || '2小时',
        status: item.status || 0,
        statusText: this.getStatusText(item.status),
        enrolled: item.enrolled || false,
        delay: `${index * 80}ms`,
      }));

      this.setData({ courses, loading: false });
    } catch (err) {
      console.error('加载课程失败:', err);

      // Mock数据
      const mockAll = [
        { id: 1, title: '采摘技能培训', category: '采摘技能', duration: '2小时', status: 1, enrolled: false },
        { id: 2, title: '安全生产培训', category: '安全培训', duration: '3小时', status: 1, enrolled: false },
        { id: 3, title: '职业素养提升', category: '职业素养', duration: '1.5小时', status: 0, enrolled: false },
      ];
      const filtered = catId === 0
        ? mockAll
        : mockAll.filter(c => c.category === this.catMap[catId]);

      const mockCourses = filtered.map((item, index) => ({
        ...item,
        statusText: this.getStatusText(item.status),
        delay: `${index * 80}ms`,
      }));

      this.setData({ courses: mockCourses, loading: false });
    }
  },

  getStatusText(status) {
    if (status === 1) return '进行中';
    if (status === 2) return '已结束';
    return '未开始';
  },

  goToCourseDetail(e) {
    const courseId = Number(e.currentTarget.dataset.id);
    wx.navigateTo({
      url: `/pages/training/detail/detail?id=${courseId}`,
    });
  },

  async enrollCourse(e) {
    const courseId = Number(e.currentTarget.dataset.id);
    wx.showLoading({ title: '报名中...' });

    try {
      await app.request({
        url: `/training/courses/${courseId}/enroll`,
        method: 'POST',
      });

      wx.hideLoading();
      wx.showToast({ title: '报名成功', icon: 'success' });
      this.loadCourses();
    } catch (err) {
      wx.hideLoading();
      console.error('报名失败:', err);

      // Mock模式：API未实现时也显示成功
      if (err.message && err.message.includes('暂未支持接口')) {
        wx.showToast({ title: '报名成功（演示模式）', icon: 'success' });
        setTimeout(() => {
          this.loadCourses();
        }, 1500);
      } else {
        wx.showToast({ title: err.message || '报名失败', icon: 'none' });
      }
    }
  },
});
