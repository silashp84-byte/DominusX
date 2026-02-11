
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TradingChart } from './components/TradingChart';
import { 
  PriceData, 
  Asset, 
  Signal
} from './types';
import { 
  generateMockData, 
  detectBreakouts, 
  calculateEMA,
  calculateWyckoffTarget
} from './utils/marketLogic';
import { analyzeMarket } from './services/geminiService';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Activity, 
  Zap, 
  BrainCircuit, 
  Maximize, 
  Minimize, 
  BarChart3, 
  LineChart, 
  Plus, 
  Trash2,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Volume2,
  BellRing,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';

const ASSETS: Asset[] = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', currentPrice: 1.0854, change: 0.12 },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', currentPrice: 1.2645, change: -0.05 },
  { symbol: 'USD/JPY', name: 'US Dollar / Yen', currentPrice: 149.23, change: 0.45 },
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', currentPrice: 52140.00, change: 1.20 },
];

const TIMEFRAMES = ['1M', '5M', '15M'];

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [chartData, setChartData] = useState<PriceData[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [lastAlertTime, setLastAlertTime] = useState(0);
  const [currentWyckoffTarget, setCurrentWyckoffTarget] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeframe, setTimeframe] = useState('1M'); // Default to 1M
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [manualLines, setManualLines] = useState<number[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const speakSignal = useCallback(async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Atenção: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  useEffect(() => {
    // Correctly passing timeframe to mock generator
    const initialData = generateMockData(selectedAsset.currentPrice, 60, timeframe);
    setChartData(initialData);
    setSignals([]);
    setAiAnalysis(null);
    setCurrentWyckoffTarget(calculateWyckoffTarget(initialData));
  }, [selectedAsset, timeframe]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    // 1M update speed is faster for simulation feel
    const updateInterval = timeframe === '1M' ? 3000 : timeframe === '5M' ? 8000 : 15000;
    const interval = setInterval(() => {
      setChartData(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const tfMult = timeframe === '15M' ? 0.0008 : timeframe === '5M' ? 0.0005 : 0.0003;
        const volatility = last.close * tfMult;
        const change = (Math.random() - 0.5) * volatility;
        const newClose = last.close + change;
        
        const volumeSpike = Math.random() > 0.95 ? 4.5 : (Math.random() > 0.8 ? 2.5 : 1);
        
        const newDataPoint: PriceData = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: last.close,
          high: Math.max(last.close, newClose) + Math.random() * (volatility * 0.4),
          low: Math.min(last.close, newClose) - Math.random() * (volatility * 0.4),
          close: newClose,
          volume: Math.floor((Math.random() * 1000 + 400) * volumeSpike)
        };

        const updatedData = [...prev.slice(1), newDataPoint];
        const closes = updatedData.map(d => d.close);
        const ema10 = calculateEMA(closes, 10);
        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);

        const dataWithEMA = updatedData.map((d, i) => ({
          ...d,
          ema10: ema10[i],
          ema20: ema20[i],
          ema50: ema50[i]
        }));

        setCurrentWyckoffTarget(calculateWyckoffTarget(dataWithEMA));

        const breakout = detectBreakouts(dataWithEMA);
        if (breakout) {
          const now = Date.now();
          const isExceptionalVolume = breakout.volumeRatio >= 3.0;
          
          const newSignal: Signal = {
            id: Math.random().toString(36).substr(2, 9),
            asset: selectedAsset.symbol,
            type: breakout.type as any,
            strength: isExceptionalVolume ? 'STRONG' : 'MODERATE',
            price: breakout.price,
            timestamp: new Date(),
            details: `Rompimento em ${breakout.price.toFixed(5)} no gráfico de ${timeframe}.`
          };
          setSignals(s => [newSignal, ...s].slice(0, 10));

          if (now - lastAlertTime > 20000) { 
            const direction = breakout.type === 'BREAKOUT_UP' ? 'Compra' : 'Venda';
            speakSignal(`Oportunidade de ${direction} em ${selectedAsset.symbol}. Rompimento detectado.`);
            setLastAlertTime(now);
          }
        }
        return dataWithEMA;
      });
    }, updateInterval);
    return () => clearInterval(interval);
  }, [selectedAsset, lastAlertTime, speakSignal, timeframe]);

  const requestAIAnalysis = async () => {
    if (chartData.length === 0) return;
    setAiAnalysis({ loading: true });
    const result = await analyzeMarket(selectedAsset.symbol, chartData);
    setAiAnalysis(result);
    if (result && !result.loading) {
      speakSignal(`Análise IA para ${selectedAsset.symbol}: Tendência ${result.trend}. Sinal de ${result.signal}.`);
    }
  };

  const handleAddLine = () => {
    const lastPrice = chartData[chartData.length - 1]?.close;
    if (lastPrice) setManualLines([...manualLines, lastPrice]);
  };

  return (
    <div className="flex h-screen bg-[#050810] text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className={`bg-[#0A0F1C] border-r border-slate-800/50 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'} flex flex-col relative`}>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 mb-10 group cursor-pointer">
            <div className="bg-gradient-to-br from-emerald-500 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 uppercase">Forex Scalper</h1>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Optimized for 1M</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Markets Grid */}
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                Markets
              </p>
              <div className="grid grid-cols-1 gap-2">
                {ASSETS.map(asset => (
                  <button 
                    key={asset.symbol} 
                    onClick={() => setSelectedAsset(asset)} 
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border ${
                      selectedAsset.symbol === asset.symbol 
                        ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl' 
                        : 'hover:bg-slate-800/40 border-transparent text-slate-400'
                    }`}
                  >
                    <div className="text-left">
                      <p className={`font-black text-sm ${selectedAsset.symbol === asset.symbol ? 'text-white' : ''}`}>{asset.symbol}</p>
                      <p className="text-[10px] opacity-40">{asset.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold">{asset.currentPrice.toFixed(2)}</p>
                      <div className={`flex items-center justify-end gap-1 text-[10px] font-bold ${asset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {asset.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(asset.change)}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Box */}
            <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 p-5 backdrop-blur-md shadow-inner">
               <div className="flex items-center gap-3 mb-3 text-indigo-400">
                  <BellRing className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sinais de Voz</p>
               </div>
               <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                 Monitoramento ativo em tempo real. Alertando rompimentos de região e tendências no gráfico de <span className="text-emerald-400">1 Minuto</span>.
               </p>
            </div>

            {/* Breakout Signals */}
            <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 p-5 backdrop-blur-md">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Últimos Sinais</p>
                  <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
               </div>
               <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {signals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-20">
                      <Activity className="w-10 h-10 mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Scanning...</p>
                    </div>
                  ) : signals.map(s => (
                    <div 
                      key={s.id} 
                      className={`p-4 rounded-2xl border-l-4 transition-all duration-300 hover:bg-white/5 animate-in slide-in-from-left ${
                        s.type === 'BREAKOUT_UP' 
                          ? 'bg-emerald-500/5 border-emerald-500 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]' 
                          : 'bg-rose-500/5 border-rose-500 shadow-[inset_0_0_10px_rgba(239,68,68,0.05)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                            s.type === 'BREAKOUT_UP' ? 'bg-emerald-500 text-emerald-950' : 'bg-rose-500 text-rose-950'
                          }`}>
                            {s.type === 'BREAKOUT_UP' ? 'COMPRA' : 'VENDA'}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono font-bold">
                          {s.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-bold mb-1">{s.asset}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Preço: {s.price.toFixed(5)}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-12 bg-[#0A0F1C] border border-slate-800/50 rounded-r-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors z-[60] shadow-xl"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#050810] relative">
        <header className="h-20 border-b border-slate-800/40 flex items-center justify-between px-8 bg-[#050810]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800/50 shadow-inner">
              {TIMEFRAMES.map(tf => (
                <button 
                  key={tf} 
                  onClick={() => setTimeframe(tf)} 
                  className={`px-5 py-2 text-xs font-black rounded-xl transition-all duration-300 ${
                    timeframe === tf ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-slate-800/50" />
            <div className="hidden md:flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Feed Ativo: 1M Interval</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800/50">
               <button 
                onClick={() => setChartType('line')} 
                className={`p-2.5 rounded-xl transition-all duration-200 ${chartType === 'line' ? 'bg-slate-800 text-indigo-400 shadow-inner' : 'text-slate-600 hover:text-slate-400'}`}
                title="Linha"
              >
                <LineChart className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setChartType('candle')} 
                className={`p-2.5 rounded-xl transition-all duration-200 ${chartType === 'candle' ? 'bg-slate-800 text-indigo-400 shadow-inner' : 'text-slate-600 hover:text-slate-400'}`}
                title="Velas"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={handleAddLine} className="p-2.5 bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 rounded-xl text-slate-400 transition-all hover:scale-110 active:scale-95" title="Suporte/Resistência"><Plus className="w-5 h-5" /></button>
              <button onClick={() => setManualLines([])} className="p-2.5 bg-slate-900/50 border border-slate-800/50 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl text-slate-400 transition-all" title="Limpar"><Trash2 className="w-4 h-4" /></button>
              <button onClick={toggleFullscreen} className="p-2.5 bg-slate-900/50 border border-slate-800/50 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-xl text-slate-400 transition-all">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>

            <button 
              onClick={requestAIAnalysis} 
              disabled={isSpeaking || chartData.length === 0}
              className={`flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black tracking-widest shadow-xl shadow-emerald-600/30 transition-all active:scale-95 border border-white/10 ${isSpeaking || chartData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BrainCircuit className="w-4 h-4" />
              IA QUANT
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 grid grid-cols-12 gap-8 overflow-y-auto custom-scrollbar">
          <div className="col-span-12 xl:col-span-9 space-y-8">
            <div ref={chartContainerRef} className={`bg-[#0A0F1C] rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-slate-800/30 transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen rounded-none' : 'h-[600px]'}`}>
              <TradingChart 
                data={chartData} 
                asset={selectedAsset.symbol} 
                wyckoffTarget={currentWyckoffTarget}
                chartType={chartType}
                manualLines={manualLines}
              />
              {isFullscreen && (
                <button onClick={toggleFullscreen} className="absolute top-8 right-8 z-[110] bg-slate-900/90 p-4 rounded-2xl hover:bg-indigo-600 border border-slate-700 backdrop-blur-md shadow-2xl transition-all">
                  <Minimize className="w-6 h-6 text-white" />
                </button>
              )}
            </div>

            {/* Indicator Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0A0F1C] p-6 rounded-[2rem] border border-slate-800/40 shadow-xl transition-all duration-300">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-indigo-400" /> Médias Móveis (EMA)
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-bold">EMA 10</span><span className="font-mono text-sm font-black text-cyan-400">{chartData[chartData.length-1]?.ema10?.toFixed(5) || '---'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-bold">EMA 20</span><span className="font-mono text-sm font-black text-yellow-400">{chartData[chartData.length-1]?.ema20?.toFixed(5) || '---'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-bold">EMA 50</span><span className="font-mono text-sm font-black text-pink-400">{chartData[chartData.length-1]?.ema50?.toFixed(5) || '---'}</span></div>
                </div>
              </div>

              <div className="bg-[#0A0F1C] p-6 rounded-[2rem] border border-slate-800/40 shadow-xl transition-all duration-300">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Target className="w-3 h-3 text-emerald-400" /> Alvo Wyckoff ({timeframe})
                </p>
                <div className="flex flex-col justify-center h-full pb-2">
                  <p className="text-2xl font-black text-emerald-400 font-mono mb-2 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{currentWyckoffTarget?.toFixed(5) || '---'}</p>
                  <div className="bg-slate-800/50 h-2 rounded-full overflow-hidden border border-slate-700/50">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-1000" 
                      style={{ width: `${chartData.length > 0 ? Math.min(((chartData[chartData.length-1].volume || 0) / 2500) * 100, 100) : 0}%` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#0A0F1C] p-6 rounded-[2rem] border border-slate-800/40 shadow-xl transition-all duration-300">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <TrendingDown className="w-3 h-3 text-rose-400" /> Volatilidade Atual
                </p>
                <div className="flex items-center gap-4 h-full pb-2">
                   <p className="text-2xl font-black text-rose-400 font-mono">
                     {chartData.length > 1 ? (Math.abs(chartData[chartData.length-1].close - chartData[chartData.length-2].close) * 10000).toFixed(1) : '0.0'}
                     <span className="text-[10px] ml-1 text-slate-500">PIPS</span>
                   </p>
                </div>
              </div>
            </div>
          </div>

          {/* Intelligence Column */}
          <div className="col-span-12 xl:col-span-3">
             <div className="bg-[#0A0F1C] rounded-[2.5rem] border border-slate-800/40 p-8 shadow-2xl h-full flex flex-col group relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                      <BrainCircuit className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-400">Trading Intelligence</h3>
                  </div>
                  
                  {aiAnalysis ? (
                    aiAnalysis.loading ? (
                      <div className="space-y-4 mt-4">
                        <div className="h-4 bg-slate-800/50 rounded-xl animate-pulse w-full" />
                        <div className="h-4 bg-slate-800/50 rounded-xl animate-pulse w-4/5" />
                        <div className="h-20 bg-slate-800/20 rounded-2xl animate-pulse w-full" />
                      </div>
                    ) : (
                      <div className="animate-in fade-in duration-700">
                        <div className={`text-sm font-black mb-4 flex items-center gap-2 px-4 py-2 rounded-xl border ${
                          aiAnalysis.signal === 'BUY' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : aiAnalysis.signal === 'SELL' 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                              : 'bg-slate-800/50 text-slate-400 border-slate-700/30'
                        }`}>
                          {aiAnalysis.signal === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : aiAnalysis.signal === 'SELL' ? <ArrowDownRight className="w-4 h-4" /> : null}
                          {aiAnalysis.signal} CONFORMADO ({(aiAnalysis.confidence * 100).toFixed(0)}%)
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium italic border-l-2 border-emerald-500/30 pl-4 py-1">
                          "{aiAnalysis.reasoning}"
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="mt-4 p-8 border border-dashed border-slate-800 rounded-3xl text-center bg-white/[0.02]">
                      <p className="text-[10px] text-slate-600 font-black uppercase mb-6 tracking-widest">Aguardando Solicitação</p>
                      <button onClick={requestAIAnalysis} className="text-xs font-black text-emerald-400 hover:text-emerald-300 transition-all underline underline-offset-8 decoration-emerald-500/30">OBTER INSIGHT IA</button>
                    </div>
                  )}
                </div>

                <div className="flex-1 border-t border-slate-800/40 pt-8 mt-auto">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Métricas do Par</p>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500 font-bold uppercase">Preço Médio 1H</span>
                        <span className="font-mono text-slate-300">{(chartData.reduce((a,b)=>a+b.close,0)/chartData.length).toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500 font-bold uppercase">Variação Candle</span>
                        <span className={`font-mono font-black ${chartData.length > 0 && chartData[chartData.length-1].close >= chartData[chartData.length-1].open ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {chartData.length > 0 ? ((chartData[chartData.length-1].close / chartData[chartData.length-1].open - 1)*100).toFixed(3) : '0.000'}%
                        </span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #10b981; }
        @keyframes slide-in-from-left { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;
