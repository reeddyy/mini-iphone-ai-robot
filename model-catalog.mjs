import {readLimited} from './visual-provider.mjs';

// Model metadata only: this never generates an image or changes configuration.
// A listed ID is not proof of regional generation entitlement or billing access.
export async function readImageModels({fetchFn,base,apiKey,workspaceId,configuredModel='',signal}) {
  const models=new Set();let complete=false;
  for(let page=1;page<=3;page++) {
    const response=await fetchFn(base+'/api/v1/models?page_no='+page+'&page_size=100',{
      method:'GET',headers:{Authorization:'Bearer '+apiKey,'X-DashScope-WorkSpace':workspaceId},signal,
    });
    if(!response.ok)return {ok:false,httpStatus:response.status,error:'Model metadata is unavailable for this workspace. Check the Singapore catalog while signed into your own Alibaba account; copy an enabled image model ID into ALIBABA_IMAGE_MODEL.'};
    const body=JSON.parse((await readLimited(response,300000)).toString('utf8'));
    const output=body.output || body.data;
    if(!output || !Array.isArray(output.models))throw Error('Invalid metadata');
    for(const item of output.models){const id=typeof item==='string'?item:item?.model;if(typeof id==='string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(id))models.add(id);}
    if(output.models.length<100 || (Number.isFinite(output.total) && page*100>=output.total)){complete=true;break;}
  }
  return {ok:true,configuredModel:configuredModel || null,configuredListed:Boolean(configuredModel && models.has(configuredModel)),complete,
    imageModels:[...models].filter(id=>/^(?:qwen-image|wan\d.*(?:image|t2i))/i.test(id)).sort(),
    note:'Metadata lists model IDs, not a successful generation test. Select only a model enabled in Singapore that supports the multimodal-generation image API. No image was generated.'};
}
