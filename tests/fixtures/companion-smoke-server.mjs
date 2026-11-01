// Local test doubles only. Run separately; never uses Alibaba credentials.
import {createApp} from '../../server.mjs';
const SDP='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
let imageCalls=0,imageSuccess=false;const plans=[];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const rabbit={version:1,action:'artwork',title:'Luna at the blue castle',message:'Luna the rabbit reaches a blue castle.',prompt:'Luna the rabbit at a blue castle.',motion:'float',choices:[{id:'door',label:'Open the blue door'},{id:'garden',label:'Visit the garden'}]};
const hands={version:1,action:'activity',title:'Scissors, paper, stone',message:'Choose Stone, Paper or Scissors.',activity:{type:'hand_game',rounds:3,moves:[{id:'rock',label:'Stone',symbol:'✊',beats:['scissors']},{id:'paper',label:'Paper',symbol:'✋',beats:['rock']},{id:'scissors',label:'Scissors',symbol:'✌️',beats:['paper']}]}};
const app=createApp({apiKey:'sk-fixture-only',workspaceId:'ws-fixture',accessCode:'coherent-parent-fixture',imageModel:'qwen-image-3.0',fetchFn:async(url,init)=>{
 if(String(url).includes('/api/v1/models?'))return json({output:{models:[{model:'qwen-image-3.0'},{model:'qwen-plus'}],total:2}});
 if(String(url).includes('/webrtc/'))return new Response(SDP);
 if(String(url).includes('/chat/completions')){
  const user=JSON.parse(JSON.parse(init.body).messages[1].content);plans.push(user);
  let plan=user.imagesAllowed?rabbit:{version:1,action:'keep',message:'Pictures are unavailable.'};
  if(['Hello Mini','请用中文回答'].includes(user.request))plan={version:1,action:'keep'};
  if(user.request.startsWith('Button interaction:'))plan={...rabbit,title:'Luna opens the blue door',message:'Luna opens the blue door and finds a tiny garden.'};
  if(user.request==='Paint Luna')plan=user.imagesAllowed?{version:1,action:'artwork',title:'Luna painting',message:'Luna the rabbit is beside the blue castle.',prompt:'A rabbit beside a blue castle.',motion:'float'}:{version:1,action:'keep',message:'Pictures are unavailable.'};
  if(user.request==='Play scissors paper stone')plan=hands;
  if(user.request==='stone')plan={version:1,action:'interact',choiceId:'rock'};
  if(user.request==='Play tic tac toe')plan={version:1,action:'activity',activity:{type:'tictactoe'}};
  return json({choices:[{message:{content:JSON.stringify(plan)}}]});
 }
 if(String(url).includes('.oss-')){if(init.headers)throw Error('Storage must not receive API credentials');return new Response(PNG,{headers:{'Content-Type':'image/png'}});}
 imageCalls++;
 if(String(url)!=='https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' || init.headers['X-DashScope-WorkSpace']!=='ws-fixture')throw Error('Wrong native image route');
 return imageSuccess?json({output:{choices:[{message:{content:[{image:'https://fixture.oss-ap-southeast-1.aliyuncs.com/picture.png'}]}}]}}):new Response(JSON.stringify({code:'InvalidParameter',message:'Model unavailable in fixture.'}),{status:404});
}});
const origin=app.listeners('request')[0];app.removeAllListeners('request');app.on('request',(req,res)=>{
 if(req.url==='/__fixture/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({imageCalls,plans}));return;}
 if(req.url==='/__fixture/reset'){imageCalls=0;imageSuccess=false;plans.length=0;res.end('ok');return;}
 if(req.url==='/__fixture/image-success'){imageSuccess=true;res.end('ok');return;}
 origin(req,res);
});
app.listen(3109,'127.0.0.1',()=>console.log('Coherent visual fixture ready.'));
