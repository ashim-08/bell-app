import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [isRinging, setIsRinging] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [ripples, setRipples] = useState<number[]>([]);
  const lastRingTime = useRef(0);
  const rippleIdRef = useRef(0);

  const COOLDOWN_MS = 1000;
  const SHAKE_THRESHOLD = 15;

  useEffect(() => {
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      setNeedsPermission(true);
    } else {
      setupMotionListener();
    }
  }, []);

  const requestMotionPermission = async () => {
    try {
      const permission = await (DeviceMotionEvent as any).requestPermission();
      if (permission === 'granted') {
        setNeedsPermission(false);
        setupMotionListener();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  const setupMotionListener = () => {
    let lastX = 0, lastY = 0, lastZ = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || !acc.x || !acc.y || !acc.z) return;

      const deltaX = Math.abs(acc.x - lastX);
      const deltaY = Math.abs(acc.y - lastY);
      const deltaZ = Math.abs(acc.z - lastZ);

      if (deltaX + deltaY + deltaZ > SHAKE_THRESHOLD) {
        ringBell();
      }

      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;
    };

    window.addEventListener('devicemotion', handleMotion);
  };

  const playBellSound = () => {
    const audio = new Audio('/bell.mp3');
    audio.play().catch(error => console.error('Error playing bell sound:', error));
  };

  const vibrateDevice = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  };

  const ringBell = () => {
    const now = Date.now();
    if (now - lastRingTime.current < COOLDOWN_MS) return;

    lastRingTime.current = now;
    setIsRinging(true);

    const rippleId = rippleIdRef.current++;
    setRipples(prev => [...prev, rippleId]);

    setTimeout(() => {
      setRipples(prev => prev.filter(id => id !== rippleId));
    }, 1000);

    playBellSound();
    vibrateDevice();

    setTimeout(() => {
      setIsRinging(false);
    }, 500);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
         style={{ backgroundColor: '#0d9bd7' }}>

      {needsPermission && (
        <button
          onClick={requestMotionPermission}
          className="absolute top-8 bg-white text-blue-600 px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
          style={{ color: '#0d9bd7' }}
        >
          Enable Motion
        </button>
      )}

      <div className="relative flex items-center justify-center">
        <div
          className="relative flex items-center justify-center bg-white rounded-full shadow-2xl cursor-pointer"
          style={{
            width: 'min(80vw, 320px)',
            height: 'min(80vw, 320px)',
            aspectRatio: '1/1'
          }}
          onClick={ringBell}
        >
          <motion.div
            animate={isRinging ? {
              rotate: [0, -15, 15, -15, 15, 0],
            } : {}}
            transition={{
              duration: 0.5,
              ease: "easeInOut"
            }}
          >
            <svg
              className="bell-svg w-32 h-32 sm:w-40 sm:h-40"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              viewBox="0 0 64 64"
              enableBackground="new 0 0 64 64"
              xmlSpace="preserve"
            >
              <g>
                <path
                  fill="#0094DA"
                  d="M50,22c0-8.577-6.004-15.74-14.035-17.548C35.984,4.304,36,4.154,36,4c0-2.209-1.791-4-4-4s-4,1.791-4,4 c0,0.154,0.016,0.304,0.035,0.452C20.004,6.26,14,13.423,14,22v12h36V22z M33.983,4.115C33.332,4.043,32.671,4,32,4 s-1.332,0.043-1.983,0.115C30.014,4.075,30,4.04,30,4c0-1.104,0.896-2,2-2s2,0.896,2,2C34,4.04,33.986,4.075,33.983,4.115z"
                />
                <rect x="14" y="36" fill="#0094DA" width="36" height="4" />
                <path
                  fill="#0094DA"
                  d="M56,48c-3.313,0-6-2.687-6-6H14c0,3.313-2.687,6-6,6c-2.209,0-4,1.791-4,4s1.791,4,4,4h16 c0,4.418,3.582,8,8,8s8-3.582,8-8h16c2.209,0,4-1.791,4-4S58.209,48,56,48z M32,62c-3.313,0-6-2.687-6-6h12 C38,59.313,35.313,62,32,62z"
                />
              </g>
            </svg>
          </motion.div>

          <AnimatePresence>
            {ripples.map((rippleId) => (
              <motion.div
                key={rippleId}
                className="absolute rounded-full border-4"
                style={{
                  borderColor: '#0d9bd7',
                  width: '80px',
                  height: '80px'
                }}
                initial={{
                  scale: 0.5,
                  opacity: 1
                }}
                animate={{
                  scale: 4,
                  opacity: 0
                }}
                exit={{
                  opacity: 0
                }}
                transition={{
                  duration: 1,
                  ease: "easeOut"
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed bottom-8 text-white text-xl sm:text-2xl font-medium tracking-wide">
        Shake to Ring
      </div>
    </div>
  );
}

export default App;
