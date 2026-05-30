const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
    console.error('ОШИБКА: Переменная окружения DEEPSEEK_API_KEY не задана.');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// API-эндпоинт (прокси к Deepseek)
app.post('/api/evaluate', async (req, res) => {
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Deepseek API error: ${response.statusText}`
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(502).json({
            error: `Proxy error: ${error.message}`
        });
    }
});

// Раздача статических файлов фронтенда (для деплоя на Render)
const publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath));

// Fallback: отдаём index.html для любых GET-запросов, не попавших в API или статику
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving static files from: ${publicPath}`);
});
