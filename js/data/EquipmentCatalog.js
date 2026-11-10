/**
 * Fan-made equipment names based on the previously selected two historical sets.
 * Bonuses, rarity, upgrade formulas and effects are original for this prototype.
 */
class EquipmentCatalog {
    static SLOTS = Object.freeze(['weapon', 'cannon', 'armor', 'core', 'charm']);
    static SLOT_NAMES = Object.freeze({
        weapon: '主武器', cannon: '副武器', armor: '护甲', core: '核心', charm: '增幅器'
    });
    static RARITIES = Object.freeze({
        common: { name: '普通', color: '#B5C4D8', weight: 60, factor: 1 },
        epic: { name: '史诗', color: '#B58AFF', weight: 32, factor: 1.7 },
        legendary: { name: '传说', color: '#FFCF6A', weight: 8, factor: 2.6 }
    });
    static ITEMS = Object.freeze([
        { id: 'basic_blaster', name: '疾风机炮', slot: 'weapon', rarity: 'common', icon: '✦', bonus: 'damage' },
        { id: 'basic_cannon', name: '流星副炮', slot: 'cannon', rarity: 'common', icon: '✳', bonus: 'damage' },
        { id: 'basic_armor', name: '轻型护甲', slot: 'armor', rarity: 'common', icon: '⬡', bonus: 'health' },
        { id: 'basic_core', name: '疾速核心', slot: 'core', rarity: 'common', icon: '◈', bonus: 'speed' },
        { id: 'basic_charm', name: '能量增幅器', slot: 'charm', rarity: 'common', icon: '✧', bonus: 'energy' },
        { id: 'dog_weapon', name: '神犬缚妖索', slot: 'weapon', rarity: 'legendary', set: 'dog', icon: '⚔', bonus: 'damage',
            ability: { id:'tether', name:'缚妖追击', trigger:'manual', cooldown:8, description:'按 E 发射3枚追踪灵索，自动锁定敌机。' } },
        { id: 'dog_cannon', name: '神犬赤炎镜', slot: 'cannon', rarity: 'epic', set: 'dog', icon: '☄', bonus: 'damage',
            ability: { id:'flame', name:'赤炎喷射', trigger:'auto', cooldown:6, description:'周期释放7发扇形烈焰弹幕。' } },
        { id: 'dog_armor', name: '神犬云霄甲', slot: 'armor', rarity: 'epic', set: 'dog', icon: '⬡', bonus: 'health',
            ability: { id:'ward', name:'云霄庇护', trigger:'on_hit', cooldown:22, description:'受击时抵挡本次伤害，并获得短暂护盾。' } },
        { id: 'dog_core', name: '神犬娄金冠', slot: 'core', rarity: 'epic', set: 'dog', icon: '♛', bonus: 'speed',
            ability: { id:'sunburst', name:'金冠震荡', trigger:'auto', cooldown:13, description:'周期释放范围震荡，对附近敌人造成伤害。' } },
        { id: 'dog_charm', name: '神犬如律令', slot: 'charm', rarity: 'legendary', set: 'dog', icon: '✺', bonus: 'skill',
            ability: { id:'edict', name:'如律令', trigger:'on_skill', cooldown:0, description:'释放战机技能时清除身边敌弹，配合神犬套。' } },
        { id: 'pig_weapon', name: '天蓬星河令', slot: 'weapon', rarity: 'legendary', set: 'pig', icon: '✶', bonus: 'damage',
            ability: { id:'meteor', name:'星河陨落', trigger:'manual', cooldown:9, description:'按 E 召唤4枚高伤追踪星陨导弹。' } },
        { id: 'pig_cannon', name: '天蓬元帅旗', slot: 'cannon', rarity: 'epic', set: 'pig', icon: '⚑', bonus: 'damage',
            ability: { id:'starfan', name:'帅旗列阵', trigger:'auto', cooldown:7, description:'周期发射9发星光交错齐射弹幕。' } },
        { id: 'pig_armor', name: '天蓬玄金甲', slot: 'armor', rarity: 'epic', set: 'pig', icon: '⬢', bonus: 'health',
            ability: { id:'mitigate', name:'玄金护体', trigger:'on_hit', cooldown:0, description:'每次有效受击减免35%的伤害。' } },
        { id: 'pig_core', name: '天蓬沁金耙', slot: 'core', rarity: 'epic', set: 'pig', icon: '♜', bonus: 'speed',
            ability: { id:'sweep', name:'九齿横扫', trigger:'auto', cooldown:12, description:'周期横扫前方，造成一次扇形范围伤害。' } },
        { id: 'pig_charm', name: '天蓬金元丹', slot: 'charm', rarity: 'legendary', set: 'pig', icon: '✵', bonus: 'energy',
            ability: { id:'elixir', name:'金元丹', trigger:'auto', cooldown:10, description:'周期回血，释放战机技能还能补充能量。' } }
    ]);
    static SETS = Object.freeze({
        dog: { name: '神犬套', color: '#E7A45E', twoPiece: '火力 +10%', fivePiece: '技能释放时额外触发犬焰弹幕' },
        pig: { name: '天蓬套', color: '#6BC6FF', twoPiece: '生命 +15%', fivePiece: '技能释放时额外触发星河弹幕' }
    });
    static get(id) { return this.ITEMS.find(x => x.id === id) || null; }
    static byRarity(rarity) { return this.ITEMS.filter(x => x.rarity === rarity); }
}