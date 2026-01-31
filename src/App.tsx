import { useState, useEffect, useRef, useCallback } from 'react';

// Audio management
class BellAudio {
  context: AudioContext | null = null;
  buffer: AudioBuffer | null = null;
  loaded = false;
  lastPlayTime = 0;
  minInterval = 100; // Minimum ms between rings

  async init() {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.loadSound();
      this.loaded = true;
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  }

  async loadSound() {
    if (!this.context) return;
    try {
      // Try loading bell.wav (or mp3 as in previous code)
      const response = await fetch('/bell.mp3');
      if (!response.ok) {
        throw new Error('Could not load bell.mp3');
      }
      const arrayBuffer = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Failed to load bell sound, generating fallback:', error);
      await this.generateFallbackSound();
    }
  }

  async generateFallbackSound() {
    if (!this.context) return;
    // Fallback synthetic bell sound
    const sampleRate = this.context.sampleRate;
    const duration = 2.5;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const fundamentalFreq = 520;
    const harmonics = [1, 1.5, 2, 2.5, 3.2, 4.1];
    const harmonicAmps = [1.0, 0.6, 0.4, 0.3, 0.2, 0.1];

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      harmonics.forEach((harmonic, idx) => {
        const freq = fundamentalFreq * harmonic;
        const decay = Math.exp(-3 * t * (1 + idx * 0.3));
        sample += Math.sin(2 * Math.PI * freq * t) * harmonicAmps[idx] * decay;
      });

      const shimmer = Math.sin(2 * Math.PI * 3000 * t) * 0.15 * Math.exp(-8 * t);
      sample += shimmer;

      const envelope = Math.exp(-2 * t);
      data[i] = sample * envelope * 0.3;
    }

    this.buffer = buffer;
  }

  async play(intensity = 1.0) {
    if (!this.loaded || !this.buffer || !this.context) return;

    const now = Date.now();
    if (now - this.lastPlayTime < this.minInterval) return;
    this.lastPlayTime = now;

    try {
      // Resume context if suspended (mobile requirement)
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      
      source.buffer = this.buffer;
      source.connect(gainNode);
      gainNode.connect(this.context.destination);

      // Scale volume with intensity
      const volume = Math.min(0.3 + intensity * 0.7, 1.0);
      gainNode.gain.setValueAtTime(volume, this.context.currentTime);

      source.start(0);
    } catch (error) {
      console.error('Playback failed:', error);
    }
  }
}

// Motion detection
class MotionDetector {
  callback: (intensity: number) => void;
  lastX = 0;
  lastY = 0;
  lastZ = 0;
  threshold = 10;
  lastShakeTime = 0;
  shakeInterval = 100;
  permissionGranted = false;

  constructor(callback: (intensity: number) => void) {
    this.callback = callback;
  }

  async requestPermission() {
    // iOS 13+ requires explicit permission
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        this.permissionGranted = permission === 'granted';
        return this.permissionGranted;
      } catch (error) {
        console.error('Permission request failed:', error);
        return false;
      }
    } else {
      // Non-iOS or older iOS
      this.permissionGranted = true;
      return true;
    }
  }

  start() {
    if (!this.permissionGranted) return;

    window.addEventListener('devicemotion', (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;

      // Calculate shake intensity
      const deltaX = Math.abs(x - this.lastX);
      const deltaY = Math.abs(y - this.lastY);
      const deltaZ = Math.abs(z - this.lastZ);
      const delta = deltaX + deltaY + deltaZ;

      this.lastX = x;
      this.lastY = y;
      this.lastZ = z;

      // Detect shake
      const now = Date.now();
      if (delta > this.threshold && now - this.lastShakeTime > this.shakeInterval) {
        this.lastShakeTime = now;
        // Normalize intensity, clamp to 1
        const intensity = Math.min(delta / 50, 1);
        this.callback(intensity);
      }
    });
  }
}

function App() {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [ripples, setRipples] = useState<{id: number}[]>([]);
  const [instructions, setInstructions] = useState('Shake to Ring');
  
  const bellAudio = useRef<BellAudio | null>(null);
  const motionDetector = useRef<MotionDetector | null>(null);
  const bellSvgRef = useRef<SVGSVGElement>(null);
  
  // To keep track of audio init status
  const audioInitialized = useRef(false);

  const swingBell = useCallback((intensity = 0.5) => {
    if (!bellSvgRef.current) return;
    
    bellSvgRef.current.classList.remove('swing-light', 'swing-medium', 'swing-heavy', 'swing-intense');
    
    // Force reflow to restart animation if needed
    // void bellSvgRef.current.offsetWidth; 
    
    let swingClass = 'swing-light';
    if (intensity > 0.7) swingClass = 'swing-intense';
    else if (intensity > 0.5) swingClass = 'swing-heavy';
    else if (intensity > 0.3) swingClass = 'swing-medium';
    
    bellSvgRef.current.classList.add(swingClass);
    
    setTimeout(() => {
      if (bellSvgRef.current) {
        bellSvgRef.current.classList.remove(swingClass);
      }
    }, 1000);
  }, []);

  const createRipple = useCallback(() => {
    const id = Date.now();
    setRipples(prev => [...prev, { id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 1000);
  }, []);

  const ringBell = useCallback(async (intensity = 0.5) => {
    if (!bellAudio.current) {
       bellAudio.current = new BellAudio();
    }

    if (!audioInitialized.current) {
      await bellAudio.current.init();
      audioInitialized.current = true;
    }

    bellAudio.current.play(intensity);
    swingBell(intensity);
    createRipple();
    
    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([50]);
    }
  }, [swingBell, createRipple]);

  useEffect(() => {
    // Initialize things
    bellAudio.current = new BellAudio();
    
    motionDetector.current = new MotionDetector((intensity) => {
      ringBell(intensity);
    });

    // Check permissions on mount
    const checkPermission = async () => {
      if (typeof DeviceMotionEvent !== 'undefined' && 
          typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        setNeedsPermission(true);
      } else {
        // Auto start if no explicit permission method (Android/Desktop)
        if (motionDetector.current) {
             motionDetector.current.permissionGranted = true;
             motionDetector.current.start();
        }
      }
    };
    
    checkPermission();

    return () => {
       // Cleanup listeners if we exposed a remove method, but window event listener cleanup is good practice
       // MotionDetector doesn't have stop() in the snippet, simplified for now
    };
  }, [ringBell]);

  const handleEnableMotion = async () => {
    if (!motionDetector.current) return;
    
    const granted = await motionDetector.current.requestPermission();
    if (granted) {
      motionDetector.current.start();
      setNeedsPermission(false);
      setInstructions('Tap or shake to ring the bell');
    } else {
      alert('Motion permission denied. You can still tap to ring the bell.');
      setNeedsPermission(false);
      setInstructions('Tap to ring the bell');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-primary touch-manipulation">
       {/* Ambient background handled by CSS body::before or we add it here if scoped */}
       <div className="absolute inset-0 pointer-events-none" 
            style={{
              background: `
                radial-gradient(circle at 30% 40%, rgba(255, 255, 255, 0.06) 0%, transparent 50%),
                radial-gradient(circle at 70% 60%, rgba(0, 0, 0, 0.04) 0%, transparent 50%)
              `
            }} 
       />

      <div className="container relative flex items-center justify-center w-full h-[100vh] perspective-[1000px]">
        <div 
            className="bell-wrapper relative cursor-pointer select-none transform-style-3d will-change-transform transition-transform duration-75 active:scale-95"
            onClick={() => ringBell(0.7)}
        >
          <div className="white-circle w-[min(80vw,80vh,400px)] h-[min(80vw,80vh,400px)] bg-white rounded-full flex items-center justify-center relative shadow-[0_20px_60px_var(--shadow)] overflow-visible">
            {/* Ripples */}
            {ripples.map(ripple => (
              <div key={ripple.id} className="ripple" />
            ))}

            <svg 
              ref={bellSvgRef}
              className="bell-svg w-1/2 h-1/2 drop-shadow-xl origin-[center_20%] will-change-transform" 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 64 64" 
              fill="#0094DA"
            >
              <g>
                <path d="M50,22c0-8.577-6.004-15.74-14.035-17.548C35.984,4.304,36,4.154,36,4c0-2.209-1.791-4-4-4s-4,1.791-4,4 c0,0.154,0.016,0.304,0.035,0.452C20.004,6.26,14,13.423,14,22v12h36V22z M33.983,4.115C33.332,4.043,32.671,4,32,4 s-1.332,0.043-1.983,0.115C30.014,4.075,30,4.04,30,4c0-1.104,0.896-2,2-2s2,0.896,2,2C34,4.04,33.986,4.075,33.983,4.115z" />
                <rect x="14" y="36" width="36" height="4" />
                <path d="M56,48c-3.313,0-6-2.687-6-6H14c0,3.313-2.687,6-6,6c-2.209,0-4,1.791-4,4s1.791,4,4,4h16 c0,4.418,3.582,8,8,8s8-3.582,8-8h16c2.209,0,4-1.791,4-4S58.209,48,56,48z M32,62c-3.313,0-6-2.687-6-6h12 C38,59.313,35.313,62,32,62z" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {needsPermission && (
        <button 
          onClick={handleEnableMotion}
          className="enable-motion-btn absolute top-5 right-5 bg-white/95 text-primary px-5 py-2.5 rounded-full text-[13px] font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all z-50"
        >
          Enable Motion
        </button>
      )}

      <div className="absolute create-ripple bottom-[10vh] left-1/2 -translate-x-1/2 text-center text-white/50 text-sm font-light tracking-widest max-w-[90vw]">
        {instructions}
      </div>
    </div>
  );
}

export default App;
