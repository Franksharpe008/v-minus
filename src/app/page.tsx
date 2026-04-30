'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Trash2, Command, Volume2, VolumeX, Download, BrainCircuit, Activity, Rewind, FastForward, Settings2, Globe, Clock, Maximize2, X, Link } from 'lucide-react';
import * as webllm from '@mlc-ai/web-llm';
import type { LucideIcon } from 'lucide-react';

interface VideoClip {
  id: string;
  title: string;
  thumbnail: string;
  localUrl: string;
  originalUrl: string;
  platform: string;
  width?: number;
  height?: number;
  duration?: number;
  aspectRatio?: number;
  formatLabel?: string;
}

interface SearchApiResult {
  url: string;
}

interface SearchApiResponse {
  success?: boolean;
  results?: SearchApiResult[];
  error?: string;
}

interface ExtractApiResponse {
  success?: boolean;
  video?: VideoClip;
  error?: string;
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const MEDIA_HANDOFF_DURATION_MS = 180;

function VideoCard({ 
  clip, 
  isMuted,
  syncTime,
  volume,
  clipVolume,
  shouldPlay,
  isSuppressed,
  onToggleMute,
  onVolumeChange,
  onPlaybackTimeChange,
  onAction, 
  actionIcon: ActionIcon, 
  actionColor,
  onExpand
}: { 
  clip: VideoClip, 
  isMuted: boolean,
  syncTime?: number,
  volume: number,
  clipVolume: number,
  shouldPlay: boolean,
  isSuppressed: boolean,
  onToggleMute: () => void,
  onVolumeChange: (volume: number) => void,
  onPlaybackTimeChange: (time: number) => void,
  onAction: () => void, 
  actionIcon: LucideIcon, 
  actionColor: string,
  onExpand: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(clip.originalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted || isSuppressed;
      videoRef.current.volume = Math.max(0, Math.min(1, volume * clipVolume));
    }
  }, [isMuted, isSuppressed, volume, clipVolume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || syncTime === undefined || !Number.isFinite(syncTime)) return;

    if (Math.abs(video.currentTime - syncTime) > 0.75) {
      video.currentTime = syncTime;
    }
  }, [syncTime, clip.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSuppressed || !shouldPlay) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      // Browser autoplay policy can block playback until the next user gesture.
    });
  }, [isSuppressed, shouldPlay]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
      onPlaybackTimeChange(videoRef.current.currentTime);
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      videoRef.current.currentTime = percentage * videoRef.current.duration;
    }
  };

  const skip = (amount: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  return (
    <motion.div
      layoutId={`card-${clip.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-black rounded-xl overflow-hidden relative group w-full"
    >
      <video 
        ref={videoRef}
        src={clip.localUrl} 
        autoPlay 
        muted={isMuted || isSuppressed} 
        loop 
        preload="auto"
        playsInline 
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          void e.currentTarget.play();
        }}
        onTimeUpdate={handleTimeUpdate}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="w-full aspect-[9/16] object-cover bg-black cursor-pointer" 
      />
      
      {/* Sleek Scrubber Progress Bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer z-30 group-hover:h-2 transition-all"
        onClick={handleScrub}
      >
        <div 
          className="h-full bg-[#3b82f6] relative" 
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md shadow-black" />
        </div>
      </div>

      {/* Playback Navigation Overlay (Hover) */}
      <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
        <button 
          onClick={(e) => skip(-10, e)} 
          className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-[#3b82f6]/80 hover:scale-110 hover:-translate-y-1 hover:shadow-[0_0_22px_rgba(59,130,246,0.55)] transition-all duration-300 backdrop-blur-md shadow-xl"
          title="Rewind 10s"
        >
          <Rewind className="w-5 h-5 ml-[-2px]" />
        </button>
        
        {/* Expand Button (Theater Mode) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }} 
          className="pointer-events-auto w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#3b82f6] hover:scale-110 hover:-translate-y-1 hover:rotate-3 hover:shadow-[0_0_28px_rgba(59,130,246,0.65)] transition-all duration-300 backdrop-blur-md shadow-2xl border border-white/10"
          title="Theater Mode"
        >
          <Maximize2 className="w-6 h-6" />
        </button>

        <button 
          onClick={(e) => skip(10, e)} 
          className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-[#3b82f6]/80 hover:scale-110 hover:-translate-y-1 hover:shadow-[0_0_22px_rgba(59,130,246,0.55)] transition-all duration-300 backdrop-blur-md shadow-xl"
          title="Forward 10s"
        >
          <FastForward className="w-5 h-5 ml-[2px]" />
        </button>

        <div className="pointer-events-auto relative flex items-center justify-center group/volume">
          <button
            onClick={(e) => e.stopPropagation()}
            className="w-12 h-12 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-[#3b82f6]/80 hover:scale-110 hover:-translate-y-1 hover:shadow-[0_0_22px_rgba(59,130,246,0.55)] transition-all duration-300 backdrop-blur-md shadow-xl"
            title="Volume"
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-10 h-28 rounded-full bg-black/70 border border-white/10 backdrop-blur-md shadow-xl opacity-0 pointer-events-none group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto transition-opacity flex items-center justify-center">
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={clipVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="[writing-mode:vertical-lr] [direction:rtl] h-20 w-4 accent-[#3b82f6] cursor-pointer"
            />
          </div>
        </div>
      </div>
      
      {/* Mute Toggle Button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center transition-colors hover:bg-[#3b82f6] backdrop-blur-md z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-16 pb-6 flex items-end justify-between gap-3 pointer-events-none z-20">
        <div className="flex-1 min-w-0 pointer-events-auto">
          <h3 className="font-medium text-sm text-white line-clamp-2 mb-1.5 leading-tight drop-shadow-md">{clip.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            <p className="text-[10px] text-white font-semibold capitalize bg-white/20 px-2 py-0.5 rounded-md inline-block backdrop-blur-sm border border-white/10">{clip.platform}</p>
            {clip.formatLabel && (
              <p className="text-[10px] text-[#3b82f6] font-semibold bg-[#3b82f6]/20 px-2 py-0.5 rounded-md inline-block backdrop-blur-sm border border-[#3b82f6]/20">{clip.formatLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <a
            href={clip.localUrl}
            download={`${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center transition-all shadow-lg hover:bg-white/40 hover:scale-110 backdrop-blur-md border border-white/10"
            title="Download Clip (Isolate Sound)"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={handleCopy}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-md border border-white/10 ${copied ? 'bg-green-500 text-white' : 'bg-white/20 text-white hover:bg-white/40 hover:scale-110'}`}
            title="Copy Original Link"
          >
            {copied ? <div className="text-[10px] font-bold">✓</div> : <Link className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            className={`shrink-0 w-9 h-9 rounded-full text-white flex items-center justify-center transition-all shadow-lg hover:scale-110 ${actionColor}`}
          >
            <ActionIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const TREND_CATEGORIES = [
  { label: '🔥 Trending Comedy', query: 'trending comedy' },
  { label: '🥊 Combat Sports', query: 'combat sports highlights' },
  { label: '🌆 Urban Culture', query: 'urban culture' },
  { label: '💻 Tech News', query: 'tech news update' },
  { label: '🎤 Street Interviews', query: 'street interview' },
  { label: '🎵 Music Production', query: 'music production studio' },
];

export default function Home() {
  const theaterVideoRef = useRef<HTMLVideoElement>(null);
  const isClosingTheaterRef = useRef(false);
  const [prompt, setPrompt] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [liveFeed, setLiveFeed] = useState<VideoClip[]>([]);
  const [moodboard, setMoodboard] = useState<VideoClip[]>([]);
  const [error, setError] = useState('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [pausedClipIds, setPausedClipIds] = useState<Record<string, boolean>>({});
  const [mediaTimes, setMediaTimes] = useState<Record<string, number>>({});
  const [clipVolumes, setClipVolumes] = useState<Record<string, number>>({});
  const [theaterHandoffComplete, setTheaterHandoffComplete] = useState(false);
  const [isTheaterMutedForHandoff, setIsTheaterMutedForHandoff] = useState(false);
  const [gridHandoffVolume, setGridHandoffVolume] = useState(1);
  const [theaterVolume, setTheaterVolume] = useState(1);
  const [isRetractingTheater, setIsRetractingTheater] = useState(false);
  const [clipLimit, setClipLimit] = useState(2);
  const [region, setRegion] = useState('global');
  const [timeframe, setTimeframe] = useState('any');
  
  // Theater Mode State
  const [expandedClip, setExpandedClip] = useState<VideoClip | null>(null);
  const [isRippling, setIsRippling] = useState(false);

  // WebLLM State
  const [llmEngine, setLlmEngine] = useState<webllm.MLCEngineInterface | null>(null);
  const [llmProgress, setLlmProgress] = useState('');
  const [isLlmInitializing, setIsLlmInitializing] = useState(false);

  const initWebLLM = async () => {
    if (llmEngine || isLlmInitializing) return;
    setIsLlmInitializing(true);
    setError('');
    try {
      const initProgressCallback = (report: webllm.InitProgressReport) => {
        setLlmProgress(report.text);
      };
      const engine = await webllm.CreateMLCEngine('Llama-3-8B-Instruct-q4f32_1-MLC', { initProgressCallback });
      setLlmEngine(engine);
      setLlmProgress('Neural Engine Online.');
    } catch (err: unknown) {
      console.error('WebLLM Init Error:', err);
      setError(`WebLLM Error: ${getErrorMessage(err)}. Ensure your browser supports WebGPU.`);
    } finally {
      setIsLlmInitializing(false);
    }
  };

  const processExtractionQueue = async (urls: string[]) => {
    for (const url of urls) {
      try {
        setLlmProgress(`Extracting video from ${url}...`);
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json() as ExtractApiResponse;
        if (data.success && data.video) {
          const extractedVideo = data.video;
          setLiveFeed(prev => [extractedVideo, ...prev]);
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Failed to extract URL:', url, err);
      }
    }
    setLlmProgress('');
  };

  const executeSearch = async (searchQuery: string) => {
    setIsExtracting(true);
    setError('');
    setLlmProgress(`Scavenging for: "${searchQuery}" in ${region.toUpperCase()} (${timeframe})`);
    
    let finalQuery = searchQuery;
    if (llmEngine && region !== 'global' && region !== 'us' && region !== 'uk') {
      try {
        setLlmProgress('Translating intent to native language...');
        const messages: webllm.ChatCompletionMessageParam[] = [
          { role: 'system', content: `Translate this search query to the native language of the region: ${region}. Only output the translated query string, nothing else.` },
          { role: 'user', content: searchQuery }
        ];
        const reply = await llmEngine.chat.completions.create({ messages });
        finalQuery = reply.choices[0]?.message.content?.trim() || searchQuery;
        setLlmProgress(`Scavenging natively for: "${finalQuery}"`);
      } catch (e) {
        console.error('Translation failed', e);
      }
    } else if (region !== 'global') {
      finalQuery = `${searchQuery} ${region}`;
    }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery, limit: clipLimit, timeframe }), 
      });
      const data = await res.json() as SearchApiResponse;
      
      if (data.success && data.results && data.results.length > 0) {
        const urls = data.results.map((r) => r.url);
        await processExtractionQueue(urls);
      } else {
        setError(data.error || 'No 9:16 reels-ready moments found for that query.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsExtracting(false);
      setLlmProgress('');
    }
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;

    setIsExtracting(true);
    setError('');

    if (prompt.startsWith('http')) {
      await processExtractionQueue([prompt]);
      setPrompt('');
      setIsExtracting(false);
      return;
    }

    if (!llmEngine) {
      await executeSearch(prompt);
      setPrompt('');
      return;
    }

    try {
      setLlmProgress('Analyzing intent...');
      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: 'system', content: 'You are an AI search query generator. Extract the core search intent and reply ONLY with the search query string, nothing else.' },
        { role: 'user', content: prompt }
      ];
      
      const reply = await llmEngine.chat.completions.create({ messages });
      
      const searchQuery = reply.choices[0]?.message.content?.trim() || prompt;
      await executeSearch(searchQuery);
      setPrompt('');
    } catch (err: unknown) {
      setError(`LLM Processing Error: ${getErrorMessage(err)}`);
      setIsExtracting(false);
      setLlmProgress('');
    }
  };

  const saveToMoodboard = (clip: VideoClip) => {
    if (!moodboard.find(c => c.id === clip.id)) {
      setMoodboard(prev => [...prev, clip]);
    }
  };

  const removeFromMoodboard = (id: string) => {
    setMoodboard(prev => prev.filter(c => c.id !== id));
  };

  const rememberMediaTime = (clipId: string, time: number) => {
    if (!Number.isFinite(time)) return;
    setMediaTimes(prev => ({ ...prev, [clipId]: time }));
  };

  const getClipVolume = useCallback((clipId: string) => clipVolumes[clipId] ?? 1, [clipVolumes]);

  const changeClipVolume = (clipId: string, volume: number) => {
    setClipVolumes(prev => ({ ...prev, [clipId]: Math.max(0, Math.min(1, volume)) }));
  };

  useEffect(() => {
    if (!expandedClip || !theaterVideoRef.current) return;
    theaterVideoRef.current.volume = Math.max(0, Math.min(1, theaterVolume * getClipVolume(expandedClip.id)));
  }, [expandedClip, theaterVolume, getClipVolume]);

  const completeTheaterHandoff = (video: HTMLVideoElement) => {
    if (theaterHandoffComplete) return;

    const startedAt = performance.now();

    const fade = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / MEDIA_HANDOFF_DURATION_MS);
      setTheaterVolume(progress);
      setGridHandoffVolume(1 - progress);
      if (expandedClip) {
        video.volume = progress * getClipVolume(expandedClip.id);
      }

      if (progress < 1) {
        requestAnimationFrame(fade);
        return;
      }

      setTheaterHandoffComplete(true);
      setGridHandoffVolume(1);
    };

    requestAnimationFrame(fade);
  };

  const completeGridReturnHandoff = (clipId: string, theaterVideo: HTMLVideoElement | null) => {
    const startedAt = performance.now();

    const fade = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / MEDIA_HANDOFF_DURATION_MS);
      setGridHandoffVolume(progress);
      setTheaterVolume(1 - progress);
      if (theaterVideo) {
        theaterVideo.volume = (1 - progress) * getClipVolume(clipId);
      }

      if (progress < 1) {
        requestAnimationFrame(fade);
        return;
      }

      setExpandedClip(null);
      setIsRetractingTheater(false);
      setTheaterHandoffComplete(false);
      setIsTheaterMutedForHandoff(false);
      setGridHandoffVolume(1);
      setTheaterVolume(1);
      setIsRippling(true);
      setTimeout(() => {
        isClosingTheaterRef.current = false;
        setIsRippling(false);
      }, 800);
    };

    requestAnimationFrame(fade);
  };

  const toggleAudio = (clipId: string) => {
    if (activeAudioId === clipId) {
      setActiveAudioId(null);
    } else {
      setActiveAudioId(clipId);
      setPausedClipIds(prev => ({ ...prev, [clipId]: false }));
    }
  };

  const expandClip = (clip: VideoClip) => {
    if (isRetractingTheater) return;
    const needsAudioHandoff = activeAudioId === clip.id;
    setTheaterHandoffComplete(!needsAudioHandoff);
    setIsTheaterMutedForHandoff(false);
    setGridHandoffVolume(1);
    setTheaterVolume(needsAudioHandoff ? 0 : 1);
    setActiveAudioId(clip.id);
    setPausedClipIds(prev => ({ ...prev, [clip.id]: false }));
    setExpandedClip(clip);
  };

  const closeExpandedView = () => {
    if (!expandedClip || isRetractingTheater) return;
    isClosingTheaterRef.current = true;
    const closingClip = expandedClip;
    const theaterVideo = theaterVideoRef.current;
    const shouldReturnAudio = activeAudioId === closingClip.id && !pausedClipIds[closingClip.id];

    if (theaterVideo) {
      rememberMediaTime(closingClip.id, theaterVideo.currentTime);
    }

    if (shouldReturnAudio) {
      setIsRetractingTheater(true);
      setTheaterHandoffComplete(false);
      setGridHandoffVolume(0);
      setTheaterVolume(1);
      setActiveAudioId(closingClip.id);
      setPausedClipIds(prev => ({ ...prev, [closingClip.id]: false }));
      completeGridReturnHandoff(closingClip.id, theaterVideo);
      return;
    }

    setActiveAudioId(null);
    setExpandedClip(null);
    setTheaterHandoffComplete(false);
    setIsTheaterMutedForHandoff(false);
    setGridHandoffVolume(1);
    setTheaterVolume(1);
    setIsRippling(true);
    setTimeout(() => {
      isClosingTheaterRef.current = false;
      setIsRippling(false);
    }, 800);
  };

  return (
    <>
      <motion.div 
        animate={isRippling ? { filter: "blur(10px) brightness(1.2)", scale: 0.96 } : { filter: "blur(0px) brightness(1)", scale: 1 }}
        transition={{ duration: 0.7, type: "spring", bounce: 0.4 }}
        className="min-h-screen p-8 max-w-[1400px] mx-auto flex flex-col gap-10"
      >
        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-[var(--color-card-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              V
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">The Viral Oracle</h1>
              <p className="text-sm text-gray-400">Autonomous Curation Engine</p>
            </div>
          </div>
          
          {/* Header Controls */}
          <div className="flex items-center gap-4">
            {/* Region Selector */}
            <div className="flex items-center gap-2 bg-[#09090b] border border-[var(--color-card-border)] rounded-full px-3 py-1.5 shadow-lg transition-colors hover:border-[#3b82f6]">
              <Globe className="w-3.5 h-3.5 text-[#3b82f6]" />
              <select 
                value={region} 
                onChange={e => setRegion(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
              >
                <option value="global">Global</option>
                <option value="us">North America</option>
                <option value="uk">Europe (UK)</option>
                <option value="japan">Asia (Japan)</option>
                <option value="brazil">South America (Brazil)</option>
              </select>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-2 bg-[#09090b] border border-[var(--color-card-border)] rounded-full px-3 py-1.5 shadow-lg transition-colors hover:border-[#3b82f6]">
              <Clock className="w-3.5 h-3.5 text-[#3b82f6]" />
              <select 
                value={timeframe} 
                onChange={e => setTimeframe(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
              >
                <option value="any">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-3 bg-black border border-[var(--color-card-border)] rounded-full px-4 py-2">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1"><Settings2 className="w-3 h-3"/> Pull Amount:</span>
              <div className="flex gap-1">
                {[1, 2, 4, 6].map(num => (
                  <button 
                    key={num}
                    onClick={() => setClipLimit(num)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${clipLimit === num ? 'bg-[#3b82f6] text-white shadow-[0_0_8px_rgba(59,130,246,0.5)] scale-110' : 'bg-transparent text-gray-500 hover:text-white hover:bg-white/10'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={initWebLLM}
              disabled={!!llmEngine || isLlmInitializing}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full border ${llmEngine ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
            >
              <BrainCircuit className="w-4 h-4" />
              {llmEngine ? 'Neural Engine Active' : isLlmInitializing ? 'Initializing...' : 'Initialize WebLLM'}
            </button>
          </div>
        </header>

        {/* Trend Dashboard & Command Center */}
        <section className="flex flex-col gap-4">
          {/* Trend Categories */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium pr-4 border-r border-[var(--color-card-border)]">
              <Activity className="w-4 h-4" />
              Live Trends
            </div>
            {TREND_CATEGORIES.map(category => (
              <button
                key={category.label}
                onClick={() => executeSearch(category.query)}
                disabled={isExtracting}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-full bg-[#09090b] border border-[var(--color-card-border)] text-sm font-medium text-white hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors disabled:opacity-50 hover:bg-[#3b82f6]/5"
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Command Input */}
          <form onSubmit={handleCommand} className="relative group mt-2">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Command className="h-5 w-5 text-[#3b82f6]" />
            </div>
            <input
              type="text"
              className="w-full bg-[#09090b] border border-[var(--color-card-border)] text-white rounded-2xl py-5 pl-14 pr-36 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all placeholder-gray-500 text-lg shadow-2xl"
              placeholder={`Paste URL or type search intent (will extract ${clipLimit} clips)...`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button
              type="submit"
              disabled={isExtracting}
              className="absolute right-3 top-3 bottom-3 bg-white text-black px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isExtracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Execute'
              )}
            </button>
          </form>
          
          {/* Status / Error Messaging */}
          {(llmProgress || error) && (
            <div className="flex items-center gap-2 px-2 mt-1">
              {llmProgress && <p className="text-[#3b82f6] text-xs font-medium animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {llmProgress}</p>}
              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-4">
          {/* Live Feed */}
          <section className="flex flex-col">
            <h2 className="text-lg font-bold mb-6 flex items-center justify-between text-white border-b border-[var(--color-card-border)] pb-3">
              <span>Live Extraction Feed</span>
              <span className="text-xs bg-[#3b82f6]/20 text-[#3b82f6] px-3 py-1 rounded-full">{liveFeed.length} Items</span>
            </h2>
            {liveFeed.length === 0 && (
              <div className="text-gray-500 text-center py-12 border border-dashed border-[var(--color-card-border)] rounded-2xl">
                Awaiting extraction commands...
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <AnimatePresence>
                {liveFeed.map(clip => (
                  <VideoCard 
                    key={clip.id} 
                    clip={clip} 
                    isMuted={(!!expandedClip && (expandedClip.id !== clip.id || theaterHandoffComplete)) || activeAudioId !== clip.id}
                    syncTime={mediaTimes[clip.id]}
                    volume={expandedClip?.id === clip.id ? gridHandoffVolume : 1}
                    clipVolume={getClipVolume(clip.id)}
                    shouldPlay={!pausedClipIds[clip.id]}
                    isSuppressed={!!expandedClip && (expandedClip.id !== clip.id || theaterHandoffComplete)}
                    onToggleMute={() => toggleAudio(clip.id)}
                    onVolumeChange={(volume) => changeClipVolume(clip.id, volume)}
                    onPlaybackTimeChange={(time) => rememberMediaTime(clip.id, time)}
                    onExpand={() => expandClip(clip)}
                    onAction={() => saveToMoodboard(clip)} 
                    actionIcon={Plus}
                    actionColor="bg-[#3b82f6] hover:bg-blue-500"
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Moodboard */}
          <section className="flex flex-col">
            <h2 className="text-lg font-bold mb-6 flex items-center justify-between text-white border-b border-[var(--color-card-border)] pb-3">
              <span>The Moodboard</span>
              <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full">{moodboard.length} Pinned</span>
            </h2>
            {moodboard.length === 0 && (
              <div className="text-gray-500 text-center py-12 border border-dashed border-[var(--color-card-border)] rounded-2xl">
                Pin clips from the live feed to start planning.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <AnimatePresence>
                {moodboard.map(clip => (
                  <VideoCard 
                    key={`mood-${clip.id}`} 
                    clip={clip} 
                    isMuted={(!!expandedClip && (expandedClip.id !== clip.id || theaterHandoffComplete)) || activeAudioId !== clip.id}
                    syncTime={mediaTimes[clip.id]}
                    volume={expandedClip?.id === clip.id ? gridHandoffVolume : 1}
                    clipVolume={getClipVolume(clip.id)}
                    shouldPlay={!pausedClipIds[clip.id]}
                    isSuppressed={!!expandedClip && (expandedClip.id !== clip.id || theaterHandoffComplete)}
                    onToggleMute={() => toggleAudio(clip.id)}
                    onVolumeChange={(volume) => changeClipVolume(clip.id, volume)}
                    onPlaybackTimeChange={(time) => rememberMediaTime(clip.id, time)}
                    onExpand={() => expandClip(clip)}
                    onAction={() => removeFromMoodboard(clip.id)} 
                    actionIcon={Trash2}
                    actionColor="bg-red-500/80 hover:bg-red-500"
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </motion.div>

      {/* Theater Mode (Expanded View) */}
      <AnimatePresence>
        {expandedClip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Cinematic Backdrop with Blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }} 
              className="absolute inset-0 bg-black/80 backdrop-blur-2xl cursor-pointer"
              onClick={closeExpandedView}
            />
            {/* The Expanded Video */}
            <motion.div
              layoutId={`card-${expandedClip.id}`}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="relative z-10 w-[90vw] max-w-[500px] aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              <video 
                ref={theaterVideoRef}
                src={expandedClip.localUrl} 
                autoPlay 
                muted={isTheaterMutedForHandoff || activeAudioId !== expandedClip.id}
                loop
                preload="auto"
                playsInline
                onEnded={(e) => {
                  e.currentTarget.currentTime = 0;
                  void e.currentTarget.play();
                }}
                onLoadedMetadata={(e) => {
                  e.currentTarget.volume = theaterVolume * getClipVolume(expandedClip.id);
                  const savedTime = mediaTimes[expandedClip.id];
                  if (savedTime !== undefined && Number.isFinite(savedTime) && savedTime < e.currentTarget.duration) {
                    e.currentTarget.currentTime = savedTime;
                  }
                }}
                onPlay={() => {
                  setActiveAudioId(expandedClip.id);
                  setPausedClipIds(prev => ({ ...prev, [expandedClip.id]: false }));
                }}
                onPlaying={(e) => {
                  e.currentTarget.volume = theaterVolume;
                  completeTheaterHandoff(e.currentTarget);
                  setIsTheaterMutedForHandoff(false);
                }}
                onPause={(e) => {
                  rememberMediaTime(expandedClip.id, e.currentTarget.currentTime);
                  if (isClosingTheaterRef.current) return;
                  setActiveAudioId(null);
                  setPausedClipIds(prev => ({ ...prev, [expandedClip.id]: true }));
                }}
                onTimeUpdate={(e) => rememberMediaTime(expandedClip.id, e.currentTarget.currentTime)}
                onClick={(e) => {
                  if (e.currentTarget.paused) {
                    void e.currentTarget.play();
                  } else {
                    e.currentTarget.pause();
                  }
                }}
                className="w-full h-full object-cover cursor-pointer" 
              />
              <button 
                onClick={closeExpandedView}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 hover:scale-110 hover:rotate-90 backdrop-blur-md transition-all duration-300 z-20"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 right-4 z-20 flex items-center justify-center group/volume">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#3b82f6] hover:scale-110 hover:-translate-y-1 hover:shadow-[0_0_22px_rgba(59,130,246,0.55)] backdrop-blur-md transition-all duration-300"
                  title="Volume"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <div className="absolute bottom-12 right-0 w-10 h-28 rounded-full bg-black/70 border border-white/10 backdrop-blur-md shadow-xl opacity-0 pointer-events-none group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto transition-opacity flex items-center justify-center">
                  <input
                    aria-label="Volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={getClipVolume(expandedClip.id)}
                    onChange={(e) => changeClipVolume(expandedClip.id, Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="[writing-mode:vertical-lr] [direction:rtl] h-20 w-4 accent-[#3b82f6] cursor-pointer"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
