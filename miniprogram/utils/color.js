const clamp = value => Math.max(0, Math.min(100, Number(value || 0)))

const interpolate = (start, end, ratio) => start.map((value, index) => Math.round(value + (end[index] - value) * ratio))

// 0% 为红色，50% 为橙色，100% 为绿色，两段连续插值。
const progressColor = progress => {
  const value = clamp(progress)
  const red = [239, 68, 68]
  const orange = [245, 158, 11]
  const green = [34, 197, 94]
  const rgb = value <= 50 ? interpolate(red, orange, value / 50) : interpolate(orange, green, (value - 50) / 50)
  return `rgb(${rgb.join(',')})`
}

module.exports = { progressColor }
