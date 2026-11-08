/**
 * ============================================================================
 * SIB-EXAM (F12 STEALTH CLIENT FOR MOODLE / DO.SIBSIU.RU)
 * ============================================================================
 * Особенности:
 * 1. Полное подавление слежки за переключением вкладок/окон (visibilitychange, blur, focusout).
 * 2. Авто-перехват отдельного полноэкранного окна Moodle (window.open / securewindow).
 * 3. Захват всех картинок вопроса, вариантов и схем Drag&Drop в Base64 с куками сессии.
 * 4. Полный парсинг: Одиночный/Множественный выбор, Соответствие (Match), Выпадающие списки,
 *    Перетаскивание (Drag&Drop со всеми зонами [Зона 1..N]), Упорядочивание и CodeRunner (Ace Editor).
 * 5. Вывод ответов в незаметном микро-окне под стиль Moodle при наведении курсора
 *    на номер вопроса в блоке навигации справа (#mod_quiz_navblock / .qnbutton)
 *    + тихая авто-подстановка ответа или вставка кода в Ace Editor в 1 клик.
 * ============================================================================
 */
(function () {
  'use strict';

  if (window.__sibIntervals && Array.isArray(window.__sibIntervals)) {
    window.__sibIntervals.forEach(clearInterval);
  }
  window.__sibIntervals = [];

  try {
    const oldBox = document.getElementById('sib-stealth-nav-popup');
    if (oldBox) oldBox.remove();
  } catch (e) {}

  try {
    if (window.__sibDrawerHandler) {
      window.removeEventListener('click', window.__sibDrawerHandler, true);
      document.removeEventListener('click', window.__sibDrawerHandler, true);
    }
  } catch (e) {}

  window.__SIB_EXAM_ACTIVE = true;

  // Изолированная ветка в Firebase (не трогает старый MentorLink)
  const FB_BASE = (window.__SIB_FB_URL || 'https://mentorlink-school-default-rtdb.europe-west1.firebasedatabase.app/messages/sib_exam').replace(/\/$/, '');
  const VPS_API = window.__SIB_VPS_URL || ''; // опциональный резервный сервер на VPS

  // Постоянный ID сессии ученика
  let studentId = '';
  try {
    studentId = localStorage.getItem('sib_exam_student_id') || '';
    if (!studentId) {
      studentId = 'stud_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('sib_exam_student_id', studentId);
    }
  } catch (e) {
    studentId = 'stud_' + Math.random().toString(36).substring(2, 8);
  }

  let activePopupWin = null;
  const imageCache = new Map();
  let answersByQuestion = {}; // { "1": { answerText, optionIndex, code, type, timestamp, ... } }
  let generalHints = [];
  let lastParsedSignature = '';
  let cursorState = { x: 0, y: 0, scrollY: 0 };
  let viewedAckSent = {};

  // ==========================================================================
  // 1. АНТИ-ПРОКТОРИНГ И БЛОКИРОВКА СЛЕЖКИ ЗА ВКЛАДКОЙ / ФОКУСОМ
  // ==========================================================================
  const BLOCKED_EVENTS = new Set([
    'visibilitychange',
    'webkitvisibilitychange',
    'mozvisibilitychange',
    'blur',
    'focusout',
    'mouseleave',
    'pagehide',
    'fullscreenchange',
    'webkitfullscreenchange',
    'contextmenu',
    'selectstart',
    'copy',
    'cut',
    'paste'
  ]);

  function installAntiDetection(targetWin) {
    if (!targetWin || targetWin.__sibAntiDetInstalled) return;
    try {
      const targetDoc = targetWin.document;
      if (!targetDoc) return;
      targetWin.__sibAntiDetInstalled = true;

      // 1) Подмена свойств видимости и фокуса
      try {
        Object.defineProperty(targetDoc, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(targetDoc, 'mozHidden', { get: () => false, configurable: true });
        Object.defineProperty(targetDoc, 'webkitHidden', { get: () => false, configurable: true });
        Object.defineProperty(targetDoc, 'visibilityState', { get: () => 'visible', configurable: true });
        Object.defineProperty(targetDoc, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
        targetDoc.hasFocus = function () { return true; };
      } catch (e) {}

      // 2) Фильтрация новых подписок addEventListener на слежку
      const patchAddEvent = (proto) => {
        if (!proto || !proto.addEventListener || proto.__sibPatched) return;
        const origAdd = proto.addEventListener;
        proto.addEventListener = function (type, listener, options) {
          const cleanType = String(type || '').toLowerCase();
          if (BLOCKED_EVENTS.has(cleanType) && (!listener || !listener.__sibInternal)) {
            return; // Игнорируем обработчики слежки Moodle / прокторинга
          }
          return origAdd.call(this, type, listener, options);
        };
        proto.__sibPatched = true;
      };

      patchAddEvent(targetWin.EventTarget && targetWin.EventTarget.prototype);
      patchAddEvent(targetWin);
      patchAddEvent(targetDoc);

      // 3) Перехват уже навешанных событий в фазе capture
      const stopper = function (e) {
        e.stopImmediatePropagation();
      };
      stopper.__sibInternal = true;

      ['visibilitychange', 'webkitvisibilitychange', 'blur', 'focusout', 'mouseleave', 'pagehide'].forEach(ev => {
        targetWin.addEventListener(ev, stopper, true);
        targetDoc.addEventListener(ev, stopper, true);
      });

      // Разблокировка выделения текста и контекстного меню в securewindow
      const unlockHandler = function (e) {
        e.stopPropagation();
      };
      unlockHandler.__sibInternal = true;
      ['contextmenu', 'selectstart', 'copy', 'cut', 'paste'].forEach(ev => {
        targetDoc.addEventListener(ev, unlockHandler, true);
      });

      // Сброс inline-обработчиков
      try {
        targetWin.onblur = null;
        targetDoc.onvisibilitychange = null;
        targetDoc.oncontextmenu = null;
        targetDoc.onselectstart = null;
        if (targetDoc.body) {
          targetDoc.body.oncontextmenu = null;
          targetDoc.body.onselectstart = null;
          targetDoc.body.style.setProperty('user-select', 'text', 'important');
          targetDoc.body.style.setProperty('-webkit-user-select', 'text', 'important');
        }
      } catch (e) {}

      // Защита от автоматического reload страницы скриптами Moodle
      try {
        targetWin.onbeforeunload = function () {
          return undefined;
        };
      } catch (e) {}

      // Отслеживание курсора мыши
      const moveListener = function (e) {
        cursorState = { x: e.clientX, y: e.clientY, scrollY: targetWin.scrollY || 0 };
      };
      moveListener.__sibInternal = true;
      targetWin.addEventListener('mousemove', moveListener, { passive: true });
    } catch (e) {}
  }

  // ==========================================================================
  // 2. АВТО-ПЕРЕХВАТ ОТДЕЛЬНОГО ОКНА (window.open / quizaccess_securewindow)
  // ==========================================================================
  function hookWindowOpen(win) {
    if (!win || win.__sibOpenHooked) return;
    win.__sibOpenHooked = true;
    const origOpen = win.open;
    win.open = function (url, target, features) {
      let cleanFeatures = String(features || '')
        .replace(/noopener/gi, '')
        .replace(/noreferrer/gi, '');
      const popup = origOpen.call(this, url, target, cleanFeatures);
      if (popup) {
        activePopupWin = popup;
        const attachToPopup = () => {
          try {
            if (popup && !popup.closed && popup.document) {
              installAntiDetection(popup);
              hookWindowOpen(popup);
              ensureStealthWidget(popup.document);
            }
          } catch (e) {}
        };
        attachToPopup();
        setInterval(attachToPopup, 800);
      }
      return popup;
    };
  }

  installAntiDetection(window);
  hookWindowOpen(window);

  // Возвращает активное окно с тестом (отдельное окно popup, если открыто, иначе текущее)
  function getActiveWin() {
    try {
      if (activePopupWin && !activePopupWin.closed && activePopupWin.document) {
        return activePopupWin;
      }
    } catch (e) {}
    return window;
  }

  function getActiveDoc() {
    return getActiveWin().document;
  }

  // ==========================================================================
  // 3. ЗАХВАТ КАРТИНОК В BASE64 С КУКАМИ СЕССИИ MOODLE
  // ==========================================================================
  function isIgnoredMoodleIcon(img) {
    if (!img) return true;
    const src = (img.getAttribute('src') || '').toLowerCase();
    if (!src) return true;
    if (
      src.includes('spacer.gif') ||
      src.includes('unflagged') ||
      src.includes('flagged') ||
      src.includes('/pix/i/') ||
      src.includes('/pix/t/') ||
      img.classList.contains('icon') ||
      img.classList.contains('questionflagimage') ||
      img.classList.contains('iconsmall')
    ) {
      return true;
    }
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w > 0 && h > 0 && w <= 20 && h <= 20 && src.includes('theme/image.php')) {
      return true;
    }
    return false;
  }

  async function convertImgToBase64(imgEl, baseDoc) {
    try {
      const rawSrc = imgEl.getAttribute('src') || imgEl.src || '';
      if (!rawSrc) return null;
      if (rawSrc.startsWith('data:image/')) return rawSrc;

      const fullUrl = new URL(rawSrc, (baseDoc && baseDoc.location ? baseDoc.location.href : location.href)).href;
      if (imageCache.has(fullUrl)) return imageCache.get(fullUrl);

      // Попытка 1: через fetch с куками MoodleSession (надёжно даже для закрытых pluginfile.php)
      try {
        const resp = await fetch(fullUrl, { credentials: 'include', cache: 'force-cache' });
        if (resp.ok) {
          const blob = await resp.blob();
          if (typeof createImageBitmap === 'function') {
            const bmp = await createImageBitmap(blob);
            const maxDim = 900;
            let w = bmp.width || 300;
            let h = bmp.height || 300;
            if (w > maxDim || h > maxDim) {
              const ratio = Math.min(maxDim / w, maxDim / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(bmp, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
            if (dataUrl && dataUrl.length > 120) {
              imageCache.set(fullUrl, dataUrl);
              return dataUrl;
            }
          }
        }
      } catch (e) {}

      // Попытка 2: прямой рендер уже загруженного <img> в canvas
      if (imgEl.complete && (imgEl.naturalWidth > 0 || imgEl.width > 0)) {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 900;
          let w = imgEl.naturalWidth || imgEl.width || 300;
          let h = imgEl.naturalHeight || imgEl.height || 300;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(imgEl, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
          if (dataUrl && dataUrl.length > 120) {
            imageCache.set(fullUrl, dataUrl);
            return dataUrl;
          }
        } catch (err) {}
      }
    } catch (e) {}
    return null;
  }

  // ==========================================================================
  // 4. ЧИСТКА ТЕКСТА, ФОРМУЛ MATHJAX, ЗОН ПЕРЕТАСКИВАНИЯ И CODERUNNER
  // ==========================================================================
  function normaliseText(val) {
    return String(val || '').replace(/[\s\r\n\t\xa0]+/g, ' ').trim();
  }

  function optionLetter(idx) {
    const letters = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';
    return letters[idx] || String(idx + 1);
  }

  function getCleanTextWithMathAndZones(el) {
    if (!el) return '';
    try {
      const clone = el.cloneNode(true);

      // Верхние и нижние индексы
      clone.querySelectorAll('sup').forEach(sup => {
        const t = (sup.textContent || '').trim();
        sup.textContent = t ? `^(${t})` : '';
      });
      clone.querySelectorAll('sub').forEach(sub => {
        const t = (sub.textContent || '').trim();
        sub.textContent = t ? `_(${t})` : '';
      });

      // Формулы MathJax
      clone.querySelectorAll('script[type*="math"]').forEach(s => {
        const mathTxt = (s.textContent || '').trim();
        if (mathTxt) {
          const span = document.createElement('span');
          span.textContent = ` [Формула: ${mathTxt}] `;
          s.parentNode && s.parentNode.replaceChild(span, s);
        }
      });
      clone.querySelectorAll('.MathJax_Preview, .MathJax_SVG, .MathJax').forEach(s => {
        // Если уже есть TeX-скрипт, убираем дублирующее дерево MathJax
        if (clone.querySelector('script[type*="math"]')) s.remove();
      });

      // Помечаем пустые зоны перетаскивания (Drag&Drop: .drop, .dropzone, .place1..N)
      let zoneCounter = 1;
      clone.querySelectorAll('.drop, .dropzone, [class*="place"]').forEach(dropEl => {
        if (dropEl.classList.contains('draghome') || dropEl.classList.contains('draggable')) return;
        const placeMatch = (dropEl.className || '').match(/place(\d+)/);
        const zNum = placeMatch ? placeMatch[1] : zoneCounter++;
        const currentVal = normaliseText(dropEl.textContent);
        const badge = document.createElement('span');
        badge.textContent = currentVal ? ` [Зона ${zNum}: ${currentVal}] ` : ` [Зона ${zNum}] `;
        dropEl.parentNode && dropEl.parentNode.replaceChild(badge, dropEl);
      });

      // Помечаем выпадающие списки внутри текста (Cloze / Gapselect)
      let selectCounter = 1;
      clone.querySelectorAll('select').forEach(sel => {
        const sNum = selectCounter++;
        const badge = document.createElement('span');
        badge.textContent = ` [Пропуск ${sNum}] `;
        sel.parentNode && sel.parentNode.replaceChild(badge, sel);
      });

      // Удаляем служебный мусор
      clone.querySelectorAll('script, style, .accesshide, .im-controls, . neuro-shadow-host').forEach(s => s.remove());

      return normaliseText(clone.innerText || clone.textContent || '');
    } catch (e) {
      return normaliseText(el.innerText || el.textContent || '');
    }
  }

  function detectQuestionType(qEl) {
    if (qEl.classList.contains('coderunner') || qEl.querySelector('textarea.coderunner-answer, .ace_editor')) {
      const ta = qEl.querySelector('textarea.coderunner-answer, textarea.edit_code');
      const lang = ta ? (ta.getAttribute('data-lang') || ta.getAttribute('data-language') || 'Python / Code') : 'CodeRunner';
      return `Код: CodeRunner (${lang})`;
    }
    if (qEl.classList.contains('ddwtos') || qEl.classList.contains('ddmarker') || qEl.classList.contains('ddimageortext') || qEl.querySelector('.draghome, .dropzone, .ddarea')) {
      return 'Перетаскивание (Drag & Drop)';
    }
    if (qEl.classList.contains('ordering') || qEl.querySelector('.sortablelist')) {
      return 'Упорядочивание элементов';
    }
    if (qEl.classList.contains('match')) {
      return 'Соответствие (Таблица)';
    }
    if (qEl.classList.contains('multianswer') || qEl.classList.contains('cloze') || qEl.classList.contains('gapselect')) {
      return 'Заполнение пропусков (Выбор из списка)';
    }
    if (qEl.classList.contains('truefalse')) {
      return 'Верно / Неверно';
    }
    if (qEl.classList.contains('numerical') || qEl.classList.contains('calculated') || qEl.classList.contains('calculatedsimple')) {
      return 'Числовой ответ';
    }
    if (qEl.classList.contains('shortanswer')) {
      return 'Краткий текстовый ответ';
    }
    if (qEl.classList.contains('essay')) {
      return 'Развёрнутый ответ (Эссе)';
    }
    if (qEl.querySelector('.answer input[type="checkbox"]')) return 'Множественный выбор ( несколько )';
    if (qEl.querySelector('.answer input[type="radio"]')) return 'Одиночный выбор ( 1 вариант )';
    if (qEl.querySelector('select')) return 'Выбор из списка';
    if (qEl.querySelector('textarea')) return 'Текстовый / Кодовый ответ';
    if (qEl.querySelector('input[type="text"], input[type="number"]')) return 'Ввод значения';
    return 'Вопрос Moodle';
  }

  // Сбор слепка одного вопроса со всеми картинками, вариантами, зонами Drag&Drop и CodeRunner
  async function parseSingleQuestion(qEl, idx, doc) {
    const noEl = qEl.querySelector('.info .no, h3.no');
    const qNumber = noEl ? (noEl.textContent.replace(/\D/g, '') || String(idx + 1)) : String(idx + 1);
    const qType = detectQuestionType(qEl);

    const qtextEl = qEl.querySelector('.qtext') || qEl.querySelector('.formulation');
    const questionText = getCleanTextWithMathAndZones(qtextEl);

    // 1. Сбор картинок условия и фона Drag&Drop
    const questionImages = [];
    const stemImgs = qEl.querySelectorAll('.qtext img, .formulation img, .ddarea img, img.dropbackground');
    for (const img of stemImgs) {
      if (img.closest('.answer') || img.closest('.draghome') || img.closest('.dragitems')) continue;
      if (isIgnoredMoodleIcon(img)) continue;
      const b64 = await convertImgToBase64(img, doc);
      if (b64) {
        questionImages.push({
          role: img.classList.contains('dropbackground') ? 'Фон для перетаскивания' : 'Рисунок условия',
          alt: normaliseText(img.getAttribute('alt') || ''),
          dataUrl: b64
        });
      }
    }

    // 2. Одиночный / множественный выбор (вместе с картинками внутри вариантов!)
    const choices = [];
    const choiceInputs = qEl.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]');
    for (let cIdx = 0; cIdx < choiceInputs.length; cIdx++) {
      const inp = choiceInputs[cIdx];
      let container = inp.closest('.r0, .r1, div, label') || inp.parentElement;
      let labelEl = null;
      if (inp.id) {
        labelEl = qEl.querySelector(`label[for="${CSS.escape(inp.id)}"]`) || qEl.querySelector(`[id="${CSS.escape(inp.id)}_label"]`);
      }
      const targetNode = labelEl || container;
      const rawChoiceText = getCleanTextWithMathAndZones(targetNode).replace(/^[a-zа-я0-9][\.\)]\s*/i, '');

      let choiceImg = null;
      if (targetNode) {
        const imgInChoice = targetNode.querySelector('img');
        if (imgInChoice && !isIgnoredMoodleIcon(imgInChoice)) {
          choiceImg = await convertImgToBase64(imgInChoice, doc);
        }
      }

      choices.push({
        index: cIdx + 1,
        letter: optionLetter(cIdx),
        text: rawChoiceText || (choiceImg ? `[Картинка варианта ${optionLetter(cIdx)}]` : `Вариант ${cIdx + 1}`),
        imgDataUrl: choiceImg,
        checked: !!inp.checked,
        inputType: inp.type
      });
    }

    // 3. Таблица соответствия (Matching)
    const matchRows = [];
    if (qEl.classList.contains('match') || qEl.querySelector('table.answer tr td.control select')) {
      const rows = qEl.querySelectorAll('table.answer tr');
      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const tr = rows[rIdx];
        const textTd = tr.querySelector('td.text');
        const sel = tr.querySelector('td.control select, select');
        if (!textTd || !sel) continue;
        const leftText = getCleanTextWithMathAndZones(textTd);
        let leftImg = null;
        const imgEl = textTd.querySelector('img');
        if (imgEl && !isIgnoredMoodleIcon(imgEl)) {
          leftImg = await convertImgToBase64(imgEl, doc);
        }
        const opts = Array.from(sel.options)
          .map(o => normaliseText(o.textContent))
          .filter(t => t && !/выберите|choose/i.test(t));
        const currentSelected = sel.selectedIndex > 0 ? normaliseText(sel.options[sel.selectedIndex].textContent) : '';
        matchRows.push({
          index: rIdx + 1,
          leftText,
          leftImg,
          options: opts,
          selected: currentSelected
        });
      }
    }

    // 4. Выпадающие списки в тексте (Gapselect / Cloze)
    const selectGroups = [];
    if (matchRows.length === 0) {
      const selects = qEl.querySelectorAll('.formulation select, .answer select, .qtext select');
      selects.forEach((sel, sIdx) => {
        const opts = Array.from(sel.options)
          .map(o => normaliseText(o.textContent))
          .filter(t => t && !/выберите|choose/i.test(t));
        const currentSelected = sel.selectedIndex > 0 ? normaliseText(sel.options[sel.selectedIndex].textContent) : '';
        selectGroups.push({
          index: sIdx + 1,
          name: `Пропуск ${sIdx + 1}`,
          options: opts,
          selected: currentSelected
        });
      });
    }

    // 5. Задачи на перетаскивание (Drag & Drop: ddwtos, ddmarker, ddimageortext) и Упорядочивание (ordering)
    let dragDrop = null;
    const dragElements = qEl.querySelectorAll('.draghome, .draggable, [data-region="drag"], .sortablelist li');
    if (dragElements.length > 0 || qEl.classList.contains('ddwtos') || qEl.classList.contains('ddmarker') || qEl.classList.contains('ddimageortext') || qEl.classList.contains('ordering')) {
      const dragItems = [];
      const seenDragKeys = new Set();

      for (let dIdx = 0; dIdx < dragElements.length; dIdx++) {
        const dEl = dragElements[dIdx];
        if (dEl.classList.contains('dragplaceholder') || dEl.classList.contains('unplaced')) continue;
        const dText = getCleanTextWithMathAndZones(dEl);
        let dImg = null;
        const imgNode = dEl.tagName === 'IMG' ? dEl : dEl.querySelector('img');
        if (imgNode && !isIgnoredMoodleIcon(imgNode)) {
          dImg = await convertImgToBase64(imgNode, doc);
        }
        const uniqueKey = (dText + '|' + (dImg ? dImg.slice(-32) : '')).toLowerCase();
        if ((!dText && !dImg) || seenDragKeys.has(uniqueKey)) continue;
        seenDragKeys.add(uniqueKey);

        dragItems.push({
          index: dragItems.length + 1,
          letter: optionLetter(dragItems.length),
          text: dText || `[Картинка-элемент ${dragItems.length + 1}]`,
          imgDataUrl: dImg
        });
      }

      const dropZones = [];
      const zoneNodes = qEl.querySelectorAll('.drop, .dropzone, .ddarea .dropzone');
      zoneNodes.forEach((zEl, zIdx) => {
        const placeMatch = (zEl.className || '').match(/place(\d+)/);
        const zNum = placeMatch ? Number(placeMatch[1]) : (zIdx + 1);
        const styleLeft = zEl.style && zEl.style.left ? zEl.style.left : '';
        const styleTop = zEl.style && zEl.style.top ? zEl.style.top : '';
        dropZones.push({
          zoneNumber: zNum,
          label: `Зона ${zNum}`,
          coords: (styleLeft || styleTop) ? `x:${styleLeft}, y:${styleTop}` : '',
          currentText: normaliseText(zEl.textContent)
        });
      });

      dragDrop = {
        isOrdering: qEl.classList.contains('ordering') || !!qEl.querySelector('.sortablelist'),
        dragItems,
        dropZones
      };
    }

    // 6. Задачи с окном для кода (CodeRunner / Ace Editor / Textarea)
    let codeRunner = null;
    const isCodeRunner = qEl.classList.contains('coderunner') || !!qEl.querySelector('textarea.coderunner-answer, textarea.edit_code, .ace_editor');
    if (isCodeRunner) {
      const codeTa = qEl.querySelector('textarea.coderunner-answer, textarea.edit_code, .answer textarea, textarea');
      const lang = codeTa ? (codeTa.getAttribute('data-lang') || codeTa.getAttribute('data-language') || 'Python3') : 'Python3';
      const initialCode = codeTa ? (codeTa.getAttribute('data-reload-text') || '') : '';
      const currentCode = codeTa ? (codeTa.value || '') : '';
      const examples = [];
      qEl.querySelectorAll('.coderunnerexamples tr, table.coderunnerexamples tr').forEach(tr => {
        if (tr.querySelector('th')) return;
        const c0 = tr.querySelector('td.c0, td:first-child');
        const c1 = tr.querySelector('td.c1, td:last-child');
        if (c0 || c1) {
          examples.push({
            input: (c0 ? c0.innerText : '').trim(),
            expected: (c1 ? c1.innerText : '').trim()
          });
        }
      });
      codeRunner = {
        language: lang,
        initialCode,
        currentCode,
        examples,
        textareaId: codeTa ? codeTa.id : ''
      };
    }

    // 7. Текстовое / числовое поле ввода (shortanswer / numerical)
    let textInputValue = '';
    if (!isCodeRunner && choices.length === 0 && matchRows.length === 0) {
      const txtInp = qEl.querySelector('.answer input[type="text"], .answer input[type="number"], .answer textarea');
      if (txtInp) textInputValue = txtInp.value || '';
    }

    return {
      number: String(qNumber),
      type: qType,
      questionText,
      questionImages,
      choices,
      matchRows,
      selectGroups,
      dragDrop,
      codeRunner,
      textInputValue
    };
  }

  // ==========================================================================
  // 5. ТИХАЯ АВТО-ВСТАВКА ОТВЕТА ИЛИ КОДА В ACE EDITOR / ПОЛЯ MOODLE
  // ==========================================================================
  function decodeExactCode(answerObj) {
    if (!answerObj) return '';
    if (answerObj.codeBase64) {
      try {
        return decodeURIComponent(escape(atob(answerObj.codeBase64)));
      } catch (e) {}
    }
    let raw = String(answerObj.code || answerObj.text || '').replace(/\r\n/g, '\n');
    raw = raw.replace(/^```(?:[a-zA-Z0-9_#+-]+)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    return raw;
  }

  function applyAnswerToQuestionDOM(qNum, answerObj) {
    const doc = getActiveDoc();
    const win = getActiveWin();
    if (!doc || !answerObj) return false;

    const allQues = Array.from(doc.querySelectorAll('.que'));
    const qEl = allQues.find((el, i) => {
      const noEl = el.querySelector('.info .no, h3.no');
      const num = noEl ? (noEl.textContent.replace(/\D/g, '') || String(i + 1)) : String(i + 1);
      return String(num) === String(qNum);
    });
    if (!qEl) return false;

    // A) Если это задача с окном для кода (CodeRunner / Ace Editor)
    if (answerObj.codeBase64 || answerObj.code || qEl.classList.contains('coderunner') || qEl.querySelector('.ace_editor, textarea.coderunner-answer')) {
      const cleanCode = decodeExactCode(answerObj);

      const ta = qEl.querySelector('textarea.coderunner-answer, textarea.edit_code, .answer textarea, textarea');
      if (ta) {
        ta.value = cleanCode;
        ta.dispatchEvent(new win.Event('input', { bubbles: true }));
        ta.dispatchEvent(new win.Event('change', { bubbles: true }));
        ta.dispatchEvent(new win.KeyboardEvent('keyup', { bubbles: true }));
      }
      const aceEl = qEl.querySelector('.ace_editor');
      if (aceEl && win.ace && typeof win.ace.edit === 'function') {
        try {
          const editor = win.ace.edit(aceEl);
          if (editor && typeof editor.setValue === 'function') {
            editor.setValue(cleanCode, 1);
            editor.clearSelection();
          }
        } catch (e) {}
      }
      // Дополнительный инжект в контекст страницы для гарантированного обновления Ace Editor
      try {
        const script = doc.createElement('script');
        script.textContent = `(function(){try{var q=document.getElementById(${JSON.stringify(qEl.id || '')})||document;var aceNode=q.querySelector('.ace_editor');if(aceNode&&window.ace&&window.ace.edit){var ed=window.ace.edit(aceNode);ed.setValue(${JSON.stringify(cleanCode)},1);ed.clearSelection();}}catch(e){}})();`;
        (doc.head || doc.documentElement).appendChild(script);
        script.remove();
      } catch (e) {}
      return true;
    }

    // Б) Если указан номер варианта (optionIndex: "1", "2" или "1,3" или буквы "А", "Б", "A", "B") для radio/checkbox
    const inputs = qEl.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]');
    if (inputs.length > 0 && answerObj.optionIndex) {
      const lettersRu = 'абвгдежзиклмнопрстуфхцчшщэюя';
      const lettersEn = 'abcdefghijklmnopqrstuvwxyz';
      const indices = String(answerObj.optionIndex)
        .split(/[\s,;]+/)
        .map(x => {
          x = x.trim().toLowerCase();
          const n = parseInt(x, 10);
          if (!isNaN(n)) return n;
          const idxRu = lettersRu.indexOf(x);
          if (idxRu !== -1) return idxRu + 1;
          const idxEn = lettersEn.indexOf(x);
          if (idxEn !== -1) return idxEn + 1;
          return NaN;
        })
        .filter(n => !isNaN(n));
      if (indices.length > 0) {
        inputs.forEach((inp, idx) => {
          if (indices.includes(idx + 1)) {
            inp.click();
            inp.checked = true;
            inp.dispatchEvent(new win.Event('change', { bubbles: true }));
          }
        });
        return true;
      }
    }

    // В) Поиск радио/чекбокса по совпадению текста ответа
    if (inputs.length > 0 && answerObj.text) {
      const targetNorm = normaliseText(answerObj.text).toLowerCase();
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i];
        const container = inp.closest('.r0, .r1, div, label') || inp.parentElement;
        const choiceNorm = normaliseText(container ? container.innerText : '').toLowerCase();
        if (choiceNorm && (choiceNorm.includes(targetNorm) || targetNorm.includes(choiceNorm))) {
          inp.click();
          inp.checked = true;
          return true;
        }
      }
    }

    // Г) Соответствие (таблица с выпадающими списками) и пропуски (Gapselect / Cloze)
    const selects = qEl.querySelectorAll('table.answer tr td.control select, .formulation select, .answer select, select');
    if (selects.length > 0 && (answerObj.text || answerObj.optionIndex || answerObj.matchText)) {
      let appliedAny = false;
      const rawText = String(answerObj.matchText || answerObj.text || '').trim();
      const targetMatchIndex = Number(answerObj.matchIndex) || 0;
      const cleanMatchText = rawText.replace(/^\d+[\s.:\-)—]+/, '').trim().toLowerCase();

      // 1. Точечное назначение по номеру строки (matchIndex: 1..N)
      if (targetMatchIndex > 0 && selects[targetMatchIndex - 1] && (cleanMatchText || rawText)) {
        const targetSel = selects[targetMatchIndex - 1];
        const searchVal = cleanMatchText || rawText.toLowerCase();
        for (let optIdx = 0; optIdx < targetSel.options.length; optIdx++) {
          const opt = targetSel.options[optIdx];
          const optNorm = normaliseText(opt.textContent).toLowerCase();
          if (optNorm && !/выберите|choose/i.test(optNorm) && (optNorm.includes(searchVal) || searchVal.includes(optNorm))) {
            targetSel.selectedIndex = optIdx;
            targetSel.value = opt.value;
            opt.selected = true;
            targetSel.dispatchEvent(new win.Event('input', { bubbles: true }));
            targetSel.dispatchEvent(new win.Event('change', { bubbles: true }));
            appliedAny = true;
            break;
          }
        }
        if (appliedAny) return true;
      }

      // 2. Разбор строк вида "1. Ответ\n2. Ответ" или "1 - Ответ"
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const rowMatches = {};
      lines.forEach(line => {
        const m = line.match(/^(\d+)[\s.:\-)—]+(.+)$/);
        if (m) {
          rowMatches[parseInt(m[1], 10)] = normaliseText(m[2]).toLowerCase();
        }
      });

      selects.forEach((sel, sIdx) => {
        const rowNum = sIdx + 1;
        let targetText = rowMatches[rowNum] || '';
        if (targetText) {
          for (let optIdx = 0; optIdx < sel.options.length; optIdx++) {
            const opt = sel.options[optIdx];
            const optNorm = normaliseText(opt.textContent).toLowerCase();
            if (optNorm && !/выберите|choose/i.test(optNorm) && (optNorm.includes(targetText) || targetText.includes(optNorm))) {
              sel.selectedIndex = optIdx;
              sel.value = opt.value;
              opt.selected = true;
              sel.dispatchEvent(new win.Event('input', { bubbles: true }));
              sel.dispatchEvent(new win.Event('change', { bubbles: true }));
              appliedAny = true;
              break;
            }
          }
        }
      });

      // 3. Умный поиск: если передан просто текст варианта (например "с 1918 года до наших дней"), ищем во всех выпадающих списках вопроса
      if (!appliedAny && (cleanMatchText || rawText)) {
        const searchVal = cleanMatchText || rawText.toLowerCase();
        for (let sIdx = 0; sIdx < selects.length; sIdx++) {
          const sel = selects[sIdx];
          for (let optIdx = 0; optIdx < sel.options.length; optIdx++) {
            const opt = sel.options[optIdx];
            const optNorm = normaliseText(opt.textContent).toLowerCase();
            if (optNorm && !/выберите|choose/i.test(optNorm) && (optNorm.includes(searchVal) || searchVal.includes(optNorm))) {
              sel.selectedIndex = optIdx;
              sel.value = opt.value;
              opt.selected = true;
              sel.dispatchEvent(new win.Event('input', { bubbles: true }));
              sel.dispatchEvent(new win.Event('change', { bubbles: true }));
              appliedAny = true;
              return true;
            }
          }
        }
      }

      // 4. По номерам вариантов (1, 2, 3...)
      if (!appliedAny && answerObj.optionIndex) {
        const lettersRu = 'абвгдежзиклмнопрстуфхцчшщэюя';
        const lettersEn = 'abcdefghijklmnopqrstuvwxyz';
        const optIndices = String(answerObj.optionIndex)
          .split(/[\s,;]+/)
          .map(x => {
            x = x.trim().toLowerCase();
            const n = parseInt(x, 10);
            if (!isNaN(n)) return n;
            const idxRu = lettersRu.indexOf(x);
            if (idxRu !== -1) return idxRu + 1;
            const idxEn = lettersEn.indexOf(x);
            if (idxEn !== -1) return idxEn + 1;
            return NaN;
          })
          .filter(n => !isNaN(n));

        selects.forEach((sel, sIdx) => {
          const chosenIdx = optIndices[sIdx] !== undefined ? optIndices[sIdx] : optIndices[0];
          if (chosenIdx && sel.options[chosenIdx]) {
            sel.selectedIndex = chosenIdx;
            sel.value = sel.options[chosenIdx].value;
            sel.options[chosenIdx].selected = true;
            sel.dispatchEvent(new win.Event('input', { bubbles: true }));
            sel.dispatchEvent(new win.Event('change', { bubbles: true }));
            appliedAny = true;
          }
        });
      }

      if (appliedAny) return true;
    }

    // Д) Краткий текстовый / числовой ответ
    const txtInput = qEl.querySelector('.answer input[type="text"], .answer input[type="number"], .answer textarea, input.form-control[type="text"]');
    if (txtInput && (answerObj.text || answerObj.code)) {
      txtInput.value = String(answerObj.text || answerObj.code || '').trim();
      txtInput.dispatchEvent(new win.Event('input', { bubbles: true }));
      txtInput.dispatchEvent(new win.Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  // ==========================================================================
  // 6. НЕЗАМЕТНОЕ МИКРО-ОКНО ОТВЕТА В ЛЕВОМ НИЖНЕМ УГЛУ ЭКРАНА
  // ==========================================================================
  let hoverHideTimeout = null;

  function ensureStealthWidget(doc) {
    if (!doc) return null;
    const root = doc.documentElement || doc.body;
    if (!root) return null;
    let box = doc.getElementById('sib-stealth-nav-popup');
    if (!box) {
      box = doc.createElement('div');
      box.id = 'sib-stealth-nav-popup';
      root.appendChild(box);

      box.addEventListener('mouseenter', () => {
        if (hoverHideTimeout) {
          clearTimeout(hoverHideTimeout);
          hoverHideTimeout = null;
        }
      });
      box.addEventListener('mouseleave', () => {
        hoverHideTimeout = setTimeout(() => {
          box.style.display = 'none';
        }, 1800);
      });

      doc.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') box.style.display = 'none';
      });
    }

    const curDisplay = (box.style && box.style.display && box.style.display !== 'none') ? box.style.display : 'none';

    // Принудительно очищаем любые старые стили координат
    box.style.removeProperty('top');
    box.style.removeProperty('right');
    box.style.removeProperty('inset');

    // Ультра-компактный stealth-виджет строго в левом нижнем углу (сохраняем видимость, если открыт)
    box.style.cssText = [
      'position: fixed !important',
      'z-index: 2147483646 !important',
      `display: ${curDisplay}`,
      'bottom: 12px !important',
      'left: 12px !important',
      'top: auto !important',
      'right: auto !important',
      'margin: 0 !important',
      'transform: none !important',
      'width: 170px !important',
      'max-width: 185px !important',
      'max-height: 110px !important',
      'overflow-y: auto !important',
      'background: rgba(255, 255, 255, 0.96) !important',
      'color: #212529 !important',
      'border: 1px solid #ced4da !important',
      'border-radius: 4px !important',
      'padding: 3px 5px !important',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important',
      'font-size: 9.5px !important',
      'line-height: 1.25 !important',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important',
      'user-select: text !important',
      'pointer-events: auto !important'
    ].join(';');

    return box;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  function showStealthPopupForQuestion(qNum, anchorEl, doc) {
    const box = ensureStealthWidget(doc);
    if (!box) return;

    const ans = answersByQuestion[String(qNum)];
    const lastGeneral = generalHints.length > 0 ? generalHints[generalHints.length - 1] : null;

    if (!ans && !lastGeneral) {
      box.innerHTML = `<div style="color:#6c757d;font-size:9px;">№${escapeHtml(qNum)}: ждем ответ...</div>`;
    } else {
      let html = '';
      if (ans) {
        const exactCode = decodeExactCode(ans);
        const isCode = !!(ans.codeBase64 || ans.code || ans.isCode || (exactCode.includes('\n') && ans.type && ans.type.includes('Код')));
        html += `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e9ecef;padding-bottom:2px;margin-bottom:2px;color:#495057;font-size:9px;gap:3px;">
          <span><b>№${escapeHtml(qNum)}</b> ${ans.optionIndex ? `Вар:<b>${escapeHtml(ans.optionIndex)}</b>` : ''}</span>
          <span style="display:inline-flex;gap:3px;align-items:center;">
            <a href="#" id="sib-copy-ans-btn" style="color:#495057;text-decoration:underline;cursor:pointer;font-size:8.5px;">[Коп]</a>
            <a href="#" id="sib-apply-ans-btn" style="color:#495057;text-decoration:underline;cursor:pointer;font-size:8.5px;">[${isCode ? 'Код' : 'Вставить'}]</a>
            <a href="#" id="sib-close-ans-btn" style="color:#adb5bd;text-decoration:none;cursor:pointer;font-size:11px;line-height:1;padding:0 2px;" title="Закрыть">×</a>
          </span>
        </div>`;

        if (isCode) {
          html += `<pre style="margin:0;padding:3px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:2px;font-family:Consolas,'Courier New',monospace;font-size:8.5px;line-height:1.25;white-space:pre;tab-size:4;overflow-x:auto;overflow-y:auto;max-height:75px;">${escapeHtml(exactCode)}</pre>`;
        } else {
          html += `<div style="white-space:pre-wrap;word-break:break-word;color:#212529;font-weight:500;font-size:9.5px;">${escapeHtml(ans.text || exactCode)}</div>`;
        }
      }

      if (lastGeneral) {
        html += `<div style="margin-top:2px;padding-top:2px;border-top:1px dashed #dee2e6;color:#6c757d;font-size:8.5px;">${escapeHtml(lastGeneral.text)}</div>`;
      }

      box.innerHTML = html;

      const copyBtn = box.querySelector('#sib-copy-ans-btn');
      if (copyBtn && ans) {
        copyBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const textToCopy = (ans.codeBase64 || ans.code || ans.isCode) ? decodeExactCode(ans) : String(ans.text || '');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
              copyBtn.textContent = '[Скоп]';
            }).catch(() => {});
          }
        };
      }

      const applyBtn = box.querySelector('#sib-apply-ans-btn');
      if (applyBtn && ans) {
        applyBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const ok = applyAnswerToQuestionDOM(qNum, ans);
          applyBtn.textContent = ok ? '[Вставлено]' : '[Ошибка]';
        };
      }

      const closeBtn = box.querySelector('#sib-close-ans-btn');
      if (closeBtn) {
        closeBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          box.style.display = 'none';
        };
      }

      if (ans && !viewedAckSent[qNum + '_' + ans.timestamp]) {
        viewedAckSent[qNum + '_' + ans.timestamp] = true;
        sendReadReceipt(qNum, ans.timestamp);
      }
    }

    // Всегда позиционируем строго в левом нижнем углу экрана (с принудительным сбросом top/right/inset)
    box.style.removeProperty('top');
    box.style.removeProperty('right');
    box.style.removeProperty('inset');
    box.style.setProperty('position', 'fixed', 'important');
    box.style.setProperty('bottom', '12px', 'important');
    box.style.setProperty('left', '12px', 'important');
    box.style.setProperty('top', 'auto', 'important');
    box.style.setProperty('right', 'auto', 'important');
    box.style.setProperty('margin', '0', 'important');
    box.style.setProperty('transform', 'none', 'important');
    box.style.setProperty('display', 'block', 'important');
  }

  // Привязка к кнопкам вопросов в блоке справа (#mod_quiz_navblock / .qnbutton) + резервно к заголовку .info .no
  function bindRightNavButtons(doc) {
    if (!doc) return;
    ensureStealthWidget(doc);

    // 1. Кнопки в правом блоке навигации Moodle (.qnbutton, [id^="quiznavbutton"])
    const navButtons = doc.querySelectorAll('.qnbutton, [id^="quiznavbutton"], #mod_quiz_navblock a, .qn_buttons a');
    navButtons.forEach((btn, idx) => {
      const idMatch = (btn.id || '').match(/quiznavbutton(\d+)/i);
      const textDigits = (btn.textContent || '').replace(/\D/g, '');
      const qNum = idMatch ? idMatch[1] : (textDigits || String(idx + 1));
      if (!qNum) return;

      // Убираем стандартный title, чтобы жёлтая плашка браузера не мешала
      if (btn.hasAttribute('title')) {
        btn.setAttribute('data-orig-title', btn.getAttribute('title'));
        btn.removeAttribute('title');
      }

      // Ставим крошечный индикатор 3x3px, если ответ на этот вопрос уже прислан другом
      let dot = btn.querySelector('.sib-ready-dot');
      if (answersByQuestion[String(qNum)]) {
        if (!dot) {
          if (getComputedStyle(btn).position === 'static') {
            btn.style.position = 'relative';
          }
          dot = doc.createElement('span');
          dot.className = 'sib-ready-dot';
          dot.style.cssText = 'position:absolute;bottom:2px;right:2px;width:4px;height:4px;border-radius:50%;background:#64748b;pointer-events:none;opacity:0.85;';
          btn.appendChild(dot);
        }
      } else if (dot) {
        dot.remove();
      }

      if (!btn.__sibHoverBound) {
        btn.__sibHoverBound = true;
        btn.addEventListener('mouseenter', () => {
          if (hoverHideTimeout) {
            clearTimeout(hoverHideTimeout);
            hoverHideTimeout = null;
          }
          showStealthPopupForQuestion(qNum, btn, doc);
        });
        btn.addEventListener('mouseleave', () => {
          hoverHideTimeout = setTimeout(() => {
            const box = doc.getElementById('sib-stealth-nav-popup');
            if (box) box.style.display = 'none';
          }, 220);
        });
      }
    });

    // 2. Резервная привязка к плашке "Вопрос N" слева от самого вопроса (.que .info .no)
    doc.querySelectorAll('.que').forEach((qEl, idx) => {
      const noBox = qEl.querySelector('.info .no, h3.no');
      if (!noBox) return;
      const qNum = noBox.textContent.replace(/\D/g, '') || String(idx + 1);
      if (!noBox.__sibHoverBound) {
        noBox.__sibHoverBound = true;
        noBox.addEventListener('mouseenter', () => {
          if (hoverHideTimeout) clearTimeout(hoverHideTimeout);
          showStealthPopupForQuestion(qNum, noBox, doc);
        });
        noBox.addEventListener('mouseleave', () => {
          hoverHideTimeout = setTimeout(() => {
            const box = doc.getElementById('sib-stealth-nav-popup');
            if (box) box.style.display = 'none';
          }, 220);
        });
      }
    });
  }

  // ==========================================================================
  // 7. СЕРИАЛИЗАЦИЯ ВИЗУАЛЬНОГО СЛЕПКА СТРАНИЦЫ (DOM MIRROR ДЛЯ ДРУГА)
  // ==========================================================================
  function serializeCleanDOM(doc) {
    try {
      const clone = doc.documentElement.cloneNode(true);
      clone.querySelectorAll('script, #sib-stealth-nav-popup').forEach(s => s.remove());

      // Синхронизируем состояния input / textarea / select
      const origInputs = doc.querySelectorAll('input, textarea, select');
      const cloneInputs = clone.querySelectorAll('input, textarea, select');
      origInputs.forEach((inp, i) => {
        if (!cloneInputs[i]) return;
        if (inp.type === 'checkbox' || inp.type === 'radio') {
          if (inp.checked) cloneInputs[i].setAttribute('checked', 'checked');
          else cloneInputs[i].removeAttribute('checked');
        } else if (inp.tagName === 'SELECT') {
          const opts = cloneInputs[i].querySelectorAll('option');
          opts.forEach((o, oIdx) => {
            if (oIdx === inp.selectedIndex) o.setAttribute('selected', 'selected');
            else o.removeAttribute('selected');
          });
        } else {
          cloneInputs[i].setAttribute('value', inp.value || '');
          if (inp.tagName === 'TEXTAREA') cloneInputs[i].textContent = inp.value || '';
        }
      });

      // Подставляем закешированные Base64-картинки прямо в HTML-слепок
      clone.querySelectorAll('img').forEach(img => {
        const rawSrc = img.getAttribute('src') || '';
        if (!rawSrc || rawSrc.startsWith('data:')) return;
        try {
          const fullUrl = new URL(rawSrc, doc.location.href).href;
          if (imageCache.has(fullUrl)) {
            img.setAttribute('src', imageCache.get(fullUrl));
          } else {
            img.setAttribute('src', fullUrl);
          }
        } catch (e) {}
      });

      const base = doc.createElement('base');
      base.href = doc.location.origin + '/';
      const head = clone.querySelector('head');
      if (head) head.prepend(base);

      return '<!DOCTYPE html>' + clone.outerHTML;
    } catch (e) {
      return '';
    }
  }

  // ==========================================================================
  // 8. МУЛЬТИ-ТРАНСПОРТНЫЙ ШЛЮЗ SMARTBRIDGE (P2P WEBRTC + FIREBASE + VPS RELAY)
  // ==========================================================================
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

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

  const outboxQueue = [];
  let lastDomHash = 0;
  let lastDomSentAt = 0;
  let activeTransportName = 'firebase';

  // --- WebRTC P2P DataChannel (Браузер <-> Браузер напрямую без сервера) ---
  let rtcPeer = null;
  let rtcDataChannel = null;
  let rtcOfferSent = false;
  let rtcAnswerApplied = false;

  function initWebRTC() {
    if (rtcPeer || typeof RTCPeerConnection === 'undefined') return;
    try {
      rtcPeer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' }
        ]
      });

      rtcDataChannel = rtcPeer.createDataChannel('sib_exam_sync', { ordered: true });
      setupDataChannelEvents(rtcDataChannel);

      rtcPeer.onicecandidate = (e) => {
        if (e.candidate) {
          smartRawSend(`sessions/${studentId}/signal_candidate`, { candidate: e.candidate, from: 'student' }, 'PUT');
        }
      };

      rtcPeer.createOffer().then(offer => {
        return rtcPeer.setLocalDescription(offer);
      }).then(() => {
        if (!rtcOfferSent && rtcPeer.localDescription) {
          rtcOfferSent = true;
          smartRawSend(`sessions/${studentId}/signal_offer`, {
            type: rtcPeer.localDescription.type,
            sdp: rtcPeer.localDescription.sdp,
            timestamp: Date.now()
          }, 'PUT');
        }
      }).catch(() => {});
    } catch (e) {}
  }

  function setupDataChannelEvents(channel) {
    if (!channel) return;
    channel.onopen = () => {
      activeTransportName = 'p2p';
      flushOutboxQueue();
    };
    channel.onclose = () => {
      if (activeTransportName === 'p2p') activeTransportName = 'firebase';
    };
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.inbox) {
          processInboxData(msg.inbox);
        }
      } catch (err) {}
    };
  }

  // Централизованная отправка: P2P > Firebase > VPS Relay
  async function smartSend(path, payload, method = 'PUT') {
    let success = false;

    // 1. Попытка через прямой WebRTC P2P канал
    if (rtcDataChannel && rtcDataChannel.readyState === 'open') {
      try {
        rtcDataChannel.send(JSON.stringify({ path, payload, method, ts: Date.now() }));
        activeTransportName = 'p2p';
        return true;
      } catch (e) {}
    }

    // 2. Отправка через Firebase
    try {
      const res = await fetchWithTimeout(`${FB_BASE}/${path}.json`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3500);
      if (res.ok) {
        success = true;
        activeTransportName = 'firebase';
      }
    } catch (e) {}

    // 3. Резервный канал на VPS (только если задан VPS_API)
    if (VPS_API) {
      try {
        const vpsRes = await fetchWithTimeout(`${VPS_API}/api/sync/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 3000);
        if (vpsRes.ok) {
          success = true;
          if (activeTransportName !== 'p2p') activeTransportName = 'vps';
        }
      } catch (e) {}
    }

    if (!success) {
      if (outboxQueue.length < 25) {
        outboxQueue.push({ path, payload, method });
      }
    } else {
      flushOutboxQueue();
    }

    return success;
  }

  async function smartRawSend(path, payload, method = 'PUT') {
    try {
      await fetchWithTimeout(`${FB_BASE}/${path}.json`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3000);
    } catch (e) {}
    if (VPS_API) {
      try {
        await fetchWithTimeout(`${VPS_API}/api/sync/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 3000);
      } catch (e) {}
    }
  }

  async function flushOutboxQueue() {
    if (outboxQueue.length === 0) return;
    const batch = outboxQueue.splice(0, 4);
    for (const item of batch) {
      await smartSend(item.path, item.payload, item.method);
    }
  }

  async function sendReadReceipt(qNum) {
    await smartSend(`sessions/${studentId}/inbox/answers/${qNum}`, {
      viewedByStudent: true,
      viewedAt: Date.now()
    }, 'PATCH');
  }

  // ==========================================================================
  // 9. SPA-ПАГИНАТОР MOODLE (СОХРАНЯЕТ СКРИПТ ПРИ ПЕРЕХОДЕ СТРАНИЦ) + PANIC KEY
  // ==========================================================================
  let escPressCount = 0;
  let escPressTimer = null;

  function installPanicKey(doc) {
    if (!doc || doc.__sibPanicInstalled) return;
    doc.__sibPanicInstalled = true;

    doc.addEventListener('keydown', (e) => {
      // Тройной клик Escape за 1.5 секунды — экстренное уничтожение всех следов
      if (e.key === 'Escape') {
        escPressCount++;
        if (escPressTimer) clearTimeout(escPressTimer);
        escPressTimer = setTimeout(() => { escPressCount = 0; }, 1500);

        if (escPressCount >= 3) {
          const box = doc.getElementById('sib-stealth-answer-box');
          if (box) box.remove();
          try {
            localStorage.removeItem('sib_exam_student_id');
            sessionStorage.clear();
          } catch (err) {}
          window.__SIB_EXAM_ACTIVE = false;
          console.clear();
        }
      }
    }, true);
  }

  // ==========================================================================
  // 9. РАЗБЛОКИРОВКА ПРАВОЙ БОКОВОЙ ПАНЕЛИ MOODLE BOOST (НАВИГАЦИЯ ПО ВОПРОСАМ)
  // ==========================================================================
  function installDrawerUnlock(doc, win) {
    if (!doc) return;
    const targetWin = win || window;

    if (targetWin.__sibDrawerHandler) {
      try {
        targetWin.removeEventListener('click', targetWin.__sibDrawerHandler, true);
        doc.removeEventListener('click', targetWin.__sibDrawerHandler, true);
      } catch (e) {}
    }

    targetWin.__sibDrawerHandler = function (e) {
      const btn = e.target.closest(
        '[data-target="theme_boost-drawers-blocks"], ' +
        '[data-action="closedrawer"], ' +
        '[data-action="toggle"][data-target*="drawer"], ' +
        '.drawer-right-toggle button, ' +
        '.drawer-right-toggle, ' +
        '[data-toggler="drawers"], ' +
        'button[aria-label*="боков"], ' +
        'button[aria-label*="панел"], ' +
        '[data-original-title*="боков"], ' +
        '[title*="боков"], ' +
        '#theme_boost-drawers-blocks .drawerheader button, ' +
        '#theme_boost-drawers-blocks button.drawertoggle'
      );
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const drawer = doc.getElementById('theme_boost-drawers-blocks') || doc.querySelector('.drawer-right');
      const page = doc.getElementById('page');
      if (!drawer) return;

      const isCloseBtn = (btn.hasAttribute('data-action') && btn.getAttribute('data-action') === 'closedrawer') || !!btn.closest('.drawerheader');
      const isCurrentlyOpen = drawer.classList.contains('show') && drawer.style.visibility !== 'hidden' && drawer.getAttribute('aria-hidden') !== 'true';

      if (isCurrentlyOpen || isCloseBtn) {
        drawer.classList.remove('show');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('aria-expanded', 'false');
        drawer.style.setProperty('right', '-325px', 'important');
        drawer.style.setProperty('visibility', 'hidden', 'important');
        if (page) page.classList.remove('show-drawer-right');
        const innerCloseBtn = drawer.querySelector('.drawerheader button.drawertoggle, [data-action="closedrawer"]');
        if (innerCloseBtn) innerCloseBtn.classList.add('hidden');
      } else {
        drawer.classList.add('show');
        drawer.removeAttribute('aria-hidden');
        drawer.setAttribute('aria-expanded', 'true');
        drawer.style.setProperty('right', '0px', 'important');
        drawer.style.setProperty('visibility', 'visible', 'important');
        drawer.style.setProperty('display', 'block', 'important');
        drawer.style.setProperty('z-index', '1040', 'important');
        if (page) page.classList.add('show-drawer-right');
        const innerCloseBtn = drawer.querySelector('.drawerheader button.drawertoggle, [data-action="closedrawer"]');
        if (innerCloseBtn) innerCloseBtn.classList.remove('hidden');
      }
    };

    targetWin.addEventListener('click', targetWin.__sibDrawerHandler, true);
    doc.addEventListener('click', targetWin.__sibDrawerHandler, true);
  }

  // ==========================================================================
  // 10. SPA-ПАГИНАТОР MOODLE (СОХРАНЯЕТ СКРИПТ ПРИ ПЕРЕХОДЕ СТРАНИЦ)
  // ==========================================================================
  function installSpaNavigation(doc) {
    if (!doc || doc.__sibSpaInstalled) return;
    doc.__sibSpaInstalled = true;

    async function handleSpaTransition(targetUrl, method, body) {
      try {
        const resp = await fetchWithTimeout(targetUrl, {
          method: method || 'POST',
          body: body,
          credentials: 'include'
        }, 10000);

        if (!resp.ok) {
          return false;
        }

        const html = await resp.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');

        const oldMain = doc.querySelector('#region-main, main, #page-content, .course-content, form#responseform');
        const newMain = newDoc.querySelector('#region-main, main, #page-content, .course-content, form#responseform');
        if (oldMain && newMain) {
          oldMain.innerHTML = newMain.innerHTML;
        } else if (newDoc.body) {
          doc.body.innerHTML = newDoc.body.innerHTML;
        }

        const oldNav = doc.querySelector('#mod_quiz_navblock');
        const newNav = newDoc.querySelector('#mod_quiz_navblock');
        if (oldNav && newNav) {
          oldNav.innerHTML = newNav.innerHTML;
        }

        try {
          doc.title = newDoc.title;
          window.history.pushState(null, '', resp.url || targetUrl);
        } catch (hErr) {}

        bindRightNavButtons(doc);
        syncQuestionsAndMirror();
        return true;
      } catch (err) {
        return false;
      }
    }

    // Перехват всех форм Moodle (старт теста, отправка ответов, пагинация)
    doc.addEventListener('submit', async (e) => {
      const form = e.target;
      if (!form) return;
      const action = (form.getAttribute('action') || form.action || '').toLowerCase();
      const formId = (form.id || '').toLowerCase();
      if (formId === 'responseform' || action.includes('attempt') || action.includes('quiz') || form.querySelector('input[name="attempt"], input[name="cmid"], input[name="sesskey"]')) {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(form);
        const ok = await handleSpaTransition(form.action || doc.location.href, form.method || 'POST', formData);
        if (!ok) form.submit();
      }
    }, true);

    // Перехват кликов по ссылкам пагинации и кнопкам теста (НЕ перехватываем системные меню и панели)
    doc.addEventListener('click', async (e) => {
      // Игнорируем клики по любым кнопкам боковых панелей (drawer), оглавлению курса, уведомлениям и шапке Moodle
      if (e.target.closest('[data-action], [data-toggle], [data-toggler], [aria-controls], [data-region="drawer"], .drawer, .navbar, .header-actions, .popover-region, [data-side], button[aria-label*="панел"], button[aria-label*="оглавлен"]')) {
        return;
      }

      // Перехватываем только кнопки перехода страниц теста и кнопки навигатора вопросов
      const navTarget = e.target.closest('.mod_quiz-next-nav, a.qnbutton, #responseform input[name="next"], #responseform input[name="previous"], #responseform .submitbtns input, #responseform .submitbtns button, a[href*="attempt.php"][href*="page="]');
      if (!navTarget) return;

      // Не перехватываем завершение теста — даём Moodle штатно закрыть попытку
      if (navTarget.name && /finish/i.test(navTarget.name)) return;

      if (navTarget.tagName === 'A') {
        const href = navTarget.href;
        if (href && (href.includes('attempt.php') || href.includes('page='))) {
          e.preventDefault();
          e.stopPropagation();
          const ok = await handleSpaTransition(href, 'GET', null);
          if (!ok) window.location.href = href;
          return;
        }
      }

      // Кнопка формы отправки должна относиться строго к форме responseform
      const form = navTarget.closest('form#responseform') || doc.getElementById('responseform');
      if (!form || !navTarget.closest('#responseform')) return;

      e.preventDefault();
      e.stopPropagation();

      const formData = new FormData(form);
      if (navTarget.name) formData.append(navTarget.name, navTarget.value || '1');
      const targetUrl = form.action || doc.location.href;
      const ok = await handleSpaTransition(targetUrl, form.method || 'POST', formData);
      if (!ok) form.submit();
    }, true);
  }

  async function syncQuestionsAndMirror() {
    const doc = getActiveDoc();
    if (!doc || !doc.body) return;

    installAntiDetection(getActiveWin());
    installPanicKey(doc);
    installDrawerUnlock(doc, getActiveWin());
    installSpaNavigation(doc);
    bindRightNavButtons(doc);

    // Инициализируем P2P при первом тике
    if (!rtcPeer) initWebRTC();

    // Собираем все вопросы на текущей странице
    const qElements = Array.from(doc.querySelectorAll('.que'));
    const parsedQuestions = [];
    for (let i = 0; i < qElements.length; i++) {
      parsedQuestions.push(await parseSingleQuestion(qElements[i], i, doc));
    }

    // Название предмета / теста и имя студента
    const pageTitle = normaliseText(doc.title || 'Экзамен Moodle');
    const userEl = doc.querySelector('.usertext, .logininfo a, #usermenu .userbutton');
    const studentName = userEl ? normaliseText(userEl.textContent) : studentId;

    // Список всех номеров вопросов из правого блока навигации
    const navNumbers = [];
    doc.querySelectorAll('.qnbutton, [id^="quiznavbutton"]').forEach((btn, i) => {
      const m = (btn.id || '').match(/quiznavbutton(\d+)/i);
      const num = m ? m[1] : ((btn.textContent || '').replace(/\D/g, '') || String(i + 1));
      if (num && !navNumbers.includes(num)) navNumbers.push(num);
    });

    const isAttemptActive = /\/mod\/quiz\/attempt\.php/i.test(doc.location.href);

    const sig = JSON.stringify({
      url: doc.location.href,
      isAttemptActive,
      qNums: parsedQuestions.map(q => q.number + ':' + q.textInputValue + ':' + (q.codeRunner ? q.codeRunner.currentCode : ''))
    });

    // 1. Вопросы: обновляем и фиксируем сигнатуру ТОЛЬКО при активной попытке
    if (isAttemptActive) {
      if (sig !== lastParsedSignature) {
        const questionsMap = {};
        parsedQuestions.forEach(q => {
          questionsMap[q.number] = q;
        });
        const ok = await smartSend(`sessions/${studentId}/questions`, questionsMap, 'PATCH');
        if (ok) {
          lastParsedSignature = sig;
        }
      }
    } else {
      // Если попытка не активна (на странице view.php/курса) — очищаем старые вопросы
      if (lastParsedSignature !== 'no_attempt') {
        lastParsedSignature = 'no_attempt';
        await smartSend(`sessions/${studentId}/questions`, null, 'PUT');
      }
    }

    // 2. Статус онлайна, курсор и активный транспорт
    await smartSend(`sessions/${studentId}/meta`, {
      studentId,
      studentName,
      pageTitle,
      url: doc.location.href,
      isAttemptActive,
      isSeparatePopup: getActiveWin() !== window,
      totalNavQuestions: isAttemptActive ? (navNumbers.length || parsedQuestions.length) : 0,
      navNumbers: isAttemptActive ? navNumbers : [],
      activePageQuestions: isAttemptActive ? parsedQuestions.map(q => q.number) : [],
      cursor: cursorState,
      transport: activeTransportName,
      lastSeen: Date.now()
    }, 'PATCH');

    // 3. Слепок DOM: отправляем только при изменении структуры или раз в 25 сек
    const domHtml = serializeCleanDOM(doc);
    if (domHtml && domHtml.length < 1800000) {
      const curHash = hashString(domHtml);
      const now = Date.now();
      if (curHash !== lastDomHash || (now - lastDomSentAt) > 25000) {
        const ok = await smartSend(`sessions/${studentId}/mirror`, {
          html: domHtml,
          cursor: cursorState,
          updatedAt: now
        }, 'PUT');
        if (ok) {
          lastDomHash = curHash;
          lastDomSentAt = now;
        }
      }
    }
  }

  function processInboxData(data) {
    if (!data) return;

    if (data.answers && typeof data.answers === 'object') {
      answersByQuestion = data.answers;
    }
    if (data.hints && typeof data.hints === 'object') {
      generalHints = Object.values(data.hints).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    if (data.autoApply && data.autoApply.qNum && data.autoApply.timestamp) {
      const key = 'applied_' + data.autoApply.timestamp;
      if (!window[key]) {
        window[key] = true;
        const ansObj = answersByQuestion[String(data.autoApply.qNum)] || data.autoApply;
        const ok = applyAnswerToQuestionDOM(data.autoApply.qNum, ansObj);
        if (ok) {
          setTimeout(syncQuestionsAndMirror, 100);
        }
      }
    }
    if (data.fetchAllPages && data.fetchAllPages.timestamp) {
      const fKey = 'fetched_all_' + data.fetchAllPages.timestamp;
      if (!window[fKey]) {
        window[fKey] = true;
        if (typeof fetchAllQuizPagesInBackground === 'function') {
          try { fetchAllQuizPagesInBackground(getActiveDoc()); } catch (e) {}
        }
      }
    }
    bindRightNavButtons(getActiveDoc());
  }

  async function pollAnswersFromFriend() {
    let data = null;

    // 1. Проверяем наличие WebRTC Answer для установки прямого P2P канала
    if (rtcPeer && !rtcAnswerApplied) {
      try {
        const ansRes = await fetchWithTimeout(`${FB_BASE}/sessions/${studentId}/signal_answer.json`, { cache: 'no-store' }, 2000);
        if (ansRes.ok) {
          const ans = await ansRes.json();
          if (ans && ans.sdp && rtcPeer.signalingState !== 'stable') {
            rtcAnswerApplied = true;
            await rtcPeer.setRemoteDescription(new RTCSessionDescription(ans));
          }
        }
      } catch (e) {}
    }

    // 2. Получение ответов из Firebase
    try {
      const res = await fetchWithTimeout(`${FB_BASE}/sessions/${studentId}/inbox.json?t=${Date.now()}`, { cache: 'no-store' }, 3000);
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {}

    // 3. Резервный fallback на VPS (только если задан VPS_API)
    if (!data && VPS_API) {
      try {
        const vpsRes = await fetchWithTimeout(`${VPS_API}/api/sync/session/${studentId}/inbox`, { cache: 'no-store' }, 3000);
        if (vpsRes.ok) {
          data = await vpsRes.json();
          if (activeTransportName !== 'p2p') activeTransportName = 'vps';
        }
      } catch (e) {}
    }

    if (data) {
      processInboxData(data);
    }
  }

  // Запуск циклов синхронизации
  syncQuestionsAndMirror();
  window.__sibIntervals.push(setInterval(syncQuestionsAndMirror, 3000));
  window.__sibIntervals.push(setInterval(pollAnswersFromFriend, 1500));

  console.log('%c[SibExam] SmartBridge активен (WebRTC P2P + Firebase + VPS Relay).', 'color:#3ecf8e;font-weight:bold;');
})();
