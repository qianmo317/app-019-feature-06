// SVG 渲染器：白底黑线 + 浅蓝细尺寸线 + 齿序编号圆标（黑白打印友好）
import type { ViewModel, VDim, VLine } from '../geometry/views'
import type { Scale } from '../types'
import { SCALE_FACTOR } from '../types'

const PAD = { l: 22, r: 26, t: 26, b: 40 }

/**
 * SVG 在纸面/屏幕上的物理宽（mm），含 padding。
 * 注意：vm 已按比例缩放（contentW 为图上长度），物理宽即缩放后尺寸 + padding。
 */
export function svgMmWidth(vm: ViewModel): number {
  return vm.contentW + PAD.l + PAD.r
}

function lineEl(l: VLine, key: number) {
  const clsMap: Record<VLine['cls'], string> = {
    cut: 'ln-cut',
    thin: 'ln-thin',
    saw: 'ln-saw',
    hidden: 'ln-hidden',
  }
  return <line key={key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={clsMap[l.cls]} />
}

function dimEl(d: VDim, i: number) {
  const isH = d.orient === 'h'
  const x1 = isH ? d.from : d.at
  const y1 = isH ? d.at : d.from
  const x2 = isH ? d.to : d.at
  const y2 = isH ? d.at : d.to
  const tick = 2.5
  const ticks = isH ? (
    <>
      <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} className="ln-dim" />
      <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} className="ln-dim" />
    </>
  ) : (
    <>
      <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} className="ln-dim" />
      <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} className="ln-dim" />
    </>
  )
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const label = isH ? (
    <text x={mx} y={y1 - 2} textAnchor="middle" className="dim-text">{d.label}</text>
  ) : (
    <text
      x={x1 + (d.at < 0 ? -3 : 3)}
      y={my}
      textAnchor="middle"
      className="dim-text"
      transform={`rotate(${d.at < 0 ? -90 : 90} ${x1 + (d.at < 0 ? -3 : 3)} ${my})`}
    >
      {d.label}
    </text>
  )
  return (
    <g key={`dim${i}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="ln-dim" />
      {ticks}
      {label}
    </g>
  )
}

export function ViewSvg({ vm, widthMm, scale = '1:1' }: { vm: ViewModel; widthMm?: number; scale?: Scale }) {
  const w = vm.contentW + PAD.l + PAD.r
  const h = vm.contentH + PAD.t + PAD.b
  // exactMm：打印与非 1:1 视图必须按 mm 物理尺寸出图（vm 已按比例缩放）
  const style = widthMm
    ? { width: `${widthMm}mm` }
    : scale !== '1:1'
      ? { width: `${svgMmWidth(vm)}mm` }
      : undefined
  return (
    <svg
      data-view={vm.id}
      data-scale={scale}
      viewBox={`0 0 ${w} ${h}`}
      style={style}
      className="view-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform={`translate(${PAD.l}, ${PAD.t})`}>
        <rect x={0} y={0} width={vm.contentW} height={vm.contentH} fill="none" stroke="none" />
        {vm.lines.map((l, i) => lineEl(l, i))}
        {vm.dims.map((d, i) => dimEl(d, i))}
        {vm.texts.map((t, i) => (
          <text
            key={`t${i}`}
            x={t.x}
            y={t.y}
            textAnchor={t.anchor ?? 'start'}
            className={`view-text ${t.cls ?? ''}`}
          >
            {t.text}
          </text>
        ))}
        {vm.marks.map((m, i) => (
          <g key={`m${i}`}>
            <circle cx={m.x} cy={m.y} r={4.5} className="mark-circle" />
            <text x={m.x} y={m.y + 2} textAnchor="middle" className="mark-text">
              {m.text}
            </text>
          </g>
        ))}
      </g>
      <text x={4} y={h - 6} className="view-title">
        {vm.title}
      </text>
    </svg>
  )
}

/** 100mm 校验尺：打印后实测验证 1:1 */
export function CheckRuler() {
  const ticks = []
  for (let i = 0; i <= 100; i += 5) {
    const len = i % 10 === 0 ? 5 : i % 50 === 0 ? 6 : 3
    ticks.push(<line key={i} x1={i} y1={0} x2={i} y2={len} className="ln-cut" />)
  }
  return (
    <div className="ruler-wrap" data-testid="check-ruler">
      <svg viewBox="-2 -2 106 14" style={{ width: '106mm' }} xmlns="http://www.w3.org/2000/svg">
        <line x1={0} y1={0} x2={100} y2={0} className="ln-cut" />
        <line x1={0} y1={0} x2={0} y2={6} className="ln-cut" />
        <line x1={100} y1={0} x2={100} y2={6} className="ln-cut" />
        {ticks}
        <text x={0} y={11} className="mark-text">0</text>
        <text x={100} y={11} textAnchor="end" className="mark-text">100mm</text>
      </svg>
      <p className="note">打印校验尺：打印后用直尺量 0→100 应为 100mm（误差 ≤1mm）。若不符，打印时关闭「适应页面/缩放」，按 100% 打印。</p>
    </div>
  )
}

/** 比例徽标：图纸旁标出当前出图比例 */
export function ScaleBadge({ scale }: { scale: Scale }) {
  return (
    <span className="scale-badge" data-testid="scale-badge">
      比例 {scale}
    </span>
  )
}

/**
 * 比例校验尺：几何已按比例缩，刻度数字仍写实际 mm。
 * 尺面代表实际 100mm（1:2 图上 50mm，1:5 图上 20mm）；1:1 时沿用 100mm 校验尺。
 */
export function ScaleRuler({ scale }: { scale: Exclude<Scale, '1:1'> }) {
  const k = SCALE_FACTOR[scale]
  const drawnMm = 100 * k // 图上物理长 mm
  const step = 20 // 刻度间隔按实际 mm：图上间隔 1:2=10mm、1:5=4mm，均可读
  const ticks = []
  for (let actual = 0; actual <= 100; actual += step) {
    const x = actual * k
    ticks.push(
      <g key={actual}>
        <line x1={x} y1={0} x2={x} y2={actual % (step * 2) === 0 ? 6 : 4} className="ln-cut" />
        <text x={x} y={11} textAnchor="middle" className="mark-text">{actual}</text>
      </g>,
    )
  }
  return (
    <div className="ruler-wrap scale-ruler" data-testid={`scale-ruler-${scale}`}>
      <p className="scale-ruler-head">
        <ScaleBadge scale={scale} />
        <span className="note">校验尺：刻度为实际尺寸（0→100mm），图上长度 {drawnMm}mm</span>
      </p>
      <svg
        viewBox={`-3 -3 ${drawnMm + 34} 17`}
        style={{ width: `${drawnMm + 34}mm` }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1={0} y1={0} x2={drawnMm} y2={0} className="ln-cut" />
        <line x1={0} y1={0} x2={0} y2={6} className="ln-cut" />
        <line x1={drawnMm} y1={0} x2={drawnMm} y2={6} className="ln-cut" />
        {ticks}
        <text x={drawnMm + 2} y={3} className="mark-text">实际100mm</text>
      </svg>
      <p className="note">打印后用直尺量：本尺 0→100 刻度段应为 {drawnMm}mm，即出图比例 {scale}。若不符，打印时关闭「适应页面/缩放」，按 100% 打印。</p>
    </div>
  )
}

/** 图纸旁的比例栏：仅 1:2 / 1:5 显示比例徽标与比例校验尺 */
export function ScalePanel({ scale }: { scale: Scale }) {
  if (scale === '1:1') return null
  return (
    <div className="scale-panel" data-testid="scale-panel">
      <ScaleRuler scale={scale} />
    </div>
  )
}
