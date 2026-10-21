import {useEffect,useRef,useState} from 'react';
export default function ScanBooking({close,open}){
 const dialog=useRef(null),video=useRef(null),controls=useRef(null),live=useRef(true),scanning=useRef(false),submitting=useRef(false);const [code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const stop=()=>{scanning.current=false;controls.current?.stop();video.current?.srcObject?.getTracks().forEach(t=>t.stop());};
 useEffect(()=>{live.current=true;dialog.current.showModal();return ()=>{live.current=false;stop();};},[]);
 async function submit(value){if(submitting.current)return;submitting.current=true;setBusy(true);setError('');stop();try{await open(value.trim());if(live.current)close();}catch(e){if(live.current)setError(e.message);}finally{submitting.current=false;if(live.current)setBusy(false);}}
 async function camera(){if(scanning.current)return;scanning.current=true;setError('');
   try{const {BrowserQRCodeReader}=await import('@zxing/browser');if(!live.current)return;
     const active=await new BrowserQRCodeReader().decodeFromConstraints({video:{facingMode:'environment'}},video.current,(result,error,control)=>{if(result&&live.current&&!submitting.current){control.stop();setCode(result.getText());submit(result.getText());}});
     if(!live.current||!scanning.current)active.stop();else controls.current=active;
   }catch{stop();if(live.current)setError('Camera could not be opened. Check permission or enter the booking code.');}}
 return <dialog ref={dialog} className="hd-dialog" onCancel={e=>{e.preventDefault();if(!busy)close();}}><h2>Scan booking QR</h2><p>Scan the confirmation QR or enter its booking code. Today’s booking will be marked Waiting.</p><video ref={video} playsInline muted/><button onClick={camera} disabled={busy}>Open camera</button><form onSubmit={e=>{e.preventDefault();submit(code);}}><label>Reservation code<input autoFocus required maxLength={20} value={code} placeholder="RSV-2026-00481" onChange={e=>setCode(e.target.value)}/></label>{error&&<p role="alert" className="hd-error">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy?'Finding…':'Open booking'}</button></footer></form></dialog>;
}
