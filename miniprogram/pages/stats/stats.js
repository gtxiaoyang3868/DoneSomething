const store = require('../../utils/store')
const { toDateKey, offsetDate, rangeKeys } = require('../../utils/date')

Page({
  data: {
    tasks: [], records: [], categoryColors: {}, period: 'week', breakdownMode: 'task', fontSize: 30, today: toDateKey(new Date()), startDate: toDateKey(offsetDate(new Date(), -14)), endDate: toDateKey(new Date()),
    summary: { title: '', copy: '', icon: '🌱', highlight: '', completed: 0, projects: 0, recordDays: 0, caption: '' }, bars: [], breakdownItems: [],
    showExport: false, exporting: false, exportType: 'excel', exportRanges: ['当前统计区间', '全部历史记录'], exportRangeIndex: 0, activeStart: '', activeEnd: ''
  },
  onShow() { this.setData({ fontSize: store.getSettings().fontSize || 30 }); this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try { const [tasks, records, categoryColors] = await Promise.all([store.listTasks(), store.listRecords(), store.getCategoryColors()]); this.setData({ tasks, records, categoryColors }); this.applyPreset(this.data.period === 'custom' ? 'week' : this.data.period) }
    catch (error) { wx.showToast({ title: '数据加载失败', icon: 'none' }) }
  },
  choosePeriod(event) { const period = event.currentTarget.dataset.period; this.setData({ period }); if (period !== 'custom') this.applyPreset(period) },
  applyPreset(period) { const end = new Date(); const start = offsetDate(end, period === 'week' ? -6 : -29); this.buildStats(toDateKey(start), toDateKey(end), period) },
  onDateChange(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  applyCustomRange() {
    if (this.data.endDate < this.data.startDate) return wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
    this.buildStats(this.data.startDate, this.data.endDate, 'custom')
  },
  makeBars(keys, records) {
    const buckets = []
    if (keys.length <= 7) keys.forEach(key => buckets.push({ start: key, end: key, label: key.slice(8) }))
    else {
      const size = Math.ceil(keys.length / 7)
      for (let index = 0; index < keys.length; index += size) { const part = keys.slice(index, index + size); buckets.push({ start: part[0], end: part[part.length - 1], label: part[0].slice(5).replace('-', '/') }) }
    }
    const values = buckets.map(bucket => records.filter(record => record.recordDate >= bucket.start && record.recordDate <= bucket.end).length)
    const maxCount = Math.max(1, ...values)
    return buckets.map((bucket, index) => ({ ...bucket, count: values[index], height: values[index] ? Math.max(16, Math.round(values[index] / maxCount * 88)) : 6, detailType: bucket.start === bucket.end ? 'date' : 'daterange', value: bucket.start === bucket.end ? bucket.start : `${bucket.start}~${bucket.end}` }))
  },
  makeBreakdown(records, taskMap, mode) {
    const groups = {}
    records.forEach(record => {
      const task = taskMap[record.taskId]
      const name = mode === 'task' ? (task ? task.name : '未关联任务') : (task ? task.category : (record.category || '其他'))
      if (!groups[name]) groups[name] = { name, count: 0, color: mode === 'tag' ? (this.data.categoryColors[name] || '#8e8e93') : (task ? (this.data.categoryColors[task.category] || '#207a4b') : '#8e8e93'), subtitle: mode === 'task' ? (task ? task.category : '独立记录') : '分类标签' }
      groups[name].count += 1
    })
    return Object.values(groups).sort((a, b) => b.count - a.count).map(item => ({ ...item, initial: (item.name || '其').slice(0, 1), percent: records.length ? Math.max(6, Math.round(item.count / records.length * 100)) : 0, detailType: mode === 'task' ? 'category' : 'tag' }))
  },
  buildStats(start, end, period) {
    const keys = rangeKeys(start, end); const keySet = new Set(keys); const records = this.data.records.filter(record => keySet.has(record.recordDate))
    const taskMap = this.data.tasks.reduce((map, task) => { map[task._id] = task; return map }, {})
    const projectCount = new Set(records.filter(item => item.taskId).map(item => item.taskId)).size
    const recordDays = new Set(records.map(item => item.recordDate)).size
    const days = keys.length
    const bars = this.makeBars(keys, records)
    const breakdownItems = this.makeBreakdown(records, taskMap, this.data.breakdownMode)
    const taskCounts = {}; const dateCounts = {}
    records.forEach(record => { const taskName = taskMap[record.taskId] ? taskMap[record.taskId].name : '未关联任务'; taskCounts[taskName] = (taskCounts[taskName] || 0) + 1; dateCounts[record.recordDate] = (dateCounts[record.recordDate] || 0) + 1 })
    const topTask = Object.entries(taskCounts).sort((a,b) => b[1] - a[1])[0]
    const peakDay = Object.entries(dateCounts).sort((a,b) => b[1] - a[1])[0]
    const caption = `${start.slice(5).replace('-', '月')}日—${end.slice(5).replace('-', '月')}日`
    const score = records.length + recordDays * 1.5 + projectCount
    const highLine = days <= 7 ? 9 : Math.max(12, days * .75)
    let title; let copy; let icon
    if (!records.length) { title = '这段留白，也值得被温柔对待'; copy = '今天记录一件小事，就是重新出发'; icon = '🌱' }
    else if (score >= highLine) { title = period === 'month' ? '这个月，你把日子过得很有分量' : '这段时间，你过得很充实'; copy = `${recordDays} 天有行动，推进了 ${projectCount} 个任务`; icon = '🏆' }
    else if (score >= 4) { title = '你正在认真地推进生活'; copy = `已经完成 ${records.length} 件事，每一次行动都算数`; icon = '✨' }
    else { title = '小小一步，也是向前'; copy = '不用追赶别人，保持自己的节奏就很好'; icon = '🌿' }
    const highlight = records.length ? `最投入：${topTask[0]} ${topTask[1]} 件 · 高峰日：${peakDay[0].slice(5).replace('-', '月')}日 ${peakDay[1]} 件` : '可以先记录：今天完成的一件小事、一次阅读或一次休息'
    this.setData({ activeStart: start, activeEnd: end, summary: { title, copy, icon, highlight, completed: records.length, projects: projectCount, recordDays, caption }, bars, breakdownItems })
  },
  chooseBreakdown(event) { const breakdownMode = event.currentTarget.dataset.mode; this.setData({ breakdownMode }); this.buildStats(this.data.activeStart, this.data.activeEnd, this.data.period) },
  openExport() { this.setData({ showExport: true }) }, closeExport() { this.setData({ showExport: false }) }, stopPropagation() {},
  openSettings() { wx.navigateTo({ url: '/pages/settings/settings' }) },
  openStatDetail(event) { const type = event.currentTarget.dataset.type; const value = event.currentTarget.dataset.value || ''; wx.navigateTo({ url: `/pages/stats-detail/stats-detail?type=${type}&start=${this.data.activeStart}&end=${this.data.activeEnd}&value=${encodeURIComponent(value)}` }) },
  chooseExportType(event) { this.setData({ exportType: event.currentTarget.dataset.type }) },
  onExportRangeChange(event) { this.setData({ exportRangeIndex: Number(event.detail.value) }) },
  exportRows() {
    const records = this.data.exportRangeIndex === 0 ? this.data.records.filter(item => item.recordDate >= this.data.activeStart && item.recordDate <= this.data.activeEnd) : this.data.records
    const taskMap = this.data.tasks.reduce((map, task) => { map[task._id] = task; return map }, {})
    return [['日期','分类','关联任务','完成内容','内容描述','任务进度'], ...records.map(item => [item.recordDate, item.category || '', taskMap[item.taskId] ? taskMap[item.taskId].name : '', item.title, item.description || '', item.progressAfter === null || item.progressAfter === undefined ? '' : `${item.progressAfter}%`])]
  },
  async confirmExport() {
    this.setData({ exporting: true })
    try {
      const rows = this.exportRows()
      if (this.data.exportType === 'excel') await this.createExcel(rows)
      else {
        if (!getApp().globalData.useCloud) throw new Error('请先启用云开发并配置飞书应用')
        const result = await wx.cloud.callFunction({ name: 'syncFeishu', data: { rows, title: `每日轨迹 ${this.data.summary.caption}` } })
        if (!result.result || !result.result.ok) throw new Error((result.result && result.result.message) || '飞书同步失败')
        wx.showModal({ title: '已导出到飞书', content: result.result.url || '飞书表格创建成功', showCancel: false })
      }
      this.setData({ showExport: false })
    } catch (error) { wx.showModal({ title: '导出未完成', content: error.message || '请稍后重试', showCancel: false }) }
    finally { this.setData({ exporting: false }) }
  },
  createExcel(rows) {
    const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const body = rows.map(row => `<Row>${row.map(cell => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`).join('')
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="每日轨迹"><Table>${body}</Table></Worksheet></Workbook>`
    const path = `${wx.env.USER_DATA_PATH}/每日轨迹-${Date.now()}.xls`
    return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath: path, data: xml, encoding: 'utf8', success: () => wx.openDocument({ filePath: path, fileType: 'xls', showMenu: true, success: resolve, fail: reject }), fail: reject }))
  }
})
