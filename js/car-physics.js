// car-physics.js — Физическая модель автомобиля на плоской поверхности

/**
 * Конфигурация физики по умолчанию
 */
const DEFAULT_CONFIG = {
    maxSpeed: 33.33,        // 120 км/ч в м/с
    acceleration: 2.0,      // м/с²
    brakeDeceleration: 4.0, // м/с²
    friction: 0.5,          // м/с² (замедление без газа)
    maxTurnRate: 90,        // град/с при максимальной скорости
};

/**
 * Размеры bounding box автомобиля (в метрах)
 */
const CAR_DIMENSIONS = {
    width: 2.0,
    height: 1.5,
    length: 4.5,
};

export class CarPhysics {
    /**
     * @param {object} [config] — конфигурация физики (опционально, используется DEFAULT_CONFIG)
     */
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = 0; // радианы
        this.speed = 0;    // м/с

        this.inputBlocked = false;

        // Состояние принудительной остановки
        this._isForceStopping = false;
        this._forceStopDuration = 0;
        this._forceStopElapsed = 0;
        this._forceStopInitialSpeed = 0;
    }

    /**
     * Обновление физики за один кадр
     * @param {number} deltaTime — время кадра в секундах
     * @param {{ accelerate: boolean, brake: boolean, turnLeft: boolean, turnRight: boolean }} input — состояние ввода
     */
    update(deltaTime, input) {
        // Обработка принудительной остановки
        if (this._isForceStopping) {
            this._forceStopElapsed += deltaTime;
            if (this._forceStopElapsed >= this._forceStopDuration) {
                this.speed = 0;
                this._isForceStopping = false;
            } else {
                const progress = this._forceStopElapsed / this._forceStopDuration;
                this.speed = this._forceStopInitialSpeed * (1 - progress);
            }

            // Обновление позиции даже при торможении
            this.position.x += Math.sin(this.rotation) * this.speed * deltaTime;
            this.position.z += Math.cos(this.rotation) * this.speed * deltaTime;
            this.position.y = 0;
            return;
        }

        if (this.inputBlocked) return;

        // Ускорение / торможение
        if (input.accelerate) {
            this.speed = Math.min(this.speed + this.config.acceleration * deltaTime, this.config.maxSpeed);
        } else if (input.brake) {
            this.speed = Math.max(this.speed - this.config.brakeDeceleration * deltaTime, 0);
        } else {
            this.speed = Math.max(this.speed - this.config.friction * deltaTime, 0);
        }

        // Поворот (только при движении)
        if (this.speed > 0) {
            const turnFactor = this.speed / this.config.maxSpeed;
            const turnRate = this.config.maxTurnRate * turnFactor * (Math.PI / 180);
            if (input.turnLeft) this.rotation -= turnRate * deltaTime;
            if (input.turnRight) this.rotation += turnRate * deltaTime;
        }

        // Обновление позиции
        this.position.x += Math.sin(this.rotation) * this.speed * deltaTime;
        this.position.z += Math.cos(this.rotation) * this.speed * deltaTime;
        this.position.y = 0; // Плоская поверхность
    }

    /**
     * Возвращает текущую позицию автомобиля
     * @returns {{ x: number, y: number, z: number }}
     */
    getPosition() {
        return { ...this.position };
    }

    /**
     * Возвращает текущий угол поворота автомобиля (в радианах)
     * @returns {number}
     */
    getRotation() {
        return this.rotation;
    }

    /**
     * Возвращает текущую скорость автомобиля (м/с)
     * @returns {number}
     */
    getSpeed() {
        return this.speed;
    }

    /**
     * Возвращает bounding box автомобиля для обнаружения столкновений.
     * Bounding box ориентирован по осям мира (AABB) и вычисляется
     * на основе позиции, поворота и размеров автомобиля.
     * @returns {{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }}
     */
    getBoundingBox() {
        const halfWidth = CAR_DIMENSIONS.width / 2;
        const halfLength = CAR_DIMENSIONS.length / 2;
        const height = CAR_DIMENSIONS.height;

        // Вычисляем углы автомобиля с учётом поворота
        const cosR = Math.cos(this.rotation);
        const sinR = Math.sin(this.rotation);

        // Четыре угла автомобиля в локальных координатах
        const corners = [
            { x: -halfWidth, z: -halfLength },
            { x:  halfWidth, z: -halfLength },
            { x: -halfWidth, z:  halfLength },
            { x:  halfWidth, z:  halfLength },
        ];

        // Трансформация углов в мировые координаты
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const corner of corners) {
            const worldX = this.position.x + corner.x * cosR + corner.z * sinR;
            const worldZ = this.position.z - corner.x * sinR + corner.z * cosR;
            minX = Math.min(minX, worldX);
            maxX = Math.max(maxX, worldX);
            minZ = Math.min(minZ, worldZ);
            maxZ = Math.max(maxZ, worldZ);
        }

        return {
            min: { x: minX, y: 0, z: minZ },
            max: { x: maxX, y: height, z: maxZ },
        };
    }

    /**
     * Устанавливает состояние блокировки ввода
     * @param {boolean} blocked — true для блокировки, false для разблокировки
     */
    setInputBlocked(blocked) {
        this.inputBlocked = blocked;
    }

    /**
     * Плавная принудительная остановка автомобиля за указанное время
     * @param {number} duration — время остановки в секундах
     */
    forceStop(duration) {
        if (this.speed <= 0) return;
        this._isForceStopping = true;
        this._forceStopDuration = duration;
        this._forceStopElapsed = 0;
        this._forceStopInitialSpeed = this.speed;
        this.inputBlocked = true;
    }
}
