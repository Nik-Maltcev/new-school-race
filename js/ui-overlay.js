// ui-overlay.js — HTML/CSS оверлей поверх canvas для отображения сценариев

export class UIOverlay {
    /**
     * @param {string} containerId — ID контейнера оверлея в DOM
     * @param {object} eventBus — шина событий для блокировки/разблокировки ввода
     */
    constructor(containerId, eventBus) {
        this.container = document.getElementById(containerId);
        this.eventBus = eventBus;
        this.state = 'hidden'; // hidden | scenario | loading | response | error

        this._choiceCallback = null;
        this._closeCallback = null;
        this._retryCallback = null;

        this._injectStyles();
    }

    /**
     * Отображение сценария: описание ситуации и кнопки выбора
     * @param {string} description — текст описания (до 300 символов)
     * @param {string[]} choices — массив вариантов действий (2-3 элемента)
     */
    showScenario(description, choices) {
        const truncatedDescription = description.slice(0, 300);
        const safeChoices = choices.slice(0, 3);

        let html = `<div class="overlay-panel">`;
        html += `<p class="overlay-description">${this._escapeHtml(truncatedDescription)}</p>`;
        html += `<div class="overlay-choices">`;
        safeChoices.forEach((choice, index) => {
            html += `<button class="overlay-btn overlay-choice-btn" data-index="${index}">${this._escapeHtml(choice)}</button>`;
        });
        html += `</div></div>`;

        this._setContent(html);
        this._show();
        this.state = 'scenario';

        // Привязка обработчиков кнопок выбора
        const buttons = this.container.querySelectorAll('.overlay-choice-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const choiceIndex = parseInt(btn.dataset.index, 10);
                if (this._choiceCallback) {
                    this._choiceCallback(choiceIndex);
                }
                this.eventBus.emit('scenario:choiceMade', { choiceIndex });
            });
        });
    }

    /**
     * Отображение анимированного индикатора загрузки
     */
    showLoading() {
        const html = `<div class="overlay-panel">
            <div class="overlay-loading">
                <div class="overlay-spinner"></div>
                <p class="overlay-loading-text">Ожидание ответа...</p>
            </div>
        </div>`;

        this._setContent(html);
        this._show();
        this.state = 'loading';
    }

    /**
     * Отображение комментария инструктора с кнопкой закрытия
     * @param {string} text — текст ответа (до 500 символов)
     */
    showResponse(text) {
        const truncatedText = text.slice(0, 500);

        const html = `<div class="overlay-panel">
            <p class="overlay-response-text">${this._escapeHtml(truncatedText)}</p>
            <button class="overlay-btn overlay-close-btn">Закрыть</button>
        </div>`;

        this._setContent(html);
        this._show();
        this.state = 'response';

        // Привязка обработчика кнопки закрытия
        const closeBtn = this.container.querySelector('.overlay-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this._closeCallback) {
                    this._closeCallback();
                }
            });
        }
    }

    /**
     * Отображение сообщения об ошибке с опциональной кнопкой повтора
     * @param {string} message — текст ошибки
     * @param {boolean} canRetry — показывать ли кнопку повтора
     */
    showError(message, canRetry) {
        let html = `<div class="overlay-panel overlay-error-panel">
            <p class="overlay-error-text">${this._escapeHtml(message)}</p>`;

        if (canRetry) {
            html += `<button class="overlay-btn overlay-retry-btn">Повторить</button>`;
        } else {
            html += `<button class="overlay-btn overlay-close-btn">Закрыть</button>`;
        }

        html += `</div>`;

        this._setContent(html);
        this._show();
        this.state = 'error';

        // Привязка обработчика кнопки повтора
        const retryBtn = this.container.querySelector('.overlay-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (this._retryCallback) {
                    this._retryCallback();
                }
            });
        }

        // Привязка обработчика кнопки закрытия (если нет повтора)
        const closeBtn = this.container.querySelector('.overlay-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this._closeCallback) {
                    this._closeCallback();
                }
            });
        }
    }

    /**
     * Скрытие оверлея и разблокировка ввода
     */
    hide() {
        this.container.innerHTML = '';
        this.container.classList.remove('active');
        this.state = 'hidden';
        this.eventBus.emit('input:unblocked');
    }

    /**
     * Регистрация обработчика выбора варианта
     * @param {Function} callback — функция, вызываемая с индексом выбора
     */
    onChoice(callback) {
        this._choiceCallback = callback;
    }

    /**
     * Регистрация обработчика закрытия оверлея
     * @param {Function} callback — функция, вызываемая при закрытии
     */
    onClose(callback) {
        this._closeCallback = callback;
    }

    /**
     * Регистрация обработчика повторной попытки
     * @param {Function} callback — функция, вызываемая при нажатии «Повторить»
     */
    onRetry(callback) {
        this._retryCallback = callback;
    }

    // --- Приватные методы ---

    /**
     * Установка HTML-содержимого контейнера
     */
    _setContent(html) {
        this.container.innerHTML = html;
    }

    /**
     * Показать оверлей и заблокировать ввод
     */
    _show() {
        this.container.classList.add('active');
        this.eventBus.emit('input:blocked');
    }

    /**
     * Экранирование HTML-символов для безопасного отображения текста
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Внедрение CSS-стилей для оверлея
     */
    _injectStyles() {
        if (document.getElementById('ui-overlay-styles')) return;

        const style = document.createElement('style');
        style.id = 'ui-overlay-styles';
        style.textContent = `
            .overlay-panel {
                background: rgba(0, 0, 0, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 32px;
                max-width: 500px;
                width: 90%;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }

            .overlay-description {
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 24px;
                color: #e0e0e0;
            }

            .overlay-choices {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .overlay-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s, transform 0.1s;
            }

            .overlay-btn:hover {
                transform: scale(1.02);
            }

            .overlay-btn:active {
                transform: scale(0.98);
            }

            .overlay-choice-btn {
                background: #2563eb;
                color: #fff;
            }

            .overlay-choice-btn:hover {
                background: #1d4ed8;
            }

            .overlay-close-btn {
                background: #4b5563;
                color: #fff;
                margin-top: 20px;
            }

            .overlay-close-btn:hover {
                background: #374151;
            }

            .overlay-retry-btn {
                background: #d97706;
                color: #fff;
                margin-top: 20px;
            }

            .overlay-retry-btn:hover {
                background: #b45309;
            }

            .overlay-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            }

            .overlay-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid rgba(255, 255, 255, 0.2);
                border-top-color: #2563eb;
                border-radius: 50%;
                animation: overlay-spin 0.8s linear infinite;
            }

            @keyframes overlay-spin {
                to { transform: rotate(360deg); }
            }

            .overlay-loading-text {
                font-size: 14px;
                color: #9ca3af;
            }

            .overlay-response-text {
                font-size: 15px;
                line-height: 1.6;
                margin-bottom: 8px;
                color: #e0e0e0;
                white-space: pre-wrap;
            }

            .overlay-error-panel {
                border-color: rgba(239, 68, 68, 0.4);
            }

            .overlay-error-text {
                font-size: 15px;
                line-height: 1.5;
                color: #fca5a5;
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}
