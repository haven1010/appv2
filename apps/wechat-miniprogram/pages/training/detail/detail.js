const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    courseId: 0,
    course: null,
    loading: true,
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const courseId = Number(options.id || 0);
    if (!courseId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ courseId });
    this.loadCourseDetail();
  },

  async loadCourseDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await app.request({
        url: `/training/courses/${this.data.courseId}`,
        method: 'GET',
      });

      this.setData({
        course: {
          id: res.id,
          title: res.title || '培训课程',
          category: res.category || '技能培训',
          duration: res.duration || '2小时',
          instructor: res.instructor || '专业讲师',
          location: res.location || '线上培训',
          startTime: res.startTime || '',
          description: res.description || '暂无描述',
          enrolled: res.enrolled || false,
          status: res.status || 0,
        },
        loading: false,
      });

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载课程详情失败:', err);

      // Mock数据
      const mockCourses = {
        1: {
          id: 1,
          title: '采摘技能培训',
          category: '采摘技能',
          duration: '2小时',
          instructor: '张老师',
          location: '线上培训',
          startTime: '2026-05-10 09:00',
          description: '本课程将教授采摘的基本技能，包括水果识别、采摘技巧、安全注意事项等内容。适合新手采摘工学习。',
          enrolled: false,
          status: 1,
        },
        2: {
          id: 2,
          title: '安全生产培训',
          category: '安全培训',
          duration: '3小时',
          instructor: '李老师',
          location: '线上培训',
          startTime: '2026-05-12 14:00',
          description: '学习农业生产安全知识，包括防暑降温、农药使用安全、应急处理等内容，确保工作安全。',
          enrolled: false,
          status: 1,
        },
        3: {
          id: 3,
          title: '职业素养提升',
          category: '职业素养',
          duration: '1.5小时',
          instructor: '王老师',
          location: '线上培训',
          startTime: '2026-05-15 10:00',
          description: '提升职业素养，学习职场礼仪、沟通技巧、团队协作等内容，帮助您更好地融入工作环境。',
          enrolled: false,
          status: 0,
        },
      };

      const mockCourse = mockCourses[this.data.courseId] || mockCourses[1];
      this.setData({
        course: mockCourse,
        loading: false,
      });
    }
  },

  async enrollCourse() {
    wx.showLoading({ title: '报名中...' });

    try {
      await app.request({
        url: `/training/courses/${this.data.courseId}/enroll`,
        method: 'POST',
      });

      wx.hideLoading();
      wx.showToast({ title: '报名成功', icon: 'success' });

      setTimeout(() => {
        this.loadCourseDetail();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('报名失败:', err);

      // Mock模式：API未实现时也显示成功
      if (err.message && err.message.includes('暂未支持接口')) {
        wx.showToast({ title: '报名成功（演示模式）', icon: 'success' });
        setTimeout(() => {
          const course = this.data.course;
          if (course) {
            course.enrolled = true;
            this.setData({ course });
          }
        }, 1500);
      } else {
        wx.showToast({ title: err.message || '报名失败', icon: 'none' });
      }
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
