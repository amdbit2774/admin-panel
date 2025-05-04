// Получаем URL и ключ Supabase из переменных окружения (переданных через сервер или другим способом)
// ВАЖНО: В реальном приложении не стоит "зашивать" ключи прямо в клиентский код.
// Для простоты примера, мы ожидаем, что эти переменные установлены глобально или переданы.
// Но для этого демо мы их возьмем прямо из .env (что небезопасно для продакшена!)

// Замените на ваши реальные значения, если не используете .env или другой метод передачи
const SUPABASE_URL = 'https://dovuoonqbfycjqxqkrin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdnVvb25xYmZ5Y2pxeHFrcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMjUzNDEsImV4cCI6MjA2MDkwMTM0MX0.ZZGRkGBRr2TpGKQg4VHEfSwpcRbeEbtXyv6f0SAHiTU';

let allMessages = []; // Хранилище для всех загруженных сообщений
let currentSessionId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Инициализация Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        try {
             Telegram.WebApp.ready();
             Telegram.WebApp.expand();
             console.log('Telegram Web App готов.');
        } catch (e) {
            console.error('Ошибка инициализации Telegram Web App:', e);
        }
    } else {
        console.warn('Telegram Web App SDK не найден.');
    }

    const sessionList = document.getElementById('session-list');
    const chatArea = document.getElementById('chat-area');
    const chatHeader = document.getElementById('chat-header');
    const loadingSessionsLi = sessionList.querySelector('.loading-sessions');

    // --- Инициализация Supabase --- (вынесено для читаемости)
    let _supabase;
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('URL или ключ Supabase не настроены');
        }
        const { createClient } = supabase; // Библиотека подключена через CDN
        _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase клиент инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации Supabase:', error);
        loadingSessionsLi.textContent = `Ошибка: ${error.message}`;
        chatArea.innerHTML = `<div class="no-session-selected">Ошибка инициализации Supabase: ${error.message}</div>`;
        return;
    }

    // --- Загрузка данных --- 
    try {
        console.log('Запрос данных из chat_logs...');
        const { data, error } = await _supabase
            .from('chat_logs')
            // Убедитесь, что выбираете столбцы id, role, content, created_at и metadata
            .select('id, role, content, created_at, metadata')
            .order('created_at', { ascending: true }) // Сортируем СНАЧАЛА СТАРЫЕ для правильного порядка в чате
           // .limit(1000); // Можно увеличить лимит, если нужно больше истории

        if (error) throw error;

        console.log(`Данные получены (${data.length} сообщений)`);
        allMessages = data;

        // --- Обработка и отображение сессий --- 
        const sessions = {}; // Объект для группировки сессий
        allMessages.forEach(msg => {
            // Пытаемся извлечь ID пользователя/сессии из metadata
            // ИЗМЕНИТЕ 'user_id', если ключ в metadata называется иначе!
            const sessionId = msg.metadata?.user_id || msg.metadata?.session_id || 'unknown_session';

            if (!sessions[sessionId]) {
                sessions[sessionId] = { // Сохраняем последнее сообщение для возможной сортировки сессий
                    lastTimestamp: msg.created_at,
                    displayName: sessionId === 'unknown_session' ? 'Неизвестная сессия' : `Сессия ${sessionId}`
                };
            }
             // Обновляем последнее время для сессии, если текущее сообщение новее
             if (new Date(msg.created_at) > new Date(sessions[sessionId].lastTimestamp)) {
                 sessions[sessionId].lastTimestamp = msg.created_at;
             }
        });

        // Очищаем список перед заполнением
        sessionList.innerHTML = '';

        // Сортируем сессии по времени последнего сообщения (сначала новые)
        const sortedSessionIds = Object.keys(sessions).sort((a, b) => {
            return new Date(sessions[b].lastTimestamp) - new Date(sessions[a].lastTimestamp);
        });

        if (sortedSessionIds.length > 0) {
            sortedSessionIds.forEach(sessionId => {
                const li = document.createElement('li');
                li.textContent = sessions[sessionId].displayName;
                li.dataset.sessionId = sessionId; // Сохраняем ID в data-атрибуте
                li.addEventListener('click', () => {
                    // Снимаем выделение со всех
                    sessionList.querySelectorAll('li').forEach(item => item.classList.remove('active'));
                    // Выделяем текущую
                    li.classList.add('active');
                    // Отображаем сообщения для этой сессии
                    displayMessagesForSession(sessionId, chatArea, chatHeader, sessions[sessionId].displayName);
                });
                sessionList.appendChild(li);
            });
            // Отображаем сообщение по умолчанию
             chatArea.innerHTML = '<div class="no-session-selected">Выберите сессию для просмотра сообщений.</div>';

        } else {
            sessionList.innerHTML = '<li class="loading-sessions">Сессии не найдены</li>';
             chatArea.innerHTML = '<div class="no-session-selected">Нет данных для отображения.</div>';
        }

    } catch (error) {
        console.error('Ошибка при загрузке или обработке данных:', error);
        sessionList.innerHTML = `<li class="loading-sessions">Ошибка загрузки</li>`;
        chatArea.innerHTML = `<div class="no-session-selected">Ошибка загрузки данных: ${error.message}</div>`;
         if (window.Telegram && window.Telegram.WebApp) {
            Telegram.WebApp.showAlert(`Ошибка загрузки данных: ${error.message}`);
        }
    }
});

// --- Функция отображения сообщений для выбранной сессии ---
function displayMessagesForSession(sessionId, chatAreaElement, chatHeaderElement, sessionDisplayName) {
    currentSessionId = sessionId;
    chatHeaderElement.textContent = sessionDisplayName; // Обновляем заголовок чата
    chatAreaElement.innerHTML = ''; // Очищаем область чата

    const messagesForSession = allMessages.filter(msg => {
        // Фильтруем по тому же ключу, что использовали для группировки
         const msgSessionId = msg.metadata?.user_id || msg.metadata?.session_id || 'unknown_session';
         return msgSessionId === sessionId;
    });

    // Сортировка уже была при запросе (ascending: true), так что просто отображаем
    if (messagesForSession.length > 0) {
        messagesForSession.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message');
            // Добавляем класс user или assistant в зависимости от роли
            messageDiv.classList.add(msg.role === 'user' ? 'user' : 'assistant');

            const contentSpan = document.createElement('span');
            contentSpan.textContent = msg.content || ''; // Отображаем текст сообщения
            messageDiv.appendChild(contentSpan);

            // Добавляем время сообщения
            if (msg.created_at) {
                const timeStamp = document.createElement('span');
                timeStamp.classList.add('timestamp');
                timeStamp.textContent = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                messageDiv.appendChild(timeStamp);
            }

            chatAreaElement.appendChild(messageDiv);
        });

        // Прокрутка вниз к последнему сообщению
        chatAreaElement.scrollTop = chatAreaElement.scrollHeight;
    } else {
        chatAreaElement.innerHTML = '<div class="no-session-selected">В этой сессии нет сообщений.</div>';
    }
} 