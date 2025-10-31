# CLAUDE.md

使用中文回答,没有要求不需要生成说明文档

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个使用 Expo 和 React Native 构建的推送通知应用 "zero_notive",后端服务器地址为 https://wws741.top。

## 核心开发命令

### 启动与运行
- `npm install` - 安装依赖
- `npm start` 或 `expo start` - 启动开发服务器 (注意:不要使用 `npx run start`)
- `npm run android` - 在 Android 设备/模拟器上运行
- `npm run ios` - 在 iOS 设备/模拟器上运行
- `npm run web` - 在浏览器中运行 web 版本

### 其他命令
- `npm run lint` - 运行 ESLint 检查
- `npm run reset-project` - 重置项目为空白状态
- `eas build -p android --profile preview --local --android-build-type apk` - 本地构建 Android APK

## 项目架构

### 应用结构
该应用有两个版本的消息页面:
1. **原版** (`app/(tabs)/index.tsx`): 集成在一个文件中的完整推送消息功能,包含本地存储、HTML渲染、调试面板等
2. **新版** (`app/(tabs)/messages.tsx`): 使用服务化架构重构的版本,功能模块化

### 服务层 (services/)
应用采用服务化架构,主要服务包括:

- **messageApi.ts**: 后端API通信层
  - 基础URL: `https://wws741.top/notice`
  - 主要API:
    - `GET /messages` - 获取消息列表(支持limit和source参数)
    - `GET /messages/stats` - 获取消息统计
    - `GET /messages/range` - 按时间范围查询
  - 消息类型: `rsi` | `liquidation` | `news` | `manual` | `webhook`

- **storageService.ts**: AsyncStorage本地存储管理
  - 缓存过期时间: 24小时
  - 最大缓存消息数: 500条
  - 存储键: `@notice_app_*` 前缀
  - 自动去重和过期清理

- **notificationService.ts**: Expo Notifications推送服务
  - 项目ID: `360af40b-a183-4b14-9714-7f0afafafc26`
  - Token注册端点: `https://wws741.top/notice/notice_token`
  - 未读通知检查: `https://wws741.top/get_missed_notifications`
  - 自动处理应用前后台切换时的消息同步

### 组件层 (components/)
- **MessageList.tsx**: 通用消息列表组件
  - 支持下拉刷新
  - 智能缓存策略
  - 消息来源彩色标签
  - 相对时间显示
  - 通过事件监听器实时更新

### 原版推送实现特点 (index.tsx)
- FCM推送集成,包含完整的生命周期管理
- 本地消息存储(一个月自动过期)
- HTML内容渲染(使用WebView)
- 调试日志面板(最多200条日志)
- 冷启动和后台恢复时消息同步
- 多选删除、批量操作
- Token管理和服务器注册
- 防重复发送机制(5分钟内不重复发送相同token)

### 路由与导航
- 使用 Expo Router 文件路由
- 主布局: `app/_layout.tsx` - Stack导航
- Tab布局: `app/(tabs)/_layout.tsx` - 两个Tab页面
- Tab已配置但标签栏已隐藏(`tabBarStyle: { display: 'none' }`)

### 技术栈
- **框架**: Expo SDK 53, React Native 0.79.5
- **导航**: Expo Router (文件路由)
- **推送**: Expo Notifications + 自定义后端
- **存储**: AsyncStorage (带缓存管理)
- **UI**: React Navigation, SF Symbols
- **工具**: TypeScript (严格模式)

## 开发注意事项

### 推送通知开发
- 测试推送功能时使用 `test-push*.js` 脚本
- Token需要先发送到服务器才能接收推送
- 注意处理应用的三种状态: 前台、后台、冷启动
- 使用 FormData 发送 token 到服务器

### 消息处理
- 消息去重逻辑: 相同文本且时间差小于5-10秒视为重复
- 空消息会被自动过滤
- 本地存储消息自动保留最近30天

### API交互
- 所有API响应格式: `{ success: boolean, data?: T, error?: string }`
- 后端主域名: `wws741.top`
- API前缀: `/notice`
- Token注册可能返回 409 (Token已存在),这不是错误

### 应用配置
- Bundle ID (iOS): `com.assholes.zero-notive`
- Package (Android): `com.assholes.zero_notive`
- URL Scheme: `zeronotive`
- 已启用 Expo 新架构 (`newArchEnabled: true`)
- Android 支持 edge-to-edge 显示

### HTML消息渲染
原版实现中支持HTML内容:
- 使用 `/<[^>]+>/` 正则检测HTML标签
- WebView渲染完整的HTML页面
- 响应式样式,适配移动端
- 支持图片、表格、代码块等
