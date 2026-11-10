/**
 * 游戏配置文件
 * 定义游戏的基础参数和常量
 */
class GameConfig {
    // 画布配置
    static CANVAS = {
        WIDTH: 640,
        HEIGHT: 960,
        BACKGROUND_COLOR: '#001a33'
    };

    // 游戏配置
    static GAME = {
        FPS: 60,
        FRAME_TIME: 1000 / 60,
        DEBUG_MODE: false,
        VERSION: '1.0.0'
    };

    // 玩家配置
    static PLAYER = {
        INITIAL_X: 320,  // 屏幕中央
        INITIAL_Y: 800,  // 屏幕下方
        BASE_SPEED: 300, // 像素/秒
        MAX_SPEED: 500,
        ACCELERATION: 800,
        DECELERATION: 1000,
        SIZE: {
            WIDTH: 60,
            HEIGHT: 80
        },
        HIT_BOX: {
            WIDTH: 30,
            HEIGHT: 40
        },
        // 活动区域限制
        BOUNDS: {
            MIN_X: 32,
            MAX_X: 608,
            MIN_Y: 480,
            MAX_Y: 928
        }
    };

    // 输入配置
    static INPUT = {
        DEAD_ZONE: 0.15,
        SMOOTH_FACTOR: 0.3,
        BUFFER_SIZE: 5
    };

    // 渲染配置
    static RENDER = {
        SHOW_FPS: true,
        SHOW_HITBOX: false,
        BACKGROUND_SCROLL_SPEED: 50, // 像素/秒
        PARTICLE_LIMIT: 100
    };

    // 状态配置
    static STATES = {
        MENU: 'menu',
        PLAYING: 'playing',
        PAUSED: 'paused',
        GAME_OVER: 'gameOver',
        LEVEL_COMPLETE: 'levelComplete',
        LOADING: 'loading'
    };

    // 性能配置
    static PERFORMANCE = {
        TARGET_FPS: 60,
        MIN_FPS: 30,
        AUTO_QUALITY: true,
        MAX_ENTITIES: 100
    };
}