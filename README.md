# AWS Cloud Practitioner Practice Exam — ITSTEP project

Полноценный учебный проект для подготовки к AWS Certified Cloud Practitioner (CLF-C02): адаптивный фронтенд, REST API, микросервисы на FastAPI, PostgreSQL, Docker Compose, тесты, OpenAPI, health checks и заготовка для деплоя фронтенда в Amazon S3.

> Это самостоятельный тренировочный тренажёр, не официальный экзамен AWS и не продукт CloudNinja. Вопросы написаны для проекта и не копируют закрытые экзаменационные материалы.

## Возможности

- Режим практики и экзамена; случайный набор вопросов и таймер.
- Варианты ответов, навигация по вопросам, отметка «на проверку».
- Автоматический подсчёт результата, процент и разбор объяснений.
- История результатов сохраняется в PostgreSQL через отдельный сервис.
- OpenAPI/Swagger для каждого API, health checks, Docker health dependencies.
- Валидация данных, ограничение размера экзамена, CORS через конфигурацию.
- Unit/API тесты, `.env.example`, документация, AWS S3 deploy script.
- S3-compatible frontend build; backend remains a separately hosted API.

## Архитектура

```text
Browser
  ├── /              -> frontend (Nginx static files)
  ├── /api/quiz/*     -> quiz-service (FastAPI :8001)
  └── /api/results/*  -> results-service (FastAPI :8002)
                              |
                         PostgreSQL :5432

Production AWS option:
S3 + CloudFront (frontend) -> HTTPS API domain -> ALB / ECS Fargate services -> RDS PostgreSQL
```

Микросервисы разделены по ответственности:
- `quiz-service`: каталог вопросов, фильтрация, выдача экзамена и проверка ответов.
- `results-service`: сохранение и выдача истории результатов.
- `frontend`: статический SPA.
- `postgres`: постоянное хранение результатов.
- `gateway`: Nginx reverse proxy и статическая раздача в Docker Compose.

## Запуск локально

Требования: Docker Desktop / Docker Engine + Compose v2.

1. Скопируйте `.env.example` в `.env` и при необходимости измените значения.
2. Из корня проекта выполните:

```bash
docker compose up --build -d
docker compose ps
```

3. Откройте:
   - Frontend: http://localhost:8080
   - Quiz API docs: http://localhost:8080/api/quiz/docs
   - Results API docs: http://localhost:8080/api/results/docs
   - Health: http://localhost:8080/health

Остановить: `docker compose down`. Остановить и удалить локальную БД: `docker compose down -v` (удаляет данные).

## API

### Quiz service
- `GET /api/quiz/health`
- `GET /api/quiz/questions?limit=10&domain=cloud-technology`
- `POST /api/quiz/exams` — сформировать экзамен.
- `POST /api/quiz/grade` — проверить ответы.

### Results service
- `GET /api/results/health`
- `POST /api/results/` — сохранить итог.
- `GET /api/results/?limit=20` — последние результаты.

Оба сервиса имеют Swagger UI и OpenAPI JSON. Запросы к сервисам из Compose маршрутизируются через gateway.

## Тесты

```bash
docker compose run --rm quiz-service pytest -q
docker compose run --rm results-service pytest -q
```

Для локального запуска без Docker (Python 3.12+): установите зависимости соответствующего сервиса и выполните `pytest`.

## Самый простой вариант облачного развёртывания: Microsoft Azure

Для учебной демонстрации проще всего запустить весь стек на одной Linux VM через Docker Compose. В этом варианте отдельные Azure Static Web Apps, Container Apps, Azure Database for PostgreSQL и домен не обязательны: Nginx внутри проекта раздаёт frontend и маршрутизирует API. Это сокращает число ресурсов и сетевых настроек. VM и связанные ресурсы могут тарифицироваться; до создания проверь цену и доступные кредиты в своём аккаунте.

Подробная пошаговая инструкция на русском: [`docs/azure-quickstart-ru.md`](docs/azure-quickstart-ru.md).

Кратко: создать Resource Group и Ubuntu VM, разрешить SSH только со своего IP и HTTP/80, установить Docker Compose, перенести проект, скопировать `.env.example` в `.env`, задать уникальный пароль БД и `HTTP_PORT=80`, затем выполнить `docker compose up --build -d`. После запуска сайт будет доступен по публичному IP VM через HTTP. Для реального публичного production-сайта добавьте HTTPS и домен; не передавайте пароли и не оставляйте SSH открытым всему интернету.

## Развёртывание на AWS

### Важное разделение
S3 static website hosting обслуживает только статические файлы HTML/CSS/JS; он не запускает Docker-контейнеры или FastAPI. Поэтому фронтенд можно разместить на S3, а микросервисы — на ECS Fargate/EC2 с HTTPS API-доменом. Для HTTPS и безопасной конфигурации рекомендуется CloudFront перед приватным S3 bucket. См. AWS docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html

### Frontend to S3
1. Создайте S3 bucket для фронтенда и настройте CloudFront (рекомендуемый вариант).
2. Создайте `frontend/runtime-config.js` из `frontend/runtime-config.example.js`, указав URL API gateway, например `https://api.example.com`.
3. Выполните:
```bash
AWS_REGION=us-east-1 S3_BUCKET=your-unique-bucket-name ./scripts/deploy-frontend-s3.sh
```
Скрипт собирает каталог `frontend/` в `dist/` и синхронизирует файлы с S3. Он не создаёт bucket, CloudFront, DNS или сертификат автоматически.
4. Настройте CORS на backend/API gateway для домена фронтенда. В production используйте HTTPS и секреты в AWS Secrets Manager/SSM, не храните секреты в репозитории.

### Backend to AWS (production outline)
- Контейнеры сервисов опубликовать в ECR.
- Развернуть `quiz-service` и `results-service` как ECS Fargate services за Application Load Balancer / API Gateway.
- Использовать RDS PostgreSQL в приватной подсети.
- Хранить пароль БД в Secrets Manager, включить TLS, логи/метрики CloudWatch, health checks и минимальные IAM permissions.
- Привязать API-домен через Route 53; сертификат — ACM в нужном регионе.
- Для frontend custom domain: CloudFront + ACM + Route 53. S3 website endpoint поддерживает только HTTP; CloudFront даёт HTTPS.
- Настройте `CORS_ORIGINS` в `.env` / deployment env под точный origin фронтенда.

CloudNinja проверяет домен/публичную доступность в рамках своих правил; этот репозиторий не может автоматически зарегистрировать домен или гарантировать прохождение внешней проверки. После публикации укажите реальный публичный URL и проверьте его в браузере, HTTPS, DNS и доступность API.

## Структура

```text
frontend/                 статический SPA
services/quiz/            микросервис вопросов и оценки
services/results/         микросервис истории результатов
infra/nginx/              gateway и reverse proxy
scripts/                  deployment helper
docs/                     требования и архитектура
docker-compose.yml
.env.example
```

## Критерии учебной сдачи (ITSTEP-style)

- [x] Разделение ответственности на сервисы
- [x] Dockerfile для каждого приложения и Compose orchestration
- [x] REST endpoints + OpenAPI docs
- [x] PostgreSQL и переменные окружения
- [x] Валидация входных данных и обработка ошибок
- [x] Health checks и автоматические тесты
- [x] README, архитектура, инструкции запуска и deploy
- [ ] Реальный AWS account/domain, публикация backend и проверка внешнего домена (выполняется в вашем аккаунте)
- [ ] Демонстрация работы и защита проекта (выполняется студентом)
