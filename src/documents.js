import { createWorker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const base = new URL('../assets/document-reader/', import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs',base).href;
async function read(file, progress=()=>{}) {
  if(file.size>10*1024*1024)throw Error('Choisissez un fichier de moins de 10 Mo.');
  const type=file.type;
  if(!['application/pdf','image/jpeg','image/png','image/webp','text/plain'].includes(type))throw Error('Choisissez un PDF, une photo JPEG/PNG/WebP ou un fichier texte.');
  let worker, document, loadingTask, timer, cancelled=false;
  const ocr=async image=>{
    worker ||= await createWorker('fra',1,{workerPath:new URL('worker.min.js',base).href,corePath:base.href,langPath:base.href,workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')progress('Lecture locale de la photo… '+Math.round(m.progress*100)+' %');}});
    if(cancelled){await worker.terminate();throw Error('Lecture interrompue.');}
    const result=await worker.recognize(image);return result.data.text;
  };
  const work=async()=>{
    if(type==='text/plain')return [{page:1,text:(await file.text()).slice(0,60000)}];
    if(type.startsWith('image/')){
      const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>32000000){bitmap.close();throw Error('Cette image est trop grande. Recadrez-la sur les résultats.');}
      const canvas=globalThis.document.createElement('canvas'),scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return [{page:1,text:await ocr(canvas)}];
    }
    loadingTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,disableFontFace:true,stopAtErrors:true,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',base).href,wasmUrl:new URL('wasm/',base).href});
    document=await loadingTask.promise;
    if(cancelled)throw Error('Lecture interrompue.');
    if(document.numPages>10)throw Error('Ce PDF dépasse 10 pages. Sélectionnez les pages du bilan à comparer.');
    const pages=[];
    for(let n=1;n<=document.numPages;n++){
      progress(`Lecture locale du PDF · page ${n}/${document.numPages}`);
      const page=await document.getPage(n),content=await page.getTextContent();
      let lastY=null,text='';for(const item of content.items){if(!('str' in item))continue;const y=item.transform?.[5];if(lastY!==null&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}
      if(text.trim().length<20){const viewport=page.getViewport({scale:1.6});if(viewport.width*viewport.height>16000000)throw Error('Une page de ce PDF est trop grande. Importez une photo recadrée.');const canvas=globalThis.document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text=await ocr(canvas);}
      pages.push({page:n,text:text.slice(0,60000)});page.cleanup();
    }
    return pages;
  };
  try {return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La lecture prend trop de temps. Essayez une photo plus nette ou collez le texte.')),120000);})]);}
  catch(e){if(e.name==='PasswordException')throw Error('Ce PDF est protégé. Utilisez une copie déverrouillée ou collez le texte.');throw e;}
  finally {cancelled=true;clearTimeout(timer);if(worker)await worker.terminate().catch(()=>{});if(loadingTask)await loadingTask.destroy().catch(()=>{});}
}
window.PoumDocuments={read};
