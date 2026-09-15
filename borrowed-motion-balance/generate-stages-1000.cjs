// Run with Node.js: node generate-stages-1000.cjs
// Reproducible 1000-stage set (seed 20260915). Rule: borrowed-motion-easy-v1.
// Boards 3x3 and 4x4, 2-4 pieces. Solver metrics are NOT human difficulty ratings.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ROOT = __dirname;
const RULES = 'borrowed-motion-easy-v1';
const VECTORS = [[1,0],[0,1],[-1,0],[0,-1]];

let seed = 20260915;
function random(){ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
const clone=s=>s.map(p=>p.slice());
const key=s=>s.flat().join(',');
const poskey=s=>s.map(p=>p.slice(0,2).join(',')).join(';');
function pairsFor(n){const o=[];for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)o.push([a,b]);return o;}

function outcome(s,pair,n){
  const t=clone(s),[a,b]=pair;[t[a][2],t[b][2]]=[t[b][2],t[a][2]];
  const proposed=t.map((p,i)=>{
    if(i!==a&&i!==b)return p.slice(0,2);
    const [dx,dy]=VECTORS[p[2]],x=p[0]+dx,y=p[1]+dy;
    const blocked=x<0||x>=n||y<0||y>=n||s.some(q=>q[0]===x&&q[1]===y);
    return blocked?p.slice(0,2):[x,y];
  });
  return t.map((p,i)=>{const q=proposed[i],c=proposed.filter(r=>r[0]===q[0]&&r[1]===q[1]).length>1;return[c?p[0]:q[0],c?p[1]:q[1],p[2]];});
}

// BFS over pair-moves. Returns goals map (by piece positions) with distance/ways,
// plus parent info for one shortest path. Aborts (null) if states exceed cap.
function explore(start,n,cap){
  const pairs=pairsFor(start.length);
  const states=[start],index=new Map([[key(start),0]]),distance=[0],ways=[1],parent=[null],goals=new Map();
  for(let i=0;i<states.length;i++){
    if(states.length>cap) return null;
    const s=states[i],pk=poskey(s),d=distance[i];
    if(!goals.has(pk))goals.set(pk,{positions:s.map(p=>p.slice(0,2)),distance:d,ways:0,node:i});
    const g=goals.get(pk); if(d===g.distance)g.ways+=ways[i];
    for(let a=0;a<pairs.length;a++){
      const t=outcome(s,pairs[a],n),k=key(t);let j=index.get(k);
      if(j===undefined){j=states.length;index.set(k,j);states.push(t);distance.push(d+1);ways.push(ways[i]);parent.push([i,a]);}
      else if(distance[j]===d+1)ways[j]+=ways[i];
    }
  }
  return {states,goals,parent,pairs,total:states.length};
}

function canonical(start,targets,n){
  const variants=[];
  for(let reflect=0;reflect<2;reflect++)for(let rotate=0;rotate<4;rotate++){
    const rows=start.map((p,i)=>{
      let [x,y,d]=p,[gx,gy]=targets[i],[dx,dy]=VECTORS[d];
      if(reflect){x=n-1-x;gx=n-1-gx;dx=-dx;}
      for(let k=0;k<rotate;k++){[x,y]=[n-1-y,x];[gx,gy]=[n-1-gy,gx];[dx,dy]=[-dy,dx];}
      const nd=VECTORS.findIndex(v=>v[0]===dx&&v[1]===dy);
      return [x,y,nd,gx,gy].join(',');
    }).sort();
    variants.push(n+'|'+rows.join(';'));
  }
  return variants.sort()[0];
}
function randomStart(n,count){
  const cells=shuffle(Array.from({length:n*n},(_,i)=>i));
  const dirs=Array.from({length:count},()=>Math.floor(random()*4));
  return cells.slice(0,count).map((cell,i)=>[cell%n,Math.floor(cell/n),dirs[i]]);
}

// ---- pool collection with per-(config,depth) quotas and early stop ----
const STATE_CAP = 7000;
const collectConfigs = [
  {n:3,pieces:2,depths:[1,2,3],quota:60,maxRuns:4000},
  {n:3,pieces:3,depths:[1,2,3,4,5,6],quota:320,maxRuns:20000},
  {n:4,pieces:3,depths:[3,4,5,6,7,8],quota:320,maxRuns:20000},
  {n:4,pieces:4,depths:[3,4,5,6,7,8,9],quota:280,maxRuns:40000},
];
const seenAll = new Set();
const pool = {}; // bucket key `${n}-${pieces}-${depth}` -> array of {n,pieces,start,targets,depth,ways}
const bk = (n,p,d)=>`${n}-${p}-${d}`;

for(const cfg of collectConfigs){
  const {n,pieces,depths,quota,maxRuns}=cfg;
  const need=new Set(depths.map(d=>bk(n,pieces,d)));
  for(const d of depths) pool[bk(n,pieces,d)]=pool[bk(n,pieces,d)]||[];
  const t0=Date.now(); let runs=0;
  while(need.size>0 && runs<maxRuns){
    runs++;
    const start=randomStart(n,pieces);
    const g=explore(start,n,STATE_CAP);
    if(!g)continue;
    for(const goal of g.goals.values()){
      const d=goal.distance;
      if(!depths.includes(d))continue;
      const b=bk(n,pieces,d);
      if(!need.has(b))continue;               // quota already met
      if(pieces>=3 && d>1 && goal.ways<2)continue; // avoid single-line forced puzzles
      const ck=canonical(start,goal.positions,n);
      if(seenAll.has(ck))continue;
      seenAll.add(ck);
      pool[b].push({n,pieces,start,targets:goal.positions.map(p=>p.slice()),depth:d,ways:goal.ways,ck});
      if(pool[b].length>=quota) need.delete(b);
    }
  }
  console.log(`collect ${n}x${n}-${pieces}p: runs=${runs} ms=${Date.now()-t0} `+
    depths.map(d=>`d${d}:${pool[bk(n,pieces,d)].length}`).join(' '));
}
// shuffle each bucket for variety, deterministic
for(const b in pool) pool[b]=shuffle(pool[b]);

// ---- difficulty curve: 1000 stages across chapters ----
const rhythm=[0,0,1,0,-1,0,1,0,0,-1];
const CH=[
  {name:'규칙 익히기',   from:1,   to:100,  n:3, pieces:3, base:2, lo:1, hi:3},
  {name:'편안한 반복',   from:101, to:250,  n:3, pieces:3, base:3, lo:2, hi:4},
  {name:'순서 계획',     from:251, to:400,  n:3, pieces:3, base:5, lo:4, hi:6},
  {name:'넓은 보드 적응',from:401, to:550,  n:4, pieces:3, base:4, lo:3, hi:5},
  {name:'4×4 계획',      from:551, to:700,  n:4, pieces:3, base:6, lo:5, hi:8},
  {name:'네 조각 입문',  from:701, to:800,  n:4, pieces:4, base:4, lo:3, hi:5},
  {name:'네 조각 계획',  from:801, to:900,  n:4, pieces:4, base:6, lo:5, hi:7},
  {name:'긴 여정',       from:901, to:1000, n:4, pieces:4, base:8, lo:7, hi:9},
];
const chapterFor=seq=>CH.find(c=>seq>=c.from&&seq<=c.to);
const tutorialDepths=[1,1,2,2,1,2,2,3,2,3];

function pickCandidate(n,pieces,desired,lo,hi){
  // try exact depth, then spiral outward within [lo,hi], then anywhere for this board/pieces
  const order=[desired];
  for(let off=1;off<=8;off++){ if(desired-off>=1)order.push(desired-off); order.push(desired+off); }
  for(const d of order){
    const b=bk(n,pieces,d);
    if(pool[b]&&pool[b].length){ return pool[b].pop(); }
  }
  return null;
}

const known1=[[0,1,1],[2,1,3]]; // tutorial: pieces 1&2 swap to reach opposite corners
const selected=[];
for(let seq=1;seq<=1000;seq++){
  const ch=chapterFor(seq);
  let n=ch.n, pieces=ch.pieces, desired;
  if(ch.from===1){ // onboarding chapter
    if(seq<=10){ pieces = seq<=2?2:3; desired=tutorialDepths[seq-1]; }
    else { desired=Math.min(ch.hi,Math.max(ch.lo, ch.base+rhythm[(seq-ch.from)%10])); }
  } else {
    desired=Math.min(ch.hi,Math.max(ch.lo, ch.base+rhythm[(seq-ch.from)%10]));
  }
  let pick;
  if(seq===1){ pick={n:3,pieces:2,start:known1,targets:[[0,0],[2,2]],depth:1,ways:1}; }
  else pick=pickCandidate(n,pieces,desired,ch.lo,ch.hi);
  if(!pick){ // last-resort: any unused candidate of this board (any pieces) then any at all
    for(const p of [pieces,3,4,2]){ pick=pickCandidate(n,p,desired,1,9); if(pick){pieces=p;break;} }
  }
  assert(pick,`no candidate for seq ${seq} ${n}x${n} ${pieces}p d${desired}`);
  const prev=selected[selected.length-1];
  const role=seq<=2?'tutorial':prev&&pick.depth<prev.min?'recovery':prev&&pick.depth>prev.min?'stretch':'practice';
  selected.push({
    stage_id:'SS-'+String(seq).padStart(4,'0'), sequence:seq, chapter:ch.name, intended_role:role,
    board_size:pick.n, piece_count:pick.pieces, start:pick.start, targets:pick.targets,
    min:pick.depth, ways:pick.ways, content_version:1,
  });
}

// ---- validate every selected puzzle: exact shortest distance + a sample path ----
function shortestPath(start,targets,n){
  const goalPos=targets.map(t=>t.join(',')); const isGoal=st=>st.map(p=>p.slice(0,2).join(',')).join(';')===goalPos.join(';');
  const g=explore(start,n,STATE_CAP*2);
  assert(g,'explore aborted during validation');
  // find goal node with matching positions
  let best=null;
  const target=targets.map(t=>t.join(',')).join(';');
  const goal=g.goals.get(target);
  assert(goal,'target positions unreachable');
  // backtrack shortest path
  const sol=[]; let node=goal.node;
  while(node){ const [pnode,a]=g.parent[node]; sol.unshift(g.pairs[a].map(x=>x+1)); node=pnode; }
  return {dist:goal.distance,sol};
}
let maxStates=0;
for(const s of selected){
  const {dist,sol}=shortestPath(s.start,s.targets,s.board_size);
  assert.equal(dist,s.min,`min mismatch at ${s.stage_id}: ${dist} vs ${s.min}`);
  // replay sample solution, confirm goal reached exactly at min
  let state=clone(s.start);
  for(const [idx,pair] of sol.entries()){
    state=outcome(state,pair.map(x=>x-1),s.board_size);
    const atGoal=state.every((p,i)=>p[0]===s.targets[i][0]&&p[1]===s.targets[i][1]);
    assert.equal(atGoal, idx===s.min-1, `goal timing ${s.stage_id}`);
  }
  s.sample_solution=sol;
}

// ---- write outputs ----
const byChapter={}; for(const s of selected) byChapter[s.chapter]=(byChapter[s.chapter]||0)+1;
const byBoardPieces={}; for(const s of selected){const k=`${s.board_size}x${s.board_size}-${s.piece_count}p`;byBoardPieces[k]=(byBoardPieces[k]||0)+1;}
const depthHist={}; for(const s of selected) depthHist[s.min]=(depthHist[s.min]||0)+1;
const report={
  created:'2026-09-15', rules_version:RULES, seed:20260915,
  delivered:selected.length, unique_pool:seenAll.size,
  boards:byBoardPieces, chapters:byChapter, minimum_moves_histogram:depthHist,
  minimum_moves_range:[Math.min(...selected.map(s=>s.min)),Math.max(...selected.map(s=>s.min))],
  state_cap:STATE_CAP,
  note:'Exact solver: solvable, unique up to symmetry, exact minimum moves. Intended difficulty and sequence require human testing. Any legal route reaching all targets wins.',
};
const data={...report, direction_encoding:{0:'right',1:'down',2:'left',3:'up'},
  coordinates:'zero-based x,y; origin top-left', pair_indices:'one-based in sample_solution', stages:selected};
fs.writeFileSync(path.join(ROOT,'stages-1000.json'),JSON.stringify(data,null,1)+'\n');
fs.writeFileSync(path.join(ROOT,'validation-report-1000.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,1));
