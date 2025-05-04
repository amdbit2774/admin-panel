// Получаем URL и ключ Supabase из переменных окружения (переданных через сервер или другим способом)
// ВАЖНО: В реальном приложении не стоит "зашивать" ключи прямо в клиентский код.
// Для простоты примера, мы ожидаем, что эти переменные установлены глобально или переданы.
// Но для этого демо мы их возьмем прямо из .env (что небезопасно для продакшена!)

// Замените на ваши реальные значения, если не используете .env или другой метод передачи
const SUPABASE_URL = 'https://dovuoonqbfycjqxqkrin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdnVvb25xYmZ5Y2pxeHFrcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMjUzNDEsImV4cCI6MjA2MDkwMTM0MX0.ZZGRkGBRr2TpGKQg4VHEfSwpcRbeEbtXyv6f0SAHiTU';

let allMessages = []; // Хранилище для всех загруженных сообщений
let currentSessionId = null;
let telegramReady = false;

document.addEventListener('DOMContentLoaded', async () => {
    // --- Инициализация Telegram --- 
    if (window.Telegram && window.Telegram.WebApp) {
        try {
             Telegram.WebApp.ready();
             Telegram.WebApp.expand();
             telegramReady = true;
             console.log('Telegram Web App готов.');
             // Устанавливаем цвет хедера Telegram
             Telegram.WebApp.setHeaderColor(Telegram.WebApp.themeParams.secondary_bg_color || '#f7f7f7');
        } catch (e) {
            console.error('Ошибка инициализации Telegram Web App:', e);
        }
    } else {
        console.warn('Telegram Web App SDK не найден.');
    }

    // --- Получение элементов DOM --- 
    const topMenu = document.getElementById('top-menu');
    const pages = document.querySelectorAll('.page');
    const sessionList = document.getElementById('session-list');
    const chatArea = document.getElementById('chat-area');
    const chatHeader = document.getElementById('chat-header');
    const loadingSessionsLi = sessionList?.querySelector('.loading-sessions'); // Добавил проверку, т.к. sessionList может быть не на всех страницах
    const chatsPage = document.getElementById('page-chats');

    // --- Инициализация Supabase --- 
    let _supabase;
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('URL или ключ Supabase не настроены');
        }
        const { createClient } = supabase; 
        _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase клиент инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации Supabase:', error);
        if (loadingSessionsLi) loadingSessionsLi.textContent = `Ошибка: ${error.message}`;
        if (chatsPage?.classList.contains('active')) { // Показываем ошибку только если активна страница чатов
            if (chatArea) chatArea.innerHTML = `<div class="no-session-selected">Ошибка инициализации Supabase: ${error.message}</div>`;
        }
        return;
    }

    // --- Настройка навигации --- 
    topMenu.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const pageId = event.target.dataset.page;

            // Переключаем активную кнопку
            topMenu.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // Переключаем активную страницу
            pages.forEach(page => {
                if (page.id === `page-${pageId}`) {
                    page.classList.add('active');
                } else {
                    page.classList.remove('active');
                }
            });
            
            // Загружаем чаты только если переключились на них и они еще не загружены
            if(pageId === 'chats' && allMessages.length === 0) {
                loadChatData(_supabase, sessionList, chatArea, chatHeader, loadingSessionsLi);
            }
        }
    });

    // --- Первоначальная загрузка данных для чатов (если страница активна) ---
     if (chatsPage?.classList.contains('active')) {
        loadChatData(_supabase, sessionList, chatArea, chatHeader, loadingSessionsLi);
     }
});

// --- Функция загрузки и обработки данных чата ---
async function loadChatData(_supabase, sessionList, chatArea, chatHeader, loadingSessionsLi) {
     if (!sessionList || !loadingSessionsLi) return; // Выходим, если элементы не найдены
     loadingSessionsLi.textContent = 'Загрузка сессий...';
     loadingSessionsLi.style.display = 'list-item';

     try {
        console.log('Запрос данных из chat_logs...');
        // ВАЖНО: Убедитесь, что у вас есть колонки user_id и first_name
        const { data, error } = await _supabase
            .from('chat_logs')
            .select('id, role, content, created_at, metadata, user_id, first_name') // Добавляем user_id и first_name
            .order('created_at', { ascending: true })
            // .limit(1000);

        if (error) throw error;

        console.log(`Данные получены (${data.length} сообщений)`);
        allMessages = data;

        // --- Обработка и отображение сессий --- 
        const sessions = {}; 
        allMessages.forEach(msg => {
            // Используем user_id как ключ сессии. Замените, если у вас другой идентификатор.
            const sessionId = msg.user_id || msg.metadata?.user_id || msg.metadata?.session_id || 'unknown_session';
            const firstName = msg.first_name || msg.metadata?.first_name; // Пытаемся получить имя

            if (!sessions[sessionId]) {
                sessions[sessionId] = {
                    lastTimestamp: msg.created_at,
                    displayName: firstName || (sessionId === 'unknown_session' ? 'Неизвестная сессия' : `User ${sessionId}`),
                    userId: sessionId // Сохраняем ID для заголовка
                };
            } else {
                 // Обновляем имя, если оно появилось позже
                 if (!sessions[sessionId].displayName && firstName) {
                      sessions[sessionId].displayName = firstName;
                 }
                 // Обновляем последнее время
                 if (new Date(msg.created_at) > new Date(sessions[sessionId].lastTimestamp)) {
                     sessions[sessionId].lastTimestamp = msg.created_at;
                 }
            }
        });

        sessionList.innerHTML = ''; 

        const sortedSessionIds = Object.keys(sessions).sort((a, b) => {
            return new Date(sessions[b].lastTimestamp) - new Date(sessions[a].lastTimestamp);
        });

        if (sortedSessionIds.length > 0) {
            sortedSessionIds.forEach(sessionId => {
                const li = document.createElement('li');
                li.textContent = sessions[sessionId].displayName;
                li.dataset.sessionId = sessionId; 
                li.addEventListener('click', () => {
                    sessionList.querySelectorAll('li').forEach(item => item.classList.remove('active'));
                    li.classList.add('active');
                    displayMessagesForSession(sessionId, chatArea, chatHeader, sessions[sessionId].displayName); 
                });
                sessionList.appendChild(li);
            });
             if (chatArea) chatArea.innerHTML = '<div class="no-session-selected">Выберите сессию для просмотра сообщений.</div>';
             if (chatHeader) chatHeader.textContent = 'Диалог'; // Сбрасываем заголовок

        } else {
            sessionList.innerHTML = '<li class="loading-sessions">Сессии не найдены</li>';
             if (chatArea) chatArea.innerHTML = '<div class="no-session-selected">Нет данных для отображения.</div>';
             if (chatHeader) chatHeader.textContent = 'Диалог';
        }

    } catch (error) {
        console.error('Ошибка при загрузке или обработке данных:', error);
        sessionList.innerHTML = `<li class="loading-sessions">Ошибка загрузки</li>`;
         if (chatArea) chatArea.innerHTML = `<div class="no-session-selected">Ошибка загрузки данных: ${error.message}</div>`;
         if (chatHeader) chatHeader.textContent = 'Ошибка';
         if (telegramReady) {
            Telegram.WebApp.showAlert(`Ошибка загрузки данных: ${error.message}`);
        }
    }
}


// --- Функция отображения сообщений для выбранной сессии ---
function displayMessagesForSession(sessionId, chatAreaElement, chatHeaderElement, sessionDisplayName) {
     if (!chatAreaElement || !chatHeaderElement) return; // Доп. проверка

    currentSessionId = sessionId;
    chatHeaderElement.textContent = sessionDisplayName; // Используем переданное имя
    chatAreaElement.innerHTML = ''; 

    const messagesForSession = allMessages.filter(msg => {
        const msgSessionId = msg.user_id || msg.metadata?.user_id || msg.metadata?.session_id || 'unknown_session';
         return msgSessionId === sessionId;
    });

    // Сортировка уже была
    if (messagesForSession.length > 0) {
        messagesForSession.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message');
            messageDiv.classList.add(msg.role === 'user' ? 'user' : 'assistant');

            const contentSpan = document.createElement('span');
            contentSpan.innerHTML = msg.content ? msg.content.replace(/\n/g, '<br>') : ''; // Заменяем \n на <br> для переносов
            messageDiv.appendChild(contentSpan);

            if (msg.created_at) {
                const timeStamp = document.createElement('span');
                timeStamp.classList.add('timestamp');
                timeStamp.textContent = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                messageDiv.appendChild(timeStamp);
            }

            chatAreaElement.appendChild(messageDiv);
        });

        chatAreaElement.scrollTop = chatAreaElement.scrollHeight;
    } else {
        chatAreaElement.innerHTML = '<div class="no-session-selected">В этой сессии нет сообщений.</div>';
    }
} 