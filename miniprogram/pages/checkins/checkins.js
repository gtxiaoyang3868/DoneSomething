const store = require('../../utils/store')
const { toDateKey } = require('../../utils/date')

Page({
  data: { items: [], activeItems: [], completedItems: [], searchQuery: '', showCompleted: false, showSheet: false, editingId: '', saving: false, uploading: false, keyboardHeight: 0, today: '', form: { name: '', description: '', targetCount: 30, deadline: '', attachments: [], visibility: 'private' } },
  onLoad() { this.setData({ today: toDateKey(new Date()) }) },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() { try { const items = await store.listCheckinTasks(); this.setData({ items }); this.applyFilters() } catch (error) { wx.showToast({ title: '打卡任务加载失败', icon: 'none' }) } },
  applyFilters() { const query = this.data.searchQuery.trim().toLowerCase(); const items = this.data.items.filter(item => !query || `${item.name || ''} ${item.description || ''}`.toLowerCase().includes(query)).map(item => ({ ...item, percent: Math.min(100, Math.round(Number(item.currentCount || 0) / Math.max(1, Number(item.targetCount || 1)) * 100)), deadlineText: item.deadline ? `截止 ${item.deadline}` : '不设截止日期' })); this.setData({ activeItems: items.filter(item => item.status !== 'completed'), completedItems: items.filter(item => item.status === 'completed') }) },
  onSearch(event) { this.setData({ searchQuery: event.detail.value }, () => this.applyFilters()) },
  clearSearch() { this.setData({ searchQuery: '' }, () => this.applyFilters()) },
  toggleCompleted() { this.setData({ showCompleted: !this.data.showCompleted }) },
  openCreate() { this.setData({ showSheet: true, editingId: '', form: { name: '', description: '', targetCount: 30, deadline: '', attachments: [], visibility: 'private' } }) },
  openEdit(event) { const item = this.data.items.find(task => task._id === event.currentTarget.dataset.id); if (!item) return; this.setData({ showSheet: true, editingId: item._id, form: { name: item.name || '', description: item.description || '', targetCount: Number(item.targetCount || 1), deadline: item.deadline || '', attachments: item.attachments || [], visibility: item.visibility || 'private' } }) },
  closeSheet() { wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }) },
  stopPropagation() {},
  onKeyboardHeightChange(event) { this.setData({ keyboardHeight: event.detail.height || 0 }) },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  onDeadlineChange(event) { this.setData({ 'form.deadline': event.detail.value }) },
  clearDeadline() { this.setData({ 'form.deadline': '' }) },
  async chooseReference() { try { const media = await wx.chooseMedia({ count: Math.max(1, 6 - this.data.form.attachments.length), mediaType: ['image', 'video'], sourceType: ['album', 'camera'] }); this.setData({ uploading: true }); const added = []; for (const file of media.tempFiles) { let url = file.tempFilePath; if (getApp().globalData.useCloud) { const ext = (url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/) || [,'jpg'])[1]; const uploaded = await wx.cloud.uploadFile({ cloudPath: `checkins/reference-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`, filePath: url }); url = uploaded.fileID } added.push({ type: file.fileType || 'image', url }) } this.setData({ 'form.attachments': [...this.data.form.attachments, ...added] }) } catch (error) { if (!String(error.errMsg || '').includes('cancel')) wx.showToast({ title: '附件添加失败', icon: 'none' }) } finally { this.setData({ uploading: false }) } },
  removeAttachment(event) { const index = Number(event.currentTarget.dataset.index); this.setData({ 'form.attachments': this.data.form.attachments.filter((_, i) => i !== index) }) },
  async saveTask() { const name = this.data.form.name.trim(); const targetCount = Number(this.data.form.targetCount); if (!name) return wx.showToast({ title: '请填写打卡名称', icon: 'none' }); if (!Number.isInteger(targetCount) || targetCount < 1) return wx.showToast({ title: '目标次数至少为 1', icon: 'none' }); const payload = { ...this.data.form, name, description: this.data.form.description.trim(), targetCount }; this.setData({ saving: true }); try { if (this.data.editingId) await store.updateCheckinTask(this.data.editingId, payload); else await store.addCheckinTask(payload); this.closeSheet(); await this.loadData(); wx.showToast({ title: this.data.editingId ? '已保存' : '已创建' }) } catch (error) { wx.showToast({ title: '保存失败', icon: 'none' }) } finally { this.setData({ saving: false }) } },
  openDetail(event) { wx.navigateTo({ url: `/pages/checkin-detail/checkin-detail?id=${event.currentTarget.dataset.id}` }) },
  deleteTask(event) { const id = event.currentTarget.dataset.id; wx.showModal({ title: '删除打卡任务', content: '任务和它的全部打卡日记都会删除，且无法恢复。', confirmColor: '#c53929', success: async result => { if (!result.confirm) return; try { await store.deleteCheckinTask(id); await this.loadData(); wx.showToast({ title: '已删除' }) } catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) } } }) }
})
