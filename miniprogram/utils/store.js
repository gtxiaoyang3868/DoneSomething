const { toDateKey } = require('./date')

const TASKS_KEY = 'daily_track_tasks'
const RECORDS_KEY = 'daily_track_records'
const CATEGORIES_KEY = 'daily_track_categories'
const CATEGORY_COLORS_KEY = 'daily_track_category_colors'
const HABIT_CATEGORIES_KEY = 'daily_track_habit_categories'
const HABIT_CATEGORY_COLORS_KEY = 'daily_track_habit_category_colors'
const PROFILE_KEY = 'daily_track_profile'
const SETTINGS_KEY = 'daily_track_settings'
const CHECKINS_KEY = 'daily_track_checkins'
const CHECKIN_LOGS_KEY = 'daily_track_checkin_logs'
const seedCategories = ['工作', '成长', '生活', '其他']
const seedCategoryColors = { '工作': '#3f8f70', '成长': '#d88a3d', '生活': '#7b78b8', '其他': '#728077' }

const seedTasks = [
  { _id: 'task-miniapp', category: '工作', name: '微信小程序改版', description: '完成核心页面设计与开发联调', progress: 65, status: 'active', createdAt: '2026-08-01' },
  { _id: 'task-research', category: '工作', name: '用户研究', description: '完成访谈、整理洞察并输出报告', progress: 40, status: 'active', createdAt: '2026-08-04' },
  { _id: 'task-reading', category: '成长', name: '年度阅读计划', description: '阅读 20 本产品与心理学书籍', progress: 25, status: 'active', createdAt: '2026-07-20' }
]

const seedRecords = [
  { _id: 'r1', taskId: 'task-miniapp', category: '工作', title: '完成数据统计页面', description: '完成图表组件与空状态设计', progressAfter: 65, recordDate: toDateKey(new Date()) },
  { _id: 'r2', taskId: '', category: '成长', title: '阅读 30 分钟', description: '《设计心理学》第三章笔记', progressAfter: null, recordDate: toDateKey(new Date()) },
  { _id: 'r3', taskId: 'task-research', category: '工作', title: '整理用户访谈结论', description: '归纳出 4 个高频问题', progressAfter: 40, recordDate: toDateKey(new Date()) }
]

const ensureSeed = () => {
  if (!wx.getStorageSync(TASKS_KEY)) wx.setStorageSync(TASKS_KEY, seedTasks)
  if (!wx.getStorageSync(RECORDS_KEY)) wx.setStorageSync(RECORDS_KEY, seedRecords)
  if (!wx.getStorageSync(CATEGORIES_KEY)) wx.setStorageSync(CATEGORIES_KEY, seedCategories)
  if (!wx.getStorageSync(CATEGORY_COLORS_KEY)) wx.setStorageSync(CATEGORY_COLORS_KEY, seedCategoryColors)
}

const local = {
  async listHabitCategories() { return wx.getStorageSync(HABIT_CATEGORIES_KEY) || [] },
  async getHabitCategoryColors() { return wx.getStorageSync(HABIT_CATEGORY_COLORS_KEY) || {} },
  async addHabitCategory(name, color = '#3f8f70') { const categories = await this.listHabitCategories(); if (!categories.includes(name)) categories.push(name); const colors = await this.getHabitCategoryColors(); colors[name] = color; wx.setStorageSync(HABIT_CATEGORIES_KEY, categories); wx.setStorageSync(HABIT_CATEGORY_COLORS_KEY, colors); return categories },
  async renameHabitCategory(oldName, newName) { const categories = (await this.listHabitCategories()).map(name => name === oldName ? newName : name); const colors = await this.getHabitCategoryColors(); colors[newName] = colors[oldName] || '#3f8f70'; delete colors[oldName]; const items = (await this.listCheckinTasks()).map(item => item.category === oldName ? { ...item, category: newName } : item); wx.setStorageSync(HABIT_CATEGORIES_KEY, [...new Set(categories)]); wx.setStorageSync(HABIT_CATEGORY_COLORS_KEY, colors); wx.setStorageSync(CHECKINS_KEY, items); return categories },
  async deleteHabitCategory(name) { const categories = (await this.listHabitCategories()).filter(item => item !== name); const colors = await this.getHabitCategoryColors(); delete colors[name]; wx.setStorageSync(HABIT_CATEGORIES_KEY, categories); wx.setStorageSync(HABIT_CATEGORY_COLORS_KEY, colors); return categories },
  async setHabitCategoryColor(name, color) { const colors = await this.getHabitCategoryColors(); colors[name] = color; wx.setStorageSync(HABIT_CATEGORY_COLORS_KEY, colors); return colors },
  async listCheckinTasks() { return wx.getStorageSync(CHECKINS_KEY) || [] },
  async listCheckinLogs(checkinId = '') { const logs = wx.getStorageSync(CHECKIN_LOGS_KEY) || []; return checkinId ? logs.filter(item => item.checkinId === checkinId) : logs },
  async addCheckinTask(data) { const items = await this.listCheckinTasks(); const item = { ...data, _id: `checkin-${Date.now()}`, currentCount: 0, status: 'active', visibility: data.visibility || 'private', createdAt: Date.now() }; items.unshift(item); wx.setStorageSync(CHECKINS_KEY, items); return item },
  async updateCheckinTask(id, updates) { const items = await this.listCheckinTasks(); const next = items.map(item => item._id === id ? { ...item, ...updates, updatedAt: Date.now() } : item); wx.setStorageSync(CHECKINS_KEY, next); return next.find(item => item._id === id) },
  async deleteCheckinTask(id) { const items = await this.listCheckinTasks(); const logs = await this.listCheckinLogs(); wx.setStorageSync(CHECKINS_KEY, items.filter(item => item._id !== id)); wx.setStorageSync(CHECKIN_LOGS_KEY, logs.filter(item => item.checkinId !== id)) },
  async addCheckinLog(data) { const logs = await this.listCheckinLogs(); const item = { ...data, _id: `checkin-log-${Date.now()}`, createdAt: Date.now() }; logs.unshift(item); wx.setStorageSync(CHECKIN_LOGS_KEY, logs); const tasks = await this.listCheckinTasks(); const next = tasks.map(task => { if (task._id !== data.checkinId) return task; const currentCount = Number(task.currentCount || 0) + 1; return { ...task, currentCount, status: currentCount >= Number(task.targetCount || 1) ? 'completed' : 'active', updatedAt: Date.now() } }); wx.setStorageSync(CHECKINS_KEY, next); return item },
  async deleteCheckinLog(id) { const logs = await this.listCheckinLogs(); const removed = logs.find(item => item._id === id); wx.setStorageSync(CHECKIN_LOGS_KEY, logs.filter(item => item._id !== id)); if (removed) { const tasks = await this.listCheckinTasks(); wx.setStorageSync(CHECKINS_KEY, tasks.map(task => task._id === removed.checkinId ? { ...task, currentCount: Math.max(0, Number(task.currentCount || 0) - 1), status: 'active', updatedAt: Date.now() } : task)) } },
  async listTasks() { ensureSeed(); return wx.getStorageSync(TASKS_KEY) || [] },
  async listRecords() { ensureSeed(); return wx.getStorageSync(RECORDS_KEY) || [] },
  async addTask(task) {
    const tasks = await this.listTasks()
    const item = { ...task, _id: `task-${Date.now()}`, createdAt: toDateKey(new Date()), status: 'active', progress: Number(task.progress || 0) }
    tasks.unshift(item); wx.setStorageSync(TASKS_KEY, tasks); return item
  },
  async updateTask(id, updates) {
    const tasks = await this.listTasks()
    const next = tasks.map(task => task._id === id ? { ...task, ...updates, progress: Number(updates.progress) } : task)
    wx.setStorageSync(TASKS_KEY, next)
    return next.find(task => task._id === id)
  },
  async deleteTask(id) {
    const tasks = await this.listTasks()
    const records = await this.listRecords()
    wx.setStorageSync(TASKS_KEY, tasks.filter(task => task._id !== id))
    wx.setStorageSync(RECORDS_KEY, records.filter(record => record.taskId !== id))
  },
  async addRecord(record) {
    const records = await this.listRecords()
    const item = { ...record, _id: `record-${Date.now()}`, createdAt: Date.now() }
    records.unshift(item); wx.setStorageSync(RECORDS_KEY, records)
    if (record.taskId && record.progressAfter !== null && record.progressAfter !== undefined) {
      const tasks = await this.listTasks()
      const next = tasks.map(task => task._id === record.taskId ? { ...task, progress: Number(record.progressAfter) } : task)
      wx.setStorageSync(TASKS_KEY, next)
    }
    return item
  },
  async updateRecord(id, updates) {
    const records = await this.listRecords()
    const next = records.map(record => record._id === id ? { ...record, ...updates } : record)
    wx.setStorageSync(RECORDS_KEY, next)
    if (updates.taskId && updates.progressAfter !== null && updates.progressAfter !== undefined) {
      const tasks = await this.listTasks()
      wx.setStorageSync(TASKS_KEY, tasks.map(task => task._id === updates.taskId ? { ...task, progress: Number(updates.progressAfter) } : task))
    }
    return next.find(record => record._id === id)
  },
  async deleteRecord(id) {
    const records = await this.listRecords()
    wx.setStorageSync(RECORDS_KEY, records.filter(record => record._id !== id))
  },
  async listCategories() { ensureSeed(); return wx.getStorageSync(CATEGORIES_KEY) || [] },
  async addCategory(name, color = '#3f8f70') { const categories = await this.listCategories(); if (!categories.includes(name)) categories.push(name); wx.setStorageSync(CATEGORIES_KEY, categories); const colors = wx.getStorageSync(CATEGORY_COLORS_KEY) || {}; colors[name] = color; wx.setStorageSync(CATEGORY_COLORS_KEY, colors); return categories },
  async renameCategory(oldName, newName) {
    const categories = (await this.listCategories()).map(name => name === oldName ? newName : name)
    const tasks = (await this.listTasks()).map(task => task.category === oldName ? { ...task, category: newName } : task)
    const records = (await this.listRecords()).map(record => record.category === oldName ? { ...record, category: newName } : record)
    const colors = wx.getStorageSync(CATEGORY_COLORS_KEY) || {}; colors[newName] = colors[oldName] || '#3f8f70'; delete colors[oldName]
    wx.setStorageSync(CATEGORIES_KEY, [...new Set(categories)]); wx.setStorageSync(CATEGORY_COLORS_KEY, colors); wx.setStorageSync(TASKS_KEY, tasks); wx.setStorageSync(RECORDS_KEY, records)
    return categories
  },
  async deleteCategory(name) { const categories = (await this.listCategories()).filter(item => item !== name); const colors = wx.getStorageSync(CATEGORY_COLORS_KEY) || {}; delete colors[name]; wx.setStorageSync(CATEGORY_COLORS_KEY, colors); wx.setStorageSync(CATEGORIES_KEY, categories); return categories },
  async getCategoryColors() { ensureSeed(); return wx.getStorageSync(CATEGORY_COLORS_KEY) || seedCategoryColors },
  async setCategoryColor(name, color) { const colors = await this.getCategoryColors(); colors[name] = color; wx.setStorageSync(CATEGORY_COLORS_KEY, colors); return colors }
}

const cloud = {
  db() { return wx.cloud.database() },
  async listTasks() { const res = await this.db().collection('tasks').orderBy('createdAt', 'desc').get(); return res.data },
  async listHabitCategories() { const res = await this.db().collection('categories').where({ kind: 'habit' }).orderBy('order', 'asc').get(); return res.data.map(item => item.name) },
  async getHabitCategoryColors() { const res = await this.db().collection('categories').where({ kind: 'habit' }).get(); const colors = {}; res.data.forEach(item => { colors[item.name] = item.color || '#728077' }); return colors },
  async addHabitCategory(name, color) { await this.db().collection('categories').add({ data: { name, color: color || '#3f8f70', kind: 'habit', order: Date.now() } }); return this.listHabitCategories() },
  async renameHabitCategory(oldName, newName) { const found = await this.db().collection('categories').where({ name: oldName, kind: 'habit' }).get(); if (found.data[0]) await this.db().collection('categories').doc(found.data[0]._id).update({ data: { name: newName } }); await this.db().collection('checkinTasks').where({ category: oldName }).update({ data: { category: newName } }); return this.listHabitCategories() },
  async deleteHabitCategory(name) { const found = await this.db().collection('categories').where({ name, kind: 'habit' }).get(); if (found.data[0]) await this.db().collection('categories').doc(found.data[0]._id).remove(); return this.listHabitCategories() },
  async setHabitCategoryColor(name, color) { const found = await this.db().collection('categories').where({ name, kind: 'habit' }).get(); if (found.data[0]) await this.db().collection('categories').doc(found.data[0]._id).update({ data: { color } }); return this.getHabitCategoryColors() },
  async listCheckinTasks() { const res = await this.db().collection('checkinTasks').orderBy('createdAt', 'desc').get(); return res.data },
  async listCheckinLogs(checkinId = '') { const collection = this.db().collection('checkinLogs'); const res = checkinId ? await collection.where({ checkinId }).orderBy('createdAt', 'desc').get() : await collection.orderBy('createdAt', 'desc').get(); return res.data },
  async addCheckinTask(data) { const item = { ...data, currentCount: 0, status: 'active', visibility: data.visibility || 'private', createdAt: this.db().serverDate() }; const res = await this.db().collection('checkinTasks').add({ data: item }); return { ...item, _id: res._id } },
  async updateCheckinTask(id, updates) { await this.db().collection('checkinTasks').doc(id).update({ data: { ...updates, updatedAt: this.db().serverDate() } }); return { ...updates, _id: id } },
  async deleteCheckinTask(id) { const logs = await this.db().collection('checkinLogs').where({ checkinId: id }).limit(100).get(); await Promise.all(logs.data.map(item => this.db().collection('checkinLogs').doc(item._id).remove())); await this.db().collection('checkinTasks').doc(id).remove() },
  async addCheckinLog(data) { const res = await this.db().collection('checkinLogs').add({ data: { ...data, createdAt: this.db().serverDate() } }); const task = (await this.db().collection('checkinTasks').doc(data.checkinId).get()).data; const currentCount = Number(task.currentCount || 0) + 1; await this.db().collection('checkinTasks').doc(data.checkinId).update({ data: { currentCount, status: currentCount >= Number(task.targetCount || 1) ? 'completed' : 'active', updatedAt: this.db().serverDate() } }); return { ...data, _id: res._id } },
  async deleteCheckinLog(id) { const log = (await this.db().collection('checkinLogs').doc(id).get()).data; await this.db().collection('checkinLogs').doc(id).remove(); const task = (await this.db().collection('checkinTasks').doc(log.checkinId).get()).data; await this.db().collection('checkinTasks').doc(log.checkinId).update({ data: { currentCount: Math.max(0, Number(task.currentCount || 0) - 1), status: 'active', updatedAt: this.db().serverDate() } }) },
  async listRecords() {
    const collection = this.db().collection('dailyRecords')
    const pageSize = 20
    const records = []
    let page = 0
    while (true) {
      const res = await collection.orderBy('recordDate', 'desc').skip(page * pageSize).limit(pageSize).get()
      records.push(...res.data)
      if (res.data.length < pageSize) break
      page += 1
    }
    return records
  },
  async addTask(task) { const item = { ...task, createdAt: this.db().serverDate(), status: 'active', progress: Number(task.progress || 0) }; const res = await this.db().collection('tasks').add({ data: item }); return { ...item, _id: res._id } },
  async updateTask(id, updates) { await this.db().collection('tasks').doc(id).update({ data: { ...updates, progress: Number(updates.progress), updatedAt: this.db().serverDate() } }); return { ...updates, _id: id } },
  async deleteTask(id) {
    const collection = this.db().collection('dailyRecords')
    while (true) {
      const res = await collection.where({ taskId: id }).limit(20).get()
      if (!res.data.length) break
      await Promise.all(res.data.map(record => collection.doc(record._id).remove()))
    }
    await this.db().collection('tasks').doc(id).remove()
  },
  async addRecord(record) {
    const res = await this.db().collection('dailyRecords').add({ data: { ...record, createdAt: this.db().serverDate() } })
    if (record.taskId && record.progressAfter !== null && record.progressAfter !== undefined) await this.db().collection('tasks').doc(record.taskId).update({ data: { progress: Number(record.progressAfter), updatedAt: this.db().serverDate() } })
    return { ...record, _id: res._id }
  },
  async updateRecord(id, updates) {
    await this.db().collection('dailyRecords').doc(id).update({ data: { ...updates, updatedAt: this.db().serverDate() } })
    if (updates.taskId && updates.progressAfter !== null && updates.progressAfter !== undefined) await this.db().collection('tasks').doc(updates.taskId).update({ data: { progress: Number(updates.progressAfter), updatedAt: this.db().serverDate() } })
    return { ...updates, _id: id }
  },
  async deleteRecord(id) { await this.db().collection('dailyRecords').doc(id).remove() },
  async listCategories() {
    const res = await this.db().collection('categories').orderBy('order', 'asc').get()
    if (res.data.length) return res.data.map(item => item.name)
    await Promise.all(seedCategories.map((name, order) => this.db().collection('categories').add({ data: { name, order } })))
    return seedCategories
  },
  async addCategory(name) { await this.db().collection('categories').add({ data: { name, order: Date.now() } }); return this.listCategories() },
  async renameCategory(oldName, newName) {
    const found = await this.db().collection('categories').where({ name: oldName }).get()
    if (found.data[0]) await this.db().collection('categories').doc(found.data[0]._id).update({ data: { name: newName } })
    await this.db().collection('tasks').where({ category: oldName }).update({ data: { category: newName } })
    await this.db().collection('dailyRecords').where({ category: oldName }).update({ data: { category: newName } })
    return this.listCategories()
  },
  async deleteCategory(name) { const found = await this.db().collection('categories').where({ name }).get(); if (found.data[0]) await this.db().collection('categories').doc(found.data[0]._id).remove(); return this.listCategories() }
}

const syncedCloud = {
  async call(action, payload = {}) {
    const response = await wx.cloud.callFunction({ name: 'accountSync', data: { action, ...payload } })
    const result = response.result || {}
    if (!result.ok) throw new Error(result.message || '云端数据操作失败')
    return result.data
  },
  listTasks() { return this.call('listTasks') },
  async listHabitCategories() { try { return await this.call('listHabitCategories') } catch (error) { if (String(error.message).includes('不支持')) return []; throw error } },
  async getHabitCategoryColors() { try { return await this.call('getHabitCategoryColors') } catch (error) { if (String(error.message).includes('不支持')) return {}; throw error } },
  addHabitCategory(name, color) { return this.call('addHabitCategory', { name, color }) },
  renameHabitCategory(oldName, newName) { return this.call('renameHabitCategory', { oldName, newName }) },
  deleteHabitCategory(name) { return this.call('deleteHabitCategory', { name }) },
  setHabitCategoryColor(name, color) { return this.call('setHabitCategoryColor', { name, color }) },
  listCheckinTasks() { return this.call('listCheckinTasks') },
  listCheckinLogs(checkinId = '') { return this.call('listCheckinLogs', { checkinId }) },
  addCheckinTask(data) { return this.call('addCheckinTask', { data }) },
  updateCheckinTask(id, data) { return this.call('updateCheckinTask', { id, data }) },
  deleteCheckinTask(id) { return this.call('deleteCheckinTask', { id }) },
  addCheckinLog(data) { return this.call('addCheckinLog', { data }) },
  deleteCheckinLog(id) { return this.call('deleteCheckinLog', { id }) },
  listRecords() { return this.call('listRecords') },
  listCategories() { return this.call('listCategories') },
  getCategoryColors() { return this.call('getCategoryColors') },
  addTask(data) { return this.call('addTask', { data }) },
  updateTask(id, data) { return this.call('updateTask', { id, data }) },
  deleteTask(id) { return this.call('deleteTask', { id }) },
  addRecord(data) { return this.call('addRecord', { data }) },
  updateRecord(id, data) { return this.call('updateRecord', { id, data }) },
  deleteRecord(id) { return this.call('deleteRecord', { id }) },
  async addCategory(name, color) { await this.call('addCategory', { name, color }); return this.listCategories() },
  async renameCategory(oldName, newName) { await this.call('renameCategory', { oldName, newName }); return this.listCategories() },
  async deleteCategory(name) { await this.call('deleteCategory', { name }); return this.listCategories() },
  async setCategoryColor(name, color) { await this.call('setCategoryColor', { name, color }); return this.getCategoryColors() }
}

const adapter = () => getApp().globalData.useCloud ? syncedCloud : local
module.exports = {
  listHabitCategories: () => adapter().listHabitCategories(),
  getHabitCategoryColors: () => adapter().getHabitCategoryColors(),
  addHabitCategory: (name, color) => adapter().addHabitCategory(name, color),
  renameHabitCategory: (oldName, newName) => adapter().renameHabitCategory(oldName, newName),
  deleteHabitCategory: name => adapter().deleteHabitCategory(name),
  setHabitCategoryColor: (name, color) => adapter().setHabitCategoryColor(name, color),
  listCheckinTasks: () => adapter().listCheckinTasks(),
  listCheckinLogs: checkinId => adapter().listCheckinLogs(checkinId),
  addCheckinTask: data => adapter().addCheckinTask(data),
  updateCheckinTask: (id, data) => adapter().updateCheckinTask(id, data),
  deleteCheckinTask: id => adapter().deleteCheckinTask(id),
  addCheckinLog: data => adapter().addCheckinLog(data),
  deleteCheckinLog: id => adapter().deleteCheckinLog(id),
  listTasks: () => adapter().listTasks(),
  listRecords: () => adapter().listRecords(),
  listCategories: () => adapter().listCategories(),
  addTask: task => adapter().addTask(task),
  updateTask: (id, updates) => adapter().updateTask(id, updates),
  deleteTask: id => adapter().deleteTask(id),
  addRecord: record => adapter().addRecord(record),
  updateRecord: (id, updates) => adapter().updateRecord(id, updates),
  deleteRecord: id => adapter().deleteRecord(id),
  addCategory: (name, color) => adapter().addCategory(name, color),
  renameCategory: (oldName, newName) => adapter().renameCategory(oldName, newName),
  deleteCategory: name => adapter().deleteCategory(name),
  getCategoryColors: () => adapter().getCategoryColors(),
  setCategoryColor: (name, color) => adapter().setCategoryColor(name, color),
  getProfile: () => wx.getStorageSync(PROFILE_KEY) || { avatar: '', nickname: '', gender: '', birthday: '', city: '', bio: '' },
  saveProfile: profile => wx.setStorageSync(PROFILE_KEY, profile),
  getSettings: () => wx.getStorageSync(SETTINGS_KEY) || { fontSize: 30 },
  saveSettings: settings => wx.setStorageSync(SETTINGS_KEY, settings)
}
