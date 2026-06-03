# Windows Updater & Optimizer 🚀

Kompleksowe, nowoczesne i bezpieczne narzędzie do zarządzania aktualizacjami oprogramowania, sterowników oraz optymalizacji systemu Windows. Aplikacja została zbudowana na fundamencie **Electron + React + TypeScript + Prisma + SQLite** z zachowaniem najwyższej dbałości o estetykę (Glassmorphism Dark Mode) i stabilność działania.

---

## 🌟 Główne Funkcjonalności

### 1. 🔄 Menedżer Aktualizacji (Winget Integration)

- Automatyczne wykrywanie programów posiadających nowsze wersje w repozytorium **WinGet**.
- Bezpieczna instalacja i aktualizacja jednym kliknięciem.
- Pętla sprawdzania aktualizacji w tle z możliwością konfiguracji harmonogramu i automatyczną instalacją (dla wszystkich aplikacji lub zdefiniowanej białej listy).

### 2. ⚡ Szybki Instalator Pakietowy (Multi-Installer)

- Kafelkowy katalog popularnego darmowego oprogramowania pogrupowany tematycznie (Przeglądarki, Narzędzia, Rozrywka, Programowanie).
- Sekwencyjne instalowanie wielu zaznaczonych aplikacji w tle za pomocą WinGet z pełną obsługą cichej instalacji.
- Obsługa i wizualizacja statusu kolejki instalacyjnej w czasie rzeczywistym.

### 3. 🛡️ Optymalizator Telemetrii, Prywatności & Game Booster

- Blokowanie zbędnego śledzenia, diagnostyki i wysyłania danych (DiagTrack) oraz raportowania błędów (WerSvc).
- Dezaktywacja Cortany i wyszukiwarki Bing w menu Start, oraz blokada reklam i promowanych gier.
- **DNS & Hosts Modifier**: Sieciowe blokowanie telemetrii Microsoft, Nvidia, Adobe na poziomie pliku `hosts`.
- **Game Booster (Tryb Gry)**:
  - Automatyczna detekcja uruchomienia procesów gier w tle (w tym skanowanie bibliotek Steam).
  - Aktywacja systemowego profilu zasilania **Najwyższa wydajność** (Ultimate Performance).
  - Obniżenie pingu poprzez optymalizację opóźnień sieciowych w rejestrze (wyłączenie algorytmu Nagle'a).
  - Tymczasowe wyłączanie zbędnych usług systemowych w tle (`SysMain`, `Spooler`) na czas grania, z automatycznym przywracaniem po wyłączeniu trybu gry.
  - Optymalizacja procesowa: nakładanie maski koligacji wątków logicznych (**CPU Core Affinity**) w celu ograniczania gry wyłącznie do rdzeni wydajnościowych **P-Cores** (pomijając rdzenie E-Cores), co zapobiega mikroprzycięciom na procesorach hybrydowych Intel/AMD.

### 4. 🧹 Głębokie Czyszczenie Dysku (Extended Disk Cleaner) & Harmonogram w Tle

- Szybkie skanowanie i czyszczenie folderów tymczasowych (`Temp`), logów systemowych oraz pamięci podręcznej przeglądarek.
- Czyszczenie katalogów `Prefetch` oraz bufora pobierania Windows Update (`SoftwareDistribution\Download`).
- **Automatyczny Harmonogram Czyszczenia**: Skonfigurowana pętla w procesie głównym automatycznie oczyszczająca wybrane ścieżki i pliki tymczasowe w wybranym interwale (codziennie, co tydzień, co miesiąc).

### 5. 🗑️ Inteligentny Deinstalator i Leftovers Cleaner

- Detekcja preinstalowanego oprogramowania bloatware Windows (UWP) oraz tradycyjnych aplikacji desktopowych (Win32).
- **Leftovers Cleaner**: po pomyślnym odinstalowaniu aplikacji program automatycznie przeszukuje i proponuje usunięcie osieroconych plików w katalogach `AppData`, `Program Files`, `ProgramData` oraz kluczy rejestru systemowego (`HKCU` i `HKLM`) powiązanych z aplikacją i jej wydawcą.
- Interaktywna checklista wykrytych pozostałości pozwalająca trwale i bezpiecznie oczyścić system.

### 6. 🔒 Bezpieczeństwo, Hardening Systemu & Sieci

- **System Hardening**: Procedury PowerShell zabezpieczające komputer przed atakami sieciowymi poprzez blokadę zdalnego pulpitu (RDP), wyłączenie domyślnych udziałów administracyjnych (Admin$ i AutoShareWks) oraz wyłączenie podatnej usługi Bufora Wydruku (Print Spooler).
- **Automatyzacja Windows Defender**: Harmonogramowanie pełnych skanów antywirusowych Defender w godzinach nocnych.
- **DNS Hardening**: Zintegrowana konfiguracja **DNS-over-HTTPS (DoH)** dla kart sieciowych.
- **Network Hardening**: Dezaktywacja przestarzałych protokołów rozgłoszeniowych **LLMNR** oraz **NetBIOS over TCP/IP** w celu zapobiegania atakom zatruwania nazw (np. mitm/Responder).

### 7. 📊 Specyfikacja Sprzętowa, Sterowniki & Benchmark Hub

- **Karta Specyfikacji Technicznej**: dynamiczne parsowanie internetowych baz danych (DuckDuckGo HTML parser) w celu pozyskania szczegółowej karty katalogowej podzespołów użytkownika (litografia, socket, TDP, data premiery, przepustowość pamięci GPU/RAM).
- **Aktualizator Sterowników**: skanowanie sterowników w oparciu o identyfikatory sprzętowe (Hardware IDs) z bezobsługową instalacją aktualizacji w tle.
- **Benchmark Hub**: jednowątkowe oraz wielowątkowe (Node.js worker threads) testy wydajności procesora (CPU), RAM oraz sekwencyjnego zapisu/odczytu dysków twardych.
- **Globalny Ranking**: porównanie wyników benchmarków z wynikami innych użytkowników na świecie (wykresy rozkładu Gaussa, klasyfikacja centylowa) z integracją HTTPS online.

### 8. ☁️ Chmurowy Ekosystem, Kopia Profilu & Telemetria

- **Kopia profilu (Eksport/Import)**: łatwy eksport i import pełnego profilu konfiguracyjnego aplikacji wraz ze spersonalizowanymi nazwami/opisami programów do pliku JSON.
- **Synchronizacja Chmurowa (Cloud Sync)**: automatyczna i ręczna synchronizacja konfiguracji użytkownika z chmurą za pośrednictwem mock API HTTPS.
- **Telemetria diagnostyczna**: możliwość włączenia zanonimizowanego raportowania konfiguracji sprzętowej w celu wsparcia rozwoju projektu.

### 9. 💾 Kopia Zapasowa & Menedżer Przywracania

- Tworzenie punktów przywracania Windows przed wprowadzaniem modyfikacji w systemie.
- Wbudowany **Menedżer Przywracania (Rollback Manager)** umożliwiający uruchomienie systemowego narzędzia przywracania bezpośrednio z poziomu aplikacji.

### 10. 📱 Zdalny Monitoring & Web Dashboard w Przeglądarce

- **Lokalny serwer HTTP**: uruchamianie wbudowanego, lekkiego serwera HTTP w tle (domyślnie na porcie `9090`).
- **Autoryzacja kodem PIN**: generowanie unikalnego losowego kodu PIN przy każdym starcie aplikacji desktopowej w celu zabezpieczenia dostępu do danych w sieci lokalnej (LAN).
- **Wizualizacja stanu na żywo**: dynamiczne, kołowe wykresy SVG pokazujące zużycie procesora (CPU), pamięci RAM oraz wolnego dysku systemowego w czasie rzeczywistym (wykres dysku reprezentuje wolne miejsce w formacie `Wolne: X / Y GB`).
- **Temperatury podzespołów**: zaawansowany i odporny na brak uprawnień administratora system odczytu temperatur CPU (odpytujący naraz w PowerShell klasy `MSAcpi`, `Win32_PerfFormattedData_Counters_ThermalZoneInformation` i `Win32_TemperatureSensor` z inteligentną estymacją w oparciu o obciążenie jako fallback) oraz karty graficznej (GPU).
- **Szczegółowa Specyfikacja & Sieć**: wyświetlanie na żywo specyfikacji sprzętu (dokładny model CPU, model GPU wraz z bieżącym obciążeniem %, wersja systemu operacyjnego z architekturą, adres IP) oraz telemetrii sieci (nazwa aktywnej karty sieciowej i prędkość pobierania/wysyłanie w czasie rzeczywistym).
- **Zdalne Zarządzanie i Zasilanie**: możliwość zdalnego uruchomienia czyszczenia systemu, przełączania Trybu Gry (Game Booster) wraz ze zwalnianiem procesów (Kill Process) bezpośrednio z poziomu przeglądarki, a także zdalnego wyłączenia i restartu komputera (zabezpieczone dodatkowym oknem modalnym potwierdzającym wybór).

---

## 🛠️ Architektura i Stos Technologiczny

- **Core**: Electron (proces główny Main & Preload)
- **Frontend**: React.js z pełnym typowaniem TypeScript
- **Stylizacja**: Niestandardowy system CSS (Glassmorphism, płynne mikro-animacje, ciemny motyw oparty na zmiennych HSL)
- **Ikony**: Lucide React
- **Baza danych**: SQLite zarządzany poprzez ORM Prisma (konfiguracja, historia aktualizacji, lista spersonalizowanych aplikacji)

---

## 📦 Jak wygenerować plik instalacyjny (.exe)?

> [!IMPORTANT]
> Środowisko **Node.js** oraz menedżer pakietów **npm** są wymagane **wyłącznie** do budowania, rozwoju (developmentu) oraz kompilowania aplikacji ze źródeł. Gotowy plik instalacyjny `.exe` (stworzony po skompilowaniu) jest w pełni samodzielny i **nie wymaga** obecności Node.js na komputerze użytkownika końcowego.

Aplikacja wykorzystuje narzędzie **electron-builder** do pakowania kodu w samodzielną aplikację dla systemu Windows.

### Krok 1: Wymagania deweloperskie (Wstępne)

Upewnij się, że masz zainstalowany program **Node.js** (zalecana wersja LTS) na maszynie deweloperskiej, a następnie zainstaluj wszystkie zależności projektowe:

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

## 🚀 Uruchomienie deweloperskie (Uruchamianie ze źródeł)

Jeśli pobrałeś kod źródłowy projektu (np. jako plik ZIP lub przez `git clone`), możesz uruchomić aplikację dewelopersko w systemie Windows na dwa sposoby:

### Sposób A: Automatyczne skrypty (Najprostszy i bezproblemowy)
W głównym folderze projektu przygotowaliśmy skrypty `.bat`, które automatycznie otwierają konsolę w odpowiednim folderze i omijają blokady bezpieczeństwa PowerShell:
1. Kliknij dwukrotnie plik **`instaluj-zaleznosci.bat`** (zainstaluje wymagane biblioteki).
2. Kliknij dwukrotnie plik **`uruchom-dewelopersko.bat`** (uruchomi aplikację w trybie testowym).

---

### Sposób B: Ręczne uruchomienie w konsoli
1. Upewnij się, że masz zainstalowany program **Node.js** na swoim komputerze.
2. Otwórz konsolę (np. PowerShell lub CMD) i przejdź do folderu z projektem:
   ```powershell
   cd "C:\Sciezka\Do\Katalogu\updater-win-master"
   ```
3. Zainstaluj wymagane zależności:
   ```powershell
   npm install
   ```
4. Uruchom aplikację:
   ```powershell
   npm run dev
   ```

---

## 🔍 Rozwiązywanie problemów (Troubleshooting)

### 1. Błąd: `File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled...`
Ten błąd oznacza, że system Windows blokuje uruchamianie skryptów PowerShell. 
* **Rozwiązanie 1**: Uruchom pliki skrótów **`instaluj-zaleznosci.bat`** oraz **`uruchom-dewelopersko.bat`** zamiast ręcznego wpisywania komend. Batche uruchamiają się w CMD i nie są blokowane.
* **Rozwiązanie 2**: Otwórz konsolę PowerShell i wpisz:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
  Zatwierdź wpisując `T` (lub `Y`), co odblokuje wykonywanie skryptów dla Twojego konta.
* **Rozwiązanie 3**: Przejdź do folderu `C:\Program Files\nodejs\` i usuń plik `npm.ps1`. PowerShell automatycznie zacznie korzystać z bezpiecznego pliku `npm.cmd`.

### 2. Błąd: `npm error code ENOENT ... open 'C:\Users\...\package.json'`
Uruchomiłeś komendę `npm install` lub `npm run dev` w złym folderze (np. bezpośrednio w profilu użytkownika `C:\Users\PC`).
* **Rozwiązanie**: Upewnij się, że przed wpisaniem komendy przeszedłeś do właściwego folderu projektu za pomocą komendy `cd` (np. `cd C:\Users\PC\Desktop\updater-win-master`).

---

## 📸 Zrzuty Ekranu

Wszystkie aktualne makiety i zrzuty ekranu znajdują się w folderze `/screen`.

- **Główny pulpit nawigacyjny (Dashboard)**: `/screen/01.png`
- **Optymalizator dysku i prywatności**: `/screen/02.png`
- **Deinstalator Bloatware**: `/screen/03.png`
