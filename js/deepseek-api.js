// deepseek-api.js — Интеграция с Deepseek API через локальный прокси-сервер

const API_CONFIG = {
    endpoint: '/api/evaluate',
    timeout: 30000,              // 30 секунд
    maxRetries: 1,               // Одна повторная попытка
    maxResponseLength: 2000,     // Максимальная длина ответа
    systemPrompt: 'Вы — опытный инструктор по вождению. Оцените выбор ученика с точки зрения безопасности дорожного движения. Дайте краткий, конструктивный комментарий.'
};

export class DeepseekAPI {
    /**
     * @param {object} [config] — переопределение конфигурации по умолчанию
     */
    constructor(config = {}) {
        this.config = { ...API_CONFIG, ...config };
        this._abortController = null;
    }

    /**
     * Отправка запроса на оценку выбора игрока
     * @param {string} scenarioDescription — описание сценария
     * @param {string} playerChoice — выбранное действие игрока
     * @returns {Promise<string>} — текст комментария инструктора (до 2000 символов)
     */
    async evaluate(scenarioDescription, playerChoice) {
        const userMessage = `Ситуация: ${scenarioDescription}\nВыбор ученика: ${playerChoice}`;

        const requestBody = {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: this.config.systemPrompt },
                { role: 'user', content: userMessage }
            ],
            max_tokens: 500,
            temperature: 0.7
        };

        let lastError = null;
        const maxAttempts = 1 + this.config.maxRetries; // 1 попытка + 1 повтор

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const responseText = await this._sendRequest(requestBody);
                return responseText;
            } catch (error) {
                lastError = error;
                // Если запрос был отменён вручную через abort(), не повторяем
                if (error.name === 'ManualAbort') {
                    throw error;
                }
                // Продолжаем к следующей попытке (если есть)
            }
        }

        // Все попытки исчерпаны
        throw lastError;
    }

    /**
     * Отмена текущего запроса через AbortController
     */
    abort() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    /**
     * Отправка одного запроса с таймаутом
     * @param {object} requestBody — тело запроса
     * @returns {Promise<string>} — текст ответа
     * @private
     */
    async _sendRequest(requestBody) {
        this._abortController = new AbortController();
        const { signal } = this._abortController;

        // Таймаут через AbortController
        const timeoutId = setTimeout(() => {
            this._abortController.abort();
        }, this.config.timeout);

        try {
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = this._extractResponseText(data);
            return this._truncateResponse(text);
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                // Определяем, был ли это таймаут или ручная отмена
                if (signal.aborted) {
                    const timeoutError = new Error('Превышено время ожидания ответа (30 секунд)');
                    timeoutError.name = 'TimeoutError';
                    throw timeoutError;
                }
            }

            throw error;
        } finally {
            this._abortController = null;
        }
    }

    /**
     * Извлечение текста ответа из JSON
     * @param {object} data — ответ API
     * @returns {string}
     * @private
     */
    _extractResponseText(data) {
        if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
            return data.choices[0].message.content || '';
        }
        return '';
    }

    /**
     * Ограничение длины ответа до maxResponseLength символов
     * @param {string} text — исходный текст
     * @returns {string} — текст, обрезанный до 2000 символов
     * @private
     */
    _truncateResponse(text) {
        if (text.length > this.config.maxResponseLength) {
            return text.substring(0, this.config.maxResponseLength);
        }
        return text;
    }
}
