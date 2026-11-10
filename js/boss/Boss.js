/**
 * Boss基类
 * 定义Boss的基础属性和行为，包括多阶段战斗、弱点系统、攻击模式等
 */
class Boss {
    constructor(config = {}) {
        // 基础标识
        this.id = config.id || 'generic_boss';
        this.name = config.name || '未知Boss';
        this.type = config.type || 'air'; // air, ground, hybrid
        this.level = config.level || 1;
        
        // 位置和尺寸
        this.x = config.x || GameConfig.CANVAS.WIDTH / 2;
        this.y = config.y || 100;
        this.width = config.width || 200;
        this.height = config.height || 150;
        this.hitboxRadius = Math.min(this.width, this.height) / 3;
        
        // 生命值系统
        this.maxHealth = config.maxHealth || 10000;
        this.health = this.maxHealth;
        this.healthBars = config.healthBars || 3;
        this.healthPerBar = this.maxHealth / this.healthBars;
        this.currentBar = this.healthBars;
        
        // 防御属性
        this.defense = config.defense || 50;
        this.damageReduction = config.damageReduction || 0.1; // 10%伤害减免
        this.immunities = config.immunities || [];
        
        // 移动属性
        this.baseSpeed = config.baseSpeed || 50;
        this.vx = 0;
        this.vy = 0;
        this.acceleration = 200;
        this.targetX = this.x;
        this.targetY = this.y;
        
        // 阶段管理
        this.phases = config.phases || this.getDefaultPhases();
        this.currentPhase = 0;
        this.phaseTransition = false;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        
        // 弱点系统
        this.weakPoints = config.weakPoints || [];
        this.activeWeakPoints = [];
        this.weakPointCycle = 0;
        
        // 攻击系统
        this.attackPatterns = config.attackPatterns || [];
        this.currentAttackIndex = 0;
        this.attackCooldown = 0;
        this.lastAttackTime = 0;
        this.isAttacking = false;
        
        // 状态标识
        this.active = true;
        this.isDead = false;
        this.isEntering = true;
        this.enterTime = 0;
        this.entranceDuration = 2; // 秒，游戏逻辑 dt 使用秒
        
        // 视觉效果
        this.flashTime = 0;
        this.shakeAmount = 0;
        this.color = this.getTierColor();
        
        // 奖励配置
        this.scoreValue = config.scoreValue || 50000;
        this.dropItems = config.dropItems || [];
        
        // 状态时间记录
        this.stateTime = 0;
        this.phaseStartTime = 0;
        
        // 初始化弱点
        this.initializeWeakPoints();
        
        // 入场动画
        this.startEntranceAnimation();
    }
    
    /**
     * 获取默认阶段配置
     */
    getDefaultPhases() {
        return [
            {
                id: 0,
                name: "第一阶段",
                healthThreshold: 1.0,
                attackInterval: 3000,
                movePattern: "horizontal",
                speedMultiplier: 1.0,
                damageMultiplier: 1.0,
                attacks: ["straightShot", "fanShot"]
            },
            {
                id: 1,
                name: "第二阶段", 
                healthThreshold: 0.6,
                attackInterval: 2000,
                movePattern: "figure8",
                speedMultiplier: 1.2,
                damageMultiplier: 1.3,
                attacks: ["fanShot", "circularBarrage", "homingMissile"]
            },
            {
                id: 2,
                name: "最终阶段",
                healthThreshold: 0.3,
                attackInterval: 1500,
                movePattern: "aggressive",
                speedMultiplier: 1.5,
                damageMultiplier: 1.5,
                attacks: ["laserSweep", "missileVolley", "ultimateAttack"]
            }
        ];
    }
    
    /**
     * 根据等级获取颜色
     */
    getTierColor() {
        const colors = {
            1: '#FF4500',  // 橙红色
            2: '#9400D3',  // 紫色
            3: '#FFD700',  // 金色
            4: '#DC143C',  // 深红色
            5: '#00FF00'   // 绿色（特殊Boss）
        };
        return colors[this.level] || '#FF4500';
    }
    
    /**
     * 初始化弱点系统
     */
    initializeWeakPoints() {
        this.weakPoints.forEach((wp, index) => {
            wp.id = wp.id || `weakpoint_${index}`;
            wp.isActive = wp.isActive !== undefined ? wp.isActive : true;
            wp.isExposed = wp.isExposed !== undefined ? wp.isExposed : true;
            wp.damageMultiplier = wp.damageMultiplier || 2.0;
            wp.size = wp.size || { width: 30, height: 30 };
            wp.exposeDuration = wp.exposeDuration || 3000;
            wp.exposeInterval = wp.exposeInterval || 8000;
            wp.lastExposeTime = 0;
        });
        this.activeWeakPoints = [...this.weakPoints];
    }
    
    /**
     * 开始入场动画
     */
    startEntranceAnimation() {
        this.x = GameConfig.CANVAS.WIDTH / 2;
        this.y = -this.height / 2;
        this.targetY = 100;
        this.invulnerable = true;
    }
    
    /**
     * 更新Boss
     */
    update(dt, player = null, bulletSystem = null) {
        if (!this.active || this.isDead) return null;
        
        this.stateTime += dt;
        
        // 处理入场动画
        if (this.isEntering) {
            this.updateEntranceAnimation(dt);
            return null;
        }
        
        // 更新无敌时间
        if (this.invulnerableTime > 0) {
            this.invulnerableTime -= dt;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // 更新闪烁效果
        if (this.flashTime > 0) {
            this.flashTime -= dt;
        }
        
        // 更新震动效果
        if (this.shakeAmount > 0) {
            this.shakeAmount = Math.max(0, this.shakeAmount - dt * 50);
        }
        
        // 检查阶段转换
        this.checkPhaseTransition();
        
        // 更新弱点系统
        this.updateWeakPoints(dt);
        
        // 更新移动
        this.updateMovement(dt);
        
        // 更新攻击
        const bullets = this.updateAttacks(dt, player, bulletSystem);
        
        return bullets;
    }
    
    /**
     * 更新入场动画
     */
    updateEntranceAnimation(dt) {
        this.enterTime += dt;
        
        // 移动到目标位置
        const targetY = 100;
        if (Math.abs(this.y - targetY) > 2) {
            this.y += (targetY - this.y) * dt * 2;
        } else {
            this.y = targetY;
        }
        
        // 入场完成
        if (this.enterTime >= this.entranceDuration) {
            this.isEntering = false;
            this.invulnerable = false;
            this.phaseStartTime = this.stateTime;
        }
    }
    
    /**
     * 检查阶段转换
     */
    checkPhaseTransition() {
        if (this.phaseTransition) return;
        
        const healthRatio = this.health / this.maxHealth;
        
        for (let i = this.currentPhase + 1; i < this.phases.length; i++) {
            const phase = this.phases[i];
            if (healthRatio <= phase.healthThreshold) {
                this.startPhaseTransition(i);
                break;
            }
        }
    }
    
    /**
     * 开始阶段转换
     */
    startPhaseTransition(nextPhase) {
        this.phaseTransition = true;
        this.invulnerable = true;
        this.invulnerableTime = 1.5; // 秒
        
        // 清除当前攻击
        this.isAttacking = false;
        this.attackCooldown = 0;
        
        // 震动效果
        this.shakeAmount = 20;
        
        // 切换阶段
        setTimeout(() => {
            this.currentPhase = nextPhase;
            this.phaseTransition = false;
            this.phaseStartTime = this.stateTime;
            
            // 重置攻击模式
            this.currentAttackIndex = 0;
            this.lastAttackTime = this.stateTime;
        }, 500);
    }
    
    /**
     * 更新弱点系统
     */
    updateWeakPoints(dt) {
        this.weakPointCycle += dt * 1000; // 弱点暴露间隔配置使用毫秒
        
        this.weakPoints.forEach(wp => {
            if (!wp.isActive) return;
            
            // 周期性暴露弱点
            if (wp.exposeInterval > 0) {
                const cycleTime = this.weakPointCycle % wp.exposeInterval;
                wp.isExposed = cycleTime < wp.exposeDuration;
            }
        });
        
        this.activeWeakPoints = this.weakPoints.filter(wp => wp.isActive && wp.isExposed);
    }
    
    /**
     * 更新移动
     */
    updateMovement(dt) {
        if (this.phaseTransition) return;
        
        const phase = this.phases[this.currentPhase];
        if (!phase) return;
        
        const speed = this.baseSpeed * phase.speedMultiplier;
        
        switch (phase.movePattern) {
            case "horizontal":
                this.horizontalMovement(dt, speed);
                break;
            case "figure8":
                this.figure8Movement(dt, speed);
                break;
            case "circular":
                this.circularMovement(dt, speed);
                break;
            case "aggressive":
                this.aggressiveMovement(dt, speed);
                break;
            default:
                this.horizontalMovement(dt, speed);
        }
        
        // 应用速度
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // 边界限制
        this.x = Math.max(this.width / 2, Math.min(GameConfig.CANVAS.WIDTH - this.width / 2, this.x));
        this.y = Math.max(50, Math.min(300, this.y));
    }
    
    /**
     * 水平移动模式
     */
    horizontalMovement(dt, speed) {
        const center = GameConfig.CANVAS.WIDTH / 2;
        const range = 200;
        
        this.targetX = center + Math.sin(this.stateTime * 0.5) * range;
        this.vx = (this.targetX - this.x) * 2;
        this.vy = 0;
    }
    
    /**
     * 8字移动模式
     */
    figure8Movement(dt, speed) {
        const center = GameConfig.CANVAS.WIDTH / 2;
        const time = this.stateTime * 0.8;
        
        this.targetX = center + Math.sin(time) * 150;
        this.targetY = 150 + Math.sin(time * 2) * 50;
        
        this.vx = (this.targetX - this.x) * 2;
        this.vy = (this.targetY - this.y) * 2;
    }
    
    /**
     * 圆形移动模式
     */
    circularMovement(dt, speed) {
        const center = GameConfig.CANVAS.WIDTH / 2;
        const radius = 100;
        const time = this.stateTime * 0.6;
        
        this.targetX = center + Math.cos(time) * radius;
        this.targetY = 150 + Math.sin(time) * radius * 0.5;
        
        this.vx = (this.targetX - this.x) * 2;
        this.vy = (this.targetY - this.y) * 2;
    }
    
    /**
     * 激进移动模式
     */
    aggressiveMovement(dt, speed) {
        const time = this.stateTime;
        const fastTime = time * 1.5;
        
        this.targetX = GameConfig.CANVAS.WIDTH / 2 + Math.sin(fastTime) * 200;
        this.targetY = 120 + Math.cos(fastTime * 0.7) * 80;
        
        this.vx = (this.targetX - this.x) * 3;
        this.vy = (this.targetY - this.y) * 3;
    }
    
    /**
     * 更新攻击系统
     */
    updateAttacks(dt, player, bulletSystem) {
        if (this.phaseTransition || !player) return null;
        
        const phase = this.phases[this.currentPhase];
        if (!phase || !phase.attacks) return null;
        
        // 更新攻击冷却
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            return null;
        }
        
        // 检查攻击间隔（将毫秒转换为秒）
        const timeSinceLastAttack = this.stateTime - this.lastAttackTime;
        if (timeSinceLastAttack < phase.attackInterval / 1000) return null;
        
        // 选择攻击模式
        const attackType = this.selectAttackPattern(phase);
        if (!attackType) return null;
        
        // 执行攻击
        const bullets = this.executeAttack(attackType, player, phase.damageMultiplier);
        
        // 更新攻击状态
        this.lastAttackTime = this.stateTime;
        this.attackCooldown = 0.5; // 秒
        this.currentAttackIndex = (this.currentAttackIndex + 1) % phase.attacks.length;
        
        return bullets;
    }
    
    /**
     * 选择攻击模式
     */
    selectAttackPattern(phase) {
        if (!phase.attacks || phase.attacks.length === 0) return null;
        
        // 循环选择攻击模式
        return phase.attacks[this.currentAttackIndex];
    }
    
    /**
     * 执行攻击
     */
    executeAttack(attackType, player, damageMultiplier = 1.0) {
        const bullets = [];
        const baseDamage = 25 * damageMultiplier;
        
        switch (attackType) {
            case "straightShot":
                bullets.push(...this.createStraightShot(player, baseDamage));
                break;
            case "fanShot":
                bullets.push(...this.createFanShot(player, baseDamage));
                break;
            case "circularBarrage":
                bullets.push(...this.createCircularBarrage(baseDamage));
                break;
            case "homingMissile":
                bullets.push(...this.createHomingMissile(player, baseDamage * 1.5));
                break;
            case "laserSweep":
                bullets.push(...this.createLaserSweep(baseDamage * 2));
                break;
            case "missileVolley":
                bullets.push(...this.createMissileVolley(player, baseDamage));
                break;
            case "ultimateAttack":
                bullets.push(...this.createUltimateAttack(player, baseDamage * 2));
                break;
        }
        
        return bullets.length > 0 ? bullets : null;
    }
    
    /**
     * 直线射击
     */
    createStraightShot(player, damage) {
        const bullets = [];
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        for (let i = 0; i < 3; i++) {
            bullets.push(this.createBullet(
                this.x,
                this.y + 20,
                angle + (i - 1) * 0.1,
                300,
                damage,
                '#FF6347'
            ));
        }
        
        return bullets;
    }
    
    /**
     * 扇形射击
     */
    createFanShot(player, damage) {
        const bullets = [];
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);
        const spreadAngle = Math.PI / 4; // 45度
        
        for (let i = 0; i < 7; i++) {
            const angle = baseAngle - spreadAngle / 2 + (spreadAngle / 6) * i;
            bullets.push(this.createBullet(
                this.x,
                this.y + 20,
                angle,
                280,
                damage,
                '#FF4500'
            ));
        }
        
        return bullets;
    }
    
    /**
     * 环形弹幕
     */
    createCircularBarrage(damage) {
        const bullets = [];
        const bulletCount = 16;
        
        for (let i = 0; i < bulletCount; i++) {
            const angle = (Math.PI * 2 / bulletCount) * i + this.stateTime;
            bullets.push(this.createBullet(
                this.x,
                this.y,
                angle,
                200,
                damage * 0.8,
                '#FFD700'
            ));
        }
        
        return bullets;
    }
    
    /**
     * 追踪导弹
     */
    createHomingMissile(player, damage) {
        const bullets = [];
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        const missile = this.createBullet(
            this.x,
            this.y + 20,
            angle,
            150,
            damage,
            '#9400D3'
        );
        
        missile.isHoming = true;
        missile.turnRate = 3;
        missile.targetId = 'player';
        missile.size = 8;
        
        bullets.push(missile);
        
        return bullets;
    }
    
    /**
     * 激光扫射
     */
    createLaserSweep(damage) {
        const bullets = [];
        const laserCount = 3;
        const baseAngle = Math.PI / 2; // 向下
        
        for (let i = 0; i < laserCount; i++) {
            const angle = baseAngle + Math.sin(this.stateTime * 2 + i) * 0.5;
            
            // 创建激光子弹链
            for (let j = 0; j < 5; j++) {
                bullets.push(this.createBullet(
                    this.x,
                    this.y + 20 + j * 15,
                    angle,
                    400,
                    damage / 5,
                    '#00FFFF'
                ));
            }
        }
        
        return bullets;
    }
    
    /**
     * 导弹齐射
     */
    createMissileVolley(player, damage) {
        const bullets = [];
        const missileCount = 5;
        
        for (let i = 0; i < missileCount; i++) {
            setTimeout(() => {
                const dx = player.x - this.x + (Math.random() - 0.5) * 100;
                const dy = player.y - this.y;
                const angle = Math.atan2(dy, dx);
                
                const missile = this.createBullet(
                    this.x + (i - 2) * 30,
                    this.y + 20,
                    angle,
                    250,
                    damage,
                    '#DC143C'
                );
                
                missile.size = 6;
                bullets.push(missile);
            }, i * 200);
        }
        
        return bullets;
    }
    
    /**
     * 终极攻击
     */
    createUltimateAttack(player, damage) {
        const bullets = [];
        
        // 组合攻击：环形弹幕 + 追踪导弹 + 扇形射击
        bullets.push(...this.createCircularBarrage(damage * 0.5));
        bullets.push(...this.createHomingMissile(player, damage));
        bullets.push(...this.createFanShot(player, damage * 0.7));
        
        return bullets;
    }
    
    /**
     * 创建子弹
     */
    createBullet(x, y, angle, speed, damage, color) {
        return {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            angle: angle,
            speed: speed,
            damage: damage,
            size: 5,
            color: color,
            type: 'boss',
            active: true,
            lifetime: 0,
            maxLifetime: 8000,
            isHoming: false,
            turnRate: 0,
            targetId: null
        };
    }
    
    /**
     * 受到伤害
     */
    takeDamage(damage, hitPoint = null, options = {}) {
        if (this.isDead || this.invulnerable) return false;
        
        let actualDamage = damage;
        let isWeakPointHit = false;
        
        // 检查弱点攻击
        if (hitPoint) {
            for (const wp of this.activeWeakPoints) {
                const wpX = this.x + wp.position.x;
                const wpY = this.y + wp.position.y;
                const distance = Math.sqrt(
                    (hitPoint.x - wpX) ** 2 + (hitPoint.y - wpY) ** 2
                );
                
                if (distance < Math.max(wp.size.width, wp.size.height) / 2) {
                    actualDamage *= wp.damageMultiplier;
                    isWeakPointHit = true;
                    break;
                }
            }
        }
        
        // 计算最终伤害
        // 宠物穿透部分防御，并保留最低比例伤害；玩家武器维持原公式。
        // 原创数值：忽略 50% 固定防御，至少保留 45% 原始伤害。
        const defendedDamage = options.source === 'pet'
            ? Math.max(actualDamage * 0.45, actualDamage - this.defense * 0.5)
            : Math.max(1, actualDamage - this.defense);
        actualDamage = defendedDamage * (1 - this.damageReduction);
        
        this.health -= actualDamage;
        
        // 受击特效
        this.flashTime = 0.1;
        if (isWeakPointHit) {
            this.shakeAmount = 15;
        } else {
            this.shakeAmount = 5;
        }
        
        // 更新血条
        this.currentBar = Math.ceil(this.health / this.healthPerBar);
        
        // 检查死亡
        if (this.health <= 0) {
            this.die();
            return true;
        }
        
        return false;
    }
    
    /**
     * 死亡处理
     */
    die() {
        this.isDead = true;
        this.active = false;
        
        // 这里应该触发死亡动画和奖励掉落
        return {
            score: this.scoreValue,
            dropItems: this.dropItems,
            bossDefeated: true,
            bossId: this.id,
            level: this.level
        };
    }
    
    /**
     * 获取碰撞区域
     */
    getCollisionBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height,
            centerX: this.x,
            centerY: this.y,
            radius: this.hitboxRadius
        };
    }
    
    /**
     * 获取弱点碰撞区域
     */
    getWeakPointBounds() {
        return this.activeWeakPoints.map(wp => ({
            id: wp.id,
            x: this.x + wp.position.x - wp.size.width / 2,
            y: this.y + wp.position.y - wp.size.height / 2,
            width: wp.size.width,
            height: wp.size.height,
            centerX: this.x + wp.position.x,
            centerY: this.y + wp.position.y,
            damageMultiplier: wp.damageMultiplier
        }));
    }
    
    /**
     * 渲染Boss
     */
    render(renderer, assetManager = null) {
        if (!this.active || this.isDead) return;
        
        renderer.ctx.save();
        
        // 应用震动效果
        if (this.shakeAmount > 0) {
            const shakeX = (Math.random() - 0.5) * this.shakeAmount;
            const shakeY = (Math.random() - 0.5) * this.shakeAmount;
            renderer.ctx.translate(shakeX, shakeY);
        }
        
        // 入场透明效果
        if (this.isEntering) {
            const alpha = Math.min(1, this.enterTime / 1);
            renderer.ctx.globalAlpha = alpha;
        }
        
        // 受击闪烁效果
        if (this.flashTime > 0 && Math.floor(this.flashTime * 10) % 2 === 0) {
            renderer.ctx.globalCompositeOperation = 'lighter';
        }
        
        // 无敌时的闪烁效果
        if (this.invulnerable && !this.isEntering) {
            renderer.ctx.globalAlpha = 0.6 + Math.sin(this.stateTime * 10) * 0.4;
        }
        
        // 渲染Boss主体 - 优先使用资源管理器
        // 高频渲染路径不要每帧输出调试信息
        
        // 先绘制一个绿色圆圈标记Boss中心位置
        renderer.ctx.save();
        renderer.ctx.fillStyle = 'lime';
        renderer.ctx.beginPath();
        renderer.ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        renderer.ctx.fill();
        renderer.ctx.restore();
        
        if (assetManager && assetManager.loaded) {
            this.renderWithAssets(renderer, assetManager);
        } else {
            console.warn('使用基础Boss渲染（AssetManager未就绪）');
            this.renderMainBody(renderer);
        }
        
        // 渲染弱点
        this.renderWeakPoints(renderer);
        
        // 渲染血条
        this.renderHealthBars(renderer);
        
        // 渲染阶段提示
        if (this.phaseTransition) {
            this.renderPhaseTransition(renderer);
        }
        
        renderer.ctx.restore();
    }
    
    /**
     * 使用资源渲染Boss
     */
    renderWithAssets(renderer, assetManager) {
        // 根据Boss ID渲染对应的SVG资源
        const assetKey = `bosses.${this.id}`;
        console.log(`尝试渲染Boss资源: ${assetKey}, 存在: ${assetManager.hasAsset(assetKey)}`);
        
        if (assetManager.hasAsset(assetKey)) {
            assetManager.drawAsset(
                renderer.ctx,
                assetKey,
                this.x,
                this.y,
                0, // 旋转角度
                1  // 缩放
            );
        } else {
            console.warn(`Boss资源未找到: ${assetKey}, 使用基础渲染`);
            // 降级到基础渲染
            this.renderMainBody(renderer);
        }
    }
    
    /**
     * 渲染Boss主体
     */
    renderMainBody(renderer) {
        // 根据Boss类型渲染不同形状
        renderer.ctx.fillStyle = this.color;
        renderer.ctx.strokeStyle = '#FFFFFF';
        renderer.ctx.lineWidth = 2;
        
        const x = this.x - this.width / 2;
        const y = this.y - this.height / 2;
        
        switch (this.type) {
            case 'air':
                // 飞行器形状
                renderer.ctx.beginPath();
                renderer.ctx.moveTo(this.x, y);
                renderer.ctx.lineTo(x + this.width * 0.3, y + this.height);
                renderer.ctx.lineTo(x + this.width * 0.7, y + this.height);
                renderer.ctx.closePath();
                renderer.ctx.fill();
                renderer.ctx.stroke();
                
                // 机翼
                renderer.ctx.fillRect(x, y + this.height * 0.3, this.width, this.height * 0.4);
                break;
                
            case 'ground':
                // 坦克形状
                renderer.ctx.fillRect(x, y + this.height * 0.5, this.width, this.height * 0.5);
                renderer.ctx.fillRect(x + this.width * 0.2, y, this.width * 0.6, this.height * 0.6);
                break;
                
            default:
                // 默认矩形
                renderer.ctx.fillRect(x, y, this.width, this.height);
        }
        
        renderer.ctx.stroke();
    }
    
    /**
     * 渲染弱点
     */
    renderWeakPoints(renderer) {
        this.activeWeakPoints.forEach(wp => {
            const wpX = this.x + wp.position.x;
            const wpY = this.y + wp.position.y;
            
            // 弱点发光效果
            renderer.ctx.shadowColor = '#FF0000';
            renderer.ctx.shadowBlur = 10;
            renderer.ctx.fillStyle = '#FF4444';
            
            renderer.ctx.beginPath();
            renderer.ctx.arc(wpX, wpY, wp.size.width / 2, 0, Math.PI * 2);
            renderer.ctx.fill();
            
            // 目标指示器
            renderer.ctx.strokeStyle = '#FFFFFF';
            renderer.ctx.lineWidth = 2;
            renderer.ctx.beginPath();
            renderer.ctx.arc(wpX, wpY, wp.size.width / 2 + 5, 0, Math.PI * 2);
            renderer.ctx.stroke();
            
            renderer.ctx.shadowBlur = 0;
        });
    }
    
    /**
     * 渲染血条系统
     */
    renderHealthBars(renderer) {
        const barWidth = Math.min(300, this.width * 1.5);
        const barHeight = 8;
        const barSpacing = 2;
        const totalHeight = this.healthBars * barHeight + (this.healthBars - 1) * barSpacing;
        
        const startX = this.x - barWidth / 2;
        const startY = this.y - this.height / 2 - totalHeight - 20;
        
        for (let i = 0; i < this.healthBars; i++) {
            const barY = startY + i * (barHeight + barSpacing);
            
            // 背景
            renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            renderer.ctx.fillRect(startX, barY, barWidth, barHeight);
            
            // 血条
            let healthPercent = 0;
            if (i < this.currentBar - 1) {
                healthPercent = 1;
            } else if (i === this.currentBar - 1) {
                const currentBarHealth = this.health - (this.currentBar - 1) * this.healthPerBar;
                healthPercent = currentBarHealth / this.healthPerBar;
            }
            
            if (healthPercent > 0) {
                const colors = ['#FF0000', '#FF4500', '#FFD700', '#00FF00'];
                const colorIndex = Math.min(i, colors.length - 1);
                renderer.ctx.fillStyle = colors[colorIndex];
                renderer.ctx.fillRect(startX, barY, barWidth * healthPercent, barHeight);
            }
            
            // 边框
            renderer.ctx.strokeStyle = '#FFFFFF';
            renderer.ctx.lineWidth = 1;
            renderer.ctx.strokeRect(startX, barY, barWidth, barHeight);
        }
        
        // Boss名称
        renderer.ctx.fillStyle = '#FFFFFF';
        renderer.ctx.font = '16px Arial';
        renderer.ctx.textAlign = 'center';
        renderer.ctx.fillText(this.name, this.x, startY - 10);
    }
    
    /**
     * 渲染阶段转换提示
     */
    renderPhaseTransition(renderer) {
        const phase = this.phases[this.currentPhase];
        if (!phase) return;
        
        renderer.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        renderer.ctx.font = '24px Arial';
        renderer.ctx.textAlign = 'center';
        renderer.ctx.fillText(
            phase.name, 
            GameConfig.CANVAS.WIDTH / 2,
            GameConfig.CANVAS.HEIGHT / 2
        );
    }
    
    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            id: this.id,
            name: this.name,
            health: this.health,
            maxHealth: this.maxHealth,
            healthPercent: this.health / this.maxHealth,
            currentPhase: this.currentPhase,
            totalPhases: this.phases.length,
            isInvulnerable: this.invulnerable,
            activeWeakPoints: this.activeWeakPoints.length,
            isDead: this.isDead,
            accuracy: 0.8,  // 暂时使用默认值，后续可以根据实际命中率计算
            battleTime: this.stateTime * 1000  // 转换为毫秒
        };
    }
}