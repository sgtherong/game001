// Selected-pair movement. Directions: right, down, left, up.
const VECTORS=[[1,0],[0,1],[-1,0],[0,-1]];
const clone=s=>s.map(p=>p.slice());
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

module.exports={outcome};
