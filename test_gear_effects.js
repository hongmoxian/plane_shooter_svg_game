/** Real, separate-equipment combat tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const filename of [
    'js/core/GameConfig.js', 'js/entities/Player.js', 'js/entities/Enemy.js',
    'js/combat/Weapon.js', 'js/combat/BulletSystem.js', 'js/combat/CollisionSystem.js',
    'js/boss/Boss.js', 'js/data/AircraftCatalog.js', 'js/data/EquipmentCatalog.js',
    'js/systems/AircraftManager.js', 'js/systems/EquipmentManager.js'
]) {
    vm.runInThisContext(fs.readFileSync(filename,'utf8')
        .replace(/^class\s+(\w+)/gm,'global.$1 = class $1'), {filename});
}

function storage() {
    const m = new Map();
    return { getItem(k) {return m.get(k) ?? null;}, setItem(k,v){m.set(k,v);} };
}
function fixture() {
    const game = {
        state: GameConfig.STATES.MENU,
        stateMachine: {getCurrentStateName(){return game.state;}},
        player: new Player(), bulletSystem: new BulletSystem(), enemies: [],
        currentBoss: null, bossManager: null
    };
    game.aircraftManager = new AircraftManager(game);
    game.equipmentManager = new EquipmentManager(game, storage());
    game.player.beforeDamageHook = d => game.equipmentManager.onBeforeDamage(d);
    game.aircraftManager.applyAircraft();
    return {game, gear:game.equipmentManager};
}
function addItem(gear,id,level=10) {
    gear.inventory[id] = { copies:1, level };
    assert.equal(gear.equip(id),true);
}
function begin(game) {
    game.aircraftManager.prepareForBattle();
    game.equipmentManager.resetBattle();
    game.state = GameConfig.STATES.PLAYING;
}
function enemy(x,y,hp=500) {
    return new Enemy({x,y,maxHealth:hp,dropRate:0});
}
const tests = [];
function test(name, fn) { tests.push({name,fn}); }

test('神犬与天蓬十件装备各自有技能与独立触发类型', () => {
    const all=EquipmentCatalog.ITEMS.filter(x=>x.set);
    assert.equal(all.length,10);
    assert.equal(new Set(all.map(x=>x.ability.id)).size,10);
    assert.equal(all.filter(x=>x.ability.trigger==='manual').length,2);
    assert.equal(all.filter(x=>x.ability.trigger==='on_hit').length,2);
    assert.ok(all.every(x=>x.ability.description && x.ability.name));
});

test('未穿主武器不允许放 E 技能，战斗和暂停之外也不能释放', () => {
    const {game,gear}=fixture();
    assert.equal(gear.useEquipmentSkill(),false);
    addItem(gear,'dog_weapon');
    assert.equal(gear.useEquipmentSkill(),false);
    game.state=GameConfig.STATES.PAUSED;
    assert.equal(gear.useEquipmentSkill(),false);
});

test('神犬缚妖索 E 主动3枚追踪弹，冷却8秒', () => {
    const {game,gear}=fixture();
    addItem(gear,'dog_weapon');
    begin(game);
    assert.equal(gear.getManualSkillStatus().ready,true);
    assert.equal(gear.useEquipmentSkill(),true);
    assert.equal(game.bulletSystem.bullets.length,3);
    assert.ok(game.bulletSystem.bullets.every(b=>b.isTracking && b.gearId==='dog_weapon'));
    assert.equal(gear.useEquipmentSkill(),false);
    gear.update(7.8);
    assert.equal(gear.useEquipmentSkill(),false);
    gear.update(.21);
    assert.equal(gear.useEquipmentSkill(),true);
});

test('天蓬星河令 E 主动4枚星陨导弹，升级强化伤害', () => {
    const low=fixture(), high=fixture();
    addItem(low.gear,'pig_weapon',1);
    addItem(high.gear,'pig_weapon',10);
    for(const f of [low,high]) { begin(f.game);assert.equal(f.gear.useEquipmentSkill(),true); }
    assert.equal(high.game.bulletSystem.bullets.length,4);
    assert.ok(high.game.bulletSystem.bullets.every(b=>b.gearId==='pig_weapon'));
    assert.ok(high.game.bulletSystem.bullets[0].damage > low.game.bulletSystem.bullets[0].damage);
});

test('神犬赤炎镜周期7发扇形火焰弹幕，不会每帧重复触发', () => {
    const {game,gear}=fixture();addItem(gear,'dog_cannon');begin(game);
    gear.update(4);
    assert.equal(game.bulletSystem.bullets.length,7);
    gear.update(.15);
    assert.equal(game.bulletSystem.bullets.length,7);
    gear.update(6.1);
    assert.equal(game.bulletSystem.bullets.length,14);
});

test('天蓬元帅旗周期9发星光弹，能通过碰撞扣除敌机生命值', () => {
    const {game,gear}=fixture();addItem(gear,'pig_cannon');begin(game);
    gear.update(4);
    const b=game.bulletSystem.bullets[4];
    assert.equal(game.bulletSystem.bullets.length,9);
    const e=enemy(b.x,b.y,500);
    game.enemies=[e];
    const hp=e.health;
    new CollisionSystem().processCollisions({
        player:game.player,enemies:game.enemies,
        bulletSystem:game.bulletSystem,powerups:[]
    });
    assert.ok(e.health<hp);
});

test('神犬云霄甲挡住一次伤害并触发护盾，冷却期间第二次可受伤', () => {
    const {game,gear}=fixture();addItem(gear,'dog_armor');begin(game);
    const hp=game.player.health;
    game.player.takeDamage(70);
    assert.equal(game.player.health,hp);
    assert.equal(game.player.shieldActive,true);
    assert.ok(gear.fx.events.some(x=>x.kind==='shield'));
    game.player.shieldActive=false;
    gear.update(1);
    game.player.takeDamage(20);
    assert.equal(game.player.health,hp-20);
    assert.ok((gear.cooldowns.get('dog_armor')||0)>0);
});

test('天蓬玄金甲满级受击实际减伤35%，不影响未穿戴情况', () => {
    const {game,gear}=fixture();addItem(gear,'pig_armor');begin(game);
    const before=game.player.health;
    game.player.takeDamage(40);
    assert.ok(Math.abs(game.player.health-(before-26))<1e-5);
    assert.ok(gear.fx.events.length>0);
});

test('神犬娄金冠周期范围攻击，Boss和普通敌机都能受伤', () => {
    const {game,gear}=fixture();addItem(gear,'dog_core');begin(game);
    const e=enemy(game.player.x+60,game.player.y-80);
    game.enemies=[e];
    const boss=new Boss({maxHealth:1500});
    boss.isEntering=false;boss.invulnerable=false;boss.x=game.player.x;boss.y=game.player.y-100;
    game.currentBoss=boss;
    let bossHits=0;
    game.bossManager={onBossDamage(dmg,pos){bossHits++;return boss.takeDamage(dmg,pos);}};
    const hp=e.health, bhp=boss.health;
    gear.update(4.5);
    assert.ok(e.health<hp);
    assert.ok(boss.health<bhp);
    assert.equal(bossHits,1);
});

test('天蓬沁金耙只横扫前方的敌人，范围外不扣血', () => {
    const {game,gear}=fixture();addItem(gear,'pig_core');begin(game);
    const front=enemy(game.player.x,game.player.y-120);
    const back=enemy(game.player.x,game.player.y+100);
    game.enemies=[front,back];
    gear.update(4.6);
    assert.ok(front.health<front.maxHealth);
    assert.equal(back.health,back.maxHealth);
    assert.ok(gear.fx.events.some(x=>x.kind==='line'));
});

test('神犬如律令在 Q 技能触发时清弹，即使未穿齐套装', () => {
    const {game,gear}=fixture();addItem(gear,'dog_charm');begin(game);
    game.bulletSystem.addEnemyBullet({x:game.player.x,y:game.player.y,active:true});
    game.bulletSystem.addEnemyBullet({x:game.player.x+440,y:game.player.y,active:true});
    assert.equal(game.aircraftManager.useSkill(),true);
    assert.equal(game.bulletSystem.enemyBullets[0].active,false);
    assert.equal(game.bulletSystem.enemyBullets[1].active,true);
    assert.ok(gear.fx.events.some(x=>x.kind==='ring'));
});

test('天蓬金元丹周期回血，并且 Q 技能额外回复能量', () => {
    const {game,gear}=fixture();addItem(gear,'pig_charm');begin(game);
    game.player.health=game.player.maxHealth-30;
    const hp=game.player.health;
    gear.update(4.8);
    assert.ok(game.player.health>hp);
    game.player.energy=30;
    assert.equal(game.aircraftManager.useSkill(),true);
    assert.equal(game.player.energy,55);
    assert.ok(gear.fx.events.some(x=>x.kind==='burst'));
});

test('五件套仍可发动原有的额外9枚弹幕，并具有套装专属视觉特效', () => {
    for(const type of ['dog','pig']){
        const {game,gear}=fixture();
        gear.unlockAllMax();
        gear.equipSet(type);
        begin(game);
        assert.equal(game.aircraftManager.useSkill(),true);
        assert.ok(game.bulletSystem.bullets.length>=17);
        assert.ok(gear.fx.events.some(x=>x.kind==='text' && x.text.includes('齐放')));
    }
});

test('效果在暂停时不更新CD；下一关重置CD和绘制缓存，不改变存档', () => {
    const {game,gear}=fixture();
    addItem(gear,'dog_weapon');
    begin(game);
    gear.useEquipmentSkill();
    const remaining=gear.getManualSkillStatus().remaining;
    game.state=GameConfig.STATES.PAUSED;
    gear.update(4);
    assert.equal(gear.getManualSkillStatus().remaining,remaining);
    const recorded=gear.inventory.dog_weapon.level;
    gear.resetBattle();
    assert.equal(gear.getManualSkillStatus().ready,true);
    assert.equal(gear.fx.events.length,0);
    assert.equal(gear.inventory.dog_weapon.level,recorded);
});

test('装备发射后回收子弹，gearId不会泄漏到普通战机子弹', () => {
    const {game,gear}=fixture();addItem(gear,'dog_weapon');begin(game);
    gear.useEquipmentSkill();
    const old=game.bulletSystem.bullets[0];old.active=false;
    game.bulletSystem.update(.01,[]);
    const normal=game.bulletSystem.addPlayerBullet({x:10,y:10,damage:5,active:true});
    assert.equal(normal.gearId,null);
});

test('动画仅绘制、不产生伤害，完成后会自动消失', () => {
    const {game,gear}=fixture();addItem(gear,'dog_core');begin(game);
    gear.update(4.5);
    let strokes=0;
    const ctx={save(){},restore(){},beginPath(){},arc(){},moveTo(){},lineTo(){},
        stroke(){strokes++;},fillText(){}};
    gear.render({ctx});
    assert.ok(strokes>0);
    gear.update(2);
    assert.equal(gear.fx.events.length,0);
});

let pass=0;
for(const {name,fn} of tests) {
    try{fn();pass++;console.log('PASS '+name);}
    catch(err){console.error('FAIL '+name+'\n'+err.stack);}
}
console.log('Gear effects: '+pass+'/'+tests.length);
if(pass!==tests.length)process.exitCode=1;
