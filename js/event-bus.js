// event-bus.js — Центральная шина событий для слабосвязанного взаимодействия модулей

export const EventBus = {
    _listeners: {},

    /**
     * Подписка на событие
     * @param {string} event — имя события
     * @param {Function} callback — функция-обработчик
     */
    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    },

    /**
     * Отписка от события
     * @param {string} event — имя события
     * @param {Function} callback — функция-обработчик для удаления
     */
    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    },

    /**
     * Отправка события всем подписчикам
     * @param {string} event — имя события
     * @param {*} data — данные события
     */
    emit(event, data) {
        if (!this._listeners[event]) return;
        for (const callback of this._listeners[event]) {
            callback(data);
        }
    }
};
