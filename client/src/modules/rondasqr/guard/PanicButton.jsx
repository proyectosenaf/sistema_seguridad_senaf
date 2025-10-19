// guard/PanicButton.jsx
import React from "react";
import { rondasqrApi } from "../api/rondasqrApi";
export default function PanicButton(){
  async function sendPanic(){
    const gps = await new Promise(res => navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lon:p.coords.longitude }), ()=>res(null)));
    await rondasqrApi.panic({ gps });
    alert("Alerta de pánico enviada");
  }
  return <button onClick={sendPanic} className="bg-red-600 text-white px-6 py-4 rounded-2xl w-full">ALERTA</button>;
}
