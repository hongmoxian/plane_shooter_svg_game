/**
 * 碰撞检测系统
 * 处理游戏中所有的碰撞检测和响应
 */
class CollisionSystem {
    constructor() {
        // 空间分区优化
        this.gridSize = 100;
        this.grid = new Map();
        
        // 碰撞统计
        this.stats = {
            checks: 0,
            collisions: 0,
            frameTime: 0
        };
        
        // 碰撞层级
        this.layers = {
            PLAYER: 1,
            ENEMY: 2,
            PLAYER_BULLET: 4,
            ENEMY_BULLET: 8,
            POWERUP: 16,
            OBSTACLE: 32
        };
    }
    
    /**
     * 重置统计
     */
    resetStats() {
        this.stats.checks = 0;
        this.stats.collisions = 0;
    }
    
    /**
     * 获取对象的网格键
     */
    getGridKey(x, y) {
        const gridX = Math.floor(x / this.gridSize);
        const gridY = Math.floor(y / this.gridSize);
        return `${gridX},${gridY}`;
    }
    
    /**
     * 获取对象周围的网格键
     */
    getNearbyGridKeys(x, y, radius) {
        const keys = [];
        const gridRadius = Math.ceil(radius / this.gridSize);
        
        for (let dx = -gridRadius; dx <= gridRadius; dx++) {
            for (let dy = -gridRadius; dy <= gridRadius; dy++) {
                const gridX = Math.floor(x / this.gridSize) + dx;
                const gridY = Math.floor(y / this.gridSize) + dy;
                keys.push(`${gridX},${gridY}`);
            }
        }
        
        return keys;
    }
    
    /**
     * 构建空间网格
     */
    buildGrid(objects) {
        this.grid.clear();
        
        objects.forEach(obj => {
            if (!obj.active) return;
            
            const keys = this.getNearbyGridKeys(
                obj.x, 
                obj.y, 
                obj.hitboxRadius || obj.size || 20
            );
            
            keys.forEach(key => {
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push(obj);
            });
        });
    }
    
    /**
     * 获取对象附近的潜在碰撞对象
     */
    getNearbyObjects(obj) {
        const nearbyObjects = new Set();
        const keys = this.getNearbyGridKeys(
            obj.x,
            obj.y,
            obj.hitboxRadius || obj.size || 20
        );
        
        keys.forEach(key => {
            const objects = this.grid.get(key);
            if (objects) {
                objects.forEach(other => {
                    if (other !== obj && other.active) {
                        nearbyObjects.add(other);
                    }
                });
            }
        });
        
        return Array.from(nearbyObjects);
    }
    
    /**
     * 圆形碰撞检测
     */
    checkCircleCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const radius1 = obj1.hitboxRadius || obj1.size || 16;
        const radius2 = obj2.hitboxRadius || obj2.size || 16;
        
        this.stats.checks++;
        
        return distance < radius1 + radius2;
    }
    
    /**
     * 矩形碰撞检测
     */
    checkRectCollision(obj1, obj2) {
        const rect1 = this.getRect(obj1);
        const rect2 = this.getRect(obj2);
        
        this.stats.checks++;
        
        return !(rect1.right < rect2.left || 
                rect1.left > rect2.right || 
                rect1.bottom < rect2.top || 
                rect1.top > rect2.bottom);
    }
    
    /**
     * 获取对象的矩形边界
     */
    getRect(obj) {
        const width = obj.width || (obj.hitboxRadius || obj.size || 16) * 2;
        const height = obj.height || (obj.hitboxRadius || obj.size || 16) * 2;
        
        return {
            left: obj.x - width / 2,
            right: obj.x + width / 2,
            top: obj.y - height / 2,
            bottom: obj.y + height / 2
        };
    }
    
    /**
     * 像素级精确碰撞检测（可选）
     */
    checkPixelCollision(obj1, obj2) {
        // 首先进行粗略的矩形检测
        if (!this.checkRectCollision(obj1, obj2)) {
            return false;
        }
        
        // 这里可以实现基于像素的精确检测
        // 需要访问对象的像素数据
        return true;
    }
    
    /**
     * 处理所有碰撞
     */
    processCollisions(gameState) {
        const startTime = performance.now();
        this.resetStats();
        
        // 构建所有活动对象的列表
        const allObjects = [];
        
        if (gameState.player && gameState.player.active && !gameState.player.isDead) {
            allObjects.push(gameState.player);
        }
        
        if (gameState.enemies) {
            allObjects.push(...gameState.enemies.filter(e => e.active));
        }
        
        if (gameState.bulletSystem) {
            allObjects.push(...gameState.bulletSystem.bullets);
            allObjects.push(...gameState.bulletSystem.enemyBullets);
        }
        
        if (gameState.powerups) {
            allObjects.push(...gameState.powerups.filter(p => p.active));
        }
        
        // 构建空间网格
        this.buildGrid(allObjects);
        
        // 玩家与敌机碰撞
        if (gameState.player && !gameState.player.isInvincible) {
            this.checkPlayerEnemyCollisions(gameState.player, gameState.enemies || []);
        }
        
        // 玩家与敌人子弹碰撞
        if (gameState.player && gameState.bulletSystem) {
            this.checkPlayerBulletCollisions(gameState.player, gameState.bulletSystem.enemyBullets);
        }
        
        // 玩家子弹与敌机碰撞
        if (gameState.bulletSystem && gameState.enemies) {
            this.checkBulletEnemyCollisions(gameState.bulletSystem.bullets, gameState.enemies);
        }
        
        // 玩家子弹与Boss碰撞（Boss不属于普通敌机列表）
        if (gameState.boss && gameState.bulletSystem) {
            this.checkBulletBossCollisions(gameState.bulletSystem.bullets, gameState.boss, gameState.bossManager);
        }

        // 玩家与道具碰撞
        if (gameState.player && gameState.powerups) {
            this.checkPlayerPowerupCollisions(gameState.player, gameState.powerups);
        }
        
        this.stats.frameTime = performance.now() - startTime;
        
        return this.stats.collisions;
    }
    
    /**
     * 检测玩家与敌机碰撞
     */
    checkPlayerEnemyCollisions(player, enemies) {
        enemies.forEach(enemy => {
            if (!enemy.active || enemy.isDead) return;
            
            if (this.checkCircleCollision(player, enemy)) {
                this.handlePlayerEnemyCollision(player, enemy);
                this.stats.collisions++;
            }
        });
    }
    
    /**
     * 检测玩家与敌人子弹碰撞
     */
    checkPlayerBulletCollisions(player, enemyBullets) {
        enemyBullets.forEach(bullet => {
            if (!bullet.active) return;
            
            if (this.checkCircleCollision(player, bullet)) {
                this.handlePlayerBulletCollision(player, bullet);
                this.stats.collisions++;
            }
        });
    }
    
    /**
     * 检测玩家子弹与敌机碰撞
     */
    checkBulletEnemyCollisions(playerBullets, enemies) {
        playerBullets.forEach(bullet => {
            if (!bullet.active) return;
            
            // 直接遍历敌人数组，而不是使用空间分区的所有对象
            for (const enemy of enemies) {
                if (!enemy || !enemy.active || enemy.isDead) continue;
                
                if (this.checkCircleCollision(bullet, enemy)) {
                    this.handleBulletEnemyCollision(bullet, enemy);
                    this.stats.collisions++;
                    
                    // 如果子弹没有穿透能力，停止检测
                    if (!bullet.active) break;
                }
            }
        });
    }
    
    /**
     * 玩家子弹对Boss造成伤害，交由BossManager进行统计与死亡结算。
     */
    checkBulletBossCollisions(playerBullets, boss, bossManager = null) {
        if (!boss.active || boss.isDead || boss.invulnerable) return;
        for (const bullet of playerBullets) {
            if (!bullet.active || !boss.active) continue;
            const radius = (bullet.size || 3);
            const collides = bullet.isBeam
                ? !(bullet.x - (bullet.width || radius * 2) / 2 > boss.x + boss.width / 2 ||
                    bullet.x + (bullet.width || radius * 2) / 2 < boss.x - boss.width / 2 ||
                    bullet.y - (bullet.height || radius * 2) > boss.y + boss.height / 2 ||
                    bullet.y < boss.y - boss.height / 2)
                : this.checkCircleCollision(bullet, boss);
            if (!collides) continue;
            const point = { x: bullet.x, y: bullet.y };
            if (bossManager) bossManager.onBossDamage(bullet.damage, point);
            else boss.takeDamage(bullet.damage, point);
            this.stats.collisions++;
            bullet.active = false;
        }
    }

    /**
     * 检测玩家与道具碰撞
     */
    checkPlayerPowerupCollisions(player, powerups) {
        powerups.forEach(powerup => {
            if (!powerup.active) return;
            
            if (this.checkCircleCollision(player, powerup)) {
                this.handlePlayerPowerupCollision(player, powerup);
                this.stats.collisions++;
            }
        });
    }
    
    /**
     * 处理玩家与敌机碰撞
     */
    handlePlayerEnemyCollision(player, enemy) {
        // 玩家受到伤害
        if (player.takeDamage) {
            player.takeDamage(enemy.damage || 20);
        }
        
        // 敌机也受到伤害（碰撞伤害）
        if (enemy.takeDamage) {
            enemy.takeDamage(50);
        }
    }
    
    /**
     * 处理玩家与敌人子弹碰撞
     */
    handlePlayerBulletCollision(player, bullet) {
        // 玩家受到伤害
        if (player.takeDamage) {
            player.takeDamage(bullet.damage);
        }
        
        // 子弹消失
        bullet.active = false;
    }
    
    /**
     * 处理玩家子弹与敌机碰撞
     */
    handleBulletEnemyCollision(bullet, enemy) {
        // 敌机受到伤害
        const destroyed = enemy.takeDamage(bullet.damage);
        
        // 处理穿透
        if (bullet.penetration > 0 && bullet.penetrated !== undefined) {
            bullet.penetrated++;
            if (bullet.penetrated > bullet.penetration) {
                bullet.active = false;
            } else {
                // 穿透后伤害递减
                bullet.damage *= 0.8;
            }
        } else {
            bullet.active = false;
        }
        
        // 返回击杀信息
        if (destroyed) {
            return enemy.die();
        }
        
        return null;
    }
    
    /**
     * 处理玩家与道具碰撞
     */
    handlePlayerPowerupCollision(player, powerup) {
        // 应用道具效果
        if (powerup.apply) {
            powerup.apply(player);
        }
        
        // 道具消失
        powerup.active = false;
    }
    
    /**
     * 预测碰撞（用于AI避让）
     */
    predictCollision(obj, dx, dy, timeStep) {
        const futurePos = {
            x: obj.x + dx * timeStep,
            y: obj.y + dy * timeStep,
            hitboxRadius: obj.hitboxRadius || obj.size || 16
        };
        
        const nearbyObjects = this.getNearbyObjects(futurePos);
        
        for (const other of nearbyObjects) {
            if (other === obj) continue;
            
            if (this.checkCircleCollision(futurePos, other)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 获取碰撞系统统计
     */
    getStats() {
        return {
            checks: this.stats.checks,
            collisions: this.stats.collisions,
            frameTime: this.stats.frameTime.toFixed(2),
            gridCells: this.grid.size
        };
    }
    
    /**
     * 调试渲染
     */
    debugRender(renderer) {
        // 渲染网格
        renderer.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
        renderer.ctx.lineWidth = 1;
        
        for (let x = 0; x < GameConfig.CANVAS.WIDTH; x += this.gridSize) {
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(x, 0);
            renderer.ctx.lineTo(x, GameConfig.CANVAS.HEIGHT);
            renderer.ctx.stroke();
        }
        
        for (let y = 0; y < GameConfig.CANVAS.HEIGHT; y += this.gridSize) {
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(0, y);
            renderer.ctx.lineTo(GameConfig.CANVAS.WIDTH, y);
            renderer.ctx.stroke();
        }
        
        // 渲染碰撞框
        this.grid.forEach(objects => {
            objects.forEach(obj => {
                if (!obj.active) return;
                
                const radius = obj.hitboxRadius || obj.size || 16;
                
                renderer.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                renderer.ctx.beginPath();
                renderer.ctx.arc(obj.x, obj.y, radius, 0, Math.PI * 2);
                renderer.ctx.stroke();
            });
        });
    }
}