// Selected-pair movement. Directions: right, down, left, up.
// walls: optional Set of "x,y" strings marking impassable cells (a piece cannot step onto one).
// tiles: optional Map "x,y" -> kind. 0~3 = arrow tile (a piece that steps onto it faces that
//        direction), TILE_TURN (4) = spin tile (a piece that steps onto it turns 90° clockwise).
//        Tiles never block; only the selected pieces that actually moved are affected.
const VECTORS=[[1,0],[0,1],[-1,0],[0,-1]];
const TILE_TURN=4;
const clone=s=>s.map(p=>p.slice());
function applyTiles(s,out,pair,tiles){
  if(!tiles||!tiles.size)return out;
  for(const i of pair){
    const p=out[i];
    if(p[0]===s[i][0]&&p[1]===s[i][1])continue;
    const k=tiles.get(p[0]+','+p[1]);
    if(k!=null)p[2]=k===TILE_TURN?(p[2]+1)%4:k;
  }
  return out;
}
function outcome(s,pair,n,walls,tiles) {
  const t=clone(s),[a,b]=pair;[t[a][2],t[b][2]]=[t[b][2],t[a][2]];
  const proposed=t.map((p,i)=>{
    if(i!==a&&i!==b)return p.slice(0,2);
    const [dx,dy]=VECTORS[p[2]],x=p[0]+dx,y=p[1]+dy;
    const blocked=x<0||x>=n||y<0||y>=n||s.some(q=>q[0]===x&&q[1]===y)||(walls&&walls.has(x+','+y));
    return blocked?p.slice(0,2):[x,y];
  });
  return applyTiles(s,t.map((p,i)=>{
    const q=proposed[i],collision=proposed.filter(r=>r[0]===q[0]&&r[1]===q[1]).length>1;
    return [collision?p[0]:q[0],collision?p[1]:q[1],p[2]];
  }),pair,tiles);
}

module.exports={outcome,TILE_TURN};
