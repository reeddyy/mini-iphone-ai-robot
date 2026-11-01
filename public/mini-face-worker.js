// Dedicated local ML worker. No network API, session grants, DOM or identity storage.
'use strict';
const assets='/vendor/mediapipe/face-mesh-0.4.1633559619-mini1/';
let model=null,stopped=false,inputCanvas=null,inputContext=null;
self.onmessage=async({data})=>{
  if(data.type==='start'){
    try{
      self.createMediapipeSolutionsPackedAssets={locateFile:file=>assets+file};
      importScripts(assets+'face_mesh.js');
      model=new self.FaceMesh({locateFile:file=>assets+file});
      model.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:.6,minTrackingConfidence:.6});
      model.onResults(result=>{if(!stopped)self.postMessage({type:'landmarks',points:result.multiFaceLandmarks?.[0] || null});});
      await model.initialize();if(!stopped)self.postMessage({type:'ready'});
    }catch{self.postMessage({type:'error'});}
  }else if(data.type==='frame'){
    try{if(model && !stopped){
      const ratio=Math.min(1,320/data.bitmap.width,240/data.bitmap.height),width=Math.max(1,Math.round(data.bitmap.width*ratio)),height=Math.max(1,Math.round(data.bitmap.height*ratio));
      inputCanvas ||= new OffscreenCanvas(width,height);inputContext ||= inputCanvas.getContext('2d',{alpha:false});
      if(inputContext){if(inputCanvas.width!==width || inputCanvas.height!==height){inputCanvas.width=width;inputCanvas.height=height;}inputContext.drawImage(data.bitmap,0,0,width,height);}
      await model.send({image:inputContext?inputCanvas:data.bitmap});
    }}
    catch{self.postMessage({type:'error'});}
    finally{data.bitmap?.close();if(!stopped)self.postMessage({type:'done'});}
  }
};
