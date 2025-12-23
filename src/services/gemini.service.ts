
import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    // Assuming process.env.API_KEY is available in this environment
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateCuteCaption(base64Image: string): Promise<string> {
    try {
      // Remove data URL header if present
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: cleanBase64
              }
            },
            {
              text: 'Hãy nhìn bức ảnh photobooth này. Hãy viết 1 câu caption thật ngắn gọn (dưới 15 từ), cực kỳ dễ thương, vui tươi bằng tiếng Việt dành cho gen Z. Có thể dùng emoji. Đừng mô tả dài dòng, chỉ cần caption vibe thôi.'
            }
          ]
        }
      });

      return response.text || 'Xinh xỉu luôn á! ✨';
    } catch (error) {
      console.error('Gemini API Error:', error);
      return 'Lỗi kết nối vũ trụ cute 😿';
    }
  }
}
