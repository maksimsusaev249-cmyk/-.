import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2, Send, X, ArrowUp } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (base64Data: string, duration: number) => void;
  onCancel?: () => void;
  stream: MediaStream;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onCancel, stream }) => {
  const [isRecording, setIsRecording] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasTimeLimit, setHasTimeLimit] = useState(true);
  const TIME_LIMIT = 60;
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const shouldSendRef = useRef<boolean>(false);
  const onSendRef = useRef(onSend);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onSendRef.current = onSend;
    onCancelRef.current = onCancel;
  }, [onSend, onCancel]);

  const startRecording = useCallback(() => {
    try {
      console.log("Starting voice recording...");
      console.log("Stream tracks:", stream.getTracks().map(t => t.label));
      audioChunksRef.current = [];
      setRecordingTime(0);
      startTimeRef.current = Date.now();
      shouldSendRef.current = false;

      // Detect supported mimeType
      let options: MediaRecorderOptions = {};
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/aac",
        "audio/wav"
      ];
      
      for (const mimeType of mimeTypes) {
        try {
          if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mimeType)) {
            options = { mimeType };
            console.log("Selected supported voice recording mimeType:", mimeType);
            break;
          }
        } catch (e) {
          // ignore issues checking support
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log("Data available:", event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, audio chunks:", audioChunksRef.current.length);
        const mimeTypeUsed = mediaRecorder.mimeType || options.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
        console.log("Audio blob size:", audioBlob.size, "MimeType:", mimeTypeUsed);
        const exactDurationSeconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          console.log("Base64 data length:", base64data.length);
          if (shouldSendRef.current) {
            onSendRef.current(base64data, exactDurationSeconds);
          }
        };

        // Stop all tracks to turn off mic indicator
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };

      // Handle timeslice start error fallback
      try {
        if (mediaRecorder.state === "inactive") {
          mediaRecorder.start(1000);
        }
      } catch (startErr) {
        console.warn("Failed to start MediaRecorder with timeslice, trying without timeslice:", startErr);
        try {
          if (mediaRecorder.state === "inactive") {
            mediaRecorder.start();
          }
        } catch (fallbackErr) {
          console.error("Critical: Failed to start MediaRecorder even without timeslice:", fallbackErr);
          if (mediaRecorder.state !== "recording") {
            throw fallbackErr;
          }
        }
      }

      setIsRecording(true);
      console.log("MediaRecorder started successfully");

      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      if (onCancelRef.current) onCancelRef.current();
    }
  }, [stream]); // Intentionally omitting onSend and onCancel to prevent re-renders

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [stream]); // Only re-run if stream changes


  const cancelRecording = () => {
    shouldSendRef.current = false;
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (onCancelRef.current) onCancelRef.current();
  };

  const sendRecording = () => {
    // If user clicks send immediately, it could be very short, but that's fine.
    // However, if it's less than 300ms, it might be an accidental click.
    const elapsedMs = Date.now() - startTimeRef.current;
    if (elapsedMs < 300) {
      cancelRecording();
      return;
    }
    shouldSendRef.current = true;
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (hasTimeLimit && recordingTime >= TIME_LIMIT) {
      sendRecording();
    }
  }, [recordingTime, hasTimeLimit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString()}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="voice-recorder-root" className="flex items-center justify-between gap-1.5 bg-slate-900 border border-amber-500/30 rounded-xl p-1 h-10 shadow-inner">
      <button
        type="button"
        onClick={cancelRecording}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex-shrink-0"
        title="Отменить"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex items-center gap-2 flex-1 justify-center relative">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-mono text-white font-bold tracking-wider">{formatTime(recordingTime)}</span>
        
        {/* Toggle Tumbler */}
        <button
          type="button"
          onClick={() => setHasTimeLimit(!hasTimeLimit)}
          className={`absolute right-0 flex items-center justify-center px-1.5 h-6 rounded-md text-[9px] font-bold uppercase transition-colors cursor-pointer border ${
            hasTimeLimit 
              ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
              : "bg-slate-800 text-gray-500 border-white/5"
          }`}
          title={hasTimeLimit ? "Лимит включен" : "Без лимита"}
        >
          {hasTimeLimit ? `ЛИМИТ ${TIME_LIMIT}С` : "БЕЗ ЛИМИТА"}
        </button>
      </div>

      <button
        type="button"
        onClick={sendRecording}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer flex-shrink-0"
        title="Отправить"
      >
        <ArrowUp size={16} className="stroke-[3px]" />
      </button>
    </div>
  );
};
