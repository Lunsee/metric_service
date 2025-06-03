import { checkAuth, refreshToken } from './check_tokens.js';

function logout() {
    $.ajax({
        url: '/auth/logout',
        method: 'POST',
        success: function () {
            window.location.href = '/login';
        },
        error: function () {
            alert('Ошибка при выходе из системы');
        }
    });
}

const metricList = document.getElementById('metric-list');

$(document).ready(function () {
    console.log("load page success")
    loadUserMetrics()

    //add metrics
    $('#add-metric').on('click', function () {
        Addmetric()
    });

    $('#logout').on('click', function () {
        logout();
    });
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function Addmetric() {
    const url = $('#website-url').val().trim();
    if (!url) return alert('Введите URL');

    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        try {
            await sendAddMetricRequest(url);
        } catch (error) {
            alert('Ошибка при добавлении URL метрик');
        }
    } else {
        alert('Пользователь не авторизован');
    }
}

async function sendAddMetricRequest(url) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/api/addMetrics/',
            method: 'POST',
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + getCookie('access_token')
            },
            data: JSON.stringify({ url: url }),
            success: function (response) {
                addMetricItem(response.url, response.id,response.public_key);
                $('#website-url').val('');
                resolve(response);
            },
            error: async function (xhr) {
                if (xhr.status === 401) {
                    try {
                        await refreshToken();
                        await sendAddMetricRequest(url);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(xhr);
                }
            }
        });
    });
}

let isLoadingMetrics = false;
const MAX_RETRIES = 3; // Максимальное количество попыток для повторного запроса

async function loadUserMetrics() {
    console.log("Load metrics func is active...");

    if (isLoadingMetrics) return;
    isLoadingMetrics = true;

    const isAuthenticated = await checkAuth();
    console.log("isAuthenticated", isAuthenticated);

    if (isAuthenticated) {
        try {
            await fetchUserMetrics();
        } catch (error) {
            alert('Ошибка при загрузке метрик');
        }
    } else {
        alert('Пользователь не авторизован');
    }
}

async function fetchUserMetrics(retryCount = 0) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/api/loadMetrics',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + getCookie('access_token')
            },
            success: function (data) {
                if (data.user) {
                    console.log(data.user);
                    document.getElementById('username').textContent = data.user.username;
                }

                metricList.innerHTML = '';

                const metrics = data.metrics || [];
                if (metrics.length === 0) {
                    showEmptyMessage();
                } else {
                    metrics.forEach(function (metric) {
                        addMetricItem(metric.url, metric.id, metric.public_key);
                    });
                    console.log("user metrics:",metrics);
                }

                resolve(data);
            },
            error: async function (xhr) {
                if (xhr.status === 401) {
                    if (retryCount < MAX_RETRIES) {
                        try {
                            await refreshToken();
                            await fetchUserMetrics(retryCount + 1); // Повторяем запрос
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(new Error('Превышено максимальное количество попыток обновления токена'));
                    }
                } else {
                    reject(xhr);
                }
            },
            complete: function () {

                isLoadingMetrics = false;
            }
        });
    });
}



function addMetricItem(siteUrl,id,public_key) {
    console.log("Добавление метрики:", siteUrl);
    console.log("ID метрики для присвоения в data-id:", id);

    const empty = metricList.querySelector('.empty');
    if (empty) empty.remove();

    const li = document.createElement('li');
    li.setAttribute('data-id', id);

    const wrapper = document.createElement('div');
    wrapper.className = 'metric-item';

    const textSpan = document.createElement('span');
    textSpan.textContent = siteUrl;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Удалить';



    const embedBtn = document.createElement('button');
    embedBtn.className = 'embed-btn';
    embedBtn.textContent = 'Получить код';
    embedBtn.onclick = () => showEmbedCode(public_key);


    const statisticBtn = document.createElement('button');
    statisticBtn.className = 'statisticBtn';
    statisticBtn.textContent = 'Показать статистику';
    statisticBtn.onclick = () => showStatisticforMetric(siteUrl,public_key);





    deleteBtn.addEventListener('click', () => {

        li.remove();
        if (metricList.children.length === 0) {
            showEmptyMessage();
        }
        console.log("Хотим удалить метрику с public key ", public_key);
        console.log("Хотим удалить метрику с id ", id);

        deleteMetric(id,public_key);
    });

    wrapper.appendChild(textSpan);
    wrapper.appendChild(deleteBtn);
    wrapper.appendChild(embedBtn);
    wrapper.appendChild(statisticBtn);
    li.appendChild(wrapper);
    metricList.appendChild(li);
}




function showEmbedCode(publicKey) {
    const rawCode = `<script async src="http://localhost:8080/track.js" data-public-key="${publicKey}"></script>`;

    const escapedCode = rawCode
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");


    const codeElement = document.getElementById("embed-code");
    codeElement.innerHTML = escapedCode;


    const copyBtn = document.getElementById("copy-embed-btn");
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(rawCode).then(() => {
                copyBtn.textContent = "Скопировано!";
                setTimeout(() => copyBtn.textContent = "Скопировать код", 2000);
            }).catch(err => {
                console.error("Ошибка при копировании:", err);
                copyBtn.textContent = "Ошибка копирования";
                setTimeout(() => copyBtn.textContent = "Скопировать код", 2000);
            });
        };
    }
}




function showEmptyMessage() {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty';
    emptyLi.textContent = 'Пока пусто...';
    metricList.appendChild(emptyLi);
}


// Функция статистики
function showStatisticforMetric(siteUrl,public_key) {
    console.log("Статистика для метрики с siteUrl", siteUrl);
    console.log("Статистика для метрики с public_key", public_key);

    $.ajax({
        url: `/api/stats/${public_key}`,
        method: 'GET',
        success: function(data) {
            const chartsContainer = document.getElementById("metrics-charts");
            chartsContainer.innerHTML = ""; // очищаем предыдущие графики


             // Проверка на null/undefined или пустые данные
            if (!data || !data.event_counts || Object.keys(data.event_counts).length === 0) {
                const noDataMessage = document.createElement("div");
                noDataMessage.classList.add("no-data-message");
                noDataMessage.textContent = "Статистика не найдена или данные отсутствуют";
                chartsContainer.appendChild(noDataMessage);
                return;
            }

            const metricTitle = document.createElement("h3");
            metricTitle.textContent = `Метрика: ${siteUrl}`;
            chartsContainer.appendChild(metricTitle);

            // 1. Диаграмма количества событий
            const title1 = document.createElement("h4");
            title1.textContent = "Распределение событий";
            chartsContainer.appendChild(title1);

            const wrapper1 = document.createElement("div");
            wrapper1.classList.add("chart-wrapper");
            const canvas1 = document.createElement("canvas");
            wrapper1.appendChild(canvas1);
            chartsContainer.appendChild(wrapper1);

            const eventData = {
                'Просмотры страниц': 0,
                'Клики на кнопки': 0,
                'Общие клики': 0,
                'Отправки форм': 0,
                'Другие события': 0
            };

            const ipDetails = {};

            // Группируем данные по категориям
            for (const [eventType, count] of Object.entries(data.event_counts)) {
                if (eventType === 'page_view' || eventType === 'time_spent') {
                    eventData['Просмотры страниц'] += count;
                } else if (eventType === 'button_click') {
                    eventData['Клики на кнопки'] += count;
                } else if (eventType === 'generic_click') {
                    eventData['Общие клики'] += count;
                } else if (eventType === 'click') {
                    eventData['Общие клики'] += count;
                } else if (eventType.includes('submit')) {
                    eventData['Отправки форм'] += count;
                } else {
                    eventData['Другие события'] += count;
                }
            }

            //IP-адреса для детализации
            data.timestamps.forEach(event => {
                if (!ipDetails[event.event_type]) {
                    ipDetails[event.event_type] = new Set();
                }
                if (event.ip_address) {
                    ipDetails[event.event_type].add(event.ip_address);
                }
            });

            const labels = Object.keys(eventData);
            const counts = Object.values(eventData);
            new Chart(canvas1, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Всего событий',
                            data: counts,
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.7)', // Просмотры
                                'rgba(255, 99, 132, 0.7)',  // Кнопки
                                'rgba(75, 192, 192, 0.7)',  // Общие клики
                                'rgba(153, 102, 255, 0.7)', // Формы
                                'rgba(255, 159, 64, 0.7)'   // Другие
                            ],
                            borderColor: [
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 99, 132, 1)',
                                'rgba(75, 192, 192, 1)',
                                'rgba(153, 102, 255, 1)',
                                'rgba(255, 159, 64, 1)'
                            ],
                            borderWidth: 1
                        },
                        {
                            label: 'Уникальных IP',
                            data: labels.map(label => {
                                if (label === 'Просмотры страниц') {
                                    return (data.unique_ips_per_event['page_view'] || 0) +
                                           (data.unique_ips_per_event['time_spent'] || 0);
                                } else if (label === 'Клики на кнопки') {
                                    return data.unique_ips_per_event['button_click'] || 0;
                                } else if (label === 'Общие клики') {
                                    return data.unique_ips_per_event['generic_click'] || 0;
                                } else if (label === 'Отправки форм') {
                                    return Object.entries(data.unique_ips_per_event)
                                        .filter(([key]) => key.includes('submit'))
                                        .reduce((sum, [_, count]) => sum + count, 0);
                                }
                                return 0;
                            }),
                            backgroundColor: 'rgba(255, 206, 86, 0.7)',
                            borderColor: 'rgba(255, 206, 86, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    const label = context.dataset.label;
                                    if (label === 'Уникальных IP') return null;

                                    const eventType = context.label;
                                    const ips = Array.from(
                                        eventType === 'Просмотры страниц'
                                            ? new Set([
                                                ...(ipDetails['page_view'] || []),
                                                ...(ipDetails['time_spent'] || [])
                                            ])
                                            : eventType === 'Клики на кнопки'
                                                ? (ipDetails['button_click'] || [])
                                            : eventType === 'Общие клики'
                                                ? (ipDetails['generic_click'] || [])
                                            : eventType === 'Отправки форм'
                                                ? Object.entries(ipDetails)
                                                    .filter(([key]) => key.includes('submit'))
                                                    .flatMap(([_, ips]) => Array.from(ips))
                                            : []
                                    ).slice(0, 5);

                                    if (ips.length === 0) return 'Нет данных об IP';

                                    return [
                                        'Примеры IP:',
                                        ...ips.map(ip => `• ${ip}`),
                                        ips.length >= 5 ? '...и другие' : ''
                                    ].join('\n');
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Соотношение событий и уникальных посетителей'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Количество'
                            }
                        }
                    }
                }
            });

            // 2. Диаграмма времени на странице (если есть)
            if (data.time_spent_ms && data.time_spent_ms.length > 0) {
                const title2 = document.createElement("h4");
                title2.textContent = `Время на странице (секунды), среднее: ${data.average_time_spent_sec} сек.`;
                chartsContainer.appendChild(title2);

                const wrapper2 = document.createElement("div");
                wrapper2.classList.add("chart-wrapper");
                const canvas2 = document.createElement("canvas");
                wrapper2.appendChild(canvas2);
                chartsContainer.appendChild(wrapper2);

                new Chart(canvas2, {
                    type: 'line',
                    data: {
                        labels: data.time_spent_ms.map((_, i) => `Сессия ${i + 1}`),
                        datasets: [{
                            label: 'Время на странице (секунды)',
                            data: data.time_spent_ms.map(ms => (ms / 1000).toFixed(1)),
                            borderColor: 'rgba(255, 99, 132, 0.7)',
                            fill: false,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: `Среднее время: ${data.average_time_spent_sec} сек.`
                            }
                        }
                    }
                });
            }

            // 3. Таймлайн по событиям (опционально)
            if (data.timestamps && data.timestamps.length > 0) {
                const title3 = document.createElement("h4");
                title3.textContent = "Активность по времени суток";
                chartsContainer.appendChild(title3);

                // события по часам
                const hours = Array(24).fill(0);
                data.timestamps.forEach(entry => {
                    const hour = new Date(entry.timestamp).getHours();
                    hours[hour]++;
                });

                const wrapper3 = document.createElement("div");
                wrapper3.classList.add("chart-wrapper");
                const canvas3 = document.createElement("canvas");
                wrapper3.appendChild(canvas3);
                chartsContainer.appendChild(wrapper3);

                new Chart(canvas3, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                        datasets: [{
                            label: 'Количество событий',
                            data: hours,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    },
                     options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Распределение событий по часам'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Количество событий'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Часы дня'
                                }
                            }
                        }
                    }
                });
            }
            //4. График ip
            const title4 = document.createElement("h4");
            title4.textContent = "Детализация по IP-адресам";
            chartsContainer.appendChild(title4);

            // Группируем данные по IP и типу события
            const ipEvents = data.timestamps.reduce((acc, event) => {
                const key = `${event.ip_address}_${event.event_type}`;
                if (!acc[key]) {
                    acc[key] = {
                        ip: event.ip_address,
                        type: event.event_type,
                        count: 0,
                        lastActive: event.timestamp
                    };
                }
                acc[key].count++;
                if (new Date(event.timestamp) > new Date(acc[key].lastActive)) {
                    acc[key].lastActive = event.timestamp;
                }
                return acc;
            }, {});

            // Создаём таблицу
            const wrapper4 = document.createElement("div");
            wrapper4.classList.add("chart-wrapper");
            const table = document.createElement("table");
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>IP-адрес</th>
                        <th>Тип события</th>
                        <th>Количество</th>
                        <th>Последняя активность</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(ipEvents)
                        .sort((a, b) => b.count - a.count)
                        .map(item => `
                            <tr>
                                <td>${item.ip}</td>
                                <td>${item.type}</td>
                                <td>${item.count}</td>
                                <td>${new Date(item.lastActive).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                </tbody>
            `;
            wrapper4.appendChild(table);
            chartsContainer.appendChild(wrapper4);

        },
        error: function(xhr, status, error) {
            console.error("Ошибка при получении статистики:", error);
            alert("Не удалось загрузить статистику.");
        }
    });
}



async function deleteMetric(id,publicKey) {
    console.log("Удаляем метрику с publicKey:",publicKey);

    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        alert("Сессия истекла. Пожалуйста, войдите снова.");
        return;
    }
    try {
        const response = await fetch(`/api/deleteMetric/${publicKey}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + getCookie('access_token')
            }
        });

        if (response.ok) {
            console.log("Metric deleted successfully");

            // Удаляем метрику из списка на клиенте
            const metricItem = document.querySelector(`li[data-id="${id}"]`);
            if (metricItem) {
                metricItem.remove();
            }

            // Если список пустой, показываем сообщение
            if (metricList.children.length === 0) {
                showEmptyMessage();
            }
        } else {
            alert("Ошибка при удалении метрики");
        }
    } catch (error) {
        console.error("Error deleting metric:", error);
        alert("Ошибка при удалении метрики");
    }
}
