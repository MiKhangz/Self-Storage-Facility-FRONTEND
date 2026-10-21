import {apiRequest,readSession} from '../auth.js';
export const ROOT='/api/handover-desk';
export const call=(path,body,method='POST')=>apiRequest(ROOT+path,{method,body:JSON.stringify(body)});
export async function binary(path,options={}){
  const base=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
  const response=await fetch(base+ROOT+path,{...options,headers:{Authorization:`Bearer ${readSession()?.token??''}`},signal:AbortSignal.timeout(30000)});
  if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.title||Object.values(data?.errors??{}).flat().join(' ')||'The file could not be transferred. Try again.');}
  return response;
}
export async function upload(id,token,kind,file){const data=new FormData();data.append('token',token);data.append('kind',kind);data.append('file',file,file.name||'signature.png');return (await binary(`/${id}/evidence`,{method:'POST',body:data})).json();}
export const localDate=value=>new Date(value??Date.now()).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
export const clock=value=>value?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)):'—';
export const dateTime=value=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)):'—';
