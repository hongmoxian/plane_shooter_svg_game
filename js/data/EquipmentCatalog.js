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
        { id: 'dog_weapon', name: '神犬缚妖索', slot: 'weapon', rarity: 'legendary', set: 'dog', icon: '⚔', bonus: 'damage' },
        { id: 'dog_cannon', name: '神犬赤炎镜', slot: 'cannon', rarity: 'epic', set: 'dog', icon: '☄', bonus: 'damage' },
        { id: 'dog_armor', name: '神犬云霄甲', slot: 'armor', rarity: 'epic', set: 'dog', icon: '⬡', bonus: 'health' },
        { id: 'dog_core', name: '神犬娄金冠', slot: 'core', rarity: 'epic', set: 'dog', icon: '♛', bonus: 'speed' },
        { id: 'dog_charm', name: '神犬如律令', slot: 'charm', rarity: 'legendary', set: 'dog', icon: '✺', bonus: 'skill' },
        { id: 'pig_weapon', name: '天蓬星河令', slot: 'weapon', rarity: 'legendary', set: 'pig', icon: '✶', bonus: 'damage' },
        { id: 'pig_cannon', name: '天蓬元帅旗', slot: 'cannon', rarity: 'epic', set: 'pig', icon: '⚑', bonus: 'damage' },
        { id: 'pig_armor', name: '天蓬玄金甲', slot: 'armor', rarity: 'epic', set: 'pig', icon: '⬢', bonus: 'health' },
        { id: 'pig_core', name: '天蓬沁金耙', slot: 'core', rarity: 'epic', set: 'pig', icon: '♜', bonus: 'speed' },
        { id: 'pig_charm', name: '天蓬金元丹', slot: 'charm', rarity: 'legendary', set: 'pig', icon: '✵', bonus: 'energy' }
    ]);
    static SETS = Object.freeze({
        dog: { name: '神犬套', color: '#E7A45E', twoPiece: '火力 +10%', fivePiece: '技能释放时额外触发犬焰弹幕' },
        pig: { name: '天蓬套', color: '#6BC6FF', twoPiece: '生命 +15%', fivePiece: '技能释放时额外触发星河弹幕' }
    });
    static get(id) { return this.ITEMS.find(x => x.id === id) || null; }
    static byRarity(rarity) { return this.ITEMS.filter(x => x.rarity === rarity); }
}