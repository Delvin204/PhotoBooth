
import { Component, ElementRef, ViewChild, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';

// --- Interfaces ---
interface Filter {
  id: string;
  name: string;
  cssClass: string;
  ctxFilter: string;
  overlayColor?: string; // For vintage tints
}

interface PresetDecoration {
  content: string;
  xPct: number; // Percentage 0-1 relative to canvas width
  yPct: number; // Percentage 0-1 relative to canvas height
  size: number; // Base font size multiplier
  rotation: number;
}

interface FrameLayout {
  id: string;
  name: string;
  rows: number;
  cols: number;
  gap: number;
  padding: number;
  bgColor: string;
  aspectRatio: number; // width / height of a single cell
  decorations?: PresetDecoration[]; // New: Hardcoded stickers for this frame
}

interface CapturedShot {
  dataUrl: string;
  filterId: string;
}

type AppMode = 'setup' | 'capturing' | 'review' | 'decorate';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('finalCanvas') finalCanvas!: ElementRef<HTMLCanvasElement>;

  // --- Signals for State ---
  mode = signal<AppMode>('setup');
  stream = signal<MediaStream | null>(null);
  error = signal<string | null>(null);
  
  // Setup Choices
  selectedFilter = signal<Filter>(this.getFilters()[0]);
  selectedFrame = signal<FrameLayout>(this.getFrames()[0]);
  timerDuration = signal<number>(3); // 3, 5, 10
  
  // Capture Process
  shots = signal<CapturedShot[]>([]); // Photos taken so far
  tempShot = signal<string | null>(null); // The photo just taken (for review)
  isProcessing = signal<boolean>(false);
  countdown = signal<number | null>(null);
  flashActive = signal<boolean>(false);

  finalResultUrl = signal<string | null>(null);
  aiCaption = signal<string>('');
  isGeneratingCaption = signal<boolean>(false);

  // Constants / Data
  filters: Filter[] = this.getFilters();
  frames: FrameLayout[] = this.getFrames();

  constructor() {
    effect(() => {
      // Auto-draw composite when entering decorate mode
      if (this.mode() === 'decorate') {
        setTimeout(() => this.drawComposite(), 100);
      }
    });
  }

  ngOnInit() {
    this.startCamera();
  }

  // --- Data Providers ---
  getFilters(): Filter[] {
    return [
      { id: 'normal', name: 'Tự nhiên', cssClass: '', ctxFilter: 'none' },
      { id: 'korean', name: 'Hàn Quốc', cssClass: 'brightness-110 contrast-[0.9] saturate-[1.1] sepia-[0.1]', ctxFilter: 'brightness(1.1) contrast(0.9) saturate(1.1) sepia(0.1)' },
      { id: 'peach', name: 'Đào Tươi', cssClass: 'brightness-110 saturate-150 contrast-[0.9] sepia-[0.2]', ctxFilter: 'brightness(1.1) saturate(1.5) contrast(0.9) sepia(0.2)' },
      { id: 'vintage', name: 'Phim Cũ', cssClass: 'sepia-[0.4] contrast-125 grayscale-[0.2]', ctxFilter: 'sepia(0.4) contrast(1.25) grayscale(0.2)' },
      { id: 'retro90s', name: '1990s', cssClass: 'contrast-125 brightness-90 saturate-150 sepia-[0.2]', ctxFilter: 'contrast(1.25) brightness(0.9) saturate(1.5) sepia(0.2)' },
      { id: 'summer', name: 'Mùa Hè', cssClass: 'brightness-110 saturate-[1.8] contrast-[0.9] sepia-[0.1]', ctxFilter: 'brightness(1.1) saturate(1.8) contrast(0.9) sepia(0.1)' },
      { id: 'bw', name: 'Đen Trắng', cssClass: 'grayscale contrast-125 brightness-110', ctxFilter: 'grayscale(1) contrast(1.25) brightness(1.1)' },
      { id: 'dreamy', name: 'Mơ Mộng', cssClass: 'brightness-125 saturate-50 hue-rotate-15', ctxFilter: 'brightness(1.25) saturate(0.5) hue-rotate(15deg)' },
      { id: 'lomo', name: 'Lomo', cssClass: 'contrast-[1.4] saturate-[1.3]', ctxFilter: 'contrast(1.4) saturate(1.3)' },
      { id: 'cool', name: 'Lạnh Lùng', cssClass: 'saturate-50 contrast-110 brightness-110 hue-rotate-[10deg]', ctxFilter: 'saturate(0.5) contrast(1.1) brightness(1.1) hue-rotate(10deg)' },
    ];
  }

  getFrames(): FrameLayout[] {
    return [
      { 
        id: 'strip-4', 
        name: 'Dọc 4 Ảnh', 
        rows: 4, cols: 1, 
        gap: 20, padding: 50, // Increased padding slightly for stickers 
        bgColor: '#ffffff', 
        aspectRatio: 4/3,
        decorations: [
          { content: '🎀', xPct: 0.5, yPct: 0.03, size: 2.5, rotation: 0 }, // Top Center Bow
          { content: '✨', xPct: 0.1, yPct: 0.97, size: 1.5, rotation: -15 }, // Bottom Left
          { content: '✨', xPct: 0.9, yPct: 0.97, size: 1.5, rotation: 15 },  // Bottom Right
        ]
      },
      { 
        id: 'grid-4', 
        name: 'Vuông 4 Ảnh', 
        rows: 2, cols: 2, 
        gap: 20, padding: 50, 
        bgColor: '#fce7f3', 
        aspectRatio: 1,
        decorations: [
          { content: '👑', xPct: 0.5, yPct: 0.04, size: 2.0, rotation: 0 }, // Crown top
          { content: '🌸', xPct: 0.5, yPct: 0.5, size: 1.2, rotation: 0 },  // Center flower
          { content: '🍓', xPct: 0.05, yPct: 0.95, size: 1.5, rotation: -20 }, // Corner
          { content: '🍓', xPct: 0.95, yPct: 0.95, size: 1.5, rotation: 20 }, // Corner
        ]
      },
      { 
        id: 'grid-6', 
        name: 'Chữ Nhật 6 Ảnh', 
        rows: 2, cols: 3, 
        gap: 15, padding: 40, 
        bgColor: '#fff1f2', 
        aspectRatio: 1,
        decorations: [
          { content: '🌈', xPct: 0.92, yPct: 0.05, size: 2.0, rotation: 10 },
          { content: '☁️', xPct: 0.08, yPct: 0.05, size: 2.0, rotation: -10 },
          { content: '❤️', xPct: 0.5, yPct: 0.95, size: 1.5, rotation: 0 },
        ]
      },
    ];
  }

  // --- Camera Logic ---
  async startCamera() {
    this.error.set(null);
    try {
      // 1. Try Ideal Settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, 
        audio: false 
      });
      this.stream.set(stream);
    } catch (err) {
      console.warn('HD Camera failed, retrying with basic settings...', err);
      try {
        // 2. Fallback: Basic Settings
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        this.stream.set(stream);
      } catch (fallbackErr: any) {
        // 3. Handle Errors
        console.error('Camera access failed:', fallbackErr);
        let msg = 'Không thể truy cập camera. 😿';
        
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          msg = 'Bạn cần cấp quyền Camera để ứng dụng hoạt động nhé! 🔓';
        } else if (fallbackErr.name === 'NotFoundError') {
          msg = 'Không tìm thấy camera trên thiết bị này. 📷';
        } else if (fallbackErr.name === 'NotReadableError') {
          msg = 'Camera đang bị ứng dụng khác chiếm dụng. 🚫';
        }
        
        this.error.set(msg);
      }
    }
  }

  // --- Workflow Actions ---
  startSession() {
    // Clear state for new session (Moved here from enterCaptureMode)
    this.shots.set([]);
    this.aiCaption.set('');
    this.finalResultUrl.set(null);

    // If we don't have a stream, try starting camera again
    if (!this.stream()) {
      this.startCamera().then(() => {
        if (this.stream()) this.enterCaptureMode();
      });
    } else {
      this.enterCaptureMode();
    }
  }

  enterCaptureMode() {
    // NOTE: Do NOT clear shots here, or we lose progress when coming back from 'review'
    this.mode.set('capturing');

    // CRITICAL: Attach stream to video element once it renders
    setTimeout(() => {
      if (this.videoElement && this.stream()) {
        this.videoElement.nativeElement.srcObject = this.stream();
      }
    }, 50);
  }

  triggerTimer() {
    if (this.isProcessing() || this.countdown() !== null) return;
    
    let count = this.timerDuration();
    this.countdown.set(count);
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdown.set(count);
      } else {
        clearInterval(interval);
        this.countdown.set(null);
        this.capturePhoto();
      }
    }, 1000);
  }

  capturePhoto() {
    if (!this.videoElement || !this.canvasElement) return;
    
    const video = this.videoElement.nativeElement;
    
    // Safety check: ensure video has valid dimensions before capturing
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video not ready yet');
      this.error.set('Camera đang khởi động, vui lòng thử lại sau giây lát!');
      setTimeout(() => this.error.set(null), 2000);
      return;
    }

    this.isProcessing.set(true);
    this.flashActive.set(true);
    setTimeout(() => this.flashActive.set(false), 150);

    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const filter = this.selectedFilter();
    ctx.filter = filter.ctxFilter;
    
    // Mirror the image to match the preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset

    const dataUrl = canvas.toDataURL('image/png');
    this.tempShot.set(dataUrl);
    this.mode.set('review');
    this.isProcessing.set(false);
  }

  confirmShot() {
    const shot = this.tempShot();
    if (shot) {
      this.shots.update(s => [...s, { dataUrl: shot, filterId: this.selectedFilter().id }]);
      this.tempShot.set(null);

      // Check if done
      const frame = this.selectedFrame();
      const maxShots = frame.rows * frame.cols;
      
      if (this.shots().length >= maxShots) {
        this.mode.set('decorate');
      } else {
        this.enterCaptureMode(); // Go back to capture for next shot
      }
    }
  }

  retakeShot() {
    this.tempShot.set(null);
    this.enterCaptureMode();
  }

  // --- Composite Drawing (The Core) ---
  async drawComposite() {
    if (!this.finalCanvas) return;
    const canvas = this.finalCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = this.selectedFrame();
    const photos = this.shots();

    // Base dimensions calculation
    // We define a fixed width for high quality export
    const EXPORT_WIDTH = 1200; 
    
    // Calculate cell size based on grid
    // width = padding*2 + (cols-1)*gap + cols*cellWidth
    const totalGapW = (frame.cols - 1) * frame.gap;
    const availableW = EXPORT_WIDTH - (frame.padding * 2) - totalGapW;
    const cellW = availableW / frame.cols;
    const cellH = cellW / frame.aspectRatio; // Apply aspect ratio of shot

    const totalGapH = (frame.rows - 1) * frame.gap;
    const contentH = (frame.rows * cellH) + totalGapH + (frame.padding * 2);

    // Canvas Size
    canvas.width = EXPORT_WIDTH;
    canvas.height = contentH + 100; // Extra 100px for "Footer/Branding"

    // 1. Draw Background
    ctx.fillStyle = frame.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Photos
    for (let i = 0; i < photos.length; i++) {
      const shot = photos[i];
      const img = new Image();
      img.src = shot.dataUrl;
      
      try {
        await img.decode();
        
        // Grid Position
        const col = i % frame.cols;
        const row = Math.floor(i / frame.cols);

        const x = frame.padding + col * (cellW + frame.gap);
        const y = frame.padding + row * (cellH + frame.gap);

        // Draw Image (Cover fit logic)
        this.drawImageCover(ctx, img, x, y, cellW, cellH);
      } catch (err) {
        console.error(`Error decoding photo at index ${i}:`, err);
        // Skip drawing this specific photo if it fails, but continue with the others
      }
    }

    // 3. Draw Preset Decorations (Fixed for this layout)
    if (frame.decorations) {
      frame.decorations.forEach(deco => {
        ctx.save();
        const drawX = deco.xPct * canvas.width;
        const drawY = deco.yPct * canvas.height;
        const fontSize = 40 * deco.size; // Base size multiplier

        ctx.translate(drawX, drawY);
        ctx.rotate(deco.rotation * Math.PI / 180);
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000'; // Default, though emojis contain color
        ctx.fillText(deco.content, 0, 0);
        ctx.restore();
      });
    }

    // 4. Draw Branding
    ctx.fillStyle = '#db2777'; // pink-600
    ctx.font = 'bold 30px "Quicksand", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tiệm Chụp Ảnh Cute 📸', canvas.width / 2, canvas.height - 40);
  }

  drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    // Math to simulate object-fit: cover
    const scale = Math.max(w / img.width, h / img.height);
    const centerShiftX = (img.width * scale - w) / 2;
    const centerShiftY = (img.height * scale - h) / 2;
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, 
      0, 0, img.width, img.height,
      x - centerShiftX, y - centerShiftY, img.width * scale, img.height * scale
    );
    ctx.restore();
  }

  // --- Final Save & AI ---
  async saveAndDownload() {
    if (!this.finalCanvas) return;
    const canvas = this.finalCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw composite base first to clear
    await this.drawComposite();

    const finalUrl = canvas.toDataURL('image/png');
    this.finalResultUrl.set(finalUrl);

    // Download
    const link = document.createElement('a');
    link.download = `photobooth-${Date.now()}.png`;
    link.href = finalUrl;
    link.click();

    // Generate AI Caption for this masterpiece
    this.generateAICaption(finalUrl);
  }

  async generateAICaption(imageUrl: string) {
    this.isGeneratingCaption.set(true);
    try {
      const caption = await this.geminiService.generateCuteCaption(imageUrl);
      this.aiCaption.set(caption);
    } catch (e) {
      // ignore
    } finally {
      this.isGeneratingCaption.set(false);
    }
  }

  reset() {
    this.mode.set('setup');
    this.shots.set([]);
    this.finalResultUrl.set(null);
  }
}
