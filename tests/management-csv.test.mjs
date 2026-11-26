import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv,importUnits } from '../src/admin/management/csv.js';
const head='unitCode,floorNumber,unitTypeCode,zone,currentPrice,status,note\n';
const floors=[{floorId:7,floorNumber:0}],types=[{unitTypeId:3,code:'S'}];
test('CSV preserves quoted commas, escaped quotes and embedded newlines',()=>{
  assert.deepEqual(parseCsv('a,b\r\n"hello, world","line 1\nline ""2"""'),[['a','b'],['hello, world','line 1\nline "2"']]);
});
test('Import resolves floor and type at the selected facility',()=>{
  const [r]=importUnits(head+'A1,0,S,A,0,Available,"door, inspected"',8,floors,types);
  assert.equal(r.floorId,7);assert.equal(r.unitTypeId,3);assert.equal(r.facilityId,8);assert.equal(r.currentPrice,0);assert.equal(r.note,'door, inspected');
});
test('Import rejects invalid allocations, statuses, prices and duplicate codes',()=>{
  for(const row of ['A1,9,S,A,5,Available,','A1,0,XX,A,5,Available,','A1,0,S,A,5,Occupied,','A1,0,S,A,-1,Available,','A1,0,S,A,,Available,','A1,0,S,A,1.234,Available,']){
    assert.throws(()=>importUnits(head+row,8,floors,types));
  }
  assert.throws(()=>importUnits(head+'A1,0,S,A,5,Available,\na1,0,S,A,5,Available,',8,floors,types),/duplicate/);
});
test('Import rejects malformed CSV and oversized batches',()=>{
  assert.throws(()=>parseCsv('"unclosed'),/unclosed/);
  assert.throws(()=>parseCsv('"closed"extra'),/Unexpected/);
  assert.throws(()=>importUnits(head+Array.from({length:201},(_,i)=>'A'+i+',0,S,A,5,Available,').join('\n'),8,floors,types),/200/);
});

