// city-generator.js — Процедурная генерация города с сеткой улиц (grid-based)
// Город как сетка перекрёстков, между ними — прямые участки дороги.
// На перекрёстке можно свернуть влево/вправо/прямо.

export class CityGenerator {
    constructor(scene, modelsPath, texturesPath) {
        this._scene = scene;
        this._modelsPath = modelsPath;
        this._texturesPath = texturesPath;
        this._seed = Date.now() % 100000;
        this._intersections = [];
        this._roads = [];
        this._trafficLights = [];
        this._buildings = [];
    }

    /**
     * Псевдослучайное число (0..1)
     */
    _random() {
        this._seed = (this._seed * 9301 + 49297) % 233280;
        return this._seed / 233280;
    }

    _randomRange(min, max) {
        return min + this._random() * (max - min);
    }

    _randomInt(min, max) {
        return Math.floor(this._randomRange(min, max + 1));
    }

    /**
     * Генерация города
     * @param {object} options
     * @param {number} options.gridSizeX — количество перекрёстков по X (по умолчанию 8)
     * @param {number} options.gridSizeZ — количество перекрёстков по Z (по умолчанию 12)
     * @param {number} options.blockSize — расстояние между перекрёстками (по умолчанию 80-150, рандом)
     * @param {number} options.roadWidth — ширина дороги (по умолчанию 10)
     * @param {number} options.lanes — количество полос в каждом направлении (по умолчанию 2)
     */
    async generate(options = {}) {
        const {
            gridSizeX = 8,
            gridSizeZ = 12,
            minBlockSize = 80,
            maxBlockSize = 150,
            roadWidth = 10,
            lanes = 2,
            trafficLightChance = 0.6,
        } = options;

        // 1. Генерация сетки перекрёстков с рандомными расстояниями
        const xPositions = [0];
        for (let i = 1; i < gridSizeX; i++) {
            xPositions.push(xPositions[i - 1] + this._randomRange(minBlockSize, maxBlockSize));
        }

        const zPositions = [0];
        for (let i = 1; i < gridSizeZ; i++) {
            zPositions.push(zPositions[i - 1] + this._randomRange(minBlockSize, maxBlockSize));
        }

        // Центрируем город вокруг (0, 0)
        const centerX = xPositions[Math.floor(gridSizeX / 2)];
        const centerZ = zPositions[Math.floor(gridSizeZ / 2)];
        const xPos = xPositions.map(x => x - centerX);
        const zPos = zPositions.map(z => z - centerZ);

        // 2. Создание перекрёстков
        for (let ix = 0; ix < gridSizeX; ix++) {
            for (let iz = 0; iz < gridSizeZ; iz++) {
                const intersection = {
                    id: `int_${ix}_${iz}`,
                    gridX: ix,
                    gridZ: iz,
                    x: xPos[ix],
                    z: zPos[iz],
                    hasTrafficLight: this._random() < trafficLightChance,
                    // Какие дороги подключены (убираем рандомно некоторые для разнообразия)
                    connectNorth: iz < gridSizeZ - 1,
                    connectSouth: iz > 0,
                    connectEast: ix < gridSizeX - 1,
                    connectWest: ix > 0,
                };

                // Рандомно убираем некоторые соединения (но не все!) для разнообразия
                if (this._random() < 0.15 && ix > 0 && ix < gridSizeX - 1) {
                    if (this._random() > 0.5) intersection.connectEast = false;
                    else intersection.connectWest = false;
                }
                if (this._random() < 0.15 && iz > 0 && iz < gridSizeZ - 1) {
                    if (this._random() > 0.5) intersection.connectNorth = false;
                    else intersection.connectSouth = false;
                }

                this._intersections.push(intersection);
            }
        }

        // 3. Создание дорог между перекрёстками
        // Горизонтальные дороги (по X)
        for (let iz = 0; iz < gridSizeZ; iz++) {
            for (let ix = 0; ix < gridSizeX - 1; ix++) {
                const from = this._getIntersection(ix, iz);
                const to = this._getIntersection(ix + 1, iz);
                if (from.connectEast && to.connectWest) {
                    this._roads.push({
                        from: from,
                        to: to,
                        direction: 'horizontal',
                        x1: from.x,
                        x2: to.x,
                        z: from.z,
                        length: to.x - from.x,
                    });
                }
            }
        }

        // Вертикальные дороги (по Z)
        for (let ix = 0; ix < gridSizeX; ix++) {
            for (let iz = 0; iz < gridSizeZ - 1; iz++) {
                const from = this._getIntersection(ix, iz);
                const to = this._getIntersection(ix, iz + 1);
                if (from.connectNorth && to.connectSouth) {
                    this._roads.push({
                        from: from,
                        to: to,
                        direction: 'vertical',
                        x: from.x,
                        z1: from.z,
                        z2: to.z,
                        length: to.z - from.z,
                    });
                }
            }
        }

        // 4. Построение мешей
        const roadTexture = this._texturesPath + 'T_Concrete_Asphalt_BaseColor.png';
        const roadNormal = this._texturesPath + 'T_Concrete_Normal.png';
        const sidewalkTexture = this._texturesPath + 'T_Concrete_BaseColor.png';

        this._buildRoads(roadTexture, roadNormal, roadWidth);
        this._buildIntersections(roadTexture, roadNormal, roadWidth);
        this._buildSidewalks(sidewalkTexture, roadWidth);
        this._placeTrafficLights();
        this._placeRoadMarkings(roadWidth, lanes);
        await this._placeBuildings(xPos, zPos, roadWidth);

        // Освещение и атмосфера
        this._setupLighting();

        return {
            gridSizeX,
            gridSizeZ,
            intersectionCount: this._intersections.length,
            roadCount: this._roads.length,
            trafficLightCount: this._trafficLights.length,
            bounds: {
                minX: xPos[0] - 50,
                maxX: xPos[gridSizeX - 1] + 50,
                minZ: zPos[0] - 50,
                maxZ: zPos[gridSizeZ - 1] + 50,
            }
        };
    }

    _getIntersection(ix, iz) {
        return this._intersections.find(i => i.gridX === ix && i.gridZ === iz);
    }

    /**
     * Построение дорожных сегментов
     */
    _buildRoads(texturePath, normalPath, width) {
        for (const road of this._roads) {
            let roadMesh;
            if (road.direction === 'horizontal') {
                roadMesh = BABYLON.MeshBuilder.CreateGround(`road_h_${road.from.id}_${road.to.id}`, {
                    width: road.length,
                    height: width
                }, this._scene);
                roadMesh.position.x = (road.x1 + road.x2) / 2;
                roadMesh.position.z = road.z;
            } else {
                roadMesh = BABYLON.MeshBuilder.CreateGround(`road_v_${road.from.id}_${road.to.id}`, {
                    width: width,
                    height: road.length
                }, this._scene);
                roadMesh.position.x = road.x;
                roadMesh.position.z = (road.z1 + road.z2) / 2;
            }

            const mat = new BABYLON.StandardMaterial(`roadMat_${road.from.id}`, this._scene);
            mat.diffuseTexture = new BABYLON.Texture(texturePath, this._scene);
            mat.bumpTexture = new BABYLON.Texture(normalPath, this._scene);

            const len = road.length;
            if (road.direction === 'horizontal') {
                mat.diffuseTexture.uScale = len / 5;
                mat.diffuseTexture.vScale = 2;
                mat.bumpTexture.uScale = len / 5;
                mat.bumpTexture.vScale = 2;
            } else {
                mat.diffuseTexture.uScale = 2;
                mat.diffuseTexture.vScale = len / 5;
                mat.bumpTexture.uScale = 2;
                mat.bumpTexture.vScale = len / 5;
            }
            mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            roadMesh.material = mat;
        }
    }

    /**
     * Построение площадок перекрёстков
     */
    _buildIntersections(texturePath, normalPath, width) {
        for (const inter of this._intersections) {
            const size = width + 4; // Чуть больше ширины дороги
            const mesh = BABYLON.MeshBuilder.CreateGround(`intersection_${inter.id}`, {
                width: size,
                height: size
            }, this._scene);
            mesh.position.x = inter.x;
            mesh.position.z = inter.z;
            mesh.position.y = 0.001; // Чуть выше чтобы не z-fight

            const mat = new BABYLON.StandardMaterial(`intMat_${inter.id}`, this._scene);
            mat.diffuseTexture = new BABYLON.Texture(texturePath, this._scene);
            mat.diffuseTexture.uScale = 2;
            mat.diffuseTexture.vScale = 2;
            mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            mesh.material = mat;
        }
    }

    /**
     * Тротуары вдоль дорог
     */
    _buildSidewalks(texturePath, roadWidth) {
        const swWidth = 3;
        const halfRoad = roadWidth / 2;

        for (const road of this._roads) {
            for (const side of [-1, 1]) {
                let sw;
                if (road.direction === 'horizontal') {
                    sw = BABYLON.MeshBuilder.CreateGround(`sw_${road.from.id}_${side}`, {
                        width: road.length,
                        height: swWidth
                    }, this._scene);
                    sw.position.x = (road.x1 + road.x2) / 2;
                    sw.position.z = road.z + side * (halfRoad + swWidth / 2);
                } else {
                    sw = BABYLON.MeshBuilder.CreateGround(`sw_${road.from.id}_${side}v`, {
                        width: swWidth,
                        height: road.length
                    }, this._scene);
                    sw.position.x = road.x + side * (halfRoad + swWidth / 2);
                    sw.position.z = (road.z1 + road.z2) / 2;
                }
                sw.position.y = 0.08;

                const mat = new BABYLON.StandardMaterial(`swMat_${road.from.id}_${side}`, this._scene);
                mat.diffuseTexture = new BABYLON.Texture(texturePath, this._scene);
                const len = road.length;
                if (road.direction === 'horizontal') {
                    mat.diffuseTexture.uScale = len / 4;
                    mat.diffuseTexture.vScale = 1;
                } else {
                    mat.diffuseTexture.uScale = 1;
                    mat.diffuseTexture.vScale = len / 4;
                }
                mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
                sw.material = mat;
            }
        }
    }

    /**
     * Светофоры на перекрёстках
     */
    _placeTrafficLights() {
        for (const inter of this._intersections) {
            if (!inter.hasTrafficLight) continue;

            // Ставим светофоры по углам перекрёстка
            const positions = [
                { x: inter.x + 5.5, z: inter.z + 5.5 },
                { x: inter.x - 5.5, z: inter.z - 5.5 },
            ];

            for (const pos of positions) {
                const tl = this._createTrafficLight(`tl_${inter.id}_${pos.x}`, pos.x, pos.z);
                this._trafficLights.push(tl);
            }
        }
    }

    /**
     * Создание светофора из примитивов
     */
    _createTrafficLight(name, x, z) {
        const pole = BABYLON.MeshBuilder.CreateCylinder(`${name}_pole`, {
            height: 5, diameter: 0.12
        }, this._scene);
        pole.position = new BABYLON.Vector3(x, 2.5, z);
        const poleMat = new BABYLON.StandardMaterial(`${name}_pm`, this._scene);
        poleMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.25);
        pole.material = poleMat;

        const body = BABYLON.MeshBuilder.CreateBox(`${name}_body`, {
            width: 0.4, height: 1.2, depth: 0.3
        }, this._scene);
        body.position = new BABYLON.Vector3(x, 5.3, z);
        const bodyMat = new BABYLON.StandardMaterial(`${name}_bm`, this._scene);
        bodyMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        body.material = bodyMat;

        const lightConfigs = [
            { color: new BABYLON.Color3(1, 0.1, 0.1), y: 5.65 },
            { color: new BABYLON.Color3(1, 0.85, 0), y: 5.3 },
            { color: new BABYLON.Color3(0.1, 1, 0.1), y: 4.95 },
        ];

        const activeIdx = Math.floor(this._random() * 3);
        const lights = lightConfigs.map((cfg, i) => {
            const l = BABYLON.MeshBuilder.CreateSphere(`${name}_l${i}`, { diameter: 0.18 }, this._scene);
            l.position = new BABYLON.Vector3(x, cfg.y, z + 0.16);
            const m = new BABYLON.StandardMaterial(`${name}_lm${i}`, this._scene);
            if (i === activeIdx) {
                m.diffuseColor = cfg.color;
                m.emissiveColor = cfg.color.scale(0.4);
            } else {
                m.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.08);
            }
            l.material = m;
            return l;
        });

        return { pole, body, lights, x, z, activeIdx };
    }

    /**
     * Дорожная разметка (только центральная линия на длинных сегментах)
     */
    _placeRoadMarkings(roadWidth, lanes) {
        // Только сплошные линии на краях дороги — минимум мешей
        for (const road of this._roads) {
            if (road.length < 50) continue; // Пропускаем короткие

            const line = BABYLON.MeshBuilder.CreateGround(`line_${road.from.id}`, {
                width: road.direction === 'horizontal' ? road.length - 10 : 0.12,
                height: road.direction === 'horizontal' ? 0.12 : road.length - 10
            }, this._scene);

            if (road.direction === 'horizontal') {
                line.position.x = (road.x1 + road.x2) / 2;
                line.position.z = road.z;
            } else {
                line.position.x = road.x;
                line.position.z = (road.z1 + road.z2) / 2;
            }
            line.position.y = 0.02;

            const mat = new BABYLON.StandardMaterial(`lineMat_${road.from.id}`, this._scene);
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.1);
            mat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0);
            line.material = mat;
        }
    }

    /**
     * Размещение зданий в блоках между улицами
     */
    async _placeBuildings(xPositions, zPositions, roadWidth) {
        const buildingFiles = ['Building_Small_1.gltf', 'Building_Medium_2_001.gltf', 'Building_Large_2.gltf'];
        const loadedBuildings = [];

        for (const file of buildingFiles) {
            try {
                const result = await BABYLON.SceneLoader.ImportMeshAsync('', this._modelsPath, file, this._scene);
                const mesh = result.meshes[0];
                mesh.setEnabled(false);
                loadedBuildings.push(mesh);
            } catch (e) {
                console.warn(`Не удалось загрузить ${file}:`, e.message);
            }
        }

        if (loadedBuildings.length === 0) return;

        const margin = roadWidth / 2 + 5; // Отступ от центра дороги

        // Размещаем здания в каждом блоке (между 4 перекрёстками)
        for (let ix = 0; ix < xPositions.length - 1; ix++) {
            for (let iz = 0; iz < zPositions.length - 1; iz++) {
                const blockMinX = xPositions[ix] + margin;
                const blockMaxX = xPositions[ix + 1] - margin;
                const blockMinZ = zPositions[iz] + margin;
                const blockMaxZ = zPositions[iz + 1] - margin;

                if (blockMaxX - blockMinX < 15 || blockMaxZ - blockMinZ < 15) continue;

                // Размещаем 1-3 здания в блоке
                const buildingCount = this._randomInt(1, 3);
                for (let b = 0; b < buildingCount; b++) {
                    const bType = Math.floor(this._random() * loadedBuildings.length);
                    const clone = loadedBuildings[bType].clone(`bld_${ix}_${iz}_${b}`);
                    clone.setEnabled(true);

                    const bx = this._randomRange(blockMinX, blockMaxX);
                    const bz = this._randomRange(blockMinZ, blockMaxZ);
                    clone.position = new BABYLON.Vector3(bx, 0, bz);

                    const rot = Math.floor(this._random() * 4) * (Math.PI / 2);
                    clone.rotation = new BABYLON.Vector3(0, rot, 0);

                    const scale = 0.7 + this._random() * 0.6;
                    clone.scaling = new BABYLON.Vector3(scale, scale, scale);

                    this._buildings.push(clone);
                }
            }
        }
    }

    /**
     * Освещение и атмосфера
     */
    _setupLighting() {
        const scene = this._scene;

        const hemi = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.6;
        hemi.groundColor = new BABYLON.Color3(0.3, 0.3, 0.35);

        const dir = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-0.5, -1, 0.5), scene);
        dir.intensity = 0.7;
        dir.diffuse = new BABYLON.Color3(1, 0.95, 0.85);

        scene.clearColor = new BABYLON.Color4(0.55, 0.8, 0.95, 1);

        // Туман
        scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
        scene.fogColor = new BABYLON.Color3(0.55, 0.8, 0.95);
        scene.fogStart = 200;
        scene.fogEnd = 500;
    }

    /**
     * Получить границы города для ограничения движения
     */
    getBounds() {
        if (this._intersections.length === 0) return { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
        const xs = this._intersections.map(i => i.x);
        const zs = this._intersections.map(i => i.z);
        return {
            minX: Math.min(...xs) - 30,
            maxX: Math.max(...xs) + 30,
            minZ: Math.min(...zs) - 30,
            maxZ: Math.max(...zs) + 30,
        };
    }

    /**
     * Получить ближайший перекрёсток к позиции
     */
    getNearestIntersection(x, z) {
        let nearest = null;
        let minDist = Infinity;
        for (const inter of this._intersections) {
            const dx = inter.x - x;
            const dz = inter.z - z;
            const dist = dx * dx + dz * dz;
            if (dist < minDist) {
                minDist = dist;
                nearest = inter;
            }
        }
        return nearest;
    }
}
