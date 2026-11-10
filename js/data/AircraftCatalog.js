/**
 * 2018–2020 themed aircraft presets for the fan-made web prototype.
 * Names/era are historical references; stats and skills below are ORIGINAL game-design values,
 * NOT verified abilities or balancing from the official mobile game.
 */
class AircraftCatalog {
    static AIRCRAFT = Object.freeze({
        j31: Object.freeze({
            id: 'j31', name: '歼-31', year: 2018, tier: '神冠',
            color: '#44C9FF', legacyAsset: 'fighter',
            description: '灵活的高速战机，擅长追踪导弹与快速突袭。',
            stats: Object.freeze({ maxHealth: 115, maxSpeed: 540, acceleration: 900, hitRadius: 15 }),
            weapon: Object.freeze({ type: 'machinegun', damage: 30, fireRate: 9, energyCost: 0 }),
            skill: Object.freeze({ id: 'missile_storm', name: '苍穹追击', cooldown: 18, description: '发射 8 枚自动追踪导弹。' })
        }),
        xiaolong: Object.freeze({
            id: 'xiaolong', name: '枭龙', year: 2019, tier: '星耀',
            color: '#FFAA42', legacyAsset: 'bomber',
            description: '厚重的火力平台，使用高伤弹幕压制敌群。',
            stats: Object.freeze({ maxHealth: 155, maxSpeed: 410, acceleration: 710, hitRadius: 20 }),
            weapon: Object.freeze({ type: 'machinegun', damage: 46, fireRate: 7, energyCost: 0 }),
            skill: Object.freeze({ id: 'fan_barrage', name: '龙炎齐射', cooldown: 16, description: '向前方释放 21 发扇形高伤弹幕。' })
        }),
        zero: Object.freeze({
            id: 'zero', name: '零号执行者', year: 2019, tier: '星耀',
            color: '#B58AFF', legacyAsset: 'interceptor',
            description: '机动性优异的能量战机，擅长贯穿光束。',
            stats: Object.freeze({ maxHealth: 100, maxSpeed: 620, acceleration: 1000, hitRadius: 13 }),
            weapon: Object.freeze({ type: 'laser', damage: 85, fireRate: 2.8, energyCost: 8 }),
            skill: Object.freeze({ id: 'prism_lasers', name: '零式光阵', cooldown: 20, description: '释放 7 道穿透激光弹。' })
        }),
        hades: Object.freeze({
            id: 'hades', name: '哈迪斯', year: 2020, tier: '月辉',
            color: '#9CE66D', legacyAsset: 'fighter',
            description: '生存能力较强的重装战机，以护盾反击。',
            stats: Object.freeze({ maxHealth: 200, maxSpeed: 380, acceleration: 650, hitRadius: 21 }),
            weapon: Object.freeze({ type: 'missile', damage: 175, fireRate: 1.5, energyCost: 15 }),
            skill: Object.freeze({ id: 'shield_nova', name: '冥域守护', cooldown: 25, description: '获得 5 秒护盾并清除敌方弹幕。' })
        })
    });

    static list() {
        return Object.values(this.AIRCRAFT);
    }

    static get(id) {
        return this.AIRCRAFT[id] || null;
    }
}