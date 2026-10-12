const store = require('../../utils/store')
const { toDateKey } = require('../../utils/date')

Page({
  data: { id: '', item: null, logs: [], percent: 0, showSheet: false, saving: false, uploading: false, keyboardHeight: 0, form: { note: '', photos: [] } },
  onLoad(options) { this.setData({ id: options.id || '' }) },
  onShow() { this.loadData() },
  async loadData() { try { const [items, logs] = await Promise.all([store.listCheckinTasks(), store.listCheckinLogs(this.data.id)]); const item = items.find(task => task._id === this.data.id); if (!item) return wx.showToast({ title: '任务不存在', icon: 'none' }); const percent = Math.min(100, Math.round(Number(item.currentCount || 0) / Math.max(1, Number(item.targetCount || 1)) * 100)); this.setData({ item, percent, logs: logs.map(log => ({ ...log, displayDate: log.checkinDate || toDateKey(new Date(Number(log.createdAt || Date.now()))) })) }) } catch (error) { wx.showToast({ title: '详情加载失败', icon: 'none' }) } },
  openCheckin() { this.setData({ showSheet: true, form: { note: '', photos: [] } }) },
  closeSheet() { wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }) },
  stopPropagation() {},
  onKeyboardHeightChange(event) { this.setData({ keyboardHeight: event.detail.height || 0 }) },
  onNote(event) { this.setData({ 'form.note': event.detail.value }) },
  async choosePhotos() { try { const result = await wx.chooseMedia({ count: Math.max(1, 9 - this.data.form.photos.length), mediaType: ['image'], sourceType: ['album', 'camera'] }); this.setData({ uploading: true }); const photos = []; for (const file of result.tempFiles) { let url = file.tempFilePath; if (getApp().globalData.useCloud) { const ext = (url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/) || [,'jpg'])[1]; const uploaded = await wx.cloud.uploadFile({ cloudPath: `checkins/log-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`, filePath: url }); url = uploaded.fileID } photos.push(url) } this.setData({ 'form.photos': [...this.data.form.photos, ...photos] }) } catch (error) { if (!String(error.errMsg || '').includes('cancel')) wx.showToast({ title: '照片添加失败', icon: 'none' }) } finally { this.setData({ uploading: false }) } },
  removePhoto(event) { const index = Number(event.currentTarget.dataset.index); this.setData({ 'form.photos': this.data.form.photos.filter((_, i) => i !== index) }) },
  previewPhoto(event) { wx.previewImage({ current: event.currentTarget.dataset.url, urls: event.currentTarget.dataset.urls }) },
  previewReference(event) { const images = (this.data.item.attachments || []).filter(item => item.type !== 'video').map(item => item.url); wx.previewImage({ current: event.currentTarget.dataset.url, urls: images }) },
  async saveCheckin() { this.setData({ saving: true }); try { await store.addCheckinLog({ checkinId: this.data.id, note: this.data.form.note.trim(), photos: this.data.form.photos, checkinDate: toDateKey(new Date()) }); this.closeSheet(); await this.loadData(); wx.showToast({ title: '打卡成功' }) } catch (error) { wx.showToast({ title: '打卡失败', icon: 'none' }) } finally { this.setData({ saving: false }) } },
  deleteLog(event) { const id = event.currentTarget.dataset.id; wx.showModal({ title: '删除这次打卡', content: '删除后累计次数会减 1。', confirmColor: '#c53929', success: async result => { if (!result.confirm) return; try { await store.deleteCheckinLog(id); await this.loadData(); wx.showToast({ title: '已删除' }) } catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) } } }) }
})
