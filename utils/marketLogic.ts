
import { PriceData } from '../types';

export const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

export const calculateWyckoffTarget = (data: PriceData[]): number | null => {
  if (data.length < 5) return null;
  const current = data[data.length - 1];
  const slice = data.slice(data.length - 6, data.length - 1);
  const avgVolume = slice.reduce((acc, d) => acc + d.volume, 0) / slice.length;
  const avgSpread = slice.reduce((acc, d) => acc + (d.high - d.low), 0) / slice.length;

  const effortResultRatio = (current.volume / avgVolume);
  
  const momentum = current.close - current.open;
  const direction = momentum >= 0 ? 1 : -1;
  
  const projection = direction * avgSpread * (1 + (effortResultRatio - 1) * 0.5);
  
  return current.close + projection;
};

export const detectBreakouts = (data: PriceData[], period: number = 20) => {
  if (data.length < period + 1) return null;

  const current = data[data.length - 1];
  const slice = data.slice(data.length - (period + 1), data.length - 1);
  
  const highRegion = Math.max(...slice.map(d => d.high));
  const lowRegion = Math.min(...slice.map(d => d.low));
  const avgVolume = slice.reduce((acc, d) => acc + d.volume, 0) / period;

  const volumeRatio = current.volume / avgVolume;
  const volumeConfirmed = volumeRatio > 1.5;

  if (current.close > highRegion && volumeConfirmed) {
    return { type: 'BREAKOUT_UP', price: current.close, level: highRegion, volumeRatio };
  }
  
  if (current.close < lowRegion && volumeConfirmed) {
    return { type: 'BREAKOUT_DOWN', price: current.close, level: lowRegion, volumeRatio };
  }

  return null;
};

export const generateMockData = (basePrice: number, count: number = 100, timeframe: string = '1M'): PriceData[] => {
  let currentPrice = basePrice;
  const data: PriceData[] = [];
  const now = new Date();
  
  // Set interval based on timeframe
  const intervalMs = timeframe === '15M' ? 15 * 60000 : timeframe === '5M' ? 5 * 60000 : 60000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * (basePrice * 0.002);
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.0005);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.0005);
    const volume = Math.floor(Math.random() * 1000) + 500;
    
    const time = new Date(now.getTime() - (count - i) * intervalMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    data.push({ time, open, high, low, close, volume });
    currentPrice = close;
  }

  const closes = data.map(d => d.close);
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  return data.map((d, i) => ({
    ...d,
    ema10: ema10[i],
    ema20: ema20[i],
    ema50: ema50[i],
  }));
};
