const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of [
    'js/core/GameConfig.js', 'js/combat/Weapon.js',
    'js/combat/BulletSystem.js', 'js/entities/Player.js',
    'js/data/AircraftCatalog.js', 'js/systems/AircraftManager.js'
]) {
    vm.runInThisContext(fs.readFileSync(file, 'utf8')
        .replace(/^class\s+(\w+)/gm, 'global.$1 = class $1'), { filename: file });
}

const tests = [];
function test(label, fn) { tests.push({ label, fn }); }
function fixture() {
    const game = {
        state: GameConfig.STATES.MENU,
        stateMachine: { getCurrentStateName() { return game.state; } },
        player: new Player(), bulletSystem: new BulletSystem(),
        enemies: [], currentBoss: null, showMessage: '', messageTimer: 0
    };
    game.aircraftManager = new AircraftManager(game);
    return game;
}

test('战机图鉴恰好四架且 ID 唯一', () => {
    const ids = AircraftCatalog.list().map(v => v.id);
    assert.deepEqual(ids, ['j31', 'xiaolong', 'zero', 'hades']);
    assert.equal(new Set(ids).size, 4);
    assert.equal(AircraftCatalog.get('not-found'), null);
});

test('每架战机生命速度和主武器独立生效', () => {
    const game = fixture();
    for (const def of AircraftCatalog.list()) {
        assert.equal(game.aircraftManager.select(def.id), true);
        game.aircraftManager.prepareForBattle();
        assert.equal(game.player.maxHealth, def.stats.maxHealth);
        assert.equal(game.player.health, def.stats.maxHealth);
        assert.equal(game.player.maxSpeed, def.stats.maxSpeed);
        assert.equal(game.player.weaponManager.activeWeapon.damage, def.weapon.damage);
        assert.equal(game.player.weaponManager.activeWeapon.fireRate, def.weapon.fireRate);
        assert.equal(game.player.aircraftId, def.id);
    }
});

test('战斗中与暂停时不允许换机补血', () => {
    const game = fixture();
    game.aircraftManager.prepareForBattle();
    game.state = GameConfig.STATES.PLAYING;
    game.player.health = 35;
    assert.equal(game.aircraftManager.select('hades'), false);
    assert.equal(game.player.health, 35);
    game.state = GameConfig.STATES.PAUSED;
    assert.equal(game.aircraftManager.select('zero'), false);
    game.state = GameConfig.STATES.MENU;
    assert.equal(game.aircraftManager.select('zero'), true);
});

test('四种技能均有真实效果且进入冷却', () => {
    for (const def of AircraftCatalog.list()) {
        const game = fixture();
        game.aircraftManager.select(def.id);
        game.aircraftManager.prepareForBattle();
        game.state = GameConfig.STATES.PLAYING;
        if (def.id === 'hades') {
            game.bulletSystem.addEnemyBullet({ x: 20, y: 20, active: true });
            assert.equal(game.bulletSystem.enemyBullets.length, 1);
        }
        assert.equal(game.aircraftManager.useSkill(), true, def.id);
        assert.ok(game.bulletSystem.bullets.length > 0 || game.player.shieldActive, def.id);
        assert.ok(game.aircraftManager.cooldownRemaining > 0);
        assert.equal(game.aircraftManager.useSkill(), false);
        if (def.id === 'hades') {
            assert.equal(game.player.shieldActive, true);
            assert.equal(game.bulletSystem.enemyBullets.length, 0);
        }
    }
});

test('冷却时间按秒衰减，结束后可再次施放', () => {
    const game = fixture();
    game.aircraftManager.prepareForBattle();
    game.state = GameConfig.STATES.PLAYING;
    assert.equal(game.aircraftManager.useSkill(), true);
    const t = game.aircraftManager.selected.skill.cooldown;
    game.aircraftManager.update(t - 0.2);
    assert.equal(game.aircraftManager.useSkill(), false);
    game.aircraftManager.update(0.3);
    assert.equal(game.aircraftManager.getSkillStatus().ready, true);
    assert.equal(game.aircraftManager.useSkill(), true);
});

test('战前准备重置冷却和护盾，不沿用上一关的临时状态', () => {
    const game = fixture();
    game.aircraftManager.prepareForBattle();
    game.state = GameConfig.STATES.PLAYING;
    game.aircraftManager.useSkill();
    game.player.health = 10;
    game.player.activateShield(10000);
    game.aircraftManager.prepareForBattle();
    assert.equal(game.player.health, game.player.maxHealth);
    assert.equal(game.player.shieldActive, false);
    assert.equal(game.aircraftManager.getSkillStatus().ready, true);
});

test('追踪导弹可锁定当前Boss', () => {
    const game = fixture();
    game.aircraftManager.prepareForBattle();
    game.state = GameConfig.STATES.PLAYING;
    const boss = { active: true, isDead: false, x: 320, y: 120 };
    game.currentBoss = boss;
    game.aircraftManager.useSkill();
    game.bulletSystem.update(0.1, [boss]);
    assert.ok(game.bulletSystem.bullets.some(b => b.isTracking && b.target === boss));
});

let pass = 0;
for (const { label, fn } of tests) {
    try {
        fn();
        console.log('PASS: ' + label);
        pass++;
    } catch (err) {
        console.error('FAIL: ' + label, err.stack);
    }
}
console.log('Aircraft P1: ' + pass + '/' + tests.length);
if (pass !== tests.length) process.exitCode = 1;
