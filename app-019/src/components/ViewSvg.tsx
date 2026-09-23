// SVG 渲染器：白底黑线 + 浅蓝细尺寸线 + 齿序编号圆标（黑白打印友好）
// 出图比例 1:n：几何（线条）按 1/n 缩，尺寸标注/编号/文字保持固定字号，
// 标注数值始终是 buildViews 生成的实际尺寸（不是图上量出来的数）。
import type { ViewModel, VDim, VLine } from '../geometry/views'
import type { Scale } from '../types'
import { scaleDenominator } from '../lib/scale'

const PAD = { l: 22, r: 26, t: 26, b: 40 }
const TICK = 2.5 // 标注端线长度（渲染坐标 mm，不随比例缩）
const LADDER = 9 // 外侧标注层间距（渲染坐标 mm；原实际坐标层距 10/12，缩比后按固定档排开）

function lineEl(l: VLine, key: number) {
  const clsMap: Record<VLine['cls'], string> = {
    cut: 'ln-cut',
    thin: 'ln-thin',
    saw: 'ln-saw',
    hidden: 'ln-hidden',
  }
  return <line key={key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={clsMap[l.cls]} />
}

/**
 * 把「实际坐标」的标注锚点映射到渲染坐标：
 * - 图框以内：按比例缩（at/n）
 * - 图框外侧：按层号给固定间距，避免缩比后标注压到图框/互相叠死
 */
function mapAt(at: number, contentLen: number, n: number): number {
  if (at < 0) {
    const level = Math.max(1, Math.round(-at / 10))
    return -level * LADDER
  }
  if (at > contentLen) {
    const level = Math.max(1, Math.round((at - contentLen) / 12))
    return contentLen / n + level * LADDER
  }
  return at / n
}

function dimEl(d: VDim, i: number, n: number, cw: number, ch: number) {
  const isH = d.orient === 'h'
  const x1 = isH ? d.from / n : mapAt(d.at, cw, n)
  const y1 = isH ? mapAt(d.at, ch, n) : d.from / n
  const x2 = isH ? d.to / n : mapAt(d.at, cw, n)
  const y2 = isH ? mapAt(d.at, ch, n) : d.to / n
  const leftOf = !isH && d.at < 0
  // 尺寸界线：从被标注的几何边引到尺寸线（缩放后尺寸线与图框可能离得远）
  const outside = isH ? d.at < 0 || d.at > ch : d.at < 0 || d.at > cw
  const ext = outside ? (
    isH ? (
      <>
        <line x1={x1} y1={d.at < 0 ? 0 : ch / n} x2={x1} y2={y1} className="ln-dim" />
        <line x1={x2} y1={d.at < 0 ? 0 : ch / n} x2={x2} y2={y2} className="ln-dim" />
      </>
    ) : (
      <>
        <line x1={d.at < 0 ? 0 : cw / n} y1={y1} x2={x1} y2={y1} className="ln-dim" />
        <line x1={d.at < 0 ? 0 : cw / n} y1={y2} x2={x2} y2={y2} className="ln-dim" />
      </>
    )
  ) : null
  const ticks = isH ? (
    <>
      <line x1={x1} y1={y1 - TICK} x2={x1} y2={y1 + TICK} className="ln-dim" />
      <line x1={x2} y1={y2 - TICK} x2={x2} y2={y2 + TICK} className="ln-dim" />
    </>
  ) : (
    <>
      <line x1={x1 - TICK} y1={y1} x2={x1 + TICK} y2={y1} className="ln-dim" />
      <line x1={x2 - TICK} y1={y2} x2={x2 + TICK} y2={y2} className="ln-dim" />
    </>
  )
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const label = isH ? (
    <text x={mx} y={y1 - 2} textAnchor="middle" className="dim-text">{d.label}</text>
  ) : (
    <text
      x={x1 + (leftOf ? -3 : 3)}
      y={my}
      textAnchor="middle"
      className="dim-text"
      transform={`rotate(${leftOf ? -90 : 90} ${x1 + (leftOf ? -3 : 3)} ${my})`}
    >
      {d.label}
    </text>
  )
  return (
    <g key={`dim${i}`}>
      {ext}
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="ln-dim" />
      {ticks}
      {label}
    </g>
  )
}

export function ViewSvg({ vm, widthMm, scale = '1:1' }: { vm: ViewModel; widthMm?: number; scale?: Scale }) {
  const n = scaleDenominator(scale)
  const cw = vm.contentW / n
  const ch = vm.contentH / n
  const w = cw + PAD.l + PAD.r
  const h = ch + PAD.t + PAD.b
  const style = widthMm ? { width: `${widthMm}mm` } : undefined
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
        {/* 几何层：实际坐标整体 1/n；--geo-sw 抵消缩放在线宽上的影响（CSS 里用） */}
        <g transform={`scale(${1 / n})`} style={{ ['--geo-sw' as string]: n }}>
          <rect x={0} y={0} width={vm.contentW} height={vm.contentH} fill="none" stroke="none" />
          {vm.lines.map((l, i) => lineEl(l, i))}
          {vm.marks.map((m, i) => (
            <g key={`m${i}`}>
              <circle cx={m.x} cy={m.y} r={4.5} className="mark-circle" />
              <text x={m.x} y={m.y + 1.5} textAnchor="middle" className="mark-text">
                {m.text}
              </text>
            </g>
          ))}
        </g>
        {/* 标注层：渲染坐标（位置 /n、字号固定）；label 永远写实际尺寸 */}
        {vm.dims.map((d, i) => dimEl(d, i, n, vm.contentW, vm.contentH))}
        {vm.texts.map((t, i) => (
          <text
            key={`t${i}`}
            x={t.x / n}
            y={mapAt(t.y, vm.contentH, n)}
            textAnchor={t.anchor ?? 'start'}
            className={`view-text ${t.cls ?? ''}`}
          >
            {t.text}
          </text>
        ))}
      </g>
      <text x={4} y={h - 6} className="view-title">
        {vm.title}
      </text>
      {scale !== '1:1' && (
        <g className="scale-badge" data-testid="scale-badge">
          <rect x={w - 31} y={4} width={27} height={10} rx={1.5} className="scale-badge-box" />
          <text x={w - 17.5} y={11} textAnchor="middle" className="scale-badge-text">{scale}</text>
        </g>
      )}
    </svg>
  )
}

/**
 * 比例校验尺：代表实际 100mm，按当前比例画。
 * 1:1 → 图上 100mm（原样）；1:2 → 图上 50mm；1:5 → 图上 20mm。
 */
export function CheckRuler({ scale = '1:1' }: { scale?: Scale }) {
  const n = scaleDenominator(scale)
  const drawn = 100 / n // 图上长度 mm
  const ticks = []
  for (let real = 0; real <= 100; real += 5) {
    const x = real / n
    const len = (real % 10 === 0 ? 5 : 3) / n
    ticks.push(<line key={real} x1={x} y1={0} x2={x} y2={len} className="ln-cut" />)
  }
  const vbW = drawn + 6 // -2…drawn+2，与 CSS 宽度一致：viewBox 单位 = 打印 mm
  const vbH = 14 / n
  return (
    <div className="ruler-wrap" data-testid="check-ruler" data-scale={scale}>
      <svg
        viewBox={`-2 -2 ${vbW} ${vbH}`}
        style={{ width: `${vbW}mm`, ['--geo-sw' as string]: n }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1={0} y1={0} x2={drawn} y2={0} className="ln-cut" />
        <line x1={0} y1={0} x2={0} y2={6 / n} className="ln-cut" />
        <line x1={drawn} y1={0} x2={drawn} y2={6 / n} className="ln-cut" />
        {ticks}
        <text x={0} y={11 / n} className="mark-text" style={{ fontSize: 4 / Math.max(1, n / 2) }}>0</text>
        <text x={drawn} y={11 / n} textAnchor="end" className="mark-text" style={{ fontSize: 4 / Math.max(1, n / 2) }}>
          100mm
        </text>
      </svg>
      <p className="note">
        {scale === '1:1'
          ? '打印校验尺：打印后用直尺量 0→100 应为 100mm（误差 ≤1mm）。若不符，打印时关闭「适应页面/缩放」，按 100% 打印。'
          : `比例校验尺（${scale}）：此尺代表实际 100mm，图上长 ${drawn}mm；打印后用直尺量应得 ${drawn}mm（误差 ≤1mm）。图中尺寸标注一律为实际尺寸，不可直接在图上量数。`}
      </p>
    </div>
  )
}
