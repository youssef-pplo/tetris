// --- Config & Constants ---
const CONFIG = {
    popSize: 50,
    mutationRate: 0.1,
    elitismCount: 2,
    speedMultiplier: 1,
    graphics: 'HIGH',
    cols: 10,
    rows: 20,
    blockSize: 30 
};

const SHAPES = [
    [], // empty placeholder
    [[1, 1, 1, 1]], // I
    [[1, 1, 1], [0, 1, 0]], // T
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]], // J
    [[1, 1, 0], [0, 1, 1]], // Z
    [[0, 1, 1], [1, 1, 0]], // S
    [[1, 1], [1, 1]]        // O
];

const COLORS = [
    null,
    '#00f0f0', // I - Cyan
    '#a000f0', // T - Purple
    '#f0a000', // L - Orange
    '#0000f0', // J - Blue
    '#f00000', // Z - Red
    '#00f000', // S - Green
    '#f0f000'  // O - Yellow
];

// --- Audio System ---
const AudioSys = {
    ctx: null,
    init: function() {
        try { 
            window.AudioContext = window.AudioContext || window.webkitAudioContext; 
            this.ctx = new AudioContext(); 
        } catch (e) {
            console.warn('Audio context not available:', e);
        }
    },
    playTone: function(freq, type, duration, vol=0.1) {
        if (!this.ctx || game.mode === 'ai') return; 
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    move: function() { this.playTone(200, 'triangle', 0.05, 0.05); },
    rotate: function() { this.playTone(300, 'sine', 0.1, 0.05); },
    drop: function() { this.playTone(100, 'square', 0.1, 0.1); },
    clear: function() { 
        this.playTone(600, 'sine', 0.1, 0.1); 
        setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 50); 
    },
    die: function() { this.playTone(100, 'sawtooth', 0.5, 0.2); }
};

// --- Neural Network (Linear Model for Tetris) ---
class Genome {
    constructor() {
        // Weights for: [Aggregate Height, Complete Lines, Holes, Bumpiness]
        this.genes = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    }

    clone() {
        let g = new Genome();
        g.genes = [...this.genes];
        return g;
    }

    mutate(rate) {
        for (let i = 0; i < this.genes.length; i++) {
            if (Math.random() < rate) {
                this.genes[i] += (Math.random() * 0.4 - 0.2);
            }
        }
    }
}

// --- Game Logic ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Refs
const ui = {
    start: document.getElementById('start-screen'),
    over: document.getElementById('game-over-screen'),
    hud: document.getElementById('hud'),
    dashboard: document.getElementById('ai-dashboard'),
    settings: document.getElementById('settings-modal'),
    aiConfig: document.getElementById('ai-config-modal'),
    finalScore: document.getElementById('final-score'),
    finalLines: document.getElementById('final-lines')
};

function resize() {
    let h = window.innerHeight - 40;
    CONFIG.blockSize = Math.floor(h / CONFIG.rows);
    let w = CONFIG.blockSize * CONFIG.cols;
    
    if(window.innerWidth < w + 20) {
        w = window.innerWidth - 20;
        CONFIG.blockSize = Math.floor(w / CONFIG.cols);
        h = CONFIG.blockSize * CONFIG.rows;
    }
    
    // Ensure minimum block size
    if(CONFIG.blockSize < 10) CONFIG.blockSize = 10;
    
    canvas.width = CONFIG.blockSize * CONFIG.cols;
    canvas.height = CONFIG.blockSize * CONFIG.rows;
    
    if('ontouchstart' in window) {
        document.getElementById('mobile-controls').style.display = 'flex';
    } else {
        document.getElementById('mobile-controls').style.display = 'none';
    }
}

window.addEventListener('resize', resize);
resize();

class TetrisGame {
    constructor(genome = null) {
        this.grid = Array(CONFIG.rows).fill().map(() => Array(CONFIG.cols).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dead = false;
        this.currentPiece = this.spawnPiece();
        this.nextPiece = this.spawnPiece(); 
        
        // AI
        this.genome = genome ? genome.clone() : (game.mode === 'ai' ? new Genome() : null);
        this.fitness = 0;
        this.movesTaken = 0;
    }

    spawnPiece() {
        const id = Math.floor(Math.random() * 7) + 1;
        const shape = SHAPES[id];
        return {
            id: id,
            shape: shape,
            x: Math.floor(CONFIG.cols / 2) - Math.floor(shape[0].length / 2),
            y: 0
        };
    }

    // --- Core Logic ---
    isValid(shape, offsetX, offsetY) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    let newX = offsetX + x;
                    let newY = offsetY + y;
                    if (newX < 0 || newX >= CONFIG.cols || newY >= CONFIG.rows) return false;
                    if (newY >= 0 && this.grid[newY][newX]) return false;
                }
            }
        }
        return true;
    }

    rotate(shape) {
        const N = shape.length;
        const M = shape[0].length;
        let newShape = Array(M).fill().map(() => Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < M; x++) {
                newShape[x][N - 1 - y] = shape[y][x];
            }
        }
        return newShape;
    }

    placePiece() {
        const shape = this.currentPiece.shape;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    if(this.currentPiece.y + y < 0) {
                        this.die(); 
                        return;
                    }
                    this.grid[this.currentPiece.y + y][this.currentPiece.x + x] = this.currentPiece.id;
                }
            }
        }

        this.clearLines();
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.spawnPiece();
        
        if (!this.isValid(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.die();
        }
    }

    clearLines() {
        let linesCleared = 0;
        for (let y = CONFIG.rows - 1; y >= 0; y--) {
            if (this.grid[y].every(val => val !== 0)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(CONFIG.cols).fill(0));
                linesCleared++;
                y++; 
            }
        }

        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += [0, 40, 100, 300, 1200][linesCleared] * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            if(game.mode === 'normal') AudioSys.clear();
        }
    }

    die() {
        this.dead = true;
        if(game.mode === 'normal') AudioSys.die();
        this.fitness = this.score + (this.lines * 1000) + this.movesTaken;
    }

    // --- AI Decision Making ---
    aiMove() {
        if(this.dead || !this.genome) return;

        let bestScore = -Infinity;
        let bestMove = null;
        let shape = this.currentPiece.shape;

        for(let r = 0; r < 4; r++) {
            for(let x = -2; x < CONFIG.cols; x++) {
                if(this.isValid(shape, x, this.currentPiece.y)) {
                    let y = this.currentPiece.y;
                    while(this.isValid(shape, x, y + 1)) {
                        y++;
                    }
                    
                    let score = this.evaluateState(this.grid, shape, x, y);
                    if(score > bestScore) {
                        bestScore = score;
                        bestMove = {shape: shape, x: x, y: y};
                    }
                }
            }
            shape = this.rotate(shape);
        }

        if(bestMove) {
            this.currentPiece.shape = bestMove.shape;
            this.currentPiece.x = bestMove.x;
            this.currentPiece.y = bestMove.y;
            this.placePiece();
            this.movesTaken++;
        } else {
            this.die(); 
        }
    }

    evaluateState(grid, shape, px, py) {
        let heights = Array(CONFIG.cols).fill(0);
        let aggregateHeight = 0;
        let holes = 0;
        let lines = 0;
        let bumpiness = 0;
        let tempGrid = grid.map(row => [...row]);
        
        for(let y=0; y<shape.length; y++) {
            for(let x=0; x<shape[y].length; x++) {
                if(shape[y][x] && py+y >= 0 && py+y < CONFIG.rows && px+x >= 0 && px+x < CONFIG.cols) {
                    tempGrid[py+y][px+x] = 1; 
                }
            }
        }

        for(let c=0; c<CONFIG.cols; c++) {
            let colHeight = 0;
            let holeFound = false;
            for(let r=0; r<CONFIG.rows; r++) {
                if(tempGrid[r][c] !== 0) {
                    if(colHeight === 0) colHeight = CONFIG.rows - r;
                    holeFound = true; 
                } else if (holeFound) {
                    holes++; 
                }
            }
            heights[c] = colHeight;
            aggregateHeight += colHeight;
        }

        for(let c=0; c<CONFIG.cols-1; c++) {
            bumpiness += Math.abs(heights[c] - heights[c+1]);
        }

        for(let r=0; r<CONFIG.rows; r++) {
            if(tempGrid[r].every(v => v !== 0)) lines++;
        }

        let w = this.genome.genes;
        let score = (w[0] * aggregateHeight) + 
                    (w[1] * lines) + 
                    (w[2] * holes) + 
                    (w[3] * bumpiness);

        return score;
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let y = 0; y < CONFIG.rows; y++) {
            for (let x = 0; x < CONFIG.cols; x++) {
                if (this.grid[y][x]) {
                    this.drawBlock(x, y, COLORS[this.grid[y][x]]);
                }
            }
        }

        if(game.mode === 'normal' && !this.dead) {
            let ghostY = this.currentPiece.y;
            while(this.isValid(this.currentPiece.shape, this.currentPiece.x, ghostY + 1)) {
                ghostY++;
            }
            this.drawPiece(this.currentPiece.shape, this.currentPiece.x, ghostY, 'rgba(255,255,255,0.2)');
        }

        if(!this.dead) {
            this.drawPiece(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y, COLORS[this.currentPiece.id]);
        }
    }

    drawPiece(shape, ox, oy, color) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    this.drawBlock(ox + x, oy + y, color);
                }
            }
        }
    }

    drawBlock(x, y, color) {
        let bs = CONFIG.blockSize;
        let px = x * bs;
        let py = y * bs;
        
        ctx.fillStyle = color;
        if(CONFIG.graphics === 'HIGH') {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(px + 1, py + 1, bs - 2, bs/3);
        } else {
            ctx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
        }
    }
}

// --- Game Controller ---
const game = {
    mode: 'normal',
    state: 'start',
    pop: [],
    activeGame: null, 
    gen: 0,
    bestFit: 0,
    frame: 0,
    aiFrameAccumulator: 0, // Accumulator for fractional speeds
    
    dropCounter: 0,
    dropInterval: 1000,
    lastTime: 0,
    frameId: null,

    start: function() {
        ui.start.style.display = 'none';
        ui.over.style.display = 'none';
        AudioSys.init();
        this.aiFrameAccumulator = 0; // Reset
        
        if (this.mode === 'normal') {
            this.activeGame = new TetrisGame();
            ui.dashboard.style.display = 'none';
            ui.hud.style.display = 'block';
            this.humanLoop();
        } else {
            ui.dashboard.style.display = 'block';
            ui.hud.style.display = 'none';
            if (this.gen === 0) this.createPopulation();
            this.aiLoop();
        }
    },

    humanLoop: function(time = 0) {
        if(this.mode !== 'normal' || !this.activeGame || this.activeGame.dead) {
            if(this.activeGame && this.activeGame.dead) {
                this.gameOver();
            }
            return;
        }
        
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;
        
        if(this.dropCounter > (this.dropInterval / this.activeGame.level)) {
            this.humanDrop();
            this.dropCounter = 0;
        }
        
        this.activeGame.draw();
        
        document.getElementById('score-display').innerText = this.activeGame.score;
        document.getElementById('lines-display').innerText = this.activeGame.lines;
        document.getElementById('level-display').innerText = this.activeGame.level;
        
        this.frameId = requestAnimationFrame((t) => this.humanLoop(t));
    },

    humanDrop: function() {
        if(this.activeGame.isValid(this.activeGame.currentPiece.shape, this.activeGame.currentPiece.x, this.activeGame.currentPiece.y + 1)) {
            this.activeGame.currentPiece.y++;
        } else {
            this.activeGame.placePiece();
            AudioSys.drop();
        }
    },

    createPopulation: function() {
        this.pop = [];
        for(let i=0; i<CONFIG.popSize; i++) this.pop.push(new TetrisGame());
        this.gen = 1;
        this.updateDashboard();
    },

    evolve: function() {
        document.getElementById('dash-status').innerText = "Evolving Generation " + (this.gen + 1) + "...";
        
        let maxFit = -Infinity;
        let bestG = null;
        
        for(let g of this.pop) {
            if(g.fitness > maxFit) { maxFit = g.fitness; bestG = g; }
        }
        if(maxFit > this.bestFit) this.bestFit = maxFit;
        
        let newPop = [];
        for(let i=0; i<CONFIG.elitismCount; i++) {
            if(bestG) newPop.push(new TetrisGame(bestG.genome));
        }
        
        while(newPop.length < CONFIG.popSize) {
            let parent = this.pickOne();
            if(parent && parent.genome) {
                let childG = parent.genome.clone();
                childG.mutate(CONFIG.mutationRate);
                newPop.push(new TetrisGame(childG));
            } else {
                newPop.push(new TetrisGame());
            }
        }
        
        this.pop = newPop;
        this.gen++;
        this.updateDashboard();
    },

    pickOne: function() {
        if(this.pop.length === 0) return null;
        let a = this.pop[Math.floor(Math.random() * this.pop.length)];
        let b = this.pop[Math.floor(Math.random() * this.pop.length)];
        return a.fitness > b.fitness ? a : b;
    },

    aiLoop: function() {
        if(this.mode !== 'ai') return;
        
        document.getElementById('dash-status').innerText = "Simulating Gen " + this.gen + " (Watching Best Agent)";
        
        let speed = CONFIG.speedMultiplier;
        
        const runStep = () => {
            let allDead = true;
            for(let g of this.pop) {
                if(!g.dead) {
                    g.aiMove();
                    allDead = false;
                }
            }
            if(allDead) {
                this.evolve();
                return true;
            }
            return false;
        };

        if (speed >= 1) {
            for(let k=0; k<Math.floor(speed); k++) {
                if(runStep()) break;
            }
        } else {
            this.aiFrameAccumulator += speed;
            if(this.aiFrameAccumulator >= 1) {
                runStep();
                this.aiFrameAccumulator = 0;
            }
        }

        let bestAlive = this.pop.find(g => !g.dead);
        if(!bestAlive) bestAlive = this.pop[0]; 
        if(bestAlive) bestAlive.draw();
        
        this.updateDashboard();
        this.frameId = requestAnimationFrame(() => this.aiLoop());
    },

    updateDashboard: function() {
        if(this.mode !== 'ai') return;
        
        let alive = this.pop.filter(g => !g.dead).length;
        document.getElementById('dash-gen').innerText = this.gen;
        document.getElementById('dash-alive').innerText = alive + '/' + CONFIG.popSize;
        document.getElementById('dash-best').innerText = Math.floor(this.bestFit);
        
        let maxL = 0;
        let bestCurrent = this.pop[0];
        this.pop.forEach(g => { 
            if(g.lines > maxL) maxL = g.lines; 
            if(g && g.score > (bestCurrent ? bestCurrent.score : 0)) bestCurrent = g;
        });
        
        if(bestCurrent && bestCurrent.genome) {
            let w = bestCurrent.genome.genes;
            document.getElementById('w-height').innerText = w[0].toFixed(2);
            document.getElementById('w-height').style.color = w[0] < 0 ? '#ff5555' : '#55ff55';
            
            document.getElementById('w-lines').innerText = w[1].toFixed(2);
            document.getElementById('w-lines').style.color = w[1] > 0 ? '#55ff55' : '#ff5555';
            
            document.getElementById('w-holes').innerText = w[2].toFixed(2);
            document.getElementById('w-holes').style.color = w[2] < 0 ? '#ff5555' : '#55ff55';
            
            document.getElementById('w-bump').innerText = w[3].toFixed(2);
            document.getElementById('w-bump').style.color = w[3] < 0 ? '#ff5555' : '#55ff55';
        }
    },

    gameOver: function() {
        if(this.frameId) cancelAnimationFrame(this.frameId);
        ui.finalScore.innerText = this.activeGame.score;
        document.getElementById('final-lines').innerText = this.activeGame.lines;
        ui.hud.style.display = 'none';
        ui.over.style.display = 'block';
    },

    reset: function() {
        ui.over.style.display = 'none';
        this.start();
    },
    
    endGame: function() {
        this.state = 'start';
        if(this.frameId) cancelAnimationFrame(this.frameId);
        ui.dashboard.style.display = 'none';
        ui.hud.style.display = 'none';
        ui.over.style.display = 'none';
        ui.start.style.display = 'block';
        this.gen = 0; 
        this.bestFit = 0;
        if(AudioSys.ctx) AudioSys.ctx.suspend();
    }
};

window.handleInput = function(key) {
    if(game.mode !== 'normal' || !game.activeGame || game.activeGame.dead) return;
    const g = game.activeGame;
    
    if (key === 'ArrowLeft') {
        if (g.isValid(g.currentPiece.shape, g.currentPiece.x - 1, g.currentPiece.y)) {
            g.currentPiece.x--;
            AudioSys.move();
        }
    } else if (key === 'ArrowRight') {
        if (g.isValid(g.currentPiece.shape, g.currentPiece.x + 1, g.currentPiece.y)) {
            g.currentPiece.x++;
            AudioSys.move();
        }
    } else if (key === 'ArrowDown') {
        if (g.isValid(g.currentPiece.shape, g.currentPiece.x, g.currentPiece.y + 1)) {
            g.currentPiece.y++;
        }
    } else if (key === 'ArrowUp') { 
        const rotated = g.rotate(g.currentPiece.shape);
        if (g.isValid(rotated, g.currentPiece.x, g.currentPiece.y)) {
            g.currentPiece.shape = rotated;
            AudioSys.rotate();
        } else if (g.isValid(rotated, g.currentPiece.x - 1, g.currentPiece.y)) { 
            g.currentPiece.shape = rotated;
            g.currentPiece.x--;
            AudioSys.rotate();
        } else if (g.isValid(rotated, g.currentPiece.x + 1, g.currentPiece.y)) { 
            g.currentPiece.shape = rotated;
            g.currentPiece.x++;
            AudioSys.rotate();
        }
    } else if (key === ' ') { 
        while(g.isValid(g.currentPiece.shape, g.currentPiece.x, g.currentPiece.y + 1)) {
            g.currentPiece.y++;
        }
        g.placePiece();
        AudioSys.drop();
    }
};

window.addEventListener('keydown', e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].indexOf(e.key) > -1) {
        e.preventDefault();
    }
    handleInput(e.key);
});

function startGame(mode) { 
    game.mode = mode; 
    game.start(); 
}

function showMainMenu() { 
    game.endGame(); 
}

function updateSpeed(val) { 
    CONFIG.speedMultiplier = parseFloat(val); 
    document.getElementById('speed-val').innerText = parseFloat(val).toFixed(1) + 'x'; 
}

function showSettings() { 
    ui.settings.style.display = 'block'; 
    ui.start.style.display = 'none'; 
}

function closeSettings() { 
    ui.settings.style.display = 'none'; 
    ui.start.style.display = 'block'; 
}

function showAiConfig() { 
    ui.aiConfig.style.display = 'block'; 
}

function closeAiConfig() { 
    ui.aiConfig.style.display = 'none'; 
}

function toggleGraphics() { 
    CONFIG.graphics = CONFIG.graphics === 'HIGH' ? 'LOW' : 'HIGH';
    document.getElementById('gfx-btn').innerText = 'Graphics: ' + CONFIG.graphics;
}

function saveAiSettings() {
    let pop = parseInt(document.getElementById('cfg-pop').value, 10);
    let mut = parseFloat(document.getElementById('cfg-mut').value);
    
    CONFIG.popSize = Math.max(10, Math.min(500, pop));
    CONFIG.mutationRate = Math.max(0.01, Math.min(0.5, mut));
    
    closeAiConfig();
    game.gen = 0; 
    game.bestFit = 0;
    if(game.mode === 'ai') game.createPopulation();
}

// Draggable Dashboard
(function() {
    const d = document.getElementById('ai-dashboard');
    let isD = false, sx, sy, il, it;
    
    d.addEventListener('mousedown', e => {
        if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
        isD=true; sx=e.clientX; sy=e.clientY;
        let st = window.getComputedStyle(d); il=parseInt(st.left, 10); it=parseInt(st.top, 10);
        d.style.cursor='grabbing';
    });
    
    window.addEventListener('mousemove', e => {
        if(!isD)return; e.preventDefault();
        d.style.left = (il + e.clientX - sx) + 'px';
        d.style.top = (it + e.clientY - sy) + 'px';
    });
    
    window.addEventListener('mouseup', () => { isD=false; d.style.cursor='move'; });
    
    d.addEventListener('touchstart', e => {
         if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
         isD=true; sx=e.touches[0].clientX; sy=e.touches[0].clientY;
         let st = window.getComputedStyle(d); il=parseInt(st.left, 10); it=parseInt(st.top, 10);
    });
    
    window.addEventListener('touchmove', e => {
         if(!isD)return; e.preventDefault();
         d.style.left = (il + e.touches[0].clientX - sx) + 'px';
         d.style.top = (it + e.touches[0].clientY - sy) + 'px';
    });
    
    window.addEventListener('touchend', () => isD=false);
})();

