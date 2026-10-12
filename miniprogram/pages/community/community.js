Page({
  data: { activeTab: 'groups' },
  switchTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }) },
  comingSoon() { wx.showToast({ title: '小组与分享功能将在下一阶段开放', icon: 'none' }) }
})
