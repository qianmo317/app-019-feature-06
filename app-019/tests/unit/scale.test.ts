// 出图比例工具：分母/换算/旧数据归一化
import { describe, it, expect } from 'vitest'
import { SCALES, scaleDenominator, scaleFactor, scaleMm, normalizeScale } from '../../src/lib/scale'

describe('比例换算', () => {
  it('三档比例：1:1 / 1:2 / 1:5', () => {
    expect(SCALES).toEqual(['1:1', '1:2', '1:5'])
  })

  it('scaleDenominator / scaleFactor', () => {
    expect(scaleDenominator('1:1')).toBe(1)
    expect(scaleDenominator('1:2')).toBe(2)
    expect(scaleDenominator('1:5')).toBe(5)
    expect(scaleFactor('1:1')).toBe(1)
    expect(scaleFactor('1:2')).toBeCloseTo(0.5)
    expect(scaleFactor('1:5')).toBeCloseTo(0.2)
  })

  it('scaleMm：实际 100mm 在 1:2 图上为 50mm、1:5 为 20mm', () => {
    expect(scaleMm(100, '1:1')).toBe(100)
    expect(scaleMm(100, '1:2')).toBe(50)
    expect(scaleMm(100, '1:5')).toBe(20)
  })

  it('normalizeScale：合法值透传，缺失/非法回退 1:1', () => {
    expect(normalizeScale('1:2')).toBe('1:2')
    expect(normalizeScale('1:5')).toBe('1:5')
    expect(normalizeScale(undefined)).toBe('1:1')
    expect(normalizeScale(null)).toBe('1:1')
    expect(normalizeScale('2:1')).toBe('1:1')
    expect(normalizeScale('1:10')).toBe('1:1')
    expect(normalizeScale(42)).toBe('1:1')
  })
})
