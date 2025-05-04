// Получаем URL и ключ Supabase из переменных окружения (переданных через сервер или другим способом)
// ВАЖНО: В реальном приложении не стоит "зашивать" ключи прямо в клиентский код.
// Для простоты примера, мы ожидаем, что эти переменные установлены глобально или переданы.
// Но для этого демо мы их возьмем прямо из .env (что небезопасно для продакшена!)

// Замените на ваши реальные значения, если не используете .env или другой метод передачи
const SUPABASE_URL = 'https://amdbit2774.github.io/admin-panel/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdnVvb25xYmZ5Y2pxeHFrcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMjUzNDEsImV4cCI6MjA2MDkwMTM0MX0.ZZGRkGBRr2TpGKQg4VHEfSwpcRbeEbtXyv6f0SAHiTU';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingDiv = document.getElementById('loading');
    const tableBody = document.getElementById('chat-logs-body');
    const table = document.getElementById('chat-logs-table');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL === 'https://amdbit2774.github.io/admin-panel/') {
        loadingDiv.textContent = 'Ошибка: URL или ключ Supabase не настроены в script.js!';
        console.error('Supabase URL или Anon Key не установлены.');
        return;
    }

    try {
        // Инициализируем клиент Supabase
        const { createClient } = supabase; // Библиотека подключена через CDN
        const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        console.log('Supabase клиент инициализирован');

        // Инициализируем Telegram Web App
        if (window.Telegram && window.Telegram.WebApp) {
            Telegram.WebApp.ready();
            console.log('Telegram Web App готов.');
             Telegram.WebApp.expand(); // Попытка развернуть окно
        } else {
             console.warn('Telegram Web App SDK не найден.');
        }

        // Получаем данные из таблицы 'chat_logs'
        console.log('Запрос данных из chat_logs...');
        const { data, error } = await _supabase
            .from('chat_logs')
            .select('*') // Выбираем все столбцы
            .order('created_at', { ascending: false }) // Сортируем по дате создания (сначала новые)
            .limit(100); // Ограничиваем количество записей для примера

        if (error) {
            throw error; // Перебрасываем ошибку для обработки в catch
        }

        console.log('Данные получены:', data);
        loadingDiv.style.display = 'none'; // Скрываем сообщение о загрузке

        if (data && data.length > 0) {
            table.style.display = 'table'; // Показываем таблицу
            // Заполняем таблицу данными
            data.forEach(log => {
                const row = tableBody.insertRow();
                // Добавляем ячейки в соответствии с заголовками в HTML
                row.insertCell().textContent = log.id;
                row.insertCell().textContent = log.role;
                row.insertCell().textContent = log.content;
                // Преобразуем метаданные (если это JSON) в строку для отображения
                row.insertCell().textContent = log.metadata ? JSON.stringify(log.metadata) : '';
                row.insertCell().textContent = log.created_at ? new Date(log.created_at).toLocaleString() : '';
                // Добавьте или удалите ячейки по необходимости
            });
        } else {
            loadingDiv.textContent = 'Данные не найдены.';
            loadingDiv.style.display = 'block';
             table.style.display = 'none';
        }

    } catch (error) {
        console.error('Ошибка при загрузке данных из Supabase:', error);
        loadingDiv.textContent = `Ошибка загрузки: ${error.message}`;
        loadingDiv.style.display = 'block';
        table.style.display = 'none';
         if (window.Telegram && window.Telegram.WebApp) {
            Telegram.WebApp.showAlert(`Ошибка загрузки данных: ${error.message}`);
        }
    }
}); 