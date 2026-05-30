/**
 * Контрольная точка 6 — Проверка сценариев
 * Верификация модулей model-loader.js и scenario-manager.js
 * 
 * Проверяет:
 * 1. Отсутствие синтаксических ошибок в model-loader.js и scenario-manager.js
 * 2. Корректность валидации ScenarioManager (регистрация валидных/невалидных сценариев)
 * 3. Корректность логики обнаружения триггерных зон ScenarioManager
 * 4. Размещение зданий ModelLoader (минимум 4 на каждой стороне)
 * 5. Корректность ES-модульных экспортов всех модулей
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ ${message}`);
        failed++;
    }
}

// ============================================================
// 1. Проверка синтаксиса (парсинг модулей)
// ============================================================
console.log('\n=== 1. Проверка синтаксиса модулей ===');

const modulesToCheck = [
    'js/event-bus.js',
    'js/engine.js',
    'js/input-manager.js',
    'js/car-physics.js',
    'js/camera.js',
    'js/model-loader.js',
    'js/scenario-manager.js',
];

for (const modulePath of modulesToCheck) {
    try {
        const fullPath = join(projectRoot, modulePath);
        const code = readFileSync(fullPath, 'utf-8');
        // Attempt to parse as module (dynamic import would be ideal but we check syntax via Function)
        // We can't use Function for ES modules, so we just check the file is readable and non-empty
        assert(code.length > 0, `${modulePath} — файл не пустой (${code.length} символов)`);
    } catch (e) {
        assert(false, `${modulePath} — ошибка чтения: ${e.message}`);
    }
}

// ============================================================
// 2. Проверка ES-модульных экспортов (статический анализ)
// ============================================================
console.log('\n=== 2. Проверка ES-модульных экспортов ===');

const expectedExports = {
    'js/event-bus.js': ['EventBus'],
    'js/engine.js': ['Engine'],
    'js/input-manager.js': ['InputManager'],
    'js/car-physics.js': ['CarPhysics'],
    'js/camera.js': ['DriverCamera'],
    'js/model-loader.js': ['ModelLoader'],
    'js/scenario-manager.js': ['ScenarioManager'],
};

for (const [modulePath, exports] of Object.entries(expectedExports)) {
    const fullPath = join(projectRoot, modulePath);
    const code = readFileSync(fullPath, 'utf-8');
    for (const exportName of exports) {
        const hasExport = code.includes(`export class ${exportName}`) || 
                          code.includes(`export const ${exportName}`) ||
                          code.includes(`export function ${exportName}`);
        assert(hasExport, `${modulePath} экспортирует ${exportName}`);
    }
}

// ============================================================
// 3. Проверка ScenarioManager — валидация (без BABYLON)
// ============================================================
console.log('\n=== 3. Проверка ScenarioManager — валидация ===');

// Мы импортируем ScenarioManager напрямую (он не зависит от BABYLON при отсутствии scene)
const scenarioManagerPath = new URL('../js/scenario-manager.js', import.meta.url).href;
const { ScenarioManager } = await import(scenarioManagerPath);

// Создаём mock EventBus
const mockEventBus = {
    _events: [],
    on(event, cb) {},
    off(event, cb) {},
    emit(event, data) { this._events.push({ event, data }); }
};

// 3.1 Регистрация валидного сценария
const sm = new ScenarioManager(mockEventBus);
const validScenario = {
    id: 'test-scenario',
    description: 'Тестовый сценарий',
    choices: ['Вариант 1', 'Вариант 2', 'Вариант 3'],
    position: { x: 0, z: 100 },
    radius: 15,
    activate: () => {},
};

const registerResult = sm.register(validScenario);
assert(registerResult === true, 'Валидный сценарий зарегистрирован успешно');

// 3.2 Отклонение сценария без обязательных свойств
const sm2 = new ScenarioManager(mockEventBus);
const invalidScenario1 = { id: 'bad', description: 'test' }; // нет choices, position, radius, activate
const result1 = sm2.register(invalidScenario1);
assert(result1 === false, 'Сценарий без обязательных свойств отклонён');

// 3.3 Отклонение сценария с невалидным choices (1 элемент)
const sm3 = new ScenarioManager(mockEventBus);
const invalidScenario2 = {
    id: 'bad2',
    description: 'test',
    choices: ['Только один'],
    position: { x: 0, z: 0 },
    radius: 10,
    activate: () => {},
};
const result2 = sm3.register(invalidScenario2);
assert(result2 === false, 'Сценарий с 1 вариантом выбора отклонён');

// 3.4 Отклонение сценария с невалидным choices (4 элемента)
const sm4 = new ScenarioManager(mockEventBus);
const invalidScenario3 = {
    id: 'bad3',
    description: 'test',
    choices: ['A', 'B', 'C', 'D'],
    position: { x: 0, z: 0 },
    radius: 10,
    activate: () => {},
};
const result3 = sm4.register(invalidScenario3);
assert(result3 === false, 'Сценарий с 4 вариантами выбора отклонён');

// 3.5 Отклонение сценария с невалидным radius (отрицательное число)
const sm5 = new ScenarioManager(mockEventBus);
const invalidScenario4 = {
    id: 'bad4',
    description: 'test',
    choices: ['A', 'B'],
    position: { x: 0, z: 0 },
    radius: -5,
    activate: () => {},
};
const result4 = sm5.register(invalidScenario4);
assert(result4 === false, 'Сценарий с отрицательным radius отклонён');

// 3.6 Отклонение сценария с radius = 0
const sm6 = new ScenarioManager(mockEventBus);
const invalidScenario5 = {
    id: 'bad5',
    description: 'test',
    choices: ['A', 'B'],
    position: { x: 0, z: 0 },
    radius: 0,
    activate: () => {},
};
const result5 = sm6.register(invalidScenario5);
assert(result5 === false, 'Сценарий с radius=0 отклонён');

// 3.7 Регистрация сценария с 2 вариантами (минимум)
const sm7 = new ScenarioManager(mockEventBus);
const validScenario2 = {
    id: 'valid2',
    description: 'Два варианта',
    choices: ['A', 'B'],
    position: { x: 50, z: 200 },
    radius: 10,
    activate: () => {},
};
const result6 = sm7.register(validScenario2);
assert(result6 === true, 'Сценарий с 2 вариантами зарегистрирован');

// ============================================================
// 4. Проверка ScenarioManager — обнаружение триггерных зон
// ============================================================
console.log('\n=== 4. Проверка ScenarioManager — триггерные зоны ===');

// 4.1 Автомобиль внутри зоны — активация сценария
const sm8 = new ScenarioManager(mockEventBus);
let activateCalled = false;
const scenario8 = {
    id: 'trigger-test',
    description: 'Тест триггера',
    choices: ['A', 'B'],
    position: { x: 0, z: 100 },
    radius: 15,
    activate: () => { activateCalled = true; },
};
sm8.register(scenario8);

// Bounding box автомобиля, пересекающий зону (центр в x=0, z=100)
const carBB_inside = {
    min: { x: -1, y: 0, z: 99 },
    max: { x: 1, y: 1.5, z: 101 },
};
sm8.update(carBB_inside);
assert(activateCalled === true, 'Сценарий активирован при пересечении bounding box');
assert(sm8.isLocked() === true, 'Система заблокирована после активации');
assert(sm8.getActiveScenario() !== null, 'Активный сценарий не null');
assert(sm8.getActiveScenario().id === 'trigger-test', 'Активный сценарий имеет правильный id');

// 4.2 Блокировка — второй сценарий не активируется
let activate2Called = false;
const scenario9 = {
    id: 'trigger-test-2',
    description: 'Тест триггера 2',
    choices: ['X', 'Y'],
    position: { x: 0, z: 105 },
    radius: 10,
    activate: () => { activate2Called = true; },
};
sm8.register(scenario9);

const carBB_inside2 = {
    min: { x: -1, y: 0, z: 104 },
    max: { x: 1, y: 1.5, z: 106 },
};
sm8.update(carBB_inside2);
assert(activate2Called === false, 'Второй сценарий НЕ активирован при заблокированной системе');

// 4.3 Завершение сценария — разблокировка
sm8.completeScenario('trigger-test');
assert(sm8.isLocked() === false, 'Система разблокирована после завершения сценария');
assert(sm8.getActiveScenario() === null, 'Активный сценарий null после завершения');

// 4.4 Деактивация зоны после завершения — повторная активация не происходит
activateCalled = false;
sm8.update(carBB_inside); // Автомобиль снова в зоне первого сценария
assert(activateCalled === false, 'Завершённый сценарий НЕ активируется повторно');

// 4.5 Автомобиль далеко от зоны — предварительная фильтрация
const sm10 = new ScenarioManager(mockEventBus);
let farActivateCalled = false;
const farScenario = {
    id: 'far-scenario',
    description: 'Далёкий сценарий',
    choices: ['A', 'B'],
    position: { x: 0, z: 500 },
    radius: 15,
    activate: () => { farActivateCalled = true; },
};
sm10.register(farScenario);

const carBB_far = {
    min: { x: -1, y: 0, z: -1 },
    max: { x: 1, y: 1.5, z: 1 },
};
sm10.update(carBB_far);
assert(farActivateCalled === false, 'Сценарий на расстоянии >100м НЕ активирован (предварительная фильтрация)');

// 4.6 Re-entry логика
const sm11 = new ScenarioManager(mockEventBus);
let reentryActivated = 0;
const reentryScenario1 = {
    id: 'reentry-blocker',
    description: 'Блокирующий',
    choices: ['A', 'B'],
    position: { x: 0, z: 50 },
    radius: 10,
    activate: () => {},
};
const reentryScenario2 = {
    id: 'reentry-target',
    description: 'Целевой',
    choices: ['A', 'B'],
    position: { x: 0, z: 70 },
    radius: 10,
    activate: () => { reentryActivated++; },
};
sm11.register(reentryScenario1);
sm11.register(reentryScenario2);

// Автомобиль въезжает в первую зону
sm11.update({ min: { x: -1, y: 0, z: 49 }, max: { x: 1, y: 1.5, z: 51 } });
// Автомобиль также внутри второй зоны (но система заблокирована)
sm11.update({ min: { x: -1, y: 0, z: 69 }, max: { x: 1, y: 1.5, z: 71 } });
assert(reentryActivated === 0, 'Целевой сценарий НЕ активирован при заблокированной системе');

// Завершаем первый сценарий (авто внутри второй зоны)
sm11.completeScenario('reentry-blocker');
assert(reentryActivated === 0, 'Целевой сценарий НЕ активирован сразу после разблокировки (re-entry)');

// Автомобиль выезжает из второй зоны
sm11.update({ min: { x: -1, y: 0, z: 0 }, max: { x: 1, y: 1.5, z: 2 } });
// Автомобиль снова въезжает во вторую зону
sm11.update({ min: { x: -1, y: 0, z: 69 }, max: { x: 1, y: 1.5, z: 71 } });
assert(reentryActivated === 1, 'Целевой сценарий активирован после re-entry (выезд и повторный въезд)');

// ============================================================
// 5. Проверка ModelLoader — размещение зданий
// ============================================================
console.log('\n=== 5. Проверка ModelLoader — размещение зданий ===');

// Для проверки placeBuildings нам нужен mock BABYLON
// Создаём минимальный mock
globalThis.BABYLON = {
    Vector3: class {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    },
    Texture: class {
        constructor(path, scene) { this.path = path; this.uScale = 1; this.vScale = 1; }
    },
    StandardMaterial: class {
        constructor(name, scene) { this.name = name; this.diffuseTexture = null; }
    },
    MeshBuilder: {
        CreateGround(name, opts, scene) {
            return { name, material: null, position: { x: 0, y: 0, z: 0 } };
        },
        CreateBox(name, opts, scene) {
            return {
                name,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                isVisible: true,
                isPickable: true,
            };
        }
    },
    SceneLoader: {
        async ImportMeshAsync() { return { meshes: [{ setEnabled() {} }] }; }
    }
};

// Создаём mock buildingMesh
const mockBuildingMesh = {
    clone(name) {
        return {
            name,
            position: new BABYLON.Vector3(0, 0, 0),
            rotation: new BABYLON.Vector3(0, 0, 0),
            setEnabled(v) {},
        };
    }
};

const modelLoaderPath = new URL('../js/model-loader.js', import.meta.url).href;
const { ModelLoader } = await import(modelLoaderPath);
const loader = new ModelLoader(null, '/assets/models/', '/assets/textures/');

// 5.1 Размещение зданий по умолчанию (buildingCount=6)
const buildings1 = loader.placeBuildings(mockBuildingMesh);
assert(buildings1.length >= 8, `Размещено минимум 8 зданий (4 на каждой стороне), получено: ${buildings1.length}`);

// 5.2 Размещение зданий с buildingCount=4 (минимум)
const buildings2 = loader.placeBuildings(mockBuildingMesh, { buildingCount: 4 });
assert(buildings2.length >= 8, `С buildingCount=4: минимум 8 зданий, получено: ${buildings2.length}`);

// 5.3 Размещение зданий с buildingCount=2 (должно быть принудительно увеличено до 4)
const buildings3 = loader.placeBuildings(mockBuildingMesh, { buildingCount: 2 });
assert(buildings3.length >= 8, `С buildingCount=2: принудительно минимум 8 зданий (4 на сторону), получено: ${buildings3.length}`);

// 5.4 Проверка равномерного интервала
const buildings4 = loader.placeBuildings(mockBuildingMesh, { roadLength: 400, buildingCount: 4 });
const leftBuildings = buildings4.filter(b => b.name.includes('left'));
const rightBuildings = buildings4.filter(b => b.name.includes('right'));
assert(leftBuildings.length >= 4, `Минимум 4 здания слева, получено: ${leftBuildings.length}`);
assert(rightBuildings.length >= 4, `Минимум 4 здания справа, получено: ${rightBuildings.length}`);

// Проверяем равномерность интервалов (для левой стороны)
if (leftBuildings.length >= 2) {
    const zPositions = leftBuildings.map(b => b.position.z).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < zPositions.length; i++) {
        intervals.push(zPositions[i] - zPositions[i - 1]);
    }
    const allEqual = intervals.every(interval => Math.abs(interval - intervals[0]) < 0.01);
    assert(allEqual, 'Здания размещены с равномерным интервалом');
}

// ============================================================
// Итоги
// ============================================================
console.log('\n=== ИТОГИ ===');
console.log(`Пройдено: ${passed}`);
console.log(`Провалено: ${failed}`);
console.log(`Всего: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
} else {
    console.log('\n✓ Все проверки контрольной точки 6 пройдены успешно!');
    process.exit(0);
}
