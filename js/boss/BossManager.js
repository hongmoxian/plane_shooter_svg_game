/**
 * Boss管理器
 * 负责Boss战的管理、生成、奖励发放等
 */
class BossManager {
    constructor(game) {
        this.game = game;
        this.currentBoss = null;
        this.bossQueue = [];
        
        // Boss战状态
        this.inBossBattle = false;
        this.bossSpawnTime = 0;
        this.battleStartTime = 0;
        this.battleWarningShown = false;
        
        // 奖励系统
        this.rewardMultiplier = 1.0;
        this.perfectionBonus = false;
        this.speedBonus = false;
        this.noHitBonus = false;
        
        // 统计数据
        this.battleStats = {
            damageDealt: 0,
            damageTaken: 0,
            bulletsFired: 0,
            accurateHits: 0,
            startHealth: 0,
            startTime: 0
        };
        
        // 音效和特效
        this.warningTimer = 0;
        this.defeatSequenceActive = false;
        this.defeatTimer = 0;
        
        // Boss预制配置
        this.bossTemplates = this.initializeBossTemplates();
    }
    
    /**
     * 初始化
     */
    init(onSpawnBoss, onBossDefeated) {
        this.onSpawnBoss = onSpawnBoss;
        this.onBossDefeated = onBossDefeated;
        console.log('Boss管理器初始化完成');
    }
    
    /**
     * 初始化Boss模板
     */
    initializeBossTemplates() {
        return {
            // 第一关Boss - 轰炸机指挥官
            bomber_commander: {
                id: "bomber_commander",
                name: "轰炸机指挥官",
                type: "air",
                level: 1,
                maxHealth: 3000,
                healthBars: 2,
                defense: 25,
                damageReduction: 0.05,
                baseSpeed: 60,
                width: 160,
                height: 120,
                scoreValue: 25000,
                dropItems: [
                    { type: "powerUp", level: 2, chance: 1.0 },
                    { type: "bomb", count: 2, chance: 0.8 },
                    { type: "life", chance: 0.3 }
                ],
                weakPoints: [
                    {
                        position: { x: -40, y: 0 },
                        damageMultiplier: 2.0,
                        size: { width: 25, height: 25 },
                        exposeTiming: "always"
                    },
                    {
                        position: { x: 40, y: 0 },
                        damageMultiplier: 2.0,
                        size: { width: 25, height: 25 },
                        exposeTiming: "always"
                    }
                ],
                phases: [
                    {
                        id: 0,
                        name: "测试火力",
                        healthThreshold: 1.0,
                        attackInterval: 2500,
                        movePattern: "horizontal",
                        speedMultiplier: 1.0,
                        damageMultiplier: 1.0,
                        attacks: ["straightShot", "fanShot"]
                    },
                    {
                        id: 1,
                        name: "全力攻击",
                        healthThreshold: 0.4,
                        attackInterval: 1500,
                        movePattern: "figure8",
                        speedMultiplier: 1.3,
                        damageMultiplier: 1.4,
                        attacks: ["fanShot", "circularBarrage", "homingMissile"]
                    }
                ]
            },
            
            // 第二关Boss - 钢铁战舰
            iron_battleship: {
                id: "iron_battleship",
                name: "钢铁战舰",
                type: "air",
                level: 2,
                maxHealth: 5000,
                healthBars: 3,
                defense: 40,
                damageReduction: 0.1,
                baseSpeed: 45,
                width: 200,
                height: 150,
                scoreValue: 40000,
                dropItems: [
                    { type: "powerUp", level: 3, chance: 1.0 },
                    { type: "bomb", count: 3, chance: 0.9 },
                    { type: "shield", chance: 0.6 },
                    { type: "life", chance: 0.4 }
                ],
                weakPoints: [
                    {
                        position: { x: 0, y: -30 },
                        damageMultiplier: 2.5,
                        size: { width: 35, height: 35 },
                        exposeDuration: 3000,
                        exposeInterval: 8000
                    },
                    {
                        position: { x: -60, y: 20 },
                        damageMultiplier: 1.8,
                        size: { width: 30, height: 30 },
                        exposeTiming: "always"
                    },
                    {
                        position: { x: 60, y: 20 },
                        damageMultiplier: 1.8,
                        size: { width: 30, height: 30 },
                        exposeTiming: "always"
                    }
                ],
                phases: [
                    {
                        id: 0,
                        name: "炮塔齐射",
                        healthThreshold: 1.0,
                        attackInterval: 2000,
                        movePattern: "horizontal",
                        speedMultiplier: 1.0,
                        damageMultiplier: 1.2,
                        attacks: ["fanShot", "missileVolley"]
                    },
                    {
                        id: 1,
                        name: "激光网络",
                        healthThreshold: 0.6,
                        attackInterval: 1800,
                        movePattern: "circular",
                        speedMultiplier: 1.2,
                        damageMultiplier: 1.4,
                        attacks: ["laserSweep", "circularBarrage", "homingMissile"]
                    },
                    {
                        id: 2,
                        name: "最后反击",
                        healthThreshold: 0.25,
                        attackInterval: 1200,
                        movePattern: "aggressive",
                        speedMultiplier: 1.5,
                        damageMultiplier: 1.6,
                        attacks: ["ultimateAttack", "missileVolley", "laserSweep"]
                    }
                ]
            },
            
            // 第三关Boss - 天空要塞
            sky_fortress: {
                id: "sky_fortress",
                name: "天空要塞",
                type: "air",
                level: 3,
                maxHealth: 8000,
                healthBars: 4,
                defense: 60,
                damageReduction: 0.15,
                baseSpeed: 35,
                width: 280,
                height: 200,
                scoreValue: 75000,
                dropItems: [
                    { type: "powerUp", level: 4, chance: 1.0 },
                    { type: "bomb", count: 5, chance: 1.0 },
                    { type: "shield", chance: 0.8 },
                    { type: "life", chance: 0.6 },
                    { type: "specialWeapon", chance: 0.3 }
                ],
                weakPoints: [
                    {
                        position: { x: 0, y: 0 },
                        damageMultiplier: 3.0,
                        size: { width: 40, height: 40 },
                        exposeDuration: 2000,
                        exposeInterval: 12000
                    },
                    {
                        position: { x: -80, y: -20 },
                        damageMultiplier: 2.0,
                        size: { width: 35, height: 35 },
                        exposeDuration: 4000,
                        exposeInterval: 10000
                    },
                    {
                        position: { x: 80, y: -20 },
                        damageMultiplier: 2.0,
                        size: { width: 35, height: 35 },
                        exposeDuration: 4000,
                        exposeInterval: 10000
                    }
                ],
                phases: [
                    {
                        id: 0,
                        name: "防御模式",
                        healthThreshold: 1.0,
                        attackInterval: 2200,
                        movePattern: "horizontal",
                        speedMultiplier: 1.0,
                        damageMultiplier: 1.0,
                        attacks: ["circularBarrage", "fanShot"]
                    },
                    {
                        id: 1,
                        name: "攻击模式",
                        healthThreshold: 0.7,
                        attackInterval: 1600,
                        movePattern: "circular",
                        speedMultiplier: 1.1,
                        damageMultiplier: 1.3,
                        attacks: ["laserSweep", "homingMissile", "missileVolley"]
                    },
                    {
                        id: 2,
                        name: "狂暴模式",
                        healthThreshold: 0.4,
                        attackInterval: 1200,
                        movePattern: "figure8",
                        speedMultiplier: 1.4,
                        damageMultiplier: 1.5,
                        attacks: ["ultimateAttack", "circularBarrage", "laserSweep"]
                    },
                    {
                        id: 3,
                        name: "绝境反击",
                        healthThreshold: 0.15,
                        attackInterval: 800,
                        movePattern: "aggressive",
                        speedMultiplier: 1.8,
                        damageMultiplier: 2.0,
                        attacks: ["ultimateAttack", "missileVolley", "homingMissile"]
                    }
                ]
            },
            
            // 最终Boss - 毁灭者
            annihilator: {
                id: "annihilator",
                name: "毁灭者",
                type: "hybrid",
                level: 5,
                maxHealth: 15000,
                healthBars: 5,
                defense: 100,
                damageReduction: 0.2,
                baseSpeed: 50,
                width: 320,
                height: 240,
                scoreValue: 150000,
                dropItems: [
                    { type: "powerUp", level: 5, chance: 1.0 },
                    { type: "bomb", count: 10, chance: 1.0 },
                    { type: "shield", chance: 1.0 },
                    { type: "life", chance: 1.0 },
                    { type: "specialWeapon", chance: 0.8 },
                    { type: "ultimateWeapon", chance: 0.5 }
                ],
                weakPoints: [
                    {
                        position: { x: 0, y: -40 },
                        damageMultiplier: 4.0,
                        size: { width: 50, height: 50 },
                        exposeDuration: 1500,
                        exposeInterval: 15000
                    },
                    {
                        position: { x: -90, y: 0 },
                        damageMultiplier: 2.5,
                        size: { width: 40, height: 40 },
                        exposeDuration: 3000,
                        exposeInterval: 12000
                    },
                    {
                        position: { x: 90, y: 0 },
                        damageMultiplier: 2.5,
                        size: { width: 40, height: 40 },
                        exposeDuration: 3000,
                        exposeInterval: 12000
                    }
                ],
                phases: [
                    {
                        id: 0,
                        name: "试探阶段",
                        healthThreshold: 1.0,
                        attackInterval: 2000,
                        movePattern: "circular",
                        speedMultiplier: 1.0,
                        damageMultiplier: 1.2,
                        attacks: ["fanShot", "circularBarrage"]
                    },
                    {
                        id: 1,
                        name: "空战形态",
                        healthThreshold: 0.8,
                        attackInterval: 1500,
                        movePattern: "figure8",
                        speedMultiplier: 1.3,
                        damageMultiplier: 1.4,
                        attacks: ["laserSweep", "homingMissile", "missileVolley"]
                    },
                    {
                        id: 2,
                        name: "地面形态",
                        healthThreshold: 0.6,
                        attackInterval: 1300,
                        movePattern: "horizontal",
                        speedMultiplier: 0.8,
                        damageMultiplier: 1.8,
                        attacks: ["ultimateAttack", "circularBarrage", "laserSweep"]
                    },
                    {
                        id: 3,
                        name: "混合形态",
                        healthThreshold: 0.3,
                        attackInterval: 1000,
                        movePattern: "aggressive",
                        speedMultiplier: 1.5,
                        damageMultiplier: 2.0,
                        attacks: ["ultimateAttack", "missileVolley", "homingMissile"]
                    },
                    {
                        id: 4,
                        name: "终极形态",
                        healthThreshold: 0.1,
                        attackInterval: 600,
                        movePattern: "aggressive",
                        speedMultiplier: 2.0,
                        damageMultiplier: 2.5,
                        attacks: ["ultimateAttack", "laserSweep", "circularBarrage"]
                    }
                ]
            }
        };
    }
    
    /**
     * 更新Boss管理器
     */
    update(dt, player, bulletSystem, particleSystem) {
        // 更新警告计时器
        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
        }
        
        // 处理击败序列
        if (this.defeatSequenceActive) {
            this.updateDefeatSequence(dt, particleSystem);
            return;
        }
        
        // 更新当前Boss
        if (this.currentBoss) {
            const bullets = this.currentBoss.update(dt, player, bulletSystem);
            if (bullets) {
                bulletSystem.addBullets(bullets, true);
            }
            
            // 检查Boss是否死亡
            if (this.currentBoss.isDead) {
                this.handleBossDefeat(particleSystem);
            }
        }
        
        // 检查是否需要生成新Boss
        this.checkBossSpawn();
    }
    
    /**
     * 检查Boss生成
     */
    checkBossSpawn() {
        if (this.currentBoss || this.bossQueue.length === 0) return;
        
        const now = Date.now();
        const nextBoss = this.bossQueue[0];
        
        if (now >= nextBoss.spawnTime) {
            this.spawnBoss(nextBoss.bossId);
            this.bossQueue.shift();
        }
    }
    
    /**
     * 安排Boss生成
     */
    scheduleBoss(bossId, delay = 3000) {
        const spawnTime = Date.now() + delay;
        
        this.bossQueue.push({
            bossId: bossId,
            spawnTime: spawnTime
        });
        
        // 显示Boss警告
        this.showBossWarning(bossId, delay);
    }
    
    /**
     * 显示Boss警告
     */
    showBossWarning(bossId, delay) {
        this.warningTimer = delay;
        this.battleWarningShown = true;
        
        // 这里可以播放警告音效
        console.log(`警告: ${this.bossTemplates[bossId]?.name || '未知Boss'} 即将出现!`);
    }
    
    /**
     * 生成Boss
     */
    spawnBoss(bossData) {
        let template;
        
        // 支持两种调用方式：传入ID字符串或配置对象
        if (typeof bossData === 'string') {
            template = this.bossTemplates[bossData];
            if (!template) {
                console.warn(`未找到Boss模板: ${bossData}`);
                return null;
            }
        } else {
            // 从配置对象中获取type并查找模板
            const bossType = bossData.type || 'bomber_commander';
            template = this.bossTemplates[bossType];
            if (!template) {
                console.warn(`未找到Boss模板: ${bossType}`);
                return null;
            }
        }
        
        // 每次生成独立配置，保留关卡难度调整后的Boss血量
        const bossConfig = JSON.parse(JSON.stringify(template));
        if (bossData && typeof bossData === 'object' && Number.isFinite(bossData.health)) {
            bossConfig.maxHealth = bossData.health;
        }
        this.currentBoss = new Boss(bossConfig);
        this.inBossBattle = true;
        this.battleStartTime = Date.now();
        
        // 触发生成回调
        if (this.onSpawnBoss) {
            this.onSpawnBoss(this.currentBoss);
        }
        this.battleWarningShown = false;
        
        // 重置统计数据
        this.resetBattleStats();
        
        console.log(`${template.name} 出现了!`);
        
        return this.currentBoss;
    }
    
    /**
     * 重置战斗统计
     */
    resetBattleStats() {
        this.battleStats = {
            damageDealt: 0,
            damageTaken: 0,
            bulletsFired: 0,
            accurateHits: 0,
            startHealth: this.game.player ? this.game.player.health : 100,
            startTime: Date.now()
        };
    }
    
    /**
     * 处理Boss击败
     */
    handleBossDefeat(particleSystem) {
        if (!this.currentBoss) return;
        
        const bossData = this.currentBoss.die();
        
        // 开始击败特效序列
        this.startDefeatSequence(particleSystem);
        
        // 计算奖励
        const rewards = this.calculateRewards(bossData);
        
        // 发放奖励
        this.distributeRewards(rewards);
        
        // 更新统计
        this.updateStats(bossData);
        
        console.log(`${this.currentBoss.name} 被击败!`);
        console.log(`获得分数: ${rewards.score}`);
        console.log(`获得道具: `, rewards.items);
    }
    
    /**
     * 开始击败特效序列
     */
    startDefeatSequence(particleSystem) {
        this.defeatSequenceActive = true;
        this.defeatTimer = 0;
        
        if (particleSystem && this.currentBoss) {
            // 创建大爆炸效果
            particleSystem.createExplosion(
                this.currentBoss.x,
                this.currentBoss.y,
                {
                    count: 50,
                    minSpeed: 100,
                    maxSpeed: 400,
                    minSize: 5,
                    maxSize: 15,
                    colors: ['#FF4500', '#FFD700', '#FF6347', '#FFA500'],
                    lifetime: 2.0,
                    gravity: 100
                }
            );
        }
    }
    
    /**
     * 更新击败序列
     */
    updateDefeatSequence(dt, particleSystem) {
        this.defeatTimer += dt;
        
        if (!this.currentBoss) return;
        
        // 连锁爆炸效果
        if (this.defeatTimer < 2 && Math.random() < 0.3) {
            const offsetX = (Math.random() - 0.5) * this.currentBoss.width;
            const offsetY = (Math.random() - 0.5) * this.currentBoss.height;
            
            if (particleSystem) {
                particleSystem.createExplosion(
                    this.currentBoss.x + offsetX,
                    this.currentBoss.y + offsetY,
                    {
                        count: 20,
                        minSpeed: 50,
                        maxSpeed: 200,
                        minSize: 3,
                        maxSize: 8,
                        colors: ['#FF4500', '#FFD700'],
                        lifetime: 1.0
                    }
                );
            }
        }
        
        // 结束击败序列
        if (this.defeatTimer >= 3) {
            this.defeatSequenceActive = false;
            this.currentBoss = null;
            this.inBossBattle = false;
            
            // 触发击败回调
            if (this.onBossDefeated) {
                this.onBossDefeated();
            }
        }
    }
    
    /**
     * 根据模板创建Boss实例
     */
    createBossFromTemplate(bossType) {
        const template = this.bossTemplates[bossType];
        if (!template) {
            console.warn(`未找到Boss模板: ${bossType}`);
            return null;
        }
        
        // 创建新Boss实例
        const boss = new Boss(
            GameConfig.CANVAS.WIDTH / 2,
            150,
            bossType
        );
        
        // 应用模板属性
        boss.maxHealth = template.maxHealth;
        boss.currentHealth = template.maxHealth;
        boss.defense = template.defense;
        boss.damageReduction = template.damageReduction;
        boss.baseSpeed = template.baseSpeed;
        boss.scoreValue = template.scoreValue;
        
        return boss;
    }
    
    /**
     * 计算奖励
     */
    calculateRewards(bossData) {
        let baseScore = bossData.score || 0;
        let scoreMultiplier = this.rewardMultiplier;
        
        // 计算奖励加成
        const battleTime = Date.now() - this.battleStats.startTime;
        const healthLost = this.battleStats.startHealth - (this.game.player?.health || 0);
        
        // 速度奖励 (30秒内击败)
        if (battleTime < 30000) {
            scoreMultiplier += 0.5;
            this.speedBonus = true;
        }
        
        // 无伤奖励
        if (healthLost === 0) {
            scoreMultiplier += 1.0;
            this.noHitBonus = true;
        }
        
        // 完美奖励 (无伤 + 快速击败)
        if (this.noHitBonus && this.speedBonus) {
            scoreMultiplier += 0.5;
            this.perfectionBonus = true;
        }
        
        const finalScore = Math.floor(baseScore * scoreMultiplier);
        
        // 处理道具掉落
        const items = [];
        if (bossData.dropItems) {
            bossData.dropItems.forEach(item => {
                if (Math.random() < item.chance) {
                    items.push({
                        type: item.type,
                        level: item.level,
                        count: item.count || 1
                    });
                }
            });
        }
        
        return {
            score: finalScore,
            items: items,
            bonuses: {
                speed: this.speedBonus,
                noHit: this.noHitBonus,
                perfect: this.perfectionBonus
            },
            multiplier: scoreMultiplier
        };
    }
    
    /**
     * 发放奖励
     */
    distributeRewards(rewards) {
        // 给玩家加分
        if (this.game.player && rewards.score > 0) {
            this.game.player.score += rewards.score;
        }
        
        // 发放道具
        rewards.items.forEach(item => {
            this.distributeItem(item);
        });
        
        // 重置奖励状态
        this.resetRewardState();
    }
    
    /**
     * 发放单个道具
     */
    distributeItem(item) {
        if (!this.game.player) return;
        
        switch (item.type) {
            case 'powerUp':
                if (this.game.player.weaponManager?.activeWeapon) {
                    this.game.player.weaponManager.activeWeapon.upgrade();
                }
                break;
            case 'bomb':
                this.game.player.bombs = Math.min(
                    this.game.player.maxBombs,
                    this.game.player.bombs + (item.count || 1)
                );
                break;
            case 'life':
                this.game.player.lives += (item.count || 1);
                break;
            case 'shield':
                this.game.player.activateShield(5000);
                break;
            case 'specialWeapon':
                // TODO: equip-system special weapons
                break;
            case 'ultimateWeapon':
                // TODO: equip-system ultimate weapons
                break;
        }
    }
    
    /**
     * 重置奖励状态
     */
    resetRewardState() {
        this.rewardMultiplier = 1.0;
        this.perfectionBonus = false;
        this.speedBonus = false;
        this.noHitBonus = false;
    }
    
    /**
     * 更新统计数据
     */
    updateStats(bossData) {
        // 这里可以更新全局统计数据
        if (this.game.stats) {
            this.game.stats.bossesDefeated++;
            this.game.stats.totalScore += bossData.score;
        }
    }
    
    /**
     * 处理Boss受伤
     */
    onBossDamage(damage, hitPoint) {
        if (this.currentBoss) {
            this.battleStats.damageDealt += damage;
            this.battleStats.accurateHits++;
            
            return this.currentBoss.takeDamage(damage, hitPoint);
        }
        return false;
    }
    
    /**
     * 处理玩家受伤
     */
    onPlayerDamage(damage) {
        this.battleStats.damageTaken += damage;
    }
    
    /**
     * 处理玩家开火
     */
    onPlayerShoot() {
        this.battleStats.bulletsFired++;
    }
    
    /**
     * 获取当前Boss状态
     */
    getBossStatus() {
        if (!this.currentBoss) return null;
        
        return {
            ...this.currentBoss.getStatus(),
            battleTime: Date.now() - this.battleStats.startTime,
            damageDealt: this.battleStats.damageDealt,
            accuracy: this.battleStats.bulletsFired > 0 ? 
                     this.battleStats.accurateHits / this.battleStats.bulletsFired : 0
        };
    }
    
    /**
     * 检查是否在Boss战中
     */
    isInBossBattle() {
        return this.inBossBattle && this.currentBoss && !this.currentBoss.isDead;
    }
    
    /**
     * 获取Boss警告状态
     */
    getBossWarning() {
        if (this.warningTimer > 0 && this.bossQueue.length > 0) {
            const nextBoss = this.bossQueue[0];
            const template = this.bossTemplates[nextBoss.bossId];
            
            return {
                active: true,
                bossName: template?.name || '未知Boss',
                timeRemaining: this.warningTimer,
                message: `警告: ${template?.name || '未知Boss'} 即将出现!`
            };
        }
        
        return { active: false };
    }
    
    /**
     * 强制生成Boss (调试用)
     */
    forceBossSpawn(bossId) {
        this.spawnBoss(bossId);
    }
    
    /**
     * 清空Boss队列
     */
    clearBossQueue() {
        this.bossQueue = [];
        this.warningTimer = 0;
        this.battleWarningShown = false;
    }
    
    /**
     * 立即击败Boss (调试用)
     */
    defeatCurrentBoss() {
        if (this.currentBoss) {
            this.currentBoss.health = 0;
            this.currentBoss.die();
        }
    }
    
    /**
     * 渲染Boss系统UI
     */
    render(renderer) {
        // 渲染当前Boss
        if (this.currentBoss) {
            this.currentBoss.render(renderer);
        }
        
        // 渲染Boss警告
        const warning = this.getBossWarning();
        if (warning.active) {
            this.renderBossWarning(renderer, warning);
        }
        
        // 渲染Boss血条和信息
        const bossStatus = this.getBossStatus();
        if (bossStatus) {
            this.renderBossUI(renderer, bossStatus);
        }
    }
    
    /**
     * 渲染Boss警告
     */
    renderBossWarning(renderer, warning) {
        const ctx = renderer.ctx;
        
        // 警告背景
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, GameConfig.CANVAS.WIDTH, GameConfig.CANVAS.HEIGHT);
        
        // 警告文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        
        const centerX = GameConfig.CANVAS.WIDTH / 2;
        const centerY = GameConfig.CANVAS.HEIGHT / 2;
        
        ctx.strokeText(warning.message, centerX, centerY);
        ctx.fillText(warning.message, centerX, centerY);
        
        // 倒计时
        const seconds = Math.ceil(warning.timeRemaining / 1000);
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#FF4500';
        ctx.strokeText(seconds.toString(), centerX, centerY + 60);
        ctx.fillText(seconds.toString(), centerX, centerY + 60);
    }
    
    /**
     * 渲染Boss UI
     */
    renderBossUI(renderer, bossStatus) {
        const ctx = renderer.ctx;
        
        // Boss名称和阶段信息
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        
        const phaseText = `${bossStatus.name} - 阶段 ${bossStatus.currentPhase + 1}/${bossStatus.totalPhases}`;
        ctx.fillText(phaseText, GameConfig.CANVAS.WIDTH / 2, 30);
        
        // 战斗时间
        const battleTime = Math.floor(bossStatus.battleTime / 1000);
        const timeText = `战斗时间: ${Math.floor(battleTime / 60)}:${(battleTime % 60).toString().padStart(2, '0')}`;
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(timeText, GameConfig.CANVAS.WIDTH - 10, 50);
        
        // 准确率
        const accuracyText = `准确率: ${Math.floor(bossStatus.accuracy * 100)}%`;
        ctx.fillText(accuracyText, GameConfig.CANVAS.WIDTH - 10, 70);
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        this.currentBoss = null;
        this.bossQueue = [];
        this.inBossBattle = false;
        this.defeatSequenceActive = false;
        this.battleWarningShown = false;
        this.resetRewardState();
    }
}