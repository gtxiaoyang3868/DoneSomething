const store = require('../../utils/store')
const { toDateKey } = require('../../utils/date')
const { progressColor } = require('../../utils/color')

Page({
  data: {
    activeSection: 'tasks', tasks: [], completedTasks: [], allTasks: [], records: [], categories: [], categoryColors: {}, recommendedCategories: [], filterOptions: [], selectedFilter: '全部', searchQuery: '', expandedTaskIds: {}, showCompleted: false, categoryIndex: 0, fontSize: 30,
    showSheet: false, showCategoryManager: false, saving: false, editingId: '', keyboardHeight: 0,
    form: { name: '', description: '', progress: 0 }, categoryDraft: '', editingCategoryIndex: -1,
    colorPalette: ['#3f8f70','#d88a3d','#7b78b8','#3f78b8','#b75b75','#8b6b4a','#4f8f9d','#728077'], selectedCategoryColor: '#3f8f70'
  },
  onShow() { this.setData({ fontSize: store.getSettings().fontSize || 30 }); this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [tasks, records, categories, categoryColors, habitCategories] = await Promise.all([store.listTasks(), store.listRecords(), store.listCategories(), store.getCategoryColors(), store.listHabitCategories()])
      const today = toDateKey(new Date()); const yesterday = toDateKey(new Date(Date.now() - 86400000))
      const enriched = tasks.map(task => {
        const dates = [...new Set(records.filter(record => record.taskId === task._id).map(record => record.recordDate))].sort().reverse()
        const last = dates[0]
        return { ...task, status: task.status || 'active', categoryInitial: (task.category || '其').slice(0, 1), categoryColor: categoryColors[task.category] || '#728077', progressColor: progressColor(task.progress), executionDays: dates.length, lastActiveText: last === today ? '今天有记录' : last === yesterday ? '昨天有记录' : last ? `${last.slice(5).replace('-', '月')}日有记录` : '尚未记录' }
      })
      const selectedFilter = categories.includes(this.data.selectedFilter) ? this.data.selectedFilter : '全部'
      const filterOptions = [{ name: '全部', color: '#207a4b' }, ...categories.map(name => ({ name, color: categoryColors[name] || '#728077' }))]
      this.setData({ allTasks: enriched, records, categories, categoryColors, filterOptions, selectedFilter, recommendedCategories: habitCategories.filter(name => !categories.includes(name)).slice(0, 6) }, () => this.applyFilters())
    } catch (error) { wx.showToast({ title: '数据加载失败', icon: 'none' }) }
  },
  applyFilters() {
    const query = this.data.searchQuery.trim().toLowerCase()
    const filtered = this.data.allTasks.filter(item => {
      const categoryMatch = this.data.selectedFilter === '全部' || item.category === this.data.selectedFilter
      const searchText = `${item.name || ''} ${item.description || ''} ${item.category || ''}`.toLowerCase()
      return categoryMatch && (!query || searchText.includes(query))
    }).map(item => ({ ...item, expanded: !!this.data.expandedTaskIds[item._id] }))
    this.setData({ tasks: filtered.filter(item => item.status !== 'completed'), completedTasks: filtered.filter(item => item.status === 'completed') })
  },
  onSearch(event) { this.setData({ searchQuery: event.detail.value }, () => this.applyFilters()) },
  clearSearch() { this.setData({ searchQuery: '' }, () => this.applyFilters()) },
  toggleTask(event) { const id = event.currentTarget.dataset.id; this.setData({ [`expandedTaskIds.${id}`]: !this.data.expandedTaskIds[id] }, () => this.applyFilters()) },
  toggleCompleted() { this.setData({ showCompleted: !this.data.showCompleted }) },
  openSheet() { this.setData({ showSheet: true, editingId: '', categoryIndex: 0, form: { name: '', description: '', progress: 0 } }) },
  openTaskDetail(event) { wx.navigateTo({ url: `/pages/task-detail/task-detail?id=${event.currentTarget.dataset.id}` }) },
  switchSection(event) { this.setData({ activeSection: event.currentTarget.dataset.section }) },
  selectFilter(event) { this.setData({ selectedFilter: event.currentTarget.dataset.value }, () => this.applyFilters()) },
  closeSheet() { wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }) }, stopPropagation() {},
  onKeyboardHeightChange(event) { this.setData({ keyboardHeight: event.detail.height || 0 }) },
  onInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  onProgressChange(event) { this.setData({ 'form.progress': event.detail.value }) },
  onCategoryChange(event) { this.setData({ categoryIndex: Number(event.detail.value) }) },
  openCategoryManager() { this.setData({ showCategoryManager: true, categoryDraft: '', editingCategoryIndex: -1, selectedCategoryColor: '#3f8f70' }) },
  closeCategoryManager() { wx.hideKeyboard(); this.setData({ showCategoryManager: false, keyboardHeight: 0 }) },
  onCategoryDraft(event) { this.setData({ categoryDraft: event.detail.value }) },
  useRecommendedCategory(event) { this.setData({ categoryDraft: event.currentTarget.dataset.name }) },
  editCategory(event) { const index = Number(event.currentTarget.dataset.index); const name = this.data.categories[index]; this.setData({ editingCategoryIndex: index, categoryDraft: name, selectedCategoryColor: this.data.categoryColors[name] || '#728077' }) },
  chooseCategoryColor(event) { this.setData({ selectedCategoryColor: event.currentTarget.dataset.color }) },
  cancelCategoryEdit() { this.setData({ editingCategoryIndex: -1, categoryDraft: '' }) },
  async saveCategory() {
    const name = this.data.categoryDraft.trim()
    if (!name) return wx.showToast({ title: '请输入标签名称', icon: 'none' })
    if (this.data.categories.includes(name) && this.data.editingCategoryIndex < 0) return wx.showToast({ title: '标签已存在', icon: 'none' })
    try {
      if (this.data.editingCategoryIndex >= 0) { const oldName = this.data.categories[this.data.editingCategoryIndex]; await store.renameCategory(oldName, name); await store.setCategoryColor(name, this.data.selectedCategoryColor) }
      else await store.addCategory(name, this.data.selectedCategoryColor)
      await this.loadData(); this.setData({ editingCategoryIndex: -1, categoryDraft: '' }); wx.showToast({ title: '标签已保存' })
    } catch (error) { wx.showToast({ title: '标签保存失败', icon: 'none' }) }
  },
  deleteCategory(event) {
    const name = this.data.categories[Number(event.currentTarget.dataset.index)]
    if (this.data.categories.length <= 1) return wx.showToast({ title: '至少保留一个标签', icon: 'none' })
    wx.showModal({ title: `删除“${name}”`, content: '已建任务会保留原标签，但新任务不能再选择它。', success: async result => { if (!result.confirm) return; await store.deleteCategory(name); await this.loadData(); this.setData({ categoryIndex: 0 }) } })
  },
  async saveTask() {
    const name = this.data.form.name.trim()
    if (!name) return wx.showToast({ title: '请填写任务名称', icon: 'none' })
    if (!this.data.categories.length) return wx.showToast({ title: '请先新增标签', icon: 'none' })
    const payload = { category: this.data.categories[this.data.categoryIndex], name, description: this.data.form.description.trim(), progress: Number(this.data.form.progress || 0) }
    this.setData({ saving: true })
    try {
      if (this.data.editingId) await store.updateTask(this.data.editingId, payload); else await store.addTask(payload)
      wx.hideKeyboard(); this.setData({ showSheet: false, keyboardHeight: 0 }); await this.loadData(); wx.showToast({ title: this.data.editingId ? '已更新' : '已创建' })
    } catch (error) { wx.showToast({ title: '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  }
})
