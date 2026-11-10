const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
[
    'js/core/GameConfig.js', 'js/combat/Weapon.js', 'js/combat/BulletSystem.js',
    'js/entities/Player.js', 'js/data/AircraftCatalog.js', 'js/systems/AircraftManager.js',
    'js/data/EquipmentCatalog.js', 'js/systems/EquipmentManager.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')
    .replace(/^class\s+(\w+)/gm, 'global.$1 = class $1'), { filename: file }));

function mockStorage() {
    const map = new Map();
    return { getItem: k => map.has(k) ? map.get(k) : null, setItem: (k,v) => map.set(k, v) };
}
function fixture(random = () => .5, store = mockStorage()) {
    const game = { state: GameConfig.STATES.MENU, stateMachine: {
        getCurrentStateName() { return game.state; }
    }, player: new Player(), bulletSystem: new BulletSystem() };
    game.aircraftManager = new AircraftManager(game);
    game.equipmentManager = new EquipmentManager(game, store, random);
    game.aircraftManager.applyAircraft();
    return { game, manager: game.equipmentManager, store };
}
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('装备目录 15 件，两组各 5 件，装备槽各一个', () => {
    assert.equal(EquipmentCatalog.ITEMS.length, 15);
    for (const set of ['dog', 'pig']) {
        const items = EquipmentCatalog.ITEMS.filter(x => x.set === set);
        assert.equal(items.length, 5);
        assert.equal(new Set(items.map(x => x.slot)).size, 5);
    }
});

test('无限金币钻石，1000 抽资源不会减少', () => {
    const { manager } = fixture();
    for (let i = 0; i < 100; i++) assert.equal(manager.draw(10, 'coin').length, 10);
    assert.equal(manager.drawCount, 1000);
    assert.equal(manager.getCurrency().gold, Infinity);
    assert.equal(manager.getCurrency().diamonds, Infinity);
});

test('金币抽和钻石抽都是10抽史诗或以上，30抽传说保底', () => {
    for (const banner of ['coin', 'gem']) {
        const { manager } = fixture(() => .5);
        const pulls = manager.draw(10, banner);
        assert.equal(pulls.length, 10);
        assert.notEqual(pulls[9].rarity, 'common');
        assert.equal(pulls[9].guaranteed, true);
        const next = manager.draw(10, banner).concat(manager.draw(10, banner));
        const all = pulls.concat(next);
        assert.equal(all[29].rarity, 'legendary');
        assert.equal(all[29].guaranteed, true);
        assert.ok(all.slice(0, 10).some(x => x.rarity !== 'common'));
        assert.ok(all.slice(10, 20).some(x => x.rarity !== 'common'));
        assert.ok(all.slice(20, 30).some(x => x.rarity === 'legendary'));
    }
});

test('重复奖励累计份数而不是删除已有装备', () => {
    const { manager } = fixture(() => .96);
    const a = manager.draw(1, 'gem')[0];
    const b = manager.draw(1, 'gem')[0];
    assert.equal(a.itemId, b.itemId);
    assert.equal(a.newItem, true);
    assert.equal(b.newItem, false);
    assert.equal(manager.inventory[a.itemId].copies, 2);
});

test('抽奖状态和装备库存可以跨刷新恢复', () => {
    const store = mockStorage();
    const first = fixture(() => .5, store);
    first.manager.draw(10, 'gem');
    const id = first.manager.draw(1, 'coin')[0].itemId;
    assert.equal(first.manager.equip(id), true);
    first.manager.upgrade(id, true);
    const second = fixture(() => .5, store);
    assert.equal(second.manager.drawCount, 11);
    assert.equal(second.manager.inventory[id].level, 10);
    assert.equal(second.manager.equipped[EquipmentCatalog.get(id).slot], id);
});

test('圆梦解锁与一键满级后套装可切换，战斗属性真正增加', () => {
    const { manager, game } = fixture();
    const originalHP = game.player.maxHealth;
    const originalDamage = game.player.weaponManager.activeWeapon.damage;
    assert.equal(manager.unlockAllMax(), true);
    assert.equal(Object.keys(manager.inventory).length, 15);
    assert.ok(Object.values(manager.inventory).every(x => x.level === 10));
    assert.equal(manager.getModifiers().fullSet, 'dog');
    assert.ok(game.player.weaponManager.activeWeapon.damage > originalDamage);
    assert.ok(game.player.maxHealth > originalHP);
    assert.equal(manager.equipSet('pig'), true);
    assert.equal(manager.getModifiers().fullSet, 'pig');
    assert.equal(manager.equipSet('nonexistent'), false);
});

test('仅有抽到装备才能穿戴，且装备槽位不串', () => {
    const { manager } = fixture();
    assert.equal(manager.equip('dog_weapon'), false);
    assert.equal(manager.upgrade('dog_weapon'), false);
    assert.equal(manager.unequip('anything'), false);
    manager.unlockAllMax();
    assert.equal(manager.equip('basic_blaster'), true);
    assert.equal(manager.equipped.weapon, 'basic_blaster');
    assert.equal(manager.equipped.armor, 'dog_armor');
});

test('战斗或暂停期间不能抽奖、换装备或升级', () => {
    const { manager, game } = fixture();
    manager.unlockAllMax();
    const pre = manager.drawCount;
    game.state = GameConfig.STATES.PLAYING;
    assert.equal(manager.draw(10, 'gem'), null);
    assert.equal(manager.upgrade('dog_weapon'), false);
    assert.equal(manager.equip('pig_weapon'), false);
    assert.equal(manager.unlockAllMax(), false);
    assert.equal(manager.drawCount, pre);
    game.state = GameConfig.STATES.PAUSED;
    assert.equal(manager.draw(1, 'coin'), null);
});

test('套装激活后，使用战机技能额外产生九发套装弹幕', () => {
    const { game, manager } = fixture();
    manager.unlockAllMax();
    game.aircraftManager.prepareForBattle();
    game.state = GameConfig.STATES.PLAYING;
    assert.equal(game.aircraftManager.useSkill(), true);
    assert.equal(game.bulletSystem.bullets.length, 17);
    assert.ok(game.aircraftManager.cooldownRemaining < game.aircraftManager.selected.skill.cooldown);
});

test('畸形存档不会使装备槽跨位或凭空获得装备', () => {
    const store = mockStorage();
    store.setItem(EquipmentManager.STORAGE_KEY, JSON.stringify({
        version: 1, inventory: { dog_weapon: { copies: 1, level: 100 }, imaginary: { copies: 100, level: 10 } },
        equipped: { armor: 'dog_weapon', weapon: 'dog_weapon' },
        pity: { gem: { epic: 999, legendary: -100 } }
    }));
    const { manager } = fixture(() => .5, store);
    assert.equal(manager.inventory.dog_weapon.level, 10);
    assert.equal(manager.inventory.imaginary, undefined);
    assert.equal(manager.equipped.armor, undefined);
    assert.equal(manager.equipped.weapon, 'dog_weapon');
    assert.equal(manager.pity.gem.epic, 29);
    assert.equal(manager.pity.gem.legendary, 0);
});

let pass = 0;
for (const { name, fn } of tests) {
    try { fn(); console.log('PASS: ' + name); pass++; }
    catch (e) { console.error('FAIL: ' + name + '\n' + e.stack); }
}
console.log('Equipment and gacha: ' + pass + '/' + tests.length);
if (pass !== tests.length) process.exitCode = 1;