// Preview capture stays smooth; only the outbound sender is rate-limited.
(function () {
  'use strict';
  function frameSize(width,height,quality='balanced'){
    const w=Number.isFinite(width) && width>0?width:640,h=Number.isFinite(height) && height>0?height:480;
    const ratio=Math.min(1,(quality==='detail'?960:640)/Math.max(w,h));
    return {width:Math.max(1,Math.round(w*ratio)),height:Math.max(1,Math.round(h*ratio))};
  }
  async function configureSender(sender,{fps=2,quality='balanced'}={}){
    if(!sender?.getParameters || !sender?.setParameters)return false;
    try{
      const parameters=sender.getParameters();if(!parameters.encodings?.length)return false;
      for(const encoding of parameters.encodings){encoding.maxFramerate=fps===1?1:2;encoding.maxBitrate=quality==='detail'?1500000:800000;}
      parameters.degradationPreference='maintain-resolution';
      try{await sender.setParameters(parameters);}catch{delete parameters.degradationPreference;await sender.setParameters(parameters);}
      return true;
    }catch{return false;}
  }
  async function senderStats(sender,pc){
    const report=sender?.getStats?await sender.getStats():pc?.getStats?await pc.getStats():null;
    if(!report)return null;
    const rows=[...report.values()].filter(row=>row.type==='outbound-rtp' && (row.kind || row.mediaType)==='video');
    if(!rows.length)return {frames:0,bytes:0,width:0,height:0};
    const main=rows.find(row=>row.frameWidth>0) || rows[0];
    return {frames:rows.reduce((n,row)=>n+(row.framesSent ?? row.framesEncoded ?? 0),0),bytes:rows.reduce((n,row)=>n+(row.bytesSent || 0),0),width:main.frameWidth || 0,height:main.frameHeight || 0};
  }
  window.MiniCamera=Object.freeze({frameSize,configureSender,senderStats});
})();
