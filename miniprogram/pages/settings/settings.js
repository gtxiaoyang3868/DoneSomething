const store = require('../../utils/store')
const { toDateKey } = require('../../utils/date')

Page({
  data: { fontSize: 30, fontLabel: '标准', profile: {}, genders: ['未设置', '女', '男', '其他'], genderIndex: 0, today: toDateKey(new Date()) },
  onLoad() {
    const settings = store.getSettings(); const profile = store.getProfile(); const genderIndex = Math.max(0, this.data.genders.indexOf(profile.gender || '未设置'))
    this.setData({ fontSize: settings.fontSize || 30, fontLabel: this.fontLabel(settings.fontSize || 30), profile, genderIndex })
  },
  fontLabel(size) { return size <= 28 ? '较小' : size >= 34 ? '较大' : '标准' },
  onFontChanging(event) { const fontSize = Number(event.detail.value); this.setData({ fontSize, fontLabel: this.fontLabel(fontSize) }) },
  onFontChange(event) { const fontSize = Number(event.detail.value); store.saveSettings({ fontSize }); this.setData({ fontSize, fontLabel: this.fontLabel(fontSize) }); wx.showToast({ title: '字号已应用' }) },
  onChooseAvatar(event) {
    const tempFilePath = event.detail.avatarUrl
    wx.saveFile({
      tempFilePath,
      success: result => this.setData({ 'profile.avatar': result.savedFilePath }),
      fail: () => this.setData({ 'profile.avatar': tempFilePath })
    })
  },
  onInput(event) { this.setData({ [`profile.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  onGenderChange(event) { const genderIndex = Number(event.detail.value); this.setData({ genderIndex, 'profile.gender': this.data.genders[genderIndex] }) },
  onBirthdayChange(event) { this.setData({ 'profile.birthday': event.detail.value }) },
  saveProfile() { store.saveProfile(this.data.profile); wx.showToast({ title: '个人资料已保存' }) },
  openAccountSync() { wx.navigateTo({ url: '/pages/account-sync/account-sync' }) }
})
