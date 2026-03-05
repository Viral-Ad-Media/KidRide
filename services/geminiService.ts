import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }
  return aiClient;
};

export const generateSafetyResponse = async (userMessage: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash';
    
    const systemInstruction = `
      You are the "KidRide Safety Assistant". Your goal is to help parents and children stay safe.
      KidRide is an app for arranging rides for kids with verified drivers or trusted parent carpools.
      
      Key features to know:
      1. Trip Codes: A unique 4-digit code provided to the parent/child and the driver. They must match.
      2. Safe Words: A secret word the parent sets, which the driver must say to the child.
      3. Live Tracking: Parents can see the car in real-time.
      4. Verified Drivers: Background checked professionals.
      5. Team Parents: Other parents from the same team helping with carpools.
      
      Answer questions about how to use these features, general safety advice, or help find a ride type.
      Keep answers concise, reassuring, and friendly.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I'm having trouble connecting to the safety network right now. Please try again.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I apologize, but I cannot process your request at the moment. Please ensure your API key is configured.";
  }
};
