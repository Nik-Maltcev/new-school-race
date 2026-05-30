// engine.js — Инициализация Babylon.js, создание сцены и управление игровым циклом

export class Engine {
    /**
     * @param {string} canvasId — ID элемента canvas для рендеринга
     */
    constructor(canvasId) {
        this._canvasId = canvasId;
        this._engine = null;
        this._scene = null;
        this._updateCallbacks = [];
    }

    /**
     * Инициализация Babylon.js Engine и Scene
     */
    async initialize() {
        const canvas = document.getElementById(this._canvasId);
        if (!canvas) {
            throw new Error(`Canvas element with id "${this._canvasId}" not found`);
        }

        this._engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true
        });

        this._scene = new BABYLON.Scene(this._engine);

        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }

    /**
     * Регистрация функции обновления, вызываемой каждый кадр в render loop
     * @param {Function} fn — функция, принимающая deltaTime (в секундах)
     */
    registerUpdateCallback(fn) {
        if (typeof fn === 'function') {
            this._updateCallbacks.push(fn);
        }
    }

    /**
     * Запуск render loop
     */
    start() {
        this._engine.runRenderLoop(() => {
            const deltaTime = this._engine.getDeltaTime() / 1000; // мс → секунды

            for (const callback of this._updateCallbacks) {
                callback(deltaTime);
            }

            this._scene.render();
        });
    }

    /**
     * Доступ к сцене Babylon.js
     * @returns {BABYLON.Scene}
     */
    getScene() {
        return this._scene;
    }
}
