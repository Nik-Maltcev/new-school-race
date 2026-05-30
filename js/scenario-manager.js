// scenario-manager.js — Управление жизненным циклом сценариев и триггерных зон

/**
 * Обязательные свойства объекта сценария
 */
const REQUIRED_PROPERTIES = ['id', 'description', 'choices', 'position', 'radius', 'activate'];

/**
 * Расстояние предварительной фильтрации (метры)
 */
const PRE_FILTER_DISTANCE = 100;

export class ScenarioManager {
    /**
     * @param {object} eventBus — шина событий с методами on/off/emit
     * @param {object} [scene] — Babylon.js сцена для создания мешей триггерных зон
     */
    constructor(eventBus, scene) {
        this._eventBus = eventBus;
        this._scene = scene || null;

        /** @type {Map<string, object>} Зарегистрированные сценарии по id */
        this._scenarios = new Map();

        /** @type {Array<object>} Триггерные зоны */
        this._triggerZones = [];

        /** @type {object|null} Текущий активный сценарий */
        this._activeScenario = null;

        /** @type {boolean} Заблокирована ли система */
        this._locked = false;
    }

    /**
     * Регистрация сценария с валидацией.
     * Создаёт триггерную зону для валидного сценария.
     * @param {object} scenario — объект сценария (ScenarioDefinition)
     * @returns {boolean} true если регистрация успешна, false при ошибке валидации
     */
    register(scenario) {
        // Валидация обязательных свойств
        const missingProps = REQUIRED_PROPERTIES.filter(prop => !(prop in scenario) || scenario[prop] === undefined || scenario[prop] === null);

        if (missingProps.length > 0) {
            console.error(`ScenarioManager: регистрация отклонена. Отсутствуют обязательные свойства: ${missingProps.join(', ')}`);
            return false;
        }

        // Проверка типов: choices — массив из 2-3 элементов
        if (!Array.isArray(scenario.choices) || scenario.choices.length < 2 || scenario.choices.length > 3) {
            console.error(`ScenarioManager: регистрация отклонена. Свойство 'choices' должно быть массивом из 2-3 элементов, получено: ${Array.isArray(scenario.choices) ? scenario.choices.length : typeof scenario.choices}`);
            return false;
        }

        // Проверка типов: radius — положительное число
        if (typeof scenario.radius !== 'number' || scenario.radius <= 0) {
            console.error(`ScenarioManager: регистрация отклонена. Свойство 'radius' должно быть положительным числом, получено: ${scenario.radius}`);
            return false;
        }

        // Сохранение сценария
        this._scenarios.set(scenario.id, scenario);

        // Создание триггерной зоны
        const triggerZone = this._createTriggerZone(scenario);
        this._triggerZones.push(triggerZone);

        return true;
    }

    /**
     * Проверка пересечений bounding box автомобиля с триггерными зонами.
     * Вызывается каждый кадр.
     * @param {{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }} carBoundingBox — AABB автомобиля
     */
    update(carBoundingBox) {
        if (!carBoundingBox) return;

        // Вычисляем центр bounding box автомобиля
        const carCenterX = (carBoundingBox.min.x + carBoundingBox.max.x) / 2;
        const carCenterZ = (carBoundingBox.min.z + carBoundingBox.max.z) / 2;

        for (const zone of this._triggerZones) {
            // Пропускаем уже сработавшие зоны
            if (zone.wasTriggered) {
                zone.carInside = false;
                continue;
            }

            // Предварительная фильтрация по расстоянию (100м)
            const dx = carCenterX - zone.position.x;
            const dz = carCenterZ - zone.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > PRE_FILTER_DISTANCE) {
                zone.carInside = false;
                continue;
            }

            // Проверка пересечения AABB автомобиля с bounding box зоны
            const zoneBB = this._getZoneBoundingBox(zone);
            const intersects = this._intersectsAABB(carBoundingBox, zoneBB);

            if (intersects) {
                // Автомобиль внутри зоны
                if (!zone.carInside) {
                    // Автомобиль только что въехал
                    zone.carInside = true;

                    // Активация только если система не заблокирована и зона активна
                    if (!this._locked && zone.isActive) {
                        this._activateScenario(zone);
                    }
                }
            } else {
                // Автомобиль вне зоны
                if (zone.carInside) {
                    // Автомобиль только что выехал
                    zone.carInside = false;

                    // Если зона ожидала re-entry — восстанавливаем активность
                    if (!zone.isActive && !zone.wasTriggered) {
                        zone.isActive = true;
                    }
                }
            }
        }
    }

    /**
     * Возвращает текущий активный сценарий или null
     * @returns {object|null}
     */
    getActiveScenario() {
        return this._activeScenario;
    }

    /**
     * Завершение сценария по id.
     * Разблокирует систему и деактивирует триггерную зону.
     * @param {string} scenarioId — идентификатор завершаемого сценария
     */
    completeScenario(scenarioId) {
        if (!this._activeScenario || this._activeScenario.id !== scenarioId) {
            return;
        }

        // Деактивация зоны (wasTriggered = true)
        const zone = this._triggerZones.find(z => z.scenarioId === scenarioId);
        if (zone) {
            zone.wasTriggered = true;
            zone.isActive = false;
        }

        // Разблокировка системы
        this._activeScenario = null;
        this._locked = false;

        // Логика re-entry: для зон, в которых автомобиль сейчас находится,
        // деактивируем их до выезда и повторного въезда
        for (const z of this._triggerZones) {
            if (z.wasTriggered || z.scenarioId === scenarioId) continue;
            if (z.carInside) {
                // Автомобиль внутри зоны при разблокировке — ждём выезда
                z.isActive = false;
            }
        }

        // Событие завершения сценария
        this._eventBus.emit('scenario:completed', { scenarioId });
    }

    /**
     * Проверяет, заблокирована ли система (активен сценарий)
     * @returns {boolean}
     */
    isLocked() {
        return this._locked;
    }

    /**
     * Создаёт триггерную зону для сценария
     * @param {object} scenario — объект сценария
     * @returns {object} TriggerZone
     * @private
     */
    _createTriggerZone(scenario) {
        let mesh = null;

        // Создание невидимого меша для bounding box (если сцена доступна)
        if (this._scene && typeof BABYLON !== 'undefined') {
            const diameter = scenario.radius * 2;
            mesh = BABYLON.MeshBuilder.CreateBox(
                `trigger_${scenario.id}`,
                { width: diameter, height: 2, depth: diameter },
                this._scene
            );
            mesh.position.x = scenario.position.x;
            mesh.position.y = 1; // Центр по высоте
            mesh.position.z = scenario.position.z;
            mesh.isVisible = false;
            mesh.isPickable = false;
        }

        return {
            scenarioId: scenario.id,
            position: { x: scenario.position.x, z: scenario.position.z },
            radius: scenario.radius,
            mesh: mesh,
            isActive: true,
            wasTriggered: false,
            carInside: false,
        };
    }

    /**
     * Вычисляет AABB для триггерной зоны
     * @param {object} zone — триггерная зона
     * @returns {{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }}
     * @private
     */
    _getZoneBoundingBox(zone) {
        return {
            min: {
                x: zone.position.x - zone.radius,
                y: 0,
                z: zone.position.z - zone.radius,
            },
            max: {
                x: zone.position.x + zone.radius,
                y: 2,
                z: zone.position.z + zone.radius,
            },
        };
    }

    /**
     * Проверяет пересечение двух AABB
     * @param {{ min: { x, y, z }, max: { x, y, z } }} a
     * @param {{ min: { x, y, z }, max: { x, y, z } }} b
     * @returns {boolean}
     * @private
     */
    _intersectsAABB(a, b) {
        return (
            a.min.x <= b.max.x && a.max.x >= b.min.x &&
            a.min.y <= b.max.y && a.max.y >= b.min.y &&
            a.min.z <= b.max.z && a.max.z >= b.min.z
        );
    }

    /**
     * Активирует сценарий для данной триггерной зоны
     * @param {object} zone — триггерная зона
     * @private
     */
    _activateScenario(zone) {
        const scenario = this._scenarios.get(zone.scenarioId);
        if (!scenario) return;

        // Блокировка системы
        this._locked = true;
        this._activeScenario = scenario;

        // Событие входа в триггерную зону
        this._eventBus.emit('trigger:entered', { scenarioId: zone.scenarioId });

        // Вызов функции активации сценария
        if (typeof scenario.activate === 'function') {
            scenario.activate(this._scene, this._eventBus);
        }
    }
}
