# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个使用 Expo 和 React Native 构建的移动应用项目，名为 "zero_notive"，是一个推送通知应用。

## 核心开发命令

### 基本命令
- `npm install` - 安装依赖
- `expo start` 或 `npm start` - 启动开发服务器
- `expo run:android` 或 `npm run android` - 在 Android 设备/模拟器上运行
- `expo run:ios` 或 `npm run ios` - 在 iOS 设备/模拟器上运行
- `expo start --web` 或 `npm run web` - 在浏览器中运行 web 版本

### 代码质量
- `expo lint` 或 `npm run lint` - 运行 ESLint 检查代码

### 项目重置
- `npm run reset-project` - 重置项目为空白状态（将示例代码移至 app-example 目录）

### 构建命令
- `eas build -p android --profile preview --local --android-build-type apk` - 本地构建 Android APK（如 README 末尾所示）

## 项目架构

### 目录结构
- `app/` - 主要应用代码，使用 Expo Router 文件路由
  - `(tabs)/` - 标签页路由组
  - `_layout.tsx` - 根布局
- `components/` - 可复用组件
  - `ui/` - UI 组件（IconSymbol、TabBarBackground 等）
- `constants/` - 常量定义（Colors.ts 包含主题颜色）
- `hooks/` - 自定义 React hooks（主题和颜色方案）
- `assets/` - 静态资源（图片、字体）
- `android/` 和 `ios/` - 原生平台特定代码

### 技术栈
- **框架**: Expo SDK 53, React Native 0.79.5
- **导航**: Expo Router (文件路由)
- **UI**: React Navigation, Expo Vector Icons, SF Symbols
- **状态管理**: AsyncStorage
- **工具**: TypeScript, ESLint
- **推送通知**: Expo Notifications

### 关键特性
- 支持 Expo 新架构 (newArchEnabled: true)
- 自动主题切换 (light/dark mode)
- 文件路由系统
- TypeScript 严格模式
- 使用 SpaceMono 自定义字体
- 支持 iOS, Android 和 Web 平台

### 配置文件
- `app.json` - Expo 应用配置
- `eas.json` - EAS Build 配置（包含 development, preview, production 构建配置）
- `tsconfig.json` - TypeScript 配置（使用 @/* 路径别名）
- `package.json` - 依赖和脚本定义

### 推送通知相关
项目包含推送通知功能相关文件：
- `test-push*.js` 和 `test-push-curl.sh` - 推送通知测试脚本
- `google-services.json` - Google Services 配置（用于 Firebase）
- Expo Notifications 依赖已配置

### 开发注意事项
- TabBar 已被隐藏 (`tabBarStyle: { display: 'none' }`)
- 应用支持 edge-to-edge 显示 (Android)
- 使用 Metro 作为 Web 打包工具