// Dedicated local ML worker. No network API, session grants, DOM or identity storage.
'use strict';
const assets='/vendor/mediapipe/face-mesh-0.4.1633559619-mini1/';
let model=null,stopped=false;
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
    try{if(model && !stopped)await model.send({image:data.bitmap});}
    catch{self.postMessage({type:'error'});}
    finally{data.bitmap?.close();if(!stopped)self.postMessage({type:'done'});}
  }
};
