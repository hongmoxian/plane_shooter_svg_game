/**
 * Pets: two unique active companions, passive stat buffs, automatic projectiles,
 * periodic assist effects and a separate free gacha.
 * Skill values and drop rates are fan-made, not official game data.
 */
class PetManager {
    static STORAGE_KEY = 'plane-dream-pets-v1';
    static MAX_LEVEL = 10;
    static RATES = Object.freeze({
        coin: Object.freeze({ rare: .70, epic: .27, legendary: .03 }),
        gem: Object.freeze({ rare: .55, epic: .35, legendary: .10 })
    });

    constructor(game, storage = typeof localStorage === 'undefined' ? null : localStorage, rng = Math.random) {
        this.game = game;
        this.storage = storage;
        this.rng = rng;
        this.inventory = {};
        this.slots = [null, null];
        this.pity = { coin: { epic: 0, legendary: 0 }, gem: { epic: 0, legendary: 0 } };
        this.drawCount = 0;
        this.timers = new Map();
        this.supportTimers = new Map();
        this.load();
    }

    canEdit() {
        const state = this.game?.stateMachine?.getCurrentStateName?.();
        return state !== GameConfig.STATES.PLAYING && state !== GameConfig.STATES.PAUSED;
    }

    load() {
        if (!this.storage) return;
        try {
            const data = JSON.parse(this.storage.getItem(PetManager.STORAGE_KEY) || 'null');
            if (data?.version !== 1) return;
            for (const [id, rec] of Object.entries(data.inventory || {})) {
                if (!PetCatalog.get(id)) continue;
                const copies = Math.min(999999, Math.max(0, Math.floor(Number(rec.copies) || 0)));
                if (copies > 0) this.inventory[id] = {
                    copies, level: Math.max(1, Math.min(10, Math.floor(Number(rec.level) || 1)))
                };
            }
            const slots = Array.isArray(data.slots) ? data.slots : [];
            for (let i = 0; i < 2; i++) {
                const id = slots[i];
                if (id && this.inventory[id] && PetCatalog.get(id) && !this.slots.includes(id)) this.slots[i] = id;
            }
            for (const banner of ['coin', 'gem']) {
                const values = data.pity?.[banner];
                for (const r of ['epic', 'legendary']) {
                    const n = Number(values?.[r]);
                    if (Number.isFinite(n)) this.pity[banner][r] = Math.min(29, Math.max(0, Math.floor(n)));
                }
            }
            this.drawCount = Math.min(1000000000, Math.max(0, Math.floor(Number(data.drawCount) || 0)));
        } catch (error) {
            console.warn('宠物存档异常，启用新存档', error);
        }
    }

    save() {
        if (!this.storage) return;
        try {
            this.storage.setItem(PetManager.STORAGE_KEY, JSON.stringify({
                version: 1, inventory: this.inventory, slots: this.slots,
                pity: this.pity, drawCount: this.drawCount
            }));
        } catch (error) {
            console.warn('宠物存档写入失败', error);
        }
    }

    pickRarity(banner) {
        const pity = this.pity[banner];
        if (pity.legendary >= 29) return 'legendary';
        if (pity.epic >= 9) return this.rng() < PetManager.RATES[banner].legendary ? 'legendary' : 'epic';
        const roll = this.rng();
        const rates = PetManager.RATES[banner];
        return roll < rates.rare ? 'rare' : roll < rates.rare + rates.epic ? 'epic' : 'legendary';
    }

    draw(count = 1, banner = 'gem') {
        if (![1, 10].includes(count) || !PetManager.RATES[banner] || !this.canEdit()) return null;
        const rewards = [];
        for (let i = 0; i < count; i++) {
            const guaranteed = this.pity[banner].legendary >= 29 || this.pity[banner].epic >= 9;
            const rarity = this.pickRarity(banner);
            const pool = PetCatalog.byRarity(rarity);
            const pet = pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))];
            if (!pet) throw Error('Pet rarity pool is empty: ' + rarity);
            const isNew = !this.inventory[pet.id];
            if (isNew) this.inventory[pet.id] = { copies: 1, level: 1 };
            else this.inventory[pet.id].copies = Math.min(999999, this.inventory[pet.id].copies + 1);
            this.pity[banner].epic = rarity === 'rare' ? this.pity[banner].epic + 1 : 0;
            this.pity[banner].legendary = rarity === 'legendary' ? 0 : this.pity[banner].legendary + 1;
            this.drawCount++;
            rewards.push({
                petId: pet.id, name: pet.name, rarity, icon: pet.icon, newItem: isNew,
                copies: this.inventory[pet.id].copies, guaranteed
            });
        }
        this.save();
        return rewards;
    }

    equip(id, slot) {
        if (!this.canEdit() || !PetCatalog.get(id) || !this.inventory[id] ||
            !Number.isInteger(slot) || slot < 0 || slot > 1) return false;
        const previous = this.slots.indexOf(id);
        if (previous >= 0 && previous !== slot) this.slots[previous] = null;
        this.slots[slot] = id;
        this.timers.clear();
        this.supportTimers.clear();
        this.save();
        this.refreshPlayer();
        return true;
    }

    unequip(slot) {
        if (!this.canEdit() || !Number.isInteger(slot) || slot < 0 || slot > 1) return false;
        this.slots[slot] = null;
        this.timers.clear();
        this.supportTimers.clear();
        this.save();
        this.refreshPlayer();
        return true;
    }

    upgrade(id, max = false) {
        if (!this.canEdit() || !this.inventory[id] || this.inventory[id].level >= PetManager.MAX_LEVEL) return false;
        this.inventory[id].level = max ? PetManager.MAX_LEVEL : this.inventory[id].level + 1;
        this.save();
        this.refreshPlayer();
        return true;
    }

    unlockAllMax() {
        if (!this.canEdit()) return false;
        for (const pet of PetCatalog.list()) {
            const rec = this.inventory[pet.id];
            this.inventory[pet.id] = { copies: Math.max(1, rec?.copies || 0), level: 10 };
        }
        this.slots = ['thunder_leopard', 'kun'];
        this.resetBattle();
        this.save();
        this.refreshPlayer();
        return true;
    }

    getActive() {
        return this.slots.map(id => PetCatalog.get(id)).filter(Boolean);
    }

    getModifiers() {
        const result = { damage: 1, health: 1, speed: 1, energy: 1 };
        for (const pet of this.getActive()) {
            const level = this.inventory[pet.id]?.level || 1;
            const bonus = pet.bonus * (1 + (level - 1) * .11);
            result[pet.passive] += bonus;
        }
        if (this.getActive().length === 2) result.damage += .04;
        return result;
    }

    refreshPlayer() {
        if (this.game?.aircraftManager && this.game?.player) this.game.aircraftManager.applyAircraft();
    }

    resetBattle() {
        this.timers.clear();
        this.supportTimers.clear();
    }

    position(slot) {
        const player = this.game.player;
        return { x: player.x + (slot === 0 ? -43 : 43), y: player.y + 3 };
    }

    /** Update every frame in PLAYING only. Uses the game's existing bullet pipeline. */
    update(dt) {
        if (!(dt > 0) || !this.game.player || this.game.player.isDead) return;
        const player = this.game.player;
        for (let slot = 0; slot < 2; slot++) {
            const id = this.slots[slot];
            const def = PetCatalog.get(id);
            if (!def) continue;
            const level = this.inventory[id]?.level || 1;
            const interval = Math.max(.38, def.fireInterval - (level - 1) * .035);
            const timer = (this.timers.get(id) ?? 0) - dt;
            if (timer <= 0) {
                this.fire(def, slot, level);
                this.timers.set(id, interval);
            } else {
                this.timers.set(id, timer);
            }
            const supportTimer = (this.supportTimers.get(id) ?? 4) - dt;
            if (supportTimer <= 0) {
                this.support(def, level);
                this.supportTimers.set(id, def.trait === 'heal' ? 8 : def.trait === 'shield' ? 18 : 20);
            } else {
                this.supportTimers.set(id, supportTimer);
            }
        }
    }

    fire(def, slot, level) {
        const bullets = this.game.bulletSystem;
        if (!bullets) return;
        const origin = this.position(slot);
        const enemies = (this.game.enemies || []).filter(x => x.active && !x.isDead);
        if (this.game.currentBoss?.active && !this.game.currentBoss.isDead) enemies.push(this.game.currentBoss);
        enemies.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
        const target = enemies[0];
        const direction = target ? Math.atan2(target.y - origin.y, target.x - origin.x) : -Math.PI / 2;
        const n = ['chain', 'storm'].includes(def.trait) ? 3 : 1;
        const shots = [];
        for (let i = 0; i < n; i++) {
            const angle = direction + (i - (n - 1) / 2) * .19;
            shots.push({
                x: origin.x, y: origin.y,
                vx: Math.cos(angle) * 660, vy: Math.sin(angle) * 660,
                size: 5 + (def.rarity === 'legendary' ? 2 : 0),
                damage: Math.round(def.shotDamage * (1 + .13 * (level - 1))),
                color: def.color, type: 'standard', penetration: 0,
                isTracking: def.trait === 'shock' || def.id === 'thunder_leopard' || def.id === 'kun',
                trackingSpeed: 4, target: target || null,
                active: true, maxLifetime: 2500
            });
        }
        bullets.addBullets(shots, false);
    }

    support(def, level) {
        const player = this.game.player;
        const bulletSystem = this.game.bulletSystem;
        if (def.trait === 'heal' && player.health > 0) {
            player.heal(3 + Math.floor(level / 2));
        } else if (def.trait === 'shield' && !player.shieldActive && !player.isInvincible) {
            player.activateShield(1800);
        } else if (def.trait === 'clear' && bulletSystem) {
            const radius = 210;
            for (const bullet of bulletSystem.enemyBullets) {
                if (Math.hypot(bullet.x - player.x, bullet.y - player.y) <= radius) bullet.active = false;
            }
        }
    }

    render(renderer) {
        if (!renderer?.ctx || !this.game.player || this.game.player.isDead) return;
        const ctx = renderer.ctx;
        for (let slot = 0; slot < 2; slot++) {
            const def = PetCatalog.get(this.slots[slot]);
            if (!def) continue;
            const { x, y } = this.position(slot);
            const radius = def.rarity === 'legendary' ? 17 : 14;
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = def.color;
            ctx.fillStyle = '#10243C';
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 19px Microsoft YaHei, sans-serif';
            ctx.fillStyle = def.color;
            ctx.fillText(def.icon, x, y + .5);
            ctx.restore();
        }
    }
}