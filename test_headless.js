/**
 * Headless测试套件
 * 使用Node.js环境测试游戏核心逻辑
 */

// 模拟浏览器环境
const { JSDOM } = require('jsdom');
const assert = require('assert');

// 创建虚拟DOM
const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
        <canvas id="gameCanvas"></canvas>
        <div id="debugInfo"></div>
    </body>
    </html>
`, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

// 设置全局对象
global.window = dom.window;
global.document = dom.window.document;
global.performance = {
    now: () => Date.now()
};
global.requestAnimationFrame = (callback) => {
    setTimeout(callback, 16);
};

// Mock Image for AssetManager
global.Image = class {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
    }
    set src(value) {
        this._src = value;
        // 模拟异步加载
        setTimeout(() => {
            if (this.onload) this.onload();
        }, 0);
    }
    get src() {
        return this._src;
    }
};

// Mock Blob and URL for SVG handling
global.Blob = class {
    constructor(parts, options) {
        this.parts = parts;
        this.options = options;
    }
};

global.URL = {
    createObjectURL: (blob) => 'blob:mock-url',
    revokeObjectURL: (url) => {}
};

// 模拟Canvas 2D上下文
const mockContext = {
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    createLinearGradient: () => ({
        addColorStop: () => {}
    }),
    createRadialGradient: () => ({
        addColorStop: () => {}
    }),
    setTransform: () => {},
    drawImage: () => {},
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
};

// 覆盖getContext方法
const { HTMLCanvasElement } = dom.window;
HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === '2d') {
        return mockContext;
    }
    return null;
};

// 加载游戏文件
const fs = require('fs');
const path = require('path');

// 在全局作用域执行代码
function loadGameFile(filePath) {
    const fullPath = path.join(__dirname, filePath);
    let code = fs.readFileSync(fullPath, 'utf8');
    
    // 将class声明改为global赋值，以便在Node环境中使用
    code = code.replace(/^class\s+(\w+)/gm, 'global.$1 = class $1');
    
    // 执行代码
    eval(code);
}

// 加载所有游戏文件
console.log('加载游戏文件...');
try {
    loadGameFile('js/core/GameConfig.js');
    loadGameFile('js/core/GameLoop.js');
    loadGameFile('js/core/StateMachine.js');
    loadGameFile('js/assets/AssetManager.js');
    loadGameFile('js/render/Renderer.js');
    loadGameFile('js/input/InputManager.js');
    loadGameFile('js/entities/Player.js');
    loadGameFile('js/entities/Enemy.js');
    loadGameFile('js/combat/Weapon.js');
    loadGameFile('js/combat/BulletSystem.js');
    loadGameFile('js/combat/CollisionSystem.js');
    loadGameFile('js/effects/ParticleSystem.js');
    loadGameFile('js/data/AircraftCatalog.js');
    loadGameFile('js/data/EquipmentCatalog.js');
    loadGameFile('js/systems/AircraftManager.js');
    loadGameFile('js/systems/EquipmentManager.js');
    loadGameFile('js/levels/LevelManager.js');
    loadGameFile('js/levels/WaveManager.js');
    loadGameFile('js/boss/Boss.js');
    loadGameFile('js/boss/BossManager.js');
    loadGameFile('js/powerups/PowerUp.js');
    loadGameFile('js/powerups/PowerUpManager.js');
    loadGameFile('js/Game.js');
    console.log('游戏文件加载成功');
} catch (error) {
    console.error('加载游戏文件失败:', error.message);
    process.exit(1);
}

// 测试套件
class TestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('\n========== 开始测试 ==========\n');
        
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.name}`);
                console.log(`   错误: ${error.message}`);
                this.failed++;
            }
        }

        console.log('\n========== 测试结果 ==========');
        console.log(`通过: ${this.passed}`);
        console.log(`失败: ${this.failed}`);
        console.log(`总计: ${this.tests.length}`);
        console.log('==============================\n');

        return this.failed === 0;
    }
}

// 创建测试套件
const suite = new TestSuite();

// 测试1: 游戏配置
suite.test('游戏配置应正确加载', () => {
    assert.strictEqual(GameConfig.CANVAS.WIDTH, 640);
    assert.strictEqual(GameConfig.CANVAS.HEIGHT, 960);
    assert.strictEqual(GameConfig.GAME.FPS, 60);
    assert.strictEqual(GameConfig.PLAYER.BASE_SPEED, 300);
});

// 测试2: 游戏初始化
suite.test('游戏应能正确初始化', () => {
    const game = new Game();
    const result = game.init();
    assert.strictEqual(result, true);
    assert.strictEqual(game.isInitialized, true);
    assert.notStrictEqual(game.renderer, null);
    assert.notStrictEqual(game.gameLoop, null);
    assert.notStrictEqual(game.stateMachine, null);
    assert.notStrictEqual(game.inputManager, null);
    assert.notStrictEqual(game.player, null);
});

// 测试3: 状态机
suite.test('状态机应能正确切换状态', () => {
    const game = new Game();
    game.init();
    
    // 初始状态应为菜单
    assert.strictEqual(game.stateMachine.getCurrentStateName(), GameConfig.STATES.MENU);
    
    // 切换到游戏状态
    game.stateMachine.changeState(GameConfig.STATES.PLAYING);
    assert.strictEqual(game.stateMachine.getCurrentStateName(), GameConfig.STATES.PLAYING);
    
    // 切换到暂停状态
    game.stateMachine.changeState(GameConfig.STATES.PAUSED);
    assert.strictEqual(game.stateMachine.getCurrentStateName(), GameConfig.STATES.PAUSED);
});

// 测试4: 玩家实体
suite.test('玩家实体应正确初始化', () => {
    const player = new Player();
    assert.strictEqual(player.x, GameConfig.PLAYER.INITIAL_X);
    assert.strictEqual(player.y, GameConfig.PLAYER.INITIAL_Y);
    assert.strictEqual(player.health, player.maxHealth);
    assert.strictEqual(player.lives, 3);
    assert.strictEqual(player.score, 0);
    assert.strictEqual(player.isDead, false);
});

// 测试5: 玩家移动
suite.test('玩家应能正确移动', () => {
    const game = new Game();
    game.init();
    
    const player = game.player;
    const initialX = player.x;
    const initialY = player.y;
    
    // 模拟向右移动
    game.simulateInput('ArrowRight', 'press');
    game.inputManager.update(0.016);
    player.update(0.016, game.inputManager);
    
    assert(player.x > initialX, '玩家应向右移动');
    assert.strictEqual(player.y, initialY, 'Y坐标不应改变');
    
    game.simulateInput('ArrowRight', 'release');
});

// 测试6: 玩家边界检查
suite.test('玩家不应超出边界', () => {
    const player = new Player();
    
    // 测试左边界
    player.x = GameConfig.PLAYER.BOUNDS.MIN_X - 100;
    player.checkBounds();
    assert(player.x >= GameConfig.PLAYER.BOUNDS.MIN_X, '玩家不应超出左边界');
    
    // 测试右边界
    player.x = GameConfig.PLAYER.BOUNDS.MAX_X + 100;
    player.checkBounds();
    assert(player.x <= GameConfig.PLAYER.BOUNDS.MAX_X, '玩家不应超出右边界');
    
    // 测试上边界
    player.y = GameConfig.PLAYER.BOUNDS.MIN_Y - 100;
    player.checkBounds();
    assert(player.y >= GameConfig.PLAYER.BOUNDS.MIN_Y, '玩家不应超出上边界');
    
    // 测试下边界
    player.y = GameConfig.PLAYER.BOUNDS.MAX_Y + 100;
    player.checkBounds();
    assert(player.y <= GameConfig.PLAYER.BOUNDS.MAX_Y, '玩家不应超出下边界');
});

// 测试7: 玩家受伤和无敌
suite.test('玩家受伤机制应正常工作', () => {
    const player = new Player();
    const initialHealth = player.health;
    
    // 受到伤害
    player.takeDamage(30);
    assert.strictEqual(player.health, initialHealth - 30, '生命值应减少');
    assert.strictEqual(player.isInvincible, true, '受伤后应无敌');
    assert(player.invincibleTime > 0, '应有无敌时间');
    
    // 无敌期间不受伤害
    const currentHealth = player.health;
    player.takeDamage(20);
    assert.strictEqual(player.health, currentHealth, '无敌期间不应受伤');
});

// 测试8: 玩家射击
suite.test('玩家应能发射子弹', () => {
    const player = new Player();
    const initialBullets = player.bullets.length;
    
    // 发射子弹
    player.fire();
    assert.strictEqual(player.bullets.length, initialBullets + 1, '应增加一颗子弹');
    
    const bullet = player.bullets[0];
    assert.strictEqual(bullet.x, player.x, '子弹X坐标应与玩家相同');
    assert(bullet.y < player.y, '子弹应在玩家上方');
    assert(bullet.velocity.y < 0, '子弹应向上飞行');
});

// 测试9: 游戏循环
suite.test('游戏循环应正常运行', (done) => {
    const game = new Game();
    game.init();
    game.start();
    
    assert.strictEqual(game.isRunning, true, '游戏应在运行');
    assert.strictEqual(game.gameLoop.isRunning, true, '游戏循环应在运行');
    
    // 等待几帧后检查
    setTimeout(() => {
        assert(game.gameLoop.frameCount >= 0, '帧计数应增加');
        game.stop();
        assert.strictEqual(game.isRunning, false, '游戏应停止');
        done();
    }, 100);
});

// 测试10: 输入系统
suite.test('输入系统应正确响应', () => {
    const input = new InputManager();
    
    // 模拟按键
    input.handleKeyDown({ code: 'Space', preventDefault: () => {} });
    assert.strictEqual(input.isKeyDown('Space'), true, '空格键应被按下');
    
    input.handleKeyUp({ code: 'Space' });
    assert.strictEqual(input.isKeyDown('Space'), false, '空格键应被释放');
    
    // 测试输入向量
    input.handleKeyDown({ code: 'ArrowLeft', preventDefault: () => {} });
    input.handleKeyDown({ code: 'ArrowUp', preventDefault: () => {} });
    input.update(0.016);
    
    const movement = input.getMovementInput();
    assert(movement.x < 0, '应向左移动');
    assert(movement.y < 0, '应向上移动');
});

// 测试11: 性能监控
suite.test('性能监控应正常工作', () => {
    const loop = new GameLoop();
    loop.init(() => {}, () => {});
    
    const perfData = loop.getPerformanceData();
    assert(perfData.fps >= 0, 'FPS应为非负数');
    assert(perfData.updateTime !== undefined, '应有更新时间');
    assert(perfData.renderTime !== undefined, '应有渲染时间');
    assert(perfData.frameTime !== undefined, '应有帧时间');
});

// 测试12: 玩家重生
suite.test('玩家重生机制应正常工作', () => {
    const player = new Player();
    
    // 修改玩家状态
    player.x = 100;
    player.y = 200;
    player.health = 50;
    
    // 重生
    player.respawn();
    
    assert.strictEqual(player.x, GameConfig.PLAYER.INITIAL_X, 'X坐标应重置');
    assert.strictEqual(player.y, GameConfig.PLAYER.INITIAL_Y, 'Y坐标应重置');
    assert.strictEqual(player.health, player.maxHealth, '生命值应恢复满');
    assert.strictEqual(player.isInvincible, true, '重生后应无敌');
    assert.strictEqual(player.isDead, false, '应复活');
});

// P0 integration: the real Game, BossManager and LevelManager must cooperate.
suite.test('Boss击败后应进入通关结算并能进入下一关', () => {
    const game = new Game();
    game.init();
    game.stateMachine.changeState(GameConfig.STATES.PLAYING);
    game.levelManager.startBossBattle();
    const boss = game.bossManager.currentBoss;
    assert(boss, 'Boss应该已经生成');
    boss.isEntering = false;
    boss.invulnerable = false;
    boss.takeDamage(100000);
    assert.strictEqual(boss.isDead, true);

    game.bossManager.update(0.016, game.player, game.bulletSystem, game.particleSystem);
    game.bossManager.update(3.1, game.player, game.bulletSystem, game.particleSystem);
    assert.strictEqual(game.levelManager.levelPhase, 'outro');

    game.levelManager.update(2.1);
    assert.strictEqual(game.stateMachine.getCurrentStateName(), GameConfig.STATES.LEVEL_COMPLETE);
    assert(game.levelResult && game.levelResult.name === '城市上空');

    game.stateMachine.changeState(GameConfig.STATES.PLAYING);
    assert.strictEqual(game.levelManager.currentLevel.id, 'level_02');
});

suite.test('暂停后恢复不能重置玩家或关卡', () => {
    const game = new Game();
    game.init();
    game.stateMachine.changeState(GameConfig.STATES.PLAYING);
    game.player.health = 42;
    game.levelManager.levelTime = 15;
    game.stateMachine.changeState(GameConfig.STATES.PAUSED);
    game.stateMachine.changeState(GameConfig.STATES.PLAYING);
    assert.strictEqual(game.player.health, 42);
    assert.strictEqual(game.levelManager.levelTime, 15);
});

// 运行测试
async function runTests() {
    console.log('启动Headless测试...\n');
    console.log('环境: Node.js ' + process.version);
    console.log('测试框架: 原生assert\n');
    
    const success = await suite.run();
    
    // 设置退出码
    process.exit(success ? 0 : 1);
}

// 执行测试
runTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});