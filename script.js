/* Canvas & UI */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn  = document.getElementById("stopBtn");
const speedInp = document.getElementById("speed");
const speedVal = document.getElementById("speedVal");
const algoSel  = document.getElementById("algorithm");
const algoDesc = document.getElementById("algoDesc");
const logEl    = document.getElementById("log");

const DESCS = {
    bubble: "Bubble Sort repeatedly compares adjacent items and swaps them when out of order.",
    merge:  "Merge Sort splits the array, recursively sorts halves, then merges them back together.",
    bfs:    "BFS explores the grid level-by-level (waves) from the start until it reaches the goal.",
    dfs:    "DFS dives deep along one route, backtracking when it hits dead ends.",
    dijkstra:"Dijkstra expands nodes by increasing distance (g), guaranteeing shortest paths on uniform costs.",
    astar:  "A* uses f = g + h (Manhattan heuristic) to prioritize promising nodes toward the goal."
};

algoSel.addEventListener("change", () => setDesc(DESCS[algoSel.value]));
setDesc(DESCS[algoSel.value]);

function setDesc(text){
    algoDesc.textContent = text;
    clearLog();
}

speedVal.textContent = speedInp.value;
speedInp.addEventListener("input", () => {
    speedVal.textContent = speedInp.value;
});

function delayMs(){
    // 1..100 -> 190..10 ms (faster on the right)
    return Math.max(10, 200 - Number(speedInp.value) * 1.9 | 0);
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function log(msg){
    const li = document.createElement("li");
    li.textContent = msg;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
}
function clearLog(){ logEl.innerHTML = ""; }

/* Stop mechanism (cancellation token) */
let runSeq = 0; // increment to invalidate previous runs
function newRunToken(){ runSeq += 1; return runSeq; }
function aborted(myToken){ return myToken !== runSeq; }

/* Sorting Visuals (white background, crimson bars, black highlight) */
function drawBars(arr, a=-1, b=-1){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const w = canvas.width / arr.length;
    for (let i=0;i<arr.length;i++){
        ctx.fillStyle = (i===a || i===b) ? "#000000" : "#FF1B1C"; // black highlight, crimson normal
        const h = arr[i];
        ctx.fillRect(i*w+1, canvas.height - h, w-2, h);
    }
}

/* Bubble Sort */
async function runBubble(myToken){
    log("Bubble: start");
    const arr = Array.from({length:48}, () => Math.floor(Math.random()*360)+20);
    drawBars(arr);
    await sleep(300);
    for (let i=0;i<arr.length-1;i++){
        for (let j=0;j<arr.length-i-1;j++){
            if (aborted(myToken)) return log("Bubble: stopped");
            if (arr[j] > arr[j+1]) [arr[j],arr[j+1]]=[arr[j+1],arr[j]];
            drawBars(arr, j, j+1);
            await sleep(delayMs());
        }
    }
    drawBars(arr);
    log("Bubble: done");
}

/* Merge Sort */
async function runMerge(myToken){
    log("Merge: start");
    const arr = Array.from({length:48}, () => Math.floor(Math.random()*360)+20);
    drawBars(arr);
    await sleep(300);

    async function merge(l,m,r){
        const L = arr.slice(l,m+1);
        const R = arr.slice(m+1,r+1);
        let i=0,j=0,k=l;
        while(i<L.length && j<R.length){
            if (aborted(myToken)) return;
            arr[k++] = (L[i] <= R[j]) ? L[i++] : R[j++];
            drawBars(arr, k-1);
            await sleep(delayMs());
        }
        while(i<L.length){ if (aborted(myToken)) return; arr[k++]=L[i++]; }
        while(j<R.length){ if (aborted(myToken)) return; arr[k++]=R[j++]; }
    }
    async function sort(l,r){
        if (l>=r || aborted(myToken)) return;
        const m = (l+r)>>1;
        await sort(l,m); await sort(m+1,r);
        await merge(l,m,r);
    }
    await sort(0,arr.length-1);
    drawBars(arr);
    log("Merge: done");
}

/* Grid Utilities */
const ROWS = 18, COLS = 32;
function makeGrid(){
    const g = [];
    for (let r=0;r<ROWS;r++){
        const row=[];
        for (let c=0;c<COLS;c++){
            row.push({
                r, c,
                wall: Math.random() < 0.20 && !(r===0&&c===0) && !(r===ROWS-1&&c===COLS-1),
                // for pathfinding:
                g: Infinity, h: 0, f: Infinity,
                dist: Infinity,
                prev: null,
                visited: false,
                inOpen: false
            });
        }
        g.push(row);
    }
    return g;
}

function manhattan(a,b){ return Math.abs(a.r-b.r)+Math.abs(a.c-b.c); }
function neighbors(grid, node){
    const res=[];
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dr,dc] of dirs){
        const nr=node.r+dr, nc=node.c+dc;
        if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS) res.push(grid[nr][nc]);
    }
    return res;
}

/* Only white, black, crimson */
function drawGrid(grid, start, goal, current=null, openList=null){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cw = canvas.width / COLS;
    const ch = canvas.height / ROWS;

    for (let r=0;r<ROWS;r++){
        for (let c=0;c<COLS;c++){
            const n = grid[r][c];
            // base color
            if (n.wall) ctx.fillStyle = "#000000"; // black walls
            else if (n.visited) ctx.fillStyle = "#dc143c"; // crimson visited
            else ctx.fillStyle = "#ffffff"; // white unvisited
            ctx.fillRect(c*cw, r*ch, cw, ch);
        }
    }

    // draw open set as crimson outlines on white cells
    if (openList){
        ctx.strokeStyle = "#dc143c";
        ctx.lineWidth = 2;
        for (const n of openList){
            if (!n.wall && !n.visited){
                ctx.strokeRect(n.c*cw+2, n.r*ch+2, cw-4, ch-4);
            }
        }
    }

    // start/goal emphasized using thicker crimson border
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#dc143c";
    ctx.strokeRect(0+1, 0+1, cw-2, ch-2); // start at (0,0)
    ctx.strokeRect((COLS-1)*cw+1, (ROWS-1)*ch+1, cw-2, ch-2); // goal

    // current highlighted filled crimson + black X
    if (current){
        ctx.fillStyle = "#dc143c";
        ctx.fillRect(current.c*cw, current.r*ch, cw, ch);
        ctx.strokeStyle = "#000000";
        ctx.beginPath();
        ctx.moveTo(current.c*cw+4, current.r*ch+4);
        ctx.lineTo((current.c+1)*cw-4, (current.r+1)*ch-4);
        ctx.moveTo((current.c+1)*cw-4, current.r*ch+4);
        ctx.lineTo(current.c*cw+4, (current.r+1)*ch-4);
        ctx.stroke();
    }

    // grid lines (thin black)
    ctx.strokeStyle = "#00000022";
    ctx.lineWidth = 1;
    for(let r=0;r<ROWS;r++){
        ctx.beginPath(); ctx.moveTo(0, r*ch); ctx.lineTo(canvas.width, r*ch); ctx.stroke();
    }
    for(let c=0;c<COLS;c++){
        ctx.beginPath(); ctx.moveTo(c*cw, 0); ctx.lineTo(c*cw, canvas.height); ctx.stroke();
    }
}

async function drawFinalPath(grid, start, goal){
    const cw = canvas.width / COLS;
    const ch = canvas.height / ROWS;
    let path=[];
    for(let n=goal; n; n=n.prev) path.push(n);
    path.reverse();
    for (const n of path){
        ctx.fillStyle="#3BC14A";
        ctx.fillRect(n.c*cw, n.r*ch, cw, ch);
        await sleep(Math.max(10, delayMs()*0.6|0));
    }
}

/* BFS / DFS*/
async function runBFS(myToken){
    log("BFS: start");
    const grid = makeGrid();
    const start = grid[0][0], goal = grid[ROWS-1][COLS-1];
    const q = [start]; start.visited = true;
    while(q.length){
        if (aborted(myToken)) return log("BFS: stopped");
        const cur = q.shift();
        drawGrid(grid, start, goal, cur, q);
        await sleep(delayMs());
        if (cur===goal){ log("BFS: path found"); await drawFinalPath(grid,start,goal); return; }
        for (const nb of neighbors(grid,cur)){
            if (!nb.wall && !nb.visited){
                nb.visited = true; nb.prev = cur; q.push(nb);
            }
        }
    }
    log("BFS: no path");
}

async function runDFS(myToken){
    log("DFS: start");
    const grid = makeGrid();
    const start = grid[0][0], goal = grid[ROWS-1][COLS-1];
    const st = [start]; start.visited = true;
    while(st.length){
        if (aborted(myToken)) return log("DFS: stopped");
        const cur = st.pop();
        drawGrid(grid, start, goal, cur, st);
        await sleep(delayMs());
        if (cur===goal){ log("DFS: path found"); await drawFinalPath(grid,start,goal); return; }
        for (const nb of neighbors(grid,cur)){
            if (!nb.wall && !nb.visited){
                nb.visited = true; nb.prev = cur; st.push(nb);
            }
        }
    }
    log("DFS: no path");
}

/* Dijkstra  */
async function runDijkstra(myToken){
    log("Dijkstra: start");
    const grid = makeGrid();
    const start = grid[0][0], goal = grid[ROWS-1][COLS-1];

    const open = [];
    start.g = 0; start.inOpen = true; open.push(start);

    while(open.length){
        if (aborted(myToken)) return log("Dijkstra: stopped");
        // smallest g
        let idx = 0;
        for(let i=1;i<open.length;i++) if (open[i].g < open[idx].g) idx=i;
        const cur = open.splice(idx,1)[0];
        cur.inOpen = false; cur.visited = true;

        drawGrid(grid, start, goal, cur, open);
        await sleep(delayMs());

        if (cur === goal){ log("Dijkstra: path found"); await drawFinalPath(grid,start,goal); return; }

        for (const nb of neighbors(grid,cur)){
            if (nb.wall || nb.visited) continue;
            const tentative = cur.g + 1;
            if (tentative < nb.g){
                nb.g = tentative;
                nb.prev = cur;
                if (!nb.inOpen){ nb.inOpen = true; open.push(nb); }
            }
        }
    }
    log("Dijkstra: no path");
}

/* A* (proper f = g + h) */
async function runAStar(myToken){
    log("A*: start");
    const grid = makeGrid();
    const start = grid[0][0], goal = grid[ROWS-1][COLS-1];

    const open = [];
    start.g = 0;
    start.h = manhattan(start, goal);
    start.f = start.g + start.h;
    start.inOpen = true;
    open.push(start);

    while(open.length){
        if (aborted(myToken)) return log("A*: stopped");
        // choose lowest f; tie-break on lower h
        let idx = 0;
        for(let i=1;i<open.length;i++){
            if (open[i].f < open[idx].f || (open[i].f === open[idx].f && open[i].h < open[idx].h)) idx=i;
        }
        const cur = open.splice(idx,1)[0];
        cur.inOpen = false; cur.visited = true;

        drawGrid(grid, start, goal, cur, open);
        await sleep(delayMs());

        if (cur === goal){ log("A*: path found"); await drawFinalPath(grid,start,goal); return; }

        for (const nb of neighbors(grid, cur)){
            if (nb.wall || nb.visited) continue;

            const tentativeG = cur.g + 1;
            if (tentativeG < nb.g){
                nb.prev = cur;
                nb.g = tentativeG;
                nb.h = manhattan(nb, goal);
                nb.f = nb.g + nb.h;
                if (!nb.inOpen){ nb.inOpen = true; open.push(nb); }
            }
        }
    }
    log("A*: no path");
}


startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    const myToken = newRunToken();
    clearLog();
    setDesc(DESCS[algoSel.value]);

    // simple idle preview
    ctx.clearRect(0,0,canvas.width,canvas.height);

    try{
        if (algoSel.value === "bubble")      await runBubble(myToken);
        else if (algoSel.value === "merge")  await runMerge(myToken);
        else if (algoSel.value === "bfs")    await runBFS(myToken);
        else if (algoSel.value === "dfs")    await runDFS(myToken);
        else if (algoSel.value === "dijkstra") await runDijkstra(myToken);
        else if (algoSel.value === "astar")    await runAStar(myToken);
    } finally {
        // only re-enable if this is still the active run
        if (!aborted(myToken)) startBtn.disabled = false;
    }
});

stopBtn.addEventListener("click", () => {
    // stop current run
    newRunToken();
    startBtn.disabled = false;
    log("Stopped.");
});
