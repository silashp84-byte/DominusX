
export interface PriceData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema10?: number;
  ema20?: number;
  ema50?: number;
}

export interface Signal {
  id: string;
  asset: string;
  type: 'BREAKOUT_UP' | 'BREAKOUT_DOWN' | 'TREND_CHANGE';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  price: number;
  timestamp: Date;
  details: string;
}

export interface Asset {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
}

export enum MarketTrend {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL'
}

export interface Order {
  id: string;
  asset: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  sl: number;
  tp: number;
  timestamp: Date;
  status: 'OPEN' | 'CLOSED';
}
