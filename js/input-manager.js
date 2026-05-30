// input-manager.js — Обработка клавиатурного ввода

export class InputManager {
    constructor() {
        this._keys = {
            accelerate: false,
            brake: false,
            turnLeft: false,
            turnRight: false
        };
        this._blocked = false;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);

        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
    }

    /**
     * Возвращает текущее состояние ввода.
     * Если ввод заблокирован, возвращает все значения false.
     * @returns {{ accelerate: boolean, brake: boolean, turnLeft: boolean, turnRight: boolean }}
     */
    getInput() {
        if (this._blocked) {
            return { accelerate: false, brake: false, turnLeft: false, turnRight: false };
        }
        return {
            accelerate: this._keys.accelerate,
            brake: this._keys.brake,
            turnLeft: this._keys.turnLeft,
            turnRight: this._keys.turnRight
        };
    }

    /**
     * Устанавливает состояние блокировки ввода.
     * @param {boolean} blocked — true для блокировки, false для разблокировки
     */
    setBlocked(blocked) {
        this._blocked = blocked;
    }

    /**
     * Проверяет, заблокирован ли ввод.
     * @returns {boolean}
     */
    isBlocked() {
        return this._blocked;
    }

    /**
     * Удаляет обработчики событий (для очистки ресурсов).
     */
    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
    }

    /**
     * @private
     */
    _onKeyDown(event) {
        this._updateKey(event.key, true);
    }

    /**
     * @private
     */
    _onKeyUp(event) {
        this._updateKey(event.key, false);
    }

    /**
     * @private
     */
    _updateKey(key, pressed) {
        switch (key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                this._keys.accelerate = pressed;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                this._keys.brake = pressed;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                this._keys.turnLeft = pressed;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                this._keys.turnRight = pressed;
                break;
        }
    }
}
