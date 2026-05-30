// city-generator.js — Процедурная генерация города с поворотами, перекрёстками и светофорами

export class CityGenerator {
    constructor(scene, modelsPath, texturesPath) {
        this._scene = scene;
        this._modelsPath = modelsPath;
        this._texturesPath = texturesPath;
        this._segments = [];
        this._trafficLights = [];
        this._buildings = [];
        this._seed = Math.random() * 10000;
    }

    /**
     * Псевдослучайное число на основе seed (детерминированное для одной сессии)
     */
    _random() {
        this._seed = (this._seed * 9301 + 49297) % 233280;
        return this._seed / 233280;
    }

    /**
     * Генерация города длиной totalLength метров
     * @param {number} totalLength — общая длина маршрута (по умолчанию 10000)
     * @param {object} options — настройки генерации
     */
    async generate(totalLength = 10000, options = {}) {
        const {
            roadWidth = 10,
            sidewalkWidth = 4,
            buildingOffset = 15,
            minSegmentLength = 80,
            maxSegmentLength = 200,
            turnChance = 0.25,
            intersectionChance = 0.15,
            trafficLightChance = 0.4,
        } = options;

        const roadTexture = this._texturesPath + 'T_Concrete_Asphalt_BaseColor.png';
        const sidewalkTexture = this._texturesPath + 'T_Concrete_BaseColor.png';

        // Генерация сегментов дороги
        let currentZ = 0;
        let segmentIndex = 0;

        while (currentZ < totalLength) {
            const segLength = minSegmentLength + this._random() * (maxSegmentLength - minSegmentLength);
            const actualLength = Math.min(segLength, totalLength - currentZ);

            const segment = {
                index: segmentIndex,
                startZ: currentZ,
                length: actualLength,
                type: 'straight', // straight, intersection
                hasTurn: false,
                turnDirection: null,
                hasTrafficLight: false,
            };

            // Решаем тип сегмента
            if (segmentIndex > 0 && this._random() < intersectionChance) {
                segment.type = 'intersection';
                segment.hasTrafficLight = this._random() < trafficLightChance;
            } else if (segmentIndex > 0 && this._random() < turnChance) {
                segment.hasTurn = true;
                segment.turnDirection = this._random() > 0.5 ? 'left' : 'right';
            }

            // Светофор на обычном сегменте (не перекрёсток)
            if (segment.type === 'straight' && !segment.hasTrafficLight && this._random() < 0.2) {
                segment.hasTrafficLight = true;
            }

            this._segments.push(segment);
            currentZ += actualLength;
            segmentIndex++;
        }

        // Создание мешей
        await this._buildRoad(roadTexture, roadWidth, totalLength);
        await this._buildSidewalks(sidewalkTexture, sidewalkWidth, totalLength);
        await this._placeBuildings(buildingOffset, totalLength);
        this._placeTrafficLights();
        this._placeIntersectionMarkings();

        return {
            totalLength,
            segmentCount: this._segments.length,
            trafficLightCount: this._trafficLights.length,
            segments: this._segments,
        };
    }

    /**
     * Создание дорожного полотна
     */
    async _buildRoad(texturePath, width, length) {
        const road = BABYLON.MeshBuilder.CreateGround('road_main', {
            width: width,
            height: length
        }, this._scene);

        const mat = new BABYLON.StandardMaterial('roadMat', this._scene);
        mat.diffuseTexture = new BABYLON.Texture(texturePath, this._scene);
        mat.diffuseTexture.uScale = 2;
        mat.diffuseTexture.vScale = length / 5;
        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        road.material = mat;
        road.position.z = length / 2;

        // Разделительная полоса (жёлтая линия по центру)
        const divider = BABYLON.MeshBuilder.CreateGround('divider', {
            width: 0.15,
            height: length
        }, this._scene);
        const divMat = new BABYLON.StandardMaterial('divMat', this._scene);
        divMat.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.1);
        divMat.emissiveColor = new BABYLON.Color3(0.2, 0.18, 0);
        divider.material = divMat;
        divider.position.y = 0.01;
        divider.position.z = length / 2;
    }

    /**
     * Создание тротуаров
     */
    async _buildSidewalks(texturePath, width, length) {
        for (const side of [-1, 1]) {
            const sw = BABYLON.MeshBuilder.CreateGround(`sidewalk_${side > 0 ? 'R' : 'L'}`, {
                width: width,
                height: length
            }, this._scene);

            const mat = new BABYLON.StandardMaterial(`swMat_${side}`, this._scene);
            mat.diffuseTexture = new BABYLON.Texture(texturePath, this._scene);
            mat.diffuseTexture.uScale = 4;
            mat.diffuseTexture.vScale = length / 5;
            mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            sw.material = mat;
            sw.position.x = side * 7;
            sw.position.y = 0.05; // Чуть выше дороги
            sw.position.z = length / 2;
        }
    }

    /**
     * Размещение зданий с рандомизацией
     */
    async _placeBuildings(offset, totalLength) {
        // Загрузка разных моделей зданий
        const buildingFiles = ['Building_Small_1.gltf', 'Building_Medium_2_001.gltf', 'Building_Large_2.gltf'];
        const loadedBuildings = [];

        for (const file of buildingFiles) {
            try {
                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    '', this._modelsPath, file, this._scene
                );
                const mesh = result.meshes[0];
                mesh.setEnabled(false);
                loadedBuildings.push(mesh);
            } catch (e) {
                console.warn(`Не удалось загрузить ${file}:`, e.message);
            }
        }

        if (loadedBuildings.length === 0) return;

        // Размещение зданий вдоль дороги с рандомным интервалом и типом
        const minSpacing = 25;
        const maxSpacing = 60;

        for (const side of [-1, 1]) {
            let z = 20;
            let buildingIdx = 0;

            while (z < totalLength - 20) {
                const spacing = minSpacing + this._random() * (maxSpacing - minSpacing);
                const buildingType = Math.floor(this._random() * loadedBuildings.length);
                const building = loadedBuildings[buildingType];

                const clone = building.clone(`building_${side}_${buildingIdx}`);
                clone.setEnabled(true);

                // Рандомное смещение от дороги
                const xOffset = offset + this._random() * 5;
                clone.position = new BABYLON.Vector3(
                    side * xOffset,
                    0,
                    z
                );

                // Рандомный поворот (лицом к дороге + небольшое отклонение)
                const baseRotation = side === 1 ? Math.PI : 0;
                const randomRotation = (this._random() - 0.5) * 0.2;
                clone.rotation = new BABYLON.Vector3(0, baseRotation + randomRotation, 0);

                // Рандомный масштаб
                const scale = 0.8 + this._random() * 0.5;
                clone.scaling = new BABYLON.Vector3(scale, scale, scale);

                this._buildings.push(clone);
                z += spacing;
                buildingIdx++;
            }
        }
    }

    /**
     * Размещение светофоров (из примитивов)
     */
    _placeTrafficLights() {
        for (const segment of this._segments) {
            if (!segment.hasTrafficLight) continue;

            const z = segment.startZ + segment.length * 0.8;

            for (const side of [-1, 1]) {
                const trafficLight = this._createTrafficLight(
                    `tl_${segment.index}_${side}`,
                    side * 5.5,
                    z
                );
                this._trafficLights.push(trafficLight);
            }
        }
    }

    /**
     * Создание светофора из примитивов
     */
    _createTrafficLight(name, x, z) {
        // Столб
        const pole = BABYLON.MeshBuilder.CreateCylinder(`${name}_pole`, {
            height: 4,
            diameter: 0.15
        }, this._scene);
        pole.position = new BABYLON.Vector3(x, 2, z);

        const poleMat = new BABYLON.StandardMaterial(`${name}_poleMat`, this._scene);
        poleMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        pole.material = poleMat;

        // Корпус светофора
        const body = BABYLON.MeshBuilder.CreateBox(`${name}_body`, {
            width: 0.4,
            height: 1.0,
            depth: 0.3
        }, this._scene);
        body.position = new BABYLON.Vector3(x, 4.2, z);

        const bodyMat = new BABYLON.StandardMaterial(`${name}_bodyMat`, this._scene);
        bodyMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        body.material = bodyMat;

        // Огни (красный, жёлтый, зелёный)
        const colors = [
            { color: new BABYLON.Color3(1, 0.1, 0.1), emissive: new BABYLON.Color3(0.5, 0, 0), y: 4.5 },
            { color: new BABYLON.Color3(1, 0.8, 0), emissive: new BABYLON.Color3(0.3, 0.2, 0), y: 4.2 },
            { color: new BABYLON.Color3(0.1, 1, 0.1), emissive: new BABYLON.Color3(0, 0.3, 0), y: 3.9 },
        ];

        // Рандомно выбираем какой горит
        const activeLight = Math.floor(this._random() * 3);

        const lights = colors.map((cfg, i) => {
            const light = BABYLON.MeshBuilder.CreateSphere(`${name}_light_${i}`, {
                diameter: 0.2
            }, this._scene);
            light.position = new BABYLON.Vector3(x, cfg.y, z + 0.16);

            const mat = new BABYLON.StandardMaterial(`${name}_lightMat_${i}`, this._scene);
            if (i === activeLight) {
                mat.diffuseColor = cfg.color;
                mat.emissiveColor = cfg.emissive;
            } else {
                mat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            }
            light.material = mat;
            return light;
        });

        return { pole, body, lights, position: { x, z }, activeLight };
    }

    /**
     * Разметка перекрёстков (пешеходные переходы)
     */
    _placeIntersectionMarkings() {
        for (const segment of this._segments) {
            if (segment.type !== 'intersection') continue;

            const z = segment.startZ + segment.length * 0.5;

            // Пешеходный переход (белые полосы)
            for (let i = 0; i < 6; i++) {
                const stripe = BABYLON.MeshBuilder.CreateGround(`crosswalk_${segment.index}_${i}`, {
                    width: 0.5,
                    height: 3
                }, this._scene);

                const mat = new BABYLON.StandardMaterial(`cwMat_${segment.index}_${i}`, this._scene);
                mat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
                mat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                stripe.material = mat;

                stripe.position = new BABYLON.Vector3(
                    -2.5 + i * 1.0,
                    0.02,
                    z
                );
                stripe.rotation.y = Math.PI / 2;
            }

            // Стоп-линия
            const stopLine = BABYLON.MeshBuilder.CreateGround(`stopline_${segment.index}`, {
                width: 5,
                height: 0.3
            }, this._scene);
            const slMat = new BABYLON.StandardMaterial(`slMat_${segment.index}`, this._scene);
            slMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
            stopLine.material = slMat;
            stopLine.position = new BABYLON.Vector3(0, 0.02, z - 5);
        }
    }

    /**
     * Получить сегменты для системы сценариев
     */
    getSegments() {
        return this._segments;
    }

    /**
     * Получить позиции светофоров
     */
    getTrafficLights() {
        return this._trafficLights;
    }

    /**
     * Общая длина маршрута
     */
    getTotalLength() {
        if (this._segments.length === 0) return 0;
        const last = this._segments[this._segments.length - 1];
        return last.startZ + last.length;
    }
}
