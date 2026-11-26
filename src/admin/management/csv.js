// RFC-style quoted fields, including commas, quotes and newlines.
export function parseCsv(text) {
  const rows=[];let row=[],value='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
    if(c==='"'){if(value||closed)throw new Error('Unexpected quote in CSV.');quoted=true;}
    else if(c===','){row.push(value);value='';closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';closed=false;}
    else {if(closed)throw new Error('Unexpected text after a quoted CSV field.');value+=c;}
  }
  if(quoted)throw new Error('CSV has an unclosed quote.');
  row.push(value);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
export function importUnits(text, facilityId, floors, types) {
  const [head,...rows]=parseCsv(text);
  const expected=['unitCode','floorNumber','unitTypeCode','zone','currentPrice','status','note'];
  if(!head||head.map(x=>x.trim()).join(',')!==expected.join(','))throw new Error('Use the template column headers in their original order.');
  if(!rows.length||rows.length>200)throw new Error('Import between 1 and 200 units.');
  const codes=new Set();
  return rows.map((row,i)=>{
    if(row.length!==expected.length)throw new Error('Row '+(i+2)+': expected 7 columns.');
    const r=Object.fromEntries(expected.map((key,n)=>[key,row[n].trim()]));
    const fail=message=>{throw new Error('Row '+(i+2)+': '+message);};
    if(!r.unitCode||r.unitCode.length>20)fail('unit code must be 1–20 characters.');
    if(codes.has(r.unitCode.toLowerCase()))fail('duplicate unit code.');codes.add(r.unitCode.toLowerCase());
    if(!r.floorNumber||!Number.isInteger(Number(r.floorNumber)))fail('floor number must be an integer.');
    const floor=floors.find(f=>f.floorNumber===Number(r.floorNumber)),type=types.find(t=>t.code.toLowerCase()===r.unitTypeCode.toLowerCase());
    if(!floor)fail('floor not found at the selected facility.');if(!type)fail('unit type not found.');
    const price=Number(r.currentPrice);
    if(!r.currentPrice||!Number.isFinite(price)||price<0||price>9999999999.99||Math.abs(price*100-Math.round(price*100))>0.001)fail('price must be 0–9999999999.99, with at most two decimal places.');
    if(r.zone.length>10||r.note.length>200)fail('zone max 10 characters; note max 200.');
    if(!['Available','Maintenance','Retired'].includes(r.status))fail('use Available, Maintenance or Retired.');
    return {facilityId:Number(facilityId),floorId:floor.floorId,unitTypeId:type.unitTypeId,unitCode:r.unitCode,zone:r.zone,currentPrice:price,status:r.status,note:r.note};
  });
}

