import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

interface VoicePlayerProps {
  voiceData: string;
  duration?: number | null;
  color?: string;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ voiceData, duration, color = "#e67e22" }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const updateProgress = () => {
    const audio = audioRef.current;
    if (audio) {
      const current = audio.currentTime;
      const dur = audio.duration || duration || 0;
      setCurrentTime(current);
      if (dur > 0) {
        setProgress((current / dur) * 100);
      }
      if (isPlayingRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  };

  useEffect(() => {
    const audio = new Audio(voiceData);
    audioRef.current = audio;

    const handlePlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    const handlePause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentTime(0);
      setProgress(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    const handleTimeUpdate = () => {
      const current = audio.currentTime;
      const dur = audio.duration || duration || 0;
      setCurrentTime(current);
      if (dur > 0) {
        setProgress((current / dur) * 100);
      }
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [voiceData, duration]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      // Pause any other playing audio in the document if there are any
      const audios = document.querySelectorAll("audio");
      audios.forEach((aud) => {
        if (aud !== audioRef.current) {
          aud.pause();
        }
      });
      audioRef.current.play().catch((err) => console.error("Audio play failed:", err));
    } else {
      audioRef.current.pause();
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const value = parseFloat(e.target.value);
    const dur = audioRef.current.duration || duration || 0;
    const newTime = (value / 100) * dur;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayDuration = duration || (audioRef.current ? audioRef.current.duration : 0) || 0;

  return (
    <div id="voice-player-root" className="flex items-center gap-2.5 bg-slate-950/80 rounded-2xl p-2.5 px-3 border border-white/5 max-w-[240px] select-none shadow-md mt-1.5 relative overflow-hidden">
      {/* Decorative pulse background when playing */}
      {isPlaying && (
        <div className="absolute inset-0 bg-amber-500/5 animate-pulse pointer-events-none" />
      )}

      <button
        type="button"
        onClick={togglePlayPause}
        style={{ color: color }}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-all shrink-0 cursor-pointer relative z-10"
        title={isPlaying ? "Пауза" : "Воспроизвести"}
      >
        {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
      </button>

      <div className="flex flex-col gap-1 w-full min-w-0 relative z-10">
        <div className="flex items-center gap-1.5 w-full">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSliderChange}
            className="w-full accent-amber-500 bg-slate-800 h-1 rounded-lg cursor-pointer outline-none"
            style={{
              background: `linear-gradient(to right, ${color} 0%, ${color} ${progress}%, #1e293b ${progress}%, #1e293b 100%)`
            }}
          />
        </div>
        <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono leading-none">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1.5">
            {/* Tiny Equalizer Waves */}
            {isPlaying && (
              <div className="flex items-end gap-[1.5px] h-2 px-1 shrink-0">
                <span className="w-[1.5px] bg-amber-500 rounded-full animate-soundwave" style={{ animationDelay: "0.1s" }} />
                <span className="w-[1.5px] bg-amber-500 rounded-full animate-soundwave" style={{ animationDelay: "0.3s" }} />
                <span className="w-[1.5px] bg-amber-500 rounded-full animate-soundwave" style={{ animationDelay: "0.0s" }} />
                <span className="w-[1.5px] bg-amber-500 rounded-full animate-soundwave" style={{ animationDelay: "0.2s" }} />
              </div>
            )}
            <div className="flex items-center gap-0.5">
              <Volume2 size={10} className="text-gray-600" />
              <span>{formatTime(displayDuration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
