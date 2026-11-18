import { useEffect, useRef } from 'react';

// Live, cursor-reactive 3D object: a raymarched metaball with a gold/iridescent
// material. Pure WebGL, no libraries, no assets — the signature element of the
// v4 design language. Degrades to nothing if WebGL is unavailable.

const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sph(vec3 p,float r){return length(p)-r;}
float map(vec3 p){float t=u_time*.5;
  float d=sph(p,.85);
  d=smin(d,sph(p+vec3(sin(t)*.7,cos(t*1.1)*.55,sin(t*.7)*.4),.5),.55);
  d=smin(d,sph(p+vec3(cos(t*.9)*.7,sin(t*.8)*.55,cos(t*1.2)*.4),.45),.55);
  d=smin(d,sph(p+vec3(sin(t*1.3)*.6,cos(t*.6)*.6,sin(t)*.5),.4),.55);
  return d;}
vec3 nrm(vec3 p){vec2 e=vec2(.001,0.);return normalize(vec3(
  map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*u_res)/u_res.y;
  vec3 ro=vec3(0.,0.,3.2); vec3 rd=normalize(vec3(uv,-1.5));
  float mx=u_mouse.x*.7, my=u_mouse.y*.45;
  mat2 R1=rot(u_time*.12+mx); ro.xz*=R1; rd.xz*=R1;
  mat2 R2=rot(my*.6); ro.yz*=R2; rd.yz*=R2;
  float t=0.; vec3 p; bool hit=false;
  for(int i=0;i<70;i++){ p=ro+rd*t; float d=map(p); if(d<.001){hit=true;break;} t+=d*.9; if(t>8.)break; }
  vec3 col=vec3(.027,.027,.035);
  if(hit){ vec3 n=nrm(p); vec3 l=normalize(vec3(.6,.85,.55));
    float dif=clamp(dot(n,l),0.,1.); float fres=pow(1.-clamp(dot(n,-rd),0.,1.),3.);
    vec3 irid=.5+.5*cos(6.2831*(n.x*.5+n.y*.3+n.z*.2)+vec3(0.,2.2,4.3));
    vec3 gold=vec3(.96,.74,.37);
    vec3 base=mix(vec3(.05,.045,.08),irid*.42,.6);
    col=base+dif*gold*.45+fres*mix(gold,vec3(.6,.55,1.),.4)*1.25; }
  gl_FragColor=vec4(col,1.);
}`;

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

export default function Hero3D({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const gl = (cv.getContext('webgl') || cv.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const sh = (type: number, src: string) => {
      const o = gl.createShader(type)!;
      gl.shaderSource(o, src);
      gl.compileShader(o);
      return o;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    const mouse = [0, 0];
    const target = [0, 0];
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      target[0] = ((e.clientX - r.left) / r.width) * 2 - 1;
      target[1] = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    cv.addEventListener('pointermove', onMove, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, cv.clientWidth * dpr);
      cv.height = Math.max(1, cv.clientHeight * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = Date.now();
    let raf = 0;
    const frame = () => {
      mouse[0] += (target[0] - mouse[0]) * 0.06;
      mouse[1] += (target[1] - mouse[1]) * 0.06;
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, reduce ? 2.0 : (Date.now() - t0) / 1000);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Absolutely positioned so the WebGL buffer can never feed back into layout
  // (an in-flow canvas with height:100% balloons on resize). The parent must be
  // positioned (relative/absolute) and give the box a definite size.
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }}
    />
  );
}
