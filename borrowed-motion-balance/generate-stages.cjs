// Run with Node.js: node generate-stages.cjs
// Reproducible stage candidates. Solver metrics are NOT human difficulty ratings.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ROOT = __dirname;
const VECTORS = [[1,0],[0,1],[-1,0],[0,-1]];
const RULES = 'borrowed-motion-easy-v1';
let seed = 20260911;
function random() { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; }
function shuffle(a) { a=a.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
const clone = s=>s.map(p=>p.slice());
const key = s=>s.flat().join(',');
const poskey = s=>s.map(p=>p.slice(0,2).join(',')).join(';');
function pairsFor(n) { const out=[];for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)out.push([a,b]);return out; }
function outcome(s,pair,n) {
  const t=clone(s),[a,b]=pair;[t[a][2],t[b][2]]=[t[b][2],t[a][2]];
  const proposed=t.map((p,i)=>{
    if(i!==a&&i!==b)return p.slice(0,2);
    const [dx,dy]=VECTORS[p[2]],x=p[0]+dx,y=p[1]+dy;
    const blocked=x<0||x>=n||y<0||y>=n||s.some(q=>q[0]===x&&q[1]===y);
    return blocked?p.slice(0,2):[x,y];
  });
  return t.map((p,i)=>{
    const q=proposed[i],collision=proposed.filter(r=>r[0]===q[0]&&r[1]===q[1]).length>1;
    return [collision?p[0]:q[0],collision?p[1]:q[1],p[2]];
  });
}
function explore(start,n) {
  const pairs=pairsFor(start.length),states=[start],index=new Map([[key(start),0]]),distance=[0],ways=[1],parents=[null],edges=[],reverse=[[]],goals=new Map();
  for(let i=0;i<states.length;i++){
    const s=states[i],pk=poskey(s),d=distance[i];
    if(!goals.has(pk))goals.set(pk,{positions:s.map(p=>p.slice(0,2)),distance:d,ways:0,nodes:[],bestNode:i});
    const g=goals.get(pk);g.nodes.push(i);if(d===g.distance)g.ways+=ways[i];
    edges[i]=[];
    for(let a=0;a<pairs.length;a++){
      const t=outcome(s,pairs[a],n),k=key(t);let j=index.get(k);
      if(j===undefined){j=states.length;index.set(k,j);states.push(t);distance.push(d+1);ways.push(ways[i]);parents.push([i,a]);reverse.push([]);}
      else if(distance[j]===d+1)ways[j]+=ways[i];
      edges[i].push(j);reverse[j].push(i);
    }
  }
  return {start,n,pairs,states,distance,ways,parents,edges,reverse,goals};
}
function canonical(start,targets,n) {
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
function certify(graph,g) {
  const back=Array(graph.states.length).fill(-1),queue=g.nodes.slice();
  for(const i of queue)back[i]=0;
  for(let k=0;k<queue.length;k++)for(const p of graph.reverse[queue[k]])if(back[p]<0){back[p]=back[queue[k]]+1;queue.push(p);}
  const solution=[];let node=g.bestNode;
  while(node){const [p,a]=graph.parents[node];solution.unshift(graph.pairs[a].map(x=>x+1));node=p;}
  const useful=graph.edges[0].map((j,a)=>({j,a})).filter(({j})=>j!==0);
  const safe=useful.filter(({j})=>back[j]>=0),optimal=useful.filter(({j})=>back[j]===g.distance-1);
  let cursor=0,forced=0,blockedSteps=0,detourSteps=0;
  const manhattan=s=>s.reduce((sum,p,i)=>sum+Math.abs(p[0]-g.positions[i][0])+Math.abs(p[1]-g.positions[i][1]),0);
  for(const pair of solution){
    if(graph.edges[cursor].filter(j=>back[j]===back[cursor]-1).length===1)forced++;
    const a=graph.pairs.findIndex(p=>p[0]===pair[0]-1&&p[1]===pair[1]-1),next=graph.edges[cursor][a];
    if(pair.some(i=>graph.states[cursor][i-1][0]===graph.states[next][i-1][0]&&graph.states[cursor][i-1][1]===graph.states[next][i-1][1]))blockedSteps++;
    if(manhattan(graph.states[next])>=manhattan(graph.states[cursor]))detourSteps++;
    cursor=next;
  }
  return {board_size:graph.n,piece_count:graph.start.length,start:graph.start,targets:g.positions,metrics:{minimum_moves:g.distance,shortest_solution_count:g.ways,optimal_opening_choices:optimal.length,safe_opening_choices:safe.length,available_opening_choices:useful.length,unsafe_opening_choices:useful.length-safe.length,worst_safe_opening_extra_moves:Math.max(0,...safe.map(({j})=>1+back[j]-g.distance)),initially_arrived_pieces:graph.start.filter((p,i)=>p[0]===g.positions[i][0]&&p[1]===g.positions[i][1]).length,forced_steps_on_sample:forced,blocked_steps_on_sample:blockedSteps,nonprogress_steps_on_sample:detourSteps,reachable_state_count:graph.states.length},sample_solution:solution,validation:'EXHAUSTIVE_SOLVER_PASS',human_playtest:'NOT_YET_TESTED',canonical_key:canonical(graph.start,g.positions,graph.n)};
}
function randomStart(n,count) {
  const cells=shuffle(Array.from({length:n*n},(_,i)=>i));
  const dirs=shuffle([0,1,2,3]);
  return cells.slice(0,count).map((cell,i)=>[cell%n,Math.floor(cell/n),dirs[i]]);
}
const tutorialStart=[[0,1,1],[2,1,3]],knownStart=[[0,0,0],[2,0,1],[1,2,2]];
const requestedKnown=[{start:tutorialStart,targets:[[0,0],[2,2]]},{start:knownStart,targets:[[0,1],[1,0],[2,2]]},{start:knownStart,targets:[[1,1],[1,0],[2,2]]}];
const known=requestedKnown.map(l=>{const graph=explore(l.start,3);return certify(graph,graph.goals.get(l.targets.map(p=>p.join(',')).join(';')));});
assert.deepEqual(known.map(s=>[s.metrics.minimum_moves,s.metrics.shortest_solution_count]),[[1,1],[2,3],[3,3]]);
const pool=known.slice(),seen=new Set(pool.map(s=>s.canonical_key));
const graphStats=[];
for(const [n,count,runs] of [[3,2,18],[3,3,75],[4,3,30]]){
  for(let trial=0;trial<runs;trial++){
    const start=randomStart(n,count),graph=explore(start,n);graphStats.push(graph.states.length);
    const choices=shuffle(Array.from(graph.goals.values()).filter(g=>g.distance>=1&&g.distance<=7));
    const perDepth=new Map();
    for(const g of choices){
      if((perDepth.get(g.distance)||0)>=5)continue;
      if(count===2&&g.distance!==1)continue;
      if(count===3&&g.distance>1&&(g.ways<2||g.positions.filter((p,i)=>p[0]===start[i][0]&&p[1]===start[i][1]).length>1))continue;
      const ck=canonical(start,g.positions,n);if(seen.has(ck))continue;
      const c=certify(graph,g);
      if(count===3&&c.metrics.safe_opening_choices<2)continue;
      seen.add(ck);pool.push(c);perDepth.set(g.distance,(perDepth.get(g.distance)||0)+1);
    }
  }
  console.log(JSON.stringify({phase:'pool',board:n,pieces:count,candidates:pool.length}));
}
const selected=[],used=new Set(),startsUsed=new Map();
const rhythm=[0,0,1,0,-1,0,1,0,0,-1];
for(let i=1;i<=100;i++){
  let size=3,desired,pieces=3,chapter;
  if(i<=10){chapter='규칙 익히기';desired=[1,1,2,2,1,2,2,3,2,3][i-1];if(i<=2)pieces=2;}
  else if(i<=30){chapter='편안한 반복';desired=Math.max(2,3+rhythm[(i-11)%10]);}
  else if(i<=60){chapter='순서 계획';desired=Math.max(2,4+rhythm[(i-31)%10]);}
  else if(i<=80){chapter='넓은 보드 적응';size=4;desired=Math.max(3,4+rhythm[(i-61)%10]);}
  else {chapter='짧은 도전';size=4;desired=Math.max(3,5+rhythm[(i-81)%10]);}
  let pick=i===1?known[0]:i===3?known[1]:i===10?known[2]:null;
  if(!pick){
    const candidates=pool.filter(c=>!used.has(c.canonical_key)&&!known.some(k=>k.canonical_key===c.canonical_key)&&c.board_size===size&&c.piece_count===pieces&&c.metrics.minimum_moves===desired&&(i>10||c.metrics.nonprogress_steps_on_sample<=1));
    candidates.sort((a,b)=>{
      const score=c=>(startsUsed.get(size+'|'+key(c.start))||0)*40 + c.metrics.unsafe_opening_choices*20 + c.metrics.worst_safe_opening_extra_moves*2 + c.metrics.forced_steps_on_sample*2 + c.metrics.nonprogress_steps_on_sample*4 - Math.min(c.metrics.shortest_solution_count,8)*0.4 - c.metrics.safe_opening_choices;
      return score(a)-score(b)||a.canonical_key.localeCompare(b.canonical_key);
    });
    pick=candidates[0];
  }
  assert(pick,'Missing candidate at stage '+i+' size '+size+' depth '+desired);
  assert(!used.has(pick.canonical_key),'Duplicate stage');
  used.add(pick.canonical_key);const sk=size+'|'+key(pick.start);startsUsed.set(sk,(startsUsed.get(sk)||0)+1);
  const previous=selected[selected.length-1];
  const role=i<=2?'tutorial':previous&&desired<previous.metrics.minimum_moves?'recovery':previous&&desired>previous.metrics.minimum_moves?'stretch':'practice';
  selected.push({...pick,stage_id:'BM-'+String(i).padStart(3,'0'),sequence:i,chapter,intended_role:role,content_version:1});
}
// Validate every delivered sample path. No goal-reaching move can precede its stated minimum.
for(const s of selected){
  let state=clone(s.start);const visited=new Set([key(state)]);
  for(const [index,pair] of s.sample_solution.entries()){
    state=outcome(state,pair.map(x=>x-1),s.board_size);
    assert(new Set(state.map(p=>p.slice(0,2).join(','))).size===state.length,'Collision');
    assert(!visited.has(key(state)),'Cycle in shortest path');visited.add(key(state));
    const goal=state.every((p,i)=>p[0]===s.targets[i][0]&&p[1]===s.targets[i][1]);
    assert.equal(goal,index===s.metrics.minimum_moves-1,'Incorrect goal timing');
  }
}
const report={created:'2026-09-11',rules_version:RULES,seed:20260911,candidate_pool:pool.length,delivered:100,solvable:100,unique_up_to_rotation_reflection_and_piece_relabeling:used.size,preserved_examples:known.map(s=>({minimum_moves:s.metrics.minimum_moves,shortest_solutions:s.metrics.shortest_solution_count})),minimum_moves_range:[Math.min(...selected.map(s=>s.metrics.minimum_moves)),Math.max(...selected.map(s=>s.metrics.minimum_moves))],multiple_shortest_solutions:selected.filter(s=>s.metrics.shortest_solution_count>=2).length,graph_runs:graphStats.length,max_reachable_states:Math.max(...graphStats),retention_evidence:'NO_PLAYER_COHORT_DATA',note:'Exact solver metrics. Intended difficulty and sequence require human testing. Any legal route reaching all targets wins.'};
const data={...report,direction_encoding:{0:'right',1:'down',2:'left',3:'up'},coordinates:'zero-based x,y; origin top-left',pair_indices:'one-based in sample_solution',stages:selected};
fs.writeFileSync(path.join(ROOT,'stages-100.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'validation-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
module.exports={outcome,explore,canonical,certify};
