/**
 * A single source of truth for selecting and applying aircraft presets.
 * All skill effects are original, lightweight gameplay approximations.
 */
class AircraftManager {
    constructor(game) {
        this.game = game;
        this.selectedId = 'j31';
        this.cooldownRemaining = 0;
    }

    get selected() {
        return AircraftCatalog.get(this.selectedId);
    }

    select(id) {
        if (!AircraftCatalog.get(id)) return false;
        const state = this.game.stateMachine?.getCurrentStateName();
        if (state === GameConfig.STATES.PLAYING || state === GameConfig.STATES.PAUSED) return false;
        this.selectedId = id;
        this.cooldownRemaining = 0;
        this.applyAircraft();
        return true;
    }

    /** Rebuild the weapon presets and player stats on every new level. */
    prepareForBattle() {
        this.cooldownRemaining = 0;
        this.applyAircraft();
        this.game.player.health = this.game.player.maxHealth;
        this.game.player.energy = this.game.player.maxEnergy;
        this.game.player.shieldActive = false;
        this.game.player.shieldTime = 0;
        this.game.player.isInvincible = false;
        this.game.player.invincibleTime = 0;
    }

    applyAircraft() {
        const def = this.selected;
        const player = this.game.player;
        if (!def || !player) return;
        const gear = this.game.equipmentManager?.getModifiers() ||
            { damage: 1, health: 1, speed: 1, energy: 1, skillCooldown: 1 };
        const pets = this.game.petManager?.getModifiers() ||
            { damage: 1, health: 1, speed: 1, energy: 1 };
        player.aircraftId = def.id;
        player.aircraftName = def.name;
        player.aircraftColor = def.color;
        player.aircraftType = def.legacyAsset;
        player.maxHealth = Math.round(def.stats.maxHealth * gear.health * pets.health);
        player.health = Math.min(player.health, player.maxHealth);
        player.maxSpeed = Math.round(def.stats.maxSpeed * gear.speed * pets.speed);
        player.baseSpeed = Math.min(300, def.stats.maxSpeed);
        player.accelerationRate = def.stats.acceleration;
        player.hitboxRadius = def.stats.hitRadius;
        player.hitBox.width = def.stats.hitRadius * 2;
        player.hitBox.height = def.stats.hitRadius * 2;
        player.energyRegen = 10 * gear.energy * pets.energy;
        player.maxBombs = 3;
        player.bombs = Math.min(player.bombs, player.maxBombs);

        const weaponManager = new WeaponManager(player);
        weaponManager.addWeapon('laser', new LaserCannon(1));
        weaponManager.addWeapon('missile', new MissileLauncher(1));
        const weapon = weaponManager.weapons.get(def.weapon.type);
        weapon.damage = Math.round(def.weapon.damage * gear.damage * pets.damage);
        weapon.fireRate = def.weapon.fireRate;
        weapon.fireInterval = 1000 / weapon.fireRate;
        weapon.energyCost = def.weapon.energyCost;
        for (const entry of weaponManager.weapons.values()) {
            if (entry !== weapon) entry.damage *= gear.damage * pets.damage;
        }
        weaponManager.setActiveWeapon(def.weapon.type);
        // Tab remains a usable secondary weapon, for comparison with the selected main weapon.
        weaponManager.setSecondaryWeapon(def.weapon.type === 'machinegun' ? 'laser' : 'machinegun');
        player.weaponManager = weaponManager;
    }

    update(dt) {
        this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }

    getSkillStatus() {
        const def = this.selected;
        return {
            name: def.skill.name,
            remaining: this.cooldownRemaining,
            cooldown: def.skill.cooldown,
            ready: this.cooldownRemaining <= 0
        };
    }

    useSkill() {
        if (this.game.stateMachine?.getCurrentStateName() !== GameConfig.STATES.PLAYING) return false;
        if (this.cooldownRemaining > 0 || this.game.player.isDead) return false;

        const def = this.selected;
        const game = this.game;
        const player = game.player;
        const shots = [];
        const origin = { x: player.x, y: player.y - 28 };

        const shot = (x, y, angle, speed, damage, color, extra = {}) => ({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            damage, color, type: 'standard', size: 6, penetration: 0,
            active: true, maxLifetime: 2600, ...extra
        });

        switch (def.skill.id) {
            case 'missile_storm':
                for (let i = 0; i < 8; i++) {
                    const angle = -Math.PI / 2 + (i - 3.5) * 0.12;
                    shots.push(shot(origin.x + (i - 3.5) * 7, origin.y, angle, 460, 115, def.color, {
                        type: 'missile', isTracking: true, trackingSpeed: 5.5,
                        size: 8, explosionRadius: 0
                    }));
                }
                break;
            case 'fan_barrage':
                for (let i = 0; i < 21; i++) {
                    const angle = -Math.PI / 2 + (i - 10) * 0.059;
                    shots.push(shot(origin.x, origin.y, angle, 780, 92, def.color, { size: 8 }));
                }
                break;
            case 'prism_lasers':
                for (let i = -3; i <= 3; i++) {
                    shots.push(shot(origin.x + i * 20, origin.y, -Math.PI / 2 + i * 0.035,
                        1060, 170, def.color, { type: 'laser', size: 9, penetration: 3 }));
                }
                break;
            case 'shield_nova':
                player.activateShield(5000);
                game.bulletSystem.clearEnemyBullets();
                // A short defensive burst is visually readable without being an unfair screen wipe.
                for (let i = -3; i <= 3; i++) {
                    shots.push(shot(origin.x + i * 8, origin.y, -Math.PI / 2 + i * 0.14,
                        700, 95, def.color));
                }
                break;
            default:
                return false;
        }

        const gear = game.equipmentManager?.getModifiers() || { damage: 1, skillCooldown: 1 };
        const petBonus = game.petManager?.getModifiers()?.damage || 1;
        for (const bullet of shots) bullet.damage *= gear.damage * petBonus;
        if (shots.length) game.bulletSystem.addBullets(shots, false);
        game.equipmentManager?.onSkillUsed();
        this.cooldownRemaining = def.skill.cooldown * gear.skillCooldown;
        game.showMessage = def.skill.name + '！';
        game.messageTimer = 90;
        return true;
    }
}