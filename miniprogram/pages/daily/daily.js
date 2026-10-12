const store = require('../../utils/store')
const { toDateKey } = require('../../utils/date')

Page({
  data: {
    tasks: [], records: [], displayRecords: [], todayRecords: [], visibleTodayRecords: [], historyGroups: [], showHistory: true, filterOptions: [], selectedFilter: '全部', taskOptions: [{ _id: '', name: '不关联任何任务' }], fontSize: 30,
    taskIndex: 0, selectedTask: null, showSheet: false, saving: false, editingId: '', keyboardHeight: 0,
    todayProjectCount: 0, streak: 1, dayScore: 0, today: toDateKey(new Date()),
    form: { title: '', description: '', progressAfter: 0, recordDate: toDateKey(new Date()) }
  },
  onShow() { this.setData({ fontSize: store.getSettings().fontSize || 30, today: toDateKey(new Date()) }); this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [tasks, records, categories, categoryColors] = await Promise.all([store.listTasks(), store.listRecords(), store.listCategories(), store.getCategoryColors()])
      const today = toDateKey(new Date())
      const taskMap = tasks.reduce((map, task) => { map[task._id] = task; return map }, {})
      const displayRecords = records.map(record => { const task = taskMap[record.taskId]; return { ...record, taskName: task && task.name, category: task ? task.category : record.category, categoryColor: task ? (categoryColors[task.category] || '#728077') : '#d88a3d' } }).sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate)))
      const todayRecords = displayRecords.filter(record => record.recordDate === today)
      const dateSet = new Set(records.map(record => record.recordDate)); let streak = 0; const cursor = new Date()
      while (dateSet.has(toDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) }
      const todayProjectCount = new Set(todayRecords.filter(item => item.taskId).map(item => item.taskId)).size
      const filterOptions = [{ label: '全部', value: '全部', color: '#207a4b' }, ...categories.map(name => ({ label: name, value: name, color: categoryColors[name] || '#728077' })), { label: '未关联', value: '__unlinked__', color: '#d88a3d' }]
      const validValues = filterOptions.map(item => item.value); const selectedFilter = validValues.includes(this.data.selectedFilter) ? this.data.selectedFilter : '全部'
      this.setData({ tasks, records, displayRecords, todayRecords, filterOptions, selectedFilter, taskOptions: [{ _id: '', name: '不关联任何任务' }, ...tasks], todayProjectCount, streak: Math.max(streak, 1), dayScore: Math.min(100, todayRecords.length * 22), today }, () => this.applyRecordFilter())
    } catch (error) { wx.showToast({ title: '数据加载失败', icon: 'none' }) }
  },
  matchesFilter(record) { return this.data.selectedFilter === '全部' || (this.data.selectedFilter === '__unlinked__' ? !record.taskId : record.category === this.data.selectedFilter) },
  applyRecordFilter() {
    const visibleTodayRecords = this.data.todayRecords.filter(record => this.matchesFilter(record))
    const history = this.data.displayRecords.filter(record => record.recordDate !== this.data.today && this.matchesFilter(record))
    const groupMap = history.reduce((map, record) => { if (!map[record.recordDate]) map[record.recordDate] = []; map[record.recordDate].push(record); return map }, {})
    const historyGroups = Object.keys(groupMap).sort().reverse().map(date => ({ date, records: groupMap[date], count: groupMap[date].length }))
    this.setData({ visibleTodayRecords, historyGroups })
  },
  toggleHistory() { this.setData({ showHistory: !this.data.showHistory }) },
  openSheet() { this.setData({ showSheet: true, editingId: '', taskIndex: 0, selectedTask: null, form: { title: '', description: '', progressAfter: 0, recordDate: this.data.today } }) },
  editRecord(event) {
    const record = this.data.displayRecords.find(item => item._id === event.currentTarget.dataset.id)
    if (!record) return
    const taskIndex = Math.max(0, this.data.taskOptions.findIndex(task => task._id === record.taskId))
    const selectedTask = taskIndex ? this.data.taskOptions[taskIndex] : null
    this.setData({ showSheet: true, editingId: record._id, taskIndex, selectedTask, form: { title: record.title, description: record.description || '', recordDate: record.recordDate, progressAfter: selectedTask ? Number(record.progressAfter === null || record.progressAfter === undefined ? selectedTask.progress : record.progressAfter) : 0 } })
  },
  selectFilter(event) { this.setData({ selectedFilter: event.currentTarget.dataset.value }, () => this.applyRecordFilter()) },
  closeSheet() { wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }) }, stopPropagation() {},
  onKeyboardHeightChange(event) { this.setData({ keyboardHeight: event.detail.height || 0 }) },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  onRecordDate(event) { this.setData({ 'form.recordDate': event.detail.value }) },
  onTaskChange(event) { const taskIndex = Number(event.detail.value); const selectedTask = taskIndex ? this.data.taskOptions[taskIndex] : null; this.setData({ taskIndex, selectedTask, 'form.progressAfter': selectedTask ? selectedTask.progress : 0 }) },
  onProgressChange(event) { this.setData({ 'form.progressAfter': event.detail.value }) },
  async saveRecord() {
    const title = this.data.form.title.trim()
    if (!title) return wx.showToast({ title: '请填写做了什么', icon: 'none' })
    const task = this.data.selectedTask
    const payload = { taskId: task ? task._id : '', category: task ? task.category : '其他', title, description: this.data.form.description.trim(), progressAfter: task ? Number(this.data.form.progressAfter) : null, recordDate: this.data.form.recordDate || this.data.today }
    this.setData({ saving: true })
    try {
      if (this.data.editingId) await store.updateRecord(this.data.editingId, payload); else await store.addRecord(payload)
      wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }); await this.loadData(); wx.showToast({ title: this.data.editingId ? '已更新' : '已保存' })
    } catch (error) { wx.showToast({ title: '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  deleteRecord() {
    if (!this.data.editingId || this.data.saving) return
    wx.showModal({ title: '删除这条记录？', content: '删除后无法恢复。', confirmText: '删除', confirmColor: '#c53929', success: async result => {
      if (!result.confirm) return
      this.setData({ saving: true })
      try { await store.deleteRecord(this.data.editingId); wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }); await this.loadData(); wx.showToast({ title: '记录已删除' }) }
      catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) }
      finally { this.setData({ saving: false }) }
    } })
  }
})