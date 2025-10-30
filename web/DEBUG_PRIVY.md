# 🔍 Отладка Privy Wallet

## 📋 Что сделать для отладки

### 1. Откройте консоль браузера

Нажмите `F12` или `Ctrl+Shift+I` (Windows/Linux) или `Cmd+Option+I` (Mac)

### 2. Проверьте логи

В консоли вы должны увидеть следующие логи:

#### ✅ Хорошие логи (все работает):

```
🔍 All wallets: [...]
🔍 Wallet types: [...]
✅ Solana wallets found: 1
🔍 Initializing wallet: { ready: true, authenticated: true, ... }
✅ Solana wallet created successfully: {...}
💰 Creating wallet object: { hasWallet: true, ... }
✅ Wallet object created successfully: ABC...
🎯 Wallet context value: { hasPublicKey: true, connected: true, ... }
🔌 StyledWalletButton state: { authenticated: true, walletsCount: 1, ... }
🎨 Rendering wallet button: { authenticated: true, ... }
```

#### ❌ Плохие логи (есть проблемы):

Если вы видите:

```
⚠️  No wallet object created: { hasWallet: false, authenticated: true }
```

**Проблема:** Кошелек не создается или не распознается

**Решение:**
1. Убедитесь, что в `.env.local` установлен `NEXT_PUBLIC_PRIVY_APP_ID`
2. Проверьте, что в Privy Dashboard включена поддержка Solana
3. Попробуйте перезагрузить страницу

---

```
⏸️  Skipping wallet initialization: { ready: false, ... }
```

**Проблема:** Privy не инициализирован

**Решение:**
1. Проверьте App ID в `.env.local`
2. Перезагрузите страницу
3. Проверьте интернет-соединение

---

```
❌ Failed to create Solana wallet: ...
```

**Проблема:** Ошибка создания кошелька

**Решение:**
1. Откройте детали ошибки в консоли
2. Проверьте Privy Dashboard на наличие ошибок
3. Убедитесь, что у вас есть доступ к Privy

### 3. Что проверить

#### A. Privy App ID

Файл: `web/.env.local`
```env
NEXT_PUBLIC_PRIVY_APP_ID=your_app_id_here
```

#### B. Privy Dashboard

1. Перейдите на https://dashboard.privy.io/
2. Выберите ваше приложение
3. Убедитесь, что:
   - ✅ Solana включен
   - ✅ Embedded wallets включены
   - ✅ Правильный chain (devnet/mainnet)

#### C. Браузер

1. Откройте DevTools (F12)
2. Перейдите на вкладку **Application** или **Storage**
3. Проверьте, что cookies не заблокированы
4. Попробуйте в приватном режиме

### 4. Типичные проблемы

#### Кнопка показывает "Connect Wallet" но ничего не происходит

**Причина:** Пользователь не авторизован через Privy

**Решение:**
1. Нажмите на кнопку
2. Должно открыться модальное окно Privy
3. Выберите способ входа (Email, SMS, Google)

#### Кнопка показывает "Connected" но игра не запускается

**Причина:** Кошелек не распознается

**Проверка:**
1. Откройте консоль
2. Найдите логи с 🔍 и 🎯
3. Проверьте, что `connected: true`
4. Проверьте, что есть `publicKey`

**Решение:**
1. Нажмите на кнопку с адресом
2. Отключитесь
3. Подключитесь снова

#### В консоли ошибки TypeScript

**Причина:** Не критично, но может мешать

**Решение:**
```bash
cd web
rm -rf .next
npm run dev
```

## 🆘 Если ничего не помогает

1. **Проверьте все логи в консоли**
2. **Сделайте скриншот ошибок**
3. **Проверьте .env.local файл**
4. **Попробуйте создать новое приложение в Privy Dashboard**

## 📞 Полезные ссылки

- Privy Dashboard: https://dashboard.privy.io/
- Privy Docs: https://docs.privy.io/
- Privy Support: https://privy.io/support

