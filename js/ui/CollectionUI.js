/**
 * Hangar-side equipment management and silent, non-monetary prize reveals.
 * UI uses no dependencies or copied artwork.
 */
class CollectionUI {
    constructor(game) {
        this.game = game;
        this.system = game.equipmentManager;
        this.view = 'fleet';
        this.banner = 'gem';
        this.busy = false;
        this.revealTimers = [];
        this.queued = [];
        this.cursor = 0;
    }

    init() {
        this.tabs = [...document.querySelectorAll('#hangarTabs [data-view]')];
        this.viewNodes = {
            fleet: document.getElementById('fleetView'),
            gear: document.getElementById('gearView'),
            draw: document.getElementById('drawView')
        };
        for (const button of this.tabs) button.addEventListener('click', () => this.setView(button.dataset.view));
        document.getElementById('coinBannerButton').addEventListener('click', () => this.setBanner('coin'));
        document.getElementById('gemBannerButton').addEventListener('click', () => this.setBanner('gem'));
        document.getElementById('drawOneButton').addEventListener('click', () => this.startDraw(1));
        document.getElementById('drawTenButton').addEventListener('click', () => this.startDraw(10));
        document.getElementById('skipRevealButton').addEventListener('click', () => this.finishReveal());
        document.getElementById('unlockMaxButton').addEventListener('click', () => {
            if (this.system.unlockAllMax()) {
                this.notice('圆梦成功！15 件装备已全部解锁、升满级，已穿戴神犬套。');
                this.refreshAll();
            }
        });
        document.getElementById('equipDogButton').addEventListener('click', () => this.equipSet('dog'));
        document.getElementById('equipPigButton').addEventListener('click', () => this.equipSet('pig'));
        this.refreshAll();
        this.setView('fleet');
    }

    notice(text) {
        document.getElementById('collectionStatus').textContent = text;
    }

    setView(view) {
        if (!this.viewNodes[view]) return;
        this.finishReveal();
        this.view = view;
        for (const button of this.tabs) {
            const active = button.dataset.view === view;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        }
        for (const [name, node] of Object.entries(this.viewNodes)) {
            node.classList.toggle('hidden', name !== view);
        }
        this.refreshAll();
    }

    setBanner(banner) {
        if (!['coin', 'gem'].includes(banner) || this.busy) return;
        this.banner = banner;
        document.getElementById('coinBannerButton').classList.toggle('active', banner === 'coin');
        document.getElementById('gemBannerButton').classList.toggle('active', banner === 'gem');
        document.getElementById('drawResults').replaceChildren();
        document.getElementById('drawAnnouncement').textContent =
            banner === 'coin' ? '金币补给 · 无限金币，自由抽取' : '钻石祈愿 · 无限钻石，更高传说概率';
        this.refreshPity();
    }

    refreshPity() {
        const weights = this.banner === 'gem' ? [55, 35, 10] : [70, 27, 3];
        document.getElementById('drawRates').textContent =
            '公开概率：普通 ' + weights[0] + '% · 史诗 ' + weights[1] + '% · 传说 ' + weights[2] + '%';
        const pity = this.system.pity[this.banner];
        document.getElementById('pityDisplay').textContent =
            '累计保底进度 · 史诗或更高 ' + pity.epic + '/10 · 传说 ' +
            pity.legendary + '/30 · 总抽数 ' + this.system.drawCount;
    }

    startDraw(count) {
        if (this.busy) return;
        const rewards = this.system.draw(count, this.banner);
        if (!rewards) return;
        this.busy = true;
        this.queued = rewards;
        this.cursor = 0;
        document.getElementById('drawResults').replaceChildren();
        document.getElementById('drawAnnouncement').textContent =
            count === 10 ? '✦ 十连开启！装备正在逐一揭晓……' : '✦ 光芒凝聚，揭晓奖励……';
        document.getElementById('drawOneButton').disabled = true;
        document.getElementById('drawTenButton').disabled = true;
        document.getElementById('coinBannerButton').disabled = true;
        document.getElementById('gemBannerButton').disabled = true;
        document.getElementById('skipRevealButton').classList.remove('hidden');
        rewards.forEach((item, index) => {
            this.revealTimers.push(window.setTimeout(() => this.revealOne(item), 350 + index * 235));
        });
        this.revealTimers.push(window.setTimeout(() => this.finishReveal(), 550 + count * 235));
    }

    revealOne(reward) {
        if (!this.busy) return;
        const def = EquipmentCatalog.get(reward.itemId);
        if (!def) return;
        const card = document.createElement('div');
        card.className = 'prize-card ' + reward.rarity;
        const symbol = document.createElement('div');
        symbol.className = 'prize-icon';
        symbol.textContent = def.icon;
        const name = document.createElement('strong');
        name.textContent = reward.name;
        const small = document.createElement('small');
        small.textContent = EquipmentCatalog.RARITIES[reward.rarity].name +
            (reward.newItem ? ' · NEW' : ' · 重复 ×' + reward.copies);
        if (reward.newItem) small.classList.add('is-new');
        if (reward.guaranteed) small.textContent += ' · 保底';
        card.append(symbol, name, small);
        document.getElementById('drawResults').appendChild(card);
        this.cursor++;
        if (reward.rarity === 'legendary') {
            document.getElementById('drawAnnouncement').textContent = '✦✦ 传说降临：' + reward.name + '！';
        }
    }

    finishReveal() {
        for (const timer of this.revealTimers) window.clearTimeout(timer);
        this.revealTimers = [];
        if (!this.busy) return;
        while (this.cursor < this.queued.length) this.revealOne(this.queued[this.cursor]);
        const rareCount = this.queued.filter(x => x.rarity === 'legendary').length;
        const epicCount = this.queued.filter(x => x.rarity === 'epic').length;
        const newCount = this.queued.filter(x => x.newItem).length;
        document.getElementById('drawAnnouncement').textContent =
            '开奖完成 · 传说 ' + rareCount + ' · 史诗 ' + epicCount + ' · 新装备 ' + newCount +
            '（可在装备仓库穿戴）';
        this.busy = false;
        this.queued = [];
        this.cursor = 0;
        document.getElementById('drawOneButton').disabled = false;
        document.getElementById('drawTenButton').disabled = false;
        document.getElementById('coinBannerButton').disabled = false;
        document.getElementById('gemBannerButton').disabled = false;
        document.getElementById('skipRevealButton').classList.add('hidden');
        this.refreshAll();
    }

    equipSet(id) {
        const setName = EquipmentCatalog.SETS[id].name;
        if (this.system.equipSet(id)) this.notice('已穿戴 ' + setName + '，套装效果已生效。');
        else this.notice('尚未收齐 ' + setName + '，可以抽奖收集或一键解锁。');
        this.refreshAll();
    }

    refreshSlots() {
        const root = document.getElementById('equippedSlots');
        root.replaceChildren();
        for (const slot of EquipmentCatalog.SLOTS) {
            const item = EquipmentCatalog.get(this.system.equipped[slot]);
            const node = document.createElement('div');
            node.className = 'slot-cell';
            const label = document.createElement('strong');
            label.textContent = EquipmentCatalog.SLOT_NAMES[slot];
            const value = document.createElement('span');
            value.textContent = item ? item.name : '未装备';
            node.append(label, value);
            root.appendChild(node);
        }
        const m = this.system.getModifiers();
        const dog = m.setCounts.dog, pig = m.setCounts.pig;
        const notice = '神犬 ' + dog + '/5 · 天蓬 ' + pig + '/5 · 攻击 ×' +
            m.damage.toFixed(2) + ' · 生命 ×' + m.health.toFixed(2);
        document.getElementById('suitStatus').textContent = notice +
            (m.fullSet ? ' · 已激活完整套装战斗特效！' : '');
    }

    refreshInventory() {
        const root = document.getElementById('inventoryGrid');
        root.replaceChildren();
        for (const def of EquipmentCatalog.ITEMS) {
            const rec = this.system.inventory[def.id];
            const equipped = this.system.equipped[def.slot] === def.id;
            const card = document.createElement('div');
            card.className = 'gear-card ' + def.rarity + (rec ? '' : ' not-owned');
            const top = document.createElement('div');
            top.className = 'gear-top';
            const symbol = document.createElement('span');
            symbol.className = 'gear-icon';
            symbol.textContent = def.icon;
            const title = document.createElement('div');
            title.className = 'gear-title';
            const name = document.createElement('strong');
            name.textContent = def.name;
            const note = document.createElement('small');
            note.textContent =
                EquipmentCatalog.RARITIES[def.rarity].name + ' · ' +
                EquipmentCatalog.SLOT_NAMES[def.slot] +
                ' · ' + (rec ? 'Lv.' + rec.level + ' ×' + rec.copies : '尚未获得');
            title.append(name, note);
            top.append(symbol, title);
            const actions = document.createElement('div');
            actions.className = 'gear-actions';
            const addButton = (label, action, allowed = true) => {
                const btn = document.createElement('button');
                btn.type = 'button'; btn.textContent = label; btn.disabled = !allowed;
                btn.addEventListener('click', action);
                actions.appendChild(btn);
            };
            addButton(equipped ? '已装备' : '穿戴', () => {
                if (this.system.equip(def.id)) {
                    this.notice('已穿戴 ' + def.name + '。');
                    this.refreshAll();
                }
            }, !!rec && !equipped);
            addButton('强化+1', () => {
                if (this.system.upgrade(def.id)) this.refreshAll();
            }, !!rec && rec.level < 10);
            addButton('满级', () => {
                if (this.system.upgrade(def.id, true)) this.refreshAll();
            }, !!rec && rec.level < 10);
            card.append(top, actions);
            root.appendChild(card);
        }
    }

    refreshAll() {
        this.refreshPity();
        this.refreshSlots();
        this.refreshInventory();
    }

    sync() {
        // Completing a reveal before leaving the hangar avoids lingering animations.
        const state = this.game.stateMachine.getCurrentStateName();
        if (state !== GameConfig.STATES.MENU) this.finishReveal();
    }
}