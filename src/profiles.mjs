// British Steel UC 100723 and UB 190724 datasheets; source links in README.
// h = section depth, b = flange width, tf = flange thickness, tw = web thickness.
/** @type {Record<string, {h:number,b:number,tf:number,tw:number}>} */
export const catalogue = Object.fromEntries([
['152x152x23',152.4,152.2,6.8,5.8],['152x152x30',157.6,152.9,9.4,6.5],['152x152x37',161.8,154.4,11.5,8],
['203x203x46',203.2,203.6,11,7.2],['203x203x52',206.2,204.3,12.5,7.9],['203x203x60',209.6,205.8,14.2,9.4],['203x203x71',215.8,206.4,17.3,10],['203x203x86',222.2,209.1,20.5,12.7],
['254x254x73',254.1,254.6,14.2,8.6],['254x254x89',260.3,256.3,17.3,10.3],['254x254x107',266.7,258.8,20.5,12.8],
['254x146x31',251.4,146.1,8.6,6],['254x146x37',256,146.4,10.9,6.3],['254x146x43',259.6,147.3,12.7,7.2],
['305x165x40',303.4,165,10.2,6],['305x165x46',306.6,165.7,11.8,6.7]
].map(([key,h,b,tf,tw])=>[key,{h,b,tf,tw}]));
export const normalizeKey = s => s.toLowerCase().replace(/×/g,'x').replace(/\s+/g,'').replace(/^(ub|uc)/,'').replace(/(ub|uc)$/,'');
export function parseCSV(text) {
 const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 if(rows.length<2) throw new Error('CSV needs a header and at least one profile. Expected: size,h,b,tf,tw');
 const sep=rows[0].includes(';')?';':',';
 if(rows.shift().toLowerCase().split(sep).map(x=>x.trim()).join(',')!=='size,h,b,tf,tw') throw new Error('CSV header must be size,h,b,tf,tw. Legacy files without h are not accepted.');
 const result={};
 for(const [i,row] of rows.entries()) {
  const parts=row.split(sep).map(x=>x.trim());
  const key=normalizeKey(parts[0]); const values=parts.slice(1).map(x=>Number(sep===';'?x.replace(',','.'):x));
  const [h,b,tf,tw]=values;
  if(parts.length!==5||!/^\d+(?:\.\d+)?x\d+(?:\.\d+)?x\d+(?:\.\d+)?$/.test(key)||parts.some(x=>!x)||values.some(x=>!Number.isFinite(x)||x<=0)||h<=2*tf||b<=tw) throw new Error(`Invalid CSV row ${i+2}: ${row}`);
  if(result[key]) throw new Error(`Duplicate profile at row ${i+2}: ${key}`);
  result[key]={h,b,tf,tw};
 }
 return result;
}
// Same orientation as the original drawing: flanges on left/right, h horizontal.
export function sectionRects({h,b,tf,tw}) { return [{x:0,y:0,width:tf,height:b},{x:h-tf,y:0,width:tf,height:b},{x:tf,y:(b-tw)/2,width:h-2*tf,height:tw}]; }
export function validGrid(w,l,c,d) {
 const {rows,cols,spacingX:sx,spacingY:sy,edgeDistXLeft:left,edgeDistXRight:right,edgeDistYTop:top,edgeDistYBottom:bottom}=c;
 return [w,l,d,sx,sy,left,right,top,bottom].every(Number.isFinite) && w>0 && l>0 && d>=0 && Number.isInteger(rows)&&Number.isInteger(cols)&&rows>=1&&cols>=1&&rows<=50&&cols<=50 && [left,right,top,bottom].every(x=>x>=d/2) && sx>=0 && sy>=0 && (cols===1||sx>=d)&&(rows===1||sy>=d) && Math.abs(left+(cols-1)*sx+right-w)<1e-6 && Math.abs(top+(rows-1)*sy+bottom-l)<1e-6;
}
