import React, { useEffect, useRef, useState } from "react";
export default function RondasQRScanner({ onRead }){
  const videoRef = useRef(null);
  const [error,setError]=useState(null);

  useEffect(()=>{
    let stream;
    (async()=>{
      try{
        stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
        if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play(); }
      }catch(e){ setError(e.message); }
    })();
    return ()=>{ stream && stream.getTracks().forEach(t=>t.stop()); };
  },[]);

  return (
    <div className="space-y-2">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <video ref={videoRef} className="w-full rounded-xl border border-neutral-800" />
      <button className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 hover:border-neutral-500"
        onClick={()=>onRead?.(prompt("Payload del QR (dev)")||"")}>
        Probar QR manual
      </button>
    </div>
  );
}
