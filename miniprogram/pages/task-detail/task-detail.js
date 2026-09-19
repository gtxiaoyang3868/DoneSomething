const store = require('../../utils/store')
const { toDateKey } = require('../../utils/date')
const { progressColor } = require('../../utils/color')

Page({
  data: { id: '', task: null, records: [], categories: [], categoryColors: {}, categoryIndex: 0, executionDays: 0, lastRecordDate: '', fontSize: 30, today: toDateKey(new Date()), showTaskEditor: false, showRecordEditor: false, editingRecordId: '', saving: false, keyboardHeight: 0, taskForm: {}, recordForm: {}, taskFormProgressColor: '', recordProgressColor: '' },
  onLoad(options) { this.setData({ id: options.id || '' }) },
  onShow() { this.setData({ fontSize: store.getSettings().fontSize || 30 }); this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [tasks, allRecords, categories, categoryColors] = await Promise.all([store.listTasks(), store.listRecords(), store.listCategories(), store.getCategoryColors()])
      const raw = tasks.find(item => item._id === this.data.id)
      if (!raw) return wx.showModal({ title: '任务不存在', content: '任务可能已被其他联动账号移除。', showCancel: false, success: () => wx.navigateBack() })
      const records = allRecords.filter(item => item.taskId === raw._id).sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate)))
      const task = { ...raw, categoryColor: categoryColors[raw.category] || '#728077', progressColor: progressColor(raw.progress) }
      this.setData({ task, records, categories, categoryColors, executionDays: new Set(records.map(item => item.recordDate)).size, lastRecordDate: records[0] ? records[0].recordDate.slice(5) : '' })
      wx.setNavigationBarTitle({ title: raw.name })
    } catch (error) { wx.showToast({ title: '加载失败', icon: 'none' }) }
  },
  stopPropagation() {}, closeEditors() { wx.hideKeyboard(); this.setData({ showTaskEditor: false, showRecordEditor: false, keyboardHeight: 0 }) },
  onKeyboardHeightChange(event) { this.setData({ keyboardHeight: event.detail.height || 0 }) },
  openTaskEditor() { const task = this.data.task; this.setData({ showTaskEditor: true, categoryIndex: Math.max(0, this.data.categories.indexOf(task.category)), taskForm: { name: task.name, description: task.description || '', progress: Number(task.progress || 0) }, taskFormProgressColor: progressColor(task.progress) }) },
  onTaskInput(event) { this.setData({ [`taskForm.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  onCategoryChange(event) { this.setData({ categoryIndex: Number(event.detail.value) }) },
  onTaskProgress(event) { this.setData({ 'taskForm.progress': event.detail.value, taskFormProgressColor: progressColor(event.detail.value) }) },
  async saveTask() { if (!this.data.taskForm.name.trim()) return wx.showToast({ title: '请填写任务名称', icon: 'none' }); this.setData({ saving: true }); try { await store.updateTask(this.data.id, { ...this.data.taskForm, name: this.data.taskForm.name.trim(), description: this.data.taskForm.description.trim(), category: this.data.categories[this.data.categoryIndex] }); this.closeEditors(); await this.loadData(); wx.showToast({ title: '任务已更新' }) } catch (error) { wx.showToast({ title: '保存失败', icon: 'none' }) } finally { this.setData({ saving: false }) } },
  deleteTask() {
    if (this.data.saving) return
    const count = this.data.records.length
    wx.showModal({ title: '删除这个任务？', content: count ? `任务及其 ${count} 条事件记录将一并删除，且无法恢复。` : '删除后无法恢复。', confirmText: '删除', confirmColor: '#c53929', success: async result => {
      if (!result.confirm) return
      this.setData({ saving: true })
      try { await store.deleteTask(this.data.id); this.closeEditors(); wx.showToast({ title: '任务已删除' }); setTimeout(() => wx.navigateBack(), 500) }
      catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }); this.setData({ saving: false }) }
    } })
  },  openNewRecord() { const progress = Number(this.data.task.progress || 0); this.setData({ showRecordEditor: true, editingRecordId: '', recordForm: { title: '', description: '', recordDate: this.data.today, progressAfter: progress }, recordProgressColor: progressColor(progress) }) },
  openRecordEditor(event) { const record = this.data.records.find(item => item._id === event.currentTarget.dataset.id); if (!record) return; const value = record.progressAfter === null || record.progressAfter === undefined ? this.data.task.progress : record.progressAfter; this.setData({ showRecordEditor: true, editingRecordId: record._id, recordForm: { title: record.title, description: record.description || '', recordDate: record.recordDate, progressAfter: Number(value) }, recordProgressColor: progressColor(value) }) },
  onRecordInput(event) { this.setData({ [`recordForm.${event.currentTarget.dataset.field}`]: event.detail.value }) }, onRecordDate(event) { this.setData({ 'recordForm.recordDate': event.detail.value }) },
  onRecordProgress(event) { this.setData({ 'recordForm.progressAfter': event.detail.value, recordProgressColor: progressColor(event.detail.value) }) },
  async saveRecord() { if (!this.data.recordForm.title.trim()) return wx.showToast({ title: '请填写做了什么', icon: 'none' }); const payload = { ...this.data.recordForm, title: this.data.recordForm.title.trim(), description: this.data.recordForm.description.trim(), taskId: this.data.id, category: this.data.task.category, progressAfter: Number(this.data.recordForm.progressAfter) }; this.setData({ saving: true }); try { if (this.data.editingRecordId) await store.updateRecord(this.data.editingRecordId, payload); else await store.addRecord(payload); this.closeEditors(); await this.loadData(); wx.showToast({ title: '记录已保存' }) } catch (error) { wx.showToast({ title: '保存失败', icon: 'none' }) } finally { this.setData({ saving: false }) } },
  deleteRecord() {
    if (!this.data.editingRecordId || this.data.saving) return
    wx.showModal({ title: '删除这条记录？', content: '删除后无法恢复。', confirmText: '删除', confirmColor: '#c53929', success: async result => {
      if (!result.confirm) return
      this.setData({ saving: true })
      try { await store.deleteRecord(this.data.editingRecordId); this.closeEditors(); await this.loadData(); wx.showToast({ title: '记录已删除' }) }
      catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) }
      finally { this.setData({ saving: false }) }
    } })
  }
})
