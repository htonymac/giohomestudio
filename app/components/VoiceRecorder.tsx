"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSec: number) => void;
}

type RecordingState = "idle" | "recording" | "stopped";

export default function VoiceRecorder({ onRecordingComplete }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Waveform canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopWaveform = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgba(11, 11, 13, 0.9)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#a78bfa";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);

      // Set up AudioContext for waveform
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = (Date.now() - startTimeRef.current) / 1000;
        onRecordingComplete(blob, duration);
        // Clean up stream
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
        stopWaveform();
      };

      recorder.start(250); // collect chunks every 250ms
      startTimeRef.current = Date.now();
      setState("recording");
      setElapsedSec(0);

      // Timer
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      // Waveform
      drawWaveform();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      setHasPermission(false);
    }
  }, [onRecordingComplete, drawWaveform, stopWaveform]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setState("stopped");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopWaveform();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [stopWaveform]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={80}
        style={{
          width: "100%",
          maxWidth: 480,
          height: 80,
          borderRadius: 8,
          background: "rgba(11,11,13,0.9)",
          border: state === "recording" ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.06)",
          display: "block",
        }}
      />

      {/* Timer */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 28,
        fontWeight: 700,
        color: state === "recording" ? "#a78bfa" : "#55555a",
        letterSpacing: "0.05em",
      }}>
        {formatTime(elapsedSec)}
      </div>

      {/* Microphone button */}
      <button
        onClick={state === "recording" ? stopRecording : startRecording}
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: state === "recording"
            ? "linear-gradient(135deg, #ff7a45, #d17bff)"
            : "linear-gradient(135deg, #a78bfa, #7cc4ff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: state === "recording"
            ? "0 0 0 6px rgba(255,122,69,0.18), 0 8px 24px -6px rgba(255,122,69,0.4)"
            : "0 0 0 4px rgba(167,139,250,0.12), 0 8px 24px -6px rgba(167,139,250,0.3)",
          transition: "all 0.2s ease",
          animation: state === "recording" ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
        title={state === "recording" ? "Stop recording" : "Start recording"}
      >
        {state === "recording" ? (
          // Stop square
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Microphone
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Status label */}
      <p style={{ fontSize: 13, color: "#7b7b80", margin: 0 }}>
        {state === "idle" && "Click to start recording"}
        {state === "recording" && "Recording… click to stop"}
        {state === "stopped" && "Recording complete"}
      </p>

      {/* Permission error */}
      {error && (
        <p style={{ fontSize: 12, color: "#ff7a45", margin: 0, textAlign: "center", maxWidth: 320 }}>
          {error}
        </p>
      )}

      {hasPermission === false && (
        <p style={{ fontSize: 11, color: "#55555a", margin: 0, textAlign: "center", maxWidth: 320 }}>
          Enable microphone access in your browser settings, or use the file upload option below.
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(255,122,69,0.18), 0 8px 24px -6px rgba(255,122,69,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(255,122,69,0.08), 0 8px 28px -4px rgba(255,122,69,0.5); }
        }
      `}</style>
    </div>
  );
}
