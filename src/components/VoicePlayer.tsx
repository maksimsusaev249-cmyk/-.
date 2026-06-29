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
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Create HTMLAudioElement
    const audio = new Audio(voiceData);
    audioRef.current = audio;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [voiceData]);

  const updateProgress = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration || duration || 0;
      setCurrentTime(current);
      if (dur > 0) {
        setProgress((current / dur) * 100);
      }
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      // Pause any other playing audio in the document if there are any
      const audios = document.querySelectorAll("audio");
      audios.forEach((aud) => {
        if (aud !== audioRef.current) {
          aud.pause();
        }
      });
      // Find all elements playing and reset them
      // We trigger play
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        })
        .catch((err) => console.error("Audio play failed:", err));
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
    <div id="voice-player-root" className="flex items-center gap-2.5 bg-slate-950/80 rounded-2xl p-2.5 px-3 border border-white/5 max-w-[240px] select-none shadow-md mt-1.5">
      <button
        type="button"
        onClick={togglePlayPause}
        style={{ color: color }}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-all shrink-0 cursor-pointer"
        title={isPlaying ? "Пауза" : "Воспроизвести"}
      >
        {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
      </button>

      <div className="flex flex-col gap-1 w-full min-w-0">
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
          <div className="flex items-center gap-0.5">
            <Volume2 size={10} className="text-gray-600" />
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
