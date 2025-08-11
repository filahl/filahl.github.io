/* game.js - hlavní hra */
(() => {
  // DOM
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const slotCvs = [document.getElementById('slotcv0'), document.getElementById('slotcv1'), document.getElementById('slotcv2')];
  slotCvs.forEach(cv => { cv.width = 160; cv.height = 96; });

  // State
  let pixelSize = settings.pixelSize || 6;
  let gravity = settings.gravity || 0.12;

  // initial colors: red, blue, green
  const ALL_COLORS = ['#d84b4b','#4b9ce8','#4bcf4b','#ffd74b','#c56be8','#2ee5d0'];
  let availableColors = [];
  let unlocks = [
    { score: 100, color: ALL_COLORS[3] },
    { score: 250, color: ALL_COLORS[4] },
    { score: 600, color: ALL_COLORS[5] }
  ];

  // shapes (templates as arrays of [x,y])
  const shapeTemplates = [
    [[0,0],[1,0],[2,0],[1,1]], // T-ish (compact)
    [[0,0],[1,0],[0,1],[1,1]], // O
    [[0,0],[0,1],[0,2],[1,2]], // L
    [[1,0],[1,1],[1,2],[0,2]], // mirrored L
    [[0,1],[1,1],[1,0],[2,0]], // S-like
    [[0,0],[1,0],[1,1],[2,1]]  // Z-like
  ];

  // grid recalculated from canvas size and pixelSize
  let COLS = Math.floor(canvas.width / pixelSize);
  let ROWS = Math.floor(canvas.height / pixelSize);
  let grid = []; // grid[y][x] -> { color: '#...' } or null

  // particle system (float positions) and falling rigid clusters
  let particles = []; // {x:float,y:float,vx,vy,color,settled}
  let clusters = [];  // rigid clusters while falling: {cells:[{x,y}], px,py (float), vx,vy, color, w,h}

  // inventory slots
  let slots = [null,null,null];

  // gameplay
  let score = parseInt(localStorage.getItem('pb_score')||'0');
  let best = parseInt(localStorage.getItem('pb_best')||'0');

  // drag state
  let dragging = null; // {slotIndex, pointerX, pointerY, template, color}
  let dragGhost = null;

  // pause
  let paused = false;

  // helper: initialize grid
  function initGrid(){
    COLS = Math.floor(canvas.width / pixelSize);
    ROWS = Math.floor(canvas.height / pixelSize);
    grid = Array.from({length: ROWS}, ()=>Array(COLS).fill(null));
  }
  initGrid();

  // update available colors based on settings.initialColors and score unlocks
  function updateAvailableColors(){
    availableColors = [];
    if(settings.initialColors.red) availableColors.push(ALL_COLORS[0]);
    if(settings.initialColors.blue) availableColors.push(ALL_COLORS[1]);
    if(settings.initialColors.green) availableColors.push(ALL_COLORS[2]);
    // unlocks by score
    unlocks.forEach(u => { if(score >= u.score && !availableColors.includes(u.color)) availableColors.push(u.color); });
    if(availableColors.length===0) availableColors.push(ALL_COLORS[0]); // fallback
  }
  updateAvailableColors();

  // utility: make random blob (normalized to non-negative coords)
  function makeBlob(size){
    const set = new Set();
    set.add('0,0'); const arr = [[0,0]];
    while(set.size < size){
      const b = arr[Math.floor(Math.random()*arr.length)];
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      const d = dirs[Math.floor(Math.random()*4)];
      const nx = b[0]+d[0], ny = b[1]+d[1];
      const key = nx+','+ny;
      if(!set.has(key)){ set.add(key); arr.push([nx,ny]); }
      if(arr.length > 3000) break;
    }
    const pts = Array.from(set).map(s => s.split(',').map(Number));
    const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    return pts.map(([x,y])=>[x-minx, y-miny]);
  }

  // slot preview drawing
  function drawSlotPreviews(){
    for(let i=0;i<3;i++){
      const cv = slotCvs[i], cctx = cv.getContext('2d');
      cctx.clearRect(0,0,cv.width,cv.height);
      cctx.fillStyle = '#0b1b1b';
      cctx.fillRect(0,0,cv.width,cv.height);
      const tpl = slots[i];
      if(!tpl) continue;
      const col = tpl.color;
      // compute bounds
      const xs = tpl.template.map(p=>p[0]), ys = tpl.template.map(p=>p[1]);
      const w = Math.max(...xs)-Math.min(...xs)+1;
      const h = Math.max(...ys)-Math.min(...ys)+1;
      const cell = Math.max(3, Math.floor(Math.min(cv.width/w, cv.height/h) * 0.9));
      const ox = Math.floor((cv.width - w*cell)/2);
      const oy = Math.floor((cv.height - h*cell)/2);
      cctx.fillStyle = col;
      for(const [x,y] of tpl.template){
        cctx.fillRect(ox + x*cell, oy + y*cell, Math.max(1,cell-1), Math.max(1,cell-1));
      }
    }
  }

  // refill slots randomly (random shape and random available color)
  function refillSlots(){
    updateAvailableColors();
    for(let i=0;i<3;i++){
      const tpl = makeBlob(12 + Math.floor(Math.random()*12)); // variable size
      const color = availableColors[Math.floor(Math.random()*availableColors.length)];
      slots[i] = { template: tpl, color };
    }
    drawSlotPreviews();
  }
  refillSlots();

  // convert pointer client coords -> grid float coords
  function pointerToGrid(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left, cy = clientY - rect.top;
    const gx = (cx / rect.width) * COLS;
    const gy = (cy / rect.height) * ROWS;
    return { gx, gy, canvasX: cx, canvasY: cy };
  }

  // spawn cluster rigid body at px,py (cells coords floats)
  function spawnCluster(template, color, px, py){
    const xs = template.map(p=>p[0]), ys = template.map(p=>p[1]);
    const w = Math.max(...xs)-Math.min(...xs)+1, h = Math.max(...ys)-Math.min(...ys)+1;
    const cluster = { cells: template.map(([x,y])=>({x,y})), px, py, vx:0, vy:0, color, w, h };
    clusters.push(cluster);
  }

  // collision test for cluster at pos (px,py)
  function clusterCollidesAt(cluster, px, py){
    for(const c of cluster.cells){
      const gx = Math.floor(px + c.x);
      const gy = Math.floor(py + c.y);
      if(gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
      if(grid[gy][gx]) return true;
    }
    return false;
  }

  // disintegrate cluster idx into particles
  function disintegrateClusterIndex(i){
    const cl = clusters[i];
    if(!cl) return;
    for(const cell of cl.cells){
      const x = cl.px + cell.x;
      const y = cl.py + cell.y;
      particles.push({
        x: x + (Math.random()-0.5)*0.4,
        y: y + (Math.random()-0.5)*0.4,
        vx: (Math.random()-0.5)*0.6 + cl.vx*0.2,
        vy: (Math.random()-0.5)*0.3 + cl.vy*0.2,
        color: cl.color,
        settled: false
      });
    }
    clusters.splice(i,1);
  }

  // place particle into grid cell if free
  function placeParticleToGrid(p, row, col){
    if(row<0||row>=ROWS||col<0||col>=COLS) return false;
    if(grid[row][col]) return false;
    grid[row][col] = { color: p.color };
    p.settled = true;
    return true;
  }

  // try place near (tx,ty)
  function tryPlaceNearby(p, tx, ty){
    for(let dy=0; dy<=2; dy++){
      for(let dx=-2; dx<=2; dx++){
        const nx = tx+dx, ny = ty+dy;
        if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS && !grid[ny][nx]){
          return placeParticleToGrid(p, ny, nx);
        }
      }
    }
    return false;
  }

  // particle physics step (float)
  function stepParticles(){
    // shuffle for nicer packing
    for(let i=particles.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [particles[i], particles[j]] = [particles[j], particles[i]];
    }
    for(const p of particles){
      if(p.settled) continue;
      p.vy += gravity;
      p.vx *= 0.995;
      p.vy = Math.min(p.vy, 8);
      p.x += p.vx;
      p.y += p.vy;
      // bounds clamp
      p.x = Math.max(0, Math.min(COLS-1, p.x));
      p.y = Math.max(0, Math.min(ROWS-1, p.y));
      const belowY = Math.floor(p.y + 0.5) + 1;
      const gx = Math.round(p.x);
      if(belowY >= ROWS){
        placeParticleToGrid(p, ROWS-1, gx);
        continue;
      }
      const belowOccupied = grid[belowY] && grid[belowY][gx];
      if(!belowOccupied) continue;
      // try slide
      if(Math.random() < 0.65){
        const dirs = p.vx>0 ? [1,-1] : [-1,1];
        let slid=false;
        for(const d of dirs){
          const nx = Math.round(p.x + d), ny = belowY;
          if(nx>=0 && nx<COLS && ny<ROWS && !grid[ny][nx]){
            p.x = nx + (Math.random()-0.5)*0.3;
            p.y = ny - 0.02;
            p.vx *= 0.2; p.vy = 0;
            slid=true; break;
          }
        }
        if(slid) continue;
      }
      // attempt settle
      const frac = Math.abs(p.y - Math.round(p.y));
      if(frac < 0.45 || p.vy < 0.05){
        const tx = Math.round(p.x), ty = Math.round(p.y);
        if(tryPlaceNearby(p, tx, ty)) continue;
        p.y -= 0.12; p.vy = 0;
      }
    }
    particles = particles.filter(p => !p.settled);
  }

  // small cellular relax pass to nudge grid cells into natural piles
  function relaxGridPass(){
    for(let y=ROWS-2;y>=0;y--){
      for(let x=0;x<COLS;x++){
        if(grid[y][x] && !grid[y+1][x]){
          grid[y+1][x] = grid[y][x]; grid[y][x] = null;
        } else if(grid[y][x]){
          const leftFree = x>0 && !grid[y+1][x-1];
          const rightFree = x<COLS-1 && !grid[y+1][x+1];
          if((leftFree||rightFree) && Math.random()<0.5){
            if(leftFree && rightFree){
              if(Math.random()<0.5){ grid[y+1][x-1] = grid[y][x]; grid[y][x]=null; }
              else { grid[y+1][x+1] = grid[y][x]; grid[y][x]=null; }
            } else if(leftFree){ grid[y+1][x-1] = grid[y][x]; grid[y][x]=null; }
            else if(rightFree){ grid[y+1][x+1] = grid[y][x]; grid[y][x]=null; }
          }
        }
      }
    }
  }

  // check components bridging left->right or top->bottom
  function findAndClearBridges(){
    const vis = Array.from({length:ROWS}, ()=>Array(COLS).fill(false));
    let totalCleared = 0;
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        if(vis[y][x] || !grid[y][x]) continue;
        const color = grid[y][x].color;
        const stack = [[x,y]]; vis[y][x]=true; const comp=[];
        let touchesLeft=false, touchesRight=false, touchesTop=false, touchesBottom=false;
        while(stack.length){
          const [cx,cy] = stack.pop(); comp.push([cx,cy]);
          if(cx===0) touchesLeft=true;
          if(cx===COLS-1) touchesRight=true;
          if(cy===0) touchesTop=true;
          if(cy===ROWS-1) touchesBottom=true;
          const nbrs=[[1,0],[-1,0],[0,1],[0,-1]];
          for(const [dx,dy] of nbrs){
            const nx=cx+dx, ny=cy+dy;
            if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS && !vis[ny][nx] && grid[ny][nx] && grid[ny][nx].color===color){
              vis[ny][nx]=true; stack.push([nx,ny]);
            }
          }
        }
        if((touchesLeft && touchesRight) || (touchesTop && touchesBottom)){
          for(const [cx,cy] of comp) grid[cy][cx]=null;
          totalCleared += comp.length;
        }
      }
    }
    if(totalCleared>0) {
      score += Math.floor(totalCleared/4);
      updateAvailableColors();
      if(score > best){ best = score; localStorage.setItem('pb_best', String(best)); }
      localStorage.setItem('pb_score', String(score));
    }
  }

  // cluster update: rigid body integration and disintegration on collision
  function updateClusters(){
    for(let i=clusters.length-1;i>=0;i--){
      const c = clusters[i];
      c.vy += gravity;
      c.vx *= 0.995;
      c.vy = Math.min(c.vy, 8);
      const steps = 2;
      const dx = c.vx/steps, dy = c.vy/steps;
      let collided = false;
      for(let s=0;s<steps;s++){
        const nx = c.px + dx;
        const ny = c.py + dy;
        if(clusterCollidesAt(c, nx, ny)){
          collided = true; break;
        } else {
          c.px = nx; c.py = ny;
        }
      }
      if(collided) disintegrateClusterIndex(i);
      else if(c.py + c.h >= ROWS - 0.001) disintegrateClusterIndex(i);
    }
  }

  // rendering
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // compute cell size (scale)
    const cellW = canvas.width / COLS;
    const cellH = canvas.height / ROWS;
    const cs = Math.min(cellW, cellH);

    // background
    ctx.fillStyle = '#070707'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // grid
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const cell = grid[y][x];
        if(cell){
          ctx.fillStyle = cell.color;
          ctx.fillRect(Math.floor(x*cs), Math.floor(y*cs), Math.ceil(cs), Math.ceil(cs));
          ctx.fillStyle = shade(cell.color, 0.06);
          ctx.fillRect(Math.floor(x*cs)+1, Math.floor(y*cs)+1, Math.max(0,Math.ceil(cs)-2), Math.max(0,Math.ceil(cs)-2));
        }
      }
    }

    // particles
    for(const p of particles){
      if(p.settled) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x*cs), Math.floor(p.y*cs), Math.max(1,Math.ceil(cs)), Math.max(1,Math.ceil(cs)));
    }

    // clusters
    for(const c of clusters){
      for(const cell of c.cells){
        const wx = (c.px + cell.x) * cs;
        const wy = (c.py + cell.y) * cs;
        ctx.fillStyle = c.color;
        ctx.fillRect(Math.floor(wx), Math.floor(wy), Math.max(1,Math.ceil(cs)), Math.max(1,Math.ceil(cs)));
        ctx.fillStyle = shade(c.color, 0.06);
        ctx.fillRect(Math.floor(wx)+1, Math.floor(wy)+1, Math.max(0,Math.ceil(cs)-2), Math.max(0,Math.ceil(cs)-2));
      }
    }

    // drag ghost (follow pointer)
    if(dragGhost){
      ctx.globalAlpha = 0.95;
      const gx = dragGhost.gx, gy = dragGhost.gy;
      for(const [ox,oy] of dragGhost.template){
        const wx = (gx + ox) * cs;
        const wy = (gy + oy) * cs;
        ctx.fillStyle = dragGhost.color;
        ctx.fillRect(Math.floor(wx), Math.floor(wy), Math.max(1,Math.ceil(cs)), Math.max(1,Math.ceil(cs)));
      }
      ctx.globalAlpha = 1;
    }

    // ui: score
    document.getElementById('score').textContent = score;
    document.getElementById('best').textContent = best;
  }

  function shade(hex, amt){
    const c = hex.replace('#',''); const num = parseInt(c,16);
    let r = num>>16, g=(num>>8)&255, b=num&255;
    r = Math.min(255, Math.max(0, Math.floor(r + 255*amt)));
    g = Math.min(255, Math.max(0, Math.floor(g + 255*amt)));
    b = Math.min(255, Math.max(0, Math.floor(b + 255*amt)));
    return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
  }

  // main loop
  let last = performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    if(paused){ last = now; return; }
    const dt = Math.min(40, now - last) / 16.666;
    last = now;

    // update
    updateClusters();
    // particle steps multiple times for stability
    for(let i=0;i<Math.max(1,Math.floor(2*dt));i++) stepParticles();
    for(let i=0;i<2;i++) relaxGridPass();
    findAndClearBridges();

    // draw
    draw();
  }
  requestAnimationFrame(loop);

  // Drag & Drop handlers (mouse + touch)
  function startDragFromSlot(slotIndex, clientX, clientY){
    if(!slots[slotIndex]) return;
    const tpl = slots[slotIndex];
    dragging = { slotIndex, template: tpl.template, color: tpl.color };
    const p = pointerToGrid(clientX, clientY);
    dragGhost = { template: tpl.template, color: tpl.color, gx: Math.floor(p.gx - getTemplateWidth(tpl.template)/2), gy: Math.floor(p.gy - getTemplateHeight(tpl.template)/2) };
    // highlight
  }

  function moveDrag(clientX, clientY){
    if(!dragGhost) return;
    const p = pointerToGrid(clientX, clientY);
    dragGhost.gx = p.gx - Math.floor(getTemplateWidth(dragGhost.template)/2);
    dragGhost.gy = p.gy - Math.floor(getTemplateHeight(dragGhost.template)/2);
  }

  function endDrag(clientX, clientY){
    if(!dragGhost || !dragging) { dragGhost=null; dragging=null; return; }
    const p = pointerToGrid(clientX, clientY);
    const rect = canvas.getBoundingClientRect();
    const inside = (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom);
    if(inside){
      const spawnX = Math.max(0, Math.min(COLS - getTemplateWidth(dragGhost.template), Math.floor(dragGhost.gx)));
      const spawnY = Math.max(0, Math.min(ROWS - getTemplateHeight(dragGhost.template), Math.floor(dragGhost.gy)));
      spawnCluster(dragGhost.template, dragGhost.color, spawnX, spawnY);
      // consume slot and refill with random new
      const si = dragging.slotIndex;
      slots[si] = { template: makeBlob(10 + Math.floor(Math.random()*14)), color: availableColors[Math.floor(Math.random()*availableColors.length)] };
      drawSlotPreviews();
    }
    dragging = null; dragGhost = null;
  }

  // slot DOM binding (mouse/touch)
  for(let i=0;i<3;i++){
    const el = document.getElementById('slot'+i);
    el.addEventListener('mousedown', (ev)=>{ ev.preventDefault(); startDragFromSlot(i, ev.clientX, ev.clientY); });
    el.addEventListener('touchstart', (ev)=>{ ev.preventDefault(); const t = ev.touches[0]; startDragFromSlot(i, t.clientX, t.clientY); }, {passive:false});
  }
  // global pointer move/up attached to window
  window.addEventListener('mousemove', (ev)=>{ if(dragging) moveDrag(ev.clientX, ev.clientY); });
  window.addEventListener('mouseup', (ev)=>{ if(dragging) endDrag(ev.clientX, ev.clientY); });
  window.addEventListener('touchmove', (ev)=>{ if(dragging){ const t=ev.touches[0]; moveDrag(t.clientX, t.clientY); ev.preventDefault(); } }, {passive:false});
  window.addEventListener('touchend', (ev)=>{ if(dragging){ const t = (ev.changedTouches && ev.changedTouches[0]); if(t) endDrag(t.clientX, t.clientY); } });

  // canvas quick spawn when clicking canvas area (if not dragging) - drop selected slot in center-top
  canvas.addEventListener('dblclick', (ev)=>{
    const si = 0; // quick spawn slot 0 on doubleclick
    if(slots[si]) spawnCluster(slots[si].template, slots[si].color, Math.floor((COLS-getTemplateWidth(slots[si].template))/2), 2);
    slots[si] = { template: makeBlob(10+Math.floor(Math.random()*14)), color: availableColors[Math.floor(Math.random()*availableColors.length)] };
    drawSlotPreviews();
  });

  // keyboard controls
  window.addEventListener('keydown', (e)=>{
    if(e.key==='p' || e.key==='P'){ paused = !paused; }
    else if(e.key==='r' || e.key==='R'){ resetAll(); }
    else if(e.key===' '){ // hard-drop first cluster: disintegrate it now
      if(clusters.length>0){ disintegrateClusterIndex(0); }
    } else if(e.key==='ArrowLeft'){ if(clusters.length>0){ const c=clusters[0]; if(!clusterCollidesAt(c, c.px-1, c.py)) c.px -=1; } }
    else if(e.key==='ArrowRight'){ if(clusters.length>0){ const c=clusters[0]; if(!clusterCollidesAt(c, c.px+1, c.py)) c.px +=1; } }
    else if(e.key==='ArrowUp'){ if(clusters.length>0) rotateCluster(clusters[0]); }
  });

  function rotateCluster(c){
    const xs = c.cells.map(p=>p.x), ys=c.cells.map(p=>p.y);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const norm = c.cells.map(p=>({x:p.x-minx,y:p.y-miny}));
    const w = Math.max(...norm.map(p=>p.x))+1;
    const rotated = norm.map(p=>({x:p.y,y:(w-1-p.x)}));
    const newCells = rotated.map(p=>({x:p.x,y:p.y}));
    const test = {cells:newCells, px:c.px, py:c.py, w: Math.max(...newCells.map(c=>c.x))+1, h: Math.max(...newCells.map(c=>c.y))+1};
    const kicks = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-2,0],[2,0]];
    for(const [kx,ky] of kicks){
      if(!clusterCollidesAt(test, test.px + kx, test.py + ky)){
        c.cells = newCells; c.px += kx; c.py += ky; return;
      }
    }
  }

  // helper dims
  function getTemplateWidth(tpl){ return Math.max(...tpl.map(p=>p[0])) - Math.min(...tpl.map(p=>p[0])) + 1; }
  function getTemplateHeight(tpl){ return Math.max(...tpl.map(p=>p[1])) - Math.min(...tpl.map(p=>p[1])) + 1; }

  // reset everything (keeping score)
  function resetAll(){
    particles = []; clusters = []; initGrid(); refillSlots(); score = 0; localStorage.setItem('pb_score', '0');
  }

  // listen for settings change
  window.addEventListener('settingsChanged', (ev) => {
    const s = ev.detail;
    pixelSize = s.pixelSize || pixelSize;
    gravity = s.gravity || gravity;
    // reinit grid to new pixel size
    initGrid();
    // update available colors based on new initial choices
    settings.initialColors = s.initialColors;
    updateAvailableColors();
    refillSlots();
  });

  // initial UI states
  document.getElementById('score').textContent = score;
  document.getElementById('best').textContent = best;

  // initial refill
  refillSlots();

  // small helper to save score periodically
  setInterval(()=>{ localStorage.setItem('pb_score', String(score)); }, 3000);

  // Export apply functions for debugging
  window._pixelBlast = { resetAll, refillSlots, spawnCluster, grid };

})();
