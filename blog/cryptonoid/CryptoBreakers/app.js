// Game configuration with new layout specifications
const CONFIG = {
    canvas: { width: 800, height: 600 },
    layout: {
        topMargin: 40,
        bottomMargin: 180,
        paddleY: 560  // Moved paddle higher for better visibility
    },
    paddle: { width: 100, height: 20, speed: 8 },
    ball: { radius: 8, speed: 3 }, // Reduced speed for better control
    block: { 
        width: 25, 
        height: 25, 
        spacing: 2, 
        baseValue: 0.1,
        maxBlocksPerTower: 12
    },
    sections: {
        bid: {
            startX: 0,
            width: 350,
            towersStartX: 27,
            color: '#4CAF50'
        },
        center: {
            startX: 350,
            width: 100
        },
        ask: {
            startX: 450,
            width: 350,
            towersStartX: 477,
            color: '#F44336'
        }
    },
    tower: {
        width: 30,
        spacing: 8,
        maxTowers: 8
    },
    colors: {
        bid: '#4CAF50',
        ask: '#F44336', 
        paddle: '#00BCD4',     // Bright cyan for better visibility
        ball: '#FFD700',       // Gold color for better visibility
        background: '#1a1a1a',
        text: '#ffffff',
        centerText: '#ffffff'
    }
};

// Sample fallback data
const SAMPLE_ORDERBOOK = {
    symbol: "BTCUSDT",
    bids: [
        ["45000.00", "1.2"], ["44995.00", "0.8"], ["44990.00", "1.0"],
        ["44985.00", "0.6"], ["44980.00", "0.9"], ["44975.00", "1.1"],
        ["44970.00", "0.7"], ["44965.00", "0.9"]
    ],
    asks: [
        ["45005.00", "1.1"], ["45010.00", "0.7"], ["45015.00", "0.9"],
        ["45020.00", "1.0"], ["45025.00", "0.8"], ["45030.00", "0.9"],
        ["45035.00", "0.8"], ["45040.00", "1.0"]
    ]
};

const SYMBOLS = [
    {id: "bitcoin", name: "Bitcoin", symbol: "BTC"},
    {id: "ethereum", name: "Ethereum", symbol: "ETH"},
    {id: "cardano", name: "Cardano", symbol: "ADA"},
    {id: "solana", name: "Solana", symbol: "SOL"},
    {id: "dogecoin", name: "Dogecoin", symbol: "DOGE"}
];

class CryptoBreaker {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, loading, playing, paused, gameOver, levelComplete
        
        // Game objects
        this.paddle = { 
            x: (CONFIG.canvas.width - CONFIG.paddle.width) / 2, 
            y: CONFIG.layout.paddleY, 
            width: CONFIG.paddle.width, 
            height: CONFIG.paddle.height 
        };
        this.ball = { 
            x: CONFIG.canvas.width / 2, 
            y: CONFIG.layout.paddleY - 30, 
            dx: CONFIG.ball.speed, 
            dy: -CONFIG.ball.speed, 
            radius: CONFIG.ball.radius 
        };
        this.blocks = [];
        this.towers = [];
        this.currentPrice = 45000;
        
        // Game stats
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.currentSymbol = 'BTC';
        this.totalBlocks = 0;
        
        // Input handling
        this.keys = {};
        this.lastTime = 0;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateUI();
        this.hideOverlay();
        this.updateApiStatus('Ready to start game', 'info');
    }
    
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ') {
                e.preventDefault();
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
        
        // Button events
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        
        // Symbol selection
        document.getElementById('symbolSelect').addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            this.currentSymbol = selectedOption.textContent.match(/\(([^)]+)\)/)[1];
            this.updateUI();
        });
    }
    
    async startGame() {
        this.gameState = 'loading';
        this.showOverlay('loadingMessage');
        this.updateApiStatus('Fetching orderbook data...', 'info');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            let orderbook;
            try {
                orderbook = await this.fetchOrderbook();
            } catch (error) {
                console.log('API fetch failed, using fallback data');
                orderbook = this.generateFallbackOrderbook();
                this.updateApiStatus('Using sample data - API unavailable', 'warning');
            }
            
            this.createTowers(orderbook);
            this.resetBallAndPaddle();
            this.gameState = 'playing';
            this.hideOverlay();
            this.updateButtons();
            this.gameLoop();
            
            if (orderbook !== this.generateFallbackOrderbook()) {
                this.updateApiStatus('Real orderbook data loaded successfully', 'success');
            }
            
        } catch (error) {
            console.error('Game start failed:', error);
            this.createTowers(this.generateFallbackOrderbook());
            this.resetBallAndPaddle();
            this.gameState = 'playing';
            this.hideOverlay();
            this.updateButtons();
            this.gameLoop();
            this.updateApiStatus('Using sample data', 'warning');
        }
    }
    
    async fetchOrderbook() {
        const selectedSymbol = document.getElementById('symbolSelect').value;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
            const proxyUrl = 'https://corsproxy.io/?';
            const apiUrl = `${proxyUrl}https://api.coingecko.com/api/v3/coins/${selectedSymbol}`;
            
            const response = await fetch(apiUrl, { 
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();
            const currentPrice = data.market_data?.current_price?.usd || 45000;
            
            return this.generateMockOrderbook(currentPrice);
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    generateFallbackOrderbook() {
        const basePrice = this.getBasePriceForSymbol();
        return this.generateMockOrderbook(basePrice);
    }
    
    getBasePriceForSymbol() {
        const prices = {
            'BTC': 45000, 'ETH': 2500, 'ADA': 0.45, 'SOL': 98, 'DOGE': 0.08
        };
        return prices[this.currentSymbol] || 45000;
    }
    
    generateMockOrderbook(basePrice) {
        this.currentPrice = basePrice;
        const bids = [];
        const asks = [];
        const spread = basePrice * 0.0002;
        
        // Generate bids (below current price) - highest to lowest
        for (let i = 0; i < CONFIG.tower.maxTowers; i++) {
            const price = basePrice - spread - (i * spread * 0.5);
            const quantity = (Math.random() * 1.1 + 0.5).toFixed(1);
            bids.push([price.toFixed(basePrice > 1 ? 2 : 6), quantity]);
        }
        
        // Generate asks (above current price) - lowest to highest
        for (let i = 0; i < CONFIG.tower.maxTowers; i++) {
            const price = basePrice + spread + (i * spread * 0.5);
            const quantity = (Math.random() * 1.1 + 0.5).toFixed(1);
            asks.push([price.toFixed(basePrice > 1 ? 2 : 6), quantity]);
        }
        
        return { symbol: this.currentSymbol, bids, asks };
    }
    
    createTowers(orderbook) {
        this.blocks = [];
        this.towers = [];
        this.totalBlocks = 0;
        
        // Create bid towers (left side, green) - highest to lowest price
        orderbook.bids.forEach((bid, index) => {
            const [price, quantity] = bid;
            const numBlocks = Math.min(
                Math.floor(parseFloat(quantity) / CONFIG.block.baseValue),
                CONFIG.block.maxBlocksPerTower
            );
            
            if (numBlocks > 0 && index < CONFIG.tower.maxTowers) {
                const towerX = CONFIG.sections.bid.towersStartX + index * (CONFIG.tower.width + CONFIG.tower.spacing);
                if (towerX + CONFIG.tower.width <= CONFIG.sections.bid.startX + CONFIG.sections.bid.width) {
                    this.createTower(towerX, parseFloat(price), numBlocks, 'bid', index);
                }
            }
        });
        
        // Create ask towers (right side, red) - lowest to highest price
        orderbook.asks.forEach((ask, index) => {
            const [price, quantity] = ask;
            const numBlocks = Math.min(
                Math.floor(parseFloat(quantity) / CONFIG.block.baseValue),
                CONFIG.block.maxBlocksPerTower
            );
            
            if (numBlocks > 0 && index < CONFIG.tower.maxTowers) {
                const towerX = CONFIG.sections.ask.towersStartX + index * (CONFIG.tower.width + CONFIG.tower.spacing);
                if (towerX + CONFIG.tower.width <= CONFIG.sections.ask.startX + CONFIG.sections.ask.width) {
                    this.createTower(towerX, parseFloat(price), numBlocks, 'ask', index);
                }
            }
        });
        
        this.updateBlockCount();
    }
    
    createTower(x, price, numBlocks, type, towerIndex) {
        const tower = {
            x: x,
            price: price,
            type: type,
            blocks: [],
            index: towerIndex
        };
        
        // Create blocks from top to bottom (top-aligned)
        for (let i = 0; i < numBlocks; i++) {
            const block = {
                x: x,
                y: CONFIG.layout.topMargin + (i * (CONFIG.block.height + CONFIG.block.spacing)),
                width: CONFIG.block.width,
                height: CONFIG.block.height,
                price: price,
                value: CONFIG.block.baseValue,
                type: type,
                color: CONFIG.colors[type],
                towerIndex: towerIndex,
                blockIndex: i
            };
            
            tower.blocks.push(block);
            this.blocks.push(block);
            this.totalBlocks++;
        }
        
        this.towers.push(tower);
    }
    
    resetBallAndPaddle() {
        this.paddle.x = (CONFIG.canvas.width - CONFIG.paddle.width) / 2;
        this.paddle.y = CONFIG.layout.paddleY;
        this.ball.x = CONFIG.canvas.width / 2;
        this.ball.y = CONFIG.layout.paddleY - 30;
        this.ball.dx = CONFIG.ball.speed * (Math.random() > 0.5 ? 1 : -1);
        this.ball.dy = -CONFIG.ball.speed;
    }
    
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'playing') {
            this.animationId = null;
            return;
        }
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        // Paddle movement
        if (this.keys['ArrowLeft'] && this.paddle.x > 0) {
            this.paddle.x -= CONFIG.paddle.speed;
        }
        if (this.keys['ArrowRight'] && this.paddle.x < CONFIG.canvas.width - this.paddle.width) {
            this.paddle.x += CONFIG.paddle.speed;
        }
        
        // Ball movement
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
        // Ball collision with walls
        if (this.ball.x <= this.ball.radius || this.ball.x >= CONFIG.canvas.width - this.ball.radius) {
            this.ball.dx = -this.ball.dx;
        }
        if (this.ball.y <= this.ball.radius) {
            this.ball.dy = -this.ball.dy;
        }
        
        // Ball collision with paddle
        if (this.ball.y + this.ball.radius >= this.paddle.y &&
            this.ball.x >= this.paddle.x &&
            this.ball.x <= this.paddle.x + this.paddle.width &&
            this.ball.dy > 0) {
            
            const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
            const angle = (hitPos - 0.5) * Math.PI / 3;
            const speed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);
            
            this.ball.dx = Math.sin(angle) * speed;
            this.ball.dy = -Math.cos(angle) * speed;
        }
        
        // Ball collision with blocks
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            if (this.ballBlockCollision(this.ball, block)) {
                // Remove block from both arrays
                this.blocks.splice(i, 1);
                
                // Remove block from tower
                const tower = this.towers.find(t => t.index === block.towerIndex);
                if (tower) {
                    const blockIndex = tower.blocks.findIndex(b => b.blockIndex === block.blockIndex);
                    if (blockIndex !== -1) {
                        tower.blocks.splice(blockIndex, 1);
                    }
                }
                
                // Calculate score based on block value
                const blockValue = block.price * block.value;
                this.score += Math.floor(blockValue * 100);
                this.updateUI();
                
                // Reverse ball direction
                this.ball.dy = -this.ball.dy;
                break;
            }
        }
        
        // Check for level completion
        if (this.blocks.length === 0) {
            this.levelComplete();
        }
        
        // Check for ball out of bounds (only at bottom)
        if (this.ball.y > CONFIG.canvas.height + 20) {
            this.lives--;
            this.updateUI();
            
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.resetBallAndPaddle();
            }
        }
    }
    
    ballBlockCollision(ball, block) {
        const closestX = Math.max(block.x, Math.min(ball.x, block.x + block.width));
        const closestY = Math.max(block.y, Math.min(ball.y, block.y + block.height));
        
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        
        return (distanceX * distanceX + distanceY * distanceY) < (ball.radius * ball.radius);
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = CONFIG.colors.background;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        
        // Draw section boundaries
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.setLineDash([3, 3]);
        this.ctx.lineWidth = 1;
        
        // Left section boundary (bid/center)
        this.ctx.beginPath();
        this.ctx.moveTo(CONFIG.sections.center.startX, 0);
        this.ctx.lineTo(CONFIG.sections.center.startX, CONFIG.layout.paddleY - 40);
        this.ctx.stroke();
        
        // Right section boundary (center/ask)
        this.ctx.beginPath();
        this.ctx.moveTo(CONFIG.sections.ask.startX, 0);
        this.ctx.lineTo(CONFIG.sections.ask.startX, CONFIG.layout.paddleY - 40);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Draw section labels
        this.ctx.fillStyle = CONFIG.colors.text;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        
        // Bid section label
        this.ctx.fillText('BIDS (Highest → Lowest)', CONFIG.sections.bid.startX + CONFIG.sections.bid.width / 2, 25);
        
        // Ask section label
        this.ctx.fillText('ASKS (Lowest → Highest)', CONFIG.sections.ask.startX + CONFIG.sections.ask.width / 2, 25);
        
        // Current price in center
        this.ctx.fillStyle = CONFIG.colors.centerText;
        this.ctx.font = 'bold 16px Arial';
        const priceText = this.currentPrice > 1 ? 
            `$${this.currentPrice.toFixed(2)}` : 
            `$${this.currentPrice.toFixed(6)}`;
        this.ctx.fillText(`Current Price`, CONFIG.sections.center.startX + CONFIG.sections.center.width / 2, 140);
        this.ctx.fillText(priceText, CONFIG.sections.center.startX + CONFIG.sections.center.width / 2, 160);
        
        // Draw price labels for towers
        this.towers.forEach(tower => {
            if (tower.blocks.length > 0) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                
                const priceText = tower.price > 1 ? 
                    `$${tower.price.toFixed(2)}` : 
                    `$${tower.price.toFixed(6)}`;
                
                // Position price labels above the towers
                this.ctx.fillText(priceText, tower.x + CONFIG.block.width / 2, CONFIG.layout.topMargin - 5);
            }
        });
        
        // Draw blocks
        this.blocks.forEach(block => {
            this.ctx.fillStyle = block.color;
            this.ctx.fillRect(block.x, block.y, block.width, block.height);
            
            // Add block border
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(block.x, block.y, block.width, block.height);
        });
        
        // Draw paddle with bright color and border for visibility
        this.ctx.fillStyle = CONFIG.colors.paddle;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        // Add paddle border for better visibility
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        // Draw ball with bright color and shadow
        this.ctx.fillStyle = CONFIG.colors.ball;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add ball border for better visibility
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw ball shadow for depth
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x + 3, this.ball.y + 3, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    async levelComplete() {
        this.gameState = 'levelComplete';
        this.level++;
        this.updateUI();
        this.showOverlay('levelCompleteMessage');
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        setTimeout(async () => {
            await this.startGame();
        }, 2000);
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('finalScore').textContent = this.score.toLocaleString();
        this.showOverlay('gameOverMessage');
        this.updateButtons();
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    restartGame() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.updateUI();
        this.startGame();
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.showOverlay('pauseOverlay');
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.hideOverlay();
            this.gameLoop();
        }
        this.updateButtons();
    }
    
    showOverlay(messageId) {
        const overlay = document.getElementById('gameOverlay');
        const messages = overlay.querySelectorAll('.overlay-message');
        
        // Hide all messages first
        messages.forEach(msg => msg.classList.add('hidden'));
        
        // Show the specific message
        const targetMessage = document.getElementById(messageId);
        if (targetMessage) {
            targetMessage.classList.remove('hidden');
        }
        
        // Show the overlay
        overlay.classList.remove('hidden');
    }
    
    hideOverlay() {
        const overlay = document.getElementById('gameOverlay');
        const messages = overlay.querySelectorAll('.overlay-message');
        
        // Hide all messages
        messages.forEach(msg => msg.classList.add('hidden'));
        
        // Hide the main overlay
        overlay.classList.add('hidden');
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score.toLocaleString();
        document.getElementById('level').textContent = this.level;
        document.getElementById('currentSymbol').textContent = this.currentSymbol;
        document.getElementById('lives').textContent = this.lives;
        this.updateBlockCount();
    }
    
    updateBlockCount() {
        document.getElementById('blocksRemaining').textContent = this.blocks.length;
    }
    
    updateButtons() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (this.gameState === 'playing') {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            pauseBtn.textContent = 'Pause';
        } else if (this.gameState === 'paused') {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            pauseBtn.textContent = 'Resume';
        } else {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            pauseBtn.textContent = 'Pause';
        }
    }
    
    updateApiStatus(message, type) {
        const statusElement = document.getElementById('apiStatus');
        statusElement.textContent = message;
        statusElement.className = `status status--${type}`;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const game = new CryptoBreaker();
});