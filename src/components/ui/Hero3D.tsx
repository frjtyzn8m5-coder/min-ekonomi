import { useEffect, useRef } from 'react';

// Live, cursor-reactive WebGL hero for the v4 design language.
//
// MOTIF: a "living" particle sphere — a shell of ~6000 GPU points arranged on a
// Fibonacci sphere that BREATHES and PULSES with a human heartbeat (the classic
// lub-dub systole/diastole rhythm). On each beat the shell expands outward and
// the palette warms from calm violet/cyan toward energetic gold/coral, then
// relaxes between beats. It reads as vitality / training / wellbeing — the core
// of a health + lifestyle app — rather than an abstract blob.
//
// Pure WebGL, no libraries, no external assets. The whole particle field is
// computed procedurally in the vertex shader from a single per-point index
// attribute, so there is only one tiny static buffer and one draw call.

const VERT = `
precision highp float;
attribute float a_id;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;
uniform float u_count;
uniform float u_psize;

varying vec3  v_col;
varying float v_bright;

const float PI  = 3.14159265;
const float TAU = 6.28318530;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// cheap per-point hash
float hash(float n){ return fract(sin(n*12.9898)*43758.5453); }

// A human heartbeat envelope over a normalized cycle x in [0,1): a strong "lub"
// (ventricular systole) followed by a softer "dub", then rest.
float heartbeat(float x){
  float lub = exp(-pow((x-0.11)/0.045, 2.0));
  float dub = 0.55 * exp(-pow((x-0.27)/0.055, 2.0));
  return lub + dub;
}

void main(){
  float i = a_id;
  float n = u_count;

  // --- base position: Fibonacci sphere (even distribution) ---
  float phi   = acos(1.0 - 2.0 * (i + 0.5) / n);
  float theta = PI * (1.0 + sqrt(5.0)) * i;
  vec3 base = vec3(sin(phi)*cos(theta), sin(phi)*sin(theta), cos(phi));

  // --- heartbeat (period ~0.9s => ~66 bpm) ---
  float period = 0.9;
  float cyc = fract(u_time / period);
  float beat = heartbeat(cyc);

  // --- breathing: slow inhale/exhale swell under the beat ---
  float breath = 0.5 + 0.5 * sin(u_time * 0.6);

  // shell thickness + per-point phase jitter so the beat ripples outward
  float h = hash(i);
  float ripple = beat * (0.14 + 0.05 * h);
  float radius = 0.92 + 0.05 * breath + ripple;

  // gentle flow swirl along the surface -> runner's motion-trail energy
  float sw = u_time * 0.5 + h * TAU;
  vec3 tangent = normalize(cross(base, vec3(0.0, 1.0, 0.0)) + 1e-4);
  vec3 pos = base * radius + tangent * sin(sw) * 0.035 * (0.5 + beat);

  // --- orientation: slow auto-spin + cursor parallax tilt ---
  pos.xz *= rot(u_time * 0.12 + u_mouse.x * 0.8);
  pos.yz *= rot(-0.25 + u_mouse.y * 0.5);

  // --- project (perspective), aspect-correct ---
  pos.z += 3.3;
  float persp = 2.0 / pos.z;
  vec2 clip = pos.xy * persp;
  clip.x *= u_res.y / u_res.x;
  gl_Position = vec4(clip, 0.0, 1.0);

  // size falls off with depth; swells slightly on the beat
  gl_PointSize = u_psize * persp * (0.85 + 0.35 * beat) * (0.8 + 0.4 * h);

  // --- palette: calm (violet->cyan) relaxing, warm (gold->coral) on the beat ---
  vec3 gold   = vec3(0.914, 0.761, 0.471);
  vec3 coral  = vec3(1.000, 0.561, 0.478);
  vec3 violet = vec3(0.608, 0.549, 1.000);
  vec3 cyan   = vec3(0.373, 0.878, 0.816);

  vec3 calm   = mix(violet, cyan, 0.5 + 0.5 * sin(h * TAU));
  vec3 active = mix(gold, coral, h);
  float warm  = clamp(beat * 0.9, 0.0, 1.0);
  v_col = mix(calm, active, warm);

  // depth shading + beat brightness; near points glow, far points recede
  float depth = clamp((4.3 - pos.z) / 1.3, 0.25, 1.0);
  v_bright = depth * (0.55 + 0.75 * beat);
}`;

const FRAG = `
precision highp float;
varying vec3  v_col;
varying float v_bright;
void main(){
  // soft round sprite with a bright core
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = pow(a, 1.7);
  gl_FragColor = vec4(v_col * v_bright, a);
}`;

export default function Hero3D({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const gl = (cv.getContext('webgl', { alpha: true, premultipliedAlpha: true }) ||
      cv.getContext('experimental-webgl')) as WebGLRenderingContext | null;
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

    // particle index buffer (one float per point)
    const COUNT = 6000;
    const ids = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) ids[i] = i;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_id');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uCount = gl.getUniformLocation(prog, 'u_count');
    const uPsize = gl.getUniformLocation(prog, 'u_psize');
    gl.uniform1f(uCount, COUNT);

    // additive glow on the dark ground, no depth test needed for points
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    let dpr = 1;
    let psize = 14;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(cv.clientWidth * dpr));
      cv.height = Math.max(1, Math.round(cv.clientHeight * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
      // keep sprite footprint stable across resolutions
      psize = Math.max(6, (cv.height / 70) * 1.0);
    };
    window.addEventListener('resize', resize);
    resize();

    const mouse = [0, 0];
    const target = [0, 0];
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      target[0] = ((e.clientX - r.left) / r.width) * 2 - 1;
      target[1] = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    cv.addEventListener('pointermove', onMove, { passive: true });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = Date.now();
    let raf = 0;
    let running = false;

    const draw = (time: number) => {
      mouse[0] += (target[0] - mouse[0]) * 0.06;
      mouse[1] += (target[1] - mouse[1]) * 0.06;
      gl.clearColor(0.027, 0.027, 0.035, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.uniform1f(uPsize, psize);
      gl.drawArrays(gl.POINTS, 0, COUNT);
    };

    const frame = () => {
      draw((Date.now() - t0) / 1000);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // pause when offscreen or tab hidden
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((en) => en.isIntersecting);
        if (visible && !document.hidden) start();
        else stop();
      },
      { threshold: 0.01 },
    );
    io.observe(cv);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (reduce) {
      // static, resting frame (no animation loop)
      draw(0.6);
    } else {
      start();
    }

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      cv.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      const le = gl.getExtension('WEBGL_lose_context');
      if (le) le.loseContext();
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
