import * as mm from 'music-metadata-browser';
import { Song } from "../types";

// 1. 在 audioEngine.ts 顶部定义类型扩展（防御性编程：清晰界定数据的边界）
export interface AetheriaFile extends File {
  /** 
   * 移动端原生系统透传的底层文件流 URL
   * 例如: https://appassets.androidplatform.net/local-audio/?uri=...
   */
  virtualStreamUrl?: string;
}

export async function parseAudioFile(file: File): Promise<Song> {
  const tryParse = async (chunkSize: number): Promise<Song | null> => {
    try {
      const blobSlice = file.size > chunkSize ? file.slice(0, chunkSize) : file;
      const buffer = await blobSlice.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      const metadata = await mm.parseBuffer(uint8Array, {
        mimeType: file.type,
        path: file.name,
      }, {
        duration: false,
        skipCovers: false,
        skipPostHeaders: true,
      });

      // Check if we got enough info. If title/artist are missing, maybe we need a bigger chunk?
      // But usually 128KB is enough for basic tags.

      let coverUrl = null;
      let coverBlob = null;
      const picture = metadata.common.picture?.[0];
      if (picture) {
        coverBlob = new Blob([picture.data], { type: picture.format });
        coverUrl = URL.createObjectURL(coverBlob);
      }

      return {
        // Use a more stable ID based on file name and size to ensure playlist consistency
        id: `song-${file.name}-${file.size}`,
        file,
        title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.common.artist || "Unknown Artist",
        album: metadata.common.album || "Unknown Album",
        coverUrl,
        coverBlob,
        duration: metadata.format.duration || 0,
        codec: metadata.format.codec,
        bitsPerSample: metadata.format.bitsPerSample,
        sampleRate: metadata.format.sampleRate,
        bitrate: metadata.format.bitrate,
        lossless: metadata.format.lossless,
      };
    } catch (err) {
      return null;
    }
  };

  // Probe strategy: 128KB -> 1MB -> 10MB
  const chunkSizes = [128 * 1024, 1024 * 1024, 10 * 1024 * 1024];
  for (const size of chunkSizes) {
    const result = await tryParse(size);
    if (result && (result.title !== file.name.replace(/\.[^/.]+$/, "") || result.coverUrl)) {
      return result;
    }
    if (size === chunkSizes[chunkSizes.length - 1] && result) return result;
  }

  // Fallback to basic info if parsing fails
  return {
    id: `song-${file.name}-${file.size}`,
    file,
    title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Unknown Artist",
    album: "Unknown Album",
    coverUrl: null,
    duration: 0,
  };
}

export class AudioEngine extends EventTarget {
  audioContext: AudioContext | null = null;
  audioA: HTMLAudioElement;
  audioB: HTMLAudioElement;
  activeAudio: HTMLAudioElement;

  sourceA: MediaElementAudioSourceNode | null = null;
  sourceB: MediaElementAudioSourceNode | null = null;
  gainA: GainNode | null = null;
  gainB: GainNode | null = null;

  analyserNode: AnalyserNode | null = null;
  masterGain: GainNode | null = null;

  eqLow: BiquadFilterNode | null = null;
  eqMid: BiquadFilterNode | null = null;
  eqHigh: BiquadFilterNode | null = null;

  panner: StereoPannerNode | null = null;
  limiter: DynamicsCompressorNode | null = null;

  monoSplitter: ChannelSplitterNode | null = null;
  monoMerger: ChannelMergerNode | null = null;
  monoGain: GainNode | null = null;

  settings = {
    crossfade: false,
    crossfadeDuration: 5,
    playbackFadeDuration: 0.5,
    forceMono: false,
    gain: 0,
    volumeLimit: 100,
    balance: 0,
    eq: [0, 0, 0] // Low, Mid, High
  };

  private crossfadeTriggered = false;
  private userVolume = 1;
  private pauseTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.audioA.crossOrigin = "anonymous";
    this.audioB.crossOrigin = "anonymous";
    this.activeAudio = this.audioA;

    this.setupAudioListeners(this.audioA);
    this.setupAudioListeners(this.audioB);

    this.loadSettings();
  }

  loadSettings() {
    const saved = localStorage.getItem('aetheria_settings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (e) { }
    }
  }

  saveSettings() {
    localStorage.setItem('aetheria_settings', JSON.stringify(this.settings));
    this.applySettings();
  }

  updateSettings(newSettings: Partial<typeof this.settings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  setupAudioListeners(audio: HTMLAudioElement) {
    audio.addEventListener('timeupdate', () => {
      if (audio === this.activeAudio) {
        this.dispatchEvent(new Event('timeupdate'));

        // Check crossfade
        if (this.settings.crossfade && audio.duration && !this.crossfadeTriggered) {
          if (audio.currentTime >= audio.duration - this.settings.crossfadeDuration) {
            this.crossfadeTriggered = true;
            this.dispatchEvent(new Event('crossfade-start'));
          }
        }
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (audio === this.activeAudio) this.dispatchEvent(new Event('loadedmetadata'));
    });
    audio.addEventListener('ended', () => {
      if (audio === this.activeAudio && !this.settings.crossfade) {
        this.dispatchEvent(new Event('ended'));
      }
    });
  }

  init() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 512;

    this.gainA = this.audioContext.createGain();
    this.gainB = this.audioContext.createGain();
    this.masterGain = this.audioContext.createGain();

    this.eqLow = this.audioContext.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 320;

    this.eqMid = this.audioContext.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.5;

    this.eqHigh = this.audioContext.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 3200;

    this.panner = this.audioContext.createStereoPanner();
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.005;
    this.limiter.release.value = 0.05;

    this.monoSplitter = this.audioContext.createChannelSplitter(2);
    this.monoMerger = this.audioContext.createChannelMerger(2);
    this.monoGain = this.audioContext.createGain();
    this.monoGain.gain.value = 0.5; // Mix L and R equally

    this.sourceA = this.audioContext.createMediaElementSource(this.audioA);
    this.sourceB = this.audioContext.createMediaElementSource(this.audioB);

    this.sourceA.connect(this.gainA);
    this.sourceB.connect(this.gainB);

    this.gainA.connect(this.analyserNode);
    this.gainB.connect(this.analyserNode);

    this.analyserNode.connect(this.masterGain);
    this.masterGain.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.panner);

    // Mono routing setup
    this.panner.connect(this.monoSplitter);
    this.monoSplitter.connect(this.monoGain, 0);
    this.monoSplitter.connect(this.monoGain, 1);

    // Default connection (stereo)
    this.panner.connect(this.limiter);
    this.limiter.connect(this.audioContext.destination);

    this.applySettings();
  }

  applySettings() {
    if (!this.audioContext) return;

    // EQ
    if (this.eqLow) this.eqLow.gain.value = this.settings.eq[0];
    if (this.eqMid) this.eqMid.gain.value = this.settings.eq[1];
    if (this.eqHigh) this.eqHigh.gain.value = this.settings.eq[2];

    // Balance
    if (this.panner) this.panner.pan.value = this.settings.balance;

    // Gain (convert dB to linear)
    if (this.masterGain) this.masterGain.gain.value = Math.pow(10, this.settings.gain / 20);

    // Volume Limit (convert % to linear)
    const limitLinear = this.settings.volumeLimit / 100;
    // We apply this to the active audio element's volume property in setVolume
    this.setVolume(this.userVolume);

    // Force Mono
    if (this.panner && this.limiter && this.monoSplitter && this.monoMerger && this.monoGain) {
      this.panner.disconnect();
      this.monoGain.disconnect();
      this.monoMerger.disconnect();

      if (this.settings.forceMono) {
        this.panner.connect(this.monoSplitter);
        this.monoGain.connect(this.monoMerger, 0, 0);
        this.monoGain.connect(this.monoMerger, 0, 1);
        this.monoMerger.connect(this.limiter);
      } else {
        this.panner.connect(this.limiter);
      }
    }
  }

  // 2. 替换原有的 play 函数
  play(file?: AetheriaFile) {
    if (!this.audioContext) this.init();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }

    const now = this.audioContext!.currentTime;

    if (file) {
      const oldAudio = this.activeAudio;
      const nextAudio = this.activeAudio === this.audioA ? this.audioB : this.audioA;
      const oldGain = oldAudio === this.audioA ? this.gainA : this.gainB;
      const nextGain = nextAudio === this.audioA ? this.gainA : this.gainB;

      // 🧠 【底层优化：精准垃圾回收 (Targeted GC)】
      // 只有当上一个 src 确实是在内存中分配的 Blob URL 时，才释放它的内存指针。
      // 绝不能触碰原生层代理过来的 HTTP URL，否则会导致协议栈异常崩溃。
      if (nextAudio.src && nextAudio.src.startsWith('blob:')) {
        URL.revokeObjectURL(nextAudio.src);
      }

      // ⚡ 【架构选型：双轨制加载策略】
      // 如果存在原生层穿透的虚拟数据流路径，直接走 HTTP(S) 流读取，彻底解放 V8 引擎内存；
      // 否则回退到标准的 Web 内存 Blob 创建模式。
      if (file.virtualStreamUrl) {
        nextAudio.src = file.virtualStreamUrl;
      } else {
        nextAudio.src = URL.createObjectURL(file);
      }

      if (this.settings.crossfade && oldAudio.src && !oldAudio.paused) {
        // 【Crossfade 核心逻辑维持不变】
        const duration = this.settings.crossfadeDuration;

        oldGain!.gain.cancelScheduledValues(now);
        nextGain!.gain.cancelScheduledValues(now);

        const currentGainValue = oldGain!.gain.value;
        oldGain!.gain.setValueAtTime(currentGainValue, now);
        oldGain!.gain.linearRampToValueAtTime(0, now + duration);

        nextGain!.gain.setValueAtTime(0, now);
        nextGain!.gain.linearRampToValueAtTime(1, now + duration);

        this.activeAudio = nextAudio;
        this.crossfadeTriggered = false;

        setTimeout(() => {
          oldAudio.pause();
        }, duration * 1000);
      } else {
        // No crossfade, but apply playback fade-in if configured
        oldAudio.pause();
        if (oldGain) {
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.value = 0;
        }

        if (nextGain) {
          nextGain.gain.cancelScheduledValues(now);
          if (this.settings.playbackFadeDuration > 0) {
            nextGain.gain.setValueAtTime(0, now);
            nextGain.gain.linearRampToValueAtTime(1, now + this.settings.playbackFadeDuration);
          } else {
            nextGain.gain.value = 1;
          }
        }

        this.activeAudio = nextAudio;
        this.crossfadeTriggered = false;
      }
    } else {
      // Resuming current audio
      const activeGain = this.activeAudio === this.audioA ? this.gainA : this.gainB;
      if (activeGain) {
        activeGain.gain.cancelScheduledValues(now);
        if (this.settings.playbackFadeDuration > 0) {
          const currentVal = activeGain.gain.value;
          activeGain.gain.setValueAtTime(currentVal, now);
          activeGain.gain.linearRampToValueAtTime(1, now + this.settings.playbackFadeDuration);
        } else {
          activeGain.gain.value = 1;
        }
      }
    }

    // 🛡️ 【防御性编程】: 捕获由于用户未交互（User Gesture）导致的 Play Promise 拒绝
    this.activeAudio.play().catch(e => {
      console.warn("[AudioEngine] Playback interrupted or prevented by browser policy:", e);
    });
  }

  pause() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const activeGain = this.activeAudio === this.audioA ? this.gainA : this.gainB;

    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }

    if (this.settings.playbackFadeDuration > 0 && activeGain) {
      const currentVal = activeGain.gain.value;
      activeGain.gain.cancelScheduledValues(now);
      activeGain.gain.setValueAtTime(currentVal, now);
      activeGain.gain.linearRampToValueAtTime(0, now + this.settings.playbackFadeDuration);

      this.pauseTimeout = setTimeout(() => {
        this.activeAudio.pause();
        this.pauseTimeout = null;
      }, this.settings.playbackFadeDuration * 1000);
    } else {
      if (activeGain) {
        activeGain.gain.cancelScheduledValues(now);
        activeGain.gain.value = 0;
      }
      this.activeAudio.pause();
    }
  }

  setVolume(value: number) {
    this.userVolume = value;
    const limit = this.settings.volumeLimit / 100;
    const limitedVolume = value * limit;
    this.audioA.volume = limitedVolume;
    this.audioB.volume = limitedVolume;
  }

  seek(time: number) {
    this.activeAudio.currentTime = time;
  }

  get currentTime() {
    return this.activeAudio.currentTime;
  }

  get duration() {
    return this.activeAudio.duration;
  }
}

export const audioEngine = new AudioEngine();
