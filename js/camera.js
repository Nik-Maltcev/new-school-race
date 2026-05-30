// camera.js — Камера от первого лица, привязанная к позиции водителя

export class DriverCamera {
    /**
     * @param {BABYLON.Scene} scene — сцена Babylon.js
     * @param {{ x: number, y: number, z: number }} [offset] — смещение от центра авто (позиция водителя)
     */
    constructor(scene, offset) {
        this._scene = scene;
        this._offset = offset || { x: -0.3, y: 1.2, z: 0.5 };
        this._carMesh = null;

        // Создание UniversalCamera с FOV 70° (вертикальный)
        this._camera = new BABYLON.UniversalCamera(
            'driverCamera',
            new BABYLON.Vector3(0, this._offset.y, 0),
            scene
        );

        // Установка вертикального FOV: 70° в радианах
        this._camera.fov = 70 * Math.PI / 180;

        // Отключение свободного вращения камеры (без ввода мыши/тач)
        this._camera.inputs.clear();

        // Назначение активной камерой сцены
        scene.activeCamera = this._camera;
    }

    /**
     * Привязка камеры к мешу автомобиля
     * @param {BABYLON.Mesh} carMesh — меш автомобиля
     */
    attachToCar(carMesh) {
        this._carMesh = carMesh;
    }

    /**
     * Обновление позиции и ориентации камеры каждый кадр
     * @param {{ x: number, y: number, z: number }} carPosition — текущая позиция автомобиля
     * @param {number} carRotation — текущий угол поворота автомобиля (радианы)
     */
    update(carPosition, carRotation) {
        // Вычисление смещения, повёрнутого на угол автомобиля
        const cosR = Math.cos(carRotation);
        const sinR = Math.sin(carRotation);

        // Поворот смещения вокруг оси Y
        const rotatedOffsetX = this._offset.x * cosR + this._offset.z * sinR;
        const rotatedOffsetZ = -this._offset.x * sinR + this._offset.z * cosR;

        // Позиция камеры = позиция авто + повёрнутое смещение
        const camX = carPosition.x + rotatedOffsetX;
        const camY = carPosition.y + this._offset.y;
        const camZ = carPosition.z + rotatedOffsetZ;

        this._camera.position.x = camX;
        this._camera.position.y = camY;
        this._camera.position.z = camZ;

        // Цель камеры = позиция камеры + направление вперёд по углу авто
        // Направление вперёд: sin(rotation) по X, cos(rotation) по Z
        const forwardX = Math.sin(carRotation);
        const forwardZ = Math.cos(carRotation);

        this._camera.setTarget(new BABYLON.Vector3(
            camX + forwardX,
            camY,
            camZ + forwardZ
        ));
    }

    /**
     * Возвращает Babylon.js UniversalCamera
     * @returns {BABYLON.UniversalCamera}
     */
    getCamera() {
        return this._camera;
    }
}
