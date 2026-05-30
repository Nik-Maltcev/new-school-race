// model-loader.js — Загрузка и размещение GLTF-моделей, загрузка и применение текстур

import { EventBus } from './event-bus.js';

export class ModelLoader {
    /**
     * @param {BABYLON.Scene} scene — сцена Babylon.js
     * @param {string} modelsPath — путь к директории моделей (например, '/assets/models/')
     * @param {string} texturesPath — путь к директории текстур (например, '/assets/textures/')
     */
    constructor(scene, modelsPath = '/assets/models/', texturesPath = '/assets/textures/') {
        this._scene = scene;
        this._modelsPath = modelsPath;
        this._texturesPath = texturesPath;
        this._models = new Map();
        this._textures = new Map();
    }

    /**
     * Загрузка всех моделей из манифеста с таймаутом.
     * При ошибке загрузки — сообщение в консоль с именем файла, прерывание запуска.
     * После успешной загрузки — уведомление 'models:loaded' через EventBus.
     * @param {Array<{name: string, file: string}>} manifest — манифест моделей
     * @param {number} timeout — таймаут в миллисекундах (по умолчанию 30000)
     * @returns {Promise<void>}
     */
    async loadAll(manifest, timeout = 30000) {
        const loadPromise = this._loadModels(manifest);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Превышено время ожидания загрузки моделей (30 секунд)'));
            }, timeout);
        });

        try {
            await Promise.race([loadPromise, timeoutPromise]);
            EventBus.emit('models:loaded');
        } catch (error) {
            console.error(`[ModelLoader] Ошибка загрузки: ${error.message}`);
            throw error;
        }
    }

    /**
     * Внутренний метод загрузки моделей из манифеста.
     * @param {Array<{name: string, file: string}>} manifest
     * @returns {Promise<void>}
     */
    async _loadModels(manifest) {
        for (const entry of manifest) {
            try {
                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    '',
                    this._modelsPath,
                    entry.file,
                    this._scene
                );
                // Сохраняем корневой меш (первый) или контейнер мешей
                const rootMesh = result.meshes[0];
                rootMesh.setEnabled(false); // Скрываем оригинал для клонирования
                this._models.set(entry.name, rootMesh);
            } catch (error) {
                const errorMessage = `Не удалось загрузить модель: ${entry.file}`;
                console.error(`[ModelLoader] ${errorMessage}`, error);
                EventBus.emit('models:error', { filename: entry.file, error });
                throw new Error(errorMessage);
            }
        }
    }

    /**
     * Загрузка текстур из манифеста.
     * @param {Array<{name: string, file: string}>} textureManifest — манифест текстур
     * @returns {Promise<void>}
     */
    async loadTextures(textureManifest) {
        for (const entry of textureManifest) {
            try {
                const texturePath = this._texturesPath + entry.file;
                const texture = new BABYLON.Texture(texturePath, this._scene);
                this._textures.set(entry.name, texture);
            } catch (error) {
                const errorMessage = `Не удалось загрузить текстуру: ${entry.file}`;
                console.error(`[ModelLoader] ${errorMessage}`, error);
                throw new Error(errorMessage);
            }
        }
    }

    /**
     * Получение загруженной модели по имени.
     * @param {string} name — имя модели из манифеста
     * @returns {BABYLON.Mesh|undefined}
     */
    getModel(name) {
        return this._models.get(name);
    }

    /**
     * Получение загруженной текстуры по имени.
     * @param {string} name — имя текстуры из манифеста
     * @returns {BABYLON.Texture|undefined}
     */
    getTexture(name) {
        return this._textures.get(name);
    }

    /**
     * Размещение зданий по обеим сторонам дороги с равномерным интервалом.
     * Минимум 4 здания на каждой стороне.
     * @param {BABYLON.Mesh} buildingMesh — меш здания для клонирования
     * @param {object} roadConfig — конфигурация дороги
     * @param {number} roadConfig.roadLength — длина дороги (по умолчанию 500)
     * @param {number} roadConfig.roadWidth — ширина дороги (по умолчанию 10)
     * @param {number} roadConfig.buildingOffset — отступ зданий от центра дороги (по умолчанию 12)
     * @param {number} roadConfig.buildingCount — количество зданий на каждой стороне (по умолчанию 6)
     * @returns {Array<BABYLON.Mesh>} — массив размещённых мешей зданий
     */
    placeBuildings(buildingMesh, roadConfig = {}) {
        const {
            roadLength = 500,
            buildingOffset = 12,
            buildingCount = 6
        } = roadConfig;

        const buildings = [];
        // Минимум 4 здания на каждой стороне
        const count = Math.max(4, buildingCount);
        // Равномерный интервал между зданиями
        const spacing = roadLength / (count + 1);

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < count; i++) {
                const clone = buildingMesh.clone(`building_${side === -1 ? 'left' : 'right'}_${i}`);
                clone.setEnabled(true);

                // Позиция: X — сторона дороги, Z — равномерный интервал вдоль дороги
                const xPos = side * buildingOffset;
                const zPos = spacing * (i + 1) - roadLength / 2;

                clone.position = new BABYLON.Vector3(xPos, 0, zPos);

                // Поворот зданий лицом к дороге
                if (side === 1) {
                    clone.rotation = new BABYLON.Vector3(0, Math.PI, 0);
                }

                buildings.push(clone);
            }
        }

        return buildings;
    }

    /**
     * Создание плоскости дороги с тайлинговой текстурой.
     * @param {BABYLON.Scene} scene — сцена Babylon.js
     * @param {string} texturePath — путь к текстуре дороги
     * @returns {BABYLON.Mesh} — меш дороги
     */
    createRoadPlane(scene, texturePath) {
        const roadPlane = BABYLON.MeshBuilder.CreateGround('road', { width: 10, height: 500 }, scene);
        const roadMaterial = new BABYLON.StandardMaterial('roadMat', scene);
        roadMaterial.diffuseTexture = new BABYLON.Texture(texturePath, scene);
        roadMaterial.diffuseTexture.uScale = 20;
        roadMaterial.diffuseTexture.vScale = 20;
        roadPlane.material = roadMaterial;
        return roadPlane;
    }

    /**
     * Создание плоскости тротуара с тайлинговой текстурой.
     * @param {BABYLON.Scene} scene — сцена Babylon.js
     * @param {string} texturePath — путь к текстуре тротуара
     * @returns {BABYLON.Mesh} — меш тротуара
     */
    createSidewalkPlane(scene, texturePath) {
        const sidewalkPlane = BABYLON.MeshBuilder.CreateGround('sidewalk', { width: 4, height: 500 }, scene);
        const sidewalkMaterial = new BABYLON.StandardMaterial('sidewalkMat', scene);
        sidewalkMaterial.diffuseTexture = new BABYLON.Texture(texturePath, scene);
        sidewalkMaterial.diffuseTexture.uScale = 20;
        sidewalkMaterial.diffuseTexture.vScale = 20;
        sidewalkPlane.material = sidewalkMaterial;
        return sidewalkPlane;
    }
}
