// E2E：模拟真实用户从首页点击到出图、保存、导出/导入、打印的全流程
import { test, expect, type Page } from '@playwright/test'

async function goto(page: Page, path = '/') {
  await page.goto(path)
  // 仅首页断言 home-page；其他路由由用例自行断言各自页面 testid
  if (path === '/' || path === '') {
    await expect(page.getByTestId('home-page')).toBeVisible()
  }
}

test.describe('全流程：选类型 → 填尺寸 → 出三视图 → 打印 1:1 模板（蓝图 §12 验收）', () => {
  test('新建燕尾榫方案 → 编辑器出图 → 保存 → 列表可检索', async ({ page }) => {
    await goto(page)
    await page.getByTestId('new-plan').click()

    // 选类型
    await page.getByTestId('kind-dovetail').click()
    await page.getByTestId('a-width').fill('240')
    await page.getByTestId('create-plan').click()

    // 编辑器：三视图 + 齿宽表 + 切割步骤
    await expect(page.getByTestId('editor-page')).toBeVisible()
    await expect(page.locator('[data-view="front"]')).toBeVisible()
    await expect(page.locator('[data-view="top"]')).toBeVisible()
    await expect(page.locator('[data-view="side"]')).toBeVisible()
    await expect(page.getByTestId('tooth-table')).toBeVisible()
    await expect(page.getByTestId('cut-steps')).toBeVisible()
    await expect(page.getByTestId('recalc-ms')).toContainText(/重算耗时 [\d.]+ms/)

    // 保存 → 回列表
    await page.getByTestId('save-plan').click()
    await expect(page.getByTestId('dirty-bar')).toBeHidden()
    await page.getByTestId('nav-home').click()
    const card = page.getByTestId('plan-card').first()
    await expect(card).toContainText('燕尾榫（穿透式）')
    await expect(card).toContainText('240')
  })

  test('参数改动 → 脏状态提示 → 保存后消失；警告场景（齿数过多）', async ({ page }) => {
    await goto(page, '/#/new')
    await page.getByTestId('kind-dovetail').click()
    await page.getByTestId('a-width').fill('60')
    await page.getByTestId('teeth').fill('12')
    await page.getByTestId('create-plan').click()

    await expect(page.getByTestId('editor-page')).toBeVisible()
    // 齿数过多：齿根低于最小安全值 → 警告不静默
    const warnings = page.getByTestId('warnings')
    await expect(warnings).toBeVisible()
    await expect(warnings).toContainText('低于硬木最小安全值')
    await expect(warnings).toContainText('建议减少齿数')

    // 改动出现脏条，保存后消失
    await page.getByTestId('kerf').fill('2.2')
    await expect(page.getByTestId('dirty-bar')).toBeVisible()
    await page.getByTestId('save-plan').click()
    await expect(page.getByTestId('dirty-bar')).toBeHidden()
  })

  test('键盘方向键微调 0.5mm（蓝图 §9）', async ({ page }) => {
    await goto(page, '/#/new')
    await page.getByTestId('kind-dovetail').click()
    const input = page.getByTestId('a-thickness')
    await input.focus()
    await page.keyboard.press('ArrowUp')
    await expect(input).toHaveValue('18.5')
    await page.keyboard.press('ArrowDown')
    await expect(input).toHaveValue('18')
  })

  test('导出 JSON → 删除 → 导入 → 参数与图纸完全一致（蓝图 §10）', async ({ page }) => {
    await goto(page, '/#/new')
    await page.getByTestId('kind-dovetail').click()
    await page.getByTestId('a-width').fill('240')
    await page.getByTestId('teeth').fill('8')
    await page.getByTestId('create-plan').click()
    await expect(page.getByTestId('editor-page')).toBeVisible()

    // 导出（捕获下载）
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-json').click(),
    ])
    const path = await download.path()
    expect(path).toBeTruthy()

    // 记录导出前图纸关键数据
    const frontBox = await page.locator('[data-view="front"]').getAttribute('viewBox')
    const topBox = await page.locator('[data-view="top"]').getAttribute('viewBox')
    expect(frontBox).toBeTruthy()
    // 三视图一致性：正视图与俯视图内容宽度相同（viewBox 宽相等）
    expect(frontBox!.split(' ')[2]).toBe(topBox!.split(' ')[2])

    // 回列表，删除该方案，再导入同一文件
    await page.getByTestId('nav-home').click()
    await expect(page.getByTestId('plan-card')).toHaveCount(1)
    await page.locator('[data-testid^="delete-"]').click()
    await expect(page.getByTestId('plan-card')).toHaveCount(0)

    await page.setInputFiles('[data-testid="import-input"]', path!)
    await expect(page.getByTestId('plan-card')).toHaveCount(1)

    // 打开导入的方案：参数一致
    await page.getByTestId('plan-card').first().click()
    await expect(page.getByTestId('editor-page')).toBeVisible()
    await expect(page.getByTestId('a-width')).toHaveValue('240')
    await expect(page.getByTestId('teeth')).toHaveValue('8')
    expect(await page.locator('[data-view="front"]').getAttribute('viewBox')).toBe(frontBox)
  })

  test('打印视图：1:1 校验尺 + 模板页 + 打印调用', async ({ page }) => {
    // 拦截 window.print
    await page.addInitScript(() => {
      ;(window as unknown as { __printed: boolean }).__printed = false
      window.print = () => {
        ;(window as unknown as { __printed: boolean }).__printed = true
      }
    })
    await goto(page, '/#/new')
    await page.getByTestId('kind-dovetail').click()
    await page.getByTestId('create-plan').click()
    await page.getByTestId('go-print').click()

    await expect(page.getByTestId('print-page')).toBeVisible()
    await expect(page.getByTestId('print-scale')).toHaveValue('1:1')
    await expect(page.getByTestId('check-ruler')).toBeVisible()
    await expect(page.getByTestId('check-ruler')).toContainText('100mm')
    await expect(page.getByText('1:1 模板页')).toBeVisible()
    await page.getByTestId('do-print').click()
    const printed = await page.evaluate(() => (window as unknown as { __printed: boolean }).__printed)
    expect(printed).toBe(true)
  })

  test('编辑器切比例 1:5 → 保存 → 重新打开仍是 1:5；标注为实际尺寸、视图缩小、带比例校验尺', async ({ page }) => {
    await goto(page, '/#/new')
    await page.getByTestId('kind-dovetail').click()
    await page.getByTestId('a-width').fill('600')
    await page.getByTestId('create-plan').click()
    await expect(page.getByTestId('editor-page')).toBeVisible()

    const before = await page.locator('[data-view="front"]').evaluate((el) => {
      const svg = el as SVGSVGElement
      return { box: svg.getAttribute('viewBox') }
    })

    // 1:1 时无比例面板
    await expect(page.getByTestId('scale-panel')).toHaveCount(0)
    await page.getByTestId('editor-scale').selectOption('1:5')
    await expect(page.getByTestId('scale-badge')).toContainText('比例 1:5')
    await expect(page.getByTestId('scale-ruler-1:5')).toBeVisible()
    await expect(page.locator('[data-view="front"]')).toHaveAttribute('data-scale', '1:5')

    // 标注写实际尺寸 600，不是缩放后的 120
    await expect(page.locator('[data-view="front"]')).toContainText('板宽 600')

    const after = await page.locator('[data-view="front"]').evaluate((el) => {
      const svg = el as SVGSVGElement
      return { w: parseFloat(svg.style.width), box: svg.getAttribute('viewBox') }
    })
    // viewBox 内容宽缩到 1/5（600→120）；两端共 48mm padding 不参与缩放
    const boxWBefore = parseFloat(before.box!.split(' ')[2]!)
    const boxWAfter = parseFloat(after.box!.split(' ')[2]!)
    expect(boxWAfter - 48).toBeCloseTo((boxWBefore - 48) / 5, 1)
    expect(after.w).toBeCloseTo(boxWAfter, 1)

    // 保存后回列表再打开，仍是 1:5
    await page.getByTestId('save-plan').click()
    await page.getByTestId('nav-home').click()
    await page.getByTestId('plan-card').first().click()
    await expect(page.getByTestId('editor-scale')).toHaveValue('1:5')
    await expect(page.locator('[data-view="front"]')).toHaveAttribute('data-scale', '1:5')
  })

  test('打印页切到 1:2：按比例出图、比例校验尺替代 100mm 校验尺、模板页隐藏', async ({ page }) => {
    await goto(page, '/#/new')
    await page.getByTestId('kind-dovetail').click()
    await page.getByTestId('create-plan').click()
    await page.getByTestId('go-print').click()

    await page.getByTestId('print-scale').selectOption('1:2')
    await expect(page.getByTestId('do-print')).toContainText('1:2')
    await expect(page.getByTestId('scale-ruler-1:2')).toBeVisible()
    // 尺面代表实际 100mm，图上应只有 50mm
    await expect(page.getByTestId('scale-ruler-1:2')).toContainText('50mm')
    await expect(page.getByTestId('check-ruler')).toHaveCount(0)
    await expect(page.getByText('1:1 模板页')).toHaveCount(0)
    await expect(page.locator('[data-view="front"]')).toHaveAttribute('data-scale', '1:2')
    await expect(page.locator('[data-view="front"]')).toContainText('板宽 200')

    // 返回编辑器：打印页的比例选择已随方案存住
    await page.getByRole('button', { name: '返回编辑' }).click()
    await expect(page.getByTestId('editor-scale')).toHaveValue('1:2')
  })

  test('六种榫卯类型均可出图（类型切换联动）', async ({ page }) => {
    const kinds = [
      'half-blind-dovetail',
      'mortise-tenon',
      'dowel',
      'lap',
      'panel-glue',
    ]
    for (const kind of kinds) {
      await goto(page, '/#/new')
      await page.getByTestId(`kind-${kind}`).click()
      await page.getByTestId('create-plan').click()
      await expect(page.getByTestId('editor-page')).toBeVisible()
      await expect(page.locator('[data-view="front"]')).toBeVisible()
      await expect(page.locator('[data-view="top"]')).toBeVisible()
      await expect(page.locator('[data-view="side"]')).toBeVisible()
      await expect(page.getByTestId('cut-steps')).toBeVisible()
    }
  })

  test('知识卡页面展示 7 张经验卡', async ({ page }) => {
    await goto(page, '/#/library')
    await expect(page.getByTestId('library-page')).toBeVisible()
    await expect(page.getByTestId('knowledge-card')).toHaveCount(7)
  })
})
