import JSZip from 'jszip';

export interface ProcessedItem {
  id: string;
  file: File;
  originalName: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  originalDataUrl: string;
  compressedBlob: Blob | null;
  compressedDataUrl: string | null;
  compressedSize: number;
  compressedWidth: number;
  compressedHeight: number;
  savingsPercent: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export class ImageCompressorApp {
  private filesList: ProcessedItem[] = [];
  private quality: number = 0.8; // 80% default
  private targetFormat: string = 'image/webp'; // default format
  private keepAspectRatio: boolean = true;
  private customWidth: number | null = null;
  private customHeight: number | null = null;
  private scalePercent: number = 100;
  private fitMode: 'cover' | 'contain-blur' | 'stretch' = 'contain-blur';
  private cropPosition: number = 50; // 0 to 100% (default 50% center)

  // UI Elements
  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private qualitySlider!: HTMLInputElement;
  private qualityValueDisplay!: HTMLElement;
  private formatSelector!: HTMLSelectElement;
  private widthInput!: HTMLInputElement;
  private heightInput!: HTMLInputElement;
  private keepAspectCheckbox!: HTMLInputElement;
  private fileListContainer!: HTMLElement;
  private emptyState!: HTMLElement;
  private batchActionsBar!: HTMLElement;
  private downloadAllBtn!: HTMLButtonElement;
  private downloadPdfBtn!: HTMLButtonElement;
  private clearAllBtn!: HTMLButtonElement;
  private compressAllBtn!: HTMLButtonElement;
  private summaryStats!: HTMLElement;

  // OCR Modal Elements
  private activeOcrItem: ProcessedItem | null = null;
  private currentOcrMode: 'text' | 'math' = 'text';
  private ocrModal!: HTMLElement;
  private closeOcrModal!: HTMLElement;
  private ocrLangSelect!: HTMLSelectElement;
  private ocrMathLangSelect!: HTMLSelectElement;
  private reprocessOcrBtn!: HTMLButtonElement;
  private ocrStatusText!: HTMLElement;
  private ocrPercentText!: HTMLElement;
  private ocrProgressBar!: HTMLElement;
  private ocrPreviewImg!: HTMLImageElement;
  private ocrOutputText!: HTMLTextAreaElement;
  private ocrWordCount!: HTMLElement;
  private ocrCopyBtn!: HTMLButtonElement;
  private ocrDownloadBtn!: HTMLButtonElement;
  private ocrTabText!: HTMLButtonElement;
  private ocrTabMath!: HTMLButtonElement;
  private ocrTextControls!: HTMLElement;
  private ocrMathControls!: HTMLElement;
  private runMathOcrBtn!: HTMLButtonElement;
  private gracefulFallbackBanner!: HTMLElement;
  private fallbackBannerMsg!: HTMLElement;
  private mathRenderedPreview!: HTMLElement;
  private mathKatexOutput!: HTMLElement;

  constructor() {
    this.initUI();
  }

  private initUI() {
    // Bind UI elements from DOM
    this.dropZone = document.getElementById('drop-zone') as HTMLElement;
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.qualitySlider = document.getElementById('quality-slider') as HTMLInputElement;
    this.qualityValueDisplay = document.getElementById('quality-value') as HTMLElement;
    this.formatSelector = document.getElementById('format-selector') as HTMLSelectElement;
    this.widthInput = document.getElementById('width-input') as HTMLInputElement;
    this.heightInput = document.getElementById('height-input') as HTMLInputElement;
    this.keepAspectCheckbox = document.getElementById('keep-aspect') as HTMLInputElement;
    this.fileListContainer = document.getElementById('file-list') as HTMLElement;
    this.emptyState = document.getElementById('empty-state') as HTMLElement;
    this.batchActionsBar = document.getElementById('batch-actions') as HTMLElement;
    this.downloadAllBtn = document.getElementById('download-all-btn') as HTMLButtonElement;
    this.downloadPdfBtn = document.getElementById('download-pdf-btn') as HTMLButtonElement;
    this.clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
    this.compressAllBtn = document.getElementById('compress-all-btn') as HTMLButtonElement;
    this.summaryStats = document.getElementById('summary-stats') as HTMLElement;

    // OCR Modal DOM
    this.ocrModal = document.getElementById('ocr-modal') as HTMLElement;
    this.closeOcrModal = document.getElementById('close-ocr-modal') as HTMLElement;
    this.ocrLangSelect = document.getElementById('ocr-lang-select') as HTMLSelectElement;
    this.ocrMathLangSelect = document.getElementById('ocr-math-lang-select') as HTMLSelectElement;
    this.reprocessOcrBtn = document.getElementById('reprocess-ocr-btn') as HTMLButtonElement;
    this.ocrStatusText = document.getElementById('ocr-status-text') as HTMLElement;
    this.ocrPercentText = document.getElementById('ocr-percent-text') as HTMLElement;
    this.ocrProgressBar = document.getElementById('ocr-progress-bar') as HTMLElement;
    this.ocrPreviewImg = document.getElementById('ocr-preview-img') as HTMLImageElement;
    this.ocrOutputText = document.getElementById('ocr-output-text') as HTMLTextAreaElement;
    this.ocrWordCount = document.getElementById('ocr-word-count') as HTMLElement;
    this.ocrCopyBtn = document.getElementById('ocr-copy-btn') as HTMLButtonElement;
    this.ocrDownloadBtn = document.getElementById('ocr-download-btn') as HTMLButtonElement;
    this.ocrTabText = document.getElementById('ocr-tab-text') as HTMLButtonElement;
    this.ocrTabMath = document.getElementById('ocr-tab-math') as HTMLButtonElement;
    this.ocrTextControls = document.getElementById('ocr-text-controls') as HTMLElement;
    this.ocrMathControls = document.getElementById('ocr-math-controls') as HTMLElement;
    this.runMathOcrBtn = document.getElementById('run-math-ocr-btn') as HTMLButtonElement;
    this.gracefulFallbackBanner = document.getElementById('graceful-fallback-banner') as HTMLElement;
    this.fallbackBannerMsg = document.getElementById('fallback-banner-msg') as HTMLElement;
    this.mathRenderedPreview = document.getElementById('math-rendered-preview') as HTMLElement;
    this.mathKatexOutput = document.getElementById('math-katex-output') as HTMLElement;

    if (this.closeOcrModal) {
      this.closeOcrModal.addEventListener('click', () => this.closeOcrModalWindow());
    }

    if (this.ocrModal) {
      this.ocrModal.addEventListener('click', (e) => {
        if (e.target === this.ocrModal) this.closeOcrModalWindow();
      });
    }

    if (this.ocrTabText) {
      this.ocrTabText.addEventListener('click', () => this.switchOcrMode('text'));
    }

    if (this.ocrTabMath) {
      this.ocrTabMath.addEventListener('click', () => this.switchOcrMode('math'));
    }

    if (this.reprocessOcrBtn) {
      this.reprocessOcrBtn.addEventListener('click', () => this.runOCR());
    }

    if (this.runMathOcrBtn) {
      this.runMathOcrBtn.addEventListener('click', () => this.runMathOCR());
    }

    if (this.ocrCopyBtn) {
      this.ocrCopyBtn.addEventListener('click', () => this.copyOcrText());
    }

    if (this.ocrDownloadBtn) {
      this.ocrDownloadBtn.addEventListener('click', () => this.downloadOcrText());
    }

    if (this.ocrOutputText) {
      this.ocrOutputText.addEventListener('input', () => {
        this.updateOcrWordCount(this.ocrOutputText.value);
      });
    }

    if (!this.dropZone) return;

    this.attachEvents();
  }

  private attachEvents() {
    // File upload drag & drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.add('border-indigo-500', 'bg-indigo-50/50', 'dark:bg-indigo-950/30', 'scale-[1.01]');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/50', 'dark:bg-indigo-950/30', 'scale-[1.01]');
      }, false);
    });

    this.dropZone.addEventListener('drop', (e: DragEvent) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        this.handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files) {
        this.handleFiles(Array.from(this.fileInput.files));
        this.fileInput.value = ''; // reset
      }
    });

    // Quality slider
    this.qualitySlider.addEventListener('input', () => {
      const val = parseInt(this.qualitySlider.value, 10);
      this.quality = val / 100;
      if (this.qualityValueDisplay) {
        this.qualityValueDisplay.textContent = `${val}%`;
      }
      this.reprocessAll();
    });

    // Format selector
    if (this.formatSelector) {
      this.formatSelector.addEventListener('change', () => {
        this.targetFormat = this.formatSelector.value;
        this.reprocessAll();
      });
    }

    // Preset format buttons if any exist
    document.querySelectorAll('[data-format-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const fmt = target.getAttribute('data-format-btn');
        if (fmt) {
          this.targetFormat = fmt;
          if (this.formatSelector) this.formatSelector.value = fmt;
          document.querySelectorAll('[data-format-btn]').forEach(b => {
            b.classList.remove('bg-black', 'text-white', 'shadow');
            b.classList.add('bg-white', 'text-slate-800', 'border', 'border-black/20', 'hover:bg-slate-100');
          });
          target.classList.remove('bg-white', 'text-slate-800', 'border', 'border-black/20', 'hover:bg-slate-100');
          target.classList.add('bg-black', 'text-white', 'shadow');
          this.reprocessAll();
        }
      });
    });

    // Dimension inputs
    if (this.widthInput) {
      this.widthInput.addEventListener('input', () => {
        this.scalePercent = 100;
        document.querySelectorAll('[data-preset], [data-scale]').forEach(b => {
          b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        });

        const w = parseInt(this.widthInput.value, 10);
        this.customWidth = isNaN(w) || w <= 0 ? null : w;
        if (this.keepAspectCheckbox && this.keepAspectCheckbox.checked && this.customWidth && this.filesList.length > 0) {
          const first = this.filesList[0];
          if (first.originalWidth) {
            const ratio = first.originalHeight / first.originalWidth;
            this.customHeight = Math.round(this.customWidth * ratio);
            if (this.heightInput) this.heightInput.value = this.customHeight.toString();
          }
        }
        this.reprocessAll();
      });
    }

    if (this.heightInput) {
      this.heightInput.addEventListener('input', () => {
        this.scalePercent = 100;
        document.querySelectorAll('[data-preset], [data-scale]').forEach(b => {
          b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        });

        const h = parseInt(this.heightInput.value, 10);
        this.customHeight = isNaN(h) || h <= 0 ? null : h;
        if (this.keepAspectCheckbox && this.keepAspectCheckbox.checked && this.customHeight && this.filesList.length > 0) {
          const first = this.filesList[0];
          if (first.originalHeight) {
            const ratio = first.originalWidth / first.originalHeight;
            this.customWidth = Math.round(this.customHeight * ratio);
            if (this.widthInput) this.widthInput.value = this.customWidth.toString();
          }
        }
        this.reprocessAll();
      });
    }

    // Scale buttons (e.g. 100%, 75%, 50%, 25%)
    document.querySelectorAll('[data-scale]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const scale = parseInt(target.getAttribute('data-scale') || '100', 10);
        this.scalePercent = scale;

        // Reset social media presets highlight
        document.querySelectorAll('[data-preset]').forEach(b => {
          b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        });

        document.querySelectorAll('[data-scale]').forEach(b => {
          b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        });
        target.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');

        if (scale === 100) {
          this.customWidth = null;
          this.customHeight = null;
          if (this.widthInput) this.widthInput.value = '';
          if (this.heightInput) this.heightInput.value = '';
        } else if (this.filesList.length > 0) {
          const first = this.filesList[0];
          this.customWidth = Math.round(first.originalWidth * (scale / 100));
          this.customHeight = Math.round(first.originalHeight * (scale / 100));
          if (this.widthInput) this.widthInput.value = this.customWidth.toString();
          if (this.heightInput) this.heightInput.value = this.customHeight.toString();
        }
        this.reprocessAll();
      });
    });

    // Social Media Preset buttons (e.g. 1080x1080, 1080x1920, 1280x720)
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const preset = target.getAttribute('data-preset');
        if (!preset) return;

        const parts = preset.split('x');
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (isNaN(w) || isNaN(h)) return;

        this.scalePercent = 100;
        this.customWidth = w;
        this.customHeight = h;

        if (this.widthInput) this.widthInput.value = w.toString();
        if (this.heightInput) this.heightInput.value = h.toString();

        if (this.keepAspectCheckbox) {
          this.keepAspectCheckbox.checked = false;
        }

        // Highlight active preset button
        document.querySelectorAll('[data-preset]').forEach(b => {
          b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        });
        target.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');

        // Clear scale active state
        document.querySelectorAll('[data-scale]').forEach(b => {
          b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        });

        this.reprocessAll();
      });
    });

    // Fit Mode buttons (cover, contain-blur, stretch)
    const cropControlContainer = document.getElementById('crop-position-control');
    const cropSlider = document.getElementById('crop-position-slider') as HTMLInputElement | null;
    const cropValDisplay = document.getElementById('crop-position-val');

    const updateCropDisplay = (val: number) => {
      if (cropValDisplay) {
        let label = 'المنتصف';
        if (val === 0) label = 'أعلى / يسار';
        else if (val < 40) label = `أعلى/يسار (${val}%)`;
        else if (val > 60) label = `أسفل/يمين (${val}%)`;
        else if (val === 100) label = 'أسفل / يمين';
        cropValDisplay.textContent = `${val}% (${label})`;
      }
    };

    document.querySelectorAll('[data-fit-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-fit-mode') as 'cover' | 'contain-blur' | 'stretch';
        if (!mode) return;

        this.fitMode = mode;

        document.querySelectorAll('[data-fit-mode]').forEach(b => {
          b.className = "flex flex-col items-start p-2.5 border border-black/20 hover:border-black dark:hover:border-white text-right transition";
          const sub = b.querySelector('.text-\\[10px\\]');
          if (sub) {
            sub.className = "text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight";
          }
        });

        target.className = "flex flex-col items-start p-2.5 border-2 border-black bg-black text-white dark:bg-white dark:text-black text-right transition";
        const activeSub = target.querySelector('.text-\\[10px\\]');
        if (activeSub) {
          activeSub.className = "text-[10px] opacity-80 mt-0.5 leading-tight";
        }

        // Toggle Crop Position Controller
        if (cropControlContainer) {
          if (this.fitMode === 'cover') {
            cropControlContainer.classList.remove('hidden');
          } else {
            cropControlContainer.classList.add('hidden');
          }
        }

        this.reprocessAll();
      });
    });

    // Crop Position Slider & Presets
    if (cropSlider) {
      cropSlider.oninput = (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        this.cropPosition = isNaN(val) ? 50 : val;
        updateCropDisplay(this.cropPosition);
        this.reprocessAll();
      };
    }

    document.querySelectorAll('[data-crop-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const valStr = target.getAttribute('data-crop-preset');
        if (valStr !== null) {
          const val = parseInt(valStr, 10);
          this.cropPosition = val;
          if (cropSlider) cropSlider.value = val.toString();
          updateCropDisplay(val);
          this.reprocessAll();
        }
      });
    });

    // Batch Action Buttons
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => this.clearAll());
    }

    if (this.downloadAllBtn) {
      this.downloadAllBtn.addEventListener('click', () => this.downloadAllAsZip());
    }

    if (this.downloadPdfBtn) {
      this.downloadPdfBtn.addEventListener('click', () => this.downloadAllAsPdf());
    }

    if (this.compressAllBtn) {
      this.compressAllBtn.addEventListener('click', () => this.reprocessAll());
    }
  }

  private handleFiles(files: File[]) {
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/svg+xml'];
    
    const newItems: ProcessedItem[] = [];

    files.forEach(file => {
      if (!file.type.startsWith('image/') && !validImageTypes.includes(file.type)) {
        alert(`الملف "${file.name}" ليس صورة صالحة.`);
        return;
      }

      const item: ProcessedItem = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        originalName: file.name,
        originalSize: file.size,
        originalWidth: 0,
        originalHeight: 0,
        originalDataUrl: '',
        compressedBlob: null,
        compressedDataUrl: null,
        compressedSize: 0,
        compressedWidth: 0,
        compressedHeight: 0,
        savingsPercent: 0,
        status: 'idle'
      };

      newItems.push(item);
    });

    if (newItems.length > 0) {
      this.filesList.push(...newItems);
      this.updateUIState();
      
      // Load and process each item
      newItems.forEach(item => this.processItem(item));
    }
  }

  private async processItem(item: ProcessedItem) {
    item.status = 'processing';
    this.renderItemCard(item);

    try {
      // Step 1: Read original image
      const dataUrl = await this.readFileAsDataUrl(item.file);
      item.originalDataUrl = dataUrl;

      // Step 2: Load Image to get dimensions
      const img = await this.loadImage(dataUrl);
      item.originalWidth = img.width;
      item.originalHeight = img.height;

      // Step 3: Compress & Convert via Canvas
      await this.compressImage(item, img);

    } catch (err) {
      item.status = 'error';
      item.errorMessage = 'حدث خطأ أثناء معالجة الصورة';
      console.error('Compression error:', err);
    }

    this.renderItemCard(item);
    this.updateSummaryStats();
  }

  private async reprocessAll() {
    for (const item of this.filesList) {
      if (item.originalDataUrl) {
        item.status = 'processing';
        this.renderItemCard(item);
        const img = await this.loadImage(item.originalDataUrl);
        await this.compressImage(item, img);
        this.renderItemCard(item);
      }
    }
    this.updateSummaryStats();
  }

  private getTransformedSource(img: HTMLImageElement, rotation = 0, flipH = false, flipV = false): HTMLCanvasElement {
    const angle = ((rotation % 360) + 360) % 360;
    const is90or270 = angle === 90 || angle === 270;

    const srcW = is90or270 ? img.height : img.width;
    const srcH = is90or270 ? img.width : img.height;

    const canvas = document.createElement('canvas');
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    ctx.translate(srcW / 2, srcH / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    return canvas;
  }

  private compressImage(item: ProcessedItem, rawImg: HTMLImageElement): Promise<void> {
    return new Promise((resolve) => {
      // Apply rotation / flip transformations to source canvas
      const img = this.getTransformedSource(rawImg, item.rotation || 0, item.flipH || false, item.flipV || false);

      // Calculate target dimensions
      let targetW = img.width;
      let targetH = img.height;

      if (this.scalePercent !== 100) {
        targetW = Math.round(img.width * (this.scalePercent / 100));
        targetH = Math.round(img.height * (this.scalePercent / 100));
      } else if (this.customWidth && this.customHeight) {
        targetW = this.customWidth;
        targetH = this.customHeight;
      } else if (this.customWidth) {
        targetW = this.customWidth;
        targetH = Math.round(img.height * (this.customWidth / img.width));
      } else if (this.customHeight) {
        targetH = this.customHeight;
        targetW = Math.round(img.width * (this.customHeight / img.height));
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        item.status = 'error';
        item.errorMessage = 'فشل إنشاء عنصر Canvas';
        resolve();
        return;
      }

      // Smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Check if user set explicit custom dimensions and aspect ratio differs
      const hasExplicitTarget = (this.customWidth && this.customHeight);
      const isAspectMismatch = hasExplicitTarget && Math.abs((img.width / img.height) - (targetW / targetH)) > 0.005;

      if (isAspectMismatch) {
        if (this.fitMode === 'cover') {
          // 1. Cover (Smart Crop with Position Control) - fill canvas completely without stretching
          if (this.targetFormat === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);
          }

          const scale = Math.max(targetW / img.width, targetH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;

          const posRatio = Math.max(0, Math.min(100, this.cropPosition)) / 100;
          const offsetX = (targetW - drawW) * posRatio;
          const offsetY = (targetH - drawH) * posRatio;

          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        } else if (this.fitMode === 'contain-blur') {
          // 2. Blur Fill - background blurred image + contained un-stretched image on top
          //
          // Key trick: render to a VERY small proxy canvas first. Downscaling to a tiny
          // size is itself a strong average/blur (text and edges become unrecognisable
          // blobs), then we blur that tiny canvas again and upscale it hugely with
          // smoothing. This fully dissolves shapes into soft colour, instead of leaving a
          // faint "ghost" of the original text/edges like a small-but-not-tiny proxy does.
          const blurCanvas = document.createElement('canvas');
          const bW = Math.max(28, Math.round(targetW / 22));
          const bH = Math.max(20, Math.round((targetH / targetW) * bW));
          blurCanvas.width = bW;
          blurCanvas.height = bH;
          const blurCtx = blurCanvas.getContext('2d');

          const supportsCanvasFilter = !!blurCtx && 'filter' in blurCtx;

          if (blurCtx) {
            blurCtx.imageSmoothingEnabled = true;
            blurCtx.imageSmoothingQuality = 'high';

            // Cover-fit, zoomed in extra so we never sample flat edge pixels only.
            const zoom = 1.25;
            const bgScale = Math.max(bW / img.width, bH / img.height) * zoom;
            const bgW = img.width * bgScale;
            const bgH = img.height * bgScale;
            const bgX = (bW - bgW) / 2;
            const bgY = (bH - bgH) / 2;

            if (supportsCanvasFilter) {
              // A small extra blur pass on top of the downscale, plus a glow boost so dark
              // source photos still read as a soft colour instead of going muddy/flat.
              blurCtx.filter = 'blur(3px) saturate(1.4) brightness(1.15)';
              blurCtx.drawImage(img, bgX, bgY, bgW, bgH);
              blurCtx.filter = 'none';
            } else {
              blurCtx.drawImage(img, bgX, bgY, bgW, bgH);
              this.fastBoxBlur(blurCtx, bW, bH, Math.round(bW * 0.15));
            }

            // Draw blurred canvas scaled up to cover target canvas. A second blur pass
            // here (if supported) smooths out any residual upscaling blockiness so the
            // result reads as a continuous soft gradient rather than a pixelated ghost.
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            if (supportsCanvasFilter) {
              ctx.filter = `blur(${Math.round(Math.min(targetW, targetH) * 0.02)}px)`;
            }

            const pad = 60;
            ctx.drawImage(blurCanvas, -pad, -pad, targetW + pad * 2, targetH + pad * 2);
            ctx.filter = 'none';
            ctx.restore();

            // Very light dark overlay just for contrast - kept subtle so it never flattens
            // the blur back into a solid colour on already-dark images.
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(0, 0, targetW, targetH);
          } else {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetW, targetH);
          }


          // Draw main image centered on top - with a soft feathered edge so it blends
          // into the blurred backdrop instead of looking like a sticker pasted on top.
          ctx.save();
          const scale = Math.min(targetW / img.width, targetH / img.height);
          const cDrawW = Math.max(1, Math.round(img.width * scale));
          const cDrawH = Math.max(1, Math.round(img.height * scale));
          const offsetX = (targetW - cDrawW) / 2;
          const offsetY = (targetH - cDrawH) / 2;

          const feather = Math.max(6, Math.round(Math.min(cDrawW, cDrawH) * 0.035));
          const supportsFeather = supportsCanvasFilter && cDrawW > feather * 2 && cDrawH > feather * 2;

          if (supportsFeather) {
            // 1. Render the foreground image to its own canvas
            const fgCanvas = document.createElement('canvas');
            fgCanvas.width = cDrawW;
            fgCanvas.height = cDrawH;
            const fgCtx = fgCanvas.getContext('2d');

            // 2. Build a soft-edged alpha mask (opaque center, blurred/fading border)
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = cDrawW;
            maskCanvas.height = cDrawH;
            const maskCtx = maskCanvas.getContext('2d');

            if (fgCtx && maskCtx) {
              fgCtx.imageSmoothingEnabled = true;
              fgCtx.imageSmoothingQuality = 'high';
              fgCtx.drawImage(img, 0, 0, cDrawW, cDrawH);

              maskCtx.filter = `blur(${feather}px)`;
              maskCtx.fillStyle = '#fff';
              maskCtx.fillRect(feather, feather, cDrawW - feather * 2, cDrawH - feather * 2);
              maskCtx.filter = 'none';

              fgCtx.globalCompositeOperation = 'destination-in';
              fgCtx.drawImage(maskCanvas, 0, 0);
              fgCtx.globalCompositeOperation = 'source-over';

              // Soft ambient shadow so the feathered image still reads as "on top"
              ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
              ctx.shadowBlur = Math.round(Math.min(targetW, targetH) * 0.02);
              ctx.shadowOffsetY = Math.round(Math.min(targetW, targetH) * 0.006);

              ctx.drawImage(fgCanvas, offsetX, offsetY);
            } else {
              ctx.drawImage(img, offsetX, offsetY, cDrawW, cDrawH);
            }
          } else {
            // Fallback (no canvas filter support): draw without feathering
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = Math.round(Math.min(targetW, targetH) * 0.025);
            ctx.shadowOffsetY = Math.round(Math.min(targetW, targetH) * 0.01);
            ctx.drawImage(img, offsetX, offsetY, cDrawW, cDrawH);
          }
          ctx.restore();


        } else {
          // 3. Stretch mode
          if (this.targetFormat === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }
      } else {
        // Standard draw (scaling proportionally or original aspect ratio)
        if (this.targetFormat === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }

      // Export blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            item.compressedBlob = blob;
            item.compressedSize = blob.size;
            item.compressedWidth = targetW;
            item.compressedHeight = targetH;
            item.compressedDataUrl = URL.createObjectURL(blob);
            
            // Calculate savings using safe function
            const info = this.getSavings(item.originalSize, item.compressedSize);
            item.savingsPercent = info.percent;
            item.status = 'done';
          } else {
            item.status = 'error';
            item.errorMessage = 'تعذر تحويل الصورة إلى الصيغة المطلوبة';
          }
          resolve();
        },
        this.targetFormat,
        this.quality
      );
    });
  }

  private fastBoxBlur(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const passes = 3;

    for (let pass = 0; pass < passes; pass++) {
      // Horizontal blur
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width * 4;
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          const minX = Math.max(0, x - radius);
          const maxX = Math.min(width - 1, x + radius);
          for (let ix = minX; ix <= maxX; ix++) {
            const idx = rowOffset + ix * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            a += data[idx + 3];
            count++;
          }
          const currIdx = rowOffset + x * 4;
          data[currIdx] = (r / count) | 0;
          data[currIdx + 1] = (g / count) | 0;
          data[currIdx + 2] = (b / count) | 0;
          data[currIdx + 3] = (a / count) | 0;
        }
      }

      // Vertical blur
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          const minY = Math.max(0, y - radius);
          const maxY = Math.min(height - 1, y + radius);
          for (let iy = minY; iy <= maxY; iy++) {
            const idx = (iy * width + x) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            a += data[idx + 3];
            count++;
          }
          const currIdx = (y * width + x) * 4;
          data[currIdx] = (r / count) | 0;
          data[currIdx + 1] = (g / count) | 0;
          data[currIdx + 2] = (b / count) | 0;
          data[currIdx + 3] = (a / count) | 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // Wraps LTR content (numbers, dimensions like "1080×1920") with Unicode directional
  // isolate marks (U+2066/U+2069). Without this, a browser's bidi algorithm can visually
  // reorder two numbers separated by "×" when embedded inside Arabic (RTL) text - e.g.
  // "1080×1920" rendering as "1920×1080" even though the underlying string is correct.
  private ltr(text: string): string {
    return `\u2066${text}\u2069`;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  private formatBytes(bytes: number): string {
    if (!bytes || isNaN(bytes) || !isFinite(bytes) || bytes <= 0) return '0 بايت';
    if (bytes < 1024) return `${bytes.toFixed(0)} بايت`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} كيلوبايت`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
  }

  private getSavings(orig: number, comp: number): { percent: number; saved: number; increased: boolean } {
    if (!orig || orig <= 0 || isNaN(orig) || !isFinite(orig) || !comp || comp <= 0 || isNaN(comp) || !isFinite(comp)) {
      return { percent: 0, saved: 0, increased: false };
    }
    const saved = orig - comp;
    const percent = Math.round((saved / orig) * 100);
    return {
      percent,
      saved,
      increased: saved < 0,
    };
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime) {
      case 'image/jpeg': return '.jpg';
      case 'image/png': return '.png';
      case 'image/webp': return '.webp';
      case 'image/avif': return '.avif';
      default: return '.jpg';
    }
  }

  private renderItemCard(item: ProcessedItem) {
    let card = document.getElementById(`item-card-${item.id}`);

    if (!card) {
      card = document.createElement('div');
      card.id = `item-card-${item.id}`;
      card.className = 'bg-white dark:bg-slate-800 p-5 border border-black/80 dark:border-slate-700 shadow-editorial transition-all hover:shadow-editorial-lg';
      this.fileListContainer.appendChild(card);
    }

    const ext = this.getExtensionFromMime(this.targetFormat);
    const cleanName = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
    const outputName = `${cleanName}-compressed${ext}`;

    if (item.status === 'processing') {
      card.innerHTML = `
        <div class="flex items-center gap-4 py-2">
          <div class="w-16 h-16 bg-slate-100 dark:bg-slate-700 border border-black/10 flex items-center justify-center animate-pulse">
            <svg class="w-8 h-8 text-black dark:text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div class="flex-1">
            <div class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs font-mono text-xs">${item.originalName}</div>
            <div class="text-xs text-black dark:text-white font-bold mt-1 tracking-wider uppercase text-[10px]">جاري الضغط والتحويل...</div>
          </div>
        </div>
      `;
      return;
    }

    if (item.status === 'error') {
      card.innerHTML = `
        <div class="flex items-center justify-between gap-4 py-2">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-200">${item.originalName}</div>
              <div class="text-xs text-red-600 font-mono mt-0.5">${item.errorMessage || 'حدث خطأ'}</div>
            </div>
          </div>
          <button data-remove="${item.id}" class="text-slate-400 hover:text-red-600 p-2 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      `;
      this.attachCardEvents(card, item);
      return;
    }

    const savings = this.getSavings(item.originalSize, item.compressedSize);

    const badgeColor = savings.increased
      ? 'bg-amber-500 text-white px-2 py-0.5 text-[10px] font-mono tracking-wider font-bold'
      : 'bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-mono tracking-wider font-bold';

    card.innerHTML = `
      <div class="flex flex-col gap-3.5">
        <!-- Main Info and primary actions row -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <!-- Thumbnail & Info -->
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="relative group w-20 h-20 bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-black/20 dark:border-slate-700 cursor-pointer" data-compare="${item.id}" title="انقر لمعاينة المقارنة">
              <img src="${item.compressedDataUrl || item.originalDataUrl}" alt="${item.originalName}" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition p-1 text-center">
                <span class="text-white text-[10px] font-mono font-bold bg-black/90 px-1.5 py-0.5 border border-white/30">معاينة</span>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-slate-900 dark:text-white truncate max-w-sm font-mono text-sm" title="${outputName}">
                ${outputName}
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>الأصلي: <strong class="text-slate-800 dark:text-slate-200 font-mono">${this.formatBytes(item.originalSize)}</strong></span>
                <span>•</span>
                <span>المضغوط: <strong class="text-black dark:text-white font-black font-mono">${this.formatBytes(item.compressedSize)}</strong></span>
                <span>•</span>
                <span class="font-mono text-[11px]">الأبعاد: ${this.ltr(`${item.compressedWidth}x${item.compressedHeight}px`)}</span>
              </div>
            </div>
          </div>

          <!-- Primary Actions Toolbar -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center ${badgeColor}">
              ${savings.increased ? `⚠️ زيادة +${Math.abs(savings.percent)}%` : `وفرت ${savings.percent}% (${this.formatBytes(savings.saved)})`}
            </span>

            <a href="${item.compressedDataUrl}" download="${outputName}" class="inline-flex items-center gap-2 px-3.5 py-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-xs font-bold font-mono transition shadow-xs active:scale-95 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span>تنزيل</span>
            </a>

            <button type="button" data-compare="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold font-mono border border-black/20 dark:border-slate-600 transition shadow-xs active:scale-95 cursor-pointer" title="معاينة المقارنة البصرية">
              <svg class="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span>معاينة</span>
            </button>

            <button type="button" data-pdf-single="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold font-mono border border-black/20 dark:border-slate-600 transition shadow-xs active:scale-95 cursor-pointer" title="تحميل هذه الصورة كملف PDF">
              <svg class="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              <span>PDF</span>
            </button>

            <button data-remove="${item.id}" title="حذف الصورة" class="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>

        <!-- Secondary Image Tools Toolbar (Rotate, Flip, OCR) -->
        <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/80 border border-black/10 dark:border-slate-700">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-[11px] font-mono uppercase font-bold text-slate-400 pl-1">أدوات الصورة:</span>

            <button type="button" data-rotate="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-slate-800 dark:text-slate-200 border border-black/20 dark:border-slate-600 transition text-xs font-mono font-bold cursor-pointer active:scale-95" title="تدوير 90 درجة">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <span>تدوير 90°</span>
              ${item.rotation ? `<span class="bg-black text-white dark:bg-white dark:text-black text-[10px] px-1 font-mono">${item.rotation}°</span>` : ''}
            </button>

            <button type="button" data-flip-h="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 ${item.flipH ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'} hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black border border-black/20 dark:border-slate-600 transition text-xs font-mono font-bold cursor-pointer active:scale-95" title="قلب الصورة أفقياً">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4"></path></svg>
              <span>قلب أفقي</span>
            </button>

            <button type="button" data-flip-v="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 ${item.flipV ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'} hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black border border-black/20 dark:border-slate-600 transition text-xs font-mono font-bold cursor-pointer active:scale-95" title="قلب الصورة رأسيًا">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 8v12m0 0l4-4m-4 4l-4-4"></path></svg>
              <span>قلب رأسي</span>
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2 mr-auto">
            <button type="button" data-ocr="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-mono font-bold border border-black transition cursor-pointer active:scale-95" title="استخراج النص العادي من الصورة">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>استخراج النص</span>
            </button>

            <button type="button" data-ocr-math="${item.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900 text-white dark:bg-indigo-100 dark:text-indigo-950 hover:bg-indigo-800 dark:hover:bg-white text-xs font-mono font-bold border border-indigo-900 dark:border-indigo-200 transition cursor-pointer active:scale-95" title="استخراج المعادلات والرموز الرياضية بالذكاء الاصطناعي">
              <span>📐</span>
              <span>معادلات (Math AI)</span>
            </button>
          </div>
        </div>

        ${savings.increased ? `
          <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
            <div>
              <div class="text-xs font-bold text-amber-900 dark:text-amber-200">
                ⚠️ الحجم زاد بـ ${Math.abs(savings.percent)}% (+${this.formatBytes(Math.abs(savings.saved))})
              </div>
              <div class="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                طبيعي عند تكبير الأبعاد أو استخدام PNG. يُفضل اختيار صيغة <strong>WebP</strong> أو ضبط الجودة لـ 80% لتقليل الحجم.
              </div>
            </div>
            ${this.targetFormat !== 'image/webp' ? `
              <button type="button" data-suggest-webp="true" class="shrink-0 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-200 text-xs font-bold font-mono transition shadow-xs">
                ⚡ حوّل إلى WebP وقلّص الحجم تلقائياً
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    this.attachCardEvents(card, item);
  }

  private attachCardEvents(card: HTMLElement, item: ProcessedItem) {
    const removeBtn = card.querySelector(`[data-remove="${item.id}"]`);
    if (removeBtn) {
      removeBtn.addEventListener('click', () => this.removeItem(item.id));
    }

    const pdfSingleBtn = card.querySelector(`[data-pdf-single="${item.id}"]`);
    if (pdfSingleBtn) {
      pdfSingleBtn.addEventListener('click', () => this.downloadSingleAsPdf(item));
    }

    const compareBtns = card.querySelectorAll(`[data-compare="${item.id}"]`);
    compareBtns.forEach(btn => {
      btn.addEventListener('click', () => this.openCompareModal(item));
    });

    const webpBtn = card.querySelector(`[data-suggest-webp="true"]`);
    if (webpBtn) {
      webpBtn.addEventListener('click', () => {
        this.targetFormat = 'image/webp';
        if (this.formatSelector) this.formatSelector.value = 'image/webp';
        document.querySelectorAll('[data-format-btn]').forEach(b => {
          const fmt = b.getAttribute('data-format-btn');
          if (fmt === 'image/webp') {
            b.classList.remove('bg-white', 'text-slate-800', 'border', 'border-black/20', 'hover:bg-slate-100');
            b.classList.add('bg-black', 'text-white', 'shadow');
          } else {
            b.classList.remove('bg-black', 'text-white', 'shadow');
            b.classList.add('bg-white', 'text-slate-800', 'border', 'border-black/20', 'hover:bg-slate-100');
          }
        });
        this.reprocessAll();
      });
    }

    const rotateBtn = card.querySelector(`[data-rotate="${item.id}"]`);
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        item.rotation = ((item.rotation || 0) + 90) % 360;
        this.reprocessSingleItem(item);
      });
    }

    const flipHBtn = card.querySelector(`[data-flip-h="${item.id}"]`);
    if (flipHBtn) {
      flipHBtn.addEventListener('click', () => {
        item.flipH = !item.flipH;
        this.reprocessSingleItem(item);
      });
    }

    const flipVBtn = card.querySelector(`[data-flip-v="${item.id}"]`);
    if (flipVBtn) {
      flipVBtn.addEventListener('click', () => {
        item.flipV = !item.flipV;
        this.reprocessSingleItem(item);
      });
    }

    const ocrBtn = card.querySelector(`[data-ocr="${item.id}"]`);
    if (ocrBtn) {
      ocrBtn.addEventListener('click', () => this.openOcrModal(item, 'text'));
    }

    const ocrMathBtn = card.querySelector(`[data-ocr-math="${item.id}"]`);
    if (ocrMathBtn) {
      ocrMathBtn.addEventListener('click', () => this.openOcrModal(item, 'math'));
    }
  }

  private async reprocessSingleItem(item: ProcessedItem) {
    if (item.originalDataUrl) {
      item.status = 'processing';
      this.renderItemCard(item);
      const img = await this.loadImage(item.originalDataUrl);
      await this.compressImage(item, img);
      this.renderItemCard(item);
      this.updateSummaryStats();
    }
  }

  private openOcrModal(item: ProcessedItem, mode: 'text' | 'math' = 'text') {
    this.activeOcrItem = item;
    if (this.ocrModal) {
      this.ocrModal.classList.remove('hidden');
      this.ocrModal.classList.add('flex');
    }
    if (this.ocrPreviewImg) {
      this.ocrPreviewImg.src = item.compressedDataUrl || item.originalDataUrl;
    }
    this.switchOcrMode(mode);
  }

  private closeOcrModalWindow() {
    if (this.ocrModal) {
      this.ocrModal.classList.add('hidden');
      this.ocrModal.classList.remove('flex');
    }
  }

  private switchOcrMode(mode: 'text' | 'math') {
    this.currentOcrMode = mode;
    if (mode === 'text') {
      if (this.ocrTabText) {
        this.ocrTabText.className = 'px-4 py-2 text-xs font-mono font-bold bg-black text-white dark:bg-white dark:text-black border border-black transition cursor-pointer flex items-center gap-1.5';
      }
      if (this.ocrTabMath) {
        this.ocrTabMath.className = 'px-4 py-2 text-xs font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-black/20 dark:border-slate-600 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1.5';
      }
      if (this.ocrTextControls) this.ocrTextControls.classList.remove('hidden');
      if (this.ocrMathControls) this.ocrMathControls.classList.add('hidden');
      if (this.mathRenderedPreview) this.mathRenderedPreview.classList.add('hidden');
      this.runOCR();
    } else {
      if (this.ocrTabMath) {
        this.ocrTabMath.className = 'px-4 py-2 text-xs font-mono font-bold bg-black text-white dark:bg-white dark:text-black border border-black transition cursor-pointer flex items-center gap-1.5';
      }
      if (this.ocrTabText) {
        this.ocrTabText.className = 'px-4 py-2 text-xs font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-black/20 dark:border-slate-600 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1.5';
      }
      if (this.ocrTextControls) this.ocrTextControls.classList.add('hidden');
      if (this.ocrMathControls) this.ocrMathControls.classList.remove('hidden');
      if (this.mathRenderedPreview) this.mathRenderedPreview.classList.add('hidden');
      this.runMathOCR();
    }
  }

  private updateOcrWordCount(text: string) {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    if (this.ocrWordCount) {
      this.ocrWordCount.textContent = `عدد الكلمات: ${words}`;
    }
  }

  private preprocessImageForOcr(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);

          // Add padding and scale up small images for better OCR resolution
          const scale = img.width < 800 ? Math.max(1.5, 800 / img.width) : 1.2;
          const padding = 40;
          canvas.width = Math.round(img.width * scale) + padding * 2;
          canvas.height = Math.round(img.height * scale) + padding * 2;

          // Fill initial background white
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw image centered
          ctx.drawImage(img, padding, padding, img.width * scale, img.height * scale);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Measure average brightness
          let totalLuminance = 0;
          const totalPixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += lum;
          }

          const avgBrightness = totalLuminance / totalPixels;
          const isDarkBackground = avgBrightness < 128;

          // Process pixels: Invert if dark background & enhance contrast
          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            if (isDarkBackground) {
              r = 255 - r;
              g = 255 - g;
              b = 255 - b;
            }

            // Grayscale & Contrast enhancement
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            // Contrast stretch
            const contrastFactor = 1.4;
            let enhanced = (gray - 128) * contrastFactor + 128;
            enhanced = Math.min(255, Math.max(0, enhanced));

            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Preprocessing image failed, using original:', e);
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  private async ensureDataUrl(src: string): Promise<string> {
    if (!src) return '';
    let dataUrl = src;
    if (!dataUrl.startsWith('data:')) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || '');
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Failed to convert blob URL to data URL:', e);
        return src;
      }
    }

    // Downscale / compress to JPEG (max 1600px) so payload is under 500KB (fits Vercel 4.5MB payload limit)
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const optimized = canvas.toDataURL('image/jpeg', 0.85);
            resolve(optimized);
            return;
          }
        } catch (e) {
          console.warn('Canvas optimization failed:', e);
        }
        resolve(dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  private async runOCR() {
    if (!this.activeOcrItem) return;
    const lang = this.ocrLangSelect ? this.ocrLangSelect.value : 'ara+eng';

    if (this.ocrStatusText) this.ocrStatusText.textContent = 'جاري تحسين الصورة وتجهيز محرك القراءة (OCR)...';
    if (this.ocrPercentText) this.ocrPercentText.textContent = '0%';
    if (this.ocrProgressBar) this.ocrProgressBar.style.width = '5%';
    if (this.ocrOutputText) this.ocrOutputText.value = '';
    this.updateOcrWordCount('');

    try {
      const rawSrc = this.activeOcrItem.compressedDataUrl || this.activeOcrItem.originalDataUrl;
      const targetSrc = await this.preprocessImageForOcr(rawSrc);

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(lang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            if (this.ocrStatusText) this.ocrStatusText.textContent = 'جاري تحليل وقراءة النصوص من الصورة...';
            if (this.ocrPercentText) this.ocrPercentText.textContent = `${pct}%`;
            if (this.ocrProgressBar) this.ocrProgressBar.style.width = `${pct}%`;
          } else if (m.status) {
            if (this.ocrStatusText) this.ocrStatusText.textContent = `جاري المعالجة: ${m.status}`;
          }
        }
      });

      const res = await worker.recognize(targetSrc);
      await worker.terminate();

      const extractedText = res.data.text ? res.data.text.trim() : '';

      if (this.ocrStatusText) {
        this.ocrStatusText.textContent = extractedText ? 'تم استخراج النص بنجاح! ✨' : 'لم يتم العثور على نصوص واضحة في هذه الصورة.';
      }
      if (this.ocrPercentText) this.ocrPercentText.textContent = '100%';
      if (this.ocrProgressBar) this.ocrProgressBar.style.width = '100%';
      if (this.ocrOutputText) this.ocrOutputText.value = extractedText;
      this.updateOcrWordCount(extractedText);

    } catch (err) {
      console.error('OCR Error:', err);
      if (this.ocrStatusText) this.ocrStatusText.textContent = 'حدث خطأ أثناء استخراج النص.';
      if (this.ocrPercentText) this.ocrPercentText.textContent = 'خطأ';
      if (this.ocrProgressBar) this.ocrProgressBar.style.width = '0%';
    }
  }

  private async runMathOCR() {
    if (!this.activeOcrItem) return;
    const engineMode = this.ocrMathLangSelect ? this.ocrMathLangSelect.value : 'gemini';

    if (this.gracefulFallbackBanner) this.gracefulFallbackBanner.classList.add('hidden');
    if (this.ocrPercentText) this.ocrPercentText.textContent = '0%';
    if (this.ocrProgressBar) this.ocrProgressBar.style.width = '10%';
    if (this.ocrOutputText) this.ocrOutputText.value = '';
    if (this.mathRenderedPreview) this.mathRenderedPreview.classList.add('hidden');
    this.updateOcrWordCount('');

    const rawSrc = this.activeOcrItem.compressedDataUrl || this.activeOcrItem.originalDataUrl;
    const imageToSend = await this.ensureDataUrl(rawSrc);

    if (engineMode === 'gemini') {
      if (this.ocrStatusText) this.ocrStatusText.textContent = 'جاري تحليل الصورة واستخراج الرموز والمعادلات الرياضية بواسطة الذكاء الاصطناعي (Gemini)...';
      if (this.ocrPercentText) this.ocrPercentText.textContent = '30%';
      if (this.ocrProgressBar) this.ocrProgressBar.style.width = '30%';

      try {
        const response = await fetch('/api/ocr/math', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageToSend }),
        });

        if (this.ocrPercentText) this.ocrPercentText.textContent = '80%';
        if (this.ocrProgressBar) this.ocrProgressBar.style.width = '80%';

        const data = await response.json();

        if (!response.ok || !data.success) {
          const isQuota = data.quotaExceeded || response.status === 429 || String(data.error || '').toLowerCase().includes('quota');
          if (isQuota && this.gracefulFallbackBanner) {
            this.gracefulFallbackBanner.classList.remove('hidden');
            if (this.fallbackBannerMsg) {
              this.fallbackBannerMsg.textContent = 'وصلنا للحد المجاني اليوم 😅 جرّب الوضع المحلي أو عد غداً';
            }
          }
          throw new Error(data.error || 'فشلت معالجة الصورة عبر نموذج Gemini AI');
        }

        const extractedText = data.text ? data.text.trim() : '';

        if (this.ocrStatusText) {
          this.ocrStatusText.textContent = 'تم استخراج المعادلات والرموز الرياضية بـ (Gemini AI) بنجاح! ✨';
        }
        if (this.ocrPercentText) this.ocrPercentText.textContent = '100%';
        if (this.ocrProgressBar) this.ocrProgressBar.style.width = '100%';
        if (this.ocrOutputText) this.ocrOutputText.value = extractedText;
        this.updateOcrWordCount(extractedText);

        this.renderKatexMath(extractedText);
        return;
      } catch (geminiErr: any) {
        console.warn('Gemini Math OCR fallback triggered:', geminiErr);
        if (this.gracefulFallbackBanner) {
            this.gracefulFallbackBanner.classList.remove('hidden');
            if (this.fallbackBannerMsg) {
              this.fallbackBannerMsg.textContent = `فشل الاتصال بالذكاء الاصطناعي (${geminiErr.message}). سيتم التحويل للمحرك المحلي.`;
            }
        }
        if (this.ocrStatusText) {
          this.ocrStatusText.textContent = `جاري السقوط الأنيق (Graceful Fallback) والتحويل للمحرك المحلي (Tesseract equ)...`;
        }
      }
    }

    // Tesseract Local Engine Fallback
    if (this.ocrStatusText) this.ocrStatusText.textContent = 'جاري تحسين الصورة وضبط إعدادات تجزئة الرموز الرياضية (PSM)...';

    try {
      const targetSrc = await this.preprocessImageForOcr(rawSrc);

      const { createWorker } = await import('tesseract.js');
      
      let worker;
      try {
        worker = await createWorker('equ', 1, {
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round((m.progress || 0) * 100);
              if (this.ocrStatusText) this.ocrStatusText.textContent = 'جاري مسح الرموز الرياضية بـ (equ)...';
              if (this.ocrPercentText) this.ocrPercentText.textContent = `${pct}%`;
              if (this.ocrProgressBar) this.ocrProgressBar.style.width = `${pct}%`;
            } else if (m.status) {
              if (this.ocrStatusText) this.ocrStatusText.textContent = `جاري المعالجة بـ (equ): ${m.status}`;
            }
          }
        });
      } catch (workerErr) {
        console.warn('First langPath attempt failed, trying fallback worker...', workerErr);
        worker = await createWorker('eng+equ', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round((m.progress || 0) * 100);
              if (this.ocrStatusText) this.ocrStatusText.textContent = 'جاري مسح الرموز بالموديل البديل...';
              if (this.ocrPercentText) this.ocrPercentText.textContent = `${pct}%`;
              if (this.ocrProgressBar) this.ocrProgressBar.style.width = `${pct}%`;
            }
          }
        });
      }

      // Try PSM 6 (Single uniform block of text)
      await worker.setParameters({
        tessedit_pageseg_mode: '6', // PSM SINGLE_BLOCK
      } as any);

      let res = await worker.recognize(targetSrc);
      let extractedText = res.data.text ? res.data.text.trim() : '';

      // If PSM 6 produced empty output, try PSM 11 (Sparse text / scattered symbols)
      if (!extractedText) {
        if (this.ocrStatusText) this.ocrStatusText.textContent = 'إعادة المحاولة مع وضع الرموز المبعثرة (PSM 11)...';
        await worker.setParameters({
          tessedit_pageseg_mode: '11', // PSM SPARSE_TEXT
        } as any);
        res = await worker.recognize(targetSrc);
        extractedText = res.data.text ? res.data.text.trim() : '';
      }

      // If still empty, try original image without contrast preprocessing in PSM 6
      if (!extractedText) {
        if (this.ocrStatusText) this.ocrStatusText.textContent = 'إعادة المحاولة على الصورة الأصلية (PSM 6)...';
        await worker.setParameters({
          tessedit_pageseg_mode: '6',
        } as any);
        res = await worker.recognize(rawSrc);
        extractedText = res.data.text ? res.data.text.trim() : '';
      }

      await worker.terminate();

      if (this.ocrStatusText) {
        this.ocrStatusText.textContent = extractedText 
          ? 'تم استخراج الرموز والمعادلات الرياضية بنجاح! ✨' 
          : 'تعذر على مكتبة Tesseract/equ تمييز التراكيب المعقدة في هذه الصورة (تتطلب معادلات الكسور والرموز ثلاثية الأبعاد معالجة أكثر تعقيداً).';
      }
      if (this.ocrPercentText) this.ocrPercentText.textContent = '100%';
      if (this.ocrProgressBar) this.ocrProgressBar.style.width = '100%';
      if (this.ocrOutputText) this.ocrOutputText.value = extractedText;
      this.updateOcrWordCount(extractedText);

      this.renderKatexMath(extractedText);

    } catch (err: any) {
      console.error('Math OCR Error:', err);
      if (this.ocrStatusText) this.ocrStatusText.textContent = `حدث خطأ أثناء تشغيل محرك equ: ${err?.message || 'خطأ غير معروف'}`;
      if (this.ocrPercentText) this.ocrPercentText.textContent = 'خطأ';
      if (this.ocrProgressBar) this.ocrProgressBar.style.width = '0%';
    }
  }

  private renderKatexMath(text: string) {
    if (!this.mathRenderedPreview || !this.mathKatexOutput || !text.trim()) return;

    const katex = (window as any).katex;
    const mathMatches = text.match(/\$\$[\s\S]+?\$\$|\$[^\$]+\$/g);

    this.mathKatexOutput.innerHTML = '';

    if (mathMatches && mathMatches.length > 0) {
      this.mathRenderedPreview.classList.remove('hidden');

      mathMatches.forEach((mathExpr) => {
        const cleanExpr = mathExpr.replace(/^\$\$?|\$\$?$/g, '').trim();
        const container = document.createElement('div');
        container.className = 'my-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center overflow-x-auto';

        if (katex) {
          try {
            katex.render(cleanExpr, container, {
              displayMode: mathExpr.startsWith('$$'),
              throwOnError: false
            });
          } catch (e) {
            container.textContent = cleanExpr;
          }
        } else {
          container.textContent = cleanExpr;
        }

        this.mathKatexOutput.appendChild(container);
      });
    } else if (/[=\+\-\*\/\^\\∫∑√α-ωΑ-Ω]/.test(text)) {
      // If no explicit LaTeX delimiters but math symbols exist, try rendering line by line
      this.mathRenderedPreview.classList.remove('hidden');
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      
      lines.forEach((line) => {
        const container = document.createElement('div');
        container.className = 'my-1.5 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center overflow-x-auto font-mono text-sm';
        if (katex) {
          try {
            katex.render(line, container, { displayMode: true, throwOnError: false });
          } catch (e) {
            container.textContent = line;
          }
        } else {
          container.textContent = line;
        }
        this.mathKatexOutput.appendChild(container);
      });
    } else {
      this.mathRenderedPreview.classList.add('hidden');
    }
  }

  private copyOcrText() {
    if (!this.ocrOutputText || !this.ocrOutputText.value) return;
    navigator.clipboard.writeText(this.ocrOutputText.value);

    if (this.ocrCopyBtn) {
      const originalHtml = this.ocrCopyBtn.innerHTML;
      this.ocrCopyBtn.innerHTML = `<span>✅ تم النسخ!</span>`;
      setTimeout(() => {
        if (this.ocrCopyBtn) this.ocrCopyBtn.innerHTML = originalHtml;
      }, 2000);
    }
  }

  private downloadOcrText() {
    if (!this.ocrOutputText || !this.ocrOutputText.value) return;
    const blob = new Blob([this.ocrOutputText.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const rawName = this.activeOcrItem ? this.activeOcrItem.originalName : 'extracted_text';
    const baseName = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;
    a.download = `${baseName}_text.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private removeItem(id: string) {
    this.filesList = this.filesList.filter(item => item.id !== id);
    const card = document.getElementById(`item-card-${id}`);
    if (card) card.remove();
    this.updateUIState();
    this.updateSummaryStats();
  }

  private clearAll() {
    this.filesList = [];
    this.fileListContainer.innerHTML = '';
    this.updateUIState();
    this.updateSummaryStats();
  }

  private async downloadAllAsZip() {
    if (this.filesList.length === 0) return;

    const completed = this.filesList.filter(i => i.status === 'done' && i.compressedBlob);
    if (completed.length === 0) {
      alert('لا توجد صور مكتملة للتحميل.');
      return;
    }

    this.downloadAllBtn.disabled = true;
    this.downloadAllBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin inline-block mr-1" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      جاري تجهيز ZIP...
    `;

    try {
      const zip = new JSZip();
      const ext = this.getExtensionFromMime(this.targetFormat);

      completed.forEach((item) => {
        const cleanName = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
        const filename = `${cleanName}-compressed${ext}`;
        if (item.compressedBlob) {
          zip.file(filename, item.compressedBlob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `compressed_images_${Date.now()}.zip`;
      link.click();
    } catch (err) {
      console.error('Error generating zip:', err);
      alert('حدث خطأ أثناء تجميع ملف ZIP.');
    } finally {
      this.downloadAllBtn.disabled = false;
      this.downloadAllBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        تحميل جميع الصور (ZIP)
      `;
    }
  }

  private async downloadAllAsPdf() {
    if (this.filesList.length === 0) return;

    const completed = this.filesList.filter(i => i.status === 'done' && i.compressedBlob && i.compressedDataUrl);
    if (completed.length === 0) {
      alert('لا توجد صور مكتملة للتحويل إلى PDF.');
      return;
    }

    if (!this.downloadPdfBtn) return;
    const originalHtml = this.downloadPdfBtn.innerHTML;
    this.downloadPdfBtn.disabled = true;
    this.downloadPdfBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin inline-block mr-1" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      جاري إنشاء PDF...
    `;

    try {
      // Dynamic import: pdf-lib is fetched as a separate chunk ONLY when this function
      // actually runs (i.e. the user clicked the PDF button) - it adds zero bytes to the
      // main bundle that every visitor downloads.
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();

      for (const item of completed) {
        // Load the compressed image and re-encode it as JPEG on a canvas. The compressed
        // output might be WebP/AVIF/PNG - re-encoding guarantees pdf-lib can embed it reliably.
        const img = await this.loadImage(item.compressedDataUrl as string);
        const w = item.compressedWidth || img.width;
        const h = item.compressedHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const cctx = canvas.getContext('2d');
        if (!cctx) continue;

        cctx.fillStyle = '#FFFFFF';
        cctx.fillRect(0, 0, w, h);
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = 'high';
        cctx.drawImage(img, 0, 0, w, h);
        
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());

        const embeddedImage = await pdfDoc.embedJpg(jpegBytes);
        const page = pdfDoc.addPage([w, h]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: w,
          height: h,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converted_images_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF.');
    } finally {
      this.downloadPdfBtn.disabled = false;
      this.downloadPdfBtn.innerHTML = originalHtml;
    }
  }

  private async downloadSingleAsPdf(item: ProcessedItem) {
    if (item.status !== 'done' || !item.compressedDataUrl) {
      alert('الصورة ليست جاهزة بعد.');
      return;
    }

    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();

      const img = await this.loadImage(item.compressedDataUrl);
      const w = item.compressedWidth || img.width;
      const h = item.compressedHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const cctx = canvas.getContext('2d');
      if (!cctx) return;

      cctx.fillStyle = '#FFFFFF';
      cctx.fillRect(0, 0, w, h);
      cctx.imageSmoothingEnabled = true;
      cctx.imageSmoothingQuality = 'high';
      cctx.drawImage(img, 0, 0, w, h);

      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());

      const embeddedImage = await pdfDoc.embedJpg(jpegBytes);
      const page = pdfDoc.addPage([w, h]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: w,
        height: h,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const baseName = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
      a.download = `${baseName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating single PDF:', err);
      alert('حدث خطأ أثناء تحويل الصورة إلى PDF.');
    }
  }

  private updateUIState() {
    const hasFiles = this.filesList.length > 0;
    if (this.emptyState) {
      this.emptyState.style.display = hasFiles ? 'none' : 'block';
    }
    if (this.batchActionsBar) {
      this.batchActionsBar.style.display = hasFiles ? 'flex' : 'none';
    }
  }

  private updateSummaryStats() {
    if (!this.summaryStats) return;

    const completed = this.filesList.filter(i => i.status === 'done');
    if (completed.length === 0) {
      this.summaryStats.innerHTML = '';
      return;
    }

    const totalOriginal = completed.reduce((acc, curr) => acc + curr.originalSize, 0);
    const totalCompressed = completed.reduce((acc, curr) => acc + curr.compressedSize, 0);
    const savings = this.getSavings(totalOriginal, totalCompressed);

    const savingsBadge = savings.increased
      ? `<span class="bg-amber-500 text-white font-mono font-bold px-2 py-0.5 text-xs">⚠️ +${Math.abs(savings.percent)}% (زيادة ${this.formatBytes(Math.abs(savings.saved))})</span>`
      : `<span class="bg-black dark:bg-white text-white dark:text-black font-mono font-bold px-2 py-0.5 text-xs">✅ -${savings.percent}% (توفير ${this.formatBytes(savings.saved)})</span>`;

    this.summaryStats.innerHTML = `
      <div class="p-6 bg-[#E9ECEF] dark:bg-slate-900 border-r-4 border-black dark:border-white space-y-3 shadow-sm">
        <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">مقارنة الحجم الإجمالي</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="flex justify-between items-end border-b border-black/10 dark:border-white/10 pb-2 sm:pb-0 sm:border-b-0">
            <span class="text-xs text-slate-500 font-mono">قبل:</span>
            <span class="font-mono font-bold text-slate-900 dark:text-white">${this.formatBytes(totalOriginal)}</span>
          </div>
          <div class="flex justify-between items-end border-b border-black/10 dark:border-white/10 pb-2 sm:pb-0 sm:border-b-0">
            <span class="text-xs text-slate-500 font-mono">بعد:</span>
            <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">${this.formatBytes(totalCompressed)}</span>
          </div>
          <div class="flex justify-between items-end">
            <span class="text-xs text-slate-500 font-mono">النتيجة:</span>
            ${savingsBadge}
          </div>
        </div>
      </div>
    `;
  }

  private openCompareModal(item: ProcessedItem) {
    const modal = document.getElementById('compare-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('compare-title');
    const sliderOrigImg = document.getElementById('slider-orig-img') as HTMLImageElement;
    const sliderCompImg = document.getElementById('slider-comp-img') as HTMLImageElement;
    const sliderOrigBadge = document.getElementById('slider-orig-size-badge');
    const sliderCompBadge = document.getElementById('slider-comp-size-badge');
    const sliderSavingsBadge = document.getElementById('slider-savings-badge');

    const splitOrigImg = document.getElementById('compare-orig-img') as HTMLImageElement;
    const splitCompImg = document.getElementById('compare-comp-img') as HTMLImageElement;
    const splitOrigMeta = document.getElementById('compare-orig-meta');
    const splitCompMeta = document.getElementById('compare-comp-meta');

    const sliderInput = document.getElementById('compare-slider-input') as HTMLInputElement;
    const sliderWrapper = document.getElementById('slider-comp-wrapper');
    const sliderDivider = document.getElementById('slider-divider');

    const viewBtnSlider = document.getElementById('view-mode-slider');
    const viewBtnSplit = document.getElementById('view-mode-split');
    const sliderView = document.getElementById('compare-slider-view');
    const splitView = document.getElementById('compare-split-view');

    if (modalTitle) modalTitle.textContent = `معاينة المقارنة البصرية: ${item.originalName}`;

    // Set slider images & metadata
    if (sliderOrigImg) sliderOrigImg.src = item.originalDataUrl;
    if (sliderCompImg) sliderCompImg.src = item.compressedDataUrl || item.originalDataUrl;
    if (sliderOrigBadge) sliderOrigBadge.textContent = `${this.formatBytes(item.originalSize)} (${this.ltr(`${item.originalWidth}×${item.originalHeight}px`)})`;
    if (sliderCompBadge) sliderCompBadge.textContent = `${this.formatBytes(item.compressedSize)} (${this.ltr(`${item.compressedWidth}×${item.compressedHeight}px`)})`;
    
    if (sliderSavingsBadge) {
      const savings = this.getSavings(item.originalSize, item.compressedSize);
      if (savings.increased) {
        sliderSavingsBadge.textContent = `⚠️ تغير الحجم: +${Math.abs(savings.percent)}% (+${this.formatBytes(Math.abs(savings.saved))})`;
        sliderSavingsBadge.className = "bg-amber-600 text-white font-bold px-2.5 py-1 text-xs font-mono";
      } else {
        sliderSavingsBadge.textContent = `✅ توفير المساحة: ${savings.percent}% (${this.formatBytes(savings.saved)})`;
        sliderSavingsBadge.className = "bg-emerald-600 text-white font-bold px-2.5 py-1 text-xs font-mono";
      }
    }

    // Set split view images & metadata
    if (splitOrigImg) splitOrigImg.src = item.originalDataUrl;
    if (splitCompImg) splitCompImg.src = item.compressedDataUrl || item.originalDataUrl;
    if (splitOrigMeta) splitOrigMeta.textContent = `${this.formatBytes(item.originalSize)} (${this.ltr(`${item.originalWidth}×${item.originalHeight}px`)})`;
    if (splitCompMeta) splitCompMeta.textContent = `${this.formatBytes(item.compressedSize)} (${this.ltr(`${item.compressedWidth}×${item.compressedHeight}px`)})`;

    // Reset slider to 50%
    const sliderFrame = document.getElementById('compare-slider-frame');

    const updateSliderPos = (val: number) => {
      if (sliderWrapper) {
        sliderWrapper.style.clipPath = `polygon(0 0, ${val}% 0, ${val}% 100%, 0 100%)`;
      }
      if (sliderDivider) {
        sliderDivider.style.left = `${val}%`;
      }
    };

    updateSliderPos(50);

    if (sliderInput) {
      sliderInput.value = '50';
      sliderInput.oninput = (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        updateSliderPos(val);
      };
    }

    if (sliderFrame) {
      let isDragging = false;

      const updatePosFromClientX = (clientX: number) => {
        const rect = sliderFrame.getBoundingClientRect();
        if (rect.width <= 0) return;
        let percent = ((clientX - rect.left) / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));
        updateSliderPos(percent);
        if (sliderInput) sliderInput.value = percent.toString();
      };

      sliderFrame.onpointerdown = (e) => {
        isDragging = true;
        try { sliderFrame.setPointerCapture(e.pointerId); } catch (_) {}
        updatePosFromClientX(e.clientX);
      };

      sliderFrame.onpointermove = (e) => {
        if (!isDragging) return;
        updatePosFromClientX(e.clientX);
      };

      sliderFrame.onpointerup = (e) => {
        isDragging = false;
        try { sliderFrame.releasePointerCapture(e.pointerId); } catch (_) {}
      };

      sliderFrame.onpointercancel = () => {
        isDragging = false;
      };

      // Direct Touch Events for Mobile / Safari / WebView
      sliderFrame.ontouchstart = (e) => {
        if (e.touches.length > 0) {
          isDragging = true;
          updatePosFromClientX(e.touches[0].clientX);
        }
      };

      sliderFrame.ontouchmove = (e) => {
        if (isDragging && e.touches.length > 0) {
          e.preventDefault(); // Prevents page scrolling while dragging slider
          updatePosFromClientX(e.touches[0].clientX);
        }
      };

      sliderFrame.ontouchend = () => {
        isDragging = false;
      };
    }

    // View toggle handlers
    if (viewBtnSlider && viewBtnSplit && sliderView && splitView) {
      viewBtnSlider.onclick = () => {
        sliderView.classList.remove('hidden');
        splitView.classList.add('hidden');
        splitView.classList.remove('grid');

        viewBtnSlider.className = "px-3 py-1 text-xs font-mono font-bold bg-black text-white dark:bg-white dark:text-black transition";
        viewBtnSplit.className = "px-3 py-1 text-xs font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition";
      };

      viewBtnSplit.onclick = () => {
        sliderView.classList.add('hidden');
        splitView.classList.remove('hidden');
        splitView.classList.add('grid');

        viewBtnSplit.className = "px-3 py-1 text-xs font-mono font-bold bg-black text-white dark:bg-white dark:text-black transition";
        viewBtnSlider.className = "px-3 py-1 text-xs font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition";
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const closeBtn = document.getElementById('close-compare-modal');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      };
    }
  }
}

// Global initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ImageCompressorApp();
});
