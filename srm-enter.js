// ==UserScript==
// @name         srm-enter
// @namespace    https://ssc-platform.shanghai-electric.com/
// @version      2.2.3
// @description  自动展开高级搜索并应用原脚本默认筛选；Enter 后合并执行最新查询
// @match        https://ssc-platform.shanghai-electric.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/srm-enter.js
// @updateURL    https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/srm-enter.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__srmEnterV2) return;
  window.__srmEnterV2 = true;

  const PREFIX = '/ssc-collaboration-purchaser/api/';
  // 2026-11-01：逐页检查当前侧栏的全部 18 个列表、6 个无筛选入口。
  // 页面 -> 精确查询接口。防止把其他页面的候选项/明细查询一起暂存。
  const PAGES = {
    '/collaboration/purchase/lists': ['requisition'],
    '/collaboration/purchase/items': ['requisitionItem'],
    '/collaboration/orders': ['order'],
    '/collaboration/order/item': ['orderItem'],
    '/collaboration/produce/schedule': ['production/item'],
    '/collaboration/produce/preqc': ['preqc', 'preqc/group'],
    '/collaboration/produce/distribute': ['distribute'],
    '/collaboration/produce/qafile': ['qafile', 'qafile/auditList'],
    '/collaboration/shipment/resource': ['shipmentResources', 'inventory/summary/detailList'],
    '/collaboration/shipment/note': ['shipmentNotes', 'shipmentDispatch'],
    '/collaboration/shipment/return': ['returnitem'],
    '/collaboration/invoice/permit': ['invoice/permit', 'invoice/permitPool'],
    '/collaboration/invoice/notice': ['invoice/notice'],
    '/collaboration/report/order-execution': ['report/orderExecution', 'report/orderExecution/totalAmount'],
    '/collaboration/report/plan-execution': ['report/prexecution'],
    '/collaboration/report/plan-warning': ['report/prwarning'],
    '/collaboration/report/order-complete': ['report/complete/order/detail'],
    '/collaboration/report/order-collect': ['report/complete/order/collect'],
  };
  function currentPage() { return PAGES[location.pathname.replace(/\/$/, '')]; }
  // 与最初的脚本一致：展开高级搜索、清空下拉默认值、勾选“是否已关闭—是”。
  // 原脚本没有固定文本预填值，因此这里不自行设置订单号、WBS 或日期。
  const INITIAL_DEFAULTS = { expandAdvanced: true, clearSelects: true, includeClosedYes: true };
  const FORM_KEYS = {
    '/collaboration/purchase/lists': 'kAT221', '/collaboration/purchase/items': 'kH8d21',
    '/collaboration/orders': 'vV0I21', '/collaboration/order/item': 'x51p21',
    '/collaboration/produce/schedule': '4YV821', '/collaboration/produce/preqc': 'QPz121',
    '/collaboration/produce/distribute': '9C+G21', '/collaboration/produce/qafile': 'X9R321',
    '/collaboration/shipment/resource': 'ECN721', '/collaboration/shipment/note': 'nyKx21',
    '/collaboration/shipment/return': 'wGsS21', '/collaboration/invoice/permit': 'tMDP21',
    '/collaboration/invoice/notice': 'lYAB21', '/collaboration/report/order-execution': 'WK4421',
    '/collaboration/report/plan-execution': 'jqZf21', '/collaboration/report/plan-warning': 'YVjM21',
    '/collaboration/report/order-complete': 'iAMM21', '/collaboration/report/order-collect': 'yxX621',
  };
  const BATCH_MS = 450;
  let dirty = true, enabled = true, actual = 0, listActual = 0, timer = 0;
  let attached = 0, mounted = false;
  let route = location.pathname + location.search + location.hash;
  const batches = new Map(), busy = new Set(), patched = new WeakSet();
  const counters = { held: 0, sent: 0, completed: 0, failed: 0 };
  let defaultAutoDepth = 0, defaultsQueued = false, defaultsObserver;
  function newDefaultsSession() {
    return { stopped: false, until: 0, touched: new WeakSet(), expanded: new WeakSet(), cleared: new WeakSet(), checked: new WeakSet() };
  }
  let defaultsSession = newDefaultsSession();

  function touchDefaults(event) {
    if (!event.isTrusted || defaultAutoDepth || event.type === 'focusin') return;
    const form = searchForm(event.target);
    if (form) { defaultsSession.touched.add(form); defaultsSession.stopped = true; }
  }

  function autoDefault(action) {
    dirty = true; clearTimeout(timer);
    defaultAutoDepth++;
    try { action(); }
    finally { defaultAutoDepth--; }
  }

  function settleAutoClearFocus(control, session) {
    const clearedRoute = route;
    const blurIfAutomatic = () => {
      if (!enabled || session !== defaultsSession || session.stopped ||
          route !== clearedRoute || !control.isConnected) return;
      const active = document.activeElement;
      if (control.contains(active) && typeof active?.blur === 'function') {
        defaultAutoDepth++;
        try { active.blur(); } finally { defaultAutoDepth--; }
      }
    };
    blurIfAutomatic();
    // react-select 的清空处理会 setTimeout(focusInput)，立即 blur 会早于其自动聚焦。
    // 在该任务之后取消自动焦点；已开始人工操作时跳过，保留手动选择行为。
    setTimeout(blurIfAutomatic, 0);
    setTimeout(blurIfAutomatic, 80);
  }

  function applyInitialDefaults() {
    const session = defaultsSession;
    if (!enabled || !currentPage() || session.stopped || (session.until && Date.now() > session.until)) return;
    const expected = FORM_KEYS[location.pathname.replace(/\/$/, '')];
    for (const form of document.querySelectorAll('#ssc_content form')) {
      // pushState 后旧 DOM 可能短暂仍在；只操作新页面已核对的表单。
      if (form.getAttribute('_nk') !== expected || session.touched.has(form)) continue;
      if (!session.until) session.until = Date.now() + 8000;
      if (INITIAL_DEFAULTS.expandAdvanced && !session.expanded.has(form)) {
        const button = Array.from(form.querySelectorAll('button')).find(b =>
          /高级搜索|Advanced\s*Search/i.test(b.textContent));
        if (button && !button.disabled) {
          const down = button.querySelector('i.fa-angle-down, i.fa-chevron-down');
          const up = button.querySelector('i.fa-angle-up, i.fa-chevron-up');
          if (down || up || button.hasAttribute('aria-expanded')) {
            session.expanded.add(form);
            if (!button.disabled && (down || button.getAttribute('aria-expanded') === 'false')) {
              autoDefault(() => button.click());
            }
          }
        }
      }
      if (INITIAL_DEFAULTS.clearSelects) {
        for (const control of form.querySelectorAll('.form-control-select')) {
          if (session.cleared.has(control) || control.querySelector('input[id^="react-select-"]')?.disabled) continue;
          const paths = Array.from(control.querySelectorAll('svg[viewBox="0 0 20 20"] path')).filter(p =>
            (p.getAttribute('d') || '').trim().startsWith('M14.'));
          // 多选值自己的删除图标在前，整个控件的清空图标在后；一次清空全部默认值。
          const clear = paths[paths.length - 1]?.closest('svg')?.parentElement;
          if (!clear) continue; // 异步默认值尚未出现时不提前标记。
          session.cleared.add(control);
          autoDefault(() => {
            clear.dispatchEvent(new MouseEvent('mousedown', {
              bubbles: true, cancelable: true, button: 0, buttons: 1,
            }));
            settleAutoClearFocus(control, session);
          });
        }
      }
      if (INITIAL_DEFAULTS.includeClosedYes) {
        for (const label of form.querySelectorAll('small.form-text')) {
          if (!label.textContent.trim().startsWith('是否已关闭')) continue;
          let group = label.parentElement;
          while (group && group !== form && !group.querySelector('label.checkbox input[type="checkbox"]')) group = group.parentElement;
          if (!group || group === form) continue;
          const yesLabel = Array.from(group.querySelectorAll('label.checkbox')).find(e => e.textContent.trim() === '是');
          const yes = yesLabel?.querySelector('input[type="checkbox"]');
          if (!yes || yes.disabled || session.checked.has(yes)) continue;
          session.checked.add(yes);
          // 与旧脚本相同：只加选“是”，不取消“否”，不操作其他复选框。
          if (!yes.checked) autoDefault(() => yes.click());
        }
      }
    }
  }

  function queueDefaults() {
    if (defaultsQueued || defaultsSession.stopped || !currentPage() ||
        (defaultsSession.until && Date.now() > defaultsSession.until)) return;
    defaultsQueued = true;
    setTimeout(() => { defaultsQueued = false; applyInitialDefaults(); }, 0);
  }

  function classify(config) {
    const page = currentPage();
    if (!page) return null;
    const method = String(config.method || 'get').toLowerCase();
    let url;
    try { url = new URL(config.url, new URL(config.baseURL || '/', location.origin)); }
    catch (_) { return null; }
    const endpoint = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : '';
    if (url.origin !== location.origin || !page.includes(endpoint)) return null;
    // 当前源码已确认：POST /requisitionItem 是筛选查询；同路径其他 POST 不推断为只读。
    if (method !== 'get' && !(method === 'post' && endpoint === 'requisitionItem')) return null;
    if (['blob', 'arraybuffer', 'document', 'stream'].includes(config.responseType)) return null;
    if (endpoint === 'report/orderExecution/totalAmount' && method === 'get') return url.pathname;
    const params = config.params || {};
    if (!['page', 'size', 'pageNumber', 'pageSize'].some(k =>
      url.searchParams.has(k) || Object.prototype.hasOwnProperty.call(params, k) ||
      (typeof params.has === 'function' && params.has(k)))) return null;
    return method + ' ' + url.pathname;
  }

  function render() {
    const waiting = enabled && dirty && batches.size > 0 && listActual === 0;
    document.documentElement.classList.toggle('srm-enter-list-waiting', waiting);
    document.documentElement.classList.toggle('srm-enter-waiting', waiting && actual === 0);
  }

  function cancelError(axios, message) {
    return axios.Cancel ? new axios.Cancel(message) : new DOMException(message, 'AbortError');
  }

  function wait(config, adapter, axios, key) {
    return new Promise((resolve, reject) => {
      let group = batches.get(key);
      if (!group) batches.set(key, group = []);
      const item = { config, adapter, axios, resolve, reject, cleanup: () => {} };
      const cancel = reason => {
        const at = group.indexOf(item);
        if (at < 0) return;
        group.splice(at, 1);
        if (!group.length && batches.get(key) === group) batches.delete(key);
        item.cleanup(); reject(reason || cancelError(axios, '请求已取消')); render();
      };
      const onAbort = () => cancel(cancelError(axios, '请求已取消'));
      item.cleanup = () => {
        config.signal?.removeEventListener('abort', onAbort);
        config.cancelToken?.unsubscribe?.(cancel);
      };
      group.push(item);
      config.signal?.addEventListener('abort', onAbort, { once: true });
      config.cancelToken?.subscribe?.(cancel);
      if (config.signal?.aborted) onAbort();
      else if (config.cancelToken?.reason) cancel(config.cancelToken.reason);
      counters.held++;
      if (!dirty || !enabled) schedule();
      render();
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, BATCH_MS);
  }

  function flush() {
    if (dirty && enabled) return;
    for (const [key, group] of batches) {
      if (!group.length || busy.has(key)) continue;
      batches.delete(key);
      busy.add(key);
      // 同一轮多次输入产生的调用共享最新请求的真实响应。
      // 不生成假的成功数据；每个等待者均只 resolve/reject 一次。
      const latest = group[group.length - 1];
      actual++; listActual++; counters.sent++; render();
      const sendConfig = { ...latest.config, timeout: latest.config.timeout > 0 ? Math.min(latest.config.timeout, 60000) : 60000 };
      Promise.resolve().then(() => latest.adapter(sendConfig)).then(response => {
        counters.completed++;
        for (const item of group) {
          item.cleanup();
          // Axios transformResponse 会修改 response，故每个调用独立包装。
          item.resolve({ ...response, headers: { ...response.headers }, config: item.config });
        }
      }, failure => {
        counters.failed++;
        for (const item of group) { item.cleanup(); item.reject(failure); }
      }).finally(() => {
        actual--; listActual--; busy.delete(key); render();
        if (batches.has(key) && (!dirty || !enabled)) schedule();
      });
    }
  }

  function attach(axios) {
    if (!axios || !axios.interceptors?.request || typeof axios.defaults?.adapter !== 'function' || patched.has(axios)) return;
    patched.add(axios);
    // 在 Axios adapter 层合并，XHR 完成事件、响应头、失败和超时均由原 adapter 处理。
    axios.interceptors.request.use(config => {
      const key = classify(config);
      const adapter = config.adapter || axios.defaults.adapter;
      if (typeof adapter !== 'function') return config;
      if (!key || !enabled) {
        config.adapter = current => {
          actual++; render();
          return Promise.resolve().then(() => adapter(current)).finally(() => { actual--; render(); });
        };
      } else config.adapter = current => wait(current, adapter, axios, key);
      return config;
    });
    attached++; render();
  }

  // 此站使用 webpack 4。仅检查已加载模块，不执行未知业务模块。
  // 若站点升级不再兼容，明确提示并保留原查询行为。
  const runtimes = new Set();
  function registerRuntime(chunks) {
      if (!Array.isArray(chunks) || runtimes.has(chunks)) return;
      runtimes.add(chunks);
      const id = 'srm_enter_' + Math.random().toString(36).slice(2);
      chunks.push([[id], { [id]: function(module, exports, require) {
        function inspectExport(value) {
          if (!value) return;
          attach(value);
          for (const key of ['default', 'a']) {
            try { attach(value[key]); } catch (_) { /* 非 Axios 导出 */ }
          }
        }
        // 当前构建及本地旧构建的共享 Axios 均由模块 3 导出。
        // 在模块工厂返回之前安装拦截，覆盖首次挂载；不等第一次轮询。
        if (require.m) {
          let factory = require.m[3];
          function wrap(original) {
            if (typeof original !== 'function') return original;
            return function(...args) {
              const result = original.apply(this, args);
              inspectExport(args[0]?.exports);
              return result;
            };
          }
          factory = wrap(factory);
          try {
            Object.defineProperty(require.m, '3', {
              configurable: true, enumerable: true,
              get: () => factory, set: value => { factory = wrap(value); },
            });
          } catch (_) { /* 保留缓存扫描兜底 */ }
        }
        const scan = () => {
          for (const cached of Object.values(require.c || {})) {
            inspectExport(cached?.exports);
          }
        };
        scan(); setInterval(scan, 1000);
      } }, [[id]]]);
  }
  function discover() {
    for (const name of Object.keys(window)) {
      if (/^webpackJsonp/.test(name)) registerRuntime(window[name]);
    }
  }
  // document-start 即预置启动模块；运行时稍后创建数组时也能同步接管。
  function watchRuntime(name) {
    let value = window[name];
    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(window, name, {
        configurable: true, enumerable: true,
        get: () => value,
        set: next => { value = next; registerRuntime(next); },
      });
    }
    registerRuntime(value);
  }

  function searchForm(target) {
    if (!currentPage()) return null;
    const form = target instanceof Element ? target.closest('form') : null;
    // 完美订单汇总只有 react-select 和日期，不能要求存在 OL3b 文本输入。
    return form?.closest('#ssc_content') && form.querySelector('input,select,textarea') &&
      form.querySelector('small.form-text') ? form : null;
  }
  function changed(event) {
    touchDefaults(event);
    if (!enabled || !searchForm(event.target)) return;
    dirty = true; clearTimeout(timer); render();
  }
  // 不阻断控件自己的事件，React 仍能及时维护文本、选择、复选框状态。
  document.addEventListener('input', changed, true);
  document.addEventListener('change', changed, true);
  // react-select 修改 hidden input 不会派发 DOM change；在打开控件时即进入待提交状态。
  document.addEventListener('mousedown', changed, true);
  document.addEventListener('focusin', event => {
    if (event.target.matches?.('input[id^="react-select-"],select')) changed(event);
  }, true);
  document.addEventListener('click', event => {
    if (!searchForm(event.target)) return;
    if (event.target.closest('button')?.textContent.trim() === '重置') changed(event);
    const clear = event.target.closest('[_nk="OL3b22"],[_nk="OL3b32"]');
    const input = clear?.closest('[_nk="OL3b11"]')?.querySelector('input[_nk="OL3b41"]');
    if (enabled && input) {
      changed(event);
      const clearedRoute = route;
      // 保留网站自己的清空处理；等 React 更新完成后把光标交还给输入框。
      setTimeout(() => {
        if (enabled && route === clearedRoute && input.isConnected) input.focus();
      }, 0);
    }
  }, true);

  function submit() {
    defaultsSession.stopped = true;
    dirty = false; schedule(); render();
  }
  document.addEventListener('keydown', event => {
    touchDefaults(event);
    if (!enabled || event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    if (!searchForm(event.target)) return;
    // react-select 展开时，第一次 Enter 负责选中选项，第二次 Enter 执行查询。
    if (event.target.matches?.('input[id^="react-select-"]') &&
        document.querySelector('[id^="react-select-"][id*="-option-"], .form-control-select [class$="-menu"]')) return;
    event.preventDefault();
    setTimeout(submit, 0); // 等 React 同步完本轮事件，再开始合并窗口。
  }, true);
  document.addEventListener('submit', event => {
    if (enabled && searchForm(event.target)) { event.preventDefault(); submit(); }
  }, true);

  function routeChanged() {
    const next = location.pathname + location.search + location.hash;
    if (route === next) return;
    route = next; dirty = true; clearTimeout(timer);
    defaultsSession = newDefaultsSession();
    for (const group of batches.values()) for (const item of group) {
      item.cleanup(); item.reject(cancelError(item.axios, '页面已切换'));
    }
    batches.clear(); render(); queueDefaults();
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function(...args) { const result = original.apply(this, args); routeChanged(); return result; };
  }
  window.addEventListener('popstate', routeChanged);
  window.addEventListener('hashchange', routeChanged);

  function mount() {
    if (!document.body || mounted) return;
    mounted = true;
    const style = document.createElement('style');
    // P0Po12 是实测的表格分页加载区域；仅在请求暂存时替换其加载文案和动画。
    // 后台认证、元数据等请求若仍在运行，不隐藏其全局加载提示。
    style.textContent = `
      .srm-enter-waiting #layout-portal .dialog-loader { visibility:hidden!important }
      .srm-enter-list-waiting [_nk="P0Po12"] > * { display:none!important }
      .srm-enter-list-waiting [_nk="P0Po12"]::after {
        content:'待搜索 · 按 Enter 执行'; color:#64748b; font-size:13px; margin-right:12px;
      }
    `;
    document.head.append(style); render();
    if (typeof MutationObserver !== 'undefined') {
      defaultsObserver = new MutationObserver(queueDefaults);
      defaultsObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-expanded'] });
    }
    queueDefaults();
  }
  watchRuntime('webpackJsonpssc-purchaser-platform');
  discover();
  const boot = setInterval(() => { discover(); if (!mounted && document.body) mount(); }, 50);
  setTimeout(() => { clearInterval(boot); if (!attached) console.warn('[SRM Enter] 未连接查询组件：本页保持原有行为，请检查站点版本'); }, 20000);
  window.addEventListener('pagehide', () => document.documentElement.classList.remove('srm-enter-waiting', 'srm-enter-list-waiting'));
  console.info('[SRM Enter 2.2.3] 已启动：无浮动提示框；18 个业务列表、自动高级搜索及原脚本默认筛选。');
})();
// SRM_ENTER_FILE_END_2_2_3 - 文件完整结束，请勿遗漏此行之前的内容。
