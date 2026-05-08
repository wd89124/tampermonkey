// ==UserScript==
// @name         srm-enter
// @namespace    https://ssc-platform.shanghai-electric.com/
// @version      1.0
// @description  使用enter在srm中搜索
// @match        https://ssc-platform.shanghai-electric.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/srm-enter.js
// @updateURL    https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/srm-enter.js
// ==/UserScript==

(function () {
  'use strict';

  // ========== 1. 输入层 ==========
  const BYPASS = '__srmAllow__';
  const dirty = new WeakSet();

  function isSearchInput(el) {
    return el && el.tagName === 'INPUT' && el.getAttribute('_nk') === 'OL3b41';
  }
  function findClearButton(el) {
    for (let cur = el; cur && cur !== document; cur = cur.parentElement) {
      const nk = cur.getAttribute && cur.getAttribute('_nk');
      if (nk === 'OL3b22') return cur;
      if (nk === 'OL3b32') return cur.parentElement;
      if (nk === 'OL3b11') return null;
    }
    return null;
  }
  function findInputForClearButton(btn) {
    const w = btn.parentElement;
    return w ? w.querySelector('input[_nk="OL3b41"]') : null;
  }
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  function stampCompositionStart(i) {
    const ev = new CompositionEvent('compositionstart', { bubbles: true, data: '' });
    ev[BYPASS] = true;
    i.dispatchEvent(ev);
  }
  function fireSyncEnd(i) {
    const ev = new CompositionEvent('compositionend', { bubbles: true, data: i.value });
    ev[BYPASS] = true;
    i.dispatchEvent(ev);
  }

  document.addEventListener('input', function (e) {
    if (!isSearchInput(e.target)) return;
    stampCompositionStart(e.target);
    dirty.add(e.target);
  }, true);

  document.addEventListener('compositionend', function (e) {
    if (e[BYPASS]) return;
    if (!isSearchInput(e.target)) return;
    e.stopImmediatePropagation();
    stampCompositionStart(e.target);
  }, true);

  document.addEventListener('click', function (e) {
    const btn = findClearButton(e.target);
    if (!btn) return;
    const input = findInputForClearButton(btn);
    if (!input) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    nativeInputValueSetter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }, true);

  // ========== 2. 网络层 ==========
  let armUntil = 0;
  let forceBlockUntil = 0;
  let autoActionInProgress = 0;
  const ARM_WINDOW = 5000;
  const AUTO_BLOCK_MS = 15000;

  function setForceBlock(ms) {
    const u = Date.now() + (ms || AUTO_BLOCK_MS);
    if (u > forceBlockUntil) forceBlockUntil = u;
  }
  // 所有"脚本自动化点击"统一入口，保证两件事：
  //   1) 动作前设置 15s 强制拦截窗口
  //   2) 动作期间 autoActionInProgress > 0，阻止第 3 段把 forceBlock 清零
  function runAutoAction(fn) {
    setForceBlock(AUTO_BLOCK_MS);
    autoActionInProgress++;
    try { fn(); }
    finally {
      setTimeout(function () {
        autoActionInProgress = Math.max(0, autoActionInProgress - 1);
      }, 1000);
    }
  }
  function isStaticResource(url) {
    const u = String(url || '').split(/[?#]/)[0];
    return /\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|eot|ico|webp|mp4|mp3|map)$/i.test(u);
  }

  const URL_RE = /[?&](page|pageNumber|pageNo|pageNum|pageIndex|pageSize|size|sizePerPage|current|offset|limit|pn|ps|start|rows)=\d+/i;
  const BODY_RE = /["']?(page|pageNumber|pageNo|pageNum|pageIndex|pageSize|size|sizePerPage|current|offset|limit|pn|ps|start|rows)["']?\s*[:=]\s*\d+/i;

  function looksLikeSearch(url, body) {
    if (URL_RE.test(String(url || ''))) return true;
    if (typeof body === 'string' && body && BODY_RE.test(body)) return true;
    return false;
  }
  function shouldBlock(url, body) {
    if (Date.now() < forceBlockUntil && !isStaticResource(url)) return true;
    return Date.now() > armUntil && looksLikeSearch(url, body);
  }

  function buildFake() {
    return {
      code: 0, status: 0, success: true, message: 'ok',
      errorCode: '00000', errorMsg: '', msg: 'success', resultCode: '0',
      data: {
        list: [], rows: [], records: [], items: [], content: [],
        totalSize: 0, total: 0, totalCount: 0,
        totalElements: 0, totalPages: 0,
        pageNumber: 1, pageNo: 1, pageSize: 20, size: 20, number: 0,
        first: true, last: true, empty: true, numberOfElements: 0
      },
      list: [], rows: [], content: [],
      totalElements: 0, totalPages: 0,
      size: 20, number: 0, first: true, last: true, empty: true, numberOfElements: 0
    };
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const body = init && init.body != null ? String(init.body) : '';
    if (shouldBlock(url, body)) {
      console.warn('[SRM 拦截 fetch]', url);
      return Promise.resolve(new Response(JSON.stringify(buildFake()), {
        status: 200, statusText: 'OK',
        headers: { 'content-type': 'application/json;charset=UTF-8' }
      }));
    }
    return origFetch.apply(this, arguments);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__srmUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const b = body != null ? String(body) : '';
    if (!shouldBlock(this.__srmUrl, b)) {
      return origSend.apply(this, arguments);
    }
    console.warn('[SRM 拦截 XHR]', this.__srmUrl);
    const self = this;
    const url = self.__srmUrl || '';
    const fakeObj = buildFake();
    const fakeStr = JSON.stringify(fakeObj);
    const rt = self.responseType;
    const respVal = (rt === 'json') ? fakeObj
      : (rt === 'arraybuffer') ? new TextEncoder().encode(fakeStr).buffer
      : (rt === 'blob') ? new Blob([fakeStr], { type: 'application/json' })
      : fakeStr;

    setTimeout(function () {
      try {
        const props = {
          readyState: 4, status: 200, statusText: 'OK',
          responseText: fakeStr, response: respVal,
          responseURL: url, responseXML: null
        };
        Object.keys(props).forEach(function (k) {
          try {
            Object.defineProperty(self, k, {
              value: props[k], configurable: true, writable: true, enumerable: true
            });
          } catch (err) {}
        });
        self.getResponseHeader = function (name) {
          return /content-type/i.test(name) ? 'application/json;charset=UTF-8' : null;
        };
        self.getAllResponseHeaders = function () {
          return 'content-type: application/json;charset=UTF-8\r\n';
        };
        function fire(propName, event) {
          try { if (typeof self[propName] === 'function') self[propName].call(self, event); } catch (err) {}
          try { self.dispatchEvent(event); } catch (err) {}
        }
        fire('onreadystatechange', new Event('readystatechange'));
        fire('onload', new ProgressEvent('load', { lengthComputable: true, loaded: fakeStr.length, total: fakeStr.length }));
        fire('onloadend', new ProgressEvent('loadend', { lengthComputable: true, loaded: fakeStr.length, total: fakeStr.length }));
      } catch (err) { console.error('[SRM fake xhr error]', err); }
    }, 0);
  };

  // 脚本一启动就激活 autoMode，覆盖首次进入
  setForceBlock(AUTO_BLOCK_MS);

  // ========== 3. 放行窗口 ==========
  document.addEventListener('mousedown', function (e) {
    if (!e.isTrusted) return;
    if (autoActionInProgress > 0) return;     // 自动化动作中绝不清零
    forceBlockUntil = 0;
    if (isSearchInput(e.target)) return;
    if (findClearButton(e.target)) return;
    armUntil = Date.now() + ARM_WINDOW;
  }, true);

  document.addEventListener('change', function (e) {
    if (!e.isTrusted) return;
    if (autoActionInProgress > 0) return;
    forceBlockUntil = 0;
    if (isSearchInput(e.target)) return;
    armUntil = Date.now() + ARM_WINDOW;
  }, true);

  function closeArm() { armUntil = 0; }
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (!isSearchInput(e.target)) return;
    forceBlockUntil = 0;
    armUntil = Date.now() + ARM_WINDOW;
    dirty.add(e.target);
    document.querySelectorAll('input[_nk="OL3b41"]').forEach(function (input) {
      if (dirty.has(input)) {
        fireSyncEnd(input);
        dirty.delete(input);
      }
    });
  }, true);

  // ========== 4. 自动展开高级搜索 ==========
  let lastAutoExpandPath = null;

  function findCollapsedAdvancedButton() {
    const buttons = document.querySelectorAll('button.btn-outline-primary.btn-bold');
    for (const btn of buttons) {
      if (!btn.querySelector('i.fa-angle-down')) continue;
      const txt = (btn.textContent || '').trim();
      if (!txt.includes('高级搜索') && !/Advanced\s*Search/i.test(txt)) continue;
      return btn;
    }
    return null;
  }

  function maybeExpand() {
    const path = location.pathname + location.search + location.hash;
    if (path === lastAutoExpandPath) return;
    const btn = findCollapsedAdvancedButton();
    if (!btn) return;
    lastAutoExpandPath = path;
    btn.click();
    console.log('[SRM] 已自动展开高级搜索', path);
  }

  // ========== 5. 自动清空筛选下拉默认值 ==========
  let clearSelectsUntil = 0;
  const CLEAR_WINDOW = 8000;
  const cleared = new WeakSet();

  function findSearchForms() {
    const forms = new Set();
    document.querySelectorAll('input[_nk="OL3b41"]').forEach(function (input) {
      for (let cur = input; cur && cur !== document.body; cur = cur.parentElement) {
        if (cur.tagName === 'FORM') { forms.add(cur); return; }
      }
    });
    return forms;
  }

  function maybeClearSelects() {
    if (Date.now() > clearSelectsUntil) return;
    const forms = findSearchForms();
    if (forms.size === 0) return;
    const targets = [];
    forms.forEach(function (form) {
      form.querySelectorAll('svg[viewBox="0 0 20 20"]').forEach(function (svg) {
        const p = svg.querySelector('path');
        if (!p) return;
        const d = (p.getAttribute('d') || '').trim();
        if (!d.startsWith('M14.')) return;
        const btn = svg.parentElement;
        if (!btn || cleared.has(btn)) return;
        targets.push(btn);
      });
    });
    if (targets.length === 0) return;
    runAutoAction(function () {
      targets.forEach(function (btn) {
        cleared.add(btn);
        btn.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true, cancelable: true, button: 0
        }));
        console.log('[SRM] 已清空筛选下拉默认值');
      });
    });
    setTimeout(function () {
      const a = document.activeElement;
      if (a && a !== document.body && typeof a.blur === 'function') a.blur();
    }, 0);
  }

  // ========== 7. 自动勾选"是否已关闭-是" ==========
  let lastAutoCheckPath = null;

  function findClosedStatusYesCheckbox() {
    const labels = document.querySelectorAll('small.form-text');
    for (const label of labels) {
      const txt = (label.textContent || '').trim();
      if (!txt.startsWith('是否已关闭')) continue;
      let container = label.parentElement;
      while (container && container !== document.body &&
             !container.querySelector('label.checkbox input[type="checkbox"]')) {
        container = container.parentElement;
      }
      if (!container || container === document.body) continue;
      const checkboxLabels = container.querySelectorAll('label.checkbox');
      for (const cb of checkboxLabels) {
        const text = (cb.textContent || '').trim();
        if (text === '是') {
          return cb.querySelector('input[type="checkbox"]');
        }
      }
    }
    return null;
  }

  function maybeCheckClosedYes() {
    const path = location.pathname + location.search + location.hash;
    if (path === lastAutoCheckPath) return;
    const input = findClosedStatusYesCheckbox();
    if (!input) return;
    lastAutoCheckPath = path;
    if (!input.checked) {
      runAutoAction(function () {
        input.click();
        console.log('[SRM] 已自动勾选"是否已关闭-是"');
      });
    }
  }

  // ========== 6. 路由切换统一调度 ==========
  function onRouteMayChange() {
    closeArm();
    setForceBlock(AUTO_BLOCK_MS);
    lastAutoExpandPath = null;
    lastAutoCheckPath = null;
    clearSelectsUntil = Date.now() + CLEAR_WINDOW;
    [50, 300, 1000, 2000, 3500, 5500].forEach(function (ms) {
      setTimeout(function () {
        maybeExpand();
        maybeClearSelects();
        maybeCheckClosedYes();
      }, ms);
    });
  }

  window.addEventListener('popstate', onRouteMayChange);
  window.addEventListener('hashchange', onRouteMayChange);
  history.pushState = function () { onRouteMayChange(); return origPushState.apply(this, arguments); };
  history.replaceState = function () { onRouteMayChange(); return origReplaceState.apply(this, arguments); };

  clearSelectsUntil = Date.now() + CLEAR_WINDOW;

  const obs = new MutationObserver(function () {
    maybeExpand();
    maybeClearSelects();
    maybeCheckClosedYes();
  });
  function startObserving() {
    if (!document.body) { requestAnimationFrame(startObserving); return; }
    obs.observe(document.body, { childList: true, subtree: true });
    maybeExpand();
    maybeClearSelects();
    maybeCheckClosedYes();
  }
  startObserving();

  console.log('[SRM 实时搜索拦截 v3.5] 已启用');
})();
