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

function App() {
  const [status, setStatus] = useState('未连接');
  const [temperature, setTemperature] = useState('--');
  const [humidity, setHumidity] = useState('--');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [temperatureData, setTemperatureData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [timeLabels, setTimeLabels] = useState([]);

  const characteristicRef = useRef(null);
  const deviceRef = useRef(null);

  const maxDataPoints = 30;

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
        labels: { color: '#eee' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#aaa' },
        grid: { color: 'rgba(255,255,255,0.1)' }
      },
      y: {
        ticks: { color: '#aaa' },
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
      setStatus('正在传输数据');
    } else if (text.includes('STOP')) {
      setIsTransmitting(false);
      setStatus('已停止传输');
    } else {
      const data = parseSensorData(text);
      if (data) {
        setTemperature(data.temperature);
        setHumidity(data.humidity);
        addDataPoint(data.temperature, data.humidity);
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
    }
  };

  const handleStart = () => {
    sendCommand('1');
    setIsTransmitting(true);
  };

  const handleStop = () => {
    sendCommand('0');
    setIsTransmitting(false);
  };

  const connectBluetooth = async () => {
    try {
      setStatus('正在连接...');

      /* Web Bluetooth: 浏览器会弹出设备选择对话框 */
      const device = await navigator.bluetooth.requestDevice({
        /* 接受所有设备，让用户在浏览器弹窗中选择 */
        acceptAllDevices: true,
        optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
      });

      deviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        setStatus('已断开');
        setIsTransmitting(false);
        characteristicRef.current = null;
      });

      const server = await device.gatt.connect();
      setStatus('已连接');

      const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

      characteristicRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', handleDataReceived);
      await characteristic.startNotifications();

      setStatus('已连接，等待数据');

    } catch (error) {
      console.error('连接失败:', error);
      setStatus('连接失败: ' + error.message);
    }
  };

  const disconnectBluetooth = async () => {
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      await deviceRef.current.gatt.disconnect();
      setStatus('已断开');
      setIsTransmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (characteristicRef.current) {
        characteristicRef.current.removeEventListener('characteristicvaluechanged', handleDataReceived);
      }
    };
  }, []);

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h1 style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: '#fff'
      }}>
        BLE温湿度监控
      </h1>

      <div style={{
        backgroundColor: '#16213e',
        borderRadius: '15px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div>
            <span style={{
              padding: '8px 16px',
              borderRadius: '5px',
              backgroundColor: status.includes('已连接') ? '#4ecdc4' : '#ff6b6b',
              fontSize: '14px'
            }}>
              {status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {status.includes('已连接') ? (
              <button
                onClick={disconnectBluetooth}
                style={{
                  padding: '10px 20px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#ff6b6b',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                断开连接
              </button>
            ) : (
              <button
                onClick={connectBluetooth}
                style={{
                  padding: '10px 20px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#4ecdc4',
                  color: '#fff',
                  cursor: 'pointer'
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
          marginBottom: '20px'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#1a1a2e',
            borderRadius: '10px',
            width: '45%'
          }}>
            <div style={{ fontSize: '16px', color: '#aaa', marginBottom: '10px' }}>温度</div>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#ff6b6b'
            }}>
              {temperature}°C
            </div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#1a1a2e',
            borderRadius: '10px',
            width: '45%'
          }}>
            <div style={{ fontSize: '16px', color: '#aaa', marginBottom: '10px' }}>湿度</div>
            <div style={{
              fontSize: '48px',
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
          gap: '20px'
        }}>
          <button
            onClick={handleStart}
            disabled={!status.includes('已连接') || isTransmitting}
            style={{
              padding: '15px 30px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: isTransmitting ? '#666' : '#ff6b6b',
              color: '#fff',
              cursor: isTransmitting ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            开始传输
          </button>
          <button
            onClick={handleStop}
            disabled={!status.includes('已连接') || !isTransmitting}
            style={{
              padding: '15px 30px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: !isTransmitting ? '#666' : '#4ecdc4',
              color: '#fff',
              cursor: !isTransmitting ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            停止传输
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: '#16213e',
        borderRadius: '15px',
        padding: '20px',
        height: '300px'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#eee' }}>实时曲线</h3>
        <Line data={chartData} options={chartOptions} />
      </div>

      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        color: '#666',
        fontSize: '12px'
      }}>
        <p>注意: Web Bluetooth API 需要Chrome浏览器</p>
        <p>手机需使用Android Chrome，iOS Safari不支持</p>
      </div>
    </div>
  );
}

export default App;