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
  - Automatyczna detekcja uruchomienia procesów gier w tle (w tym skanowanie bibliotek Steam).
  - Aktywacja systemowego profilu zasilania **Najwyższa wydajność** (Ultimate Performance).
  - Obniżenie pingu poprzez optymalizację opóźnień sieciowych w rejestrze (wyłączenie algorytmu Nagle'a).
  - Tymczasowe wyłączanie zbędnych usług systemowych w tle (`SysMain`, `Spooler`) na czas grania, z automatycznym przywracaniem po wyłączeniu trybu gry.
  - Optymalizacja procesowa: nakładanie maski koligacji wątków logicznych (**CPU Core Affinity**) w celu ograniczania gry wyłącznie do rdzeni wydajnościowych **P-Cores** (pomijając rdzenie E-Cores), co zapobiega mikroprzycięciom na procesorach hybrydowych Intel/AMD.

### 4. 🧹 Głębokie Czyszczenie Dysku (Extended Disk Cleaner) & Harmonogram w Tle
* Szybkie skanowanie i czyszczenie folderów tymczasowych (`Temp`), logów systemowych oraz pamięci podręcznej przeglądarek.
* Czyszczenie katalogów `Prefetch` oraz bufora pobierania Windows Update (`SoftwareDistribution\Download`).
* **Automatyczny Harmonogram Czyszczenia**: Skonfigurowana pętla w procesie głównym automatycznie oczyszczająca wybrane ścieżki i pliki tymczasowe w wybranym interwale (codziennie, co tydzień, co miesiąc).

### 5. 🗑️ Inteligentny Deinstalator i Leftovers Cleaner
* Detekcja preinstalowanego oprogramowania bloatware Windows (UWP) oraz tradycyjnych aplikacji desktopowych (Win32).
* **Leftovers Cleaner**: po pomyślnym odinstalowaniu aplikacji program automatycznie przeszukuje i proponuje usunięcie osieroconych plików w katalogach `AppData`, `Program Files`, `ProgramData` oraz kluczy rejestru systemowego (`HKCU` i `HKLM`) powiązanych z aplikacją i jej wydawcą.
* Interaktywna checklista wykrytych pozostałości pozwalająca trwale i bezpiecznie oczyścić system.

### 6. 🔒 Bezpieczeństwo, Hardening Systemu & Sieci
* **System Hardening**: Procedury PowerShell zabezpieczające komputer przed atakami sieciowymi poprzez blokadę zdalnego pulpitu (RDP), wyłączenie domyślnych udziałów administracyjnych (Admin$ i AutoShareWks) oraz wyłączenie podatnej usługi Bufora Wydruku (Print Spooler).
* **Automatyzacja Windows Defender**: Harmonogramowanie pełnych skanów antywirusowych Defender w godzinach nocnych.
* **DNS Hardening**: Zintegrowana konfiguracja **DNS-over-HTTPS (DoH)** dla kart sieciowych.
* **Network Hardening**: Dezaktywacja przestarzałych protokołów rozgłoszeniowych **LLMNR** oraz **NetBIOS over TCP/IP** w celu zapobiegania atakom zatruwania nazw (np. mitm/Responder).

### 7. 📊 Specyfikacja Sprzętowa, Sterowniki & Benchmark Hub
* **Karta Specyfikacji Technicznej**: dynamiczne parsowanie internetowych baz danych (DuckDuckGo HTML parser) w celu pozyskania szczegółowej karty katalogowej podzespołów użytkownika (litografia, socket, TDP, data premiery, przepustowość pamięci GPU/RAM).
* **Aktualizator Sterowników**: skanowanie sterowników w oparciu o identyfikatory sprzętowe (Hardware IDs) z bezobsługową instalacją aktualizacji w tle.
* **Benchmark Hub**: jednowątkowe oraz wielowątkowe (Node.js worker threads) testy wydajności procesora (CPU), RAM oraz sekwencyjnego zapisu/odczytu dysków twardych.
* **Globalny Ranking**: porównanie wyników benchmarków z wynikami innych użytkowników na świecie (wykresy rozkładu Gaussa, klasyfikacja centylowa) z integracją HTTPS online.

### 8. ☁️ Chmurowy Ekosystem, Kopia Profilu & Telemetria
* **Kopia profilu (Eksport/Import)**: łatwy eksport i import pełnego profilu konfiguracyjnego aplikacji wraz ze spersonalizowanymi nazwami/opisami programów do pliku JSON.
* **Synchronizacja Chmurowa (Cloud Sync)**: automatyczna i ręczna synchronizacja konfiguracji użytkownika z chmurą za pośrednictwem mock API HTTPS.
* **Telemetria diagnostyczna**: możliwość włączenia zanonimizowanego raportowania konfiguracji sprzętowej w celu wsparcia rozwoju projektu.

### 9. 💾 Kopia Zapasowa & Menedżer Przywracania
* Tworzenie punktów przywracania Windows przed wprowadzaniem modyfikacji w systemie.
* Wbudowany **Menedżer Przywracania (Rollback Manager)** umożliwiający uruchomienie systemowego narzędzia przywracania bezpośrednio z poziomu aplikacji.

### 10. 📱 Zdalny Monitoring & Web Dashboard w Przeglądarce
* **Lokalny serwer HTTP**: uruchamianie wbudowanego, lekkiego serwera HTTP w tle (domyślnie na porcie `9090`).
* **Autoryzacja kodem PIN**: generowanie unikalnego losowego kodu PIN przy każdym starcie aplikacji desktopowej w celu zabezpieczenia dostępu do danych w sieci lokalnej (LAN).
* **Wizualizacja stanu na żywo**: dynamiczne, kołowe wykresy SVG pokazujące zużycie procesora (CPU), pamięci RAM oraz dysku systemowego w czasie rzeczywistym.
* **Temperatury podzespołów**: zdalny odczyt temperatur procesora (CPU) oraz karty graficznej (GPU) z czerwonym podświetleniem ostrzegawczym w przypadku przegrzania (>80°C).
* **Zdalne Zarządzanie i Zasilanie**: możliwość zdalnego uruchomienia czyszczenia systemu, przełączania Trybu Gry (Game Booster) oraz zdalnego wyłączenia i restartu komputera (zabezpieczone dodatkowym oknem modalnym potwierdzającym wybór).

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
