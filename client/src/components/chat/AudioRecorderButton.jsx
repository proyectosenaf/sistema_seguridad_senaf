import React from "react";

export default function AudioRecorderButton({ onAudioRecorded }) {
  const [recording, setRecording] = React.useState(false);
  const recorderRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const chunksRef = React.useRef([]);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop?.();
      } catch {}
      stopTracks();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) onAudioRecorded?.(blob);
        chunksRef.current = [];
        stopTracks();
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("[chat] audio record", err);
      window.alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop?.();
    } catch {}
    setRecording(false);
  };

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      className="chat-header__close"
      title={recording ? "Detener audio" : "Grabar audio"}
      aria-label={recording ? "Detener audio" : "Grabar audio"}
    >
      {recording ? "⏹️" : "🎤"}
    </button>
  );
}
