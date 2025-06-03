# Metric Service

FastAPI-сервис для сбора и анализа метрик с JWT-аутентификацией.

## 🔹 Возможности
- 📊 Запись и хранение метрик
- 🔐 Аутентификация через JWT
- 📈 Получение статистики по метрикам
- 🚀 FastAPI + SQLAlchemy + PostgreSQL
- ⚡️ Асинхронная работа
- 🖥 HTML-интерфейс (логин, дашборд)

## 🛠 Установка
```bash
git clone https://github.com/Lunsee/metric_service.git
cd metric_service
pip install -r requirements.txt\
```

## ⚙️ Конфигурация
Если необходимо, поправьте .env файл в корне проекта под ваши задачи

Пример .env:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=admin
DB_NAME=postgres
API_URL="replace this for your swagger api"
SERVER_PORT=8080
SECRET_KEY = "0456dffffhtghbvnughjghfg5dfgd57hgbnmbx3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # time to timeout for user sessions
REFRESH_TOKEN_EXPIRE_DAYS = 5 # time to timeout for user sessions
```

## 🚀 Запуск
```bash
uvicorn main:app --reload
```
## 📄 API Endpoints

### 🔐 Аутентификация

- GET    /login            (HTML-форма входа)
- POST  /token            (form-data Получение JWT токенов)
- POST  /refresh          (JSON  Обновление access-токена)
- POST  /logout            (JSON  Выход из системы)
- POST  /register         (JSON  Регистрация нового пользователя)
- GET  /access-token-login  (Защищенная страница (требует JWT))

### 🖥 Пользовательский интерфейс
- GET  /dashboard   (HTML-дашборд с метриками)
- GET  /login       (HTML-форма входа)
  
### 📊 Метрики
- POST  /addMetrics                    (JSON  Добавление новой метрики)
- GET  /loadMetrics                    (JSON  Список метрик пользователя)
- DELETE  /deleteMetric/{public_key}  (JSON  Удаление метрики по ключу)
- POST  /collect                      (JSON  Сбор клиентских данных)
- POST  /api/stats/{public_key}        (JSON  Статистика по метрике)
