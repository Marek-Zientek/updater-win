# Windows Updater & Optimizer 🚀

Kompleksowe, nowoczesne i bezpieczne narzędzie do zarządzania aktualizacjami oprogramowania, sterowników oraz optymalizacji systemu Windows. Aplikacja została zbudowana na fundamencie **Electron + React + TypeScript + Prisma + SQLite** z zachowaniem najwyższej dbałości o estetykę (Glassmorphism Dark Mode) i stabilność działania.

---

## 🌟 Główne Funkcjonalności

### 1. 🔄 Menedżer Aktualizacji (Winget Integration)
* Automatyczne wykrywanie programów posiadających nowsze wersje w repozytorium **WinGet**.
* Bezpieczna instalacja i aktualizacja jednym kliknięciem.
* Pętla sprawdzania aktualizacji w tle z możliwością konfiguracji harmonogramu i automatyczną instalacją (dla wszystkich aplikacji lub zdefiniowanej białej listy).

### 2. 🛡️ Optymalizator Telemetrii i Prywatności
* Blokowanie zbędnego śledzenia, diagnostyki i wysyłania danych (DiagTrack).
* Wyłączanie raportowania błędów (WerSvc).
* Dezaktywacja Cortany i wyszukiwarki Bing w menu Start.
* Blokowanie reklam systemowych i automatycznego instalowania promowanych gier/aplikacji.

### 3. 🧹 Głębokie Czyszczenie Dysku (Extended Disk Cleaner)
* Szybkie skanowanie i czyszczenie folderów tymczasowych (`Temp`).
* Logi systemowe i raporty błędów.
* Pamięć podręczna (cache) przeglądarek.
* **Zaawansowane**: Czyszczenie katalogów `Prefetch` oraz bufora pobierania Windows Update (`SoftwareDistribution\Download`) z wykorzystaniem podniesionych uprawnień PowerShell.

### 4. 🗑️ Inteligentny Deinstalator (Bloatware Leftover Remover)
* Detekcja preinstalowanego oprogramowania bloatware (np. gry z mikropłatnościami, zbędne asystenty).
* Czysta deinstalacja z konta użytkownika.
* **Zaawansowane**: Automatyczne skanowanie i usuwanie pozostałości w rejestrze systemowym (`HKCU`) oraz katalogach `%localappdata%\Packages` po usuniętej aplikacji.

### 5. 💾 Automatyczne Kopia Zapasowa (Restore Points)
* Zintegrowany mechanizm tworzenia systemowych punktów przywracania Windows przed wprowadzeniem zmian w rejestrze lub deinstalacją bloatware.
* Blokujący interfejs z jasną komunikacją zatwierdzenia monitu kontroli konta (UAC).

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
3. Narzędzie `electron-builder` pakuje aplikację do instalatora `.exe` (domyślnie w wersji jednostronicowego instalatora instalującego program w katalogu AppData użytkownika).

Plik wyjściowy `.exe` (np. `my-app Setup 1.0.0.exe`) zostanie wygenerowany w nowo utworzonym folderze **`dist/`** w głównym katalogu projektu.

---

## 🚀 Uruchomienie deweloperskie

Aby uruchomić aplikację w trybie deweloperskim z przeładowywaniem na żywo (Hot Reload):

```bash
npm run dev
```

---

## 👨‍💻 Analiza Rozbudowy (Senior Developer Road-map)

Jako Senior Developer, widzę następujące kierunki rozbudowy aplikacji, które wniosą największą wartość biznesową i techniczną:

### A. Integracja z Harmonogramem Zadań Windows (Task Scheduler API)
* **Obecnie**: Pętla aktualizacji działa w tle tylko wtedy, gdy aplikacja jest zminimalizowana w trayu.
* **Cel**: Rejestrowanie natywnego zadania w harmonogramie Windows (`schtasks.exe`), które uruchomi proces aktualizacji Winget o wybranej godzinie w tle (nawet przy wyłączonej aplikacji).

### B. Wsparcie dla wielu użytkowników i uprawnień (UAC Elevation Service)
* **Obecnie**: Aplikacja prosi o UAC osobno przy instalacji programów, sterowników czy punktów przywracania.
* **Cel**: Wydzielenie małego lokalnego serwisu systemowego (Windows Service) działającego z uprawnieniami SYSTEM. Aplikacja kliencka komunikowałaby się z nim przez IPC (Named Pipes), co eliminowałoby wyskakujące monity UAC podczas codziennych aktualizacji.

### C. Zaawansowana Telemetria Sieciowa i Firewall (DNS/Host Block)
* **Obecnie**: Blokujemy telemetrię na poziomie usług i kluczy rejestru.
* **Cel**: Dodanie modułu automatycznie modyfikującego plik `C:\Windows\System32\drivers\etc\hosts` w celu zablokowania znanych serwerów telemetrycznych Microsoftu, Adobe czy Google na poziomie sieciowym.

---

## 📸 Zrzuty Ekranu

Wszystkie aktualne makiety i zrzuty ekranu znajdują się w folderze `/screen`. 

* **Główny pulpit nawigacyjny (Dashboard)**: `/screen/01.png`
* **Optymalizator dysku i prywatności**: `/screen/02.png`
* **Deinstalator Bloatware**: `/screen/03.png`
