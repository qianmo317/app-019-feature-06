// 出图比例：视图框按比例缩，但尺寸标注一律写实际尺寸（蓝图 §8）
import type { Scale } from '../types'

export const SCALES: Scale[] = ['1:1', '1:2', '1:5']

/** 1:n 中的 n；1:2 → 2，1:5 → 5 */
export function scaleDenominator(scale: Scale): number {
  const n = Number(scale.split(':')[1])
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** 图上长度 / 实际长度；1:2 → 0.5 */
export function scaleFactor(scale: Scale): number {
  return 1 / scaleDenominator(scale)
}

/** 实际 mm → 图上 mm（视图坐标系） */
export function scaleMm(realMm: number, scale: Scale): number {
  return realMm * scaleFactor(scale)
}

/** 旧数据 / 导入 JSON 缺字段时归一化为合法比例，缺省 1:1 */
export function normalizeScale(v: unknown): Scale {
  return (SCALES as string[]).includes(v as string) ? (v as Scale) : '1:1'
}
