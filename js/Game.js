/**
 * 游戏主类
 * 管理整个游戏的运行
 */
class Game {
    constructor() {
        this.canvas = null;
        this.renderer = null;
        this.gameLoop = null;
        this.stateMachine = null;
        this.inputManager = null;
        this.player = null;
        this.assetManager = null;
        
        // 战斗系统
        this.bulletSystem = null;
        this.collisionSystem = null;
        this.particleSystem = null;
        this.enemies = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = 2; // 秒
        this.waveNumber = 0;
        
        // 关卡系统 (Phase 3)
        this.levelManager = null;
        this.waveManager = null;
        this.bossManager = null;
        this.powerUpManager = null;
        this.currentBoss = null;
        this.aircraftManager = null;
        this.equipmentManager = null;
        this.petManager = null;
        this.nextLevelIndex = 0;
        this.levelResult = null;
        
        // 游戏状态
        this.isInitialized = false;
        this.isRunning = false;
        
        // 性能监控
        this.debugMode = false;
    }

    /**
     * 初始化游戏
     */
    init() {
        console.log('游戏初始化开始...');
        
        // 获取画布
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('找不到游戏画布');
            return false;
        }
        
        // 初始化音频系统
        if (window.audioManager) {
            window.audioManager.init().then(() => {
                console.log('音频系统初始化完成');
                // 播放主菜单音乐
                window.audioManager.playMusic('menu');
            }).catch(error => {
                console.warn('音频系统初始化失败:', error);
            });
        }
        
        // 初始化各个系统
        this.renderer = new Renderer(this.canvas);
        this.gameLoop = new GameLoop();
        this.stateMachine = new StateMachine();
        this.inputManager = new InputManager();
        this.player = new Player();
        this.assetManager = new AssetManager();
        this.aircraftManager = new AircraftManager(this);
        this.equipmentManager = new EquipmentManager(this);
        this.player.beforeDamageHook = (damage) => this.equipmentManager.onBeforeDamage(damage);
        this.petManager = new PetManager(this);
        
        // 初始化战斗系统
        this.bulletSystem = new BulletSystem();
        this.collisionSystem = new CollisionSystem();
        this.particleSystem = new ParticleSystem();
        
        // 初始化关卡系统 (Phase 3)
        this.levelManager = new LevelManager();
        this.waveManager = new WaveManager();
        this.bossManager = new BossManager(this);
        this.powerUpManager = new PowerUpManager();
        
        // 初始化关卡系统连接
        this.levelManager.init(this.waveManager, this.bossManager);
        this.levelManager.onLevelFinished = (level, stats) => {
            this.levelResult = { name: level.name, score: stats.score };
            this.nextLevelIndex = (this.levelManager.currentLevelIndex + 1) % this.levelManager.levels.length;
            this.stateMachine.changeState(GameConfig.STATES.LEVEL_COMPLETE);
        };
        this.waveManager.init(
            (enemyData) => this.spawnEnemy(enemyData),
            () => console.log('波次完成')
        );
        this.bossManager.init(
            (boss) => this.spawnBoss(boss),
            () => {
                this.currentBoss = null;
                this.levelManager.onBossDefeated();
            }
        );
        this.powerUpManager.init();
        
        // 初始化玩家武器
        this.player.weaponManager = new WeaponManager(this.player);
        this.player.weaponManager.addWeapon('laser', new LaserCannon(1));
        this.player.weaponManager.addWeapon('missile', new MissileLauncher(1));
        
        // 用战机配置替代原来的 fighter/bomber/interceptor 硬编码属性。
        this.aircraftManager.applyAircraft();
        
        // 异步加载资源
        this.assetManager.init().then(() => {
            console.log('游戏资源加载完成');
        }).catch(error => {
            console.error('资源加载失败:', error);
        });
        
        // 设置游戏循环回调
        this.gameLoop.init(
            (dt) => this.update(dt),
            (dt, interpolation) => this.render(dt, interpolation)
        );
        
        // 修改状态机的游戏状态处理
        this.overrideStateBehaviors();
        
        // 初始状态为菜单
        this.stateMachine.changeState(GameConfig.STATES.MENU);
        
        this.isInitialized = true;
        console.log('游戏初始化完成');
        
        return true;
    }

    /**
     * 覆盖状态机行为
     */
    overrideStateBehaviors() {
        // 覆盖游戏进行中状态的更新和渲染
        const playingState = this.stateMachine.states.get(GameConfig.STATES.PLAYING);
        if (playingState) {
            playingState.update = (dt) => {
                // 更新关卡系统
                if (this.levelManager && this.levelManager.currentLevel) {
                    this.levelManager.update(dt);
                } else {
                    // 使用旧的生成系统作为后备
                    this.spawnEnemies(dt);
                }
                
                this.aircraftManager.update(dt);
                // 更新玩家并获取发射的子弹
                const newBullets = this.player.update(dt, this.inputManager);
                
                // 添加新子弹到子弹系统
                if (newBullets && newBullets.length > 0) {
                    this.bulletSystem.addBullets(newBullets, false);
                }
                
                // 炸弹输入已经在 index.html 中处理
                
                // 更新敌人
                this.updateEnemies(dt);
                
                // 统一由BossManager驱动Boss攻击、死亡特效和通关回调
                this.bossManager.update(dt, this.player, this.bulletSystem, this.particleSystem);
                // 两只出战宠物进行自动射击与周期性辅助
                this.petManager.update(dt);
                // 独立装备自动技与特效（使用秒制冷却）
                this.equipmentManager.update(dt);
                
                // 更新子弹系统
                this.bulletSystem.update(dt, this.currentBoss && this.currentBoss.active
                    ? [...this.enemies, this.currentBoss] : this.enemies);
                
                // 更新道具系统
                this.powerUpManager.update(dt, this.player);
                
                // 碰撞检测
                const collisionData = {
                    player: this.player,
                    enemies: this.enemies,
                    bulletSystem: this.bulletSystem,
                    powerups: this.powerUpManager.powerUps,
                    bossManager: this.bossManager,
                    petManager: this.petManager
                };
                
                // 添加Boss到碰撞检测
                if (this.currentBoss && this.currentBoss.active) {
                    collisionData.boss = this.currentBoss;
                }
                
                this.collisionSystem.processCollisions(collisionData);
                
                // 更新粒子系统
                this.particleSystem.update(dt);
                
                // 添加推进器火焰效果（限制频率）
                if (this.player.isMoving && !this.player.isDead) {
                    // 每隔几帧创建一次，避免性能问题
                    if (this.gameLoop.frameCount % 3 === 0) {
                        this.particleSystem.createThrusterFlame(
                            this.player.x,
                            this.player.y + this.player.height / 2
                        );
                    }
                }
            };
            
            playingState.enter = () => {
                // 暂停恢复不应重置玩家、子弹、Boss和关卡
                if (this.stateMachine.previousState === this.stateMachine.states.get(GameConfig.STATES.PAUSED)) return;
                console.log('进入游戏状态');
                // 重置玩家位置和状态
                this.player.reset();
                this.aircraftManager.prepareForBattle();
                this.petManager.resetBattle();
                this.equipmentManager.resetBattle();
                // 清空战斗系统
                this.enemies = [];
                this.bulletSystem.clear();
                this.particleSystem.clear();
                this.powerUpManager.clearAll();
                this.waveNumber = 0;
                this.enemySpawnTimer = 0;
                this.currentBoss = null;
                this.levelResult = null;
                this.bossManager.currentBoss = null;
                this.bossManager.defeatSequenceActive = false;
                this.bossManager.inBossBattle = false;
                this.bossManager.clearBossQueue();
                
                // 加载所选关卡
                if (this.levelManager) {
                    this.levelManager.loadLevel(this.nextLevelIndex);
                }
                
                // 播放战斗音乐
                if (window.audioManager) {
                    window.audioManager.crossfadeMusic('level1', 1000);
                }
            };
            
            playingState.render = (renderer) => {
                // 清屏并绘制背景
                renderer.clear();
                renderer.drawBackground(this.gameLoop.getDeltaTime());
                
                // 绘制游戏提示（开始时显示）
                if (this.gameLoop.frameCount < 180) { // 前3秒显示提示
                    renderer.drawText('游戏开始！', 320, 200, 32, '#00FF00');
                    renderer.drawText('使用方向键或WASD移动', 320, 240, 20, '#FFFFFF');
                    renderer.drawText('Q 战机技能 / E 装备技能', 320, 270, 20, '#FFFFFF');
                }
                
                // 显示切换战机消息
                if (this.messageTimer && this.messageTimer > 0) {
                    renderer.drawText(this.showMessage || '', 320, 100, 28, '#FFD700');
                    this.messageTimer--;
                }
                
                // 绘制粒子效果（底层）
                this.particleSystem.render(renderer);
                
                // 绘制敌人（使用SVG资源）
                this.enemies.forEach(enemy => {
                    if (this.assetManager && this.assetManager.loaded) {
                        renderer.drawEnemy(enemy, this.assetManager);
                    } else {
                        enemy.render(renderer);
                    }
                });
                
                // 绘制子弹（使用SVG资源）
                if (this.assetManager && this.assetManager.loaded) {
                    // 绘制玩家子弹
                    this.bulletSystem.bullets.forEach(bullet => {
                        renderer.drawBullet(bullet, this.assetManager);
                    });
                    // 绘制敌人子弹
                    this.bulletSystem.enemyBullets.forEach(bullet => {
                        renderer.drawBullet(bullet, this.assetManager);
                    });
                } else {
                    this.bulletSystem.render(renderer);
                }
                
                // 旧的子弹系统已废弃，不再渲染
                
                // 绘制道具
                if (this.powerUpManager) {
                    this.powerUpManager.render(renderer);
                }
                
                // 绘制Boss
                if (this.currentBoss) {
                    // 已经拥有Boss状态信息，无需每帧输出日志
                    if (this.currentBoss.active) {
                        this.currentBoss.render(renderer, this.assetManager);
                        // 绘制Boss血条
                        if (this.bossManager) {
                            // 获取Boss状态并传递给UI渲染
                            const bossStatus = this.currentBoss.getStatus ? this.currentBoss.getStatus() : {
                                name: this.currentBoss.name || 'Boss',
                                currentPhase: this.currentBoss.currentPhase || 0,
                                totalPhases: this.currentBoss.phases ? this.currentBoss.phases.length : 3,
                                accuracy: 0,
                                battleTime: Date.now() - (this.bossManager.battleStartTime || Date.now())
                            };
                            this.bossManager.renderBossUI(renderer, bossStatus);
                        }
                    }
                } else {
                    // 无Boss时无需调试输出
                }
                
                // 绘制玩家（使用SVG资源）
                if (!this.player.isDead) {
                    // 无敌时闪烁效果
                    if (!this.player.isInvincible || Math.floor(Date.now() / 100) % 2 === 0) {
                        renderer.drawPlayer(this.player, this.assetManager);
                    }
                }
                
                // 绘制跟随战机的两只宠物（原创简易图标）
                this.petManager.render(renderer);
                this.equipmentManager.render(renderer);
                // 绘制HUD
                renderer.drawHUD({
                    health: this.player.health,
                    maxHealth: this.player.maxHealth,
                    energy: this.player.energy,
                    maxEnergy: this.player.maxEnergy,
                    score: this.player.score,
                    lives: this.player.lives,
                    bombs: this.player.bombs,
                    maxBombs: this.player.maxBombs,
                    bombCooldown: this.player.bombCooldown,
                    bombCooldownTime: this.player.bombCooldownTime,
                    fps: this.gameLoop.getFPS()
                });
                renderer.drawText(this.aircraftManager.selected.name, 320, 124, 16, this.aircraftManager.selected.color);
                const skill = this.aircraftManager.getSkillStatus();
                renderer.drawText(skill.name + (skill.ready ? ' [Q 可用]' : ' ' + skill.remaining.toFixed(1) + 's'),
                    320, 151, 15, skill.ready ? '#DBFFAE' : '#9DAECC');
                
                // 绘制关卡信息
                if (this.levelManager && this.levelManager.getCurrentLevelInfo()) {
                    const levelInfo = this.levelManager.getCurrentLevelInfo();
                    renderer.drawText(
                        `${levelInfo.name} - 波次 ${levelInfo.wave}/${levelInfo.totalWaves}`,
                        320, 50, 16, '#FFFFFF'
                    );
                }
                
                // 游戏结束检查
                if (this.player.isDead && this.player.lives <= 0) {
                    this.stateMachine.changeState(GameConfig.STATES.GAME_OVER);
                }
            };
        }
        
        // 通关结算状态，支持继续下一关或重新体验
        this.stateMachine.registerState(GameConfig.STATES.LEVEL_COMPLETE, {
            enter: () => console.log('进入通关结算'),
            update: () => {},
            render: (renderer) => {
                renderer.clear();
                renderer.drawBackground(0);
                renderer.drawText('关卡完成！', 320, 290, 48, '#FFD700');
                renderer.drawText(this.levelResult?.name || '', 320, 360, 28, '#FFFFFF');
                renderer.drawText('本关得分：' + (this.levelResult?.score || 0), 320, 420, 24, '#00FFCC');
                renderer.drawText('按 Enter 继续', 320, 520, 22, '#FFFFFF');
            },
            exit: () => {},
            handleInput: (input) => {
                if (input.isKeyPressed('Enter')) this.stateMachine.changeState(GameConfig.STATES.PLAYING);
            }
        });

        // 覆盖游戏结束状态
        const gameOverState = this.stateMachine.states.get(GameConfig.STATES.GAME_OVER);
        if (gameOverState) {
            gameOverState.enter = () => {
                console.log('游戏结束，最终得分：' + this.player.score);
                
                // 播放游戏结束音乐
                if (window.audioManager) {
                    window.audioManager.playMusic('gameover');
                }
            };
            
            gameOverState.render = (renderer) => {
                renderer.clear();
                renderer.drawText('游戏结束', 320, 300, 48, '#FF0000');
                renderer.drawText(`最终得分: ${this.player.score}`, 320, 400, 32, '#FFD700');
                renderer.drawText('按 Enter 返回菜单', 320, 500, 24, '#FFFFFF');
            };
            
            gameOverState.handleInput = (input) => {
                if (input.isKeyPressed('Enter')) {
                    this.player.reset();
                    this.stateMachine.changeState(GameConfig.STATES.MENU);
                }
            };
        }
    }

    /**
     * 启动游戏
     */
    start() {
        if (!this.isInitialized) {
            console.error('游戏未初始化');
            return;
        }
        
        if (this.isRunning) {
            console.warn('游戏已经在运行');
            return;
        }
        
        console.log('游戏启动');
        this.isRunning = true;
        this.gameLoop.start();
    }

    /**
     * 停止游戏
     */
    stop() {
        console.log('游戏停止');
        this.isRunning = false;
        this.gameLoop.stop();
    }

    /**
     * 暂停游戏
     */
    pause() {
        this.gameLoop.pause();
        this.stateMachine.changeState(GameConfig.STATES.PAUSED);
    }

    /**
     * 恢复游戏
     */
    resume() {
        this.gameLoop.resume();
        this.stateMachine.changeState(GameConfig.STATES.PLAYING);
    }

    /**
     * 更新游戏逻辑
     * @param {number} deltaTime - 时间增量
     */
    update(deltaTime) {
        // 更新输入
        this.inputManager.update(deltaTime);
        
        // 处理全局输入
        this.handleGlobalInput();
        
        // 更新状态机
        this.stateMachine.update(deltaTime);
        
        // 状态机处理输入
        this.stateMachine.handleInput(this.inputManager);
        
        // 更新调试信息
        if (this.debugMode) {
            this.updateDebugInfo();
        }
    }

    /**
     * 渲染游戏
     * @param {number} deltaTime - 时间增量
     * @param {number} interpolation - 插值因子
     */
    render(deltaTime, interpolation) {
        // 状态机渲染
        this.stateMachine.render(this.renderer);
        
        // 渲染调试信息
        if (this.debugMode) {
            const perfData = this.gameLoop.getPerformanceData();
            perfData.playerX = this.player.x;
            perfData.playerY = this.player.y;
            perfData.gameState = this.stateMachine.getCurrentStateName();
            this.renderer.drawDebugInfo(perfData);
        }
    }

    /**
     * 处理全局输入
     */
    handleGlobalInput() {
        // 游戏控制已经移到 index.html 中统一处理
        // 这里保留作为备用或用于其他内部逻辑
        
        // 可以添加其他只在游戏内部处理的输入
        // 例如：开发者调试快捷键等
    }

    /**
     * 更新调试信息
     */
    updateDebugInfo() {
        const perfData = this.gameLoop.getPerformanceData();
        perfData.playerX = this.player.x;
        perfData.playerY = this.player.y;
        perfData.playerSpeed = this.player.getSpeed();
        perfData.bullets = this.player.bullets.length + this.bulletSystem.bullets.length;
        perfData.enemyBullets = this.bulletSystem.enemyBullets.length;
        perfData.enemies = this.enemies.length;
        perfData.particles = this.particleSystem.particles.length;
        perfData.gameState = this.stateMachine.getCurrentStateName();
        perfData.wave = this.waveNumber;
        perfData.score = this.player.score;
        
        // 更新HTML调试信息
        const debugDiv = document.getElementById('debugInfo');
        if (debugDiv && this.debugMode) {
            debugDiv.innerHTML = `
                FPS: ${perfData.fps}<br>
                State: ${perfData.gameState}<br>
                Wave: ${perfData.wave}<br>
                Score: ${perfData.score}<br>
                Enemies: ${perfData.enemies}<br>
                Player Bullets: ${perfData.bullets}<br>
                Enemy Bullets: ${perfData.enemyBullets}<br>
                Particles: ${perfData.particles}<br>
                Player: (${Math.round(perfData.playerX)}, ${Math.round(perfData.playerY)})<br>
                Update: ${perfData.updateTime}ms<br>
                Render: ${perfData.renderTime}ms
            `;
        }
    }

    /**
     * 获取游戏实例（用于测试）
     */
    getGameState() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            currentState: this.stateMachine.getCurrentStateName(),
            playerPosition: { x: this.player.x, y: this.player.y },
            playerHealth: this.player.health,
            playerScore: this.player.score,
            fps: this.gameLoop.getFPS()
        };
    }

    /**
     * 生成敌人
     */
    spawnEnemies(dt) {
        this.enemySpawnTimer += dt;
        
        if (this.enemySpawnTimer >= this.enemySpawnInterval) {
            this.enemySpawnTimer = 0;
            this.waveNumber++;
            
            // 根据波数调整难度
            const difficulty = Math.min(this.waveNumber / 10, 1);
            
            // 随机选择生成模式
            const formations = ['line', 'v', 'wave', 'circle'];
            const formation = formations[Math.floor(Math.random() * formations.length)];
            
            // 生成敌人编队
            const startX = GameConfig.CANVAS.WIDTH / 2;
            const startY = -50;
            const newEnemies = EnemyFactory.createFormation(formation, startX, startY);
            
            // 根据难度调整敌人属性
            newEnemies.forEach(enemy => {
                enemy.maxHealth *= (1 + difficulty * 0.5);
                enemy.health = enemy.maxHealth;
                enemy.damage *= (1 + difficulty * 0.3);
                enemy.scoreValue *= (1 + difficulty);
                
                // 随机设置行为
                const behaviors = ['linear', 'sine', 'zigzag', 'strafe'];
                enemy.behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
            });
            
            this.enemies.push(...newEnemies);
            
            // 调整生成间隔
            this.enemySpawnInterval = Math.max(1, 3 - difficulty * 1.5);
        }
    }
    
    /**
     * 更新敌人
     */
    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            if (!enemy.active) {
                // 敌人死亡时创建爆炸效果和掉落道具
                if (enemy.isDead) {
                    this.particleSystem.createExplosion(enemy.x, enemy.y);
                    this.player.addScore(enemy.scoreValue);
                    
                    // 根据敌人类型决定掉落表
                    const dropTable = enemy.isElite ? 'elite' : 'normal';
                    this.powerUpManager.spawnPowerUp(enemy.x, enemy.y, dropTable);
                    
                    // 更新关卡统计
                    if (this.levelManager) {
                        this.levelManager.levelStats.enemiesKilled++;
                    }
                }
                
                this.enemies.splice(i, 1);
                continue;
            }
            
            // 更新敌人并获取发射的子弹
            const bullets = enemy.update(dt, this.player);
            
            // 添加敌人子弹到子弹系统
            if (bullets && bullets.length > 0) {
                this.bulletSystem.addBullets(bullets, true);
            }
        }
        
        // 碰撞统一在CollisionSystem处理，避免重复造成伤害
    }
    
    /**
     * 从波次管理器生成敌人
     * @param {Object} enemyData - 敌人数据
     */
    spawnEnemy(enemyData) {
        const enemy = EnemyFactory.createEnemy(
            enemyData.type,
            enemyData.x,
            enemyData.y,
            enemyData
        );
        
        if (enemy) {
            // 应用额外属性
            if (enemyData.vx) enemy.vx = enemyData.vx;
            if (enemyData.vy) enemy.vy = enemyData.vy;
            if (enemyData.behavior) enemy.behavior = enemyData.behavior;
            if (enemyData.health) enemy.maxHealth = enemy.health = enemyData.health;
            if (enemyData.damage) enemy.damage = enemyData.damage;
            if (enemyData.score) enemy.scoreValue = enemyData.score;
            
            this.enemies.push(enemy);
        }
    }
    
    /**
     * 生成Boss
     * @param {Object} boss - Boss实例
     */
    spawnBoss(boss) {
        console.log(`Boss出现: ${boss.name || boss.type}`);
        
        // 清除所有普通敌机
        this.enemies = [];
        
        // 设置当前Boss
        this.currentBoss = boss;
        
        if (this.currentBoss) {
            // Boss入场动画
            this.currentBoss.startEntranceAnimation();
        }
        
        // 播放Boss战音乐
        if (window.audioManager) {
            window.audioManager.crossfadeMusic('boss', 1500);
        }
    }
    
    
    /**
     * 处理子弹碰撞效果
     */
    handleBulletCollisions() {
        // 检测玩家子弹与敌人碰撞
        this.bulletSystem.bullets.forEach(bullet => {
            if (!bullet.active) return;
            
            this.enemies.forEach(enemy => {
                if (!enemy.active || enemy.isDead) return;
                
                if (this.bulletSystem.checkCollision(bullet, enemy)) {
                    const destroyed = this.bulletSystem.handleBulletHit(bullet, enemy);
                    
                    // 创建击中效果
                    this.particleSystem.createHitEffect(enemy.x, enemy.y);
                    
                    if (destroyed || enemy.health <= 0) {
                        enemy.isDead = true;
                        enemy.active = false;
                    }
                }
            });
        });
        
        // 检测敌人子弹与玩家碰撞
        if (!this.player.isInvincible && !this.player.isDead) {
            this.bulletSystem.enemyBullets.forEach(bullet => {
                if (!bullet.active) return;
                
                if (this.bulletSystem.checkCollision(bullet, this.player)) {
                    this.bulletSystem.handleBulletHit(bullet, this.player);
                    
                    // 创建击中效果
                    this.particleSystem.createSparks(this.player.x, this.player.y);
                }
            });
        }
    }
    
    /** 在大厅更换战机，禁止战斗中无成本切换属性。 */
    switchAircraft(id) {
        const changed = this.aircraftManager.select(id);
        if (changed) {
            this.showMessage = '选择战机：' + this.aircraftManager.selected.name;
            this.messageTimer = 60;
        }
        return changed;
    }

    /** 主动技能入口，供键盘 Q 和触屏按钮共用。 */
    useAircraftSkill() {
        return this.aircraftManager.useSkill();
    }

    /** 装备主武器的 E 键主动技能。 */
    useEquipmentSkill() {
        return this.equipmentManager.useEquipmentSkill();
    }
    
    /**
     * 触发炸弹
     */
    triggerBomb() {
        // 检查玩家是否可以使用炸弹
        if (!this.player.useBomb()) {
            return;
        }
        
        // 播放炸弹音效
        if (window.audioManager) {
            window.audioManager.playSound('powerup');
        }
        
        // 获取爆炸范围
        const explosion = this.player.getBombExplosionArea();
        
        // 创建视觉效果
        this.createBombEffect(explosion);
        
        // 清除所有敌人子弹
        this.bulletSystem.clearEnemyBullets();
        
        // 对所有敌人造成伤害
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const dx = enemy.x - explosion.x;
            const dy = enemy.y - explosion.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 在爆炸范围内的敌人
            if (distance <= explosion.radius) {
                // 计算伤害（距离越近伤害越高）
                const damageRatio = 1 - (distance / explosion.radius);
                const damage = explosion.damage * damageRatio;
                
                // 对敌人造成伤害
                if (enemy.takeDamage) {
                    enemy.takeDamage(damage);
                } else {
                    enemy.health -= damage;
                    if (enemy.health <= 0) {
                        enemy.active = false;
                        enemy.isDead = true;
                    }
                }
                
                // 击退效果
                if (explosion.force > 0 && distance > 0) {
                    const forceX = (dx / distance) * explosion.force * damageRatio;
                    const forceY = (dy / distance) * explosion.force * damageRatio;
                    enemy.vx = (enemy.vx || 0) + forceX;
                    enemy.vy = (enemy.vy || 0) + forceY;
                }
            }
        }
        
        // 清除所有敌方子弹
        if (this.bulletSystem) {
            this.bulletSystem.clearEnemyBullets();
        }
        
        // 对Boss造成伤害
        if (this.currentBoss && this.currentBoss.active) {
            const dx = this.currentBoss.x - explosion.x;
            const dy = this.currentBoss.y - explosion.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= explosion.radius) {
                const damageRatio = 0.5; // Boss只受50%伤害
                const damage = explosion.damage * damageRatio;
                this.currentBoss.takeDamage(damage);
            }
        }
    }
    
    /**
     * 创建炸弹视觉效果
     * @param {Object} explosion - 爆炸参数
     */
    createBombEffect(explosion) {
        // 创建多层次爆炸效果
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                // 创建爆炸圈
                const radius = explosion.radius * (0.5 + i * 0.3);
                this.particleSystem.createBombExplosion(
                    explosion.x, 
                    explosion.y, 
                    radius,
                    i === 0 ? '#FFFFFF' : i === 1 ? '#FFFF00' : '#FF6600'
                );
            }, i * 100);
        }
        
        // 屏幕震动效果（如果实现了）
        if (this.renderer && this.renderer.shakeScreen) {
            this.renderer.shakeScreen(0.5, 10);
        }
    }
    
    /**
     * 模拟输入（用于测试）
     */
    simulateInput(keyCode, type = 'press') {
        if (type === 'press') {
            this.inputManager.handleKeyDown({ code: keyCode, preventDefault: () => {} });
        } else if (type === 'release') {
            this.inputManager.handleKeyUp({ code: keyCode });
        }
    }
}