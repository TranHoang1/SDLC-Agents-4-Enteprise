const fs=require('fs');
const XLSX=require('xlsx-js-style');
const base='C:\\Users\\ASUS\\orca\\workspaces\\SDLC-Agents-4-Enterprise\\SA4E-191\\documents\\SA4E-191\\';
const md=fs.readFileSync(base+'STC.md','utf8');
const lines=md.split('\n');
let rows=[];
for(let i=0;i<lines.length;i++){
  const t=lines[i].trim();
  if(t.startsWith('|')){
    let cells=t.split('|');
    cells=cells.slice(1,cells.length-1).map(function(c){return c.trim();});
    if(cells.length>0 && cells.every(function(c){return /^[-:\s]+$/.test(c);})) continue;
    rows.push(cells);
  }
}
let idx=-1;
for(let i=0;i<rows.length;i++){ if(rows[i][0]==='TC-ID'){ idx=i; break; } }
const tc = idx>=0 ? rows.slice(idx) : rows;
const ws=XLSX.utils.aoa_to_sheet(tc);
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,'STC');
XLSX.writeFile(wb, base+'STC-v1-SA4E-191.xlsx');
console.log('Wrote STC xlsx rows='+tc.length);
