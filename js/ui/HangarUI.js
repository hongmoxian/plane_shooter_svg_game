/** Menu hangar and touchscreen skill control; no framework or remote API needed. */
class HangarUI {
    constructor(game) {
        this.game = game;
        this.panel = document.getElementById('hangarPanel');
        this.grid = document.getElementById('aircraftGrid');
        this.skillButton = document.getElementById('skillButton');
        this.gearButton = document.getElementById('equipmentSkillButton');
        this.returnButton = document.getElementById('backHangarButton');
    }

    init() {
        const icons = {
            j31: '0,-37 -10,-12 -33,4 -27,15 -11,8 -12,28 0,18 12,28 11,8 27,15 33,4 10,-12',
            xiaolong: '0,-34 -13,-20 -35,-8 -38,15 -20,15 -20,30 0,21 20,30 20,15 38,15 35,-8 13,-20',
            zero: '0,-41 -8,-11 -23,-17 -36,16 -9,7 -12,30 0,18 12,30 9,7 36,16 23,-17 8,-11',
            hades: '0,-36 -18,-27 -27,-10 -39,10 -27,22 -13,17 -15,29 0,25 15,29 13,17 27,22 39,10 27,-10 18,-27'
        };

        this.grid.replaceChildren();
        for (const def of AircraftCatalog.list()) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'aircraft-card';
            card.dataset.aircraftId = def.id;
            const image = document.createElement('div');
            image.className = 'aircraft-preview';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '-50 -50 100 100');
            svg.setAttribute('aria-hidden', 'true');
            const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            outline.setAttribute('points', icons[def.id]);
            outline.setAttribute('stroke', '#F0F6FF');
            outline.setAttribute('stroke-width', '2');
            outline.setAttribute('fill', def.color);
            svg.appendChild(outline);
            image.appendChild(svg);
            const text = document.createElement('div');
            text.className = 'aircraft-copy';
            const name = document.createElement('strong');
            name.textContent = def.name;
            const sub = document.createElement('small');
            sub.textContent = def.year + ' · ' + def.tier + ' · HP ' + def.stats.maxHealth + ' · 速度 ' + def.stats.maxSpeed;
            const desc = document.createElement('span');
            desc.textContent = def.skill.name + '：' + def.skill.description;
            text.append(name, sub, desc);
            card.append(image, text);
            card.addEventListener('click', () => {
                if (this.game.switchAircraft(def.id)) this.refreshCards();
            });
            this.grid.appendChild(card);
        }

        this.skillButton.addEventListener('click', () => {
            this.game.useAircraftSkill();
            this.refreshSkill();
        });
        this.gearButton.addEventListener('click', () => {
            this.game.useEquipmentSkill();
            this.refreshSkill();
        });
        this.returnButton.addEventListener('click', () => {
            this.game.nextLevelIndex = 0;
            this.game.stateMachine.changeState(GameConfig.STATES.MENU);
        });

        this.refreshCards();
        this.sync();
        // Only the small button label changes; the Canvas and gameplay remain in GameLoop.
        this.refreshTimer = window.setInterval(() => this.refreshSkill(), 200);
    }

    refreshCards() {
        for (const card of this.grid.children) {
            const selected = card.dataset.aircraftId === this.game.aircraftManager.selectedId;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-pressed', String(selected));
        }
        const current = this.game.aircraftManager.selected;
        document.getElementById('selectedPlaneText').textContent =
            '当前选择：' + current.name + ' · ' + current.skill.name;
    }

    refreshSkill() {
        const status = this.game.aircraftManager.getSkillStatus();
        this.skillButton.textContent = status.ready
            ? 'Q · ' + status.name
            : status.name + ' ' + status.remaining.toFixed(1) + 's';
        this.skillButton.disabled = !status.ready;
        const gear = this.game.equipmentManager.getManualSkillStatus();
        this.gearButton.textContent = gear.enabled
            ? (gear.ready ? 'E · ' + gear.name : gear.name + ' ' + gear.remaining.toFixed(1) + 's')
            : 'E · 穿戴主武器';
        this.gearButton.disabled = !gear.ready;
    }

    sync() {
        const state = this.game.stateMachine.getCurrentStateName();
        const inMenu = state === GameConfig.STATES.MENU;
        const playing = state === GameConfig.STATES.PLAYING;
        const finished = state === GameConfig.STATES.LEVEL_COMPLETE || state === GameConfig.STATES.GAME_OVER || state === GameConfig.STATES.PAUSED;
        this.panel.classList.toggle('hidden', !inMenu);
        this.skillButton.classList.toggle('hidden', !playing);
        this.gearButton.classList.toggle('hidden', !playing);
        this.returnButton.classList.toggle('hidden', !finished);
        this.refreshCards();
        this.refreshSkill();
    }
}