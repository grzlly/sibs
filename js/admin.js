(function () {
  'use strict';

  const FB_BASE = 'https://mentorlink-school-default-rtdb.europe-west1.firebasedatabase.app/messages/sib_exam';
  const VPS_BASE = window.__SIB_VPS_URL || '';

  // Иконки из D:\tabler-icons-3.50.0 (outline)
  const ICONS = {
    photo: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>',
    bolt: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" /></svg>',
    link: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>',
    listCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M3.5 5.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 11.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 17.5l1.5 1.5l2.5 -2.5" /><path d="M11 6l9 0" /><path d="M11 12l9 0" /><path d="M11 18l9 0" /></svg>',
    drag: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M18 9l3 3l-3 3" /><path d="M15 12h6" /><path d="M6 9l-3 3l3 3" /><path d="M3 12h6" /><path d="M9 18l3 3l3 -3" /><path d="M12 15v6" /><path d="M15 6l-3 -3l-3 3" /><path d="M12 3v6" /></svg>',
    code: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M5 12l5 5l10 -10" /></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>'
  };

  const studentSelect = document.getElementById('studentSelect');
  const topStatusDot = document.getElementById('topStatusDot');
  const connectionStatusText = document.getElementById('connectionStatusText');
  const transportBadge = document.getElementById('transportBadge');
  const transportDot = document.getElementById('transportDot');
  const transportNameText = document.getElementById('transportNameText');
  const popupBadge = document.getElementById('popupBadge');
  const sessionTimer = document.getElementById('sessionTimer');
  const qTotalCount = document.getElementById('qTotalCount');
  const studentPageInfo = document.getElementById('studentPageInfo');
  const questionsBoard = document.getElementById('questionsBoard');
  const mirrorContainer = document.getElementById('mirrorContainer');
  const mirrorFrame = document.getElementById('mirrorFrame');
  const remoteCursor = document.getElementById('remoteCursor');
  const answersHistoryList = document.getElementById('answersHistoryList');
  const sentAnswersCount = document.getElementById('sentAnswersCount');

  const quickQNum = document.getElementById('quickQNum');
  const quickOptIdx = document.getElementById('quickOptIdx');
  const quickAnswerText = document.getElementById('quickAnswerText');
  const btnQuickSend = document.getElementById('btnQuickSend');
  const btnQuickAutoApply = document.getElementById('btnQuickAutoApply');
  const btnFetchAllPages = document.getElementById('btnFetchAllPages');
  const btnClearSession = document.getElementById('btnClearSession');

  const tabQuestionsBtn = document.getElementById('tabQuestionsBtn');
  const tabMirrorBtn = document.getElementById('tabMirrorBtn');
  const imgZoomModal = document.getElementById('imgZoomModal');
  const imgZoomTarget = document.getElementById('imgZoomTarget');

  let activeStudentId = '';
  let sessionsCache = {};
  let lastRenderedQuestionsJson = '';
  let lastMirrorTime = 0;
  let lastMirrorHtml = '';
  let lastUserInteractTime = 0;
  let curatorChoices = {};
  let startTime = Date.now();
  let activeTransport = 'firebase'; // 'p2p' | 'firebase' | 'vps'

  // WebRTC Responder
  let rtcPeer = null;
  let rtcDataChannel = null;
  let rtcAnswerSentFor = '';

  async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return resp;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  function updateTransportUI() {
    if (!transportNameText || !transportDot) return;
    if (activeTransport === 'p2p') {
      transportDot.style.background = '#10b981';
      transportDot.style.boxShadow = '0 0 8px #10b981';
      transportNameText.textContent = 'P2P Direct (WebRTC)';
      if (transportBadge) transportBadge.style.borderColor = 'rgba(16,185,129,0.3)';
    } else if (activeTransport === 'vps') {
      transportDot.style.background = '#8b5cf6';
      transportDot.style.boxShadow = '0 0 8px #8b5cf6';
      transportNameText.textContent = 'Резерв (VPS Relay)';
      if (transportBadge) transportBadge.style.borderColor = 'rgba(139,92,246,0.3)';
    } else {
      transportDot.style.background = '#38bdf8';
      transportDot.style.boxShadow = '0 0 8px #38bdf8';
      transportNameText.textContent = 'Облако (Firebase)';
      if (transportBadge) transportBadge.style.borderColor = 'rgba(56,189,248,0.3)';
    }
  }

  setInterval(() => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    sessionTimer.textContent = `${h}:${m}:${s}`;
  }, 1000);

  tabQuestionsBtn.onclick = () => {
    tabQuestionsBtn.classList.add('active');
    tabMirrorBtn.classList.remove('active');
    questionsBoard.style.display = 'flex';
    mirrorContainer.style.display = 'none';
  };
  tabMirrorBtn.onclick = () => {
    tabMirrorBtn.classList.add('active');
    tabQuestionsBtn.classList.remove('active');
    questionsBoard.style.display = 'none';
    mirrorContainer.style.display = 'block';
    const sess = sessionsCache[activeStudentId];
    if (sess && sess.mirror && sess.mirror.html) {
      mirrorFrame.srcdoc = sess.mirror.html;
    }
  };

  // Интерактивное управление через зеркало: выбор вариантов и списков прямо в iframe мгновенно отправляет ответ ученику
  mirrorFrame.addEventListener('load', () => {
    try {
      const doc = mirrorFrame.contentDocument || mirrorFrame.contentWindow?.document;
      if (!doc || !doc.body || doc.__sibBound) return;
      doc.__sibBound = true;

      doc.addEventListener('click', () => {
        lastUserInteractTime = Date.now();
      }, true);

      doc.addEventListener('change', (e) => {
        lastUserInteractTime = Date.now();
        const target = e.target;
        if (!target) return;
        const qEl = target.closest('.que');
        const qNo = qEl?.querySelector('.info .no, h3.no')?.textContent?.replace(/\D/g, '') || '1';

        if (target.tagName === 'SELECT') {
          const val = target.options[target.selectedIndex]?.textContent || '';
          if (val && !/выберите|choose/i.test(val)) {
            const allSelects = Array.from(qEl.querySelectorAll('select'));
            const sIdx = allSelects.indexOf(target) + 1;
            sendAnswerToStudent(qNo, `${sIdx > 0 ? sIdx + '. ' : ''}${val}`, '', false, true, { matchIndex: sIdx, matchText: val });
          }
        } else if (target.type === 'radio' || target.type === 'checkbox') {
          if (target.checked) {
            const container = target.closest('.r0, .r1, div, label') || target.parentElement;
            const text = container ? (container.innerText || container.textContent || '').trim() : '';
            sendAnswerToStudent(qNo, text, '', false, true);
          }
        }
      });
    } catch (err) {}
  });

  imgZoomModal.onclick = () => { imgZoomModal.style.display = 'none'; };
  window.zoomExamImage = function (src) {
    imgZoomTarget.src = src;
    imgZoomModal.style.display = 'flex';
  };

  function enableTabIndentation(textarea) {
    if (!textarea || textarea.__tabBound) return;
    textarea.__tabBound = true;
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
      }
    });
  }
  enableTabIndentation(quickAnswerText);

  function encodeUtf8Base64(str) {
    try {
      return btoa(unescape(encodeURIComponent(String(str || '').replace(/\r\n/g, '\n'))));
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  async function sendAnswerToStudent(qNum, rawText, optionIndex, isCode, autoApplyNow, extra) {
    if (!activeStudentId) {
      alert('Сначала дождитесь подключения ученика');
      return;
    }
    const cleanQNum = String(qNum || '1').trim();
    const normalizedText = String(rawText || '').replace(/\r\n/g, '\n');
    const payload = {
      qNum: cleanQNum,
      text: normalizedText,
      code: isCode ? normalizedText : '',
      codeBase64: isCode ? encodeUtf8Base64(normalizedText) : '',
      isCode: !!isCode,
      optionIndex: String(optionIndex || '').trim(),
      ...(extra || {}),
      timestamp: Date.now(),
      viewedByStudent: false
    };

    // 1. Прямая отправка по WebRTC P2P (если канал открыт)
    if (rtcDataChannel && rtcDataChannel.readyState === 'open') {
      try {
        rtcDataChannel.send(JSON.stringify({
          inbox: {
            answers: { [cleanQNum]: payload },
            ...(autoApplyNow ? { autoApply: payload } : {})
          }
        }));
      } catch (e) {}
    }

    // 2. Отправка в Firebase
    try {
      await fetchWithTimeout(`${FB_BASE}/sessions/${activeStudentId}/inbox/answers/${cleanQNum}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3000);

      if (autoApplyNow) {
        await fetchWithTimeout(`${FB_BASE}/sessions/${activeStudentId}/inbox/autoApply.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 3000);
      }
    } catch (e) {}

    // 3. Дублирование на VPS Relay
    try {
      await fetchWithTimeout(`${VPS_BASE}/api/sync/session/${activeStudentId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3000);
      if (autoApplyNow) {
        await fetchWithTimeout(`${VPS_BASE}/api/sync/session/${activeStudentId}/autoApply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 3000);
      }
    } catch (e) {}

    pollSessions();
  }

  window.sendCardAnswer = function (qNum, isCode, autoApplyNow) {
    const txtEl = document.getElementById(`ans-input-${qNum}`);
    const optEl = document.getElementById(`ans-opt-${qNum}`);
    const val = txtEl ? txtEl.value : '';
    const opt = optEl ? optEl.value : '';
    sendAnswerToStudent(qNum, val, opt, isCode, autoApplyNow);
  };

  window.quickPickChoice = function (qNum, optIndex, choiceLetter, choiceText, autoApplyNow) {
    const txtEl = document.getElementById(`ans-input-${qNum}`);
    const optEl = document.getElementById(`ans-opt-${qNum}`);
    const formatted = `${choiceLetter}) ${choiceText}`;
    if (txtEl) txtEl.value = formatted;
    if (optEl) optEl.value = String(optIndex);
    sendAnswerToStudent(qNum, formatted, String(optIndex), false, autoApplyNow);
  };

  window.pickMatchRow = function (qNum, rowIndex, value, autoApplyNow) {
    if (!value) {
      alert('Сначала выберите вариант из выпадающего списка');
      return;
    }
    const formatted = `${rowIndex}. ${value}`;
    const txtEl = document.getElementById(`ans-input-${qNum}`);
    if (txtEl) {
      const current = txtEl.value ? txtEl.value.split('\n') : [];
      let updated = false;
      const newLines = current.map(line => {
        if (line.startsWith(`${rowIndex}.`) || line.startsWith(`${rowIndex} -`) || line.startsWith(`${rowIndex})`)) {
          updated = true;
          return formatted;
        }
        return line;
      });
      if (!updated) newLines.push(formatted);
      txtEl.value = newLines.join('\n');
    }
    sendAnswerToStudent(qNum, formatted, '', false, autoApplyNow, { matchIndex: rowIndex, matchText: value });
  };

  window.pickSelectGroup = function (qNum, groupIndex, value, autoApplyNow) {
    if (!value) {
      alert('Сначала выберите вариант из выпадающего списка');
      return;
    }
    const formatted = `Пропуск ${groupIndex}: ${value}`;
    const txtEl = document.getElementById(`ans-input-${qNum}`);
    if (txtEl) txtEl.value = formatted;
    sendAnswerToStudent(qNum, formatted, '', false, autoApplyNow, { matchIndex: groupIndex, matchText: value });
  };

  btnQuickSend.onclick = () => {
    const qNum = quickQNum.value || '1';
    const opt = quickOptIdx.value || '';
    const txt = quickAnswerText.value || '';
    const isCode = txt.includes('\n');
    sendAnswerToStudent(qNum, txt, opt, isCode, false);
  };

  btnQuickAutoApply.onclick = () => {
    const qNum = quickQNum.value || '1';
    const opt = quickOptIdx.value || '';
    const txt = quickAnswerText.value || '';
    const isCode = txt.includes('\n');
    sendAnswerToStudent(qNum, txt, opt, isCode, true);
  };

  btnFetchAllPages.onclick = async () => {
    if (!activeStudentId) return;
    const p = { timestamp: Date.now() };
    if (rtcDataChannel && rtcDataChannel.readyState === 'open') {
      try {
        rtcDataChannel.send(JSON.stringify({ inbox: { fetchAllPages: p } }));
      } catch (e) {}
    }
    try {
      await fetchWithTimeout(`${FB_BASE}/sessions/${activeStudentId}/inbox/fetchAllPages.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }, 3000);
    } catch (e) {}
    try {
      await fetchWithTimeout(`${VPS_BASE}/api/sync/session/${activeStudentId}/fetchAllPages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }, 3000);
    } catch (e) {}

    btnFetchAllPages.innerHTML = `${ICONS.check} <span>Запрос отправлен ученику...</span>`;
    setTimeout(() => {
      btnFetchAllPages.innerHTML = `${ICONS.download} <span>Собрать все страницы</span>`;
    }, 3000);
  };

  btnClearSession.onclick = async () => {
    if (!activeStudentId) return;
    if (!confirm('Очистить сессию текущего ученика?')) return;
    try {
      await fetchWithTimeout(`${FB_BASE}/sessions/${activeStudentId}.json`, { method: 'DELETE' }, 3000);
    } catch (e) {}
    try {
      await fetchWithTimeout(`${VPS_BASE}/api/sync/session/${activeStudentId}`, { method: 'DELETE' }, 3000);
    } catch (e) {}
    activeStudentId = '';
    lastRenderedQuestionsJson = '';
    questionsBoard.innerHTML = `
      <div class="empty-state-card">
        <div class="radar-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12l0 .01" /><path d="M14.828 9.172a4 4 0 0 1 0 5.656" /><path d="M17.657 6.343a8 8 0 0 1 0 11.314" /><path d="M9.168 14.828a4 4 0 0 1 0 -5.656" /><path d="M6.337 17.657a8 8 0 0 1 0 -11.314" /></svg>
        </div>
        <h3>Ожидание запуска F12-скрипта у ученика...</h3>
        <p>Как только ученик выполнит команду в консоли браузера на тесте, здесь появятся вопросы, варианты ответов, картинки и поля для ввода.</p>
        <div class="f12-copy-box" onclick="navigator.clipboard.writeText('eval(await (await fetch(\'https://grzlly.github.io/sibs/1.js?t=\' + Date.now())).text())'); alert('Команда скопирована!');" title="Прямой надёжный канал (GitHub Pages)">
          <code>eval(await (await fetch('https://grzlly.github.io/sibs/1.js?t=' + Date.now())).text())</code>
          <span class="copy-badge">GitHub</span>
        </div>
      </div>
    `;
    pollSessions();
  };

  studentSelect.onchange = () => {
    activeStudentId = studentSelect.value;
    lastRenderedQuestionsJson = '';
    renderActiveSession();
  };

  function renderQuestionsList(questionsObj, inboxObj, activePageQuestions, isAttemptActive, meta, isOnline) {
    if (!isAttemptActive) {
      qTotalCount.textContent = '0';
      const sig = 'inactive_' + (isOnline ? 'online' : 'offline') + '_' + (meta?.url || '');
      if (sig === lastRenderedQuestionsJson) return;
      lastRenderedQuestionsJson = sig;

      if (isOnline) {
        questionsBoard.innerHTML = `
          <div class="empty-state-card">
            <div class="radar-icon-wrap" style="color:var(--accent-amber);border-color:rgba(245,158,11,0.25);background:rgba(245,158,11,0.08);">
              ${ICONS.listCheck}
            </div>
            <h3>Тест сейчас не запущен</h3>
            <p>Ученик в сети (<strong>${escapeHtml(meta?.studentName || activeStudentId)}</strong>), но тестирование не начато.<br>
            Текущая страница: <code>${escapeHtml(meta?.pageTitle || meta?.url || 'view.php')}</code>.<br>
            Кнопки выбора и отправки вариантов заблокированы. Как только ученик нажмёт «Начать попытку», вопросы текущего теста автоматически появятся здесь.</p>
          </div>`;
      } else {
        questionsBoard.innerHTML = `
          <div class="empty-state-card">
            <div class="radar-icon-wrap" style="color:var(--text-secondary);border-color:rgba(100,116,139,0.3);background:rgba(100,116,139,0.08);">
              ${ICONS.listCheck}
            </div>
            <h3>Ученик не в сети (тест не активен)</h3>
            <p>Сессия не активна или закрыта. Ожидание запуска F12-скрипта на странице активного теста Moodle.</p>
          </div>`;
      }
      return;
    }

    const qList = Object.values(questionsObj || {})
      .filter(q => q && typeof q === 'object' && q.number !== undefined)
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
    qTotalCount.textContent = String(qList.length);
    const answersMap = (inboxObj && inboxObj.answers) ? inboxObj.answers : {};

    const sig = JSON.stringify({ qList, answersMap, activePageQuestions });
    if (sig === lastRenderedQuestionsJson) return;

    const drafts = {};
    document.querySelectorAll('[id^="ans-input-"]').forEach(el => {
      drafts[el.id] = el.value;
    });
    const activeElId = document.activeElement ? document.activeElement.id : '';
    if (activeElId && activeElId.startsWith('ans-')) return;

    lastRenderedQuestionsJson = sig;

    if (qList.length === 0) {
      questionsBoard.innerHTML = `
        <div class="empty-state-card">
          <div class="radar-icon-wrap" style="color:var(--accent-amber);border-color:rgba(245,158,11,0.25);background:rgba(245,158,11,0.08);">
            ${ICONS.listCheck}
          </div>
          <h3>Ожидание начала попытки теста...</h3>
          <p>Ученик подключен, но на текущей странице нет блоков вопросов (.que). Как только ученик начнет тестирование, вопросы автоматически появятся здесь.</p>
        </div>`;
      return;
    }

    questionsBoard.innerHTML = qList.map(q => {
      const qNum = String(q.number);
      const existingAns = answersMap[qNum];
      const isOnScreen = Array.isArray(activePageQuestions) && activePageQuestions.includes(qNum);
      const isCodeQuestion = !!(q.codeRunner || (q.type && q.type.includes('Код')));

      let imgsHtml = '';
      if (Array.isArray(q.questionImages) && q.questionImages.length > 0) {
        imgsHtml = `<div class="q-images">` + q.questionImages.map(im => `
          <div>
            <div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:3px;">${ICONS.photo} ${escapeHtml(im.role || 'Рисунок')}</div>
            <img src="${im.dataUrl}" onclick="zoomExamImage(this.src)" title="Нажмите для увеличения">
          </div>
        `).join('') + `</div>`;
      }

      let choicesHtml = '';
      if (Array.isArray(q.choices) && q.choices.length > 0) {
        choicesHtml = `<div class="q-options-list">` + q.choices.map(ch => `
          <div class="q-opt-item ${ch.checked ? 'student-checked' : ''}">
            <div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">
              <b style="color:var(--accent-primary);">${escapeHtml(ch.letter)})</b>
              <span>${escapeHtml(ch.text)}</span>
              ${ch.imgDataUrl ? `<img src="${ch.imgDataUrl}" onclick="zoomExamImage(this.src)">` : ''}
              ${ch.checked ? `<span style="font-size:0.7rem;color:var(--accent-amber);">(выбрано учеником)</span>` : ''}
            </div>
            <div style="display:flex;gap:0.35rem;">
              <button class="btn btn-secondary" style="padding:3px 8px;font-size:0.74rem;"
                onclick="quickPickChoice('${qNum}', ${ch.index}, '${escapeHtml(ch.letter)}', ${JSON.stringify(ch.text).replace(/"/g, '&quot;')}, false)">
                В подсказку
              </button>
              <button class="btn btn-success" style="padding:3px 8px;font-size:0.74rem;"
                onclick="quickPickChoice('${qNum}', ${ch.index}, '${escapeHtml(ch.letter)}', ${JSON.stringify(ch.text).replace(/"/g, '&quot;')}, true)">
                ${ICONS.bolt} Выбрать
              </button>
            </div>
          </div>
        `).join('') + `</div>`;
      }

      let matchHtml = '';
      if (Array.isArray(q.matchRows) && q.matchRows.length > 0) {
        matchHtml = `<div class="drag-section">
          <div style="font-size:0.78rem;font-weight:600;color:var(--accent-blue);margin-bottom:0.4rem;">${ICONS.link} Таблица соответствия (выберите вариант и нажмите «⚡ Выбрать»):</div>
          ${q.matchRows.map(r => {
            const chosenVal = curatorChoices[`match_${qNum}_${r.index}`] || r.selected || '';
            return `
            <div class="match-row-control" style="margin-bottom:0.6rem;padding:6px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:6px;">
              <div style="font-size:0.83rem;font-weight:600;margin-bottom:5px;">
                <b>${r.index}. ${escapeHtml(r.leftText)}</b>
                ${chosenVal ? `<span style="color:var(--accent-amber);font-size:0.72rem;margin-left:6px;font-weight:normal;">[Выбрано: <b>${escapeHtml(chosenVal)}</b>]</span>` : ''}
              </div>
              ${r.leftImg ? `<img src="${r.leftImg}" style="max-height:70px;background:#fff;padding:2px;border-radius:4px;margin-bottom:5px;" onclick="zoomExamImage(this.src)"><br>` : ''}
              <div style="display:flex;gap:6px;align-items:center;">
                <select id="match-sel-${qNum}-${r.index}" class="text-input" style="flex:1;font-size:0.78rem;padding:4px 7px;"
                  onchange="curatorChoices['match_${qNum}_${r.index}'] = this.value">
                  <option value="">-- Выберите соответствие --</option>
                  ${r.options.map(o => `<option value="${escapeHtml(o)}" ${o === chosenVal ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
                </select>
                <button class="btn btn-secondary" style="padding:4px 9px;font-size:0.74rem;"
                  onclick="pickMatchRow('${qNum}', ${r.index}, document.getElementById('match-sel-${qNum}-${r.index}').value, false)">
                  В подсказку
                </button>
                <button class="btn btn-success" style="padding:4px 9px;font-size:0.74rem;"
                  onclick="pickMatchRow('${qNum}', ${r.index}, document.getElementById('match-sel-${qNum}-${r.index}').value, true)">
                  ${ICONS.bolt} Выбрать
                </button>
              </div>
            </div>
          `;}).join('')}
        </div>`;
      }

      let selectsHtml = '';
      if (Array.isArray(q.selectGroups) && q.selectGroups.length > 0) {
        selectsHtml = `<div class="drag-section">
          <div style="font-size:0.78rem;font-weight:600;color:var(--accent-blue);margin-bottom:0.4rem;">${ICONS.listCheck} Выпадающие списки в пропусках:</div>
          ${q.selectGroups.map(s => {
            const chosenGap = curatorChoices[`gap_${qNum}_${s.index}`] || s.selected || '';
            return `
            <div class="match-row-control" style="margin-bottom:0.6rem;padding:6px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:6px;">
              <div style="font-size:0.83rem;font-weight:600;margin-bottom:5px;">
                <b>[${escapeHtml(s.name)}]</b>
                ${chosenGap ? `<span style="color:var(--accent-amber);font-size:0.72rem;margin-left:6px;font-weight:normal;">[Выбрано: <b>${escapeHtml(chosenGap)}</b>]</span>` : ''}
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <select id="gap-sel-${qNum}-${s.index}" class="text-input" style="flex:1;font-size:0.78rem;padding:4px 7px;"
                  onchange="curatorChoices['gap_${qNum}_${s.index}'] = this.value">
                  <option value="">-- Выберите вариант --</option>
                  ${s.options.map(o => `<option value="${escapeHtml(o)}" ${o === chosenGap ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
                </select>
                <button class="btn btn-secondary" style="padding:4px 9px;font-size:0.74rem;"
                  onclick="pickSelectGroup('${qNum}', ${s.index}, document.getElementById('gap-sel-${qNum}-${s.index}').value, false)">
                  В подсказку
                </button>
                <button class="btn btn-success" style="padding:4px 9px;font-size:0.74rem;"
                  onclick="pickSelectGroup('${qNum}', ${s.index}, document.getElementById('gap-sel-${qNum}-${s.index}').value, true)">
                  ${ICONS.bolt} Выбрать
                </button>
              </div>
            </div>
          `;}).join('')}
        </div>`;
      }

      let dragHtml = '';
      if (q.dragDrop && Array.isArray(q.dragDrop.dragItems) && q.dragDrop.dragItems.length > 0) {
        dragHtml = `<div class="drag-section">
          <div style="font-size:0.78rem;font-weight:600;color:var(--accent-blue);">
            ${ICONS.drag} ${q.dragDrop.isOrdering ? 'Элементы для упорядочивания:' : `Элементы для перетаскивания в [Зона 1 .. Зона ${(q.dragDrop.dropZones || []).length || 'N'}]:`}
          </div>
          <div class="drag-chips">
            ${q.dragDrop.dragItems.map(d => `
              <span class="drag-chip">
                <b style="color:var(--accent-amber);">${escapeHtml(d.letter)})</b>
                <span>${escapeHtml(d.text)}</span>
                ${d.imgDataUrl ? `<img src="${d.imgDataUrl}" style="max-height:42px;background:#fff;border-radius:3px;" onclick="zoomExamImage(this.src)">` : ''}
              </span>
            `).join('')}
          </div>
        </div>`;
      }

      let codeRunnerHtml = '';
      if (q.codeRunner) {
        codeRunnerHtml = `<div class="drag-section" style="border-color:rgba(62,207,142,0.3);background:rgba(62,207,142,0.05);">
          <div style="font-size:0.8rem;font-weight:600;color:var(--accent-green);margin-bottom:0.4rem;">
            ${ICONS.code} Окно кода CodeRunner — Язык: <b>${escapeHtml(q.codeRunner.language)}</b>
          </div>
          ${q.codeRunner.initialCode ? `<div style="font-size:0.75rem;color:var(--text-secondary);">Начальный шаблон:</div><pre style="background:#08080c;padding:0.5rem;border-radius:6px;font-family:var(--font-mono);font-size:0.78rem;overflow-x:auto;margin-bottom:0.45rem;">${escapeHtml(q.codeRunner.initialCode)}</pre>` : ''}
          ${Array.isArray(q.codeRunner.examples) && q.codeRunner.examples.length > 0 ? `
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.25rem;">Примеры тестов (Тест -> Ожидаемый вывод):</div>
            <div style="display:flex;flex-direction:column;gap:0.25rem;">
              ${q.codeRunner.examples.map(ex => `<div style="font-family:var(--font-mono);font-size:0.76rem;background:rgba(0,0,0,0.35);padding:4px 8px;border-radius:4px;"><code>${escapeHtml(ex.input)}</code> -> <b style="color:var(--accent-green);">${escapeHtml(ex.expected)}</b></div>`).join('')}
            </div>
          ` : ''}
        </div>`;
      }

      const defaultDraft = drafts[`ans-input-${qNum}`] !== undefined
        ? drafts[`ans-input-${qNum}`]
        : (existingAns ? (existingAns.code || existingAns.text || '') : '');

      const statusBadge = existingAns
        ? (existingAns.viewedByStudent
            ? `<span style="color:var(--accent-green);font-size:0.76rem;font-weight:600;">${ICONS.eye} Просмотрено учеником (навёл курсор)</span>`
            : `<span style="color:var(--accent-amber);font-size:0.76rem;">${ICONS.check} Доставлено в кнопку вопроса №${qNum}</span>`)
        : `<span style="color:var(--text-muted);font-size:0.76rem;">Ответ ещё не отправлен</span>`;

      return `
        <div class="q-card ${isOnScreen ? 'active-on-screen' : ''} ${existingAns ? 'answered' : ''}">
          <div class="q-header">
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <span class="q-badge">Вопрос №${escapeHtml(qNum)}</span>
              <span class="q-type">${escapeHtml(q.type)}</span>
              ${isOnScreen ? `<span style="font-size:0.72rem;color:#38bdf8;">[На экране у ученика]</span>` : ''}
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="q-text">${escapeHtml(q.questionText)}</div>
          ${imgsHtml}
          ${choicesHtml}
          ${matchHtml}
          ${selectsHtml}
          ${dragHtml}
          ${codeRunnerHtml}

          <div class="q-reply-bar">
            <div class="q-reply-row">
              ${isCodeQuestion
                ? `<textarea id="ans-input-${qNum}" class="code-editor-box" placeholder="Вставьте многострочный код решения для Вопроса №${qNum} (все пробелы, отступы и переносы строк сохраняются через Base64)...">${escapeHtml(defaultDraft)}</textarea>`
                : `<textarea id="ans-input-${qNum}" class="text-input" rows="2" style="resize:vertical;white-space:pre-wrap;" placeholder="Ответ для Вопроса №${qNum} (например: Б) Инкапсуляция  или  Зона 1 -> стек)...">${escapeHtml(defaultDraft)}</textarea>`
              }
              <input type="text" id="ans-opt-${qNum}" class="text-input" style="width:95px;" placeholder="№ вар (1,3)" value="${escapeHtml(existingAns ? (existingAns.optionIndex || '') : '')}">
              <button class="btn btn-primary" onclick="sendCardAnswer('${qNum}', ${isCodeQuestion}, false)">
                Отправить в №${qNum}
              </button>
              <button class="btn btn-success" onclick="sendCardAnswer('${qNum}', ${isCodeQuestion}, true)" title="Мгновенно вставить ответ или код в окно ученика">
                ${ICONS.bolt} Вставить
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.code-editor-box').forEach(enableTabIndentation);
  }

  function renderAnswersHistory(inboxObj) {
    const answersMap = (inboxObj && inboxObj.answers) ? inboxObj.answers : {};
    const list = Object.values(answersMap).sort((a, b) => Number(a.qNum) - Number(b.qNum));
    sentAnswersCount.textContent = `${list.length} ответов`;

    answersHistoryList.innerHTML = list.map(a => `
      <div class="hint-bubble">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--accent-blue);margin-bottom:3px;">
          <b>Вопрос №${escapeHtml(a.qNum)} ${a.optionIndex ? `(Вар. ${escapeHtml(a.optionIndex)})` : ''}</b>
          <span>${a.viewedByStudent ? `${ICONS.eye} Прочитано` : `${ICONS.check} В кнопке`}</span>
        </div>
        <div style="font-family:${a.isCode ? 'var(--font-mono)' : 'inherit'};font-size:0.78rem;max-height:90px;overflow-y:auto;">${escapeHtml(a.code || a.text)}</div>
      </div>
    `).join('');
  }

  async function handleWebRTCHandshake(sess, id) {
    if (!sess || !sess.signal_offer || rtcAnswerSentFor === id) return;
    try {
      rtcAnswerSentFor = id;
      rtcPeer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' }
        ]
      });

      rtcPeer.ondatachannel = (e) => {
        rtcDataChannel = e.channel;
        rtcDataChannel.onopen = () => {
          activeTransport = 'p2p';
          updateTransportUI();
        };
        rtcDataChannel.onclose = () => {
          activeTransport = 'firebase';
          updateTransportUI();
        };
        rtcDataChannel.onmessage = (ev) => {
          try {
            const p = JSON.parse(ev.data);
            if (p && p.path) {
              if (!sessionsCache[activeStudentId]) sessionsCache[activeStudentId] = {};
              if (p.path.includes('questions')) {
                sessionsCache[activeStudentId].questions = Object.assign(sessionsCache[activeStudentId].questions || {}, p.payload);
                renderActiveSession();
              } else if (p.path.includes('meta')) {
                sessionsCache[activeStudentId].meta = Object.assign(sessionsCache[activeStudentId].meta || {}, p.payload);
                renderActiveSession();
              } else if (p.path.includes('mirror')) {
                sessionsCache[activeStudentId].mirror = p.payload;
                renderActiveSession();
              }
            }
          } catch (err) {}
        };
      };

      await rtcPeer.setRemoteDescription(new RTCSessionDescription(sess.signal_offer));
      const answer = await rtcPeer.createAnswer();
      await rtcPeer.setLocalDescription(answer);

      const ansPayload = { type: answer.type, sdp: answer.sdp, timestamp: Date.now() };
      await fetchWithTimeout(`${FB_BASE}/sessions/${id}/signal_answer.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ansPayload)
      }, 3000);
      await fetchWithTimeout(`${VPS_BASE}/api/sync/session/${id}/signal_answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ansPayload)
      }, 3000);
    } catch (e) {}
  }

  const mirrorPagesList = document.getElementById('mirrorPagesList');
  let activeMirrorView = 'live';

  window.setMirrorView = function (view) {
    activeMirrorView = String(view);
    const sess = sessionsCache[activeStudentId];
    if (!sess) return;

    if (activeMirrorView === 'live') {
      remoteCursor.style.display = 'block';
      if (sess.mirror && sess.mirror.html) {
        mirrorFrame.srcdoc = sess.mirror.html;
      }
    } else if (sess.pages && sess.pages[activeMirrorView]) {
      remoteCursor.style.display = 'none';
      mirrorFrame.srcdoc = sess.pages[activeMirrorView].html || '';
    }
    renderMirrorPagesTabs(sess);
  };

  function renderMirrorPagesTabs(sess) {
    if (!mirrorPagesList) return;
    const pagesObj = (sess && sess.pages) ? sess.pages : {};
    const pageKeys = Object.keys(pagesObj).sort((a, b) => Number(a) - Number(b));

    let html = `<button class="btn ${activeMirrorView === 'live' ? 'btn-primary' : 'btn-secondary'}" onclick="setMirrorView('live')" style="padding:2px 8px;font-size:0.72rem;">Экран LIVE</button>`;

    pageKeys.forEach(pKey => {
      const p = pagesObj[pKey];
      const isAct = String(activeMirrorView) === String(pKey);
      html += `<button class="btn ${isAct ? 'btn-primary' : 'btn-secondary'}" onclick="setMirrorView('${pKey}')" style="padding:2px 8px;font-size:0.72rem;">Стр. ${pKey}</button>`;
    });

    mirrorPagesList.innerHTML = html;
  }

  function renderActiveSession() {
    const sess = sessionsCache[activeStudentId];
    if (!sess) return;

    const meta = sess.meta || {};
    const isOnline = (Date.now() - (meta.lastSeen || 0)) < 15000;
    const isAttemptActive = isOnline && (meta.isAttemptActive !== false) && (meta.url || '').includes('attempt.php');

    topStatusDot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
    connectionStatusText.textContent = isOnline
      ? (isAttemptActive ? `Онлайн (Тест активен): ${meta.studentName || activeStudentId}` : `Онлайн (Тест не запущен): ${meta.studentName || activeStudentId}`)
      : `Офлайн (${meta.studentName || activeStudentId})`;

    popupBadge.style.display = meta.isSeparatePopup ? 'inline-flex' : 'none';
    studentPageInfo.textContent = `${meta.pageTitle || 'Moodle'} • Вопросов в навигации: ${meta.totalNavQuestions || 0}`;
    studentPageInfo.title = studentPageInfo.textContent;
    connectionStatusText.title = connectionStatusText.textContent;

    // Блокировка/разблокировка контролов отправки ответов
    quickQNum.disabled = !isAttemptActive;
    quickOptIdx.disabled = !isAttemptActive;
    quickAnswerText.disabled = !isAttemptActive;
    btnQuickSend.disabled = !isAttemptActive;
    btnQuickAutoApply.disabled = !isAttemptActive;
    if (btnFetchAllPages) btnFetchAllPages.disabled = !isAttemptActive;

    if (sentAnswersCount) {
      sentAnswersCount.innerHTML = isAttemptActive
        ? `<span style="color:#10b981;font-weight:600;">● Тест запущен</span>`
        : `<span style="color:#f59e0b;font-weight:600;">○ Тест не запущен</span>`;
    }

    try {
      handleWebRTCHandshake(sess, activeStudentId);
    } catch (e) {}

    try {
      renderQuestionsList(sess.questions || {}, sess.inbox || {}, meta.activePageQuestions || [], isAttemptActive, meta, isOnline);
    } catch (e) {
      console.error('Error rendering questions list:', e);
    }

    try {
      renderAnswersHistory(sess.inbox || {});
    } catch (e) {}

    try {
      renderMirrorPagesTabs(sess);
    } catch (e) {}

    try {
      if (activeMirrorView === 'live') {
        remoteCursor.style.display = 'block';
        if (sess.mirror && sess.mirror.html) {
          const isUserInteracting = (Date.now() - lastUserInteractTime) < 4500;
          if ((sess.mirror.html !== lastMirrorHtml && !isUserInteracting) || !mirrorFrame.srcdoc) {
            lastMirrorHtml = sess.mirror.html;
            lastMirrorTime = sess.mirror.updatedAt;
            mirrorFrame.srcdoc = sess.mirror.html;
          }
        }
        if (meta.cursor) {
          remoteCursor.style.left = `${meta.cursor.x || 0}px`;
          remoteCursor.style.top = `${meta.cursor.y || 0}px`;
        }
      } else if (sess.pages && sess.pages[activeMirrorView]) {
        remoteCursor.style.display = 'none';
      }
    } catch (e) {
      console.error('Error rendering mirror frame:', e);
    }
  }

  async function pollSessions() {
    let data = null;

    // 1. Попытка чтения дерева сессий из Firebase
    try {
      const res = await fetchWithTimeout(`${FB_BASE}/sessions.json?t=${Date.now()}`, { cache: 'no-store' }, 2500);
      if (res.ok) {
        data = await res.json();
        if (data && activeTransport !== 'p2p') activeTransport = 'firebase';
      }
    } catch (e) {}

    // 2. Авто-фолбэк на VPS, если Firebase заблокирован или недоступен
    if (!data) {
      try {
        const vpsRes = await fetchWithTimeout(`${VPS_BASE}/api/sync/sessions?t=${Date.now()}`, { cache: 'no-store' }, 2500);
        if (vpsRes.ok) {
          data = await vpsRes.json();
          if (data && activeTransport !== 'p2p') activeTransport = 'vps';
        }
      } catch (e) {}
    }

    if (rtcDataChannel && rtcDataChannel.readyState === 'open') {
      activeTransport = 'p2p';
    }
    updateTransportUI();

    sessionsCache = data || {};
    const ids = Object.keys(sessionsCache).sort((a, b) => {
      const tA = Number(sessionsCache[a]?.meta?.lastSeen || 0);
      const tB = Number(sessionsCache[b]?.meta?.lastSeen || 0);
      return tB - tA;
    });

    if (ids.length === 0) {
      studentSelect.innerHTML = `<option value="">Ожидание ученика...</option>`;
      topStatusDot.className = 'status-dot offline';
      connectionStatusText.textContent = 'Нет активных сессий';
      return;
    }

    if (!activeStudentId || !sessionsCache[activeStudentId]) {
      activeStudentId = ids[0];
    }

    studentSelect.innerHTML = ids.map(id => {
      const m = sessionsCache[id].meta || {};
      const online = (Date.now() - (m.lastSeen || 0)) < 15000 ? '[ON]' : '[OFF]';
      return `<option value="${id}" ${id === activeStudentId ? 'selected' : ''}>${online} ${escapeHtml(m.studentName || id)}</option>`;
    }).join('');

    renderActiveSession();
  }

  pollSessions();
  setInterval(pollSessions, 1800);
})();
