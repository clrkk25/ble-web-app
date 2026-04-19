import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* 检测Web Bluetooth支持 */
const isBluetoothSupported = () => {
  return 'bluetooth' in navigator;
};

/* 检测设备类型 */
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/* 检测iOS */
const isIOS = () => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

function App() {
  const [status, setStatus] = useState('未连接');
  const [connected, setConnected] = useState(false);  /* 蓝牙连接状态 */
  const [temperature, setTemperature] = useState('--');
  const [humidity, setHumidity] = useState('--');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [temperatureData, setTemperatureData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [timeLabels, setTimeLabels] = useState([]);
  const [bluetoothSupported, setBluetoothSupported] = useState(true);
  const [mobileDevice, setMobileDevice] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  const characteristicRef = useRef(null);
  const deviceRef = useRef(null);
  const transmittingRef = useRef(false);  /* 用于闭包访问 */

  const maxDataPoints = 20;

  /* 初始化检测 */
  useEffect(() => {
    setBluetoothSupported(isBluetoothSupported());
    setMobileDevice(isMobile());
    setIosDevice(isIOS());
  }, []);

  const chartData = {
    labels: timeLabels,
    datasets: [
      {
        label: '温度 (°C)',
        data: temperatureData,
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.2)',
        tension: 0.4,
        fill: true
      },
      {
        label: '湿度 (%)',
        data: humidityData,
        borderColor: '#4ecdc4',
        backgroundColor: 'rgba(78, 205, 196, 0.2)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#eee', font: { size: 12 } }
      }
    },
    scales: {
      x: {
        ticks: { color: '#aaa', font: { size: 10 }, maxTicksLimit: 6 },
        grid: { color: 'rgba(255,255,255,0.1)' }
      },
      y: {
        ticks: { color: '#aaa', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.1)' },
        min: 0,
        max: 100
      }
    }
  };

  const parseSensorData = (text) => {
    const match = text.match(/T:(\d+)\s*H:(\d+)/);
    if (match) {
      return {
        temperature: parseInt(match[1]),
        humidity: parseInt(match[2])
      };
    }
    return null;
  };

  const addDataPoint = (temp, hum) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setTemperatureData(prev => {
      const newData = [...prev, temp];
      return newData.length > maxDataPoints ? newData.slice(-maxDataPoints) : newData;
    });

    setHumidityData(prev => {
      const newData = [...prev, hum];
      return newData.length > maxDataPoints ? newData.slice(-maxDataPoints) : newData;
    });

    setTimeLabels(prev => {
      const newData = [...prev, timeStr];
      return newData.length > maxDataPoints ? newData.slice(-maxDataPoints) : newData;
    });
  };

  const handleDataReceived = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value);

    console.log('收到数据:', text);

    if (text.includes('START')) {
      setIsTransmitting(true);
      transmittingRef.current = true;
      setStatus('正在传输');
    } else if (text.includes('STOP')) {
      setIsTransmitting(false);
      transmittingRef.current = false;
      setStatus('已停止');
    } else {
      /* 只有在传输状态才处理温湿度数据 */
      if (transmittingRef.current) {
        const data = parseSensorData(text);
        if (data) {
          setTemperature(data.temperature);
          setHumidity(data.humidity);
          addDataPoint(data.temperature, data.humidity);
        }
      }
    }
  };

  const sendCommand = async (cmd) => {
    if (!characteristicRef.current) {
      alert('请先连接蓝牙设备');
      return;
    }

    const encoder = new TextEncoder('utf-8');
    const data = encoder.encode(cmd);

    try {
      await characteristicRef.current.writeValue(data);
      console.log('发送命令:', cmd);
    } catch (error) {
      console.error('发送失败:', error);
      alert('发送失败，设备可能已断开');
    }
  };

  const handleStart = () => {
    setStatus('正在启动传输...');
    sendCommand('1');
    /* 不立即改变isTransmitting，等STM32回复START后再改变 */
  };

  const handleStop = () => {
    setStatus('正在停止传输...');
    sendCommand('0');
    /* 不立即改变isTransmitting，等STM32回复STOP后再改变 */
  };

  const connectBluetooth = async () => {
    if (!isBluetoothSupported()) {
      alert('您的浏览器不支持Web Bluetooth API');
      return;
    }

    try {
      setStatus('正在连接...');

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
      });

      deviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        setStatus('已断开');
        setConnected(false);
        setIsTransmitting(false);
        transmittingRef.current = false;
        characteristicRef.current = null;
        setTemperature('--');
        setHumidity('--');
      });

      const server = await device.gatt.connect();
      setStatus('已连接');
      setConnected(true);

      const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

      characteristicRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', handleDataReceived);
      await characteristic.startNotifications();

      setStatus('已连接，点击开始传输');

    } catch (error) {
      console.error('连接失败:', error);
      if (error.name === 'NotFoundError') {
        setStatus('未找到设备');
      } else if (error.name === 'SecurityError') {
        setStatus('权限被拒绝');
      } else {
        setStatus('连接失败');
      }
    }
  };

  const disconnectBluetooth = async () => {
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      await deviceRef.current.gatt.disconnect();
      setStatus('已断开');
      setConnected(false);
      setIsTransmitting(false);
      setTemperature('--');
      setHumidity('--');
    }
  };

  useEffect(() => {
    return () => {
      if (characteristicRef.current) {
        characteristicRef.current.removeEventListener('characteristicvaluechanged', handleDataReceived);
      }
    };
  }, []);

  /* 不支持Web Bluetooth时显示提示 */
  if (!bluetoothSupported) {
    return (
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>⚠️ 浏览器不支持</h1>
        <div style={{
          backgroundColor: '#16213e',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <p style={{ marginBottom: '15px', fontSize: '16px' }}>
            您的浏览器不支持 <strong>Web Bluetooth API</strong>
          </p>
          {iosDevice ? (
            <div>
              <p style={{ color: '#ff6b6b', marginBottom: '10px' }}>
                iOS Safari 完全不支持此功能
              </p>
              <p style={{ color: '#aaa', fontSize: '14px' }}>
                请使用 Android Chrome 浏览器
              </p>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: '10px' }}>请使用以下浏览器：</p>
              <ul style={{ color: '#4ecdc4', textAlign: 'left', paddingLeft: '20px' }}>
                <li>Chrome 70+ (Android/Windows/Mac)</li>
                <li>Edge 79+ (Windows/Mac)</li>
                <li>Opera 57+</li>
              </ul>
            </div>
          )}
        </div>
        <div style={{
          backgroundColor: '#1a1a2e',
          borderRadius: '10px',
          padding: '15px'
        }}>
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            当前设备: {mobileDevice ? '移动端' : 'PC端'}
          </p>
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            浏览器: {navigator.userAgent.split(' ').slice(-1)[0].split('/')[0]}
          </p>
        </div>
      </div>
    );
  }

  /* 正常界面 */
  return (
    <div style={{
      maxWidth: mobileDevice ? '100%' : '800px',
      margin: '0 auto',
      padding: mobileDevice ? '15px' : '20px'
    }}>
      <h1 style={{
        textAlign: 'center',
        marginBottom: mobileDevice ? '15px' : '30px',
        color: '#fff',
        fontSize: mobileDevice ? '20px' : '28px'
      }}>
        BLE温湿度监控
      </h1>

      <div style={{
        backgroundColor: '#16213e',
        borderRadius: '15px',
        padding: mobileDevice ? '15px' : '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <span style={{
              padding: '8px 12px',
              borderRadius: '5px',
              backgroundColor: status.includes('已连接') ? '#4ecdc4' : '#ff6b6b',
              fontSize: mobileDevice ? '12px' : '14px'
            }}>
              {status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {status.includes('已连接') ? (
              <button
                onClick={disconnectBluetooth}
                style={{
                  padding: mobileDevice ? '12px 16px' : '10px 20px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#ff6b6b',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: mobileDevice ? '14px' : '16px'
                }}
              >
                断开
              </button>
            ) : (
              <button
                onClick={connectBluetooth}
                style={{
                  padding: mobileDevice ? '12px 16px' : '10px 20px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#4ecdc4',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: mobileDevice ? '14px' : '16px'
                }}
              >
                连接蓝牙
              </button>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginBottom: '20px',
          gap: '10px'
        }}>
          <div style={{
            textAlign: 'center',
            padding: mobileDevice ? '15px' : '20px',
            backgroundColor: '#1a1a2e',
            borderRadius: '10px',
            width: mobileDevice ? '48%' : '45%'
          }}>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '10px' }}>温度</div>
            <div style={{
              fontSize: mobileDevice ? '36px' : '48px',
              fontWeight: 'bold',
              color: '#ff6b6b'
            }}>
              {temperature}°C
            </div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: mobileDevice ? '15px' : '20px',
            backgroundColor: '#1a1a2e',
            borderRadius: '10px',
            width: mobileDevice ? '48%' : '45%'
          }}>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '10px' }}>湿度</div>
            <div style={{
              fontSize: mobileDevice ? '36px' : '48px',
              fontWeight: 'bold',
              color: '#4ecdc4'
            }}>
              {humidity}%
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: mobileDevice ? '15px' : '20px'
        }}>
          <button
            onClick={handleStart}
            disabled={!connected || isTransmitting}
            style={{
              padding: mobileDevice ? '12px 24px' : '15px 30px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: isTransmitting ? '#666' : '#ff6b6b',
              color: '#fff',
              cursor: isTransmitting ? 'not-allowed' : 'pointer',
              fontSize: mobileDevice ? '14px' : '16px'
            }}
          >
            开始传输
          </button>
          <button
            onClick={handleStop}
            disabled={!connected || !isTransmitting}
            style={{
              padding: mobileDevice ? '12px 24px' : '15px 30px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: !isTransmitting ? '#666' : '#4ecdc4',
              color: '#fff',
              cursor: !isTransmitting ? 'not-allowed' : 'pointer',
              fontSize: mobileDevice ? '14px' : '16px'
            }}
          >
            停止传输
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: '#16213e',
        borderRadius: '15px',
        padding: mobileDevice ? '15px' : '20px',
        height: mobileDevice ? '200px' : '300px'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#eee', fontSize: mobileDevice ? '14px' : '18px' }}>
          实时曲线
        </h3>
        <Line data={chartData} options={chartOptions} />
      </div>

      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        color: '#666',
        fontSize: '12px'
      }}>
        <p>
          {mobileDevice ? '移动端' : 'PC端'} |
          {bluetoothSupported ? '✓ 支持BLE' : '✗ 不支持BLE'}
        </p>
        {mobileDevice && !iosDevice && (
          <p style={{ color: '#4ecdc4' }}>
            请使用Chrome浏览器并开启蓝牙权限
          </p>
        )}
      </div>
    </div>
  );
}

export default App;