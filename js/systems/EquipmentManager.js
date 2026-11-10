/**
 * Non-monetary equipment collection and pity-based loot draw.
 * Both currencies are deliberately infinite: no purchases, payments or depletion.
 * Browser localStorage stores only the user's collection.
 */
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

    /** Called only after aircraft skill successfully fires. */
    onSkillUsed() {
        const setId = this.getModifiers().fullSet;
        if (!setId || !this.game.bulletSystem) return 0;
        const player = this.game.player;
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
        return shots.length;
    }
}