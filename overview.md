# 预警中心UI修复与数据完整性改进

## 修复内容

### 1. B级预警"处理"弹窗改进 ✅
- **旧行为**：点击"处理"弹出带文本输入框的转单确认框
- **新行为**：弹出双区弹窗：
  - **转工单区**：负责人从下拉列表选择（调用 `/api/assignees` 实时获取用户名单），点击"确认转工单"
  - **消除告警区**：填写消除理由（必填），点击"确认消除告警"，调用 dismiss API
- **涉及文件**：`frontend/dashboard.html` - `alConfirmConvert()` 重写、新增 `doDismissAlert()`
- **后端新增**：`backend/app.py` - 新增 `/api/assignees` 接口

### 2. 种子数据时间线修复 ✅
- **bug**：seed数据中仅2条告警有时间线，其他10条告警点击时间线显示"暂无时间线"
- **修复**：
  - 为全部12条告警生成 `created` 事件
  - 为3条自动转工单的告警（万家埠、岗前、新祺周）生成 `auto_converted` 事件和工单流转事件
  - 修复了旧seed中设备异常时间线的source_id错误（写成了5，实际是告警11）
  - 为新祺周(告警12)新增工单 `WO-20260622-112`
- **涉及文件**：`backend/seed_e2e_v2.py` - `generate_alerts()`、`generate_work_orders()`、`generate_timeline()` 全面重写

### 3. 自动告警无响应修复 ✅
- **旧行为**：auto/pending状态的告警（如蛟塘短时缺失）显示"自动工单"徽标+可点击的"时间线"按钮，但无对应工单
- **修复**：
  - auto/pending告警显示"待自动转单"（金色徽标）+ "等待自动转单..."提示（非可点击）
  - `showOrderDetail()` 增加了工单不存在的toast提示
  - 时间线空状态提示从"暂无时间线记录"改为更友好的解释性文字
- **涉及文件**：`frontend/dashboard.html` - 告警表格渲染逻辑

### 4. 迁移保护
- `migrate_alert_flow()` 增加了 `AND flow_type IS NULL` 条件，避免覆盖已设定的流转类型
- **涉及文件**：`backend/app.py` - 迁移函数

## 种子数据验证
- 12条告警：3条auto/converted + 2条auto/pending + 7条manual/pending_review
- 3条工单：万家埠（闭环）、岗前（处置中）、新祺周（待受理）
- 22条时间线事件：15条告警事件 + 7条工单事件

## 语法检查
- `dashboard.html`：1个script块，892对花括号、2809对括号，全部平衡
- `app.py`：Python编译通过
- `seed_e2e_v2.py`：Python编译通过
