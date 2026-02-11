
import { GoogleGenAI, Type } from "@google/genai";
import { PriceData } from "../types";

export const analyzeMarket = async (asset: string, data: PriceData[]) => {
  // Always use process.env.API_KEY for Gemini API
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  const marketSummary = data.slice(-20).map(d => 
    `Time: ${d.time}, C: ${d.close.toFixed(5)}, V: ${d.volume}, EMA10: ${d.ema10?.toFixed(5)}`
  ).join('\n');

  const prompt = `Analyze the following Forex market data for ${asset}. 
  Identify if there is a strong breakout or trend reversal. 
  Note the alignment of EMA 10, 20, and 50.
  Verify if volume supports the move.
  Data:
  ${marketSummary}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are a senior Forex Quant Trader specializing in Price Action and Volume Spread Analysis. Provide concise, high-probability signals.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trend: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
            confidence: { type: Type.NUMBER, description: "Scale 0 to 1" },
            reasoning: { type: Type.STRING },
            signal: { type: Type.STRING, description: "BUY, SELL, or WAIT" }
          },
          required: ["trend", "confidence", "reasoning", "signal"]
        }
      }
    });

    // Fixed: Accessed .text property instead of calling .text() method
    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
