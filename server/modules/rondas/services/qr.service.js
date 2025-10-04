import QRCode from "qrcode";
export async function makeQR(payload,{type="png"}={}){
  if(type==="svg") return QRCode.toString(payload,{ type:"svg", margin:1 });
  return QRCode.toBuffer(payload,{ margin:1 }); // PNG
}
