/**
 * Non-monetary equipment collection and pity-based loot draw.
 * Both currencies are deliberately infinite: no purchases, payments or depletion.
 * Browser localStorage stores only the user's collection.
 */
/**
 * Non-blocking equipment visual effects.
 * Event particles are draw-only and never decide damage.
 */
class GearVFX {
    constructor() { this.events = []; }
    add(kind, x, y, color, options = {}) {
        const duration = options.duration || .75;
        this.events.push({ kind, x, y, color, ...options, duration, remaining:duration });
        if (this.events.length > 70) this.events.splice(0, this.events.length - 70);
    }
    clear() { this.events.length = 0; }
    update(dt) {
        for (const e of this.events) e.remaining -= dt;
        this.events = this.events.filter(e => e.remaining > 0);
    }
    render(renderer) {
        const ctx = renderer?.ctx;
        if (!ctx) return;
        for (const e of this.events) {
            const progress = Math.max(0, Math.min(1, 1 - e.remaining / e.duration));
            ctx.save();
            ctx.globalAlpha = Math.min(1, Math.max(0, e.remaining / e.duration));
            ctx.strokeStyle = e.color;
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 12;
            if (e.kind === 'ring' || e.kind === 'shield') {
                const radius = e.kind === 'shield' ? 22 + progress * 38 : 10 + (e.radius || 180) * progress;
                ctx.lineWidth = 4 - progress * 2;
                ctx.beginPath();
                ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (e.kind === 'line') {
                ctx.lineWidth = e.width || 5;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x2, e.y2);
                ctx.stroke();
            } else if (e.kind === 'burst') {
                const points = e.points || 12;
                const size = 16 + progress * (e.radius || 70);
                ctx.lineWidth = 2.5;
                for (let i=0;i<points;i++) {
                    const a = 2*Math.PI*i/points + progress*.4;
                    ctx.beginPath();
                    ctx.moveTo(e.x+Math.cos(a)*size*.46, e.y+Math.sin(a)*size*.46);
                    ctx.lineTo(e.x+Math.cos(a)*size, e.y+Math.sin(a)*size);
                    ctx.stroke();
                }
            } else if (e.kind === 'text') {
                ctx.shadowColor = '#09132A';
                ctx.font = 'bold 17px Microsoft YaHei, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(e.text || '', e.x, e.y - progress * 32);
            }
            ctx.restore();
        }
    }
}

class EquipmentManager {
    static STORAGE_KEY = 'plane-dream-gear-v1';
    static MAX_LEVEL = 10;

    constructor(game, storage = (typeof localStorage !== 'undefined' ? localStorage : null), random = Math.random) {
        this.game = game;
        this.storage = storage;
        this.random = random;
        this.inventory = {};
        this.equipped = {};
        this.pity = { coin: { epic: 0, legendary: 0 }, gem: { epic: 0, legendary: 0 } };
        this.drawCount = 0;
        this.cooldowns = new Map();
        this.fx = new GearVFX();
        this.load();
    }

    getCurrency() {
        return { gold: Infinity, diamonds: Infinity }; // decorative currency: nothing is ever deducted
    }

    canEdit() {
        const state = this.game?.stateMachine?.getCurrentStateName?.();
        return state !== GameConfig.STATES.PLAYING && state !== GameConfig.STATES.PAUSED;
    }

    load() {
        if (!this.storage) return;
        try {
            const data = JSON.parse(this.storage.getItem(EquipmentManager.STORAGE_KEY) || 'null');
            if (!data || data.version !== 1) return;
            for (const [id, record] of Object.entries(data.inventory || {})) {
                if (!EquipmentCatalog.get(id)) continue;
                this.inventory[id] = {
                    copies: Math.max(0, Math.min(999999, Math.floor(Number(record.copies) || 0))),
                    level: Math.max(1, Math.min(10, Math.floor(Number(record.level) || 1)))
                };
                if (!this.inventory[id].copies) delete this.inventory[id];
            }
            for (const slot of EquipmentCatalog.SLOTS) {
                const id = data.equipped?.[slot];
                if (EquipmentCatalog.get(id)?.slot === slot && this.inventory[id]) this.equipped[slot] = id;
            }
            for (const banner of ['coin', 'gem']) {
                for (const tier of ['epic', 'legendary']) {
                    const n = Number(data.pity?.[banner]?.[tier]);
                    if (Number.isFinite(n)) this.pity[banner][tier] = Math.max(0, Math.min(29, Math.floor(n)));
                }
            }
            this.drawCount = Math.max(0, Math.floor(Number(data.drawCount) || 0));
        } catch (err) {
            console.warn('装备存档读取失败，使用全新档案', err);
        }
    }

    save() {
        if (!this.storage) return;
        try {
            this.storage.setItem(EquipmentManager.STORAGE_KEY, JSON.stringify({
                version: 1, inventory: this.inventory, equipped: this.equipped,
                pity: this.pity, drawCount: this.drawCount
            }));
        } catch (err) {
            console.warn('装备存档无法写入', err);
        }
    }

    pickRarity(banner) {
        const pity = this.pity[banner];
        // Both banners guarantee >= Epic by 10 draws, Legendary by 30 draws.
        if (pity.legendary >= 29) return 'legendary';
        if (pity.epic >= 9) {
            return this.random() < (banner === 'gem' ? 0.24 : 0.12) ? 'legendary' : 'epic';
        }
        const r = this.random();
        const rates = banner === 'gem' ? { common: .55, epic: .35 } : { common: .70, epic: .27 };
        return r < rates.common ? 'common' : r < rates.common + rates.epic ? 'epic' : 'legendary';
    }

    draw(count = 1, banner = 'gem') {
        if (![1, 10].includes(count) || !['coin', 'gem'].includes(banner) || !this.canEdit()) return null;
        const results = [];
        for (let i = 0; i < count; i++) {
            const forcedLegend = this.pity[banner].legendary >= 29;
            const forcedEpic = this.pity[banner].epic >= 9 && !forcedLegend;
            const rarity = this.pickRarity(banner);
            const pool = EquipmentCatalog.byRarity(rarity);
            const def = pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))];
            const old = this.inventory[def.id];
            const isNew = !old;
            if (old) old.copies = Math.min(999999, old.copies + 1);
            else this.inventory[def.id] = { copies: 1, level: 1 };
            this.pity[banner].epic = rarity === 'common' ? this.pity[banner].epic + 1 : 0;
            this.pity[banner].legendary = rarity === 'legendary' ? 0 : this.pity[banner].legendary + 1;
            results.push({
                itemId: def.id, name: def.name, set: def.set || null, rarity,
                newItem: isNew, copies: this.inventory[def.id].copies,
                guaranteed: forcedLegend || forcedEpic
            });
            this.drawCount++;
        }
        this.save();
        return results;
    }

    equip(id) {
        const def = EquipmentCatalog.get(id);
        if (!this.canEdit() || !def || !this.inventory[id]) return false;
        this.equipped[def.slot] = id;
        this.save();
        this.refreshPlayer();
        return true;
    }

    unequip(slot) {
        if (!this.canEdit() || !EquipmentCatalog.SLOTS.includes(slot)) return false;
        delete this.equipped[slot];
        this.save();
        this.refreshPlayer();
        return true;
    }

    equipSet(setId) {
        if (!this.canEdit() || !EquipmentCatalog.SETS[setId]) return false;
        const parts = EquipmentCatalog.ITEMS.filter(x => x.set === setId);
        if (!parts.every(x => this.inventory[x.id])) return false;
        for (const part of parts) this.equipped[part.slot] = part.id;
        this.save();
        this.refreshPlayer();
        return true;
    }

    upgrade(id, toMax = false) {
        if (!this.canEdit() || !this.inventory[id]) return false;
        const gear = this.inventory[id];
        if (gear.level >= EquipmentManager.MAX_LEVEL) return false;
        gear.level = toMax ? EquipmentManager.MAX_LEVEL : gear.level + 1;
        this.save();
        this.refreshPlayer();
        return true;
    }

    unlockAllMax() {
        if (!this.canEdit()) return false;
        for (const def of EquipmentCatalog.ITEMS) {
            this.inventory[def.id] = { copies: Math.max(1, this.inventory[def.id]?.copies || 0), level: 10 };
        }
        this.equipSet('dog');
        this.save();
        return true;
    }

    getModifiers() {
        const mod = { damage: 1, health: 1, speed: 1, energy: 1, skillCooldown: 1, setCounts: { dog: 0, pig: 0 }, fullSet: null };
        for (const slot of EquipmentCatalog.SLOTS) {
            const id = this.equipped[slot];
            const def = EquipmentCatalog.get(id);
            const record = this.inventory[id];
            if (!def || !record) continue;
            const rarity = EquipmentCatalog.RARITIES[def.rarity].factor;
            const strength = rarity * (1 + 0.12 * (record.level - 1));
            if (def.bonus === 'damage') mod.damage += 0.05 * strength;
            if (def.bonus === 'health') mod.health += 0.10 * strength;
            if (def.bonus === 'speed') mod.speed += 0.04 * strength;
            if (def.bonus === 'energy') mod.energy += 0.12 * strength;
            if (def.bonus === 'skill') mod.skillCooldown = Math.max(.6, mod.skillCooldown - .045 * strength);
            if (def.set) mod.setCounts[def.set]++;
        }
        if (mod.setCounts.dog >= 2) mod.damage += .10;
        if (mod.setCounts.pig >= 2) mod.health += .15;
        if (mod.setCounts.dog === 5) mod.fullSet = 'dog';
        if (mod.setCounts.pig === 5) mod.fullSet = 'pig';
        return mod;
    }

    refreshPlayer() {
        if (this.game?.aircraftManager && this.game?.player) this.game.aircraftManager.applyAircraft();
    }

    /**
     * Battle cooldowns are transient (never stored with the collection).
     * Cooldowns use seconds; draw inventory and enhancement data remain unchanged.
     */
    resetBattle() {
        this.cooldowns.clear();
        this.fx.clear();
    }

    equippedDefinition(slot) {
        const id = this.equipped[slot];
        return this.inventory[id] ? EquipmentCatalog.get(id) : null;
    }

    effectLevel(def) {
        return this.inventory[def.id]?.level || 1;
    }

    getManualSkillStatus() {
        const weapon = this.equippedDefinition('weapon');
        const skill = weapon?.ability?.trigger === 'manual' ? weapon.ability : null;
        return {
            name: skill?.name || '未装备主动武器',
            ready: !!skill && (this.cooldowns.get(weapon.id) || 0) <= 0,
            remaining: skill ? Math.max(0, this.cooldowns.get(weapon.id) || 0) : 0,
            cooldown: skill?.cooldown || 0,
            enabled: !!skill
        };
    }

    update(dt) {
        if (!(dt > 0)) return;
        this.fx.update(dt);
        if (this.game?.stateMachine?.getCurrentStateName?.() !== GameConfig.STATES.PLAYING) return;
        for (const slot of EquipmentCatalog.SLOTS) {
            const def = this.equippedDefinition(slot);
            if (!def?.ability || def.ability.trigger === 'on_skill') continue;
            const current = this.cooldowns.get(def.id);
            const remaining = (current === undefined
                ? (def.ability.trigger === 'auto' ? 2.7 + EquipmentCatalog.SLOTS.indexOf(slot) * .45 : 0)
                : current) - dt;
            if (remaining > 0) {
                this.cooldowns.set(def.id, remaining);
            } else if (def.ability.trigger === 'auto') {
                this.activateAbility(def);
                this.cooldowns.set(def.id, def.ability.cooldown);
            } else {
                this.cooldowns.set(def.id, 0);
            }
        }
    }

    useEquipmentSkill() {
        if (this.game?.stateMachine?.getCurrentStateName?.() !== GameConfig.STATES.PLAYING) return false;
        const def = this.equippedDefinition('weapon');
        if (!def || def.ability?.trigger !== 'manual' ||
            this.game.player?.isDead || (this.cooldowns.get(def.id) || 0) > 0) return false;
        this.activateAbility(def);
        this.cooldowns.set(def.id, def.ability.cooldown);
        return true;
    }

    /**
     * Damage hook: Player.takeDamage invokes this only when a hit is actually possible.
     * The dog armour blocks one hit (22s cooldown); pig armour absorbs part of each hit.
     */
    onBeforeDamage(damage) {
        const def = this.equippedDefinition('armor');
        if (!def || !(damage > 0)) return damage;
        const lv = this.effectLevel(def);
        const p = this.game.player;
        if (def.ability?.id === 'ward' && (this.cooldowns.get(def.id) || 0) <= 0) {
            p.activateShield(1900 + lv * 80);
            this.cooldowns.set(def.id, def.ability.cooldown);
            this.fx.add('shield', p.x, p.y, '#FFC578', {duration:1.2});
            this.fx.add('text', p.x, p.y-45, '#FFDB9D', {text:'云霄护体',duration:1.0});
            return 0;
        }
        if (def.ability?.id === 'mitigate') {
            const reduced = damage * (1 - .25 - .01 * lv);
            this.fx.add('ring', p.x, p.y, '#A5DBFF', {radius:56,duration:.45});
            this.fx.add('text', p.x, p.y-35, '#B5EEFF', {
                text:'减伤 ' + Math.round(damage - reduced), duration:.7
            });
            return reduced;
        }
        return damage;
    }

    /** Register a group of player bullets that go through the normal collision system. */
    shoot(def, count, opts = {}) {
        const p = this.game.player;
        const system = this.game.bulletSystem;
        if (!p || !system) return 0;
        const lv = this.effectLevel(def);
        const spread = opts.spread ?? .13;
        const shots = [];
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * spread;
            const speed = opts.speed || 700;
            shots.push({
                x:p.x + (i - (count - 1) / 2) * 7, y:p.y - 31,
                vx:Math.cos(angle) * speed, vy:Math.sin(angle) * speed,
                damage: Math.round((opts.damage || 70) * (1 + .075 * (lv - 1))),
                size: opts.size || 7, color:opts.color || '#FFE8B0',
                type: opts.type || 'standard', gearId:def.id,
                isTracking:!!opts.tracking, trackingSpeed:opts.tracking ? 6 : 0,
                penetration:opts.penetration || 0, active:true, maxLifetime:2500
            });
        }
        system.addBullets(shots, false);
        this.fx.add('burst', p.x, p.y - 32, opts.color || '#FFE8B0', {duration:.5,radius:90});
        this.fx.add('text', p.x, p.y - 65, opts.color || '#FFE8B0', {
            text:def.ability.name, duration:1
        });
        return shots.length;
    }

    /** Direct hits for shockwaves; Boss damage still goes through BossManager defenses. */
    areaDamage(def, range, damage, forwardOnly = false) {
        const p = this.game.player;
        const lv = this.effectLevel(def);
        const amount = Math.round(damage * (1 + .075 * (lv - 1)));
        let hit = 0;
        const enemies = (this.game.enemies || []).filter(x => x.active && !x.isDead);
        const boss = this.game.currentBoss;
        if (boss?.active && !boss.isDead && !boss.invulnerable) enemies.push(boss);
        for (const enemy of enemies) {
            const dx = enemy.x - p.x, dy = enemy.y - p.y;
            if (Math.hypot(dx, dy) > range || (forwardOnly && dy > 0)) continue;
            if (enemy === boss) {
                if (this.game.bossManager) this.game.bossManager.onBossDamage(amount, {x:enemy.x,y:enemy.y});
                else enemy.takeDamage(amount, {x:enemy.x,y:enemy.y});
            } else {
                enemy.takeDamage(amount);
            }
            this.fx.add('text',enemy.x,enemy.y - 22,def.set === 'dog'?'#FFD28B':'#A6EAFF',{
                text:'-' + amount,duration:.75
            });
            hit++;
        }
        return hit;
    }

    /** Each gear ID maps to a different real combat action. */
    activateAbility(def) {
        const p = this.game.player;
        if (!p || p.isDead) return 0;
        const lv = this.effectLevel(def);
        switch (def.ability?.id) {
            case 'tether':
                return this.shoot(def, 3, {damage:115,color:'#FFA451',tracking:true,type:'missile',size:9,spread:.23,speed:525});
            case 'flame':
                return this.shoot(def, 7, {damage:66,color:'#FF5C35',spread:.14,speed:830,size:8});
            case 'sunburst': {
                const hits = this.areaDamage(def,185,135);
                this.fx.add('ring',p.x,p.y,'#FFD75B',{radius:185,duration:.75});
                this.fx.add('text',p.x,p.y-55,'#FFE6A8',{text:def.ability.name,duration:1});
                return hits;
            }
            case 'meteor':
                return this.shoot(def,4,{damage:200,color:'#81DFFF',tracking:true,type:'missile',size:11,spread:.18,speed:490});
            case 'starfan':
                return this.shoot(def,9,{damage:78,color:'#5FB6FF',spread:.095,speed:790,penetration:1});
            case 'sweep': {
                const hits = this.areaDamage(def,285,190,true);
                this.fx.add('ring',p.x,p.y-85,'#74DFFF',{radius:260,duration:.65});
                this.fx.add('line',p.x-240,p.y-95,'#B2E9FF',{
                    x2:p.x+240,y2:p.y-95,width:7,duration:.55
                });
                this.fx.add('text',p.x,p.y-75,'#B5F0FF',{text:def.ability.name,duration:.95});
                return hits;
            }
            case 'elixir': {
                const before = p.health;
                p.heal(7 + lv);
                const healed = Math.round(p.health - before);
                if (healed) {
                    this.fx.add('ring',p.x,p.y,'#8AFFCD',{radius:80,duration:.7});
                    this.fx.add('text',p.x,p.y-55,'#8AFFCD',{text:'+'+healed+' HP',duration:1.0});
                }
                return healed;
            }
            default: return 0;
        }
    }

    /** Draw-only overlays never change the outcome of a collision. */
    render(renderer) { this.fx.render(renderer); }

    /** Called only after aircraft skill successfully fires. */
    onSkillUsed() {
        const player = this.game.player;
        const charm = this.equippedDefinition('charm');
        if (charm?.ability?.id === 'edict') {
            let cleared = 0;
            for (const bullet of this.game.bulletSystem?.enemyBullets || []) {
                if (bullet.active && Math.hypot(bullet.x-player.x, bullet.y-player.y) <= 225) {
                    bullet.active = false;
                    cleared++;
                }
            }
            this.fx.add('ring',player.x,player.y,'#FFB46D',{radius:225,duration:.65});
            this.fx.add('text',player.x,player.y-55,'#FFD3A5',{
                text:'如律令 清弹 '+cleared,duration:1.0
            });
        } else if (charm?.ability?.id === 'elixir') {
            player.energy = Math.min(player.maxEnergy, player.energy + 25);
            this.fx.add('burst',player.x,player.y,'#8DF6FF',{radius:85,duration:.65});
            this.fx.add('text',player.x,player.y-55,'#AEF5FF',{
                text:'金元丹 +25 能量',duration:1.0
            });
        }
        const setId = this.getModifiers().fullSet;
        if (!setId || !this.game.bulletSystem) return 0;
        const shots = [];
        const color = setId === 'dog' ? '#FF9B49' : '#6DD7FF';
        for (let i = -4; i <= 4; i++) {
            const angle = -Math.PI / 2 + i * .12;
            shots.push({
                x: player.x + i * 8, y: player.y - 25, vx: Math.cos(angle) * 680,
                vy: Math.sin(angle) * 680, size: 7, damage: setId === 'dog' ? 135 : 115,
                color, type: 'standard', penetration: 1, active: true, maxLifetime: 2600
            });
        }
        this.game.bulletSystem.addBullets(shots, false);
        this.fx.add('burst', player.x, player.y - 28, color, {
            radius: 115, duration:.85, points: setId === 'dog' ? 12 : 16
        });
        this.fx.add('text', player.x, player.y - 72, color, {
            text:setId === 'dog' ? '犬焰齐放' : '星河齐放', duration:1.15
        });
        return shots.length;
    }
}