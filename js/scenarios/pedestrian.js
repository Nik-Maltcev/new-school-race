// scenarios/pedestrian.js — Сценарий «Пешеход на переходе»
// Модульный сценарий: человек упал на пешеходном переходе впереди автомобиля

/**
 * Ссылка на созданный меш пешехода (для деактивации)
 * @type {object|null}
 */
let pedestrianMesh = null;

/**
 * Ссылка на анимацию падения
 * @type {object|null}
 */
let fallingAnimation = null;

/**
 * Сценарий «Пешеход на переходе»
 * Реализует интерфейс ScenarioDefinition
 */
export const PedestrianScenario = {
    id: 'pedestrian-crossing',
    description: 'Впереди на пешеходном переходе человек упал и не может встать. До него 20-30 метров.',
    choices: [
        'Остановиться и ждать',
        'Посигналить и объехать',
        'Вызвать экстренные службы'
    ],
    position: { x: 0, z: 100 },
    radius: 15,

    /**
     * Активация сценария: показать пешехода, запустить анимацию падения,
     * инициировать автоматическую остановку автомобиля.
     * @param {object} scene — Babylon.js сцена
     * @param {object} eventBus — шина событий с методами on/off/emit
     */
    activate(scene, eventBus) {
        // 1. Создать/показать модель пешехода на 20-30м впереди триггерной зоны
        const pedestrianDistance = 25; // 25м впереди (в диапазоне 20-30м)
        const pedestrianZ = this.position.z + pedestrianDistance;

        if (scene && typeof BABYLON !== 'undefined') {
            // Создаём простую placeholder-модель пешехода из примитивов
            // Тело (капсула из цилиндра и сфер)
            const body = BABYLON.MeshBuilder.CreateCylinder('pedestrian_body', {
                height: 1.2,
                diameter: 0.4
            }, scene);

            const head = BABYLON.MeshBuilder.CreateSphere('pedestrian_head', {
                diameter: 0.3
            }, scene);
            head.position.y = 0.75;
            head.parent = body;

            // Ноги
            const legLeft = BABYLON.MeshBuilder.CreateCylinder('pedestrian_legL', {
                height: 0.8,
                diameter: 0.15
            }, scene);
            legLeft.position.x = -0.1;
            legLeft.position.y = -1.0;
            legLeft.parent = body;

            const legRight = BABYLON.MeshBuilder.CreateCylinder('pedestrian_legR', {
                height: 0.8,
                diameter: 0.15
            }, scene);
            legRight.position.x = 0.1;
            legRight.position.y = -1.0;
            legRight.parent = body;

            // Позиционирование пешехода
            body.position.x = this.position.x;
            body.position.y = 1.0;
            body.position.z = pedestrianZ;

            // Материал пешехода
            const pedestrianMaterial = new BABYLON.StandardMaterial('pedestrian_mat', scene);
            pedestrianMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.6);
            body.material = pedestrianMaterial;
            head.material = pedestrianMaterial;
            legLeft.material = pedestrianMaterial;
            legRight.material = pedestrianMaterial;

            pedestrianMesh = body;

            // 2. Анимация падения (вращение по оси X для имитации падения вперёд)
            const fallAnimation = new BABYLON.Animation(
                'pedestrian_fall',
                'rotation.x',
                30, // 30 fps
                BABYLON.Animation.ANIMATIONTYPE_FLOAT,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );

            const fallKeyframes = [
                { frame: 0, value: 0 },
                { frame: 15, value: Math.PI / 6 },   // Наклон
                { frame: 30, value: Math.PI / 2 }    // Полное падение (90°)
            ];
            fallAnimation.setKeys(fallKeyframes);

            // Easing для реалистичности
            const easingFunction = new BABYLON.CircleEase();
            easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEIN);
            fallAnimation.setEasingFunction(easingFunction);

            body.animations = [fallAnimation];
            fallingAnimation = scene.beginAnimation(body, 0, 30, false, 1.0);
        }

        // 3. Автоматическая остановка автомобиля (forceStop за 2 секунды)
        // Эмитируем событие, которое основной цикл обрабатывает для вызова carPhysics.forceStop(2)
        if (eventBus) {
            eventBus.emit('car:forceStop', { duration: 2 });
        }
    },

    /**
     * Деактивация сценария: скрыть модель пешехода
     * @param {object} scene — Babylon.js сцена
     */
    deactivate(scene) {
        if (pedestrianMesh) {
            // Остановка анимации
            if (fallingAnimation) {
                fallingAnimation.stop();
                fallingAnimation = null;
            }

            // Удаление меша и дочерних элементов из сцены
            pedestrianMesh.dispose(false, true);
            pedestrianMesh = null;
        }
    }
};
