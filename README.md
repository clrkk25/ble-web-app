# BLE 温湿度监控 Web App

基于 Web Bluetooth API 的温湿度实时监控前端。

## 功能

- 连接 JDY-18 BLE 蓝牙模块
- 实时显示温湿度数值
- 实时曲线图展示
- 开始/停止数据传输控制
- **传输频率选择**（0.5秒/1秒/2秒）

## 技术栈

- React 18
- Chart.js (曲线图)
- Web Bluetooth API

## 运行

```bash
npm install
npm start
```

## 命令格式

| 前端发送 | STM32回复 | 说明 |
|---------|----------|------|
| `1` | `START` | 开始传输 |
| `0` | `STOP` | 停止传输 |
| `F:500` | `FREQ:500` | 0.5秒间隔 |
| `F:1000` | `FREQ:1000` | 1秒间隔 |
| `F:2000` | `FREQ:2000` | 2秒间隔 |

## 数据格式

STM32发送：`T:25 H:60`（温度25°C，湿度60%）

## 浏览器兼容性

| 浏览器 | 支持情况 |
|--------|----------|
| Chrome 70+ (Windows/Mac/Android) | ✓ 支持 |
| Edge 79+ | ✓ 支持 |
| Safari (iOS) | ✗ 不支持 |
| Firefox | ✗ 不支持 |

## 配合硬件

STM32F103C8T6 + JDY-18 BLE + DHT11

## 硬件接线

| JDY-18 | STM32 |
|--------|-------|
| TX | PB11 |
| RX | PB10 |
| VCC | 3.3V |
| GND | GND |

| DHT11 | STM32 |
|--------|-------|
| DATA | PA0 |
| VCC | 3.3V/5V |
| GND | GND |