#!/usr/bin/env node

/**
 * Phase 3 测试脚本
 * 测试关卡系统、Boss系统和道具系统
 */

// Mock Canvas API
global.document = {
    getElementById: (id) => {
        if (id === 'gameCanvas') {
            return {
                getContext: () => ({
                    canvas: { width: 640, height: 960 },
                    fillStyle: '',
                    strokeStyle: '',
                    save: () => {},
                    restore: () => {},
                    translate: () => {},
                    rotate: () => {},
                    scale: () => {},
                    fillRect: () => {},
                    strokeRect: () => {},
                    fillText: () => {},
                    drawImage: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    closePath: () => {},
                    fill: () => {},
                    stroke: () => {},
                    clearRect: () => {},
                    createLinearGradient: () => ({
                        addColorStop: () => {}
                    }),
                    createRadialGradient: () => ({
                        addColorStop: () => {}
                    })
                })
            };
        }
        return null;
    },
    createElement: () => ({
        getContext: () => null
    })
};

global.window = {
    addEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    game: null
};

global.Image = class {
    constructor() {
        this.src = '';
        this.onload = null;
    }
    set src(value) {
        this._src = value;
        if (this.onload) setTimeout(this.onload, 0);
    }
    get src() {
        return this._src;
    }
};

global.URL = {
    createObjectURL: () => 'blob:mock'
};

global.Blob = class {
    constructor() {}
};

// Load game modules by executing them in global context
const fs = require('fs');
const path = require('path');

function loadScript(filepath) {
    const code = fs.readFileSync(path.join(__dirname, filepath), 'utf8');
    eval(code.replace(/^class\s+(\w+)/gm, 'global.$1 = class $1'));
}

loadScript('./js/core/GameConfig.js');
loadScript('./js/core/GameLoop.js');
loadScript('./js/core/StateMachine.js');
loadScript('./js/render/Renderer.js');
loadScript('./js/input/InputManager.js');
loadScript('./js/entities/Player.js');
loadScript('./js/entities/Enemy.js');
loadScript('./js/assets/AssetManager.js');
loadScript('./js/combat/Weapon.js');
loadScript('./js/combat/BulletSystem.js');
loadScript('./js/combat/CollisionSystem.js');
loadScript('./js/effects/ParticleSystem.js');
loadScript('./js/data/AircraftCatalog.js');
loadScript('./js/data/EquipmentCatalog.js');
loadScript('./js/systems/AircraftManager.js');
loadScript('./js/systems/EquipmentManager.js');
loadScript('./js/levels/LevelManager.js');
loadScript('./js/levels/WaveManager.js');
loadScript('./js/boss/Boss.js');
loadScript('./js/boss/BossManager.js');
loadScript('./js/powerups/PowerUp.js');
loadScript('./js/powerups/PowerUpManager.js');
loadScript('./js/Game.js');

// Test Suite
class Phase3TestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }
    
    test(name, fn) {
        this.tests.push({ name, fn });
    }
    
    async run() {
        console.log('=== Phase 3 系统测试 ===\n');
        
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✓ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.log(`✗ ${test.name}: ${error.message}`);
                this.failed++;
            }
        }
        
        console.log(`\n测试结果: ${this.passed} 通过, ${this.failed} 失败`);
        return this.failed === 0;
    }
}

// Create test suite
const suite = new Phase3TestSuite();

// Test 1: LevelManager initialization
suite.test('关卡管理器初始化', () => {
    const levelManager = new LevelManager();
    if (!levelManager) throw new Error('关卡管理器创建失败');
    if (!levelManager.levels || levelManager.levels.length === 0) {
        throw new Error('关卡定义为空');
    }
    if (levelManager.levels.length < 3) {
        throw new Error('关卡数量不足');
    }
});

// Test 2: Level loading
suite.test('关卡加载', () => {
    const levelManager = new LevelManager();
    const waveManager = new WaveManager();
    const bossManager = new BossManager();
    
    levelManager.init(waveManager, bossManager);
    const loaded = levelManager.loadLevel(0);
    
    if (!loaded) throw new Error('关卡加载失败');
    if (!levelManager.currentLevel) throw new Error('当前关卡为空');
    if (levelManager.currentLevel.id !== 'level_01') {
        throw new Error('关卡ID不正确');
    }
});

// Test 3: WaveManager formations
suite.test('波次编队系统', () => {
    const waveManager = new WaveManager();
    if (!waveManager.formations) throw new Error('编队定义为空');
    
    const formations = Object.keys(waveManager.formations);
    const requiredFormations = ['line', 'v_formation', 'surround', 'spiral'];
    
    for (const formation of requiredFormations) {
        if (!formations.includes(formation)) {
            throw new Error(`缺少编队类型: ${formation}`);
        }
    }
});

// Test 4: Wave spawning
suite.test('波次生成', () => {
    const waveManager = new WaveManager();
    let spawnCount = 0;
    
    waveManager.init(
        (enemyData) => { spawnCount++; },
        () => {}
    );
    
    const waveData = {
        type: 'test',
        duration: 10,
        spawnRate: 5,
        enemyTypes: ['scout'],
        formation: 'line',
        difficulty: 1
    };
    
    waveManager.startWave(waveData);
    
    // Simulate updates
    for (let i = 0; i < 5; i++) {
        waveManager.update(0.5);
    }
    
    if (spawnCount === 0) throw new Error('敌机未生成');
});

// Test 5: Boss system
suite.test('Boss系统初始化', () => {
    const boss = new Boss(320, 100, 'bomber_commander');
    if (!boss) throw new Error('Boss创建失败');
    if (boss.maxHealth <= 0) throw new Error('Boss血量设置错误');
    if (boss.phases.length === 0) throw new Error('Boss阶段未定义');
});

// Test 6: Boss attack patterns
suite.test('Boss攻击模式', () => {
    const boss = new Boss({ id: 'test', maxHealth: 100 });
    const player = { x: 320, y: 600 };
    
    // 当前Boss使用统一的executeAttack接口
    const attacks = ['straightShot', 'fanShot', 'circularBarrage', 'homingMissile'];
    for (const attack of attacks) {
        const bullets = boss.executeAttack(attack, player);
        if (!Array.isArray(bullets) || bullets.length === 0) {
            throw new Error(`攻击模式 ${attack} 未生成子弹`);
        }
    }
});

// Test 7: BossManager
suite.test('Boss管理器', () => {
    const bossManager = new BossManager();
    if (!bossManager) throw new Error('Boss管理器创建失败');
    if (!bossManager.bossTemplates) throw new Error('Boss模板未定义');
    
    const templates = Object.keys(bossManager.bossTemplates);
    if (templates.length < 3) throw new Error('Boss模板数量不足');
});

// Test 8: PowerUp system
suite.test('道具系统', () => {
    const powerUp = new PowerUp(100, 100, 'weapon_upgrade');
    if (!powerUp) throw new Error('道具创建失败');
    if (!powerUp.type) throw new Error('道具类型未设置');
    if (!powerUp.name) throw new Error('道具名称未设置');
});

// Test 9: PowerUpManager drop rates
suite.test('道具掉落系统', () => {
    const manager = new PowerUpManager();
    if (!manager.dropRates) throw new Error('掉落率未定义');
    
    const tables = ['normal', 'elite', 'boss'];
    for (const table of tables) {
        if (!manager.dropRates[table]) {
            throw new Error(`掉落表 ${table} 未定义`);
        }
    }
});

// Test 10: PowerUp collection
suite.test('道具收集效果', () => {
    const manager = new PowerUpManager();
    const player = new Player();
    const initialScore = player.score;
    
    const powerUp = new PowerUp(100, 100, 'coin');
    powerUp.collect(player);
    
    if (!powerUp.collected) throw new Error('道具收集状态未更新');
    if (player.score === initialScore) throw new Error('分数未增加');
});

// Test 11: Level progression
suite.test('关卡进度系统', () => {
    const levelManager = new LevelManager();
    levelManager.loadLevel(0);
    
    // Simulate level progress
    for (let i = 0; i < 100; i++) {
        levelManager.update(1);
    }
    
    const info = levelManager.getCurrentLevelInfo();
    if (!info) throw new Error('关卡信息获取失败');
    if (info.progress < 0 || info.progress > 1) {
        throw new Error('关卡进度计算错误');
    }
});

// Test 12: Game integration
suite.test('游戏集成测试', () => {
    const game = new Game();
    if (!game) throw new Error('游戏创建失败');
    
    game.init();
    
    if (!game.levelManager) throw new Error('关卡管理器未初始化');
    if (!game.waveManager) throw new Error('波次管理器未初始化');
    if (!game.bossManager) throw new Error('Boss管理器未初始化');
    if (!game.powerUpManager) throw new Error('道具管理器未初始化');
});

// Run tests
suite.run().then(success => {
    process.exit(success ? 0 : 1);
});