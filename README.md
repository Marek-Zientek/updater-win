# Windows Updater & Optimizer 🚀

Kompleksowe, nowoczesne i bezpieczne narzędzie do zarządzania aktualizacjami oprogramowania, sterowników oraz optymalizacji systemu Windows. Aplikacja została zbudowana na fundamencie **Electron + React + TypeScript + Prisma + SQLite** z zachowaniem najwyższej dbałości o estetykę (Glassmorphism Dark Mode) i stabilność działania.

---

## 🌟 Główne Funkcjonalności

### 1. 🔄 Menedżer Aktualizacji (Winget Integration)
* Automatyczne wykrywanie programów posiadających nowsze wersje w repozytorium **WinGet**.
* Bezpieczna instalacja i aktualizacja jednym kliknięciem.
* Pętla sprawdzania aktualizacji w tle z możliwością konfiguracji harmonogramu i automatyczną instalacją (dla wszystkich aplikacji lub zdefiniowanej białej listy).

### 2. ⚡ Szybki Instalator Pakietowy (Multi-Installer)
* Kafelkowy katalog popularnego darmowego oprogramowania pogrupowany tematycznie (Przeglądarki, Narzędzia, Rozrywka, Programowanie).
* Sekwencyjne instalowanie wielu zaznaczonych aplikacji w tle za pomocą WinGet z pełną obsługą cichej instalacji.
* Obsługa i wizualizacja statusu kolejki instalacyjnej w czasie rzeczywistym.

### 3. 🛡️ Optymalizator Telemetrii, Prywatności & Game Booster
* Blokowanie zbędnego śledzenia, diagnostyki i wysyłania danych (DiagTrack) oraz raportowania błędów (WerSvc).
* Dezaktywacja Cortany i wyszukiwarki Bing w menu Start, oraz blokada reklam i promowanych gier.
* **DNS & Hosts Modifier**: Sieciowe blokowanie telemetrii Microsoft, Nvidia, Adobe na poziomie pliku `hosts`.
* **Game Booster (Tryb Gry)**:
  - Aktywacja systemowego profilu zasilania **Najwyższa wydajność** (Ultimate Performance).
  - Obniżenie pingu poprzez optymalizację opóźnień sieciowych w rejestrze (wyłączenie algorytmu Nagle'a).
  - Tymczasowe wyłączanie zbędnych usług systemowych w tle (`SysMain`, `Spooler`) na czas grania, z automatycznym przywracaniem po wyłączeniu trybu gry.

### 4. 🧹 Głębokie Czyszczenie Dysku (Extended Disk Cleaner)
* Szybkie skanowanie i czyszczenie folderów tymczasowych (`Temp`), logów systemowych oraz pamięci podręcznej przeglądarek.
* Czyszczenie katalogów `Prefetch` oraz bufora pobierania Windows Update (`SoftwareDistribution\Download`).

### 5. 🗑️ Inteligentny Deinstalator (Bloatware Leftover Remover)
* Detekcja preinstalowanego oprogramowania bloatware Windows.
* Automatyczne skanowanie i usuwanie pozostałości w rejestrze systemowym (`HKCU`) oraz katalogach `%localappdata%\Packages` po usuniętej aplikacji.

### 6. 💾 Automatyczna Kopia Zapasowa & Menedżer Przywracania
* Tworzenie punktów przywracania Windows przed wprowadzaniem modyfikacji w systemie.
* Wbudowany **Menedżer Przywracania (Rollback Manager)** umożliwiający uruchomienie systemowego narzędzia przywracania bezpośrednio z poziomu aplikacji.

---

## 🛠️ Architektura i Stos Technologiczny

* **Core**: Electron (proces główny Main & Preload)
* **Frontend**: React.js z pełnym typowaniem TypeScript
* **Stylizacja**: Niestandardowy system CSS (Glassmorphism, płynne mikro-animacje, ciemny motyw oparty na zmiennych HSL)
* **Ikony**: Lucide React
* **Baza danych**: SQLite zarządzany poprzez ORM Prisma (konfiguracja, historia aktualizacji, lista spersonalizowanych aplikacji)

---

## 📦 Jak wygenerować plik instalacyjny (.exe)?

Aplikacja wykorzystuje narzędzie **electron-builder** do pakowania kodu w samodzielną aplikację dla systemu Windows.

### Krok 1: Wymagania wstępne
Upewnij się, że masz zainstalowany program **Node.js** (zalecana wersja LTS) oraz zainstalowane wszystkie zależności projektowe:
```bash
npm install
```

### Krok 2: Generowanie bazy danych Prisma (jeśli to konieczne)
Przed budowaniem upewnij się, że klient Prisma jest zsynchronizowany:
```bash
npx prisma generate
```

### Krok 3: Budowanie instalatora (.exe)
Uruchom dedykowany skrypt budujący dla systemu Windows:
```bash
npm run build:win
```

**Co dzieje się pod maską?**
1. Skrypt uruchamia `npm run typecheck`, aby upewnić się o braku błędów w TypeScript.
2. Następuje bundlowanie kodu źródłowego przy pomocy `electron-vite build`.
3. Narzędzie `electron-builder` pakuje aplikację do instalatora `.exe` w katalogu **`dist/`** w głównym folderze projektu.

---

## 🚀 Uruchomienie deweloperskie

Aby uruchomić aplikację w trybie deweloperskim z przeładowywaniem na żywo (Hot Reload):

```bash
npm run dev
```

---

## 📸 Zrzuty Ekranu

Wszystkie aktualne makiety i zrzuty ekranu znajdują się w folderze `/screen`. 

* **Główny pulpit nawigacyjny (Dashboard)**: `/screen/01.png`
* **Optymalizator dysku i prywatności**: `/screen/02.png`
* **Deinstalator Bloatware**: `/screen/03.png`
