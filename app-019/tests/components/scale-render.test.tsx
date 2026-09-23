// 比例渲染：视图框按比例缩、标注写实际尺寸、1:2/1:5 带比例标与校验尺
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ViewSvg, CheckRuler } from '../../src/components/ViewSvg'
import { computeJoint } from '../../src/lib/calc'
import { buildViews } from '../../src/geometry/views'
import type { Joint } from '../../src/types'

const joint: Joint = {
  kind: 'dovetail',
  params: {
    boardA: { thickness: 18, width: 200 },
    boardB: { thickness: 18, width: 200 },
    wood: 'hardwood',
    fit: 'standard',
    dovetail: { angleRatio: 8 },
    kerfMm: 1.1,
  },
  notes: [],
}

function svgAttr(el: HTMLElement, name: string): string {
  return el.querySelector('svg')!.getAttribute(name)!
}

describe('ViewSvg 出图比例', () => {
  const views = buildViews(joint, computeJoint(joint))

  it('1:1：viewBox 与实际内容同尺寸，无比例徽标', () => {
    const { container } = render(<ViewSvg vm={views[0]} scale="1:1" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('data-scale')).toBe('1:1')
    const vb = svg.getAttribute('viewBox')!.split(' ').map(Number)
    expect(vb[2]).toBeCloseTo(200 + 22 + 26)
    expect(vb[3]).toBeCloseTo(18 + 26 + 40)
    expect(container.querySelector('[data-testid="scale-badge"]')).toBeNull()
    // 标注文字仍是实际尺寸
    expect(container.textContent).toContain('板宽 200')
  })

  it('1:2 / 1:5：viewBox 宽按 1/n 缩小（含固定 padding），带比例徽标', () => {
    for (const [scale, n] of [['1:2', 2], ['1:5', 5]] as const) {
      const { container } = render(<ViewSvg vm={views[0]} scale={scale} />)
      expect(svgAttr(container, 'data-scale')).toBe(scale)
      const vb = svgAttr(container, 'viewBox').split(' ').map(Number)
      expect(vb[2]).toBeCloseTo(200 / n + 22 + 26)
      expect(vb[3]).toBeCloseTo(18 / n + 26 + 40)
      expect(container.querySelector('[data-testid="scale-badge"]')?.textContent).toBe(scale)
      // 尺寸标注一律写实际尺寸，不写图上量出来的 100/40
      expect(container.textContent).toContain('板宽 200')
      expect(container.textContent).not.toContain('板宽 100')
      expect(container.textContent).not.toContain('板宽 40')
    }
  })
})

describe('CheckRuler 比例校验尺', () => {
  it('1:1：尺长 100mm（viewBox 与 CSS 宽一致）', () => {
    const { container } = render(<CheckRuler scale="1:1" />)
    const wrap = container.querySelector('[data-testid="check-ruler"]')!
    expect(wrap.getAttribute('data-scale')).toBe('1:1')
    const svg = wrap.querySelector('svg')!
    const vbW = Number(svg.getAttribute('viewBox')!.split(' ')[2])
    expect(vbW).toBeCloseTo(106)
    expect(svg.getAttribute('style')).toContain('106mm')
    expect(wrap.textContent).toContain('100mm')
  })

  it('1:2 / 1:5：校验尺图上长度 = 100/n mm（两端各留 2mm 边距），仍标注代表实际 100mm', () => {
    for (const [scale, drawn, vbW] of [['1:2', 50, 56], ['1:5', 20, 26]] as const) {
      const { container } = render(<CheckRuler scale={scale} />)
      const wrap = container.querySelector('[data-testid="check-ruler"]')!
      const svg = wrap.querySelector('svg')!
      expect(Number(svg.getAttribute('viewBox')!.split(' ')[2])).toBeCloseTo(vbW)
      expect(svg.getAttribute('style')).toContain(`${vbW}mm`)
      // 尺两端的竖端线位于 0 与 drawn（图上 mm）
      const endLines = svg.querySelectorAll('line')
      expect(endLines[1]!.getAttribute('x1')).toBe('0')
      expect(endLines[2]!.getAttribute('x1')).toBe(String(drawn))
      expect(wrap.textContent).toContain('100mm')
      expect(wrap.textContent).toContain(scale)
    }
  })
})
