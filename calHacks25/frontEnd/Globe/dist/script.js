import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/renderers/CSS2DRenderer.js';

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 2000);
camera.position.set(0.5, 0.5, 1).setLength(14);
let renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0xaaffaa);
document.body.appendChild(renderer.domElement);

let labelRenderer = new CSS2DRenderer();
labelRenderer.setSize( window.innerWidth, window.innerHeight );
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.body.appendChild( labelRenderer.domElement );

window.addEventListener("resize", onWindowResize);

let controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 15;
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed *= 0.25;

let globalUniforms = {
  time: { value: 0 }
};

// <GLOBE>
// https://web.archive.org/web/20120107030109/http://cgafaq.info/wiki/Evenly_distributed_points_on_sphere#Spirals
let counter = 200000;
let rad = 5;
let sph = new THREE.Spherical();

let r = 0;
let dlong = Math.PI * (3 - Math.sqrt(5));
let dz = 2 / counter;
let long = 0;
let z = 1 - dz / 2;

let pts = [];
let clr = [];
let c = new THREE.Color();
let uvs = [];

for (let i = 0; i < counter; i++) {
  r = Math.sqrt(1 - z * z);
  let p = new THREE.Vector3(
    Math.cos(long) * r,
    z,
    -Math.sin(long) * r
  ).multiplyScalar(rad);
  pts.push(p);
  z = z - dz;
  long = long + dlong;

  c.setHSL(0.45, 0.5, Math.random() * 0.25 + 0.25);
  c.toArray(clr, i * 3);

  sph.setFromVector3(p);
  uvs.push((sph.theta + Math.PI) / (Math.PI * 2), 1.0 - sph.phi / Math.PI);
}

let g = new THREE.BufferGeometry().setFromPoints(pts);
g.setAttribute("color", new THREE.Float32BufferAttribute(clr, 3));
g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
let m = new THREE.PointsMaterial({
  size: 0.1,
  vertexColors: true,
  onBeforeCompile: (shader) => {
    shader.uniforms.globeTexture = {
      value: new THREE.TextureLoader().load(imgData)
    };
    shader.vertexShader = `
    	uniform sampler2D globeTexture;
      varying float vVisibility;
      varying vec3 vNormal;
      varying vec3 vMvPosition;
      ${shader.vertexShader}
    `.replace(
      `gl_PointSize = size;`,
      `
      	vVisibility = texture(globeTexture, uv).g; // get value from texture
        gl_PointSize = size * (vVisibility < 0.5 ? 1. : 0.75); // size depends on the value
        vNormal = normalMatrix * normalize(position);
        vMvPosition = -mvPosition.xyz;
        gl_PointSize *= 0.4 + (dot(normalize(vMvPosition), vNormal) * 0.6); // size depends position in camera space
      `
    );
    //console.log(shader.vertexShader);
    shader.fragmentShader = `
    	varying float vVisibility;
      varying vec3 vNormal;
      varying vec3 vMvPosition;
      ${shader.fragmentShader}
    `.replace(
      `vec4 diffuseColor = vec4( diffuse, opacity );`,
      `
      	bool circ = length(gl_PointCoord - 0.5) > 0.5; // make points round
        bool vis = dot(vMvPosition, vNormal) < 0.; // visible only on the front side of the sphere
      	if (circ || vis) discard;
        
        vec3 col = diffuse + (vVisibility > 0.5 ? 0.5 : 0.); // make oceans brighter
        
        vec4 diffuseColor = vec4( col, opacity );
      `
    );
    //console.log(shader.fragmentShader);
  }
});
let globe = new THREE.Points(g, m);
scene.add(globe);

  // <ICOSAHEDRON>
  let icshdrn = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), new THREE.MeshBasicMaterial({color: 0x647f7f, wireframe: true}));
  globe.add(icshdrn);
  // </ICOSAHEDRON>
// </GLOBE>

// <Markers>
const markerCount = 8;
let markerInfo = []; // information on markers
let gMarker = new THREE.PlaneGeometry();
let mMarker = new THREE.MeshBasicMaterial({
  color: 0xff3232,
  onBeforeCompile: (shader) => {
    shader.uniforms.time = globalUniforms.time;
    shader.vertexShader = `
    	attribute float phase;
      varying float vPhase;
      ${shader.vertexShader}
    `.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
      	vPhase = phase; // de-synch of ripples
      `
    );
    shader.fragmentShader = `
    	uniform float time;
      varying float vPhase;
    	${shader.fragmentShader}
    `.replace(
      `vec4 diffuseColor = vec4( diffuse, opacity );`,

      ` 
      vec2 lUv = (vUv - 0.5) * 2.;
      float val = 0.;
      float lenUv = length(lUv);
      val = max(val, 1. - step(0.25, lenUv)); // central circle
      val = max(val, step(0.4, lenUv) - step(0.5, lenUv)); // outer circle
      
      float tShift = fract(time * 0.5 + vPhase);
      val = max(val, step(0.4 + (tShift * 0.6), lenUv) - step(0.5 + (tShift * 0.5), lenUv)); // ripple
      if (val < 0.5) discard;
      
      vec4 diffuseColor = vec4( diffuse, opacity );`
    );
  }
});
mMarker.defines = { USE_UV: " " }; // needed to be set to be able to work with UVs
let markers = new THREE.InstancedMesh(gMarker, mMarker, markerCount);

let dummy = new THREE.Object3D();
let phase = [];

// Continent center coordinates (latitude, longitude)
const continentCenters = [
  { lat: 8.7832, lon: 34.5085 }, // Africa
  { lat: 37.0902, lon: -95.7129 }, // North America
  { lat: -14.2350, lon: -51.9253 }, // South America
  { lat: 34.0479, lon: 100.6197 }, // Asia
  { lat: 48.8566, lon: 2.3522 }, // Europe
  { lat: -25.2744, lon: 133.7751 }, // Oceania
  { lat: -90, lon: 0 }, // Antarctica
  { lat: 90, lon: 0 }, // Arctic
];

// Ocean coordinates (random ocean locations)
const oceanCoordinates = [
  { lat: -45, lon: -60 }, // Random ocean point
  { lat: 30, lon: 150 },  // Random ocean point
  { lat: -20, lon: 100 },  // Random ocean point
  { lat: 10, lon: -120 }, // Random ocean point
  { lat: -10, lon: 90 },  // Random ocean point
];

// Add markers for continents
for (let i = 0; i < continentCenters.length; i++) {
  let { lat, lon } = continentCenters[i];
  let latRad = THREE.MathUtils.degToRad(lat);
  let lonRad = THREE.MathUtils.degToRad(lon);

  let x = 5 * Math.cos(latRad) * Math.cos(lonRad);
  let y = 5 * Math.sin(latRad);
  let z = 5 * Math.cos(latRad) * Math.sin(lonRad);

  dummy.position.set(x, y, z);
  dummy.lookAt(dummy.position.clone().setLength(6)); // Look at the center of the globe
  dummy.updateMatrix();

  markers.setMatrixAt(i, dummy.matrix);
  phase.push(Math.random());

  markerInfo.push({
    id: i + 1,
    mag: THREE.MathUtils.randInt(1, 10),
    crd: dummy.position.clone()
  });
}

// Add markers for ocean locations (remaining markers)
let oceanIndex = 0;
for (let i = continentCenters.length; i < markerCount; i++) {
  let { lat, lon } = oceanCoordinates[oceanIndex];
  oceanIndex = (oceanIndex + 1) % oceanCoordinates.length; // Loop through oceanCoordinates

  let latRad = THREE.MathUtils.degToRad(lat);
  let lonRad = THREE.MathUtils.degToRad(lon);

  let x = 5 * Math.cos(latRad) * Math.cos(lonRad);
  let y = 5 * Math.sin(latRad);
  let z = 5 * Math.cos(latRad) * Math.sin(lonRad);

  dummy.position.set(x, y, z);
  dummy.lookAt(dummy.position.clone().setLength(6)); // Look at the center of the globe
  dummy.updateMatrix();

  markers.setMatrixAt(i, dummy.matrix);
  phase.push(Math.random());

  markerInfo.push({
    id: i + 1,
    mag: THREE.MathUtils.randInt(1, 10),
    crd: dummy.position.clone()
  });
}

gMarker.setAttribute(
  "phase",
  new THREE.InstancedBufferAttribute(new Float32Array(phase), 1)
);

scene.add(markers);
// </Markers>


// <Label>
let labelDiv = document.getElementById("markerLabel");
let closeBtn = document.getElementById("closeButton");
closeBtn.addEventListener("pointerdown", event => {
  labelDiv.classList.add("hidden");
})
let label = new CSS2DObject(labelDiv);
label.userData = {
  cNormal: new THREE.Vector3(),
  cPosition: new THREE.Vector3(),
  mat4: new THREE.Matrix4(),
  trackVisibility: () => { // the closer to the edge, the less opacity
    let ud = label.userData;
    ud.cNormal.copy(label.position).normalize().applyMatrix3(globe.normalMatrix);
    ud.cPosition.copy(label.position).applyMatrix4(ud.mat4.multiplyMatrices(camera.matrixWorldInverse, globe.matrixWorld));
    let d = ud.cPosition.negate().normalize().dot(ud.cNormal);
    d = smoothstep(0.2, 0.7, d);
    label.element.style.opacity = d;
    
    // https://github.com/gre/smoothstep/blob/master/index.js
    function smoothstep (min, max, value) {
      var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
      return x*x*(3 - 2*x);
    };
  }
}
scene.add(label);
// </Label>

// <Interaction>
let pointer = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let intersections;
let divID = document.getElementById("idNum");
let divMag = document.getElementById("magnitude");
let divCrd = document.getElementById("coordinates");
window.addEventListener("pointerdown", event => {
  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  intersections = raycaster.intersectObject(markers).filter(m => {
    return (m.uv.subScalar(0.5).length() * 2) < 0.25; // check, if we're in the central circle only
  });
  //console.log(intersections);
  if (intersections.length > 0) {
    let iid = intersections[0].instanceId;
    let mi = markerInfo[iid];
    divID.innerHTML = `ID: <b>${mi.id}</b>`;
    divMag.innerHTML = `Mag: <b>${mi.mag}</b>`;
    divCrd.innerHTML = `X: <b>${mi.crd.x.toFixed(2)}</b>; Y: <b>${mi.crd.y.toFixed(2)}</b>; Z: <b>${mi.crd.z.toFixed(2)}</b>`;
    label.position.copy(mi.crd);
    label.element.animate([
      {width: "0px", height: "0px", marginTop: "0px", marginLeft: "0px"},
      {width: "230px", height: "50px", marginTop: "-25px", maginLeft: "120px"}
    ],{
      duration: 250
    });
    label.element.classList.remove("hidden");
  }
  
})
// </Interaction>

let clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  let t = clock.getElapsedTime();
  globalUniforms.time.value = t;
  label.userData.trackVisibility();
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

function onWindowResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
}