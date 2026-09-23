// 三视图一致性（蓝图 §10：正视图宽度 = 俯视图宽度）+ 锯路补偿 + 切割清单
import { describe, it, expect } from 'vitest'
import { computeJoint } from '../../src/lib/calc'
import { buildViews, scaleView } from '../../src/geometry/views'
import { buildCutList } from '../../src/lib/cutlist'
import type { Joint, JointKind, Scale } from '../../src/types'

const JOINTS: JointKind[] = ['dovetail', 'half-blind-dovetail', 'mortise-tenon', 'dowel', 'lap', 'panel-glue']

function makeJoint(kind: JointKind): Joint {
  return {
    kind,
    params: {
      boardA: { thickness: 18, width: 200 },
      boardB: { thickness: 18, width: 200 },
      wood: 'hardwood',
      fit: 'standard',
      dovetail: { angleRatio: 8 },
      tenon: { thicknessRatio: 1 / 3, lengthRatio: 1, offsetFromFace: 0 },
      kerfMm: 1.1,
    },
    notes: [],
  }
}

describe('三视图一致性（断言：正视图宽 = 俯视图宽）', () => {
  for (const kind of JOINTS) {
    it(`${kind}: front.contentW === top.contentW`, () => {
      const joint = makeJoint(kind)
      const r = computeJoint(joint)
      const views = buildViews(joint, r)
      expect(views).toHaveLength(3)
      const front = views.find((v) => v.id === 'front')!
      const top = views.find((v) => v.id === 'top')!
      const side = views.find((v) => v.id === 'side')!
      expect(front.contentW).toBe(top.contentW)
      expect(side).toBeTruthy()
      // 视图内几何不得越界（局部坐标 −40~content+60 之外不允许）
      for (const v of views) {
        for (const l of v.lines) {
          expect(l.x1).toBeGreaterThanOrEqual(-40)
          expect(l.y1).toBeGreaterThanOrEqual(-40)
          expect(l.x2).toBeLessThanOrEqual(v.contentW + 60)
          expect(l.y2).toBeLessThanOrEqual(v.contentH + 60)
        }
      }
    })
  }

  it('燕尾：锯切线数量 = 2×齿数（每齿两侧 kerf 补偿线）', () => {
    const joint = makeJoint('dovetail')
    const r = computeJoint(joint)
    const views = buildViews(joint, r)
    const front = views.find((v) => v.id === 'front')!
    const sawCount = front.lines.filter((l) => l.cls === 'saw').length
    expect(sawCount).toBe(r.dovetail!.teeth.length * 2)
  })

  it('燕尾：齿序编号覆盖每个齿', () => {
    const joint = makeJoint('dovetail')
    const r = computeJoint(joint)
    const views = buildViews(joint, r)
    const front = views.find((v) => v.id === 'front')!
    expect(front.marks.map((m) => m.text)).toEqual(r.dovetail!.teeth.map((t) => String(t.index)))
  })
})

describe('出图比例（几何按比例缩，标注保持实际尺寸）', () => {
  const cases: { scale: Scale; k: number }[] = [
    { scale: '1:2', k: 0.5 },
    { scale: '1:5', k: 0.2 },
  ]
  for (const { scale, k } of cases) {
    it(`${scale}：contentW/几何坐标 ×${k}，尺寸 label 仍写实际尺寸`, () => {
      const joint = makeJoint('dovetail')
      const r = computeJoint(joint)
      const views = buildViews(joint, r)
      const front = views.find((v) => v.id === 'front')!
      const scaled = scaleView(front, scale)

      // 画板内容按比例缩
      expect(scaled.contentW).toBeCloseTo(front.contentW * k, 6)
      expect(scaled.contentH).toBeCloseTo(front.contentH * k, 6)
      // 几何线端点按比例缩
      expect(scaled.lines[0]!.x1).toBeCloseTo(front.lines[0]!.x1 * k, 6)
      expect(scaled.lines[0]!.y2).toBeCloseTo(front.lines[0]!.y2 * k, 6)
      // 标注线位置按比例缩，但 label 文本与 1:1 完全一致（实际尺寸）
      expect(scaled.dims.map((d) => d.label)).toEqual(front.dims.map((d) => d.label))
      expect(scaled.dims[0]!.from).toBeCloseTo(front.dims[0]!.from * k, 6)
      expect(scaled.dims[0]!.to).toBeCloseTo(front.dims[0]!.to * k, 6)
      // 板宽标注写的是实际 200，不是缩后的数
      expect(scaled.dims.some((d) => d.label.includes('200'))).toBe(true)
      // 齿序编号文本不变
      expect(scaled.marks.map((m) => m.text)).toEqual(front.marks.map((m) => m.text))
    })
  }

  it('1:1：返回同一视图（无缩放）', () => {
    const joint = makeJoint('dovetail')
    const views = buildViews(joint, computeJoint(joint))
    expect(scaleView(views[0]!, '1:1')).toBe(views[0])
  })

  it('非 1:1 后正视图与俯视图宽度仍一致（缩放后三视图依然对齐）', () => {
    const joint = makeJoint('dovetail')
    const views = buildViews(joint, computeJoint(joint)).map((v) => scaleView(v, '1:5'))
    expect(views.find((v) => v.id === 'front')!.contentW).toBe(views.find((v) => v.id === 'top')!.contentW)
  })
})

describe('切割清单', () => {
  for (const kind of JOINTS) {
    it(`${kind}: A/B 两件步骤非空且有序`, () => {
      const joint = makeJoint(kind)
      const r = computeJoint(joint)
      const cut = buildCutList(joint, r.dovetail, r.tenon)
      expect(cut.boardA.length).toBeGreaterThan(0)
      expect(cut.boardB.length).toBeGreaterThan(0)
      expect(cut.boardA.map((s) => s.no)).toEqual(cut.boardA.map((s) => s.no).sort((a, b) => a - b))
      expect(cut.cautions.length).toBeGreaterThanOrEqual(2)
      expect(cut.cautions.some((c) => c.includes('锯路'))).toBe(true)
      expect(cut.cautions.some((c) => c.includes('锯切线'))).toBe(true)
    })
  }
})
