import {useEffect,useRef,useState} from 'react';
import {binary,upload} from './deskApi.js';
export function EvidenceImage({id,evidenceId,alt}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let live=true,object;binary(`/${id}/evidence/${evidenceId}`).then(r=>r.blob()).then(b=>{object=URL.createObjectURL(b);if(live)setUrl(object);else URL.revokeObjectURL(object);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;if(object)URL.revokeObjectURL(object);};},[id,evidenceId]);
 return url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={alt}/></a>:<span>{error||'Loading image…'}</span>;
}
export function Photos({id,token,kind='inspection',evidence,disabled,refresh}){
 const [tasks,setTasks]=useState([]);const tasksRef=useRef([]);
 const update=(key,patch)=>setTasks(old=>old.map(x=>x.key===key?{...x,...patch}:x));
 async function send(task){update(task.key,{state:'uploading',error:''});try{await upload(id,token,kind,task.file);update(task.key,{state:'done'});refresh();}catch(e){update(task.key,{state:'error',error:e.message});}}
 function add(files){const next=[...files].map(file=>({file,key:crypto.randomUUID(),state:'queued'}));tasksRef.current.push(...next);setTasks(old=>[...old,...next]);for(const t of next){if(!['image/png','image/jpeg'].includes(t.file.type)||t.file.size>5*1024*1024)update(t.key,{state:'error',error:'Use PNG/JPEG, up to 5 MB.'});else send(t);}}
 return <div className="hd-photos"><div className="hd-thumbnails">{evidence.filter(e=>e.kind===kind).map((e,i)=><EvidenceImage key={e.handoverEvidenceId} id={id} evidenceId={e.handoverEvidenceId} alt={`${kind} photo ${i+1}`}/>)}</div>
 <div className="hd-actions"><label className="hd-upload">Upload photos<input aria-label={`Upload ${kind} photos`} disabled={disabled} type="file" accept="image/png,image/jpeg" multiple onChange={e=>{add(e.target.files);e.target.value='';}}/></label><label className="hd-upload">Use camera<input aria-label={`Capture ${kind} photo`} disabled={disabled} type="file" accept="image/*" capture="environment" onChange={e=>{add(e.target.files);e.target.value='';}}/></label></div>
 {tasks.filter(t=>t.state!=='done').map(t=><p key={t.key} role={t.state==='error'?'alert':'status'}>{t.file.name}: {t.error||'Uploading…'} {t.state==='error'&&<button type="button" disabled={disabled} onClick={()=>send(t)}>Retry</button>}</p>)}</div>;
}
export function SignaturePad({label,disabled,onSave}){
 const canvas=useRef(null),drawing=useRef(false),points=useRef(0);const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const position=e=>{const box=canvas.current.getBoundingClientRect();return[(e.clientX-box.left)*600/box.width,(e.clientY-box.top)*180/box.height];};
 const down=e=>{if(disabled||busy)return;e.preventDefault();drawing.current=true;canvas.current.setPointerCapture(e.pointerId);const ctx=canvas.current.getContext('2d');ctx.beginPath();ctx.moveTo(...position(e));};
 const move=e=>{if(!drawing.current)return;const ctx=canvas.current.getContext('2d');ctx.lineWidth=2.5;ctx.strokeStyle='#15324d';ctx.lineCap='round';ctx.lineTo(...position(e));ctx.stroke();points.current++;};
 const clear=()=>{canvas.current.getContext('2d').clearRect(0,0,600,180);points.current=0;};
 async function save(){if(points.current<5){setError('Draw a signature before saving.');return;}setBusy(true);setError('');try{const blob=await new Promise(resolve=>canvas.current.toBlob(resolve,'image/png'));await onSave(blob);clear();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="hd-signature"><strong>{label}</strong><canvas ref={canvas} width="600" height="180" aria-label={label+' signature pad'} onPointerDown={down} onPointerMove={move} onPointerUp={()=>drawing.current=false} onPointerCancel={()=>drawing.current=false}/><div className="hd-actions"><button type="button" disabled={disabled||busy} onClick={clear}>Clear</button><button type="button" disabled={disabled||busy} onClick={save}>{busy?'Saving…':'Save signature'}</button></div>{error&&<p role="alert">{error}</p>}</div>;
}

