import * as THREE from 'three';
import { sectionRects } from './profiles.mjs';

export function plateGeometry(w, l, t, cfg, diameter) {
  const s = new THREE.Shape();
  s.moveTo(-w/2, -l/2); s.lineTo(w/2, -l/2); s.lineTo(w/2, l/2); s.lineTo(-w/2, l/2); s.closePath();
  for(let r=0;r<cfg.rows;r++) for(let c=0;c<cfg.cols;c++) {
    const hole=new THREE.Path();
    hole.absarc(-w/2+(cfg.edgeDistXLeft+c*cfg.spacingX)/1000, -l/2+(cfg.edgeDistYTop+r*cfg.spacingY)/1000, diameter/2000, 0, Math.PI*2, true);
    s.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(s, {depth:t, bevelEnabled:false, curveSegments:24, steps:1});
  geometry.rotateX(Math.PI/2);
  return geometry;
}
export function buildModel(p) {
  const group = new THREE.Group();
  const colour = /white/i.test(p.paintType) ? 0xe4e8eb : /red/i.test(p.paintType) ? 0x924940 : 0x697c8c;
  const material = new THREE.MeshStandardMaterial({color:colour, metalness:0.25, roughness:0.58});
  const lineMaterial = new THREE.LineBasicMaterial({color:0x263640, transparent:true, opacity:0.6});
  const add = (geometry, x,y,z, name) => {
    const mesh = new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,25),lineMaterial));group.add(mesh);
  };
  const length=p.beamHeight/1000, base=p.basePlateThickness/1000, top=p.topPlateThickness/1000;
  for(const [i,r] of sectionRects({h:p.sectionDepth,b:p.beamWidth,tf:p.flangeThickness,tw:p.webThickness}).entries()) {
    add(new THREE.BoxGeometry(r.width/1000,length,r.height/1000), (r.x+r.width/2-p.sectionDepth/2)/1000,base+length/2,(r.y+r.height/2-p.beamWidth/2)/1000,['Left flange','Right flange','Web'][i]);
  }
  add(plateGeometry(p.basePlateWidth/1000,p.basePlateLength/1000,base,p.basePlateHoles,p.baseHolesDiameter),0,base,0,'Base plate');
  add(plateGeometry(p.topPlateWidth/1000,p.topPlateLength/1000,top,p.topPlateHoles,p.topHolesDiameter),0,base+length+top,0,'Top plate');
  group.position.y=-(base+length+top)/2;
  return group;
}
export function disposeModel(group) {
  const geometries=new Set(),materials=new Set();
  group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material) for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
