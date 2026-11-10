/**
 * P0 gameplay regression checks.
 * Run with: node test_p0.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

global.window = { audioManager: null };
function load(file) {
    const code = fs.readFileSync(file, 'utf8')
        .replace(/^class\s+(\w+)/gm, 'global.$1 = class $1');
    vm.runInThisContext(code, { filename: file });
}

[
    'js/core/GameConfig.js',
    'js/levels/LevelManager.js',
    'js/levels/WaveManager.js',
    'js/boss/Boss.js',
    'js/boss/BossManager.js',
    'js/combat/CollisionSystem.js'
].forEach(load);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function levelFixture() {
    const level = new LevelManager();
    let waves = 0, bosses = 0, completions = 0;
    level.init({
        reset() {},
        startWave() { waves++; },
        update() {},
        stopWave() {}
    }, {
        spawnBoss() { bosses++; }
    });
    level.onLevelFinished = () => { completions++; };
    return { level, counts: () => ({ waves, bosses, completions }) };
}
function fakeGame() {
    return {
        player: {
            health: 100, score: 0, lives: 3, bombs: 0, maxBombs: 3,
            weaponManager: { activeWeapon: { upgrade() {} } },
            activateShield() {}
        }
    };
}

test('第一波按时开始且只开始一次', () => {
    const { level, counts } = levelFixture();
    level.loadLevel(0);
    level.update(1.1);
    level.update(0.1);
    assert.equal(counts().waves, 1);
});

test('重复加载关卡不会累乘难度', () => {
    const { level } = levelFixture();
    level.setDifficulty(3);
    level.loadLevel(0);
    const first = level.currentLevel.waves[0].spawnRate;
    level.loadLevel(0);
    assert.equal(first, level.currentLevel.waves[0].spawnRate);
    assert.equal(level.levels[0].waves[0].spawnRate, 2);
});

test('击败Boss之后不再重新生成', () => {
    const { level, counts } = levelFixture();
    level.loadLevel(0);
    level.update(91);
    assert.equal(counts().bosses, 1);
    level.onBossDefeated();
    level.update(0.1);
    assert.equal(counts().bosses, 1);
    assert.equal(level.levelPhase, 'outro');
});

test('通关结算只发生一次，下一关可以加载', () => {
    const { level, counts } = levelFixture();
    level.loadLevel(0);
    level.startBossBattle();
    level.onBossDefeated();
    level.update(2.1);
    level.update(2.1);
    assert.equal(counts().completions, 1);
    assert.equal(level.levelCompleted, true);
    level.loadLevel(1);
    assert.equal(level.currentLevel.id, 'level_02');
    assert.equal(level.levelCompleted, false);
});

test('Boss入场计时为秒，而不是2000秒', () => {
    const boss = new Boss({ maxHealth: 100 });
    boss.update(2.05, { x: 320, y: 800 });
    assert.equal(boss.isEntering, false);
    assert.equal(boss.invulnerable, false);
});

test('玩家子弹命中Boss会扣血并可击败', () => {
    const boss = new Boss({ maxHealth: 60, width: 180, height: 120 });
    boss.isEntering = false;
    boss.invulnerable = false;
    boss.x = 320; boss.y = 110;
    const bullet = { x: 320, y: 110, size: 7, damage: 1000, active: true };
    let hits = 0;
    const collisions = new CollisionSystem();
    collisions.processCollisions({
        boss, enemies: [],
        bossManager: {
            onBossDamage(damage, point) {
                hits++;
                return boss.takeDamage(damage, point);
            }
        },
        bulletSystem: { bullets: [bullet], enemyBullets: [] }
    });
    assert.equal(hits, 1);
    assert.equal(bullet.active, false);
    assert.equal(boss.isDead, true);
});

test('关卡Boss生命值覆盖模板且不会修改模板', () => {
    const manager = new BossManager(fakeGame());
    const baseHealth = manager.bossTemplates.bomber_commander.maxHealth;
    const boss = manager.spawnBoss({ type: 'bomber_commander', health: 1250 });
    assert.equal(boss.maxHealth, 1250);
    assert.equal(manager.bossTemplates.bomber_commander.maxHealth, baseHealth);
});

test('BossManager发射的是敌方子弹', () => {
    const manager = new BossManager(fakeGame());
    manager.spawnBoss('bomber_commander');
    manager.currentBoss.isEntering = false;
    manager.currentBoss.invulnerable = false;
    manager.currentBoss.stateTime = 4;
    const sides = [];
    manager.update(0.1, { x: 320, y: 800 }, {
        addBullets(bullets, isEnemy) { sides.push(isEnemy); }
    }, { createExplosion() {} });
    assert.ok(sides.length > 0);
    assert.ok(sides.every(Boolean));
});

test('Boss击败动画最终触发一次关卡回调', () => {
    const game = fakeGame();
    const manager = new BossManager(game);
    let completed = 0;
    manager.init(() => {}, () => { completed++; });
    manager.spawnBoss('bomber_commander');
    manager.currentBoss.die();
    const bullets = { addBullets() {} };
    const particles = { createExplosion() {} };
    manager.update(0.1, game.player, bullets, particles);
    assert.equal(manager.defeatSequenceActive, true);
    manager.update(3.1, game.player, bullets, particles);
    manager.update(0.1, game.player, bullets, particles);
    assert.equal(completed, 1);
    assert.equal(manager.currentBoss, null);
    assert.ok(game.player.score > 0);
});

test('Boss统计记录减防后的有效伤害，而非原始伤害', () => {
    const manager = new BossManager(fakeGame());
    const boss = manager.spawnBoss('bomber_commander');
    boss.isEntering = false;
    boss.invulnerable = false;
    const before = boss.health;
    const previousStats = manager.battleStats.damageDealt;
    manager.onBossDamage(12, null, { source: 'pet' });
    const effective = before - boss.health;
    assert.ok(effective > 0);
    assert.ok(Math.abs(manager.battleStats.damageDealt - previousStats - effective) < 1e-6);
});

let pass = 0;
for (const { name, fn } of tests) {
    try {
        fn();
        console.log('PASS: ' + name);
        pass++;
    } catch (error) {
        console.error('FAIL: ' + name, error.stack);
    }
}
console.log('P0: ' + pass + '/' + tests.length + ' passed');
if (pass !== tests.length) process.exitCode = 1;
