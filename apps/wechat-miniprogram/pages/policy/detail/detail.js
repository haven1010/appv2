const app = getApp();

Page({
  data: {
    policyId: 0,
    policy: null,
    loading: true,
  },

  onLoad(options) {
    const policyId = Number(options.id || 0);
    if (!policyId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ policyId });
    this.loadPolicyDetail();
  },

  async loadPolicyDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await app.request({
        url: `/policy/${this.data.policyId}`,
        method: 'GET',
      });

      this.setData({
        policy: {
          id: res.id,
          title: res.title || '政策标题',
          category: res.category || '就业政策',
          publishDate: res.publishDate || '',
          department: res.department || '人社部门',
          content: res.content || '暂无内容',
          requirements: res.requirements || '详见政策文件',
          applyMethod: res.applyMethod || '线下申请',
        },
        loading: false,
      });

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载政策详情失败:', err);

      // Mock数据
      const mockPolicies = {
        1: {
          id: 1,
          title: '就业困难人员社保补贴政策',
          category: '就业补贴',
          publishDate: '2026-04-01',
          department: '渭南市人力资源和社会保障局',
          content: '为帮助就业困难人员实现稳定就业，对符合条件的就业困难人员给予社会保险补贴。补贴标准为实际缴纳社会保险费的60%，补贴期限最长不超过3年。',
          requirements: '1. 持有《就业创业证》或《就业失业登记证》\n2. 属于就业困难人员范围\n3. 已实现灵活就业并缴纳社会保险费\n4. 年龄在法定退休年龄以内',
          applyMethod: '携带相关材料到户籍所在地或常住地街道（乡镇）人力资源社会保障服务中心申请',
        },
        2: {
          id: 2,
          title: '职业技能培训补贴实施办法',
          category: '培训补贴',
          publishDate: '2026-03-15',
          department: '渭南市人力资源和社会保障局',
          content: '参加职业技能培训并取得职业资格证书、职业技能等级证书、专项职业能力证书的劳动者，可申请职业技能培训补贴。补贴标准根据培训工种和等级确定，最高可达2000元。',
          requirements: '1. 参加政府补贴培训目录内的职业技能培训\n2. 取得相应职业资格证书或技能等级证书\n3. 培训合格后6个月内申请\n4. 同一职业同一等级只能享受一次补贴',
          applyMethod: '通过培训机构统一申报或个人到当地人社部门申请',
        },
        3: {
          id: 3,
          title: '创业担保贷款及贴息政策',
          category: '创业扶持',
          publishDate: '2026-02-20',
          department: '渭南市人力资源和社会保障局',
          content: '符合条件的创业人员可申请最高20万元的创业担保贷款，合伙创业的可适当提高贷款额度。贷款期限最长不超过3年，由财政部门按规定给予贴息支持。',
          requirements: '1. 具有完全民事行为能力\n2. 个人信用记录良好\n3. 有创业意愿和创业能力\n4. 自筹资金不低于项目所需资金的30%\n5. 有固定的经营场所',
          applyMethod: '向创业地人社部门提出申请，经审核后由经办银行发放贷款',
        },
      };

      const mockPolicy = mockPolicies[this.data.policyId] || mockPolicies[1];
      this.setData({
        policy: mockPolicy,
        loading: false,
      });
    }
  },

  applyConsult() {
    wx.navigateTo({
      url: `/pages/policy/apply/apply?policyId=${this.data.policyId}&title=${encodeURIComponent(this.data.policy.title)}`,
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
