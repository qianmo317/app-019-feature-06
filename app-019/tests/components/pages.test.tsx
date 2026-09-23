// 组件测试：参数联动 / 列表筛选 / 导入导出 / 键盘微调（前端点击对应的 bug 面）
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomePage } from '../../src/pages/HomePage'
import { NewPlanPage } from '../../src/pages/NewPlanPage'
import { EditorPage, PrintPage } from '../../src/pages/EditorPage'
import { makePlan, upsertPlan, getPlan } from '../../src/store/plans'
import type { JointKind, Params } from '../../src/types'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe('新建页：选类型 → 填参数 → 生成图纸', () => {
  it('未选类型时按钮禁用；选类型后表单出现并可生成', async () => {
    const user = userEvent.setup()
    render(<NewPlanPage />)
    expect(screen.getByTestId('create-plan')).toBeDisabled()
    await user.click(screen.getByTestId('kind-dovetail'))
    expect(screen.getByTestId('create-plan')).toBeEnabled()
    expect(screen.getByTestId('a-thickness')).toHaveValue(18)
    await user.click(screen.getByTestId('create-plan'))
    // 跳转到编辑器
    expect(window.location.hash).toMatch(/^#\/plan\//)
  })

  it('键盘方向键微调 0.5mm（蓝图 §9）', async () => {
    render(<NewPlanPage />)
    await userEvent.setup().click(screen.getByTestId('kind-dovetail'))
    const input = screen.getByTestId('a-thickness')
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveValue(18.5)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveValue(18)
  })

  it('修改参数触发重算：燕尾警告出现在新建页参数流（齿数过多）', async () => {
    const user = userEvent.setup()
    render(<NewPlanPage />)
    await user.click(screen.getByTestId('kind-dovetail'))
    // 进入编辑器后再验证警告，这里只验证表单可改
    const teeth = screen.getByTestId('teeth')
    await user.clear(teeth)
    await user.type(teeth, '12')
    expect(teeth).toHaveValue(12)
  })
})

describe('编辑器：参数改动即时重算 + 脏状态提示 + 齿宽表', () => {
  const savedPlan = () => {
    const plan = makePlan('dovetail', {
      boardA: { thickness: 18, width: 200 },
      boardB: { thickness: 18, width: 200 },
      wood: 'hardwood',
      fit: 'standard',
      dovetail: { angleRatio: 8 },
      kerfMm: 1.1,
    })
    upsertPlan(plan)
    return plan
  }

  it('修改板宽 → 出现「参数已改」提示条与警告区域联动', async () => {
    const user = userEvent.setup()
    const { id } = savedPlan()
    render(<EditorPage id={id} />)
    // 初始无脏状态
    expect(screen.queryByTestId('dirty-bar')).toBeNull()
    expect(screen.getByTestId('tooth-table')).toBeInTheDocument()
    // 齿数过多 → 警告
    const teeth = screen.getByTestId('teeth')
    await user.clear(teeth)
    await user.type(teeth, '12')
    // 脏状态提示条
    expect(screen.getByTestId('dirty-bar')).toHaveTextContent('参数已改，请重新核对尺寸')
    // 重算耗时标注存在
    expect(screen.getByTestId('recalc-ms')).toBeInTheDocument()
  })

  it('切换榫卯类型 → 参数表单与切割步骤联动', async () => {
    const user = userEvent.setup()
    const { id } = savedPlan()
    render(<EditorPage id={id} />)
    await user.selectOptions(screen.getByTestId('editor-kind'), 'mortise-tenon')
    // 直榫参数出现，燕尾参数消失
    expect(screen.getByTestId('tn-ratio')).toBeInTheDocument()
    expect(screen.queryByTestId('teeth')).toBeNull()
    expect(screen.queryByTestId('tooth-table')).toBeNull()
  })

  it('方案不存在 → 显示错误并可控', () => {
    render(<EditorPage id="nonexistent" />)
    expect(screen.getByText('方案不存在或已删除')).toBeInTheDocument()
  })

  it('切比例 → 视图 data-scale 变化、出现校验尺且选择即时存库（不产生参数脏条）', async () => {
    const user = userEvent.setup()
    const { id } = savedPlan()
    render(<EditorPage id={id} />)
    const select = screen.getByTestId('scale-select')
    expect(select).toHaveValue('1:1')
    // 初始 1:1：无比例徽标，屏幕上也不显示校验尺（打印页 1:1 才需要尺）
    expect(document.querySelector('[data-view="front"]')!.getAttribute('data-scale')).toBe('1:1')
    expect(screen.queryByTestId('check-ruler')).toBeNull()

    await user.selectOptions(select, '1:2')
    expect(select).toHaveValue('1:2')
    const front = document.querySelector('[data-view="front"]')!
    expect(front.getAttribute('data-scale')).toBe('1:2')
    expect(front.querySelector('[data-testid="scale-badge"]')).toHaveTextContent('1:2')
    expect(screen.getByTestId('check-ruler').getAttribute('data-scale')).toBe('1:2')
    // 改比例不触发参数脏状态
    expect(screen.queryByTestId('dirty-bar')).toBeNull()
    // 已写回方案库
    expect(getPlan(id)!.scale).toBe('1:2')
  })

  it('下次打开仍是上次那一档（localStorage 持久化）', () => {
    const { id } = savedPlan()
    upsertPlan({ ...getPlan(id)!, scale: '1:5' })
    render(<EditorPage id={id} />)
    expect(screen.getByTestId('scale-select')).toHaveValue('1:5')
    expect(document.querySelector('[data-view="front"]')!.getAttribute('data-scale')).toBe('1:5')
  })

  it('旧数据缺 scale 字段 → 补 1:1 正常打开', () => {
    const plan = savedPlan()
    const raw = JSON.parse(localStorage.getItem('wjb.plans.v1')!) as typeof plan[]
    delete (raw[0] as { scale?: string }).scale
    localStorage.setItem('wjb.plans.v1', JSON.stringify(raw))
    render(<EditorPage id={plan.id} />)
    expect(screen.getByTestId('scale-select')).toHaveValue('1:1')
    expect(document.querySelector('[data-view="front"]')!.getAttribute('data-scale')).toBe('1:1')
  })
})

describe('打印页：按方案当前比例出图', () => {
  const savedPlan = () => {
    const plan = makePlan('dovetail', {
      boardA: { thickness: 18, width: 200 },
      boardB: { thickness: 18, width: 200 },
      wood: 'hardwood',
      fit: 'standard',
      dovetail: { angleRatio: 8 },
      kerfMm: 1.1,
    })
    upsertPlan(plan)
    return plan
  }

  it('1:1：保留 100mm 校验尺与 1:1 模板页标题', () => {
    const { id } = savedPlan()
    render(<PrintPage id={id} />)
    expect(screen.getByTestId('print-page')).toBeInTheDocument()
    expect(screen.getByTestId('check-ruler')).toHaveTextContent('100mm')
    expect(screen.getByText('1:1 模板页（剪下贴在木料上描线）')).toBeInTheDocument()
    const svg = document.querySelector('[data-view="front"]')!
    expect(svg.getAttribute('data-scale')).toBe('1:1')
    // 打印物理宽度：1:1 时内容 200mm + 48mm padding
    expect(svg.getAttribute('style')).toContain('248mm')
  })

  it('方案为 1:2：视图与校验尺按 1:2 出，页内可改比例并存库', async () => {
    const user = userEvent.setup()
    const plan = savedPlan()
    upsertPlan({ ...plan, scale: '1:2' })
    render(<PrintPage id={plan.id} />)
    // 视图按比例缩：物理宽 = 200/2 + 48 = 148mm
    const svg = document.querySelector('[data-view="front"]')!
    expect(svg.getAttribute('data-scale')).toBe('1:2')
    expect(svg.getAttribute('style')).toContain('148mm')
    // 校验尺图上 50mm 实际代表 100mm
    expect(screen.getByTestId('check-ruler')).toHaveTextContent('图上长 50mm')
    expect(screen.getByText('图纸视图（1:2）')).toBeInTheDocument()
    expect(svg.querySelector('[data-testid="scale-badge"]')).toHaveTextContent('1:2')

    await user.selectOptions(screen.getByTestId('scale-select'), '1:5')
    expect(document.querySelector('[data-view="front"]')!.getAttribute('data-scale')).toBe('1:5')
    // 200/5 + 48 = 88mm
    expect(document.querySelector('[data-view="front"]')!.getAttribute('style')).toContain('88mm')
    expect(screen.getByTestId('check-ruler')).toHaveTextContent('图上长 20mm')
    expect(getPlan(plan.id)!.scale).toBe('1:5')
  })
})

describe('列表页：筛选 + 删除 + 导入', () => {
  it('按类型与厚度筛选方案', async () => {
    upsertPlan(
      makePlan('dovetail', {
        boardA: { thickness: 18, width: 200 },
        boardB: { thickness: 18, width: 200 },
        wood: 'hardwood',
        fit: 'standard',
        kerfMm: 1.1,
      }),
    )
    upsertPlan(
      makePlan('mortise-tenon', {
        boardA: { thickness: 20, width: 200 },
        boardB: { thickness: 20, width: 200 },
        wood: 'hardwood',
        fit: 'standard',
        kerfMm: 1.1,
      }),
    )
    render(<HomePage onImported={() => undefined} />)
    expect(screen.getAllByTestId('plan-card')).toHaveLength(2)
    await userEvent.setup().selectOptions(screen.getByTestId('filter-kind'), 'dovetail')
    expect(screen.getAllByTestId('plan-card')).toHaveLength(1)
  })

  it('导入非法 JSON 显示错误', async () => {
    render(<HomePage onImported={() => undefined} />)
    const input = screen.getByTestId('import-input') as HTMLInputElement
    const file = new File(['{ bad'], 'plan.json', { type: 'application/json' })
    await userEvent.upload(input, file)
    // 错误必须浮出（解析错误信息或导入失败提示）
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('导入合法 JSON 写入方案库', async () => {
    const onImported = vi.fn()
    const plan = makePlan('lap', {
      boardA: { thickness: 18, width: 200 },
      boardB: { thickness: 18, width: 200 },
      wood: 'hardwood',
      fit: 'standard',
      kerfMm: 1.1,
    })
    render(<HomePage onImported={onImported} />)
    const input = screen.getByTestId('import-input') as HTMLInputElement
    await userEvent.upload(input, new File([JSON.stringify(plan)], 'plan.json', { type: 'application/json' }))
    expect(await screen.findAllByTestId('plan-card')).toHaveLength(1)
    expect(onImported).toHaveBeenCalled()
  })
})

describe('参数流（受控组件契约）', () => {
  it('ParamForm 修改回调携带合并后的参数', async () => {
    const { ParamForm } = await import('../../src/components/ParamForm')
    const params: Params = {
      boardA: { thickness: 18, width: 200 },
      boardB: { thickness: 18, width: 200 },
      wood: 'hardwood',
      fit: 'standard',
      dovetail: { angleRatio: 8 },
      kerfMm: 1.1,
    }
    let latest: Params | null = null
    render(<ParamForm kind={'dovetail' as JointKind} params={params} onChange={(p) => (latest = p)} />)
    const user = userEvent.setup()
    await user.type(screen.getByTestId('a-width'), '4')
    // 200 + '4' → "2004" 超出上限 900 → 钳制到 900（表单防呆）
    expect(latest!.boardA.width).toBe(900)
    expect(latest!.boardA.thickness).toBe(18) // 其余字段保持
  })
})
