
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  
  private captions = [
    "Xinh xỉu luôn á! ✨",
    "Giao diện trưởng thành, hệ điều hành cute 🎀",
    "Hôm nay trời đẹp, nhưng không bằng tui ☀️",
    "Vibe này đỉnh nóc kịch trần ☁️",
    "Trạng thái: Đang rất yêu đời 💖",
    "Keo lì tái châu 💅",
    "Cười xinh lung linh 📸",
    "Mười điểm không có nhưng 💯",
    "Dễ thương lạc lối 🌸",
    "Em bé ngoan xinh yêu đây rồi 🥰",
    "Độc lạ Bình Dương nhưng mà cute 😽"
  ];

  constructor() {}

  async generateCuteCaption(base64Image: string): Promise<string> {
    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    // Return a random caption
    const randomIndex = Math.floor(Math.random() * this.captions.length);
    return this.captions[randomIndex];
  }
}
