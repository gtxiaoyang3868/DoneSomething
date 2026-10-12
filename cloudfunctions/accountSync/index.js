const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const ALL_SCOPES = ['tasks', 'records', 'categories', 'checkins']

const collectionName = type => ({ tasks: 'tasks', records: 'dailyRecords', categories: 'categories', checkins: 'checkinTasks', checkinLogs: 'checkinLogs' }[type])
const makeCode = () => String(Math.floor(100000 + Math.random() * 900000))
const uniqueDocs = docs => [...new Map(docs.map(item => [item._id, item])).values()]

async function getContext(openid) {
  const links = await db.collection('accountLinks').where({ openid }).limit(1).get()
  if (!links.data[0]) return { linked: false, openid, members: [{ openid, name: '当前微信' }], scopes: ALL_SCOPES, ownerOpenid: openid }
  const groupRes = await db.collection('syncGroups').doc(links.data[0].groupId).get()
  const group = groupRes.data
  return { linked: true, openid, linkId: links.data[0]._id, groupId: group._id, members: group.members || [], scopes: group.scopes || ALL_SCOPES, ownerOpenid: group.ownerOpenid, code: group.code, expireAt: group.expireAt }
}

function allowedOpenids(ctx, type) {
  const scope = type === 'checkinLogs' ? 'checkins' : type
  if (ctx.linked && ctx.scopes.includes(scope)) return ctx.members.map(item => item.openid)
  return [ctx.openid]
}

async function listData(ctx, type) {
  const name = collectionName(type)
  const openids = allowedOpenids(ctx, type)
  const [owned, legacy] = await Promise.all([
    db.collection(name).where({ ownerOpenid: _.in(openids) }).limit(1000).get(),
    db.collection(name).where({ _openid: _.in(openids) }).limit(1000).get()
  ])
  return uniqueDocs([...owned.data, ...legacy.data])
}

async function assertWritable(ctx, type, id) {
  const doc = (await db.collection(collectionName(type)).doc(id).get()).data
  const owner = doc.ownerOpenid || doc._openid
  if (!allowedOpenids(ctx, type).includes(owner)) throw new Error('没有权限修改这条数据')
  return doc
}

async function handleLink(action, event, ctx) {
  if (action === 'status') return { ok: true, linked: ctx.linked, groupId: ctx.groupId || '', owner: ctx.ownerOpenid === ctx.openid, members: ctx.members.map(item => ({ name: item.name, current: item.openid === ctx.openid })), scopes: ctx.scopes, code: ctx.code || '', expireAt: ctx.expireAt || 0 }
  if (action === 'createGroup') {
    if (ctx.linked) throw new Error('当前微信已加入联动组')
    const scopes = Array.isArray(event.scopes) && event.scopes.length ? event.scopes.filter(item => ALL_SCOPES.includes(item)) : ALL_SCOPES
    const code = makeCode(); const expireAt = Date.now() + 10 * 60 * 1000
    const groupRes = await db.collection('syncGroups').add({ data: { ownerOpenid: ctx.openid, members: [{ openid: ctx.openid, name: event.accountName || '主账号' }], scopes, code, expireAt, createdAt: db.serverDate() } })
    await db.collection('accountLinks').add({ data: { openid: ctx.openid, groupId: groupRes._id, createdAt: db.serverDate() } })
    return { ok: true, code, expireAt }
  }
  if (action === 'joinGroup') {
    if (ctx.linked) throw new Error('当前微信已加入联动组')
    const found = await db.collection('syncGroups').where({ code: String(event.code || '').trim() }).limit(1).get()
    const group = found.data[0]
    if (!group || group.expireAt < Date.now()) throw new Error('联动码不存在或已过期')
    if ((group.members || []).length >= 5) throw new Error('一个联动组最多支持 5 个微信账号')
    const members = [...(group.members || []), { openid: ctx.openid, name: event.accountName || `微信账号${group.members.length + 1}` }]
    await db.collection('syncGroups').doc(group._id).update({ data: { members, updatedAt: db.serverDate() } })
    await db.collection('accountLinks').add({ data: { openid: ctx.openid, groupId: group._id, createdAt: db.serverDate() } })
    return { ok: true }
  }
  if (action === 'updateScopes') {
    if (!ctx.linked || ctx.ownerOpenid !== ctx.openid) throw new Error('只有联动组创建者可以修改同步范围')
    const scopes = (event.scopes || []).filter(item => ALL_SCOPES.includes(item))
    if (!scopes.length) throw new Error('请至少选择一类同步数据')
    await db.collection('syncGroups').doc(ctx.groupId).update({ data: { scopes, updatedAt: db.serverDate() } })
    return { ok: true }
  }
  if (action === 'refreshCode') {
    if (!ctx.linked || ctx.ownerOpenid !== ctx.openid) throw new Error('只有联动组创建者可以生成联动码')
    const code = makeCode(); const expireAt = Date.now() + 10 * 60 * 1000
    await db.collection('syncGroups').doc(ctx.groupId).update({ data: { code, expireAt } })
    return { ok: true, code, expireAt }
  }
  if (action === 'unlink') {
    if (!ctx.linked) return { ok: true }
    if (ctx.ownerOpenid === ctx.openid && ctx.members.length > 1) throw new Error('主账号需先让其他账号退出联动')
    const members = ctx.members.filter(item => item.openid !== ctx.openid)
    await db.collection('accountLinks').doc(ctx.linkId).remove()
    if (!members.length) await db.collection('syncGroups').doc(ctx.groupId).remove()
    else await db.collection('syncGroups').doc(ctx.groupId).update({ data: { members } })
    return { ok: true }
  }
  return null
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  try {
    const ctx = await getContext(OPENID)
    const linkResult = await handleLink(action, event, ctx)
    if (linkResult) return linkResult
    if (action === 'listTasks') return { ok: true, data: (await listData(ctx, 'tasks')).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) }
    if (action === 'listRecords') return { ok: true, data: (await listData(ctx, 'records')).sort((a, b) => String(b.recordDate || '').localeCompare(String(a.recordDate || ''))) }
    if (action === 'listCheckinTasks') return { ok: true, data: (await listData(ctx, 'checkins')).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) }
    if (action === 'listCheckinLogs') { const logs = await listData(ctx, 'checkinLogs'); return { ok: true, data: logs.filter(item => !event.checkinId || item.checkinId === event.checkinId).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) } }
    if (action === 'listCategories') {
      const categories = (await listData(ctx, 'categories')).filter(item => item.kind !== 'habit')
      if (!categories.length) {
        const seeds = [['工作','#3f8f70'],['成长','#d88a3d'],['生活','#7b78b8'],['其他','#728077']]
        for (const [order, item] of seeds.entries()) await db.collection('categories').add({ data: { ownerOpenid: OPENID, name: item[0], color: item[1], order } })
        return { ok: true, data: ['工作', '成长', '生活', '其他'] }
      }
      return { ok: true, data: [...new Set(categories.map(item => item.name))] }
    }
    if (action === 'getCategoryColors') { const categories = (await listData(ctx, 'categories')).filter(item => item.kind !== 'habit'); const colors = {}; categories.forEach(item => { if (!colors[item.name]) colors[item.name] = item.color || '#728077' }); return { ok: true, data: colors } }
    if (action === 'listHabitCategories') { const categories = (await listData(ctx, 'categories')).filter(item => item.kind === 'habit'); return { ok: true, data: [...new Set(categories.map(item => item.name))] } }
    if (action === 'getHabitCategoryColors') { const categories = (await listData(ctx, 'categories')).filter(item => item.kind === 'habit'); const colors = {}; categories.forEach(item => { if (!colors[item.name]) colors[item.name] = item.color || '#728077' }); return { ok: true, data: colors } }
    if (action === 'addTask') { const res = await db.collection('tasks').add({ data: { ...event.data, ownerOpenid: OPENID, createdAt: db.serverDate(), status: 'active', progress: Number(event.data.progress || 0) } }); return { ok: true, data: { ...event.data, _id: res._id } } }
    if (action === 'updateTask') { await assertWritable(ctx, 'tasks', event.id); await db.collection('tasks').doc(event.id).update({ data: { ...event.data, progress: Number(event.data.progress), updatedAt: db.serverDate() } }); return { ok: true } }
    if (action === 'deleteTask') {
      await assertWritable(ctx, 'tasks', event.id)
      const records = await listData(ctx, 'records')
      for (const record of records.filter(item => item.taskId === event.id)) await db.collection('dailyRecords').doc(record._id).remove()
      await db.collection('tasks').doc(event.id).remove()
      return { ok: true }
    }
    if (action === 'addRecord') {
      const res = await db.collection('dailyRecords').add({ data: { ...event.data, ownerOpenid: OPENID, createdAt: db.serverDate() } })
      if (event.data.taskId && event.data.progressAfter !== null && event.data.progressAfter !== undefined) { await assertWritable(ctx, 'tasks', event.data.taskId); await db.collection('tasks').doc(event.data.taskId).update({ data: { progress: Number(event.data.progressAfter), updatedAt: db.serverDate() } }) }
      return { ok: true, data: { ...event.data, _id: res._id } }
    }
    if (action === 'updateRecord') {
      await assertWritable(ctx, 'records', event.id); await db.collection('dailyRecords').doc(event.id).update({ data: { ...event.data, updatedAt: db.serverDate() } })
      if (event.data.taskId && event.data.progressAfter !== null && event.data.progressAfter !== undefined) { await assertWritable(ctx, 'tasks', event.data.taskId); await db.collection('tasks').doc(event.data.taskId).update({ data: { progress: Number(event.data.progressAfter), updatedAt: db.serverDate() } }) }
      return { ok: true }
    }
    if (action === 'deleteRecord') { await assertWritable(ctx, 'records', event.id); await db.collection('dailyRecords').doc(event.id).remove(); return { ok: true } }
    if (action === 'addCheckinTask') { const data = event.data || {}; const res = await db.collection('checkinTasks').add({ data: { ...data, ownerOpenid: OPENID, currentCount: 0, status: 'active', visibility: data.visibility || 'private', createdAt: db.serverDate() } }); return { ok: true, data: { ...data, _id: res._id, currentCount: 0, status: 'active' } } }
    if (action === 'updateCheckinTask') { await assertWritable(ctx, 'checkins', event.id); await db.collection('checkinTasks').doc(event.id).update({ data: { ...event.data, updatedAt: db.serverDate() } }); return { ok: true } }
    if (action === 'deleteCheckinTask') { await assertWritable(ctx, 'checkins', event.id); const logs = await listData(ctx, 'checkinLogs'); for (const log of logs.filter(item => item.checkinId === event.id)) await db.collection('checkinLogs').doc(log._id).remove(); await db.collection('checkinTasks').doc(event.id).remove(); return { ok: true } }
    if (action === 'addCheckinLog') { const task = await assertWritable(ctx, 'checkins', event.data.checkinId); const res = await db.collection('checkinLogs').add({ data: { ...event.data, ownerOpenid: OPENID, createdAt: db.serverDate() } }); const currentCount = Number(task.currentCount || 0) + 1; await db.collection('checkinTasks').doc(task._id).update({ data: { currentCount, status: currentCount >= Number(task.targetCount || 1) ? 'completed' : 'active', updatedAt: db.serverDate() } }); return { ok: true, data: { ...event.data, _id: res._id } } }
    if (action === 'deleteCheckinLog') { const log = await assertWritable(ctx, 'checkinLogs', event.id); const task = await assertWritable(ctx, 'checkins', log.checkinId); await db.collection('checkinLogs').doc(event.id).remove(); await db.collection('checkinTasks').doc(task._id).update({ data: { currentCount: Math.max(0, Number(task.currentCount || 0) - 1), status: 'active', updatedAt: db.serverDate() } }); return { ok: true } }
    if (action === 'addCategory') { await db.collection('categories').add({ data: { ownerOpenid: OPENID, name: event.name, color: event.color || '#3f8f70', order: Date.now() } }); return { ok: true } }
    if (action === 'addHabitCategory') { await db.collection('categories').add({ data: { ownerOpenid: OPENID, name: event.name, color: event.color || '#3f8f70', kind: 'habit', order: Date.now() } }); return { ok: true } }
    if (action === 'renameHabitCategory') { const categories = await listData(ctx, 'categories'); for (const doc of categories.filter(item => item.kind === 'habit' && item.name === event.oldName)) await db.collection('categories').doc(doc._id).update({ data: { name: event.newName } }); const habits = await listData(ctx, 'checkins'); for (const habit of habits.filter(item => item.category === event.oldName)) await db.collection('checkinTasks').doc(habit._id).update({ data: { category: event.newName } }); return { ok: true } }
    if (action === 'deleteHabitCategory') { const categories = await listData(ctx, 'categories'); for (const doc of categories.filter(item => item.kind === 'habit' && item.name === event.name)) await db.collection('categories').doc(doc._id).remove(); return { ok: true } }
    if (action === 'setHabitCategoryColor') { const categories = await listData(ctx, 'categories'); for (const doc of categories.filter(item => item.kind === 'habit' && item.name === event.name)) await db.collection('categories').doc(doc._id).update({ data: { color: event.color } }); return { ok: true } }
    if (action === 'renameCategory') {
      for (const type of ['categories', 'tasks', 'records']) { const docs = await listData(ctx, type); for (const doc of docs.filter(item => (type === 'categories' ? item.kind !== 'habit' && item.name === event.oldName : item.category === event.oldName))) await db.collection(collectionName(type)).doc(doc._id).update({ data: type === 'categories' ? { name: event.newName } : { category: event.newName } }) }
      return { ok: true }
    }
    if (action === 'deleteCategory') { const docs = await listData(ctx, 'categories'); for (const doc of docs.filter(item => item.kind !== 'habit' && item.name === event.name)) await db.collection('categories').doc(doc._id).remove(); return { ok: true } }
    if (action === 'setCategoryColor') { const docs = await listData(ctx, 'categories'); for (const doc of docs.filter(item => item.kind !== 'habit' && item.name === event.name)) await db.collection('categories').doc(doc._id).update({ data: { color: event.color } }); return { ok: true } }
    throw new Error('不支持的操作')
  } catch (error) { console.error(error); return { ok: false, message: error.message } }
}
