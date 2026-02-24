'use client';
import { useEffect, useRef, useState, MouseEvent } from 'react';
import Hls from 'hls.js';
import styles from './player.module.css';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, PictureInPicture, ChevronRight, Check, Activity,
  RotateCcw, RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stream {
  quality: string;
  url: string;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '00:00';
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function NativePlayer({ 
  iframeSource, 
  nextEpisode 
}: { 
  iframeSource: string;
  nextEpisode?: { title: string; onPlay: () => void };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [streams, setStreams] = useState<Stream[]>([]);
  const [activeStream, setActiveStream] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState('');
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isChangingStream, setIsChangingStream] = useState(false);
  const [buffered, setBuffered] = useState(0);
  
  // Next Episode Popup
  const [showNextPopup, setShowNextPopup] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(4);
  const hasTriggeredNext = useRef(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for timers
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { token, domain } = (() => {
    try {
      const u = new URL(iframeSource);
      return { 
        token: u.searchParams.get('player_token'),
        domain: u.origin
      };
    } catch {
      return { token: null, domain: null };
    }
  })();

  // Track user activity to auto-hide controls
  const handleMouseMove = () => {
    setIsHovering(true);
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setShowControls(false);
        setIsHovering(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setError('لا يوجد رابط صالح للمشغل');
      setLoading(false);
      return;
    }

    const fetchStreams = async () => {
      try {
        const url = `/api/extract-video?token=${encodeURIComponent(token!)}${domain ? `&domain=${encodeURIComponent(domain)}` : ''}`;
        const res = await fetch(url);
        
        if (!res.ok) {
           throw new Error(`تعذر استخراج الفيديو (Error ${res.status})`);
        }

        const data = await res.json();
        
        if (data.streams && data.streams.length > 0) {
          setStreams(data.streams);
          const autoStream = data.streams.find((s: Stream) => s.quality.toLowerCase() === 'auto');
          setActiveStream(autoStream?.url || data.streams[0].url);
        } else {
          setError(data.error || 'لم يتم العثور على جودات متوفرة');
        }
      } catch (err: any) {
        console.error('Failed to fetch streams:', err);
        setError(err.message || 'تعذر تحميل الفيديو');
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
  }, [token]);

  useEffect(() => {
    if (!activeStream || !videoRef.current) return;
    setStreamReady(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Proxy stream to bypass CORS
    const proxiedUrl = `/api/proxy-stream?url=${encodeURIComponent(activeStream)}`;
    const video = videoRef.current;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      const time = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(time);

      if (videoRef.current.buffered.length > 0) {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBuffered((bufferedEnd / dur) * 100);
      }
      
      // Auto-trigger Next Episode Popup 5 mins before end (300s)
      if (nextEpisode && dur > 300 && dur - time <= 300 && !hasTriggeredNext.current) {
        hasTriggeredNext.current = true;
        setShowNextPopup(true);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
        setStreamReady(true); // Metadata is enough to show the player
      }
    };
    const handleCanPlay = () => {
      setStreamReady(true);
      setIsBuffering(false);
    };
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsChangingStream(false);
      setStreamReady(true);
    };

    const setupEvents = () => {
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('loadeddata', handleCanPlay);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('playing', handlePlaying);
    };

    const cleanupEvents = () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleCanPlay);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        startPosition: currentTime > 0 ? currentTime : 0,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setupEvents();
        if (isPlaying || currentTime > 0 || !isChangingStream) {
          video.play().catch(e => {
            if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
              console.error('Play error:', e);
            }
          });
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setError('خطأ في تشغيل الفيديو (Source Error)');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS for iOS/Safari
      video.src = proxiedUrl;
      setupEvents();
      
      // Auto-play attempt for iOS
      if (isPlaying || currentTime > 0 || !isChangingStream) {
        video.play().catch(() => {
          // iOS often blocks auto-play without user interaction
          console.log('iOS auto-play blocked');
        });
      }
    }

    return () => {
      cleanupEvents();
      if (hlsRef.current) {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStream]); // We only trigger on stream (quality) change, persisting time inside

  // Controls Actions
  useEffect(() => {
    if (showNextPopup && nextCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setNextCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            nextEpisode?.onPlay();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
  }, [showNextPopup, nextEpisode]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    const container = containerRef.current;

    // iOS Compatibility: iPhone doesn't support the standard Fullscreen API on divs, 
    // but it does support webkitEnterFullscreen on the video element itself.
    if (!document.fullscreenEnabled && (video as any).webkitEnterFullscreen) {
      try {
        if (isPlaying) {
          (video as any).webkitEnterFullscreen();
        } else {
          await video.play();
          (video as any).webkitEnterFullscreen();
        }
        return;
      } catch (e) {
        console.error("iOS Fullscreen error:", e);
      }
    }

    if (!document.fullscreenElement) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
      } catch (err) {
        console.error("Error attempting to enable full-screen mode:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const togglePip = async () => {
    if (videoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  };

  const handleTimelineClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // RTL logic: 0 is at rect.right, 1 is at rect.left
    const pos = (rect.right - e.clientX) / rect.width;
    const seekTo = Math.max(0, Math.min(pos * duration, duration));
    videoRef.current.currentTime = seekTo;
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSettings) return;
      
      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'arrowleft':
          skip(-5);
          break;
        case 'arrowright':
          skip(5);
          break;
        case 'j':
          skip(-10);
          break;
        case 'l':
          skip(10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, isFullscreen, showSettings]);

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVideoClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If double-click happens, the first single-click timer will be cleared
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      
      // Handle Double Click Action
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickX = e.clientX - rect.left;
      
      if (clickX < rect.width / 3) skip(-10);
      else if (clickX > (rect.width * 2) / 3) skip(10);
      else toggleFullscreen();
      
      return;
    }

    // Set timer for single click
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      if (showSettings) {
        setShowSettings(false);
      } else {
        togglePlay();
      }
    }, 250);
  };

  // Show full-screen loading ONLY if we don't have metadata yet
  if (loading && streams.length === 0) {
    return (
      <div className={styles.playerWrapper}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>جاري تجهيز المشغل المتقدم...</p>
        </div>
      </div>
    );
  }

  // Error state (only if we have no streams at all)
  if (error && streams.length === 0) {
    return (
      <div className={styles.playerWrapper}>
        <div className={styles.errorState}>
          <Activity size={48} color="#ef4444" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className={styles.playerWrapper} 
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if(isPlaying) setShowControls(false);
      }}
      onClick={handleVideoClick}
    >
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          className={styles.videoElement}
          playsInline
        />
      </div>
      
      {(isBuffering || isChangingStream || !streamReady) && (
        <div className={styles.centerLoading}>
          <div className={styles.spinner} />
          {(!streamReady && !isChangingStream) && <p style={{ marginTop: '12px', fontSize: '14px', color: '#fff' }}>جاري الاتصال بالمصدر...</p>}
        </div>
      )}
      
      {/* Central Play/Pause Animation */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className={styles.centerPlayPause}
            style={{ pointerEvents: 'none' }}
          >
            <div className={styles.centerControlsGroup}>
              <button 
                className={styles.centerControlBtn} 
                onClick={(e) => { e.stopPropagation(); skip(10); }}
              >
                <div className={styles.iconWithText}>
                  <RotateCcw size={32} />
                  <span className={styles.tinyText} style={{ fontSize: '11px' }}>+10</span>
                </div>
              </button>

              <button 
                className={styles.centerPlayBtn} 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                <Play size={40} fill="currentColor" />
              </button>

              <button 
                className={styles.centerControlBtn} 
                onClick={(e) => { e.stopPropagation(); skip(-10); }}
              >
                <div className={styles.iconWithText}>
                  <RotateCw size={32} />
                  <span className={styles.tinyText} style={{ fontSize: '11px' }}>-10</span>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <div className={`${styles.controlsOverlay} ${showControls ? styles.active : ''}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Top bar (Title or branding can go here) */}
        <div className={styles.topControls}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
             FaselHD Player
          </div>
        </div>

        {/* Bottom bar */}
        <div className={styles.bottomControls}>
          
          <div className={styles.timelineContainer} onClick={handleTimelineClick}>
            <div className={styles.bufferedBar} style={{ width: `${buffered}%` }} />
            <div className={styles.timelineProgress} style={{ width: `${progressPercent}%` }}>
              <div className={styles.timelineThumb} />
            </div>
          </div>

          <div className={styles.mainControls}>
            <div className={styles.leftControls}>
              <button className={styles.controlBtn} onClick={togglePlay}>
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
              </button>

              <div className={styles.skipButtonsGroup}>
                <button className={styles.controlBtn} onClick={() => skip(10)} title="تقديم 10 ثواني">
                  <div className={styles.iconWithText}>
                    <RotateCcw size={26} />
                    <span className={styles.tinyText}>+10</span>
                  </div>
                </button>

                <button className={styles.controlBtn} onClick={() => skip(-10)} title="رجوع 10 ثواني">
                  <div className={styles.iconWithText}>
                    <RotateCw size={26} />
                    <span className={styles.tinyText}>-10</span>
                  </div>
                </button>
              </div>
              
              <div className={styles.volumeContainer}>
                <button className={styles.controlBtn} onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={isMuted ? 0 : volume} 
                  onChange={handleVolumeChange}
                  className={`${styles.sliderInput} ${styles.volumeSlider}`}
                />
              </div>

              <div className={styles.timeDisplay}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className={styles.rightControls}>
              {/* Settings Menu Toggle */}
              <div style={{ position: 'relative' }}>
                <button 
                  className={styles.controlBtn} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                  }}
                  style={{ 
                    transform: showSettings ? 'rotate(45deg)' : 'none',
                    zIndex: 40
                  }}
                >
                  <Settings size={22} />
                </button>

                {/* Settings Panel */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className={styles.settingsMenu}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.settingsMenuHeader}>
                        <Settings size={16} /> الجودة
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {streams.map((s, idx) => (
                          <button 
                            key={idx}
                            className={`${styles.settingsOption} ${activeStream === s.url ? styles.active : ''}`}
                            onClick={() => {
                              if (activeStream === s.url) return;
                              setIsChangingStream(true);
                              setIsBuffering(true);
                              setActiveStream(s.url);
                              setShowSettings(false);
                            }}
                          >
                            <span>{s.quality}</span>
                            {activeStream === s.url && (
                              <motion.div layoutId="activeQuality" className={styles.activeCheck}>
                                <Check size={16} />
                              </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button className={styles.controlBtn} onClick={togglePip}>
                <PictureInPicture size={22} />
              </button>

              <button className={styles.controlBtn} onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Next Episode Popup */}
      <AnimatePresence>
        {showNextPopup && nextEpisode && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={styles.nextEpisodePopup}
          >
            <div className={styles.nextType}>الحلقة التالية خلال {nextCountdown} ثوانٍ</div>
            <div className={styles.nextTitle}>{nextEpisode.title}</div>
            <div className={styles.nextActions}>
              <button 
                className={styles.nextPlayBtn}
                onClick={() => nextEpisode.onPlay()}
              >
                تشغيل الآن
              </button>
              <button 
                className={styles.nextCancelBtn}
                onClick={() => {
                  setShowNextPopup(false);
                  if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                }}
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
