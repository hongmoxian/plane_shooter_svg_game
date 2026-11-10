/**
 * Local companion gallery and no-cost pet summoning.
 * UI content is DOM text rather than raw HTML to avoid storage-fed markup.
 */
class PetUI {
    constructor(game) {
        this.game = game;
        this.manager = game.petManager;
        this.banner = 'gem';
        this.busy = false;
        this.pending = [];
        this.cursor = 0;
        this.timers = [];
    }

    init() {
        this.slotsEl = document.getElementById('petSlots');
        this.gridEl = document.getElementById('petGrid');
        this.rewardsEl = document.getElementById('petDrawResults');
        this.announcementEl = document.getElementById('petDrawAnnouncement');

        document.getElementById('petUnlockAllButton').addEventListener('click', () => {
            if (this.manager.unlockAllMax()) {
                this.notice('圆梦成功：8 只宠物全部满级，已派出宇光雷豹 + 鲲！');
                this.refreshAll();
            }
        });
        document.getElementById('petCoinBanner').addEventListener('click', () => this.changeBanner('coin'));
        document.getElementById('petGemBanner').addEventListener('click', () => this.changeBanner('gem'));
        document.getElementById('petDrawOne').addEventListener('click', () => this.startDraw(1));
        document.getElementById('petDrawTen').addEventListener('click', () => this.startDraw(10));
        document.getElementById('petSkipReveal').addEventListener('click', () => this.finishReveal());
        this.refreshAll();
    }

    notice(message) {
        document.getElementById('petNotice').textContent = message;
    }

    refreshSlots() {
        this.slotsEl.replaceChildren();
        for (let index = 0; index < 2; index++) {
            const id = this.manager.slots[index];
            const pet = PetCatalog.get(id);
            const slot = document.createElement('div');
            slot.className = 'pet-slot';
            const title = document.createElement('strong');
            title.textContent = index === 0 ? '伙伴一 · 左翼' : '伙伴二 · 右翼';
            const name = document.createElement('span');
            name.textContent = pet ? pet.icon + ' ' + pet.name : '尚未出战';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '卸下';
            remove.disabled = !pet;
            remove.addEventListener('click', () => {
                if (this.manager.unequip(index)) {
                    this.notice('已卸下伙伴');
                    this.refreshAll();
                }
            });
            slot.append(title, name, remove);
            this.slotsEl.appendChild(slot);
        }
    }

    refreshGallery() {
        this.gridEl.replaceChildren();
        for (const pet of PetCatalog.list()) {
            const record = this.manager.inventory[pet.id];
            const slot = this.manager.slots.indexOf(pet.id);
            const card = document.createElement('div');
            card.className = 'pet-card ' + pet.rarity + (record ? '' : ' unowned');
            const header = document.createElement('div');
            header.className = 'pet-header';
            const icon = document.createElement('span');
            icon.className = 'pet-icon';
            icon.textContent = pet.icon;
            icon.style.color = pet.color;
            const title = document.createElement('div');
            title.className = 'pet-name';
            const name = document.createElement('strong');
            name.textContent = pet.name + (slot < 0 ? '' : slot === 0 ? ' · 左翼' : ' · 右翼');
            const details = document.createElement('small');
            details.textContent = pet.year + ' · ' + PetCatalog.RARITIES[pet.rarity].label + ' · ' +
                (record ? 'Lv.' + record.level + ' ×' + record.copies : '未获得');
            title.append(name, details);
            header.append(icon, title);
            const desc = document.createElement('div');
            desc.className = 'pet-description';
            desc.textContent = pet.role + '：' + pet.description;
            const actions = document.createElement('div');
            actions.className = 'pet-controls';
            const action = (text, fn, enabled) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = text;
                btn.disabled = !enabled;
                btn.addEventListener('click', fn);
                actions.appendChild(btn);
            };
            for (let i = 0; i < 2; i++) {
                action(i === 0 ? '左翼出战' : '右翼出战', () => {
                    if (this.manager.equip(pet.id, i)) {
                        this.notice('已设置 ' + pet.name + ' 出战！');
                        this.refreshAll();
                    }
                }, !!record && slot !== i);
            }
            action('升一级', () => {
                if (this.manager.upgrade(pet.id)) this.refreshAll();
            }, !!record && record.level < 10);
            action('一键满级', () => {
                if (this.manager.upgrade(pet.id, true)) this.refreshAll();
            }, !!record && record.level < 10);
            card.append(header, desc, actions);
            this.gridEl.appendChild(card);
        }
    }

    refreshRates() {
        const rates = PetManager.RATES[this.banner];
        document.getElementById('petDrawRates').textContent =
            '概率：稀有 ' + Math.round(rates.rare * 100) + '% · 史诗 ' +
            Math.round(rates.epic * 100) + '% · 传说 ' + Math.round(rates.legendary * 100) + '%';
        const pity = this.manager.pity[this.banner];
        document.getElementById('petDrawPity').textContent =
            '保底 · 史诗及以上 ' + pity.epic + '/10 · 传说 ' + pity.legendary +
            '/30 · 宠物总抽数 ' + this.manager.drawCount;
    }

    changeBanner(banner) {
        if (this.busy || !PetManager.RATES[banner]) return;
        this.banner = banner;
        document.getElementById('petCoinBanner').classList.toggle('active', banner === 'coin');
        document.getElementById('petGemBanner').classList.toggle('active', banner === 'gem');
        this.rewardsEl.replaceChildren();
        this.announcementEl.textContent = banner === 'coin' ?
            '金币召唤 · 无限金币 · 看看普通池中的好运！' : '钻石召唤 · 无限钻石 · 更高的传说概率！';
        this.refreshRates();
    }

    startDraw(count) {
        if (this.busy) return;
        const rewards = this.manager.draw(count, this.banner);
        if (!rewards) return;
        this.busy = true;
        this.pending = rewards;
        this.cursor = 0;
        this.rewardsEl.replaceChildren();
        this.announcementEl.textContent = count === 10 ? '✦ 十连召唤中，伙伴逐个现身……' : '✦ 星光闪烁，伙伴即将降临……';
        for (const id of ['petDrawOne','petDrawTen','petCoinBanner','petGemBanner']) {
            document.getElementById(id).disabled = true;
        }
        document.getElementById('petSkipReveal').classList.remove('hidden');
        for (const [i, reward] of rewards.entries()) {
            this.timers.push(window.setTimeout(() => this.reveal(reward), 280 + i * 200));
        }
        this.timers.push(window.setTimeout(() => this.finishReveal(), 450 + count * 200));
    }

    reveal(reward) {
        if (!this.busy) return;
        const pet = PetCatalog.get(reward.petId);
        const card = document.createElement('div');
        card.className = 'prize-card ' + reward.rarity;
        const icon = document.createElement('div');
        icon.className = 'prize-icon';
        icon.textContent = pet.icon;
        icon.style.color = pet.color;
        const title = document.createElement('strong');
        title.textContent = pet.name;
        const sub = document.createElement('small');
        sub.textContent = PetCatalog.RARITIES[pet.rarity].label +
            (reward.newItem ? ' · NEW' : ' · 重复 ×' + reward.copies) +
            (reward.guaranteed ? ' · 保底' : '');
        if (reward.newItem) sub.classList.add('is-new');
        card.append(icon, title, sub);
        this.rewardsEl.appendChild(card);
        this.cursor++;
        if (reward.rarity === 'legendary') this.announcementEl.textContent = '✦ 传说伙伴降临：' + reward.name + '！';
    }

    finishReveal() {
        for (const timer of this.timers) window.clearTimeout(timer);
        this.timers = [];
        if (!this.busy) return;
        while (this.cursor < this.pending.length) this.reveal(this.pending[this.cursor]);
        const legends = this.pending.filter(x => x.rarity === 'legendary').length;
        const epics = this.pending.filter(x => x.rarity === 'epic').length;
        const fresh = this.pending.filter(x => x.newItem).length;
        this.announcementEl.textContent = '召唤完成 · 传说 ' + legends +
            ' · 史诗 ' + epics + ' · 新伙伴 ' + fresh + ' · 可在双宠出战页配置';
        this.busy = false;
        this.pending = [];
        this.cursor = 0;
        for (const id of ['petDrawOne','petDrawTen','petCoinBanner','petGemBanner']) {
            document.getElementById(id).disabled = false;
        }
        document.getElementById('petSkipReveal').classList.add('hidden');
        this.refreshAll();
    }

    refreshAll() {
        this.refreshSlots();
        this.refreshGallery();
        this.refreshRates();
    }
}