/**
 * Historical pet names (2018–2021) used as a nostalgia reference.
 * ALL combat skills, rarities and balancing here are ORIGINAL designs,
 * not a claim about the mobile game's official attributes.
 */
class PetCatalog {
    static RARITIES = Object.freeze({
        rare: Object.freeze({ label: '稀有', color: '#8DC8FF' }),
        epic: Object.freeze({ label: '史诗', color: '#CDA7FF' }),
        legendary: Object.freeze({ label: '传说', color: '#FFD479' })
    });
    static PETS = Object.freeze([
        Object.freeze({ id: 'abyss_soul', name: '深渊电魂', year: 2018, rarity: 'rare', color:'#62D9FF', icon:'⚡',
            trait: 'shock', role: '雷电射击', description: '追踪闪电弹，辅助攻击。',
            shotDamage: 12, fireInterval: 1.25, passive: 'damage', bonus: .025 }),
        Object.freeze({ id: 'holy_angel', name: '圣魔天使', year: 2019, rarity: 'rare', color:'#FFD2E4', icon:'✧',
            trait: 'heal', role: '恢复守护', description: '自动治疗，附带圣光弹。',
            shotDamage: 10, fireInterval: 1.35, passive: 'health', bonus: .04 }),
        Object.freeze({ id: 'thunder_fox', name: '苍雷妖狐', year: 2019, rarity: 'epic', color:'#9CB6FF', icon:'✦',
            trait: 'chain', role: '雷狐连射', description: '连续散射，提升主机火力。',
            shotDamage: 18, fireInterval: 1.05, passive: 'damage', bonus: .055 }),
        Object.freeze({ id: 'imperial_cat', name: '御猫展昭', year: 2019, rarity: 'epic', color:'#FFD299', icon:'✿',
            trait: 'shield', role: '护卫盾', description: '周期性提供短时护盾。',
            shotDamage: 17, fireInterval: 1.15, passive: 'speed', bonus: .045 }),
        Object.freeze({ id: 'azure_bird', name: '雷云青鸾', year: 2020, rarity: 'epic', color:'#7FE6D8', icon:'❖',
            trait: 'storm', role: '旋风齐射', description: '多方向弹幕掩护主机。',
            shotDamage: 20, fireInterval: .95, passive: 'energy', bonus: .10 }),
        Object.freeze({ id: 'wuchang', name: '无常', year: 2020, rarity: 'legendary', color:'#D7B2FF', icon:'☯',
            trait: 'clear', role: '幽影清弹', description: '周期清除附近敌方弹幕。',
            shotDamage: 26, fireInterval: .85, passive: 'damage', bonus: .075 }),
        Object.freeze({ id: 'kun', name: '鲲', year: 2021, rarity: 'legendary', color:'#75E7FF', icon:'✷',
            trait: 'heal', role: '深海庇佑', description: '持续恢复，并释放水流导弹。',
            shotDamage: 25, fireInterval: .95, passive: 'health', bonus: .095 }),
        Object.freeze({ id: 'thunder_leopard', name: '宇光雷豹', year: 2021, rarity: 'legendary', color:'#FFE78D', icon:'✴',
            trait: 'chain', role: '雷霆追击', description: '高速追踪连射，提高攻击。',
            shotDamage: 30, fireInterval: .72, passive: 'damage', bonus: .10 })
    ]);
    static list() { return this.PETS; }
    static get(id) { return this.PETS.find(p => p.id === id) || null; }
    static byRarity(r) { return this.PETS.filter(p => p.rarity === r); }
}