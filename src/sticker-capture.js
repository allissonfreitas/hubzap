const { MAX_FILE } = require('./stickers');
function allowedStickerSource(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'blob:'
      ? parsed.origin === 'https://web.whatsapp.com'
      : parsed.protocol === 'https:' && /(^|\.)whatsapp\.(com|net)$/.test(parsed.hostname);
  } catch { return false; }
}
function imageReadScript(url) {
  return `(async()=>{
    const response=await fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Não foi possível ler a imagem.');
    if(Number(response.headers.get('content-length'))>${MAX_FILE})throw Error('Limite de 5 MB.');
    const reader=response.body.getReader();const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>${MAX_FILE}){await reader.cancel();throw Error('Limite de 5 MB.');}chunks.push(value);}
    const blob=new Blob(chunks);return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
  })()`;
}
module.exports = { allowedStickerSource, imageReadScript };
