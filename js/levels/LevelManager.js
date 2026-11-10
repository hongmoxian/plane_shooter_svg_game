/**
 * 关卡管理器
 * 负责管理游戏关卡的加载、进度、转场等
 */
class LevelManager {
    constructor() {
        // 关卡状态
        this.currentLevel = null;
        this.currentLevelIndex = 0;
        this.levelData = null;
        this.levelConfig = {};
        
        // 关卡进度
        this.levelTime = 0;
        this.levelPhase = 'intro'; // intro, main, boss, outro
        this.checkpoints = [];
        this.currentCheckpoint = 0;
        
        // 波次管理
        this.waveManager = null;
        this.currentWave = null;
        this.waveIndex = -1;
        
        // Boss管理
        this.bossManager = null;
        this.bossActive = false;
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.levelCompleted = false;
        this.outroElapsed = 0;
        this.onLevelFinished = null;
        
        // 难度系统
        this.difficultyLevel = 1;
        this.difficultyScaler = 1.0;
        
        // 统计数据
        this.levelStats = {
            enemiesKilled: 0,
            damageDealt: 0,
            damageTaken: 0,
            powerupsCollected: 0,
            accuracy: 0,
            score: 0,
            time: 0
        };
        
        // 关卡定义
        this.levels = this.defineLevels();
    }
    
    /**
     * 定义游戏关卡
     */
    defineLevels() {
        return [
            {
                id: 'level_01',
                name: '城市上空',
                chapter: 1,
                order: 1,
                difficulty: 1,
                duration: 180,
                background: 'city_sky',
                music: 'bgm_level_01',
                scrollSpeed: 100,
                waves: [
                    {
                        startTime: 1,  // 改为1秒后开始
                        duration: 15,
                        type: 'warmup',
                        enemyTypes: ['scout'],
                        formation: 'line',
                        spawnRate: 2,
                        difficulty: 1.0
                    },
                    {
                        startTime: 16,  // 相应调整
                        duration: 30,
                        type: 'main',
                        enemyTypes: ['scout', 'fighter'],
                        formation: 'v_formation',
                        spawnRate: 3,
                        difficulty: 1.2
                    },
                    {
                        startTime: 46,  // 相应调整
                        duration: 20,
                        type: 'intense',
                        enemyTypes: ['fighter', 'interceptor'],
                        formation: 'surround',
                        spawnRate: 4,
                        difficulty: 1.5
                    }
                ],
                boss: {
                    type: 'bomber_commander',
                    health: 1000,
                    phases: 3,
                    startTime: 90
                },
                rewards: {
                    score: 10000,
                    powerups: ['weapon_upgrade'],
                    unlocks: ['level_02']
                }
            },
            {
                id: 'level_02',
                name: '海洋战线',
                chapter: 1,
                order: 2,
                difficulty: 2,
                duration: 240,
                background: 'ocean',
                music: 'bgm_level_02',
                scrollSpeed: 120,
                waves: [
                    {
                        startTime: 1,  // 快速开始
                        duration: 20,
                        type: 'warmup',
                        enemyTypes: ['scout', 'fighter'],
                        formation: 'wave',
                        spawnRate: 3,
                        difficulty: 1.2
                    },
                    {
                        startTime: 21,  // 相应调整
                        duration: 40,
                        type: 'main',
                        enemyTypes: ['fighter', 'interceptor'],
                        formation: 'mixed',
                        spawnRate: 4,
                        difficulty: 1.5
                    },
                    {
                        startTime: 61,  // 相应调整
                        duration: 30,
                        type: 'intense',
                        enemyTypes: ['interceptor', 'stealth'],
                        formation: 'pincer',
                        spawnRate: 5,
                        difficulty: 2.0
                    }
                ],
                boss: {
                    type: 'iron_battleship',
                    health: 1500,
                    phases: 4,
                    startTime: 120
                },
                rewards: {
                    score: 20000,
                    powerups: ['laser', 'shield'],
                    unlocks: ['level_03']
                }
            },
            {
                id: 'level_03',
                name: '太空要塞',
                chapter: 2,
                order: 3,
                difficulty: 3,
                duration: 300,
                background: 'space',
                music: 'bgm_level_03',
                scrollSpeed: 150,
                waves: [
                    {
                        startTime: 1,  // 快速开始
                        duration: 25,
                        type: 'warmup',
                        enemyTypes: ['fighter', 'interceptor'],
                        formation: 'spiral',
                        spawnRate: 4,
                        difficulty: 1.5
                    },
                    {
                        startTime: 26,  // 相应调整
                        duration: 50,
                        type: 'main',
                        enemyTypes: ['interceptor', 'stealth', 'commander'],
                        formation: 'complex',
                        spawnRate: 5,
                        difficulty: 2.0
                    },
                    {
                        startTime: 76,  // 相应调整
                        duration: 40,
                        type: 'intense',
                        enemyTypes: ['stealth', 'commander', 'interceptor'],
                        formation: 'chaos',
                        spawnRate: 6,
                        difficulty: 2.5
                    }
                ],
                boss: {
                    type: 'sky_fortress',
                    health: 2000,
                    phases: 5,
                    startTime: 150
                },
                rewards: {
                    score: 50000,
                    powerups: ['mega_bomb', 'super_laser'],
                    unlocks: ['endless_mode']
                }
            }
        ];
    }
    
    /**
     * 初始化
     */
    init(waveManager, bossManager) {
        this.waveManager = waveManager;
        this.bossManager = bossManager;
        console.log('关卡管理器初始化完成');
    }
    
    /**
     * 加载关卡
     */
    loadLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= this.levels.length) {
            console.log('所有关卡已完成');
            return false;
        }
        
        this.currentLevelIndex = levelIndex;
        this.currentLevel = JSON.parse(JSON.stringify(this.levels[levelIndex]));
        this.levelData = this.currentLevel;
        
        // 重置状态
        this.levelTime = 0;
        this.levelPhase = 'intro';
        this.waveIndex = -1;
        this.currentWave = null;
        this.bossActive = false;
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.levelCompleted = false;
        this.outroElapsed = 0;
        this.currentCheckpoint = 0;
        if (this.waveManager) this.waveManager.reset();
        
        // 重置统计
        this.levelStats = {
            enemiesKilled: 0,
            damageDealt: 0,
            damageTaken: 0,
            powerupsCollected: 0,
            accuracy: 0,
            score: 0,
            time: 0
        };
        
        // 应用难度调整
        this.applyDifficulty();
        
        console.log(`加载关卡: ${this.currentLevel.name}`);
        return true;
    }
    
    /**
     * 更新关卡
     */
    update(deltaTime) {
        if (!this.currentLevel || this.levelCompleted) return;
        
        this.levelTime += deltaTime;
        if (this.levelPhase === 'outro') this.outroElapsed += deltaTime;
        this.levelStats.time = this.levelTime;
        
        // 更新关卡阶段
        this.updateLevelPhase();
        
        // 更新波次
        if (this.levelPhase === 'main' && !this.bossActive) {
            this.updateWaves(deltaTime);
        }
        
        // 检查Boss触发
        if (this.shouldStartBoss()) {
            this.startBossBattle();
        }
        
        // 检查关卡完成
        if (this.isLevelComplete()) {
            this.completeLevel();
        }
    }
    
    /**
     * 更新关卡阶段
     */
    updateLevelPhase() {
        if (this.levelPhase === 'intro' && this.levelTime > 0.5) {  // 改为0.5秒后进入主阶段
            this.levelPhase = 'main';
            console.log('进入主战斗阶段');
        }
    }
    
    /**
     * 更新波次
     */
    updateWaves(deltaTime) {
        if (!this.waveManager) return;
        
        const waves = this.currentLevel.waves;
        
        // 检查是否需要开始新波次
        for (let i = this.waveIndex + 1; i < waves.length; i++) {
            const wave = waves[i];
            if (this.levelTime >= wave.startTime) {
                this.waveIndex = i;
                this.startWave(wave);
            } else {
                break;
            }
        }
        
        // 更新当前波次
        if (this.currentWave) {
            this.waveManager.update(deltaTime);
        }
    }
    
    /**
     * 开始新波次
     */
    startWave(waveData) {
        console.log(`开始波次: ${waveData.type}`);
        this.currentWave = waveData;
        
        if (this.waveManager) {
            this.waveManager.startWave(waveData);
        }
    }
    
    /**
     * 检查是否应该开始Boss战
     */
    shouldStartBoss() {
        if (!this.currentLevel.boss || this.bossSpawned || this.levelPhase !== 'main') return false;
        return this.levelTime >= this.currentLevel.boss.startTime;
    }
    
    /**
     * 开始Boss战
     */
    startBossBattle() {
        console.log('Boss战开始！');
        this.levelPhase = 'boss';
        this.bossActive = true;
        this.bossSpawned = true;
        this.currentWave = null;
        if (this.waveManager) this.waveManager.stopWave();
        
        if (this.bossManager && this.currentLevel.boss) {
            this.bossManager.spawnBoss(this.currentLevel.boss);
        }
    }
    
    /**
     * Boss被击败
     */
    onBossDefeated() {
        if (this.bossDefeated) return;
        this.bossDefeated = true;
        this.outroElapsed = 0;
        console.log('Boss已被击败！');
        this.bossActive = false;
        this.levelPhase = 'outro';
        
        // 添加Boss击败奖励
        this.levelStats.score += 5000;
        this.levelStats.enemiesKilled++;
        
        // 播放胜利音乐
        if (window.audioManager) {
            window.audioManager.playMusic('victory');
        }
    }
    
    /**
     * 检查关卡是否完成
     */
    isLevelComplete() {
        // Boss被击败且过场动画结束
        if (this.levelPhase === 'outro' && this.outroElapsed >= 2) {
            return true;
        }
        
        // 超过最大时长（生存模式）
        if (!this.currentLevel.boss && this.levelTime >= this.currentLevel.duration) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 完成关卡
     */
    completeLevel() {
        if (this.levelCompleted) return;
        this.levelCompleted = true;
        console.log(`关卡完成: ${this.currentLevel.name}`);
        
        // 计算评分
        this.calculateScore();
        
        // 解锁奖励
        this.unlockRewards();
        
        // 触发完成事件
        this.onLevelComplete();
    }
    
    /**
     * 计算关卡评分
     */
    calculateScore() {
        const baseScore = this.currentLevel.rewards.score;
        const accuracyBonus = Math.floor(this.levelStats.accuracy * 1000);
        const timeBonus = Math.max(0, 1000 - Math.floor(this.levelTime * 10));
        const killBonus = this.levelStats.enemiesKilled * 100;
        
        this.levelStats.score = baseScore + accuracyBonus + timeBonus + killBonus;
        
        console.log(`关卡得分: ${this.levelStats.score}`);
    }
    
    /**
     * 解锁奖励
     */
    unlockRewards() {
        const rewards = this.currentLevel.rewards;
        
        // 解锁下一关
        if (rewards.unlocks) {
            rewards.unlocks.forEach(unlock => {
                console.log(`解锁: ${unlock}`);
            });
        }
        
        // 奖励道具
        if (rewards.powerups) {
            rewards.powerups.forEach(powerup => {
                console.log(`获得道具: ${powerup}`);
            });
        }
    }
    
    /**
     * 应用难度调整
     */
    applyDifficulty() {
        const difficulty = this.currentLevel.difficulty * this.difficultyScaler;
        
        // 调整敌机属性
        if (this.currentLevel.waves) {
            this.currentLevel.waves.forEach(wave => {
                wave.spawnRate *= difficulty;
                wave.difficulty *= difficulty;
            });
        }
        
        // 调整Boss属性
        if (this.currentLevel.boss) {
            this.currentLevel.boss.health *= difficulty;
        }
    }
    
    /**
     * 设置难度
     */
    setDifficulty(level) {
        this.difficultyLevel = level;
        this.difficultyScaler = 1 + (level - 1) * 0.5; // 每级难度增加50%
    }
    
    /**
     * 保存检查点
     */
    saveCheckpoint() {
        this.checkpoints.push({
            time: this.levelTime,
            phase: this.levelPhase,
            waveIndex: this.waveIndex,
            stats: { ...this.levelStats }
        });
        this.currentCheckpoint = this.checkpoints.length - 1;
        console.log('检查点已保存');
    }
    
    /**
     * 从检查点恢复
     */
    loadCheckpoint(index) {
        if (index < 0 || index >= this.checkpoints.length) return false;
        
        const checkpoint = this.checkpoints[index];
        this.levelTime = checkpoint.time;
        this.levelPhase = checkpoint.phase;
        this.waveIndex = checkpoint.waveIndex;
        this.levelStats = { ...checkpoint.stats };
        
        console.log('从检查点恢复');
        return true;
    }
    
    /**
     * 获取当前关卡信息
     */
    getCurrentLevelInfo() {
        if (!this.currentLevel) return null;
        
        return {
            name: this.currentLevel.name,
            progress: this.levelTime / this.currentLevel.duration,
            phase: this.levelPhase,
            wave: this.waveIndex + 1,
            totalWaves: this.currentLevel.waves.length,
            bossActive: this.bossActive
        };
    }
    
    /**
     * 关卡完成事件
     */
    onLevelComplete() {
        console.log('触发关卡完成事件');
        if (typeof this.onLevelFinished === 'function') {
            this.onLevelFinished(this.currentLevel, this.levelStats);
        }
    }
    
    /**
     * 重置
     */
    reset() {
        this.currentLevel = null;
        this.currentLevelIndex = 0;
        this.levelTime = 0;
        this.levelPhase = 'intro';
        this.waveIndex = -1;
        this.currentWave = null;
        this.bossActive = false;
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.levelCompleted = false;
        this.outroElapsed = 0;
        if (this.waveManager) this.waveManager.reset();
        this.checkpoints = [];
        this.currentCheckpoint = 0;
    }
}