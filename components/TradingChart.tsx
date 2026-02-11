
import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Label,
  Cell,
  Brush
} from 'recharts';
import { PriceData } from '../types';

interface Props {
  data: PriceData[];
  asset: string;
  wyckoffTarget: number | null;
  chartType: 'line' | 'candle';
  manualLines: number[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0D1322] border border-slate-700/50 p-4 rounded-2xl shadow-2xl text-xs font-mono backdrop-blur-xl">
        <p className="text-slate-500 mb-2 border-b border-slate-800 pb-2 flex justify-between uppercase text-[10px] font-black">
          <span>{label}</span>
          <span className="text-indigo-400">DATA FEED</span>
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2">
          <p className="text-slate-500 uppercase text-[9px] font-black">Open</p>
          <p className="text-white text-right font-bold">{data.open.toFixed(5)}</p>
          <p className="text-slate-500 uppercase text-[9px] font-black">High</p>
          <p className="text-emerald-400 text-right font-bold">{data.high.toFixed(5)}</p>
          <p className="text-slate-500 uppercase text-[9px] font-black">Low</p>
          <p className="text-rose-400 text-right font-bold">{data.low.toFixed(5)}</p>
          <p className="text-slate-500 uppercase text-[9px] font-black">Close</p>
          <p className="text-white text-right font-bold">{data.close.toFixed(5)}</p>
          <p className="text-slate-500 uppercase text-[9px] font-black">Volume</p>
          <p className="text-indigo-400 text-right font-bold">{data.volume}</p>
        </div>
      </div>
    );
  }
  return null;
};

const Candlestick = (props: any) => {
  const { x, y, width, height, low, high, open, close, yAxis } = props;
  
  // Safety check to prevent "Cannot read properties of undefined (reading 'scale')"
  if (!yAxis || typeof yAxis.scale !== 'function') {
    return null;
  }

  const isUp = close >= open;
  const color = isUp ? "#10b981" : "#ef4444";
  
  const highY = yAxis.scale(high);
  const lowY = yAxis.scale(low);
  const centerX = x + width / 2;

  return (
    <g>
      <line 
        x1={centerX} 
        y1={lowY} 
        x2={centerX} 
        y2={highY} 
        stroke={color} 
        strokeWidth={1.2} 
        opacity={0.8}
      />
      <rect 
        x={x} 
        y={y} 
        width={width} 
        height={Math.max(2, height)} 
        fill={color} 
        rx={1}
      />
    </g>
  );
};

export const TradingChart: React.FC<Props> = ({ data, asset, wyckoffTarget, chartType, manualLines }) => {
  const [range, setRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const visibleData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const start = range.startIndex ?? 0;
    const end = range.endIndex ?? (data.length - 1);
    return data.slice(Math.max(0, start), Math.min(data.length, end + 1));
  }, [data, range]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (visibleData.length === 0) return { minPrice: 0, maxPrice: 1 };
    
    const prices = visibleData.flatMap(d => [d.low, d.high]);
    if (wyckoffTarget) prices.push(wyckoffTarget);
    manualLines.forEach(l => prices.push(l));

    return {
      minPrice: Math.min(...prices) * 0.9998,
      maxPrice: Math.max(...prices) * 1.0002
    };
  }, [visibleData, wyckoffTarget, manualLines]);

  const lastPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const targetColor = wyckoffTarget && wyckoffTarget > lastPrice ? "#10b981" : "#ef4444";

  const handleBrushChange = (newRange: any) => {
    setRange({ startIndex: newRange.startIndex, endIndex: newRange.endIndex });
  };

  if (data.length === 0) {
    return (
      <div className="w-full h-full bg-[#0A0F1C] flex items-center justify-center rounded-[2.5rem] border border-slate-800/30">
        <div className="flex flex-col items-center gap-4 opacity-20">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading Market Stream</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0A0F1C] p-6 pb-2 rounded-[2.5rem] relative overflow-hidden group/chart flex flex-col">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
      />
      
      <div className="absolute top-8 left-10 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">{asset}</h2>
          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Live</span>
          </div>
        </div>
        {wyckoffTarget && (
          <div 
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-xl transition-colors duration-500"
            style={{ backgroundColor: `${targetColor}10`, borderColor: `${targetColor}30`, color: targetColor }}
          >
            Target: {wyckoffTarget.toFixed(5)}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 100, right: 80, left: 10, bottom: 0 }}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="6 6" stroke="#1e293b" vertical={false} opacity={0.2} />
            <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} tick={{ fontWeight: 800, opacity: 0.6 }} />
            <YAxis 
              domain={[minPrice, maxPrice]} 
              orientation="right" 
              stroke="#475569" 
              fontSize={9} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => val.toFixed(4)}
              tick={{ fontWeight: 800, fill: '#64748b' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeDasharray: '4 4', strokeWidth: 1 }} />
            
            {chartType === 'line' ? (
              <Line 
                type="monotone" 
                dataKey="close" 
                stroke="#f8fafc" 
                strokeWidth={3} 
                dot={false} 
                isAnimationActive={false}
                filter="url(#glow)"
              />
            ) : (
              <Bar 
                dataKey="close" 
                shape={<Candlestick />} 
                isAnimationActive={false}
              >
                 {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            )}

            {/* EMA Group */}
            <Line type="monotone" dataKey="ema10" stroke="#22d3ee" strokeWidth={1.5} dot={false} strokeDasharray="4 4" opacity={0.4} isAnimationActive={false} />
            <Line type="monotone" dataKey="ema20" stroke="#fbbf24" strokeWidth={1.5} dot={false} opacity={0.4} isAnimationActive={false} />
            <Line type="monotone" dataKey="ema50" stroke="#f472b6" strokeWidth={1.5} dot={false} opacity={0.4} isAnimationActive={false} />

            {/* Dynamic Target Line */}
            {wyckoffTarget && (
              <ReferenceLine y={wyckoffTarget} stroke={targetColor} strokeWidth={2.5} strokeDasharray="8 6" className="animate-pulse">
                <Label 
                  value="PROJECTED TARGET" 
                  position="right" 
                  fill={targetColor} 
                  fontSize={9} 
                  fontWeight="900" 
                  className="font-mono tracking-widest"
                  offset={10}
                />
              </ReferenceLine>
            )}

            {/* Manual Levels */}
            {manualLines.map((price, i) => (
              <ReferenceLine key={i} y={price} stroke="#6366f1" strokeWidth={2} opacity={0.7} strokeDasharray="3 3">
                <Label value={`LEVEL ${i+1}`} position="left" fill="#6366f1" fontSize={8} fontWeight="900" offset={10} />
              </ReferenceLine>
            ))}

            <Brush
              dataKey="time"
              height={30}
              stroke="#4f46e5"
              fill="#0A0F1C"
              onChange={handleBrushChange}
              travellerWidth={10}
              gap={5}
              style={{ fontSize: '10px', opacity: 0.8 }}
            >
              <ComposedChart>
                <Line dataKey="close" stroke="#4f46e5" dot={false} strokeWidth={1} isAnimationActive={false} />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="h-6 flex items-center justify-center text-[8px] font-black uppercase tracking-[0.3em] text-slate-600 pointer-events-none">
        Use the slider below to zoom & pan analysis
      </div>
    </div>
  );
};
