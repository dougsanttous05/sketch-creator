import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import type { StructuralParams } from './App';
import { buildModel, disposeModel } from './model.mjs';

export default function ModelViewer({params,onClose}:{params:StructuralParams;onClose:()=>void}) {
  const host=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
  const controlsRef=useRef<TrackballControls|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null, overflow=document.body.style.overflow;
    document.body.style.overflow='hidden'; close.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape')onClose();
      if(e.key==='Tab') {
        const items=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
  },[onClose]);
  useEffect(()=>{
    const el=host.current;if(!el)return;
    let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({antialias:true});}
    catch {setError('3D could not start. Please enable WebGL or try another browser. Your drawing is unchanged.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0xe5ecef);el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),model=buildModel(params);scene.add(model);
    scene.add(new THREE.HemisphereLight(0xffffff,0x78838c,2.8));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(4,6,7);scene.add(light);
    const fill=new THREE.DirectionalLight(0xd7eaff,2);fill.position.set(-4,-3,-5);scene.add(fill);
    const box=new THREE.Box3().setFromObject(model),radius=box.getBoundingSphere(new THREE.Sphere()).radius;
    const camera=new THREE.PerspectiveCamera(40,1,Math.max(radius/10000,0.0001),radius*100);
    const controls=new TrackballControls(camera,renderer.domElement);
    controls.rotateSpeed=3;controls.zoomSpeed=1.2;controls.panSpeed=0.5;controls.staticMoving=true;
    controls.minDistance=radius*0.08;controls.maxDistance=radius*15;controlsRef.current=controls;
    const fit=()=>{
      const aspect=el.clientWidth/Math.max(1,el.clientHeight);
      camera.aspect=aspect;camera.updateProjectionMatrix();
      const fov=Math.min(THREE.MathUtils.degToRad(40),2*Math.atan(Math.tan(THREE.MathUtils.degToRad(20))*aspect));
      const distance=radius/Math.sin(fov/2)*1.12;
      camera.position.copy(new THREE.Vector3(1,0.45,1.6).normalize().multiplyScalar(distance));camera.up.set(0,1,0);controls.target.set(0,0,0);camera.lookAt(0,0,0);controls.update();
    };
    const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/Math.max(1,el.clientHeight);camera.updateProjectionMatrix();controls.handleResize();};
    resize();fit();
    // Reset also re-fits after a phone orientation change.
    controls.reset=fit;
    const observer=new ResizeObserver(resize);observer.observe(el);
    let frame=0;const render=()=>{frame=requestAnimationFrame(render);controls.update();renderer.render(scene,camera);};render();
    const lost=(e:Event)=>{e.preventDefault();setError('The 3D display was interrupted. Close and reopen this view to restart.');};
    renderer.domElement.addEventListener('webglcontextlost',lost);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();controlsRef.current=null;disposeModel(model);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[params]);
  const zoom=(factor:number)=>{const c=controlsRef.current;if(!c)return;const offset=c.object.position.clone().sub(c.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,c.minDistance,c.maxDistance));c.object.position.copy(c.target).add(offset);c.update();};
  return <div className="model-overlay no-print" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="model-title">
    <header className="model-toolbar"><div><h2 id="model-title">3D · Free rotation 360°</h2><small>{params.beamProfile} · member length {params.beamHeight} mm</small></div><div className="actions"><button onClick={()=>zoom(0.8)} disabled={!!error} aria-label="Zoom in">+</button><button onClick={()=>zoom(1.25)} disabled={!!error} aria-label="Zoom out">−</button><button onClick={()=>controlsRef.current?.reset()} disabled={!!error}>Reset view</button><button ref={close} onClick={onClose}>Close ×</button></div></header>
    <div className="model-stage" ref={host} aria-label="Interactive 3D steel member" />
    {error&&<p className="model-error" role="alert">{error}</p>}
    <footer className="model-help">Drag to rotate freely in every direction · Scroll or pinch to zoom · Right-drag or two fingers to pan<br/><small>True proportions · Plates and through-holes included · Welds, bolts and root radii not modelled</small></footer>
  </div>;
}
