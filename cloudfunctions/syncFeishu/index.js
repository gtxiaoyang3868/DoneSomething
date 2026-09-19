const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const request = (method, path, body, token) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : ''
  const req = https.request({
    hostname: 'open.feishu.cn', path, method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) }
  }, res => {
    let raw = ''
    res.on('data', chunk => { raw += chunk })
    res.on('end', () => {
      try { const data = JSON.parse(raw); if (res.statusCode >= 400 || data.code) reject(new Error(data.msg || `飞书接口错误 ${res.statusCode}`)); else resolve(data) }
      catch (error) { reject(new Error(`飞书响应解析失败：${raw.slice(0, 120)}`)) }
    })
  })
  req.on('error', reject)
  if (payload) req.write(payload)
  req.end()
})

exports.main = async event => {
  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET
  if (!appId || !appSecret) return { ok: false, message: '请在云函数环境变量中配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET' }
  if (!Array.isArray(event.rows) || !event.rows.length) return { ok: false, message: '没有可导出的记录' }
  try {
    const auth = await request('POST', '/open-apis/auth/v3/tenant_access_token/internal', { app_id: appId, app_secret: appSecret })
    const created = await request('POST', '/open-apis/sheets/v3/spreadsheets', { title: event.title || '每日轨迹记录' }, auth.tenant_access_token)
    const token = created.data.spreadsheet.spreadsheet_token
    const endColumn = String.fromCharCode(64 + Math.min(26, event.rows[0].length))
    await request('POST', `/open-apis/sheets/v2/spreadsheets/${token}/values_append`, { valueRange: { range: `Sheet1!A1:${endColumn}${event.rows.length}`, values: event.rows } }, auth.tenant_access_token)
    return { ok: true, url: created.data.spreadsheet.url }
  } catch (error) {
    console.error(error)
    return { ok: false, message: error.message }
  }
}
