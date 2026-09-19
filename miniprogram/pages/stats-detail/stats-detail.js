const store = require('../../utils/store')

Page({
  data: { type: 'records', start: '', end: '', value: '', title: '完成事项', caption: '', count: 0, countLabel: '条记录', fontSize: 30, recordItems: [], projectItems: [], dayItems: [] },
  onLoad(options) { this.setData({ type: options.type || 'records', start: options.start || '', end: options.end || '', value: decodeURIComponent(options.value || ''), fontSize: store.getSettings().fontSize || 30 }); this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [tasks, allRecords] = await Promise.all([store.listTasks(), store.listRecords()])
      const taskMap = tasks.reduce((map, task) => { map[task._id] = task; return map }, {})
      let records = allRecords.filter(item => item.recordDate >= this.data.start && item.recordDate <= this.data.end)
      const caption = `${this.data.start} 至 ${this.data.end}`
      if (this.data.type === 'projects') {
        const ids = [...new Set(records.filter(item => item.taskId).map(item => item.taskId))]
        const projectItems = ids.map(id => ({ ...taskMap[id], recordCount: records.filter(item => item.taskId === id).length })).filter(item => item._id)
        this.setData({ title: '推进项目明细', caption, projectItems, recordItems: [], dayItems: [], count: projectItems.length, countLabel: '个项目' })
      } else if (this.data.type === 'days') {
        const groups = {}; records.forEach(item => { groups[item.recordDate] = (groups[item.recordDate] || 0) + 1 })
        const dayItems = Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])).map(([date,count]) => ({ date, count }))
        this.setData({ title: '坚持记录明细', caption, dayItems, recordItems: [], projectItems: [], count: dayItems.length, countLabel: '个记录日' })
      } else {
        if (this.data.type === 'date') records = records.filter(item => item.recordDate === this.data.value)
        if (this.data.type === 'daterange') { const range = this.data.value.split('~'); records = records.filter(item => item.recordDate >= range[0] && item.recordDate <= range[1]) }
        if (this.data.type === 'category') records = records.filter(item => (item.taskId && taskMap[item.taskId] ? taskMap[item.taskId].name : '未关联任务') === this.data.value)
        if (this.data.type === 'tag') records = records.filter(item => (item.taskId && taskMap[item.taskId] ? taskMap[item.taskId].category : (item.category || '其他')) === this.data.value)
        const recordItems = records.map(item => ({ ...item, taskName: taskMap[item.taskId] && taskMap[item.taskId].name }))
        const title = this.data.type === 'date' ? `${this.data.value} 的记录` : this.data.type === 'daterange' ? `${this.data.value.replace('~', ' 至 ')} 的记录` : this.data.type === 'category' ? `${this.data.value} 任务明细` : this.data.type === 'tag' ? `${this.data.value} 标签明细` : '完成事项明细'
        this.setData({ title, caption, recordItems, projectItems: [], dayItems: [], count: recordItems.length, countLabel: '条记录' })
      }
      wx.setNavigationBarTitle({ title: this.data.title })
    } catch (error) { wx.showToast({ title: '加载失败', icon: 'none' }) }
  },
  openTask(event) { wx.navigateTo({ url: `/pages/task-detail/task-detail?id=${event.currentTarget.dataset.id}` }) },
  openRecordTask(event) { const id = event.currentTarget.dataset.task; if (id) wx.navigateTo({ url: `/pages/task-detail/task-detail?id=${id}` }) }
})
