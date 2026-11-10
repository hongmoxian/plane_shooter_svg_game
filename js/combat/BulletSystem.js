/**
 * 子弹系统
 * 管理所有子弹的生命周期、移动和渲染
 */
class BulletSystem {
    constructor() {
        this.bullets = [];
        this.enemyBullets = [];
        this.bulletPool = [];
        this.maxPoolSize = 500;
        
        // 预创建对象池
        this.initializePool();
    }
    
    /**
     * 初始化对象池
     */
    initializePool() {
        for (let i = 0; i < this.maxPoolSize; i++) {
            this.bulletPool.push(this.createBulletObject());
        }
    }
    
    /**
     * 创建子弹对象
     */
    createBulletObject() {
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            ax: 0, // 加速度x
            ay: 0, // 加速度y
            damage: 0,
            penetration: 0,
            penetrated: 0, // 已穿透次数
            size: 3,
            color: '#FFD700',
            type: 'standard',
            active: false,
            lifetime: 0,
            maxLifetime: 3000,
            isBeam: false,
            isTracking: false,
            target: null,
            trackingSpeed: 0,
            explosionRadius: 0,
            trail: [] // 轨迹点
        };
    }
    
    /**
     * 从对象池获取子弹
     */
    getBulletFromPool() {
        let bullet = this.bulletPool.pop();
        if (!bullet) {
            bullet = this.createBulletObject();
        }
        bullet.active = true;
        bullet.lifetime = 0;
        bullet.penetrated = 0;
        bullet.trail = [];
        // 对象池复用时清掉宠物/追踪元数据，防止主机子弹被识别为宠物子弹。
        bullet.petId = null;
        bullet.gearId = null;
        bullet.chainJumps = 0;
        bullet.isTracking = false;
        bullet.target = null;
        bullet.trackingSpeed = 0;
        return bullet;
    }
    
    /**
     * 回收子弹到对象池
     */
    returnBulletToPool(bullet) {
        bullet.active = false;
        bullet.target = null;
        if (this.bulletPool.length < this.maxPoolSize) {
            this.bulletPool.push(bullet);
        }
    }
    
    /**
     * 添加玩家子弹
     */
    addPlayerBullet(bulletData) {
        const bullet = this.getBulletFromPool();
        Object.assign(bullet, bulletData);
        this.bullets.push(bullet);
        return bullet;
    }
    
    /**
     * 添加敌人子弹
     */
    addEnemyBullet(bulletData) {
        const bullet = this.getBulletFromPool();
        Object.assign(bullet, bulletData);
        this.enemyBullets.push(bullet);
        return bullet;
    }
    
    /**
     * 批量添加子弹
     */
    addBullets(bulletsData, isEnemy = false) {
        const targetArray = isEnemy ? this.enemyBullets : this.bullets;
        bulletsData.forEach(data => {
            const bullet = this.getBulletFromPool();
            Object.assign(bullet, data);
            targetArray.push(bullet);
        });
    }
    
    /**
     * 更新所有子弹
     */
    update(dt, enemies = []) {
        // 更新玩家子弹
        this.updateBulletArray(this.bullets, dt, enemies);
        
        // 更新敌人子弹
        this.updateBulletArray(this.enemyBullets, dt);
    }
    
    /**
     * 更新子弹数组
     */
    updateBulletArray(bullets, dt, targets = null) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            
            if (!bullet.active) {
                this.returnBulletToPool(bullet);
                bullets.splice(i, 1);
                continue;
            }
            
            // 更新生命周期
            bullet.lifetime += dt * 1000;
            if (bullet.lifetime > bullet.maxLifetime) {
                bullet.active = false;
                continue;
            }
            
            // 追踪导弹逻辑
            if (bullet.isTracking && targets && targets.length > 0) {
                this.updateTrackingBullet(bullet, targets, dt);
            }
            
            // 更新位置
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            
            // 加速度
            if (bullet.ax || bullet.ay) {
                bullet.vx += bullet.ax * dt;
                bullet.vy += bullet.ay * dt;
            }
            
            // 更新轨迹
            if (bullet.type === 'laser' || bullet.type === 'missile') {
                bullet.trail.push({ x: bullet.x, y: bullet.y });
                if (bullet.trail.length > 10) {
                    bullet.trail.shift();
                }
            }
            
            // 边界检测
            if (this.isOutOfBounds(bullet)) {
                bullet.active = false;
            }
        }
    }
    
    /**
     * 更新追踪导弹
     */
    updateTrackingBullet(bullet, targets, dt) {
        // 寻找最近的目标
        if (!bullet.target || !bullet.target.active) {
            let minDist = Infinity;
            let nearestTarget = null;
            
            for (const target of targets) {
                if (!target.active || target.isDead) continue;
                
                const dx = target.x - bullet.x;
                const dy = target.y - bullet.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < minDist) {
                    minDist = dist;
                    nearestTarget = target;
                }
            }
            
            bullet.target = nearestTarget;
        }
        
        // 追踪目标
        if (bullet.target) {
            const dx = bullet.target.x - bullet.x;
            const dy = bullet.target.y - bullet.y;
            const targetAngle = Math.atan2(dy, dx);
            const currentAngle = Math.atan2(bullet.vy, bullet.vx);
            
            // 平滑转向
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            const turnAmount = Math.min(Math.abs(angleDiff), bullet.trackingSpeed * dt);
            const turnDirection = Math.sign(angleDiff);
            
            const newAngle = currentAngle + turnAmount * turnDirection;
            const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
            
            bullet.vx = Math.cos(newAngle) * speed;
            bullet.vy = Math.sin(newAngle) * speed;
        }
    }
    
    /**
     * 检查子弹是否出界
     */
    isOutOfBounds(bullet) {
        const margin = 100;
        return bullet.x < -margin || 
               bullet.x > GameConfig.CANVAS.WIDTH + margin ||
               bullet.y < -margin || 
               bullet.y > GameConfig.CANVAS.HEIGHT + margin;
    }
    
    /**
     * 检查碰撞
     * @param {Object} bullet - 子弹对象
     * @param {Object} target - 目标对象
     * @returns {boolean} 是否碰撞
     */
    checkCollision(bullet, target) {
        if (!bullet.active || !target.active) return false;
        
        // 激光束特殊碰撞检测
        if (bullet.isBeam) {
            return this.checkBeamCollision(bullet, target);
        }
        
        // 圆形碰撞检测
        const dx = bullet.x - target.x;
        const dy = bullet.y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const collisionDistance = bullet.size + (target.hitboxRadius || target.size || 20);
        
        return distance < collisionDistance;
    }
    
    /**
     * 激光束碰撞检测
     */
    checkBeamCollision(beam, target) {
        // 简化的矩形碰撞检测
        const beamLeft = beam.x - beam.width / 2;
        const beamRight = beam.x + beam.width / 2;
        const beamTop = beam.y - beam.height;
        const beamBottom = beam.y;
        
        const targetSize = target.hitboxRadius || target.size || 20;
        const targetLeft = target.x - targetSize;
        const targetRight = target.x + targetSize;
        const targetTop = target.y - targetSize;
        const targetBottom = target.y + targetSize;
        
        return !(beamLeft > targetRight || 
                beamRight < targetLeft || 
                beamTop > targetBottom || 
                beamBottom < targetTop);
    }
    
    /**
     * 处理子弹命中
     */
    handleBulletHit(bullet, target) {
        // 造成伤害
        if (target.takeDamage) {
            target.takeDamage(bullet.damage);
        } else if (target.health !== undefined) {
            target.health -= bullet.damage;
        }
        
        // 处理穿透
        if (bullet.penetration > bullet.penetrated) {
            bullet.penetrated++;
            bullet.damage *= 0.8; // 穿透后伤害递减
        } else {
            bullet.active = false;
        }
        
        // 爆炸效果
        if (bullet.explosionRadius > 0) {
            this.createExplosion(bullet.x, bullet.y, bullet.explosionRadius, bullet.damage * 0.5);
        }
        
        return true;
    }
    
    /**
     * 创建爆炸（范围伤害）
     */
    createExplosion(x, y, radius, damage) {
        // 这里应该通知效果系统创建爆炸特效
        // 并对范围内的目标造成伤害
        return {
            x: x,
            y: y,
            radius: radius,
            damage: damage,
            type: 'explosion'
        };
    }
    
    /**
     * 渲染所有子弹
     */
    render(renderer, assetManager = null) {
        // 如果有资源管理器，使用新的渲染方法
        if (assetManager && assetManager.loaded) {
            // 让Game.js处理渲染
            return;
        }
        
        // 渲染敌人子弹（底层）
        this.renderBulletArray(this.enemyBullets, renderer);
        
        // 渲染玩家子弹（上层）
        this.renderBulletArray(this.bullets, renderer);
    }
    
    /**
     * 渲染子弹数组
     */
    renderBulletArray(bullets, renderer) {
        bullets.forEach(bullet => {
            if (!bullet.active) return;
            
            // 渲染轨迹
            if (bullet.trail && bullet.trail.length > 1) {
                renderer.ctx.strokeStyle = bullet.color;
                renderer.ctx.globalAlpha = 0.3;
                renderer.ctx.beginPath();
                renderer.ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
                for (let i = 1; i < bullet.trail.length; i++) {
                    renderer.ctx.lineTo(bullet.trail[i].x, bullet.trail[i].y);
                }
                renderer.ctx.stroke();
                renderer.ctx.globalAlpha = 1;
            }
            
            // 渲染子弹本体
            if (bullet.isBeam) {
                // 渲染激光束
                renderer.ctx.fillStyle = bullet.color;
                renderer.ctx.fillRect(
                    bullet.x - bullet.width / 2,
                    bullet.y - bullet.height,
                    bullet.width,
                    bullet.height
                );
            } else if (bullet.type === 'missile') {
                // 渲染导弹
                renderer.ctx.save();
                renderer.ctx.translate(bullet.x, bullet.y);
                renderer.ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
                renderer.ctx.fillStyle = bullet.color;
                renderer.ctx.fillRect(-bullet.size / 2, -bullet.size * 2, bullet.size, bullet.size * 3);
                renderer.ctx.restore();
            } else {
                // 渲染普通子弹
                renderer.drawCircle(bullet.x, bullet.y, bullet.size, bullet.color);
            }
        });
    }
    
    /**
     * 清空所有敌人子弹（炸弹效果）
     */
    clearEnemyBullets() {
        this.enemyBullets.forEach(bullet => {
            bullet.active = false;
            this.returnBulletToPool(bullet);
        });
        this.enemyBullets = [];
    }
    
    /**
     * 清空所有子弹
     */
    clear() {
        this.bullets.forEach(bullet => this.returnBulletToPool(bullet));
        this.enemyBullets.forEach(bullet => this.returnBulletToPool(bullet));
        this.bullets = [];
        this.enemyBullets = [];
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            playerBullets: this.bullets.length,
            enemyBullets: this.enemyBullets.length,
            poolSize: this.bulletPool.length,
            totalBullets: this.bullets.length + this.enemyBullets.length
        };
    }
}