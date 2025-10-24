# 🚀 Launch Setup Guide

## Критичные шаги перед запуском

### 1. 🔧 Настройка переменных окружения

#### Backend (.env)
Создайте файл `/backend/.env`:
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Server Configuration
PORT=3001
NODE_ENV=production

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# MagicBlock Configuration
MAGICBLOCK_DEVNET_URL=https://devnet.magicblock.app
MAGICBLOCK_ROUTER_URL=https://devnet-rpc.magicblock.app
```

#### Frontend (.env.local)
Создайте файл `/web/.env.local`:
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_anon_key_here

# Database Configuration
NEXT_PUBLIC_SUPABASE_SCHEMA=public

# MagicBlock Configuration
NEXT_PUBLIC_MAGICBLOCK_DEVNET_URL=https://devnet.magicblock.app
NEXT_PUBLIC_MAGICBLOCK_ROUTER_URL=https://devnet-rpc.magicblock.app
NEXT_PUBLIC_EPHEMERAL_ROLLUP_ENABLED=true
```

### 2. 💰 Пополнение Service Wallet

**Текущий баланс:** 1.75 SOL  
**Рекомендуемый баланс:** 10+ SOL

```bash
cd backend
node scripts/fund-service-wallet.js
```

Или отправьте SOL на адрес: `BgMnG9RNeooQNdbEDefKV7gs7tH4Cv3P4xVpViDRqZSn`

### 3. 🗄️ База данных

Убедитесь, что все миграции применены в Supabase:
- `000_initial_schema.sql`
- `001_add_update_game_stats.sql` 
- `002_winner_takes_all_points.sql`
- `003_referral_system.sql`

### 4. 🧪 Тестирование

Обязательно протестируйте:
- ✅ Все типы игр (0.01, 0.05, 0.1 SOL)
- ✅ Реферальную систему
- ✅ Компенсацию комиссий
- ✅ Мобильную версию

### 5. 🚀 Запуск

```bash
# Backend
cd backend
npm install
npm start

# Frontend  
cd web
npm install
npm run build
npm start
```

### 6. 📊 Мониторинг

После запуска следите за:
- Баланс service wallet
- Ошибки в логах
- Производительность API
- Активность пользователей

## ⚠️ Критичные проверки

- [ ] Переменные окружения настроены
- [ ] Service wallet пополнен (10+ SOL)
- [ ] База данных настроена
- [ ] Все миграции применены
- [ ] Тестирование пройдено
- [ ] Мониторинг настроен

## 🆘 Поддержка

При проблемах проверьте:
1. Логи backend сервера
2. Баланс service wallet
3. Статус Supabase
4. Статус Solana devnet
