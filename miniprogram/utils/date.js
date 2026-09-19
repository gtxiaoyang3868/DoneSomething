const pad = n => String(n).padStart(2, '0')

const toDateKey = value => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const offsetDate = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const rangeKeys = (start, end) => {
  const result = []
  let cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    result.push(toDateKey(cursor))
    cursor = offsetDate(cursor, 1)
  }
  return result
}

module.exports = { toDateKey, offsetDate, rangeKeys }
