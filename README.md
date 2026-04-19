# BLE 温湿度监控 Web App

基于 Web Bluetooth API 的温湿度实时监控前端。

## 功能

- 连接 JDY-18 BLE 蓝牙模块
- 实时显示温湿度数值
- 实时曲线图展示
- 开始/停止数据传输控制

## 技术栈

- React 18
- Chart.js (曲线图)
- Web Bluetooth API

## 运行

```bash
npm install
npm start
```

## 注意

- 需要 Chrome 浏览器（Web Bluetooth API）
- iOS Safari 不支持
- 需要 HTTPS 或 localhost 环境

## 配合硬件

STM32F103C8T6 + JDY-18 BLE + DHT11