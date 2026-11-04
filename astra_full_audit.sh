#!/usr/bin/env bash
# ==============================================================================
# ПОЛНЫЙ АУДИТ ASTRA LINUX, МЕЖСЕТЕВОГО ЭКРАНА, NGFW-ФИЛЬТРА И KASPERSKY (KESL)
# Запускается в терминале Astra Linux на паре (с sudo или без — собирает максимум).
# Сохраняет отчёт в /tmp/astra_audit.txt и автоматически выгружает его в Firebase.
# ==============================================================================

OUT="/tmp/astra_audit.txt"
FB_URL="https://mentorlink-school-default-rtdb.europe-west1.firebasedatabase.app/messages/astra_audit.json"

exec > >(tee "$OUT") 2>&1

echo "======================================================================"
echo " АУДИТ СИСТЕМЫ И СЕТЕВОГО ФИЛЬТРА ASTRA LINUX — $(date)"
echo "======================================================================"

echo -e "\n=== [1] ВЕРСИЯ ASTRA LINUX, ЯДРО, ПРАВА И ЗПС (PARSEC / DIGSIG) ==="
cat /etc/astra_version 2>/dev/null || true
cat /etc/os-release 2>/dev/null | head -n 8 || true
uname -a
id
which pdp-id >/dev/null 2>&1 && pdp-id || true
echo "--- Статус ЗПС (Замкнутая программная среда / Digsig): ---"
head -n 20 /sys/module/digsig_verif/parameters/* 2>/dev/null || echo "Модуль digsig_verif не активен"
ls -la /etc/digsig/ 2>/dev/null || true
sudo -n true 2>/dev/null && echo "SUDO: Доступен без пароля!" || echo "SUDO: Требует пароль (обычный пользователь)"

echo -e "\n=== [2] АНТИВИРУС (KASPERSKY KESL), КОНТЕНТ-ФИЛЬТРЫ И СЛЕЖКА ЗА ЭКРАНОМ ==="
ps aux | grep -iE "kesl|klnagent|wdav|drweb|veyon|italc|epoptes|vnc|rdesktop|xrdp|zagent|squid|guardian|privoxy|skydns|traffic" | grep -v grep || echo "Спец-процессы не найдены"

if command -v kesl-control >/dev/null 2>&1; then
    echo "--- Найдена утилита kesl-control (Kaspersky Endpoint Security): ---"
    KESL_CMD="kesl-control"
    sudo -n kesl-control --app-info >/dev/null 2>&1 && KESL_CMD="sudo -n kesl-control"
    $KESL_CMD --app-info 2>/dev/null || echo "Нет прав чтения --app-info"
    $KESL_CMD --get-net-settings 2>/dev/null || true
    echo "--- Список всех задач KESL (--get-task-list): ---"
    TASKS_OUT=$($KESL_CMD --get-task-list 2>/dev/null || true)
    echo "$TASKS_OUT"
    # Динамически выгружаем настройки всех найденных задач (Firewall, Web_Control, SSL и т.д.)
    TASK_IDS=$(echo "$TASKS_OUT" | grep -oE "ID[[:space:]]*:[[:space:]]*[0-9]+" | grep -oE "[0-9]+" || echo "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20")
    for tid in $TASK_IDS; do
        echo ">>> Настройки задачи KESL ID=$tid:"
        $KESL_CMD --get-settings "$tid" 2>/dev/null | head -n 60 || true
    done
fi

echo -e "\n=== [3] ПОЛИТИКИ БРАУЗЕРОВ (ЧЁРНЫЕ И БЕЛЫЕ СПИСКИ САЙТОВ В /etc И /usr) ==="
for dir in \
    /etc/yandex/browser/policies/managed \
    /etc/yandex/browser/policies/recommended \
    /etc/chromium/policies/managed \
    /etc/chromium/policies/recommended \
    /etc/opt/chrome/policies/managed \
    /etc/firefox/policies \
    /usr/share/firefox-esr/distribution; do
    if [ -d "$dir" ]; then
        echo ">>> Найдена папка политик: $dir"
        ls -la "$dir"
        head -n 200 "$dir"/* 2>/dev/null || true
    fi
done

echo -e "\n=== [4] СЕТЬ, ШЛЮЗ, МАРШРУТЫ, ПРОКСИ, DNS И HOSTS ==="
ip -br a
ip r
echo "--- Таблица ARP (соседи и MAC-адрес шлюза): ---"
ip neigh show | head -n 25
echo "--- Трассировка первых 5 узлов внутри сети вуза: ---"
tracepath -n -m 5 8.8.8.8 2>/dev/null || traceroute -n -m 5 8.8.8.8 2>/dev/null || true
echo "--- Переменные прокси в окружении и конфигах: ---"
env | grep -iE "proxy|http" || echo "Переменных прокси нет"
cat /etc/environment 2>/dev/null
grep -rn -i "proxy" /etc/apt/apt.conf* /etc/profile* 2>/dev/null || true
echo "--- /etc/resolv.conf (DNS-серверы вуза): ---"
cat /etc/resolv.conf 2>/dev/null
resolvectl status 2>/dev/null | head -n 35 || true
echo "--- /etc/hosts: ---"
cat /etc/hosts 2>/dev/null

echo -e "\n=== [5] ЛОКАЛЬНЫЙ ФАЙРВОЛ (IPTABLES / NFTABLES) И АКТИВНЫЕ СОЕДИНЕНИЯ ==="
sudo -n iptables -L -n -v 2>/dev/null || iptables -L -n -v 2>/dev/null || echo "Чтение iptables требует root"
sudo -n iptables -t nat -L -n -v 2>/dev/null || iptables -t nat -L -n -v 2>/dev/null || true
sudo -n nft list ruleset 2>/dev/null || nft list ruleset 2>/dev/null || true
echo "--- Слушающие сокеты (ss -tulnp): ---"
ss -tulnp 2>/dev/null | head -n 45
echo "--- Активные внешние соединения (ss -tnp): ---"
ss -tnp state established 2>/dev/null | head -n 45

echo -e "\n=== [6] ДЕТЕКТ ТИПА БЛОКИРОВКИ (DNS-ПОДМЕНА vs SSL-MITM vs DPI SNI vs БЛОК-СТРАНИЦА) ==="
echo "--- Сертификаты в /usr/local/share/ca-certificates и /etc/ssl/certs: ---"
ls -la /usr/local/share/ca-certificates/ 2>/dev/null || true
find /etc/ssl/certs /usr/local/share/ca-certificates -iname "*kaspersky*" -o -iname "*usergate*" -o -iname "*ideco*" -o -iname "*sibsiu*" -o -iname "*proxy*" -o -iname "*mitm*" -o -iname "*forti*" -o -iname "*ca*" 2>/dev/null | head -n 40 || true

for host in grzly.ru de.grzly.ru github.com grzlly.github.io do.sibsiu.ru; do
    echo "------------------------------------------------------------------"
    echo ">>> Тест узла: [$host]"
    echo "1) Системный DNS IP: $(getent ahosts "$host" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')"
    echo "2) SSL-сертификат (кто выдал):"
    timeout 4 openssl s_client -connect "${host}:443" -servername "$host" </dev/null 2>/dev/null | grep -E "subject=|issuer=|Verify return code" || echo "   SSL handshake не прошёл / сброшен"
    echo "3) Ответ по HTTPS (заголовки):"
    curl -k -s -I -m 4 "https://${host}" | head -n 8 || echo "   Нет ответа по HTTPS"
    echo "4) Ответ по HTTP (ловим редирект или HTML заглушки фильтра):"
    curl -s -i -m 4 "http://${host}" | head -n 15 || echo "   Нет ответа по HTTP"
done

echo -e "\n=== [7] ТЕСТ ОБХОДА DPI ЧЕРЕЗ ПОДМЕНУ SNI (FAKE SNI ДО ТВОЕГО VPS 185.194.177.44) ==="
VPS_IP="185.194.177.44"
for sni in de.grzly.ru grzlly.github.io do.sibsiu.ru yandex.ru; do
    echo ">>> Подключение к VPS ${VPS_IP}:443 с SNI=[$sni]:"
    timeout 3 openssl s_client -connect "${VPS_IP}:443" -servername "$sni" </dev/null 2>/dev/null | grep -E "Server certificate|subject=|issuer=|Verify return code|New, TLS" || echo "   БЛОК / Сброс соединения"
done

echo -e "\n=== [8] ПРОВЕРКА ОТКРЫТЫХ ПОРТОВ ДО ТВОЕГО VPS (185.194.177.44) И ВНЕШНИХ DNS ==="
for port in 80 443 4445 2053 2087 3478 5349 8080 8443 22; do
    if timeout 2 bash -c "</dev/tcp/${VPS_IP}/${port}" 2>/dev/null; then
        echo "✅ TCP ${VPS_IP}:${port} -> ОТКРЫТ"
    else
        echo "❌ TCP ${VPS_IP}:${port} -> ЗАБЛОКИРОВАН"
    fi
done

for dns_ip in 8.8.8.8 1.1.1.1 77.88.8.8; do
    if timeout 2 bash -c "</dev/tcp/${dns_ip}/53" 2>/dev/null; then
        echo "✅ Прямой DNS TCP ${dns_ip}:53 -> ОТКРЫТ"
    else
        echo "❌ Прямой DNS TCP ${dns_ip}:53 -> ЗАБЛОКИРОВАН"
    fi
done

echo -e "\n=== [9] ПРОВЕРКА ДОСТУПНОСТИ ОБЛАЧНЫХ API И СЕРВИСОВ ==="
for url in \
    "https://do.sibsiu.ru/day/" \
    "https://grzlly.github.io" \
    "https://mentorlink-school-default-rtdb.europe-west1.firebasedatabase.app/.json?shallow=true" \
    "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js" \
    "https://de.grzly.ru" \
    "https://cdn.grzly.ru" \
    "https://grzly.ru" \
    "https://yandex.ru" \
    "https://vk.com" \
    "https://cdn.jsdelivr.net" \
    "https://dns.google/resolve?name=grzly.ru&type=A" \
    "https://cloudflare-dns.com/dns-query?name=grzly.ru&type=A"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 4 -H "accept: application/dns-json" "$url" 2>/dev/null)
    if [ "$code" != "000" ]; then
        echo "✅ ДОСТУПЕН [HTTP $code]: $url"
    else
        echo "❌ БЛОК     [HTTP 000]: $url"
    fi
done

echo -e "\n=== [10] НАЛИЧИЕ УТИЛИТ X11, PYTHON И СРЕДСТВ ЗАХВАТА ЭКРАНА ==="
for cmd in python3 curl wget xwd import scrot ffmpeg xclip xsel xdotool xprop wmctrl notify-send qdbus ssh git nc socat; do
    if command -v "$cmd" >/dev/null 2>&1; then
        echo "✅ Установлен: $cmd ($(command -v "$cmd"))"
    else
        echo "❌ Нет: $cmd"
    fi
done

echo -e "\n======================================================================"
echo " АУДИТ ЗАВЕРШЁН. Полный отчёт сохранён в: $OUT"
echo "======================================================================"

# Автоматическая выгрузка полного текстового отчёта в твой Firebase
if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, urllib.request
with open("/tmp/astra_audit.txt", "r", encoding="utf-8", errors="replace") as f:
    text = f.read()
data = json.dumps({"timestamp": "'"$(date -Iseconds)"'", "report": text}).encode("utf-8")
req = urllib.request.Request("'"$FB_URL"'", data=data, headers={"Content-Type": "application/json"}, method="PUT")
try:
    urllib.request.urlopen(req, timeout=6)
    print("\n[>>>] ОТЧЁТ УСПЕШНО ВЫГРУЖЕН В ТВОЙ FIREBASE (/astra_audit.json)!")
except Exception as e:
    print("\n[!] Не удалось выгрузить в Firebase:", e)
'
fi
