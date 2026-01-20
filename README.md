# 日历应用（React Native + Expo）

一个支持月/周/日视图、日程管理与本地提醒，并扩展支持 `.ics` 导入导出、网络订阅与农历显示的日历 App。

## 功能一览

**基础要求**
- 日历视图：月视图 / 周视图 / 日视图
- 日程管理：新增 / 查看详情 / 编辑 / 删除
- 日程提醒：无 / 准时 / 提前 5/10/30 分钟（本地通知）

**扩展要求**
- iCalendar 导入导出：导入 `.ics` 文件、导出并分享 `.ics`
- 网络订阅：添加订阅 URL（`.ics`），手动同步，展示订阅事件（只读）
- 农历：显示农历日期、节气与节日提示

## 技术栈
- React Native + TypeScript + Expo（SDK 54）
- 导航：React Navigation（Stack + Top Tabs）
- 存储：SQLite（`expo-sqlite`）
- 日历 UI：`react-native-calendars`
- 通知：`expo-notifications`
- 农历：`lunar-typescript`

## 快速开始

### 环境要求
- Node.js（建议 LTS）
- npm（本项目使用 `package-lock.json`）
- Expo Go（真机）或 iOS/Android 模拟器

### 安装依赖
```bash
npm install
```

### 启动
```bash
npm run start
```

清缓存启动（遇到 Metro 缓存问题可用）：
```bash
npm run start:clear
```

### 在设备/模拟器中打开
- 真机：安装 **Expo Go**，与电脑同一网络，扫码打开
- Android 模拟器：`npm run android`（或 `npm run android:clear`）
- iOS Simulator（macOS）：`npm run ios`（或 `npm run ios:clear`）

## 使用说明

1. 进入首页顶部 Tab：`月 / 周 / 日`
2. 月视图：点选日期 → 下方显示当天日程列表；顶部可进入 `订阅 / 导入 / 导出`
3. 新建日程：在月/周/日任一视图点击 `新建日程` → 填写标题、时间/全天、提醒 → `保存`
4. 查看/编辑/删除：点击日程进入 `日程详情` → `编辑` 或 `删除`
5. 提醒：为日程选择提醒选项；首次设置会弹出通知权限请求
6. 导入/导出：月视图顶部点击 `导入` 选择 `.ics` 文件；点击 `导出` 生成并分享 `.ics`
7. 网络订阅：月视图 `订阅` → `添加订阅`（名称 + `.ics` URL）→ 自动同步；列表/时间轴中会显示订阅事件（只读）
8. 数据重置：月视图 `订阅` → `清空所有数据`（会删除本地日程/提醒/订阅并取消已安排通知）

## 数据与存储
- 数据库：`expo-sqlite`，数据库名为 `calender.db`（在 App 沙盒内）
- 主要表：
  - `events`：本地日程
  - `reminders`：提醒记录（包含 `notification_id`）
  - `subscriptions`：订阅源
  - `subscription_events`：订阅事件（同步时写入，视为只读）

## iCalendar（.ics）支持说明
- 导出：将本地日程序列化为 RFC 5545 基本字段（VEVENT）
- 导入/订阅解析：
  - 支持单次事件、全天事件
  - 支持基础循环展开：`RRULE` 的 `FREQ=DAILY/WEEKLY`（含 `INTERVAL/BYDAY/COUNT/UNTIL`）
  - 支持循环例外：`EXDATE`、`RECURRENCE-ID`（单次变更）、`STATUS:CANCELLED`（单次取消）
  - `TZID` 目前仅保留字段，不做完整时区换算；未带 `Z` 的时间按本地时间解析

## 工程化脚本
- 类型检查：`npm run typecheck`
- 本地检查汇总：`npm run check`
- CI：`npm run ci`
- Expo 诊断：`npm run doctor`

## 目录结构
- `App.tsx`：入口（SQLiteProvider、NavigationContainer）
- `src/screens/`：页面（Month/Week/Day、编辑/详情、订阅管理）
- `src/components/`：时间轴、列表与日期组件
- `src/data/`：SQLite 访问与仓储层
- `src/services/`：导入导出、订阅同步、数据重置等服务
- `src/notifications/`：通知权限与提醒调度
- `src/utils/`：日期/农历/iCalendar 工具

## 备注
- 订阅事件为只读：不支持编辑/删除/提醒（可导出分享单个订阅事件为 `.ics`）
- 提醒依赖系统通知：Android 会创建 `default` 通知渠道；iOS 需要允许通知权限
