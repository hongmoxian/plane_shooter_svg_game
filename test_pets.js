/**
 * P3 pet & free-summoning regression suite.
 * Run: node test_pets.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
[
    'js/core/GameConfig.js', 'js/entities/Player.js', 'js/entities/Enemy.js', 'js/combat/Weapon.js',
    'js/combat/BulletSystem.js', 'js/combat/CollisionSystem.js', 'js/boss/Boss.js', 'js/data/AircraftCatalog.js', 'js/systems/AircraftManager.js',
    'js/data/EquipmentCatalog.js', 'js/systems/EquipmentManager.js',
    'js/data/PetCatalog.js', 'js/systems/PetManager.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')
    .replace(/^class\s+(\w+)/gm, 'global.$1 = class $1'), { filename: file }));

function makeStorage() {
    const map = new Map();
    return { getItem(k) { return map.get(k) || null; }, setItem(k,v) { map.set(k, v); } };
}
function fixture(rng = () => .5, storage = makeStorage()) {
    const game = {
        state: GameConfig.STATES.MENU,
        stateMachine: { getCurrentStateName() { return game.state; } },
        player: new Player(), bulletSystem: new BulletSystem(), enemies: [], currentBoss: null
    };
    game.aircraftManager = new AircraftManager(game);
    game.equipmentManager = new EquipmentManager(game, storage, rng);
    game.petManager = new PetManager(game, storage, rng);
    game.aircraftManager.applyAircraft();
    return { game, pets: game.petManager, storage };
}
const tests = [];
function test(label, fn) { tests.push([label, fn]); }

test('8只历史名称宠物具独立分级、技能配置', () => {
    assert.equal(PetCatalog.list().length, 8);
    assert.equal(new Set(PetCatalog.list().map(x => x.id)).size, 8);
    for (const pet of PetCatalog.list()) {
        assert.ok(PetCatalog.RARITIES[pet.rarity]);
        assert.ok(pet.shotDamage > 0);
        assert.ok(pet.fireInterval > 0);
    }
});

test('1000次抽奖不用金币/钻石，宠物抽数与装备抽数隔离', () => {
    const { pets, game } = fixture();
    for (let i = 0; i < 100; i++) assert.equal(pets.draw(10, 'coin').length, 10);
    assert.equal(pets.drawCount, 1000);
    assert.equal(game.equipmentManager.drawCount, 0);
    assert.equal(game.equipmentManager.getCurrency().gold, Infinity);
});

test('金币钻石池分别10抽史诗+、30抽传说保底', () => {
    for (const banner of ['coin', 'gem']) {
        const { pets } = fixture(() => .5);
        const draws = pets.draw(10, banner).concat(pets.draw(10, banner), pets.draw(10, banner));
        assert.equal(draws[9].rarity, 'epic');
        assert.equal(draws[9].guaranteed, true);
        assert.equal(draws[29].rarity, 'legendary');
        assert.equal(draws[29].guaranteed, true);
        assert.equal(pets.pity[banner].legendary, 0);
    }
});

test('两池保底独立，装备池与宠物池也独立', () => {
    const { pets, game } = fixture();
    pets.draw(10, 'coin');
    assert.equal(pets.pity.gem.epic, 0);
    assert.equal(game.equipmentManager.pity.coin.epic, 0);
});

test('重复宠物保留份数，不删除升级与出战记录', () => {
    const { pets } = fixture(() => .5);
    const a = pets.draw(1, 'gem')[0];
    const b = pets.draw(1, 'gem')[0];
    assert.equal(a.petId, b.petId);
    assert.equal(a.newItem, true);
    assert.equal(b.newItem, false);
    assert.equal(pets.inventory[a.petId].copies, 2);
    pets.equip(a.petId, 0);
    pets.upgrade(a.petId, true);
    pets.draw(1, 'gem');
    assert.equal(pets.inventory[a.petId].level, 10);
    assert.equal(pets.slots[0], a.petId);
});

test('最多两只且不能同一只双槽重复出战', () => {
    const { pets } = fixture();
    pets.unlockAllMax();
    assert.equal(pets.getActive().length, 2);
    assert.equal(pets.equip('kun', 0), true);
    assert.deepEqual(pets.slots, ['kun', null]);
    assert.equal(pets.getActive().length, 1);
    assert.equal(pets.equip('thunder_leopard', 1), true);
    assert.equal(pets.equip('nonsense', 0), false);
    assert.equal(pets.equip('kun', 2), false);
});

test('出战和满级真正叠加主机属性，并能正常恢复', () => {
    const { pets, game } = fixture();
    const baseHP = game.player.maxHealth;
    const baseDamage = game.player.weaponManager.activeWeapon.damage;
    pets.unlockAllMax();
    assert.ok(game.player.maxHealth > baseHP);
    assert.ok(game.player.weaponManager.activeWeapon.damage > baseDamage);
    assert.ok(game.player.health <= game.player.maxHealth);
    pets.unequip(0);
    pets.unequip(1);
    assert.equal(game.player.maxHealth, baseHP);
    assert.equal(game.player.weaponManager.activeWeapon.damage, baseDamage);
});

test('战斗中宠物按间隔自动发弹，且可攻击Boss', () => {
    const { pets, game } = fixture();
    pets.unlockAllMax();
    game.aircraftManager.prepareForBattle();
    game.state = GameConfig.STATES.PLAYING;
    game.currentBoss = { x: 320, y: 130, active: true, isDead: false };
    pets.update(.1);
    assert.ok(game.bulletSystem.bullets.length >= 2);
    assert.ok(game.bulletSystem.bullets.some(b => b.damage > 0 && b.vy < 0));
    const before = game.bulletSystem.bullets.length;
    pets.update(.1);
    assert.equal(game.bulletSystem.bullets.length, before);
    pets.update(2);
    assert.ok(game.bulletSystem.bullets.length > before);
});

test('辅助技能可回血、护盾和清除敌方子弹', () => {
    const { pets, game } = fixture();
    pets.unlockAllMax();
    game.player.health = 15;
    pets.support(PetCatalog.get('kun'), 10);
    assert.ok(game.player.health > 15);
    pets.support(PetCatalog.get('imperial_cat'), 10);
    assert.equal(game.player.shieldActive, true);
    game.bulletSystem.addEnemyBullet({ x: game.player.x, y: game.player.y, active: true });
    pets.support(PetCatalog.get('wuchang'), 10);
    assert.equal(game.bulletSystem.enemyBullets[0].active, false);
});

test('战斗、暂停禁止抽奖换宠及升级', () => {
    const { pets, game } = fixture();
    pets.unlockAllMax();
    const count = pets.drawCount;
    game.state = GameConfig.STATES.PLAYING;
    assert.equal(pets.draw(10, 'gem'), null);
    assert.equal(pets.equip('wuchang', 0), false);
    assert.equal(pets.unequip(0), false);
    assert.equal(pets.upgrade('wuchang'), false);
    assert.equal(pets.unlockAllMax(), false);
    game.state = GameConfig.STATES.PAUSED;
    assert.equal(pets.draw(1, 'coin'), null);
    assert.equal(pets.drawCount, count);
});

test('本地存档恢复保底、重复、满级和双槽，保留装备存档', () => {
    const storage = makeStorage();
    const a = fixture(() => .5, storage);
    a.pets.draw(10, 'gem');
    a.pets.unlockAllMax();
    a.pets.equip('wuchang', 1);
    a.game.equipmentManager.unlockAllMax();
    const b = fixture(() => .5, storage);
    assert.equal(b.pets.drawCount, 10);
    assert.deepEqual(b.pets.slots, ['thunder_leopard', 'wuchang']);
    assert.equal(b.pets.inventory.wuchang.level, 10);
    assert.equal(b.game.equipmentManager.getModifiers().fullSet, 'dog');
});

test('存档篡改不会凭空获得宠物，重复上场自动去重', () => {
    const storage = makeStorage();
    storage.setItem(PetManager.STORAGE_KEY, JSON.stringify({
        version: 1, inventory: { kun: { copies: 1, level: 100 }, invented: { copies: 20, level: 10 } },
        slots: ['kun', 'kun'], pity: { gem: { epic: -3, legendary: 999 } }
    }));
    const { pets } = fixture(() => .5, storage);
    assert.deepEqual(pets.slots, ['kun', null]);
    assert.equal(pets.inventory.invented, undefined);
    assert.equal(pets.inventory.kun.level, 10);
    assert.equal(pets.pity.gem.epic, 0);
    assert.equal(pets.pity.gem.legendary, 29);
});


test('宠物实际命中Boss：部分破防有效，玩家原伤害公式不变', () => {
    const { game, pets } = fixture();
    pets.inventory.abyss_soul = { copies: 1, level: 1 };
    pets.equip('abyss_soul', 0);
    const boss = new Boss({ maxHealth: 1000 });
    boss.isEntering = false;
    boss.invulnerable = false;
    boss.x = game.player.x - 43;
    boss.y = game.player.y - 62;
    game.currentBoss = boss;
    pets.update(.01);
    const bullet = game.bulletSystem.bullets[0];
    bullet.x = boss.x; bullet.y = boss.y;
    const health = boss.health;
    new CollisionSystem().processCollisions({
        player: game.player, enemies: [], boss,
        petManager: pets, bulletSystem: game.bulletSystem, powerups: []
    });
    const petDamage = health - boss.health;
    assert.ok(petDamage >= 4, 'pet should no longer deal only 0.9 HP: ' + petDamage);
    assert.equal(bullet.active, false);
    const normal = new Boss({ maxHealth: 1000 });
    normal.isEntering = false; normal.invulnerable = false;
    normal.takeDamage(12);
    assert.ok(Math.abs(1000-normal.health-.9) < 1e-7, 'ordinary player bullets keep old defense formula');
});

test('宠物子弹正常攻击敌机，真正连锁跳跃到附近两个目标', () => {
    const { game, pets } = fixture();
    pets.inventory.thunder_fox = { copies: 1, level: 1 };
    pets.equip('thunder_fox', 0);
    const coords = [[300,400], [380,380], [470,375], [620,180]];
    const enemies = coords.map(([x,y]) => new Enemy({ x,y,maxHealth:100,dropRate:0 }));
    game.enemies = enemies;
    pets.update(.01);
    const bullet = game.bulletSystem.bullets[0];
    assert.equal(bullet.chainJumps, 2);
    game.bulletSystem.bullets = [bullet]; // inspect one real pet shot
    bullet.x = enemies[0].x; bullet.y = enemies[0].y;
    new CollisionSystem().processCollisions({
        player:game.player,enemies,petManager:pets,
        bulletSystem:game.bulletSystem,powerups:[]
    });
    assert.ok(enemies[0].health < 100);
    assert.ok(enemies[1].health < 100);
    assert.ok(enemies[2].health < 100);
    assert.equal(enemies[3].health, 100);
    assert.ok(100-enemies[1].health > 100-enemies[2].health);
    assert.equal(pets.effects.events.filter(x => x.kind === 'bolt').length, 2);
});

test('连锁闪电可攻击Boss并使用宠物专属减防规则', () => {
    const { game, pets } = fixture();
    pets.inventory.thunder_leopard = { copies: 1, level: 10 };
    pets.equip('thunder_leopard', 0);
    const first = new Enemy({ x:320,y:390,maxHealth:1000,dropRate:0 });
    const boss = new Boss({ maxHealth: 1500 });
    boss.isEntering=false; boss.invulnerable=false;
    boss.x=430; boss.y=360;
    game.enemies=[first];game.currentBoss=boss;
    pets.update(.01);
    const b=game.bulletSystem.bullets[0];
    game.bulletSystem.bullets=[b];
    b.x=first.x;b.y=first.y;
    const oldHP=boss.health;
    new CollisionSystem().processCollisions({
        player:game.player,enemies:game.enemies,boss,
        petManager:pets,bulletSystem:game.bulletSystem,powerups:[]
    });
    assert.ok(boss.health < oldHP);
    assert.ok(pets.effects.events.some(x => x.kind === 'bolt'));
});

test('回血、护盾和清弹触发即时光效且随时间消退', () => {
    const { game, pets } = fixture();
    pets.inventory.kun={copies:1,level:10};
    pets.equip('kun',0);
    game.player.health = 15;
    const health=game.player.health;
    pets.update(4.1);
    assert.ok(game.player.health>health);
    assert.ok(pets.effects.events.some(e=>e.kind==='text' && e.text.includes('HP')));
    pets.support(PetCatalog.get('imperial_cat'),10);
    assert.ok(pets.effects.events.some(e=>e.kind==='shield'));
    game.bulletSystem.addEnemyBullet({x:game.player.x,y:game.player.y,active:true});
    pets.support(PetCatalog.get('wuchang'),10);
    assert.ok(pets.effects.events.some(e=>e.kind==='ring' && e.radius===210));
    const recorded=pets.effects.events.length;
    let calls=0;
    const ctx={save(){},restore(){},beginPath(){},moveTo(){calls++},lineTo(){calls++},
        stroke(){calls++},arc(){calls++},fillText(){calls++}};
    pets.effects.render(ctx);
    assert.ok(recorded>0 && calls>0);
    pets.effects.update(2);
    assert.equal(pets.effects.events.length,0);
});

test('对象池不会将宠物标记或追踪状态泄漏给玩家子弹', () => {
    const system=new BulletSystem();
    const b=system.addPlayerBullet({x:100,y:100,petId:'kun',chainJumps:2,
        isTracking:true,trackingSpeed:4,active:true});
    b.active=false;
    system.update(.016,[]);
    const normal=system.addPlayerBullet({x:0,y:0,damage:10,active:true});
    assert.equal(normal.petId,null);
    assert.equal(normal.chainJumps,0);
    assert.equal(normal.isTracking,false);
    assert.equal(normal.target,null);
});

let pass = 0;
for (const [label, fn] of tests) {
    try { fn(); console.log('PASS ' + label); pass++; }
    catch (err) { console.error('FAIL ' + label + ': ' + err.stack); }
}
console.log('P3 pets: ' + pass + '/' + tests.length);
if (pass !== tests.length) process.exitCode = 1;
