// ==UserScript==
// @name         制造令/机规/通知单搜索工具
// @namespace    http://tampermonkey.net/
// @version      3.6.38
// @description  快捷查询制造令/机规/通知单，支持完整GBK、跨模块链接修复及机规/通知单待办
// @author       10432987
// @match        http://10.16.88.34/notice/
// @match        http://10.16.88.34/zzl/
// @match        http://10.16.88.34/jigui/
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      64.90.23.77
// @connect      gh-proxy.org
// @require      https://cdn.jsdelivr.net/npm/gbk.js@0.3.0/dist/gbk.min.js
// @downloadURL  https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/jzt.user.js
// @updateURL    https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/jzt.user.js
// ==/UserScript==

(function() {
    'use strict';

    /* global GBK */

    // 固定浏览器标签页标题
    try {
        document.title = '制造令/机规/通知单';
    } catch (e) {}

    // 修复 WdatePicker.js 的 unload 弃用警告：在页面上下文中最早注入补丁（在 WdatePicker 之前执行）
    (function injectUnloadPatch() {
        const code = function() {
            var _add = window.addEventListener.bind(window);
            window.addEventListener = function(type, listener, options) {
                if (type === 'unload') { return _add('pagehide', listener, options); }
                return _add(type, listener, options);
            };
            try {
                var h = null;
                Object.defineProperty(window, 'onunload', {
                    configurable: true, enumerable: true,
                    get: function() { return h; },
                    set: function(f) { h = f; if (typeof f === 'function') window.addEventListener('pagehide', f); }
                });
            } catch (e) {}
        }.toString();
        const script = document.createElement('script');
        script.textContent = '(' + code + ')();';
        var root = document.documentElement || document.head || document;
        if (root.firstChild) {
            root.insertBefore(script, root.firstChild);
        } else {
            root.appendChild(script);
        }
        script.remove();
    })();

    // 注入全局样式，确保所有脚本元素使用微软雅黑字体
    const style = document.createElement('style');
    style.textContent = `
        #jigui-float-panel,
        #jigui-float-panel *,
        [id^="jigui-detail-panel-"],
        [id^="jigui-detail-panel-"] * {
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif !important;
        }
    `;
    document.head.appendChild(style);

    const themeStyle = document.createElement('style');
    themeStyle.textContent = `
        :root {
            --jigui-primary: #2563eb;
            --jigui-primary-dark: #1d4ed8;
            --jigui-primary-soft: #dbeafe;
            --jigui-bg: rgb(255, 245, 230);
            --jigui-surface: #fff9f1;
            --jigui-border: #999;
            --jigui-text: #0f172a;
            --jigui-text-muted: #64748b;
            --jigui-success: #16a34a;
            --jigui-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
        }
        #jigui-float-panel {
            background: var(--jigui-primary) !important;
            border: 1px solid var(--jigui-primary) !important;
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.28) !important;
        }
        #jigui-float-panel[style*="width: 1200px"],
        #jigui-float-panel[style*="width: 100vw"] {
            background: var(--jigui-bg) !important;
            border: 1px solid var(--jigui-border) !important;
            border-top: none !important;
            border-radius: 0 !important;
            box-shadow: var(--jigui-shadow) !important;
        }
        #search-icon-btn {
            font-size: 26px !important;
        }
        #panel-header,
        [id^="jigui-detail-panel-"] .detail-header {
            background: rgb(30, 80, 220) !important;
            color: #fff !important;
            padding: 0 14px !important;
            height: 32px !important;
            min-height: 32px !important;
            border-radius: 0 !important;
        }
        #panel-header > span,
        [id^="jigui-detail-panel-"] .detail-title {
            font-size: 15px !important;
            font-weight: 700 !important;
        }
        [id^="jigui-detail-panel-"] .detail-resize-handle {
            display: block !important;
            width: 16px !important;
            height: 16px !important;
            right: 0 !important;
            bottom: 0 !important;
            cursor: nwse-resize !important;
            background: transparent !important;
            border-right: 2px solid rgba(255, 255, 255, 0.85) !important;
            border-bottom: 2px solid rgba(255, 255, 255, 0.85) !important;
        }
        #panel-header button,
        [id^="jigui-detail-panel-"] .detail-header button,
        #maximized-minimize-btn {
            width: 28px !important;
            height: 28px !important;
            border-radius: 2px !important;
            transition: background-color 0.2s ease !important;
        }
        [id^="jigui-detail-panel-"] .detail-header .detail-todo-btn,
        [id^="jigui-detail-panel-"] .detail-header .detail-take-no-btn,
        [id^="jigui-detail-panel-"] .detail-header .detail-copy-notice-btn {
            width: auto !important;
            height: 28px !important;
            padding: 0 !important;
            margin: 0 26px 0 0 !important;
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            color: #fff !important;
            font-size: 14px !important;
            font-weight: 800 !important;
            line-height: 28px !important;
            white-space: nowrap !important;
        }
        #jigui-tabs {
            background: transparent !important;
            border-bottom: 1px solid var(--jigui-border) !important;
            padding: 0 !important;
            margin: 8px 8px 0 8px !important;
            height: auto !important;
            gap: 0 !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            overflow: visible !important;
        }
        .tab-btn {
            flex: 1 1 0 !important;
            width: auto !important;
            min-width: 78px !important;
            height: 40px !important;
            padding: 0 12px !important;
            border-radius: 0 !important;
            border: none !important;
            border-right: 1px solid var(--jigui-border) !important;
            background: transparent !important;
            color: #3e3a35 !important;
            font-size: 16px !important;
            font-weight: 400 !important;
            position: relative !important;
            top: 0 !important;
            box-shadow: none !important;
        }
        .tab-btn:last-child {
            border-right: none !important;
        }
        .tab-btn.active {
            background: rgb(208, 208, 208) !important;
            color: #222 !important;
            font-weight: 800 !important;
            font-size: 18px !important;
            border-right-color: var(--jigui-border) !important;
            box-shadow: inset 0 -1px 0 var(--jigui-border) !important;
            z-index: 1 !important;
        }
        #jigui-panel-content {
            background: var(--jigui-bg) !important;
            border-right: none !important;
            border-bottom: none !important;
            border-radius: 0 !important;
            display: grid !important;
            grid-template-columns: 254px minmax(0, 1fr) !important;
            min-height: 0 !important;
        }
        #jigui-left-column {
            display: flex !important;
            flex-direction: column !important;
            min-width: 0 !important;
            background: rgb(255, 245, 230) !important;
            border-right: 1px solid var(--jigui-border) !important;
            padding: 0 !important;
            gap: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }
        #jzt-profile-card {
            min-height: 66px !important;
            margin-top: auto !important;
            padding: 8px 10px 8px 26px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            background: rgb(255, 245, 230) !important;
            border-top: 1px solid var(--jigui-border) !important;
            box-sizing: border-box !important;
            flex: 0 0 auto !important;
        }
        #jzt-todo-user {
            color: #111827 !important;
            font-size: 22px !important;
            line-height: 1.1 !important;
            font-weight: 400 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        #jzt-todo-department {
            margin-top: 3px !important;
            color: #374151 !important;
            font-size: 13px !important;
            line-height: 1.2 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        #jzt-todo-settings {
            width: 49px !important;
            height: 49px !important;
            flex: 0 0 49px !important;
            border: none !important;
            background: rgb(255, 245, 230) !important;
            color: #2563eb !important;
            cursor: pointer !important;
            font-size: 26px !important;
            line-height: 49px !important;
            padding: 0 !important;
            text-align: center !important;
        }
        #jzt-search-section {
            flex: 0 0 auto !important;
            min-height: 0 !important;
            padding: 0 0 18px !important;
            background: rgb(255, 245, 230) !important;
            border-bottom: 1px solid var(--jigui-border) !important;
            box-sizing: border-box !important;
        }
        #search-control-panel {
            width: auto !important;
            margin-top: 8px !important;
            padding: 8px 0 0 0 !important;
            background: transparent !important;
            border-right: none !important;
            gap: 8px !important;
            box-sizing: border-box !important;
            min-height: 0 !important;
            flex: 1 1 auto !important;
            position: relative !important;
        }
        #search-options-container {
            padding: 0 20px !important;
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            gap: 12px !important;
            box-shadow: none !important;
        }
        #search-options-container > label {
            min-height: auto !important;
            padding: 0 !important;
            border-radius: 0 !important;
            border: none !important;
            background: transparent !important;
            transition: none !important;
        }
        #search-options-container > label:hover {
            background: transparent !important;
            border-color: transparent !important;
        }
        #search-options-container input[type="radio"] {
            accent-color: var(--jigui-primary) !important;
            width: 18px !important;
            height: 18px !important;
            flex: 0 0 18px !important;
        }
        #search-options-container span {
            font-size: 16px !important;
            font-weight: 500 !important;
            color: #000 !important;
        }
        #search-options-container input[type="radio"]:checked + span {
            color: #000 !important;
            font-weight: 500 !important;
        }
        #search-content {
            display: block !important;
            width: calc(100% - 2px) !important;
            margin: 10px 1px 0 1px !important;
            height: auto !important;
            padding: 10px !important;
            border: 1px solid #ccc !important;
            border-radius: 4px !important;
            background: #fff !important;
            color: var(--jigui-text) !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            font-size: 15px !important;
        }
        #search-content:focus {
            outline: none !important;
            border-color: #ccc !important;
            box-shadow: none !important;
        }
        #search-btn,
        #create-jigui-btn,
        #create-tongzhi-btn {
            display: block !important;
            width: calc(100% - 2px) !important;
            margin: 0 1px !important;
            height: auto !important;
            padding: 12px !important;
            border-radius: 4px !important;
            font-size: 18px !important;
            font-weight: 700 !important;
            box-sizing: border-box !important;
        }
        #search-btn {
            background: #0066cc !important;
            box-shadow: none !important;
            margin-top: 0 !important;
        }
        #search-btn-wrapper {
            padding: 10px 20px 0 !important;
            box-sizing: border-box !important;
        }
        #create-jigui-btn,
        #create-tongzhi-btn {
            background: #28a745 !important;
            box-shadow: none !important;
        }
        #search-result-area {
            padding: 8px 12px 12px 8px !important;
            background: var(--jigui-bg) !important;
            min-width: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
        }
        #maximized-minimize-only {
            position: absolute !important;
            top: 8px !important;
            right: 12px !important;
            transform: none !important;
            z-index: 100100 !important;
        }
        #maximized-minimize-btn {
            position: relative !important;
            z-index: 100101 !important;
        }
        #search-result {
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            color: var(--jigui-text-muted) !important;
            box-shadow: none !important;
            min-width: 0 !important;
            min-height: 0 !important;
        }
        #search-result table {
            width: 100% !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            font-size: 14px !important;
            color: var(--jigui-text) !important;
            border: 1px solid #999 !important;
        }
        #search-result tr {
            transition: background-color 0.18s ease !important;
        }
        #search-result tr:nth-child(even) td {
            background: transparent !important;
        }
        #search-result tr:hover td {
            background: transparent !important;
        }
        #search-result th,
        #search-result td {
            border: 1px solid #999 !important;
            padding: 6px 10px !important;
        }
        #search-result td {
            font-size: 13.5px !important;
            line-height: 1.25 !important;
            padding-top: 7px !important;
            padding-bottom: 7px !important;
        }
        #search-result th {
            background: #d0d0d0 !important;
            color: #000 !important;
            font-weight: 700 !important;
            font-size: 15px !important;
            height: 39px !important;
            line-height: 39px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 1 !important;
        }
        #create-jigui-btn-wrapper,
        #create-tongzhi-btn-wrapper {
            margin-top: 0 !important;
            margin-left: 12px !important;
            margin-right: 12px !important;
            padding: 10px 8px 0 !important;
            position: static !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            border-top: none !important;
        }
        #jzt-update-notice {
            display: none;
            flex: 0 0 auto;
            padding: 0 7px 10px;
            background: rgb(255, 245, 230);
            box-sizing: border-box;
        }
        #jzt-update-button {
            width: 100%;
            min-height: 64px;
            padding: 8px 6px;
            border: 4px solid #ff4d4f;
            border-radius: 0;
            background: rgba(255, 255, 255, 0.45);
            color: #ff4d4f;
            cursor: pointer;
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
            font-size: 0;
            line-height: 1.25;
            text-align: center;
            box-sizing: border-box;
        }
        #jzt-update-button:hover,
        #jzt-update-button:focus-visible {
            background: #fff;
            outline: none;
        }
        #jzt-update-button .jzt-update-prefix {
            font-size: 22px;
            font-weight: 400;
        }
        #jzt-update-button .jzt-update-action {
            margin-left: 2px;
            font-size: 26px;
            font-weight: 700;
        }
        #jzt-todo-panel {
            flex: 1 1 auto !important;
            min-height: 170px !important;
            max-height: none !important;
            margin: 0 !important;
            border: none !important;
            background: rgb(255, 245, 230) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
        }
        #jzt-todo-panel,
        #jzt-todo-panel * {
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif !important;
        }
        #jzt-todo-list {
            padding: 2px 8px 10px !important;
            overflow-y: auto !important;
            min-height: 0 !important;
            flex: 1 1 auto !important;
            background: rgb(255, 245, 230) !important;
        }
        #jzt-todo-list::-webkit-scrollbar-track {
            background: rgb(255, 245, 230) !important;
        }
        #search-result a,
        .jigui-page-link {
            color: #0066cc !important;
            text-decoration: underline !important;
            font-weight: 400 !important;
        }
        .jigui-pagination {
            margin-top: 0 !important;
            padding: 0 !important;
            min-height: 44px !important;
            border-top: 1px solid var(--jigui-border) !important;
            justify-content: flex-end !important;
            gap: 4px !important;
            color: #333 !important;
            font-size: 15px !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
            box-sizing: border-box !important;
            margin-bottom: 0 !important;
            padding-top: 12px !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
        }
        .jigui-pagination .jigui-page-link,
        .jigui-goto-btn {
            display: inline !important;
            min-width: 0 !important;
            height: auto !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
        }
        .jigui-goto-page {
            width: 50px !important;
            height: auto !important;
            border: 1px solid #ccc !important;
            border-radius: 2px !important;
            text-align: center !important;
            padding: 2px 4px !important;
            background: #fff !important;
            color: #222 !important;
        }
        .jigui-goto-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 0 !important;
            height: auto !important;
            padding: 2px 8px !important;
            background: #808080 !important;
            color: #fff !important;
            border: none !important;
            border-radius: 2px !important;
        }
        [id^="jigui-detail-panel-"] {
            background: var(--jigui-surface) !important;
            border: 1px solid var(--jigui-border) !important;
            border-radius: 0 !important;
            box-shadow: var(--jigui-shadow) !important;
            overflow: hidden !important;
        }
        [id^="jigui-detail-panel-"] .detail-content {
            background: #fff !important;
        }
        [id^="jigui-detail-panel-"] .detail-resize-handle {
            border-right: 2px solid rgba(37, 99, 235, 0.35) !important;
            border-bottom: 2px solid rgba(37, 99, 235, 0.35) !important;
        }
    `;
    document.head.appendChild(themeStyle);

    const TODO_API_BASE = 'https://64.90.23.77/api/v2';
    const TODO_API_TOKEN = '1f452c15a2cfcb2fe5dad95e53313b60a8e405a432ea985587552a1b010acae1';
    const TODO_CLIENT_VERSION = '3.6.37';
    const SCRIPT_UPDATE_URL = 'https://gh-proxy.org/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/jzt.user.js';
    const SCRIPT_UPDATE_LAST_CHECK_DATE_KEY = 'jzt-script-update-last-check-date';
    const SCRIPT_UPDATE_AVAILABLE_VERSION_KEY = 'jzt-script-update-available-version';
    const TODO_UPDATE_GUIDE_ORIGIN = 'https://64.90.23.77';
    const TODO_UPDATE_GUIDE_PATH = '/api/v2/r/c539f198f482277d3981f2b40cdf2fa6e64506d5708a0f0e7702e8f98610ed2f';
    const TODO_UPDATE_GUIDE_IMAGE_WIDTH = 1198;
    const TODO_UPDATE_GUIDE_IMAGE_HEIGHT = 531;
    const TODO_ACTIVE_SYNC_INTERVAL = 60000;
    const TODO_ACTIVITY_IDLE_TIMEOUT = 5 * 60000;
    const TODO_TIMER_SYNC_DEDUPE = 30000;
    const TODO_DEVICE_ID_KEY = 'jzt-todo-device-id';
    const TODO_DEVICE_SECRET_KEY = 'jzt-todo-device-secret';
    const TODO_PROFILE_CACHE_KEY = 'jzt-todo-profile-cache';
    const TODO_USER_DIRECTORY_CACHE_KEY = 'jzt-todo-user-directory-cache';
    const TODO_DESKTOP_NOTIFICATION_KEY = 'jzt-todo-desktop-notification-enabled';
    const TODO_SHOW_CREATE_BUTTONS_KEY = 'jzt-show-create-buttons';
    const TODO_DEPARTMENTS = [
        '工厂管理部',
        '人力资源部',
        '财务部',
        '安全环保部',
        '数字技术部',
        '采购部',
        '服务事业部',
        '能源电力事业部',
        '工业环保事业部',
        '调相机事业部',
        '新产业事业部',
        '技术中心-技术管理部',
        '技术中心-系统开发部',
        '技术中心-技术发展部',
        '技术中心-设计部',
        '技术中心-工艺部',
        '制造中心-综合管理室',
        '制造中心-制造部',
        '制造中心-计划物流部',
        '制造中心-临港发电机部',
        '质控部'
    ];

    class TodoManager {
        constructor(searchPanel) {
            this.searchPanel = searchPanel;
            this.systemUser = '';
            this.profile = this.loadCachedProfile();
            this.identityReady = false;
            this.deviceId = '';
            this.deviceSecret = '';
            this.tasks = [];
            this.trackings = [];
            this.pollTimer = null;
            this.workdaySyncTimer = null;
            this.lastActivityAt = 0;
            this.lastTaskSyncAt = 0;
            this.activityHandler = null;
            this.activityDocuments = new WeakSet();
            const directoryCache = this.loadUserDirectoryCache();
            this.userDirectoryCache = directoryCache.users;
            this.userDirectoryCachedAt = directoryCache.cachedAt;
            this.userDirectoryPromise = null;
            this.noticeCopySession = null;
            this.initialized = false;
        }

        loadCachedProfile() {
            try {
                const raw = GM_getValue(TODO_PROFILE_CACHE_KEY, '');
                const cached = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw;
                if (!cached || typeof cached !== 'object') return null;
                if (!String(cached.name || '').trim()) return null;
                if (!String(cached.department || '').trim()) return null;
                return {
                    id: cached.id || '',
                    name: String(cached.name).trim(),
                    department: String(cached.department).trim(),
                    displayName: cached.displayName || '',
                    systemName: cached.systemName || '',
                    receiveTasks: cached.receiveTasks !== false,
                    showCreateButtons: cached.showCreateButtons !== false
                };
            } catch (error) {
                console.warn('[待办] 本地身份缓存读取失败:', error);
                return null;
            }
        }

        cacheProfile(profile) {
            if (!profile || !profile.name || !profile.department) return;
            GM_setValue(TODO_PROFILE_CACHE_KEY, JSON.stringify({
                id: profile.id || '',
                name: profile.name,
                department: profile.department,
                displayName: profile.displayName || '',
                systemName: profile.systemName || '',
                receiveTasks: profile.receiveTasks !== false,
                showCreateButtons: profile.showCreateButtons !== false
            }));
            if (typeof profile.showCreateButtons === 'boolean') {
                GM_setValue(
                    TODO_SHOW_CREATE_BUTTONS_KEY,
                    profile.showCreateButtons
                );
                if (
                    this.searchPanel
                    && typeof this.searchPanel.updateCreateButtonVisibility === 'function'
                ) {
                    this.searchPanel.updateCreateButtonVisibility();
                }
                this.refreshCopyNoticeButtonVisibility();
            }
        }

        isCreateAndCopyFeatureEnabled() {
            return GM_getValue(TODO_SHOW_CREATE_BUTTONS_KEY, true) !== false;
        }

        refreshCopyNoticeButtonVisibility() {
            const detailPanels = this.searchPanel && this.searchPanel.detailPanels;
            if (!detailPanels || typeof detailPanels.values !== 'function') return;
            for (const panel of detailPanels.values()) {
                if (!panel) continue;
                const iframe = panel.querySelector('iframe.detail-content');
                let actualUrl = panel.dataset.todoUrl || '';
                let iframeDoc = null;
                if (iframe) {
                    try {
                        actualUrl = iframe.contentWindow.location.href
                            || iframe.src
                            || actualUrl;
                        iframeDoc = iframe.contentDocument;
                    } catch (error) {
                        actualUrl = iframe.src || actualUrl;
                    }
                }
                this.updateCopyNoticeButton(panel, actualUrl, iframeDoc);
            }
        }

        clearCachedProfile() {
            GM_setValue(TODO_PROFILE_CACHE_KEY, '');
        }

        loadUserDirectoryCache() {
            try {
                const raw = GM_getValue(TODO_USER_DIRECTORY_CACHE_KEY, '');
                const cached = typeof raw === 'string'
                    ? JSON.parse(raw || 'null')
                    : raw;
                if (!cached || !Array.isArray(cached.users)) {
                    return { users: [], cachedAt: 0 };
                }
                return {
                    users: cached.users,
                    cachedAt: Number(cached.cachedAt) || 0
                };
            } catch (error) {
                console.warn('[待办] 本地用户目录缓存读取失败:', error);
                return { users: [], cachedAt: 0 };
            }
        }

        cacheUserDirectory(users) {
            this.userDirectoryCache = Array.isArray(users) ? users : [];
            this.userDirectoryCachedAt = Date.now();
            GM_setValue(TODO_USER_DIRECTORY_CACHE_KEY, JSON.stringify({
                cachedAt: this.userDirectoryCachedAt,
                users: this.userDirectoryCache
            }));
        }

        init() {
            if (this.initialized) return;
            this.initialized = true;
            this.bindActivityDetection();
            this.updateIdentityDisplay();
            if (this.profile && this.profile.receiveTasks === false) {
                this.systemUser = this.readCurrentUser()
                    || this.profile.systemName
                    || this.profile.name;
                this.identityReady = true;
                this.disableTodoServices();
                return;
            }
            this.waitForCurrentUser();
        }

        waitForCurrentUser() {
            let attempts = 0;
            const tryRead = () => {
                attempts += 1;
                const user = this.readCurrentUser();
                if (user) {
                    this.systemUser = user;
                    this.initializeIdentity();
                    return;
                }
                if (attempts < 40) {
                    window.setTimeout(tryRead, 500);
                } else {
                    this.renderState('未识别到“当前用户”，待办功能暂不可用');
                }
            };
            tryRead();
        }

        readCurrentUser() {
            const text = document.body ? (document.body.innerText || document.body.textContent || '') : '';
            const match = text.match(/当前用户\s*[：:]\s*([^\s，,；;|<>]{1,40})/);
            return match ? match[1].trim() : '';
        }

        generateUuid() {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
            return [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20)
            ].join('-');
        }

        generateSecret() {
            const bytes = new Uint8Array(32);
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        }

        initializeIdentity() {
            this.ensureDeviceCredentials();
            this.request('GET', '/identity/me').then((payload) => {
                this.profile = payload.profile;
                this.identityReady = true;
                this.cacheProfile(this.profile);
                this.startIdentityServices();
            }).catch((error) => {
                if (error.status === 401) {
                    this.profile = null;
                    this.identityReady = false;
                    this.clearCachedProfile();
                    this.updateIdentityDisplay();
                    this.renderState('请先完成待办身份设置');
                    this.openIdentityDialog(true);
                    return;
                }
                console.warn('[待办] 身份读取失败:', error.message);
                this.renderState('待办服务器连接失败，稍后请刷新页面重试');
            });
        }

        ensureDeviceCredentials() {
            this.deviceId = this.deviceId || GM_getValue(TODO_DEVICE_ID_KEY, '');
            this.deviceSecret = this.deviceSecret || GM_getValue(TODO_DEVICE_SECRET_KEY, '');
            if (!this.deviceId || !this.deviceSecret) {
                this.deviceId = this.generateUuid();
                this.deviceSecret = this.generateSecret();
                GM_setValue(TODO_DEVICE_ID_KEY, this.deviceId);
                GM_setValue(TODO_DEVICE_SECRET_KEY, this.deviceSecret);
            }
        }

        startIdentityServices() {
            this.updateIdentityDisplay();
            if (!this.profile || this.profile.receiveTasks === false) {
                this.disableTodoServices();
                return;
            }
            this.setTodoPanelEnabled(true);
            this.applyReceiveTaskState(true);
            this.refreshUserDirectoryCache().catch((error) => {
                console.warn('[待办] 用户目录预加载失败，继续使用本地缓存:', error.message);
            });
        }

        applyReceiveTaskState(notifyNew) {
            const enabled = !!(this.profile && this.profile.receiveTasks !== false);
            if (!enabled) {
                this.disableTodoServices();
                return;
            }
            this.setTodoPanelEnabled(true);
            this.stopActivityPolling();
            this.refreshTasks(!!notifyNew, 'startup');
            this.startWorkdaySync();
        }

        bindActivityDetection() {
            if (this.activityHandler) return;
            this.activityHandler = (event) => {
                const target = event && event.target;
                if (!target || typeof target.closest !== 'function') return;
                if (!target.closest(
                    '#jigui-float-panel, [id^="jigui-detail-panel-"]'
                )) return;
                this.recordScriptClick();
            };
            document.addEventListener('click', this.activityHandler, true);
        }

        bindDetailActivity(iframeDoc) {
            if (
                !iframeDoc
                || !iframeDoc.addEventListener
                || this.activityDocuments.has(iframeDoc)
            ) return;
            this.activityDocuments.add(iframeDoc);
            iframeDoc.addEventListener(
                'click',
                () => this.recordScriptClick(),
                true
            );
        }

        recordScriptClick() {
            if (!this.profile || this.profile.receiveTasks === false) return;
            this.lastActivityAt = Date.now();
            if (this.pollTimer) return;

            this.pollTimer = window.setInterval(() => {
                if (
                    !this.profile
                    || this.profile.receiveTasks === false
                    || Date.now() - this.lastActivityAt >= TODO_ACTIVITY_IDLE_TIMEOUT
                ) {
                    this.stopActivityPolling();
                    return;
                }
                this.refreshTasksFromTimer('activity');
            }, TODO_ACTIVE_SYNC_INTERVAL);

            // 空闲停止后的首次点击立即同步；后续点击仅重置空闲计时。
            this.refreshTasks(false, 'activity');
        }

        stopActivityPolling() {
            if (this.pollTimer) {
                window.clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
            this.lastActivityAt = 0;
        }

        refreshTasksFromTimer(reason) {
            if (!this.profile || this.profile.receiveTasks === false) {
                return Promise.resolve();
            }
            if (
                this.lastTaskSyncAt
                && Date.now() - this.lastTaskSyncAt < TODO_TIMER_SYNC_DEDUPE
            ) {
                return Promise.resolve();
            }
            return this.refreshTasks(false, reason || 'scheduled');
        }

        isWorkdaySyncTime(date) {
            const day = date.getDay();
            if (day === 0 || day === 6) return false;
            const minutes = date.getHours() * 60 + date.getMinutes();
            return minutes >= 7 * 60 + 30 && minutes <= 18 * 60;
        }

        getNextWorkdaySyncTime(now) {
            const candidate = new Date(now.getTime());
            candidate.setSeconds(0, 0);
            if (candidate.getMinutes() < 30) {
                candidate.setMinutes(30);
            } else {
                candidate.setMinutes(0);
                candidate.setHours(candidate.getHours() + 1);
            }
            while (!this.isWorkdaySyncTime(candidate)) {
                candidate.setMinutes(candidate.getMinutes() + 30);
            }
            return candidate;
        }

        startWorkdaySync() {
            this.stopWorkdaySync();
            if (!this.profile || this.profile.receiveTasks === false) return;
            const now = new Date();
            const next = this.getNextWorkdaySyncTime(now);
            const delay = Math.max(1000, next.getTime() - now.getTime());
            this.workdaySyncTimer = window.setTimeout(() => {
                this.workdaySyncTimer = null;
                const current = new Date();
                if (this.isWorkdaySyncTime(current)) {
                    this.refreshTasksFromTimer('scheduled');
                }
                this.startWorkdaySync();
            }, delay);
        }

        stopWorkdaySync() {
            if (!this.workdaySyncTimer) return;
            window.clearTimeout(this.workdaySyncTimer);
            this.workdaySyncTimer = null;
        }

        setTodoPanelEnabled(enabled) {
            const panel = this.searchPanel && this.searchPanel.panel
                ? this.searchPanel.panel.querySelector('#jzt-todo-panel')
                : null;
            if (!panel) return;
            panel.style.setProperty(
                'display',
                enabled ? 'flex' : 'none',
                'important'
            );
        }

        disableTodoServices() {
            this.stopActivityPolling();
            this.stopWorkdaySync();
            this.tasks = [];
            this.trackings = [];
            const container = this.searchPanel
                && this.searchPanel._els
                && this.searchPanel._els.todoList;
            if (container) container.innerHTML = '';
            this.setTodoPanelEnabled(false);
            this.updateIdentityDisplay();
        }

        request(method, path, body) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method,
                    url: TODO_API_BASE + path,
                    headers: {
                        'Authorization': 'Bearer ' + TODO_API_TOKEN,
                        'Content-Type': 'application/json',
                        'X-JZT-Device-ID': this.deviceId || '',
                        'X-JZT-Device-Secret': this.deviceSecret || ''
                    },
                    data: body === undefined ? undefined : JSON.stringify(body),
                    timeout: 15000,
                    onload: (response) => {
                        let payload = null;
                        try {
                            payload = JSON.parse(response.responseText || '{}');
                        } catch (e) {
                            reject(new Error('待办服务器返回了无法识别的数据'));
                            return;
                        }
                        if (response.status >= 200 && response.status < 300 && payload.ok !== false) {
                            resolve(payload);
                            return;
                        }
                        const error = new Error(payload.error || ('待办服务器请求失败（' + response.status + '）'));
                        error.status = response.status;
                        error.payload = payload;
                        reject(error);
                    },
                    onerror: () => reject(new Error('无法连接待办服务器')),
                    ontimeout: () => reject(new Error('连接待办服务器超时'))
                });
            });
        }

        refreshTasks(notifyNew, syncReason) {
            if (!this.profile || this.profile.receiveTasks === false) {
                this.disableTodoServices();
                return Promise.resolve();
            }
            this.lastTaskSyncAt = Date.now();
            return this.request('POST', '/sync', {
                clientVersion: TODO_CLIENT_VERSION,
                reason: syncReason || 'action'
            }).then((payload) => {
                if (!this.profile || this.profile.receiveTasks === false) {
                    this.disableTodoServices();
                    return;
                }
                this.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
                this.trackings = Array.isArray(payload.trackings)
                    ? payload.trackings
                    : [];
                this.renderTasks();
                this.notifyNewTasks();
            }).catch((error) => {
                console.warn('[待办] 获取清单失败:', error.message);
                this.renderState('待办清单获取失败，等待下次同步');
            });
        }

        notifyNewTasks() {
            this.tasks.forEach((task) => {
                if (task.isRead) return;
                const storageKey = 'jzt-todo-notified-' + task.id;
                if (localStorage.getItem(storageKey) === '1') return;
                localStorage.setItem(storageKey, '1');
                if (GM_getValue(TODO_DESKTOP_NOTIFICATION_KEY, true) === false) return;
                if (typeof GM_notification !== 'function') return;
                try {
                    const senderDisplay = this.formatTaskSender(task);
                    GM_notification({
                        title: '新的' + task.taskType + '待办',
                        text: task.docNo + '（来自：' + senderDisplay + '）',
                        timeout: 12000,
                        onclick: () => this.openTask(task)
                    });
                } catch (error) {
                    console.warn('[待办] 桌面通知失败:', error);
                }
            });
        }

        getCompletedLabel(task) {
            const labels = {
                '待校核': '已校核',
                '待批准': '已批准',
                '待会签': '已会签'
            };
            return labels[String(task && task.taskType || '').trim()] || '已完成';
        }

        formatTaskSender(task) {
            const senderName = String(task && task.senderName || '').trim();
            const senderDepartment = String(task && task.senderDepartment || '').trim();
            if (task && task.senderHasDuplicateName && senderName && senderDepartment) {
                return senderName + '（' + senderDepartment + '）';
            }
            if (senderName) return senderName;
            return String(task && task.sender || '')
                .replace(/（[^（）]*）\s*$/, '')
                .trim();
        }

        renderState(message) {
            const container = this.searchPanel && this.searchPanel._els
                ? this.searchPanel._els.todoList
                : null;
            if (container) {
                container.innerHTML = '';
                const item = document.createElement('div');
                item.style.cssText = 'padding: 8px 4px; color: #64748b; font-size: 13px; line-height: 1.5;';
                item.textContent = message;
                container.appendChild(item);
            }
        }

        renderTasks() {
            const container = this.searchPanel._els && this.searchPanel._els.todoList;
            if (!container) return;
            this.updateIdentityDisplay();
            container.innerHTML = '';

            if (!this.tasks.length && !this.trackings.length) {
                const empty = document.createElement('div');
                empty.style.cssText = 'padding: 12px 4px; color: #64748b; font-size: 13px; text-align: center;';
                empty.textContent = this.profile && this.profile.receiveTasks === false
                    ? '已关闭待办接收，暂无通知跟踪'
                    : '暂无待办';
                container.appendChild(empty);
                return;
            }

            if (this.tasks.length) {
                container.appendChild(this.createGroupTitle('待办审批'));
                this.tasks.forEach((task, index) => {
                    const taskCard = this.createTaskCard(task);
                    if (this.trackings.length && index === this.tasks.length - 1) {
                        taskCard.style.marginBottom = '0';
                    }
                    container.appendChild(taskCard);
                });
            }
            if (this.trackings.length) {
                container.appendChild(this.createGroupTitle('通知跟踪'));
                this.trackings.forEach((tracking) => {
                    container.appendChild(this.createTrackingCard(tracking));
                });
            }
        }

        createGroupTitle(text) {
            const title = document.createElement('div');
            title.style.cssText = [
                'display:flex',
                'align-items:center',
                'gap:8px',
                'height:28px',
                'padding:2px 2px',
                'color:#111111',
                'font-size:18px',
                'font-weight:700',
                'box-sizing:border-box'
            ].join(';');
            const leftLine = document.createElement('span');
            const label = document.createElement('span');
            const rightLine = document.createElement('span');
            leftLine.style.cssText = 'height:2px;background:#a6a6a6;flex:1 1 auto;';
            rightLine.style.cssText = leftLine.style.cssText;
            label.style.cssText = 'flex:0 0 auto;white-space:nowrap;';
            label.textContent = text;
            title.appendChild(leftLine);
            title.appendChild(label);
            title.appendChild(rightLine);
            return title;
        }

        getTaskTypeColors(taskType) {
            if (taskType === '待会签') {
                return {
                    border: 'rgb(91, 155, 213)',
                    text: '#1f2937',
                    background: 'rgb(189, 215, 238)',
                    badgeBorder: 'rgb(189, 215, 238)'
                };
            }
            if (taskType === '待批准') {
                return {
                    border: 'rgb(112, 173, 71)',
                    text: '#1f2937',
                    background: 'rgb(197, 224, 180)',
                    badgeBorder: 'rgb(197, 224, 180)'
                };
            }
            return {
                border: 'rgb(237, 125, 49)',
                text: '#1f2937',
                background: 'rgb(248, 203, 173)',
                badgeBorder: 'rgb(248, 203, 173)'
            };
        }

        createTaskCard(task) {
            const typeColors = this.getTaskTypeColors(task.taskType);
            const card = document.createElement('div');
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.style.cssText = [
                'display:grid',
                'grid-template-columns:30px minmax(0,1fr) auto',
                'grid-template-rows:auto auto',
                'align-items:center',
                'column-gap:6px',
                'row-gap:2px',
                'width:100%',
                'min-height:68px',
                'padding:5px 4px 5px 0',
                'margin:0 0 5px 0',
                'border:3px solid ' + typeColors.background,
                'background:#ffffff',
                'color:#111111',
                'text-align:left',
                'cursor:pointer',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                'font-size:12px',
                'line-height:1.35',
                'box-sizing:border-box'
            ].join(';');

            const statusStrip = document.createElement('span');
            statusStrip.textContent = Array.from(task.taskType).join('\n');
            statusStrip.style.cssText = [
                'grid-column:1',
                'grid-row:1/3',
                'align-self:stretch',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'min-width:30px',
                'margin:-5px 0 -5px 0',
                'background:' + typeColors.background,
                'color:#111111',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                'font-size:16px',
                'font-weight:700',
                'line-height:1.05',
                'letter-spacing:0',
                'white-space:pre-line',
                'text-align:center'
            ].join(';');

            const textBlock = document.createElement('div');
            textBlock.style.cssText = [
                'grid-column:2',
                'grid-row:1/3',
                'align-self:stretch',
                'display:flex',
                'flex-direction:column',
                'align-items:flex-start',
                'justify-content:center',
                'gap:8px',
                'min-width:0',
                'overflow:hidden',
                'text-align:left'
            ].join(';');

            const docNumber = document.createElement('div');
            docNumber.style.cssText = 'width:100%;min-width:0;overflow:hidden;font-size:15px;font-weight:700;color:#111111;text-align:left;text-overflow:ellipsis;white-space:nowrap;';
            docNumber.textContent = task.docNo;

            const completeButton = document.createElement('button');
            completeButton.type = 'button';
            completeButton.textContent = '完成';
            completeButton.title = '完成此待办并同步到通知发起人的跟踪界面';
            completeButton.style.cssText = [
                'grid-column:3',
                'grid-row:2',
                'align-self:end',
                'justify-self:end',
                'height:22px',
                'padding:0 8px',
                'border:1px solid ' + typeColors.border,
                'border-radius:6px',
                'background:#ffffff',
                'color:#111111',
                'white-space:nowrap',
                'font-size:12px',
                'line-height:20px',
                'font-weight:400',
                'cursor:pointer'
            ].join(';');
            completeButton.addEventListener('click', (event) => {
                this.completeTask(task, event, completeButton);
            });

            const secondLine = document.createElement('div');
            secondLine.style.cssText = 'width:100%;min-width:0;overflow:hidden;color:#333333;font-size:13px;text-align:left;text-overflow:ellipsis;white-space:nowrap;';
            secondLine.textContent = '来自：' + this.formatTaskSender(task)
                + (task.message ? (' · ' + task.message) : '');

            textBlock.appendChild(docNumber);
            textBlock.appendChild(secondLine);
            card.appendChild(statusStrip);
            card.appendChild(textBlock);
            card.appendChild(completeButton);
            card.addEventListener('click', () => this.openTask(task));
            card.addEventListener('keydown', (event) => {
                if (event.target !== card) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.openTask(task);
                }
            });
            return card;
        }

        createTrackingCard(tracking) {
            const allCompleted = Boolean(
                tracking.stages
                && tracking.stages.length
                && tracking.stages.every((stage) => stage.status === 'completed')
            );
            const card = document.createElement('div');
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.style.cssText = [
                'display:grid',
                'grid-template-columns:minmax(0,1fr) auto',
                'align-items:center',
                'column-gap:5px',
                'row-gap:3px',
                'width:100%',
                'min-height:62px',
                'padding:5px 5px 5px 8px',
                'margin:0 0 5px 0',
                'border:1px solid ' + (allCompleted ? 'rgb(112, 173, 71)' : 'rgb(201, 201, 201)'),
                'border-left:7px solid ' + (allCompleted ? 'rgb(112, 173, 71)' : 'rgb(201, 201, 201)'),
                'background:' + (allCompleted ? 'rgba(197, 224, 180, 0.55)' : 'rgb(237, 237, 237)'),
                'color:#111111',
                'cursor:pointer',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                'box-sizing:border-box'
            ].join(';');

            const docNumber = document.createElement('div');
            docNumber.style.cssText = 'min-width:0;overflow:hidden;color:#111111;font-size:15px;font-weight:700;text-align:left;text-overflow:ellipsis;white-space:nowrap;';
            docNumber.textContent = tracking.docNo;

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.textContent = '关闭';
            closeButton.title = '关闭此通知单的跟踪行';
            closeButton.style.cssText = 'height:22px;padding:0 8px;border:1px solid rgb(201, 201, 201);border-radius:6px;background:#fff;color:#111;font-size:12px;line-height:20px;font-weight:400;cursor:pointer;';
            closeButton.addEventListener('click', (event) => {
                this.closeTracking(tracking, event, closeButton);
            });

            const stages = document.createElement('div');
            stages.style.cssText = 'grid-column:1/-1;display:flex;align-items:flex-start;justify-content:space-between;gap:6px;min-width:0;';
            const pendingStages = document.createElement('div');
            pendingStages.style.cssText = 'display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:4px;min-width:0;flex:1 1 auto;';
            const completedStages = document.createElement('div');
            completedStages.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:4px;min-width:0;flex:0 1 auto;margin-left:auto;';
            (tracking.stages || []).forEach((stage) => {
                const completed = stage.status === 'completed';
                const badge = document.createElement('span');
                let label = completed
                    ? this.getCompletedLabel({ taskType: stage.taskType })
                    : stage.taskType;
                if (Number(stage.total) > 1) {
                    label += ' ' + Number(stage.completed || 0) + '/' + Number(stage.total);
                }
                const colors = completed
                    ? { text: '#ffffff', background: 'rgb(112, 173, 71)', border: 'rgb(112, 173, 71)' }
                    : this.getTaskTypeColors(stage.taskType);
                badge.textContent = label;
                badge.style.cssText = [
                    'height:22px',
                    'padding:0 7px',
                    'border-radius:5px',
                    'white-space:nowrap',
                    'font-size:12px',
                    'line-height:20px',
                    'font-weight:700',
                    'color:' + colors.text,
                    'background:' + colors.background,
                    'border:1px solid ' + (colors.badgeBorder || colors.border)
                ].join(';');
                if (completed) {
                    completedStages.appendChild(badge);
                } else {
                    pendingStages.appendChild(badge);
                }
            });
            stages.appendChild(pendingStages);
            stages.appendChild(completedStages);

            card.appendChild(docNumber);
            card.appendChild(closeButton);
            card.appendChild(stages);
            card.addEventListener('click', () => {
                this.searchPanel.openDetailPanel(
                    tracking.url,
                    tracking.docNo,
                    this.getSourceTabFromUrl(tracking.url)
                );
            });
            card.addEventListener('keydown', (event) => {
                if (event.target !== card) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.searchPanel.openDetailPanel(
                        tracking.url,
                        tracking.docNo,
                        this.getSourceTabFromUrl(tracking.url)
                    );
                }
            });
            return card;
        }

        completeTask(task, event, button) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!task || !this.profile || (button && button.disabled)) return;
            if (button) {
                button.disabled = true;
                button.textContent = '处理中';
            }
            this.request('POST', '/tasks/' + encodeURIComponent(task.id) + '/complete', {
                source: 'manual-complete-button'
            }).then(() => {
                this.tasks = this.tasks.filter((item) => item.id !== task.id);
                this.renderTasks();
                return this.refreshTasks(false);
            }).catch((error) => {
                if (button) {
                    button.disabled = false;
                    button.textContent = '完成';
                }
                window.alert('待办完成失败：' + error.message);
            });
        }

        closeTracking(tracking, event, button) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!tracking || !this.profile || (button && button.disabled)) return;
            if (button) {
                button.disabled = true;
                button.textContent = '关闭中';
            }
            this.request(
                'POST',
                '/tracking/' + encodeURIComponent(tracking.id) + '/close',
                {}
            ).then(() => {
                this.trackings = this.trackings.filter((item) => item.id !== tracking.id);
                this.renderTasks();
            }).catch((error) => {
                if (button) {
                    button.disabled = false;
                    button.textContent = '关闭';
                }
                window.alert('关闭通知跟踪失败：' + error.message);
            });
        }

        openTask(task) {
            if (!task || !task.url) return;
            this.markRead(task);
            this.searchPanel.openDetailPanel(
                task.url,
                task.docNo,
                this.getSourceTabFromUrl(task.url)
            );
        }

        getSourceTabFromUrl(url) {
            const value = String(url || '');
            if (/\/jigui\//i.test(value)) return 'jigui';
            if (/\/notice\//i.test(value)) return 'tongzhi';
            if (/\/zzl\//i.test(value)) return 'zhiling';
            return undefined;
        }

        markRead(task) {
            if (!task || task.isRead || !this.profile) return;
            task.isRead = true;
            this.renderTasks();
            this.request('POST', '/tasks/' + encodeURIComponent(task.id) + '/read', {})
                .then(() => this.refreshTasks(false)).catch((error) => {
                console.warn('[待办] 标记已读失败:', error.message);
            });
        }

        refreshUserDirectoryCache() {
            if (!this.profile || this.profile.receiveTasks === false) {
                return Promise.resolve(this.userDirectoryCache.slice());
            }
            if (this.userDirectoryPromise) return this.userDirectoryPromise;
            this.userDirectoryPromise = this.request('GET', '/users')
                .then((payload) => {
                    const users = (Array.isArray(payload.users) ? payload.users : [])
                        .filter((user) => this.isClientVersionAtLeast3(user.clientVersion));
                    this.cacheUserDirectory(users);
                    return users.slice();
                })
                .finally(() => {
                    this.userDirectoryPromise = null;
                });
            return this.userDirectoryPromise;
        }

        getCachedUserDirectory() {
            if (this.userDirectoryPromise) {
                return this.userDirectoryPromise
                    .catch(() => this.userDirectoryCache.slice());
            }
            return Promise.resolve(this.userDirectoryCache.slice());
        }

        isClientVersionAtLeast3(version) {
            const match = String(version || '').trim().match(/^(\d+)(?:\.(\d+))?/);
            return !!match && Number(match[1]) >= 3;
        }

        updateIdentityDisplay() {
            const userLabel = this.searchPanel._els && this.searchPanel._els.todoUser;
            const departmentLabel = this.searchPanel._els && this.searchPanel._els.todoDepartment;
            const settingsButton = this.searchPanel._els && this.searchPanel._els.todoSettings;
            if (userLabel) {
                userLabel.textContent = this.profile ? this.profile.name : '待办身份未设置';
            }
            if (departmentLabel) {
                departmentLabel.textContent = this.profile
                    ? this.profile.department
                    : '请点击右侧设置';
            }
            if (settingsButton) {
                const canOpenSettings = !!(this.profile && this.identityReady);
                settingsButton.disabled = !canOpenSettings;
                settingsButton.style.opacity = canOpenSettings ? '1' : '0.45';
            }
        }

        openIdentityDialog(isFirstSetup) {
            const old = document.getElementById('jzt-identity-dialog-overlay');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'jzt-identity-dialog-overlay';
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'background:rgba(15,23,42,.45)',
                'z-index:310000',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif'
            ].join(';');

            const dialog = document.createElement('div');
            dialog.id = 'jigui-detail-panel-settings-dialog';
            dialog.style.cssText = [
                'width:430px',
                'max-width:calc(100vw - 40px)',
                'max-height:calc(100vh - 40px)',
                'background:#fff',
                'border:1px solid #dbe3ef',
                'border-radius:0',
                'box-shadow:0 16px 40px rgba(15,23,42,.16)',
                'overflow:hidden',
                'box-sizing:border-box',
                'display:flex',
                'flex-direction:column',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                'font-size:15px',
                'color:#334155'
            ].join(';');
            dialog.innerHTML = `
                <div class="detail-header" style="background:rgb(30,80,220);color:white;height:40px;padding:0;border-radius:0;display:flex;justify-content:space-between;align-items:center;min-height:40px;box-sizing:border-box;">
                    <span class="detail-title" style="font-weight:bold;line-height:1;display:flex;align-items:center;padding-left:0;margin-left:-8px;">📄 设置</span>
                    <div style="display:flex;align-items:center;gap:0;height:100%;margin-right:-6px;">
                        ${isFirstSetup ? '' : `
                            <button class="detail-close-btn" type="button" data-action="close" title="关闭" aria-label="关闭" style="width:24px;height:24px;background:none;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;margin:0;transition:background-color .2s;line-height:1;">
                                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="display:block">
                                    <line x1="2.2" y1="2.2" x2="9.8" y2="9.8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                                    <line x1="9.8" y1="2.2" x2="2.2" y2="9.8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                                </svg>
                            </button>
                        `}
                    </div>
                </div>
                <div style="padding:14px 18px 18px;overflow-y:auto;background:#fff9f1;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:15px;color:#334155;">
                    <label style="display:block;margin-bottom:13px;font-size:15px;color:#334155;">
                        姓名
                        <input data-field="name" maxlength="30" autocomplete="off" style="display:block;width:100%;height:42px;box-sizing:border-box;margin-top:6px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:15px;outline:none;">
                    </label>
                    <label style="display:block;margin-bottom:13px;font-size:15px;color:#334155;">
                        部门
                        <select data-field="department" style="display:block;width:100%;height:42px;box-sizing:border-box;margin-top:6px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:15px;">
                            <option value="">请选择部门</option>
                            ${TODO_DEPARTMENTS.map((department) => `<option value="${department}">${department}</option>`).join('')}
                        </select>
                    </label>
                    <label style="display:block;margin-bottom:13px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:4px;color:#334155;cursor:pointer;">
                        <span style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;">
                            <input type="checkbox" data-field="receive-tasks" style="width:17px;height:17px;margin:0;cursor:pointer;">
                            是否需要接收待办
                        </span>
                        <span style="display:block;margin-top:6px;color:#64748b;font-size:12px;line-height:1.5;">
                            勾选后，显示待办审批和通知跟踪，并接收其他人发送的待办；取消勾选后，隐藏相关区域、停止连接待办服务器，同时不再出现在接收人列表中。
                        </span>
                    </label>
                    <label data-field="desktop-notification-label" style="display:block;margin-bottom:13px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:4px;color:#334155;cursor:pointer;">
                        <span style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;">
                            <input type="checkbox" data-field="desktop-notification" style="width:17px;height:17px;margin:0;cursor:pointer;">
                            显示浏览器桌面通知
                        </span>
                        <span style="display:block;margin-top:6px;color:#64748b;font-size:12px;line-height:1.5;">
                            仅影响当前浏览器；关闭后待办仍会显示在左侧清单中。
                        </span>
                    </label>
                    <label style="display:block;margin-bottom:13px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:4px;color:#334155;cursor:pointer;">
                        <span style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;">
                            <input type="checkbox" data-field="show-create-buttons" style="width:17px;height:17px;margin:0;cursor:pointer;">
                            是否显示创建机规/通知单按钮
                        </span>
                        <span style="display:block;margin-top:6px;color:#64748b;font-size:12px;line-height:1.5;">
                            勾选后显示左侧创建按钮，并开启通知单和机规的复制开单功能；取消勾选后隐藏并关闭上述功能，不影响搜索和待办功能。
                        </span>
                    </label>
                    <div data-field="status" style="min-height:20px;margin-bottom:10px;color:#64748b;font-size:13px;"></div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;">
                        ${isFirstSetup ? '' : '<button type="button" data-action="cancel" style="padding:8px 18px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:14px;">取消</button>'}
                        <button type="button" data-action="save" style="padding:8px 18px;border:1px solid #1d4ed8;background:#2563eb;color:#fff;border-radius:4px;cursor:pointer;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:14px;font-weight:700;">保存</button>
                    </div>
                </div>
            `;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const nameInput = dialog.querySelector('[data-field="name"]');
            const departmentInput = dialog.querySelector('[data-field="department"]');
            const receiveTasksInput = dialog.querySelector('[data-field="receive-tasks"]');
            const desktopNotificationInput = dialog.querySelector('[data-field="desktop-notification"]');
            const desktopNotificationLabel = dialog.querySelector('[data-field="desktop-notification-label"]');
            const showCreateButtonsInput = dialog.querySelector('[data-field="show-create-buttons"]');
            const statusElement = dialog.querySelector('[data-field="status"]');
            const saveButton = dialog.querySelector('[data-action="save"]');
            nameInput.value = this.profile ? this.profile.name : (this.systemUser || '');
            departmentInput.value = this.profile ? this.profile.department : '';
            receiveTasksInput.checked = !(
                this.profile && this.profile.receiveTasks === false
            );
            desktopNotificationInput.checked = GM_getValue(
                TODO_DESKTOP_NOTIFICATION_KEY,
                true
            ) !== false;
            showCreateButtonsInput.checked = this.profile
                && typeof this.profile.showCreateButtons === 'boolean'
                ? this.profile.showCreateButtons
                : GM_getValue(TODO_SHOW_CREATE_BUTTONS_KEY, true) !== false;

            const syncDesktopNotificationState = () => {
                const canReceiveTasks = receiveTasksInput.checked;
                desktopNotificationInput.disabled = !canReceiveTasks;
                desktopNotificationLabel.style.opacity = canReceiveTasks ? '1' : '0.5';
                desktopNotificationLabel.style.cursor = canReceiveTasks ? 'pointer' : 'not-allowed';
            };
            receiveTasksInput.addEventListener('change', syncDesktopNotificationState);
            syncDesktopNotificationState();

            const cancelButton = dialog.querySelector('[data-action="cancel"]');
            if (cancelButton) cancelButton.addEventListener('click', () => overlay.remove());
            const closeButton = dialog.querySelector('[data-action="close"]');
            if (closeButton) {
                closeButton.addEventListener('click', () => overlay.remove());
                closeButton.addEventListener('mouseenter', () => {
                    closeButton.style.backgroundColor = 'rgba(255,255,255,.15)';
                });
                closeButton.addEventListener('mouseleave', () => {
                    closeButton.style.backgroundColor = 'transparent';
                });
            }

            const save = () => {
                const name = nameInput.value.trim();
                const department = departmentInput.value.trim();
                const receiveTasks = receiveTasksInput.checked;
                const desktopNotificationEnabled = desktopNotificationInput.checked;
                const showCreateButtons = showCreateButtonsInput.checked;
                if (name.length < 2) {
                    statusElement.textContent = '请输入至少2个字符的姓名。';
                    statusElement.style.color = '#dc2626';
                    nameInput.focus();
                    return;
                }
                if (!department) {
                    statusElement.textContent = '请选择部门。';
                    statusElement.style.color = '#dc2626';
                    departmentInput.focus();
                    return;
                }
                saveButton.disabled = true;
                saveButton.textContent = '保存中...';
                statusElement.textContent = '';
                const path = isFirstSetup ? '/identity/register' : '/identity/profile';
                const body = isFirstSetup
                    ? {
                        name,
                        department,
                        receiveTasks,
                        showCreateButtons,
                        systemName: this.systemUser || name,
                        clientVersion: TODO_CLIENT_VERSION,
                        deviceName: 'Tampermonkey浏览器'
                    }
                    : { name, department, receiveTasks, showCreateButtons };
                this.ensureDeviceCredentials();
                this.request('POST', path, body).then((payload) => {
                    GM_setValue(
                        TODO_DESKTOP_NOTIFICATION_KEY,
                        desktopNotificationEnabled
                    );
                    this.profile = payload.profile;
                    this.identityReady = true;
                    this.cacheProfile(this.profile);
                    overlay.remove();
                    this.startIdentityServices();
                }).catch((error) => {
                    statusElement.textContent = error.message;
                    statusElement.style.color = '#dc2626';
                    saveButton.disabled = false;
                    saveButton.textContent = '保存';
                });
            };
            saveButton.addEventListener('click', save);
            departmentInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') save();
            });
            window.setTimeout(() => {
                if (nameInput.value) departmentInput.focus();
                else nameInput.focus();
            }, 50);
        }

        handleDetailLoaded(panel, iframe, iframeDoc, fallbackUrl) {
            this.bindDetailActivity(iframeDoc);
            let actualUrl = fallbackUrl;
            try {
                actualUrl = iframe.contentWindow.location.href || fallbackUrl;
            } catch (e) {}
            this.updateTakeNoButton(panel, actualUrl);
            this.updateCopyNoticeButton(panel, actualUrl, iframeDoc);
            this.resumeNoticeCopySession(panel, iframeDoc, actualUrl);
            const detailModule = this.getTodoDetailModule(actualUrl);
            const button = panel.querySelector('.detail-todo-btn');
            if (!button) return;
            if (
                !detailModule
                || !this.profile
                || this.profile.receiveTasks === false
            ) {
                button.style.display = 'none';
                button.onclick = null;
                return;
            }

            const docNo = this.extractDocNo(panel, iframeDoc);
            panel.dataset.todoDocNo = docNo;
            panel.dataset.todoUrl = actualUrl;
            panel.dataset.todoModule = detailModule.sourceTab;
            const isOwnDocument = this.isCurrentUserFiller(iframeDoc);
            const canCreateTask = isOwnDocument && Boolean(docNo);
            button.style.display = canCreateTask ? 'inline-flex' : 'none';
            button.onclick = canCreateTask
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.openCreateDialog({
                        docNo,
                        title: docNo,
                        url: actualUrl,
                        iframeDoc,
                        sourceTab: detailModule.sourceTab,
                        documentLabel: detailModule.documentLabel
                    });
                }
                : null;
            this.syncCompletedTasks(docNo, iframeDoc);
        }

        updateTakeNoButton(panel, actualUrl) {
            const takeNoButton = panel.querySelector('.detail-take-no-btn');
            const isNoticeCreatePage =
                /^http:\/\/10\.16\.88\.34\/notice\/createnote\.asp(?:\?|$)/i
                    .test(actualUrl);
            if (takeNoButton) {
                takeNoButton.style.display = isNoticeCreatePage
                    ? 'inline-flex'
                    : 'none';
                takeNoButton.onclick = isNoticeCreatePage
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.open(
                            'https://tomato.shanghai-electric.com/pc/takeNo',
                            '_blank',
                            'noopener,noreferrer'
                        );
                    }
                    : null;
            }
        }

        updateCopyNoticeButton(panel, actualUrl, iframeDoc) {
            const button = panel.querySelector('.detail-copy-notice-btn');
            if (!button) return;
            const detailModule = this.getTodoDetailModule(actualUrl);
            const copyModule = this.isCreateAndCopyFeatureEnabled() && detailModule
                && (
                    detailModule.sourceTab === 'tongzhi'
                    || detailModule.sourceTab === 'jigui'
                )
                ? detailModule.sourceTab
                : '';
            button.style.display = copyModule ? 'inline-flex' : 'none';
            button.onclick = copyModule
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (copyModule === 'jigui') {
                        const template = this.extractJiguiCopyTemplate(
                            panel,
                            iframeDoc,
                            actualUrl
                        );
                        this.startJiguiCopy(template);
                    } else {
                        const template = this.extractNoticeCopyTemplate(
                            panel,
                            iframeDoc,
                            actualUrl
                        );
                        this.startNoticeCopy(template);
                    }
                }
                : null;
        }

        startNoticeCopy(template) {
            if (!this.isCreateAndCopyFeatureEnabled()) return;
            this.noticeCopySession = {
                template,
                copyModule: 'tongzhi',
                options: {
                    copyPart: true,
                    copyOptions: true,
                    copyContent: true
                },
                targetPanelId: '',
                runToken: 0,
                completed: false
            };
            const panelId = this.searchPanel.openDetailPanel(
                'http://10.16.88.34/notice/createnote.asp',
                '创建通知单',
                'tongzhi'
            );
            if (panelId && this.noticeCopySession) {
                this.noticeCopySession.targetPanelId = panelId;
            }
        }

        startJiguiCopy(template) {
            if (!this.isCreateAndCopyFeatureEnabled()) return;
            this.noticeCopySession = {
                template,
                copyModule: 'jigui',
                targetPanelId: '',
                runToken: 0,
                completed: false
            };
            const panelId = this.searchPanel.openDetailPanel(
                'http://10.16.88.34/jigui/createnote.asp',
                '创建机规',
                'jigui'
            );
            if (panelId && this.noticeCopySession) {
                this.noticeCopySession.targetPanelId = panelId;
            }
        }

        normalizeCopyText(value) {
            return String(value || '')
                .replace(/\u00a0/g, ' ')
                .replace(/[：:]/g, '')
                .replace(/\s+/g, '')
                .trim();
        }

        isCopyLabeledCellText(value) {
            const raw = String(value || '').replace(/\u00a0/g, ' ').trim();
            const separator = raw.search(/[：:]/);
            if (separator < 1 || separator > 40) return false;
            const label = this.normalizeCopyText(raw.slice(0, separator));
            const knownLabels = [
                '通知单类型', '通知类型', '通知单类别', '通知类别',
                '类别细分', '分类细分', '原因', '备注',
                '服务订单工号', '服务需求单/流程编号',
                '服务需求单流程编号', '商务免费流程编号',
                '商务免费流程号', '外部NCR编号',
                '与其他通知单是否关联', '其他通知单编号',
                '关联通知单编号', '是否依托产品验证',
                '依托产品验证工号', '产品类型', '产品名称', '工号',
                '部件名称', '部件图号', '部件类属',
                '是否与SAP相关', '是否与发运相关',
                '是否需会签', '是否需要会签', '会签部门',
                '附页', '附件', '是否有新物料号', '有无新物料号',
                '新物料供方信息', '通知内容',
                '是否需要布置物料', '是否需布置物料',
                '是否发生成本变更', '是否有成本变更',
                '是否需要维护工时', '工时信息', '执行信息',
                '原工号', '新工号', '质保书更换信息', '部件钢印',
                '物料信息', '新增物料', '取消物料'
            ].map((item) => this.normalizeCopyText(item));
            return knownLabels.includes(label);
        }

        extractNoticeCopyField(doc, aliases) {
            if (!doc) return '';
            const normalizedAliases = aliases.map((item) =>
                this.normalizeCopyText(item)
            );
            const boundaryLabels = [
                '通知单类别', '通知类别', '类别细分', '分类细分',
                '与其他通知单是否关联', '其他通知单编号',
                '关联通知单编号', '是否依托产品验证',
                '依托产品验证工号', '产品类型', '产品名称',
                '商务免费流程编号', '商务免费流程号',
                '工号', '部件名称', '部件图号', '部件类属',
                '是否与SAP相关', '是否与发运相关', '是否需会签',
                '是否需要会签', '附页', '附件', '是否有新物料号',
                '是否需要布置物料', '是否需布置物料',
                '是否发生成本变更', '是否有成本变更', '通知内容',
                '原工号', '新工号', '质保书更换信息', '部件钢印'
            ].map((item) => this.normalizeCopyText(item));
            const cells = Array.from(doc.querySelectorAll('td, th, label'));
            const matches = [];
            cells.forEach((cell) => {
                const clone = cell.cloneNode(true);
                clone.querySelectorAll(
                    'input,select,textarea,button,script,style,table'
                ).forEach((node) => node.remove());
                const text = (clone.innerText || clone.textContent || '').trim();
                const normalized = this.normalizeCopyText(text);
                const alias = normalizedAliases.find((item) =>
                    normalized.startsWith(item)
                );
                if (alias) matches.push({ cell, normalized, alias, text });
            });
            matches.sort((left, right) =>
                left.normalized.length - right.normalized.length
            );
            for (const match of matches) {
                let remainder = match.normalized.slice(match.alias.length);
                if (remainder) {
                    const boundaryIndex = boundaryLabels
                        .filter((label) => !normalizedAliases.includes(label))
                        .map((label) => remainder.indexOf(label))
                        .filter((index) => index >= 0)
                        .sort((left, right) => left - right)[0];
                    if (Number.isInteger(boundaryIndex)) {
                        if (boundaryIndex === 0) return '';
                        remainder = remainder.slice(0, boundaryIndex);
                    } else {
                        const sourceAlias = aliases[
                            normalizedAliases.indexOf(match.alias)
                        ] || aliases[0];
                        const aliasPattern = sourceAlias
                            .split('')
                            .map((char) =>
                                char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                            )
                            .join('\\s*');
                        const rawRemainder = match.text.replace(
                            new RegExp(
                                '^\\s*' + aliasPattern + '\\s*[：:]?\\s*'
                            ),
                            ''
                        ).trim();
                        if (rawRemainder) return rawRemainder;
                    }
                    if (remainder) return remainder;
                }
                const cell = match.cell;
                const next = cell.nextElementSibling;
                if (next) {
                    const value = this.getElementOwnText(next).trim();
                    if (this.isCopyLabeledCellText(value)) return '';
                    if (value) return value;
                }
            }
            const bodyText = doc.body
                ? String(doc.body.innerText || doc.body.textContent || '')
                : '';
            for (const alias of aliases) {
                const aliasPattern = alias
                    .split('')
                    .map((char) =>
                        char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    )
                    .join('\\s*');
                const fallbackMatch = bodyText.match(
                    new RegExp(
                        aliasPattern
                        + '\\s*[：:]\\s*([^\\t\\r\\n]{1,500})'
                    )
                );
                if (fallbackMatch && fallbackMatch[1].trim()) {
                    return fallbackMatch[1].trim();
                }
            }
            return '';
        }

        extractRightAdjacentCellValue(doc, aliases) {
            if (!doc) return '';
            const wanted = aliases.map((alias) =>
                this.normalizeCopyText(alias)
            );
            const labelCells = Array.from(
                doc.querySelectorAll('td,th')
            ).filter((cell) => {
                if (cell.querySelector('td,th')) return false;
                const normalized = this.normalizeCopyText(
                    this.getElementOwnText(cell)
                ).replace(/^[|｜丨¦\\]+/, '');
                return wanted.includes(normalized);
            });
            labelCells.sort((left, right) =>
                this.getElementOwnText(left).length
                - this.getElementOwnText(right).length
            );
            for (const labelCell of labelCells) {
                const rightCell = labelCell.nextElementSibling;
                if (!rightCell || !rightCell.matches('td,th')) continue;
                const value = String(
                    rightCell.innerText
                    || this.getElementOwnText(rightCell)
                    || ''
                )
                    .replace(/\r\n?/g, '\n')
                    .trim();
                if (value) return value;
            }
            return '';
        }

        extractConditionalRightCellValue(doc, aliases) {
            if (!doc) return '';
            const wanted = aliases.map((alias) =>
                this.normalizeCopyText(alias)
            );
            const candidates = Array.from(
                doc.querySelectorAll('td,th')
            ).filter((cell) => {
                if (cell.querySelector('td,th')) return false;
                const raw = this.getElementOwnText(cell).trim();
                const separator = raw.search(/[：:]/);
                const rawLabel = separator >= 0
                    ? raw.slice(0, separator)
                    : raw;
                return wanted.includes(
                    this.normalizeCopyText(rawLabel)
                );
            });
            candidates.sort((left, right) =>
                this.getElementOwnText(left).length
                - this.getElementOwnText(right).length
            );
            for (const cell of candidates) {
                const raw = this.getElementOwnText(cell).trim();
                const separator = raw.search(/[：:]/);
                const inline = separator >= 0
                    ? raw.slice(separator + 1).trim()
                    : '';
                const inlineDetail = inline
                    .replace(/^(是|否|有|无)\s*/, '')
                    .trim();
                if (inlineDetail) return inlineDetail;

                const rightCell = cell.nextElementSibling;
                if (!rightCell || !rightCell.matches('td,th')) continue;
                const value = String(
                    rightCell.innerText
                    || this.getElementOwnText(rightCell)
                    || ''
                )
                    .replace(/\r\n?/g, '\n')
                    .trim();
                if (
                    value
                    && !this.isCopyLabeledCellText(value)
                    && !/^(是|否|有|无)$/.test(
                        this.normalizeCopyText(value)
                    )
                ) return value;
            }
            return '';
        }

        extractCompleteLabeledCellValue(doc, aliases) {
            if (!doc) return '';
            const cells = Array.from(
                doc.querySelectorAll('td,th,label')
            ).filter((cell) => !cell.querySelector('td,th'));
            for (const alias of aliases) {
                const aliasPattern = alias
                    .split('')
                    .map((char) =>
                        char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    )
                    .join('[\\s\\u00a0\\u3000]*');
                const inlinePattern = new RegExp(
                    '^[\\s\\u00a0\\u3000|｜丨¦\\\\]*'
                    + aliasPattern
                    + '[\\s\\u00a0\\u3000]*[：:]'
                    + '[\\s\\u00a0\\u3000]*([\\s\\S]*)$'
                );
                const inlineCandidates = cells
                    .map((cell) => ({
                        cell,
                        raw: this.getElementOwnText(cell)
                    }))
                    .filter((item) => inlinePattern.test(item.raw))
                    .sort((left, right) =>
                        left.raw.length - right.raw.length
                    );
                for (const candidate of inlineCandidates) {
                    const match = candidate.raw.match(inlinePattern);
                    const value = match ? String(match[1] || '').trim() : '';
                    if (value) return value;
                }
            }
            return this.extractRightAdjacentCellValue(doc, aliases);
        }

        extractStrictLabeledCellValue(doc, aliases) {
            if (!doc) return '';
            const wanted = aliases.map((alias) =>
                this.normalizeCopyText(alias)
            );
            const boundaryLabels = [
                '通知单类别', '通知类别', '类别细分', '分类细分',
                '服务订单工号', '服务需求单/流程编号',
                '商务免费流程编号', '商务免费流程号',
                '外部NCR编号',
                '与其他通知单是否关联', '其他通知单编号',
                '是否依托产品验证', '依托产品验证工号',
                '产品类型', '产品名称', '工号', '部件名称',
                '部件图号', '部件类属', '附页', '附件',
                '是否有新物料号', '有无新物料号',
                '是否与SAP相关', '是否与发运相关',
                '是否需会签', '是否需要会签', '会签部门',
                '通知内容', '是否需要布置物料', '是否需布置物料',
                '原工号', '新工号', '质保书更换信息', '部件钢印',
                '物料信息', '新增物料', '取消物料'
            ].map((label) => this.normalizeCopyText(label));
            const beginsWithAnotherField = (value) => {
                const normalized = this.normalizeCopyText(value)
                    .replace(/^[|｜丨¦\\]+/, '');
                if (!normalized) return false;
                return boundaryLabels.some((label) =>
                    !wanted.includes(label)
                    && (
                        normalized === label
                        || normalized.startsWith(label)
                    )
                );
            };
            const candidates = [];
            Array.from(doc.querySelectorAll('td,th,label')).forEach((cell) => {
                if (cell.querySelector('td,th')) return;
                const raw = this.getElementOwnText(cell).trim();
                if (!raw) return;
                const separator = raw.search(/[：:]/);
                const rawLabel = separator >= 0
                    ? raw.slice(0, separator)
                    : raw;
                const normalizedLabel = this.normalizeCopyText(rawLabel);
                if (!wanted.includes(normalizedLabel)) return;
                candidates.push({
                    cell,
                    raw,
                    separator,
                    normalizedLabel
                });
            });
            candidates.sort((left, right) =>
                left.raw.length - right.raw.length
            );
            for (const candidate of candidates) {
                if (candidate.separator >= 0) {
                    const inlineValue = candidate.raw
                        .slice(candidate.separator + 1)
                        .trim();
                    if (inlineValue) {
                        return beginsWithAnotherField(inlineValue)
                            ? ''
                            : inlineValue;
                    }
                }
                const next = candidate.cell.nextElementSibling;
                if (next) {
                    const nextValue = this.getElementOwnText(next).trim();
                    if (this.isCopyLabeledCellText(nextValue)) return '';
                    if (beginsWithAnotherField(nextValue)) return '';
                    if (nextValue) return nextValue;
                }
            }
            const bodyText = doc.body
                ? String(doc.body.innerText || doc.body.textContent || '')
                : '';
            for (const alias of aliases) {
                const aliasPattern = alias
                    .split('')
                    .map((char) =>
                        char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    )
                    .join('[\\s\\u00a0\\u3000]*');
                const fallbackMatch = bodyText.match(
                    new RegExp(
                        '(^|[^\\u3400-\\u9fffA-Za-z0-9])'
                        + '[ \\u00a0\\u3000]*'
                        + aliasPattern
                        + '[\\s\\u00a0\\u3000]*[：:]'
                        + '[\\s\\u00a0\\u3000]*'
                        + '([A-Za-z0-9][A-Za-z0-9._\\-/,，、]*)'
                    )
                );
                if (fallbackMatch && fallbackMatch[2]) {
                    return fallbackMatch[2].trim();
                }
            }
            return '';
        }

        extractNoticeType(doc) {
            const labeled = this.extractNoticeCopyField(doc, [
                '通知单类型',
                '通知类型'
            ]);
            if (labeled) return labeled.replace(/通知单$/, '').trim();
            if (!doc) return '';
            const candidates = Array.from(
                doc.querySelectorAll('h1,h2,h3,font,b,td')
            );
            for (const element of candidates) {
                const text = (element.innerText || element.textContent || '')
                    .replace(/\s+/g, '')
                    .trim();
                if (
                    text.length >= 4
                    && text.length <= 24
                    && /通知单$/.test(text)
                    && !/通知内容|其他通知单/.test(text)
                ) {
                    return text.replace(/通知单$/, '');
                }
            }
            return '';
        }

        getChoiceSideText(input, direction) {
            if (!input) return '';
            let node = direction === 'previous'
                ? input.previousSibling
                : input.nextSibling;
            let inspected = 0;
            while (node && inspected < 3) {
                inspected += 1;
                if (
                    node.nodeType === Node.ELEMENT_NODE
                    && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/i.test(node.tagName)
                ) break;
                const text = node.nodeType === Node.TEXT_NODE
                    ? node.textContent
                    : node.textContent;
                if (String(text || '').trim()) return String(text).trim();
                node = direction === 'previous'
                    ? node.previousSibling
                    : node.nextSibling;
            }
            return '';
        }

        getChoiceCaptions(doc, input) {
            if (!input) return [];
            const captions = [];
            const add = (value) => {
                const normalized = this.normalizeCopyText(value);
                if (normalized && !captions.includes(normalized)) {
                    captions.push(normalized);
                }
            };
            if (input.id) {
                const label = doc.querySelector(
                    'label[for="' + CSS.escape(input.id) + '"]'
                );
                if (label) add(label.innerText || label.textContent);
            }
            const wrappingLabel = input.closest('label');
            if (wrappingLabel) add(
                    wrappingLabel.innerText
                    || wrappingLabel.textContent
                    || ''
            );
            add(this.getChoiceSideText(input, 'previous'));
            add(this.getChoiceSideText(input, 'next'));
            if (
                input.parentElement
                && input.parentElement.querySelectorAll(
                    'input[type="radio"],input[type="checkbox"]'
                ).length === 1
            ) {
                add(
                    input.parentElement.innerText
                    || input.parentElement.textContent
                    || ''
                );
            }
            const containingCell = input.closest('td,th');
            if (
                containingCell
                && containingCell.querySelectorAll(
                    'input[type="radio"],input[type="checkbox"]'
                ).length === 1
            ) {
                add(this.getElementOwnText(containingCell));
            }
            return captions;
        }

        getCheckboxCaption(doc, input) {
            const captions = this.getChoiceCaptions(doc, input);
            const previous = this.normalizeCopyText(
                this.getChoiceSideText(input, 'previous')
            );
            if (previous && previous.length <= 30) return previous;
            return captions.find((text) => text.length <= 30) || '';
        }

        getRadioChoiceCaption(doc, input) {
            const previous = this.normalizeCopyText(
                this.getChoiceSideText(input, 'previous')
            );
            const previousChoice = previous.match(/(是|否|有|无)$/);
            if (previousChoice) return previousChoice[1];
            const next = this.normalizeCopyText(
                this.getChoiceSideText(input, 'next')
            );
            const nextChoice = next.match(/^(是|否|有|无)/);
            if (nextChoice) return nextChoice[1];
            const captions = this.getChoiceCaptions(doc, input);
            const exact = captions.find((text) => /^(是|否|有|无)$/.test(text));
            return exact || this.normalizeCopyText(input.value);
        }

        getDirectCopyTableRows(table) {
            if (!table || !table.rows) return [];
            return Array.from(table.rows).filter(
                (row) => row.closest('table') === table
            );
        }

        buildCopyTableGrid(table) {
            const rows = this.getDirectCopyTableRows(table);
            const grid = [];
            rows.forEach((row, rowIndex) => {
                if (!grid[rowIndex]) grid[rowIndex] = [];
                let columnIndex = 0;
                Array.from(row.cells || []).forEach((cell) => {
                    while (grid[rowIndex][columnIndex]) columnIndex += 1;
                    const rowSpan = Math.max(
                        1,
                        Number.parseInt(cell.getAttribute('rowspan') || '1', 10)
                    );
                    const columnSpan = Math.max(
                        1,
                        Number.parseInt(cell.getAttribute('colspan') || '1', 10)
                    );
                    for (
                        let rowOffset = 0;
                        rowOffset < rowSpan;
                        rowOffset += 1
                    ) {
                        const targetRow = rowIndex + rowOffset;
                        if (!grid[targetRow]) grid[targetRow] = [];
                        for (
                            let columnOffset = 0;
                            columnOffset < columnSpan;
                            columnOffset += 1
                        ) {
                            grid[targetRow][columnIndex + columnOffset] = cell;
                        }
                    }
                    columnIndex += columnSpan;
                });
            });
            return { table, rows, grid };
        }

        getMaterialColumnKey(text) {
            const normalized = this.normalizeCopyText(text)
                .replace(/[()（）]/g, '');
            if (!normalized) return '';
            if (normalized === '新增物料') return 'addSection';
            if (normalized === '取消物料') return 'cancelSection';
            if (/追加成本/.test(normalized)) return 'addedCost';
            if (/要求完工时间|要求完成时间/.test(normalized)) {
                return 'completionTime';
            }
            if (/工艺路线/.test(normalized)) return 'processRoute';
            if (
                normalized === '新物料'
                || /新物料.*(?:打钩|勾选|选择)/.test(normalized)
            ) return 'isNewMaterial';
            if (/物料描述/.test(normalized)) return 'description';
            if (/物料号/.test(normalized)) return 'materialNo';
            if (/图号/.test(normalized)) return 'drawingNo';
            if (/数量/.test(normalized)) return 'quantity';
            if (/单位/.test(normalized)) return 'unit';
            if (/备注/.test(normalized)) return 'remark';
            if (/层级/.test(normalized)) return 'level';
            if (/单价/.test(normalized)) return 'unitPrice';
            return '';
        }

        getMaterialSectionHint(table, columns) {
            if (columns.addSection != null) return 'add';
            if (columns.cancelSection != null) return 'cancel';
            const enclosingCell = table ? table.closest('td,th') : null;
            let sibling = enclosingCell
                ? enclosingCell.previousElementSibling
                : null;
            for (let distance = 0; sibling && distance < 3; distance += 1) {
                const text = this.normalizeCopyText(
                    this.getElementOwnText(sibling)
                );
                if (text === '新增物料') return 'add';
                if (text === '取消物料') return 'cancel';
                sibling = sibling.previousElementSibling;
            }
            return '';
        }

        findMaterialTableModel(doc, sectionType = 'add') {
            if (!doc) return null;
            const candidates = [];
            Array.from(doc.querySelectorAll('table')).forEach((table) => {
                const model = this.buildCopyTableGrid(table);
                model.grid.forEach((cells, rowIndex) => {
                    const columns = {};
                    const seenCells = new Set();
                    (cells || []).forEach((cell, columnIndex) => {
                        if (!cell || seenCells.has(cell)) return;
                        seenCells.add(cell);
                        const key = this.getMaterialColumnKey(
                            this.getElementOwnText(cell)
                        );
                        if (key && columns[key] == null) {
                            columns[key] = columnIndex;
                        }
                    });
                    const keys = Object.keys(columns);
                    const required = (
                        columns.materialNo != null
                        && columns.description != null
                        && (
                            columns.quantity != null
                            || columns.drawingNo != null
                        )
                    );
                    if (!required) return;
                    candidates.push({
                        ...model,
                        headerRowIndex: rowIndex,
                        columns,
                        sectionType: this.getMaterialSectionHint(
                            table,
                            columns
                        ),
                        score: keys.length
                    });
                });
            });
            candidates.sort((left, right) =>
                right.score - left.score
                || left.table.querySelectorAll('table').length
                    - right.table.querySelectorAll('table').length
            );
            const sectionMatch = candidates.find(
                (candidate) => candidate.sectionType === sectionType
            );
            if (sectionMatch) return sectionMatch;
            if (sectionType === 'cancel') return null;
            return candidates.find(
                (candidate) => candidate.sectionType !== 'cancel'
            ) || null;
        }

        getMaterialCellText(cell) {
            if (!cell) return '';
            const control = cell.querySelector(
                'input:not([type]),input[type="text"],textarea,select'
            );
            if (control) {
                if (control.tagName === 'SELECT') {
                    const option = control.options
                        ? control.options[control.selectedIndex]
                        : null;
                    return String(
                        option ? option.textContent : control.value || ''
                    ).trim();
                }
                return String(control.value || '').trim();
            }
            return this.getElementOwnText(cell).trim();
        }

        extractSourceMaterialRows(doc, sectionType = 'add') {
            const model = this.findMaterialTableModel(doc, sectionType);
            if (!model) return [];
            const materialKeys = [
                'level',
                'materialNo',
                'drawingNo',
                'description',
                'quantity',
                'unit',
                'remark',
                'isNewMaterial',
                'processRoute',
                'completionTime',
                'unitPrice',
                'addedCost'
            ];
            const results = [];
            for (
                let rowIndex = model.headerRowIndex + 1;
                rowIndex < model.rows.length;
                rowIndex += 1
            ) {
                const row = model.rows[rowIndex];
                const rowText = this.normalizeCopyText(
                    this.getElementOwnText(row)
                );
                if (
                    sectionType === 'add'
                    && /取消物料/.test(rowText)
                ) break;
                const item = {};
                materialKeys.forEach((key) => {
                    const columnIndex = model.columns[key];
                    if (columnIndex == null) {
                        item[key] = key === 'isNewMaterial' ? false : '';
                        return;
                    }
                    const cell = model.grid[rowIndex]
                        ? model.grid[rowIndex][columnIndex]
                        : null;
                    if (key === 'isNewMaterial') {
                        const checkbox = cell
                            ? cell.querySelector('input[type="checkbox"]')
                            : null;
                        item[key] = checkbox
                            ? checkbox.checked
                            : (
                                /[√✓✔]/.test(this.getMaterialCellText(cell))
                                || this.getCopyPolarity(
                                    this.getMaterialCellText(cell)
                                ) === 'positive'
                            );
                        return;
                    }
                    item[key] = this.getMaterialCellText(cell);
                });
                const hasContent = [
                    item.level,
                    item.materialNo,
                    item.drawingNo,
                    item.description,
                    item.quantity,
                    item.unit,
                    item.remark,
                    item.processRoute,
                    item.completionTime,
                    item.unitPrice,
                    item.addedCost
                ].some((value) => String(value || '').trim());
                if (hasContent) results.push(item);
            }
            return results;
        }

        findDistributionTableModel(doc) {
            if (!doc) return null;
            const candidates = [];
            Array.from(doc.querySelectorAll('table')).forEach((table) => {
                const model = this.buildCopyTableGrid(table);
                model.grid.forEach((cells, rowIndex) => {
                    const headerByColumn = {};
                    const seenCells = new Set();
                    (cells || []).forEach((cell, columnIndex) => {
                        if (!cell || seenCells.has(cell)) return;
                        seenCells.add(cell);
                        const label = this.normalizeCopyText(
                            this.getElementOwnText(cell)
                        );
                        if (
                            label
                            && label.length <= 30
                            && headerByColumn[columnIndex] == null
                        ) headerByColumn[columnIndex] = label;
                    });
                    const labels = Object.values(headerByColumn);
                    if (
                        !labels.includes('发送部门')
                        || labels.length < 6
                    ) return;
                    candidates.push({
                        ...model,
                        headerRowIndex: rowIndex,
                        headerByColumn,
                        score: labels.length
                    });
                });
            });
            candidates.sort((left, right) =>
                right.score - left.score
                || left.table.querySelectorAll('table').length
                    - right.table.querySelectorAll('table').length
            );
            return candidates[0] || null;
        }

        extractSourceDistributionDepartments(doc) {
            const model = this.findDistributionTableModel(doc);
            if (!model) return [];
            const selected = [];
            for (
                let rowIndex = model.headerRowIndex + 1;
                rowIndex < Math.min(
                    model.rows.length,
                    model.headerRowIndex + 5
                );
                rowIndex += 1
            ) {
                const cells = model.grid[rowIndex] || [];
                Object.entries(model.headerByColumn).forEach(
                    ([columnText, label]) => {
                        if (label === '发送部门') return;
                        const columnIndex = Number(columnText);
                        const cell = cells[columnIndex];
                        if (!cell) return;
                        const checkbox = cell.querySelector(
                            'input[type="checkbox"]'
                        );
                        const text = this.getElementOwnText(cell);
                        if (
                            (checkbox && checkbox.checked)
                            || /[●•∙·]/.test(text)
                        ) {
                            if (!selected.includes(label)) selected.push(label);
                        }
                    }
                );
                if (selected.length) break;
            }
            return selected;
        }

        extractNoticeCopyTemplate(panel, iframeDoc, actualUrl) {
            const read = (aliases) =>
                this.extractNoticeCopyField(iframeDoc, aliases);
            const warrantyReplacement = read([
                '质保书更换信息',
                '是否更换质保书'
            ]);
            const partSteelSeal = read([
                '部件钢印',
                '是否更换部件钢印'
            ]);
            const checkboxLabels = Array.from(
                iframeDoc.querySelectorAll('input[type="checkbox"]:checked')
            )
                .map((input) => this.getCheckboxCaption(iframeDoc, input))
                .map((text) => this.normalizeCopyText(text))
                .filter((text) => text && text.length <= 30);
            return {
                sourceDocNo: this.extractDocNo(panel, iframeDoc),
                sourceUrl: actualUrl,
                noticeType: this.extractNoticeType(iframeDoc),
                fields: {
                    noticeCategory: read(['通知单类别', '通知类别']),
                    categoryDetail: read(['类别细分', '分类细分']),
                    serviceOrderJobNo:
                        this.extractStrictLabeledCellValue(
                            iframeDoc,
                            ['服务订单工号']
                        ),
                    serviceRequestNo:
                        this.extractStrictLabeledCellValue(
                            iframeDoc,
                            [
                                '服务需求单/流程编号',
                                '服务需求单流程编号'
                            ]
                        ),
                    businessFreeProcessNo:
                        this.extractStrictLabeledCellValue(
                            iframeDoc,
                            [
                                '商务免费流程编号',
                                '商务免费流程号'
                            ]
                        ),
                    externalNcrNo:
                        this.extractStrictLabeledCellValue(
                            iframeDoc,
                            ['外部NCR编号']
                        ),
                    productType: this.extractStrictLabeledCellValue(
                        iframeDoc,
                        ['产品类型']
                    ),
                    productName: read(['产品名称']),
                    workNo: this.extractStrictLabeledCellValue(
                        iframeDoc,
                        ['工号']
                    ),
                    partClass: read(['部件类属']),
                    dependentProduct: read(['是否依托产品验证']),
                    dependentProductJobNo: read(['依托产品验证工号']),
                    relatedNotice: read([
                        '其他通知单编号',
                        '关联通知单编号',
                        '与其他通知单编号'
                    ]),
                    partName: read(['部件名称']),
                    partDrawingNo: this.extractStrictLabeledCellValue(
                        iframeDoc,
                        ['部件图号']
                    ),
                    related: read(['与其他通知单是否关联']),
                    sapRelated: read(['是否与SAP相关', '与SAP相关']),
                    shippingRelated: read(['是否与发运相关', '与发运相关']),
                    needCountersign: read(['是否需会签', '是否需要会签']),
                    attachment: read(['附页', '附件']),
                    hasNewMaterial: read(['是否有新物料号', '有无新物料号']),
                    needMaterial: read([
                        '是否需要布置物料',
                        '是否需布置物料'
                    ]),
                    costChange: read([
                        '是否发生成本变更',
                        '是否有成本变更'
                    ]),
                    originalWorkNo:
                        this.extractStrictLabeledCellValue(
                            iframeDoc,
                            ['原工号']
                        ),
                    newWorkNo:
                        this.extractStrictLabeledCellValue(
                            iframeDoc,
                            ['新工号']
                        ),
                    warrantyReplacement,
                    warrantyReplacementDetail:
                        this.getCopyPolarity(warrantyReplacement)
                            === 'positive'
                            ? this.extractConditionalRightCellValue(
                                iframeDoc,
                                ['质保书更换信息', '是否更换质保书']
                            )
                            : '',
                    partSteelSeal,
                    partSteelSealDetail:
                        this.getCopyPolarity(partSteelSeal) === 'positive'
                            ? this.extractConditionalRightCellValue(
                                iframeDoc,
                                ['部件钢印', '是否更换部件钢印']
                            )
                            : '',
                    noticeContent: this.extractRightAdjacentCellValue(
                        iframeDoc,
                        ['通知内容']
                    )
                },
                checkboxLabels: Array.from(new Set(checkboxLabels)),
                countersignDepartments: this.extractSourceCheckboxGroup(
                    iframeDoc,
                    ['会签部门']
                ),
                materialRows: this.extractSourceMaterialRows(
                    iframeDoc,
                    'add'
                ),
                cancelMaterialRows: this.extractSourceMaterialRows(
                    iframeDoc,
                    'cancel'
                ),
                distributionDepartments:
                    this.extractSourceDistributionDepartments(iframeDoc),
                genericFields: this.collectSourceCopyFields(iframeDoc)
            };
        }

        getJiguiRelationColumnKey(value) {
            const normalized = this.normalizeCopyText(value);
            if (normalized === '名称') return 'name';
            if (normalized === '图号') return 'drawingNo';
            if (normalized === '数量') return 'quantity';
            return '';
        }

        findJiguiRelationTableModel(doc, requireEditable = false) {
            if (!doc) return null;
            const candidates = [];
            Array.from(doc.querySelectorAll('table')).forEach((table) => {
                const model = this.buildCopyTableGrid(table);
                model.grid.forEach((cells, rowIndex) => {
                    const columns = {};
                    const seenCells = new Set();
                    (cells || []).forEach((cell, columnIndex) => {
                        if (!cell || seenCells.has(cell)) return;
                        seenCells.add(cell);
                        const key = this.getJiguiRelationColumnKey(
                            this.getElementOwnText(cell)
                        );
                        if (key && columns[key] == null) {
                            columns[key] = columnIndex;
                        }
                    });
                    if (
                        columns.name == null
                        || columns.drawingNo == null
                        || columns.quantity == null
                    ) return;
                    const editableCount = table.querySelectorAll(
                        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]),textarea,select'
                    ).length;
                    if (requireEditable && !editableCount) return;
                    const context = this.normalizeCopyText(
                        this.getElementOwnText(
                            table.closest('tr') || table
                        )
                    );
                    candidates.push({
                        ...model,
                        headerRowIndex: rowIndex,
                        columns,
                        score: (context.includes('制造令') ? 20 : 0)
                            + (editableCount ? 5 : 0)
                    });
                });
            });
            candidates.sort((left, right) =>
                right.score - left.score
                || left.table.querySelectorAll('table').length
                    - right.table.querySelectorAll('table').length
            );
            return candidates[0] || null;
        }

        extractSourceJiguiRelationRows(doc) {
            const model = this.findJiguiRelationTableModel(doc, false);
            if (!model) return [];
            const rows = [];
            for (
                let rowIndex = model.headerRowIndex + 1;
                rowIndex < model.rows.length;
                rowIndex += 1
            ) {
                const cells = model.grid[rowIndex] || [];
                const item = {
                    name: this.getMaterialCellText(
                        cells[model.columns.name]
                    ),
                    drawingNo: this.getMaterialCellText(
                        cells[model.columns.drawingNo]
                    ),
                    quantity: this.getMaterialCellText(
                        cells[model.columns.quantity]
                    )
                };
                if (
                    item.name
                    || item.drawingNo
                    || item.quantity
                ) rows.push(item);
            }
            return rows;
        }

        extractJiguiCopyTemplate(panel, iframeDoc, actualUrl) {
            const read = (aliases) =>
                this.extractNoticeCopyField(iframeDoc, aliases);
            return {
                sourceDocNo: this.extractDocNo(panel, iframeDoc),
                sourceUrl: actualUrl,
                fields: {
                    workNo: this.extractStrictLabeledCellValue(
                        iframeDoc,
                        ['工号']
                    ),
                    productName: read(['产品名称']),
                    partName: read(['部件名称']),
                    partDrawingNo: this.extractCompleteLabeledCellValue(
                        iframeDoc,
                        ['部件图号']
                    ),
                    partClass: read(['部件类属']),
                    sapRelated: read([
                        '是否与SAP相关',
                        '是否与SAP相关：'
                    ]),
                    hasNewMaterial: read([
                        '是否有新物料号',
                        '有无新物料号'
                    ]),
                    reason: this.extractRightAdjacentCellValue(
                        iframeDoc,
                        ['原因']
                    ),
                    noticeContent: this.extractRightAdjacentCellValue(
                        iframeDoc,
                        ['通知内容']
                    )
                },
                relationRows: this.extractSourceJiguiRelationRows(
                    iframeDoc
                ),
                distributionDepartments:
                    this.extractSourceDistributionDepartments(iframeDoc)
            };
        }

        collectSourceCopyFields(doc) {
            if (!doc) return [];
            const excluded = /^(编号|编\s*号|日期|日\s*期|填单人|创建人|创建日期|校核|批准|分发|状态|工号)$/;
            const results = new Map();
            Array.from(doc.querySelectorAll('td,th')).forEach((cell) => {
                if (cell.querySelector('td,th')) return;
                const raw = this.getElementOwnText(cell).trim();
                if (!raw || raw.length > 6000) return;
                let label = '';
                let value = '';
                const separator = raw.search(/[：:]/);
                if (separator >= 0) {
                    label = raw.slice(0, separator)
                        .trim()
                        .replace(/^[|｜丨¦]+/, '')
                        .replace(/[|｜丨¦]+$/, '')
                        .trim();
                    value = raw.slice(separator + 1).trim();
                } else return;
                if (this.isCopyLabeledCellText(value)) value = '';
                const normalizedLabel = this.normalizeCopyText(label);
                const crossedPartDrawingBoundary = (candidateValue) =>
                    normalizedLabel === this.normalizeCopyText('部件图号')
                    && /^(附页|附件)/.test(
                        this.normalizeCopyText(candidateValue)
                            .replace(/^[|｜丨¦\\]+/, '')
                    );
                if (crossedPartDrawingBoundary(value)) value = '';
                if (
                    !normalizedLabel
                    || normalizedLabel.length < 2
                    || normalizedLabel.length > 18
                    || excluded.test(normalizedLabel)
                ) return;
                if (!value && cell.nextElementSibling) {
                    const nextValue = this.getElementOwnText(
                        cell.nextElementSibling
                    ).trim();
                    value = (
                        this.isCopyLabeledCellText(nextValue)
                        || crossedPartDrawingBoundary(nextValue)
                    )
                        ? ''
                        : nextValue;
                }
                if (!value || value.length > 6000) return;
                if (!results.has(normalizedLabel)) {
                    results.set(normalizedLabel, {
                        key: 'generic:' + normalizedLabel,
                        label: label.replace(/[：:]$/, '').trim(),
                        aliases: [label.replace(/[：:]$/, '').trim()],
                        value,
                        preferredType: 'auto',
                        optional: true
                    });
                }
            });
            return Array.from(results.values());
        }

        extractSourceCheckboxGroup(doc, aliases) {
            const results = [];
            const addChecked = (root) => {
                if (!root) return;
                Array.from(
                    root.querySelectorAll('input[type="checkbox"]:checked')
                ).forEach((input) => {
                    const caption = this.getCheckboxCaption(doc, input);
                    const normalized = this.normalizeCopyText(caption);
                    if (
                        normalized
                        && normalized.length <= 30
                        && !results.includes(normalized)
                    ) results.push(normalized);
                });
            };
            this.findCopyFieldContainers(doc, aliases).forEach((container) => {
                addChecked(container);
                addChecked(container.closest('tr'));
                const cell = container.closest('td,th');
                if (cell) addChecked(cell.parentElement);
            });
            return results;
        }

        showNoticeCopyStatus(panel, text, type) {
            let status = panel.querySelector('.notice-copy-progress');
            if (!status) {
                status = document.createElement('div');
                status.className = 'notice-copy-progress';
                status.style.cssText = [
                    'position:absolute',
                    'top:46px',
                    'right:28px',
                    'z-index:2147483646',
                    'width:auto',
                    'max-width:calc(100% - 56px)',
                    'box-sizing:border-box',
                    'padding:8px 12px',
                    'border:1px solid #93c5fd',
                    'border-radius:4px',
                    'background:#eff6ff',
                    'color:#1d4ed8',
                    'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                    'font-size:15px',
                    'line-height:22px',
                    'white-space:nowrap',
                    'pointer-events:none',
                    'box-shadow:0 4px 12px rgba(15,23,42,.14)'
                ].join(';');
                panel.appendChild(status);
            }
            // 每次更新提示均生成新代次；旧提示遗留的回调不得影响当前提示。
            const statusGeneration =
                (Number(status._jztStatusGeneration) || 0) + 1;
            status._jztStatusGeneration = statusGeneration;
            if (status._jztFadeTimer) {
                window.clearTimeout(status._jztFadeTimer);
                status._jztFadeTimer = null;
            }
            if (status._jztRemoveTimer) {
                window.clearTimeout(status._jztRemoveTimer);
                status._jztRemoveTimer = null;
            }
            status.style.setProperty('display', 'block', 'important');
            status.style.setProperty('visibility', 'visible', 'important');
            status.style.setProperty('z-index', '2147483646', 'important');
            status.style.setProperty('transition', 'none', 'important');
            status.style.setProperty('opacity', '1', 'important');
            const palette = type === 'success'
                ? {
                    border: '#86efac',
                    background: '#f0fdf4',
                    color: '#15803d'
                }
                : type === 'warning'
                    ? {
                        border: '#fdba74',
                        background: '#fff7ed',
                        color: '#b45309'
                    }
                    : {
                        border: '#93c5fd',
                        background: '#eff6ff',
                        color: '#1d4ed8'
                    };
            status.style.borderColor = palette.border;
            status.style.background = palette.background;
            status.style.color = palette.color;
            status.textContent = String(text || '');
            // “内容填写中”等进行状态持续显示，等待后续成功或警告提示覆盖。
            if (type === 'progress') {
                status.dataset.jztStatusType = 'progress';
                return;
            }
            status.dataset.jztStatusType = String(type || '');
            // 成功和警告提示完整显示2秒，再淡出并移除。
            status.offsetWidth;
            status.style.setProperty(
                'transition',
                'opacity 300ms ease',
                'important'
            );
            status._jztFadeTimer = window.setTimeout(() => {
                if (
                    !status.isConnected
                    || status._jztStatusGeneration !== statusGeneration
                    || status.dataset.jztStatusType === 'progress'
                ) return;
                status._jztFadeTimer = null;
                status.style.setProperty('opacity', '0', 'important');
                status._jztRemoveTimer = window.setTimeout(() => {
                    if (
                        status._jztStatusGeneration !== statusGeneration
                        || status.dataset.jztStatusType === 'progress'
                    ) return;
                    status._jztRemoveTimer = null;
                    if (status.isConnected) status.remove();
                }, 300);
            }, 2000);
        }

        isNoticeCreateUrl(url) {
            return /^http:\/\/10\.16\.88\.34\/notice\/createnote\.asp(?:\?|$)/i
                .test(String(url || ''));
        }

        isJiguiCreateUrl(url) {
            return /^http:\/\/10\.16\.88\.34\/jigui\/createnote\.asp(?:\?|$)/i
                .test(String(url || ''));
        }

        getElementOwnText(element) {
            if (!element) return '';
            const clone = element.cloneNode(true);
            clone.querySelectorAll(
                'input,select,textarea,button,option,script,style'
            ).forEach((node) => node.remove());
            return (clone.innerText || clone.textContent || '').trim();
        }

        findCopyFieldContainers(doc, aliases) {
            if (!doc) return [];
            const normalizedAliases = aliases.map((alias) =>
                this.normalizeCopyText(alias)
            );
            const elements = Array.from(
                doc.querySelectorAll('td,th,label,div,span')
            );
            return elements.map((element) => {
                const text = this.normalizeCopyText(
                    this.getElementOwnText(element)
                );
                const matched = text && text.length <= 40
                    && normalizedAliases.some((alias) =>
                    text === alias || text.startsWith(alias)
                );
                return { element, text, matched };
            })
                .filter((item) => item.matched)
                .sort((left, right) => left.text.length - right.text.length)
                .map((item) => item.element);
        }

        findCopyControls(doc, aliases, selector) {
            const results = [];
            const add = (nodes) => {
                Array.from(nodes || []).forEach((node) => {
                    if (!results.includes(node)) results.push(node);
                });
            };
            this.findCopyFieldContainers(doc, aliases).forEach((container) => {
                if (container.matches && container.matches(selector)) {
                    add([container]);
                }
                add(container.querySelectorAll(selector));
                const containingCell = container.closest('td,th');
                if (containingCell && containingCell !== container) {
                    add(containingCell.querySelectorAll(selector));
                }
                let sibling = container.nextElementSibling;
                for (let index = 0; sibling && index < 2; index += 1) {
                    if (sibling.matches && sibling.matches(selector)) {
                        add([sibling]);
                    }
                    add(sibling.querySelectorAll(selector));
                    sibling = sibling.nextElementSibling;
                }
            });
            return results.filter((control) => !control.disabled);
        }

        waitForCopyCondition(test, timeoutMs = 3500) {
            return new Promise((resolve) => {
                const startedAt = Date.now();
                const check = () => {
                    let value = null;
                    try {
                        value = test();
                    } catch (e) {}
                    if (value) {
                        resolve(value);
                        return;
                    }
                    if (Date.now() - startedAt >= timeoutMs) {
                        resolve(null);
                        return;
                    }
                    window.setTimeout(check, 50);
                };
                check();
            });
        }

        dispatchCopyChange(control, useClick) {
            if (!control) return;
            if (useClick && typeof control.click === 'function') {
                control.click();
                return;
            }
            const view = control.ownerDocument.defaultView || window;
            const EventConstructor = view.Event || Event;
            control.dispatchEvent(new EventConstructor('input', { bubbles: true }));
            control.dispatchEvent(new EventConstructor('change', { bubbles: true }));
            control.dispatchEvent(new EventConstructor('blur', { bubbles: true }));
        }

        setCopyTextControl(control, value) {
            if (control == null || value == null) return false;
            if (String(control.value || '') === String(value)) return true;
            const view = control.ownerDocument.defaultView || window;
            const prototype = control.tagName === 'TEXTAREA'
                ? view.HTMLTextAreaElement.prototype
                : view.HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(
                prototype,
                'value'
            );
            if (descriptor && descriptor.set) {
                descriptor.set.call(control, value);
            } else {
                control.value = value;
            }
            this.dispatchCopyChange(control, false);
            return true;
        }

        findMatchingSelectOption(select, desired) {
            const normalizedDesired = this.normalizeCopyText(desired)
                .replace(/通知单$/, '');
            if (!normalizedDesired) return null;
            return Array.from(select.options || []).find((option) => {
                const text = this.normalizeCopyText(option.textContent)
                    .replace(/通知单$/, '');
                const value = this.normalizeCopyText(option.value);
                return (
                    text === normalizedDesired
                    || value === normalizedDesired
                );
            }) || null;
        }

        async applyCopySelect(doc, aliases, desired, isNoticeType) {
            if (!desired) return { status: 'skipped' };
            const match = await this.waitForCopyCondition(() => {
                const selects = isNoticeType
                    ? Array.from(doc.querySelectorAll('select'))
                    : this.findCopyControls(doc, aliases, 'select');
                for (const select of selects) {
                    const option = this.findMatchingSelectOption(select, desired);
                    if (option) return { select, option };
                }
                return null;
            });
            if (!match) return { status: 'failed', label: aliases[0] };
            if (match.select.value !== match.option.value) {
                match.select.value = match.option.value;
                this.dispatchCopyChange(match.select, false);
            }
            return { status: 'applied' };
        }

        async applyCopySelectOrText(doc, aliases, desired) {
            if (!desired) return { status: 'skipped' };
            const match = await this.waitForCopyCondition(() => {
                const selects = this.findCopyControls(doc, aliases, 'select');
                if (selects.length) {
                    for (const select of selects) {
                        const option = this.findMatchingSelectOption(
                            select,
                            desired
                        );
                        if (option) return { type: 'select', select, option };
                    }
                    return null;
                }
                const textControls = this.findCopyControls(
                    doc,
                    aliases,
                    'input:not([type]),input[type="text"],textarea'
                );
                return textControls[0]
                    ? { type: 'text', control: textControls[0] }
                    : null;
            }, 5000);
            if (!match) return { status: 'failed', label: aliases[0] };
            if (match.type === 'select') {
                if (match.select.value !== match.option.value) {
                    match.select.value = match.option.value;
                    this.dispatchCopyChange(match.select, false);
                }
            } else {
                this.setCopyTextControl(match.control, desired);
            }
            return { status: 'applied' };
        }

        async applyCopyText(doc, aliases, value, selector) {
            if (!value) return { status: 'skipped' };
            const control = await this.waitForCopyCondition(() => {
                const controls = this.findCopyControls(
                    doc,
                    aliases,
                    selector || 'input:not([type]),input[type="text"],textarea'
                );
                return controls[0] || null;
            }, 2500);
            if (!control) return { status: 'failed', label: aliases[0] };
            this.setCopyTextControl(control, value);
            return { status: 'applied' };
        }

        getRadioCaption(doc, input) {
            const text = this.getRadioChoiceCaption(doc, input);
            if (text) return this.normalizeCopyText(text);
            return this.normalizeCopyText(input.value);
        }

        async applyCopyRadio(doc, aliases, desired) {
            const normalizedDesired = this.normalizeCopyText(desired);
            if (!normalizedDesired) return { status: 'skipped' };
            const wanted = /(^|是否|相关|需要|有)是|^有$/.test(normalizedDesired)
                ? '是'
                : /否|无/.test(normalizedDesired)
                    ? '否'
                    : normalizedDesired;
            const radio = await this.waitForCopyCondition(() => {
                const radios = this.findCopyControls(
                    doc,
                    aliases,
                    'input[type="radio"]'
                );
                if (radios.length >= 2 && wanted === '是') return radios[0];
                if (radios.length >= 2 && wanted === '否') return radios[1];
                return radios.find((input) => {
                    const caption = this.getRadioCaption(doc, input);
                    const value = this.normalizeCopyText(input.value);
                    if (wanted === '是') {
                        return /^(是|有)$/i.test(caption)
                            || /^(1|yes|true)$/i.test(value);
                    }
                    if (wanted === '否') {
                        return /^(否|无)$/i.test(caption)
                            || /^(0|no|false)$/i.test(value);
                    }
                    return caption.includes(wanted) || value === wanted;
                }) || null;
            }, 2500);
            if (!radio) return { status: 'failed', label: aliases[0] };
            if (!radio.checked) this.dispatchCopyChange(radio, true);
            return { status: 'applied' };
        }

        async applyCopyCheckboxes(doc, labels) {
            if (!labels || !labels.length) return { applied: 0, failed: [] };
            const failed = [];
            let applied = 0;
            for (const label of labels) {
                const normalized = this.normalizeCopyText(label);
                const checkbox = await this.waitForCopyCondition(() =>
                    Array.from(doc.querySelectorAll('input[type="checkbox"]'))
                        .filter((input) => !input.disabled)
                        .find((input) => {
                            const captions = this.getChoiceCaptions(doc, input);
                            return captions.some((caption) => (
                                caption === normalized
                                || (
                                    caption.length <= 30
                                    && normalized.length <= 30
                                    && (
                                        caption.endsWith(normalized)
                                        || normalized.endsWith(caption)
                                    )
                                )
                            ));
                        }) || null
                , 2500);
                if (!checkbox) {
                    failed.push(label);
                    continue;
                }
                if (!checkbox.checked) this.dispatchCopyChange(checkbox, true);
                applied += 1;
            }
            return { applied, failed };
        }

        isCopyRunCurrent(session, runToken) {
            return (
                this.noticeCopySession === session
                && session.runToken === runToken
                && !session.completed
            );
        }

        resumeNoticeCopySession(panel, iframeDoc, actualUrl) {
            const session = this.noticeCopySession;
            const isExpectedCreatePage = session
                && session.copyModule === 'jigui'
                ? this.isJiguiCreateUrl(actualUrl)
                : this.isNoticeCreateUrl(actualUrl);
            if (
                !session
                || session.completed
                || !isExpectedCreatePage
            ) return;
            if (
                session.targetPanelId
                && session.targetPanelId !== panel.dataset.panelId
            ) return;
            session.targetPanelId = panel.dataset.panelId;
            const runToken = ++session.runToken;
            this.showNoticeCopyStatus(
                panel,
                '内容填写中，请稍等...',
                'progress'
            );
            this.applyNoticeCopyTemplate(
                panel,
                iframeDoc,
                session,
                runToken
            ).catch((error) => {
                if (!this.isCopyRunCurrent(session, runToken)) return;
                this.showNoticeCopyStatus(
                    panel,
                    '复制中断：' + error.message,
                    'warning'
                );
            });
        }

        getPartClassValues(value) {
            // 原详情页使用“集电环装置/励磁机”，创建页复选框名称为
            // “励磁机/集电环装置”。在通知单和机规共用入口统一转换。
            const raw = String(value || '')
                .replace(
                    /集电环装置\s*[\/／、]\s*励磁机/g,
                    '励磁机/集电环装置'
                )
                .trim();
            if (!raw) return [];
            const knownOptions = [
                '励磁机/集电环装置',
                '工艺消耗性材料',
                '工艺装备明细表',
                '冷却器系统',
                '主机配套件',
                '主机进口件',
                '在线监测',
                '装箱系统',
                '励磁系统',
                '油系统',
                '水系统',
                '氢系统',
                '主机'
            ].map((label) => ({
                label,
                normalized: this.normalizeCopyText(label)
            })).sort((left, right) =>
                right.normalized.length - left.normalized.length
            );
            const compact = this.normalizeCopyText(raw)
                .replace(/[、，,；;]/g, '');
            const matched = [];
            let cursor = 0;
            while (cursor < compact.length) {
                const option = knownOptions.find((candidate) =>
                    compact.startsWith(candidate.normalized, cursor)
                );
                if (option) {
                    if (!matched.includes(option.label)) {
                        matched.push(option.label);
                    }
                    cursor += option.normalized.length;
                } else {
                    cursor += 1;
                }
            }
            if (matched.length) return matched;
            return Array.from(new Set(
                raw.split(/[\s、，,；;]+/)
                    .map((item) => item.trim())
                    .filter(Boolean)
            ));
        }

        getNoticeCopySchema(template) {
            const fields = template.fields || {};
            const definitions = [
                {
                    key: 'noticeCategory',
                    label: '通知单类别',
                    aliases: ['通知单类别', '通知类别'],
                    value: fields.noticeCategory,
                    preferredType: 'select'
                },
                {
                    key: 'categoryDetail',
                    label: '类别细分',
                    aliases: ['类别细分', '分类细分'],
                    value: fields.categoryDetail,
                    preferredType: 'select'
                },
                {
                    key: 'serviceOrderJobNo',
                    label: '服务订单工号',
                    aliases: ['服务订单工号'],
                    value: fields.serviceOrderJobNo,
                    preferredType: 'auto'
                },
                {
                    key: 'serviceRequestNo',
                    label: '服务需求单/流程编号',
                    aliases: [
                        '服务需求单/流程编号',
                        '服务需求单流程编号'
                    ],
                    value: fields.serviceRequestNo,
                    preferredType: 'auto'
                },
                {
                    key: 'businessFreeProcessNo',
                    label: '商务免费流程编号',
                    aliases: [
                        '商务免费流程编号',
                        '商务免费流程号'
                    ],
                    value: fields.businessFreeProcessNo,
                    preferredType: 'auto'
                },
                {
                    key: 'externalNcrNo',
                    label: '外部NCR编号',
                    aliases: ['外部NCR编号'],
                    value: fields.externalNcrNo,
                    preferredType: 'auto',
                    optional: true
                },
                {
                    key: 'related',
                    label: '与其他通知单是否关联',
                    aliases: ['与其他通知单是否关联'],
                    value: fields.related,
                    preferredType: 'radio'
                },
                {
                    key: 'relatedNotice',
                    label: '其他通知单编号',
                    aliases: ['其他通知单编号', '关联通知单编号'],
                    value: fields.relatedNotice,
                    preferredType: 'auto'
                },
                {
                    key: 'dependentProduct',
                    label: '是否依托产品验证',
                    aliases: ['是否依托产品验证'],
                    value: fields.dependentProduct,
                    preferredType: 'radio'
                },
                {
                    key: 'dependentProductJobNo',
                    label: '依托产品验证工号',
                    aliases: ['依托产品验证工号'],
                    value: fields.dependentProductJobNo,
                    preferredType: 'auto'
                },
                {
                    key: 'productType',
                    label: '产品类型',
                    aliases: ['产品类型'],
                    value: fields.productType,
                    preferredType: 'select'
                },
                {
                    key: 'productName',
                    label: '产品名称',
                    aliases: ['产品名称'],
                    value: fields.productName,
                    preferredType: 'auto'
                },
                {
                    key: 'workNo',
                    label: '工号',
                    aliases: ['工号'],
                    value: fields.workNo,
                    preferredType: 'auto'
                },
                {
                    key: 'partName',
                    label: '部件名称',
                    aliases: ['部件名称'],
                    value: fields.partName,
                    preferredType: 'auto'
                },
                {
                    key: 'partDrawingNo',
                    label: '部件图号',
                    aliases: ['部件图号'],
                    value: fields.partDrawingNo,
                    preferredType: 'auto'
                },
                {
                    key: 'partClass',
                    label: '部件类属',
                    aliases: ['部件类属'],
                    value: this.getPartClassValues(fields.partClass),
                    preferredType: 'checkbox'
                },
                {
                    key: 'sapRelated',
                    label: '是否与SAP相关',
                    aliases: ['是否与SAP相关', '与SAP相关'],
                    value: fields.sapRelated,
                    preferredType: 'radio'
                },
                {
                    key: 'shippingRelated',
                    label: '是否与发运相关',
                    aliases: ['是否与发运相关', '与发运相关'],
                    value: fields.shippingRelated,
                    preferredType: 'radio'
                },
                {
                    key: 'needCountersign',
                    label: '是否需会签',
                    aliases: ['是否需会签', '是否需要会签'],
                    value: fields.needCountersign,
                    preferredType: 'radio'
                },
                {
                    key: 'attachment',
                    label: '附页',
                    aliases: ['附页', '附件'],
                    value: fields.attachment,
                    preferredType: 'radio'
                },
                {
                    key: 'hasNewMaterial',
                    label: '是否有新物料号',
                    aliases: ['是否有新物料号', '有无新物料号'],
                    value: fields.hasNewMaterial,
                    preferredType: 'radio'
                },
                {
                    key: 'countersignDepartments',
                    label: '会签部门',
                    aliases: ['会签部门'],
                    value: (
                        template.countersignDepartments
                        && template.countersignDepartments.length
                    )
                        ? template.countersignDepartments
                        : (template.checkboxLabels || []),
                    preferredType: 'checkbox'
                },
                {
                    key: 'originalWorkNo',
                    label: '原工号',
                    aliases: ['原工号'],
                    value: fields.originalWorkNo,
                    preferredType: 'auto'
                },
                {
                    key: 'newWorkNo',
                    label: '新工号',
                    aliases: ['新工号'],
                    value: fields.newWorkNo,
                    preferredType: 'auto'
                },
                {
                    key: 'warrantyReplacement',
                    label: '质保书更换信息',
                    aliases: ['质保书更换信息', '是否更换质保书'],
                    value: fields.warrantyReplacement,
                    preferredType: 'radio'
                },
                {
                    key: 'warrantyReplacementDetail',
                    label: '质保书更换信息说明',
                    aliases: ['质保书更换信息', '是否更换质保书'],
                    value: fields.warrantyReplacementDetail,
                    preferredType: 'textarea'
                },
                {
                    key: 'partSteelSeal',
                    label: '部件钢印',
                    aliases: ['部件钢印', '是否更换部件钢印'],
                    value: fields.partSteelSeal,
                    preferredType: 'radio'
                },
                {
                    key: 'partSteelSealDetail',
                    label: '部件钢印说明',
                    aliases: ['部件钢印', '是否更换部件钢印'],
                    value: fields.partSteelSealDetail,
                    preferredType: 'textarea'
                },
                {
                    key: 'noticeContent',
                    label: '通知内容',
                    aliases: ['通知内容'],
                    value: fields.noticeContent,
                    preferredType: 'textarea'
                },
                {
                    key: 'needMaterial',
                    label: '是否需要布置物料',
                    aliases: ['是否需要布置物料', '是否需布置物料'],
                    value: fields.needMaterial,
                    preferredType: 'radio'
                },
                {
                    key: 'costChange',
                    label: '是否发生成本变更',
                    aliases: ['是否发生成本变更', '是否有成本变更'],
                    value: fields.costChange,
                    preferredType: 'radio'
                }
            ];
            definitions.forEach((definition) => {
                const isEmpty = Array.isArray(definition.value)
                    ? definition.value.length === 0
                    : String(definition.value || '').trim() === '';
                if (!isEmpty) return;
                const fallback = (template.genericFields || []).find(
                    (field) => definition.aliases.some((alias) =>
                        this.normalizeCopyText(field.label)
                            === this.normalizeCopyText(alias)
                    )
                );
                if (!fallback) return;
                definition.value = definition.key === 'partClass'
                    ? this.getPartClassValues(fallback.value)
                    : definition.preferredType === 'checkbox'
                        ? [fallback.value]
                        : fallback.value;
                definition.sourceFallback = true;
            });
            const knownLabels = new Set(
                definitions.flatMap((definition) =>
                    definition.aliases.map((alias) =>
                        this.normalizeCopyText(alias)
                    )
                )
            );
            const generic = (template.genericFields || []).filter((field) =>
                !knownLabels.has(this.normalizeCopyText(field.label))
                && !/^(物料信息|新增物料|取消物料|新物料供方信息)$/.test(
                    this.normalizeCopyText(field.label)
                )
                && !/工号|编号|日期|填单人|创建人|校核|批准|分发|状态/.test(
                    this.normalizeCopyText(field.label)
                )
            );
            return definitions.concat(generic).filter((definition) =>
                Array.isArray(definition.value)
                    ? definition.value.length > 0
                    : String(definition.value || '').trim() !== ''
            );
        }

        normalizeExactCopyValue(value) {
            return String(value || '')
                .replace(/\u00a0/g, ' ')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/[（]/g, '(')
                .replace(/[）]/g, ')')
                .replace(/\s+/g, '')
                .trim();
        }

        normalizeCopyInputValue(value) {
            return String(value == null ? '' : value)
                .replace(/\r\n?/g, '\n')
                .replace(/\u00a0/g, ' ')
                .trim();
        }

        getDestinationFieldLabel(text) {
            const raw = String(text || '').replace(/\u00a0/g, ' ').trim();
            if (!raw) return '';
            const separator = raw.search(/[：:]/);
            const label = separator >= 0 ? raw.slice(0, separator) : raw;
            const normalized = this.normalizeCopyText(label);
            return normalized.length <= 30 ? normalized : '';
        }

        getControlFieldLabelCandidates(doc, control) {
            const candidates = [];
            const add = (value) => {
                const label = this.getDestinationFieldLabel(value);
                if (label && !candidates.includes(label)) candidates.push(label);
            };
            if (control.id) {
                const explicit = doc.querySelector(
                    'label[for="' + CSS.escape(control.id) + '"]'
                );
                if (explicit) add(explicit.innerText || explicit.textContent);
            }
            const wrappingLabel = control.closest('label');
            if (wrappingLabel) {
                add(wrappingLabel.innerText || wrappingLabel.textContent);
            }

            let cell = control.closest('td,th');
            if (cell) {
                const directCellText = this.getElementOwnText(cell);
                if (/[：:]/.test(directCellText)) {
                    add(directCellText);
                    if (candidates.length) return candidates;
                }
            }
            let cellDepth = 0;
            while (cell && cellDepth < 3) {
                add(this.getElementOwnText(cell));
                let previous = cell.previousElementSibling;
                let distance = 0;
                while (previous && distance < 3) {
                    add(this.getElementOwnText(previous));
                    previous = previous.previousElementSibling;
                    distance += 1;
                }
                const parentCell = cell.parentElement
                    ? cell.parentElement.closest('td,th')
                    : null;
                if (!parentCell || parentCell === cell) break;
                cell = parentCell;
                cellDepth += 1;
            }
            return candidates;
        }

        findCopyControlsByIdentity(doc, aliases, selector) {
            if (!doc) return [];
            const wanted = aliases.map((alias) =>
                this.normalizeCopyText(alias)
            );
            return Array.from(doc.querySelectorAll(selector)).filter(
                (control) => {
                    if (control.disabled) return false;
                    const labels = this.getControlFieldLabelCandidates(
                        doc,
                        control
                    );
                    return labels.some((label) => wanted.includes(label));
                }
            );
        }

        getIdentifiedCopyControls(doc, aliases, selector) {
            const identified = this.findCopyControlsByIdentity(
                doc,
                aliases,
                selector
            );
            const fallback = this.findCopyControls(doc, aliases, selector);
            if (/checkbox/i.test(selector)) {
                return Array.from(new Set(identified.concat(fallback)));
            }
            return identified.length ? identified : fallback;
        }

        isCopyControlVisible(control) {
            if (!control || !control.isConnected) return false;
            if (
                control.hidden
                || String(control.type || '').toLowerCase() === 'hidden'
            ) return false;
            const view = control.ownerDocument
                ? control.ownerDocument.defaultView
                : null;
            let element = control;
            while (
                element
                && element.nodeType === 1
                && element !== control.ownerDocument.documentElement
            ) {
                if (element.hidden) return false;
                if (view && typeof view.getComputedStyle === 'function') {
                    const style = view.getComputedStyle(element);
                    if (
                        style.display === 'none'
                        || style.visibility === 'hidden'
                        || style.visibility === 'collapse'
                    ) return false;
                }
                element = element.parentElement;
            }
            return true;
        }

        getCompleteCopyCheckboxGroup(doc, aliases) {
            const wanted = aliases.map((alias) =>
                this.normalizeCopyText(alias)
            );
            if (
                !wanted.includes('部件类属')
                && !wanted.includes('会签部门')
            ) return [];
            const results = [];
            const add = (root) => {
                if (!root) return;
                Array.from(
                    root.querySelectorAll('input[type="checkbox"]')
                ).forEach((checkbox) => {
                    if (
                        !checkbox.disabled
                        && !results.includes(checkbox)
                    ) results.push(checkbox);
                });
            };
            const addRowSpan = (startRow, spanValue) => {
                let row = startRow;
                const span = Math.max(
                    1,
                    Number.parseInt(String(spanValue || 1), 10) || 1
                );
                for (
                    let offset = 0;
                    row && offset < span;
                    offset += 1
                ) {
                    add(row);
                    row = row.nextElementSibling;
                    while (row && row.tagName !== 'TR') {
                        row = row.nextElementSibling;
                    }
                }
            };
            this.findCopyFieldContainers(doc, aliases).forEach((container) => {
                let fieldCell = container.closest('td,th');
                let row = fieldCell
                    ? fieldCell.closest('tr')
                    : container.closest('tr');
                for (let depth = 0; row && depth < 3; depth += 1) {
                    addRowSpan(
                        row,
                        fieldCell ? fieldCell.rowSpan : 1
                    );
                    const parentCell = row.parentElement
                        ? row.parentElement.closest('td,th')
                        : null;
                    fieldCell = parentCell;
                    row = parentCell ? parentCell.closest('tr') : null;
                }
            });
            return results;
        }

        getCopyFieldControls(doc, aliases) {
            const controls = {
                selects: this.getIdentifiedCopyControls(
                    doc,
                    aliases,
                    'select'
                ),
                textareas: this.getIdentifiedCopyControls(
                    doc,
                    aliases,
                    'textarea'
                ),
                texts: this.getIdentifiedCopyControls(
                    doc,
                    aliases,
                    'input:not([type]),input[type="text"]'
                ),
                radios: this.getIdentifiedCopyControls(
                    doc,
                    aliases,
                    'input[type="radio"]'
                ),
                checkboxes: this.getIdentifiedCopyControls(
                    doc,
                    aliases,
                    'input[type="checkbox"]'
                )
            };
            controls.checkboxes = Array.from(new Set(
                controls.checkboxes.concat(
                    this.getCompleteCopyCheckboxGroup(doc, aliases)
                )
            ));
            const allControls = Object.values(controls).flat();
            if (allControls.some((control) =>
                this.isCopyControlVisible(control)
            )) {
                Object.keys(controls).forEach((key) => {
                    controls[key] = controls[key].filter((control) =>
                        this.isCopyControlVisible(control)
                    );
                });
            }
            return controls;
        }

        findExactCopyOption(select, desired) {
            const wanted = this.normalizeExactCopyValue(desired);
            if (!wanted) return null;
            return Array.from(select.options || []).find((option) => {
                const text = this.normalizeExactCopyValue(option.textContent);
                return text === wanted;
            }) || null;
        }

        getCopyPolarity(value) {
            const normalized = this.normalizeCopyText(value);
            if (/^(是|有|需要|相关|1|yes|true)$/i.test(normalized)) {
                return 'positive';
            }
            if (/^(否|无|不需要|不相关|0|no|false)$/i.test(normalized)) {
                return 'negative';
            }
            if (/未|不|否|无/.test(normalized)) return 'negative';
            if (/是|有/.test(normalized)) return 'positive';
            return '';
        }

        getRadioOptionModel(doc, radios) {
            if (!radios.length) return [];
            const firstPrevious = this.normalizeCopyText(
                this.getChoiceSideText(radios[0], 'previous')
            );
            const firstNext = this.normalizeCopyText(
                this.getChoiceSideText(radios[0], 'next')
            );
            const previousHasBinary = /(是|否|有|无)$/.test(firstPrevious);
            const nextHasBinary = /^(是|否|有|无)/.test(firstNext);
            const orientation = previousHasBinary
                ? 'previous'
                : nextHasBinary
                    ? 'next'
                    : '';
            return radios.map((radio, index) => {
                let label = orientation
                    ? this.normalizeCopyText(
                        this.getChoiceSideText(radio, orientation)
                    )
                    : this.getRadioChoiceCaption(doc, radio);
                const binary = orientation === 'previous'
                    ? label.match(/(是|否|有|无)$/)
                    : label.match(/^(是|否|有|无)/);
                if (binary) label = binary[1];
                const value = this.normalizeCopyText(radio.value);
                let polarity = radios.length === 2
                    ? (index === 0 ? 'positive' : 'negative')
                    : this.getCopyPolarity(label)
                        || this.getCopyPolarity(value);
                return { radio, label, value, polarity };
            });
        }

        waitForCopyDomStable(doc, quietMs = 180, maxMs = 1800) {
            return new Promise((resolve) => {
                if (!doc || !doc.documentElement) {
                    resolve();
                    return;
                }
                let quietTimer = null;
                let finished = false;
                const finish = () => {
                    if (finished) return;
                    finished = true;
                    if (quietTimer) window.clearTimeout(quietTimer);
                    window.clearTimeout(maxTimer);
                    observer.disconnect();
                    resolve();
                };
                const schedule = () => {
                    if (quietTimer) window.clearTimeout(quietTimer);
                    quietTimer = window.setTimeout(finish, quietMs);
                };
                const observer = new MutationObserver(schedule);
                const maxTimer = window.setTimeout(finish, maxMs);
                try {
                    observer.observe(doc.documentElement, {
                        childList: true,
                        subtree: true,
                        attributes: true
                    });
                    schedule();
                } catch (e) {
                    finish();
                }
            });
        }

        async applyCopySchemaField(doc, definition, timeoutMs = 500) {
            const desired = definition.value;
            const desiredValues = Array.isArray(desired)
                ? desired.map((item) => this.normalizeExactCopyValue(item))
                : [];
            const found = await this.waitForCopyCondition(() => {
                const controls = this.getCopyFieldControls(
                    doc,
                    definition.aliases
                );
                const expectedReady = definition.preferredType === 'select'
                    ? controls.selects.length > 0
                    : definition.preferredType === 'textarea'
                        ? controls.textareas.length > 0
                        : definition.preferredType === 'radio'
                            ? controls.radios.length > 0
                            : definition.preferredType === 'checkbox'
                                ? controls.checkboxes.length > 0
                                : Object.values(controls)
                                    .some((items) => items.length > 0);
                return expectedReady ? controls : null;
            }, timeoutMs);
            if (!found) {
                return {
                    status: 'failed',
                    label: definition.label,
                    reason: '未找到对应控件'
                };
            }

            const type = definition.preferredType;
            const useVisibleAutoText = (
                type === 'auto'
                && definition.key === 'productName'
                && (found.textareas.length || found.texts.length)
            );
            if (
                type === 'select'
                || (
                    type === 'auto'
                    && found.selects.length
                    && !useVisibleAutoText
                )
            ) {
                const selectMatch = await this.waitForCopyCondition(() => {
                    const current = this.getCopyFieldControls(
                        doc,
                        definition.aliases
                    );
                    for (const select of current.selects) {
                        const option = this.findExactCopyOption(select, desired);
                        if (option) return { select, option };
                    }
                    return null;
                }, Math.max(1800, timeoutMs));
                if (!selectMatch) {
                    const current = this.getCopyFieldControls(
                        doc,
                        definition.aliases
                    );
                    if (definition.key === 'workNo') {
                        current.selects.forEach((select) => {
                            select.selectedIndex = -1;
                        });
                    }
                    return {
                        status: 'failed',
                        label: definition.label,
                        reason: '下拉菜单没有完全相同的选项'
                    };
                }
                if (selectMatch.select.value !== selectMatch.option.value) {
                    selectMatch.select.value = selectMatch.option.value;
                    this.dispatchCopyChange(selectMatch.select, false);
                    await this.waitForCopyDomStable(doc);
                }
                return {
                    status: 'applied',
                    label: definition.label,
                    type: 'select'
                };
            }

            if (
                type === 'textarea'
                || (
                    type === 'auto'
                    && (found.textareas.length || found.texts.length)
                )
            ) {
                const control = type === 'textarea'
                    ? found.textareas[0]
                    : found.textareas[0] || found.texts[0];
                if (!control) {
                    return {
                        status: 'failed',
                        label: definition.label,
                        reason: '未找到文本输入框'
                    };
                }
                this.setCopyTextControl(control, desired);
                return {
                    status: 'applied',
                    label: definition.label,
                    type: control.tagName === 'TEXTAREA'
                        ? 'textarea'
                        : 'text'
                };
            }

            if (type === 'radio' || (type === 'auto' && found.radios.length)) {
                const polarity = this.getCopyPolarity(desired);
                const models = this.getRadioOptionModel(doc, found.radios);
                const target = models.find((model) =>
                    polarity
                        ? model.polarity === polarity
                        : this.normalizeExactCopyValue(model.label)
                            === this.normalizeExactCopyValue(desired)
                );
                if (!target) {
                    return {
                        status: 'failed',
                        label: definition.label,
                        reason: '未找到同名的单选项'
                    };
                }
                if (!target.radio.checked) {
                    this.dispatchCopyChange(target.radio, true);
                    await this.waitForCopyDomStable(doc);
                }
                return {
                    status: 'applied',
                    label: definition.label,
                    type: 'radio'
                };
            }

            if (
                type === 'checkbox'
                || (type === 'auto' && found.checkboxes.length)
            ) {
                const controls = found.checkboxes;
                const matched = [];
                const unmatched = [];
                for (const desiredValue of desiredValues) {
                    const checkbox = controls.find((input) =>
                        this.getChoiceCaptions(doc, input).some((caption) =>
                            this.normalizeExactCopyValue(caption)
                                === desiredValue
                        )
                    );
                    if (checkbox) matched.push(checkbox);
                    else unmatched.push(desiredValue);
                }
                if (matched.length !== desiredValues.length) {
                    return {
                        status: 'failed',
                        label: definition.label,
                        reason: '未找到复选项：' + unmatched.join('、')
                    };
                }
                controls.forEach((checkbox) => {
                    const shouldBeChecked = matched.includes(checkbox);
                    if (checkbox.checked !== shouldBeChecked) {
                        this.dispatchCopyChange(checkbox, true);
                    }
                });
                return {
                    status: 'applied',
                    label: definition.label,
                    type: 'checkbox'
                };
            }

            return {
                status: 'failed',
                label: definition.label,
                reason: '无法识别输入类型'
            };
        }

        verifyCopySchemaField(doc, definition) {
            const controls = this.getCopyFieldControls(
                doc,
                definition.aliases
            );
            const desired = definition.value;
            const expected = this.normalizeExactCopyValue(desired);
            if (definition.preferredType === 'select') {
                return controls.selects.some((select) => {
                    const selected = select.options
                        ? select.options[select.selectedIndex]
                        : null;
                    return selected
                        && this.normalizeExactCopyValue(selected.textContent)
                            === expected;
                });
            }
            if (definition.preferredType === 'textarea') {
                return controls.textareas.some((control) =>
                    this.normalizeCopyInputValue(control.value)
                        === this.normalizeCopyInputValue(desired)
                );
            }
            if (definition.preferredType === 'radio') {
                const polarity = this.getCopyPolarity(desired);
                return this.getRadioOptionModel(doc, controls.radios).some(
                    (model) =>
                        model.radio.checked
                        && (
                            polarity
                                ? model.polarity === polarity
                                : this.normalizeExactCopyValue(model.label)
                                    === expected
                        )
                );
            }
            if (
                definition.preferredType === 'checkbox'
                && Array.isArray(desired)
            ) {
                return desired.every((item) => {
                    const wanted = this.normalizeExactCopyValue(item);
                    return controls.checkboxes.some((checkbox) =>
                        checkbox.checked
                        && this.getChoiceCaptions(doc, checkbox).some(
                            (caption) =>
                                this.normalizeExactCopyValue(caption)
                                    === wanted
                        )
                    );
                });
            }
            if (
                definition.preferredType === 'auto'
                && definition.key === 'productName'
                && (controls.textareas.length || controls.texts.length)
            ) {
                return controls.textareas.concat(controls.texts).some(
                    (control) =>
                        this.normalizeCopyInputValue(control.value)
                            === this.normalizeCopyInputValue(desired)
                );
            }
            if (controls.selects.length) {
                return controls.selects.some((select) => {
                    const selected = select.options
                        ? select.options[select.selectedIndex]
                        : null;
                    return selected
                        && this.normalizeExactCopyValue(selected.textContent)
                            === expected;
                });
            }
            if (controls.textareas.length || controls.texts.length) {
                return controls.textareas.concat(controls.texts).some(
                    (control) =>
                        this.normalizeCopyInputValue(control.value)
                            === this.normalizeCopyInputValue(desired)
                );
            }
            if (controls.radios.length) {
                const polarity = this.getCopyPolarity(desired);
                return this.getRadioOptionModel(doc, controls.radios).some(
                    (model) =>
                        model.radio.checked
                        && (
                            polarity
                                ? model.polarity === polarity
                                : this.normalizeExactCopyValue(model.label)
                                    === expected
                        )
                );
            }
            if (controls.checkboxes.length && Array.isArray(desired)) {
                return desired.every((item) => {
                    const wanted = this.normalizeExactCopyValue(item);
                    return controls.checkboxes.some((checkbox) =>
                        checkbox.checked
                        && this.getChoiceCaptions(doc, checkbox).some(
                            (caption) =>
                                this.normalizeExactCopyValue(caption)
                                    === wanted
                        )
                    );
                });
            }
            return false;
        }

        async resetCopiedWorkNumber(doc) {
            const controls = await this.waitForCopyCondition(() => {
                const current = this.getCopyFieldControls(doc, ['工号']);
                return current.selects.length || current.texts.length
                    ? current
                    : null;
            }, 3500);
            if (!controls) return;
            if (controls.selects.length) {
                const select = controls.selects[0];
                const placeholder = Array.from(select.options || []).find(
                    (option) =>
                        /请选择.*工号/.test(option.textContent || '')
                        || String(option.value || '') === ''
                ) || select.options[0];
                if (placeholder && select.value !== placeholder.value) {
                    select.value = placeholder.value;
                    this.dispatchCopyChange(select, false);
                    await this.waitForCopyDomStable(doc);
                }
                return;
            }
            if (controls.texts[0] && controls.texts[0].value) {
                this.setCopyTextControl(controls.texts[0], '');
            }
        }

        getCreateNoticeType(sourceNoticeType) {
            const normalized = this.normalizeCopyText(sourceNoticeType)
                .replace(/通知单$/, '');
            if (normalized === '常规订单变更') return '订单变更';
            return String(sourceNoticeType || '').replace(/通知单$/, '').trim();
        }

        getDistributionCheckboxMap(model) {
            if (!model) return new Map();
            for (
                let rowIndex = model.headerRowIndex + 1;
                rowIndex < Math.min(
                    model.rows.length,
                    model.headerRowIndex + 5
                );
                rowIndex += 1
            ) {
                const cells = model.grid[rowIndex] || [];
                const result = new Map();
                Object.entries(model.headerByColumn).forEach(
                    ([columnText, label]) => {
                        if (label === '发送部门') return;
                        const cell = cells[Number(columnText)];
                        if (!cell) return;
                        const checkbox = Array.from(
                            cell.querySelectorAll('input[type="checkbox"]')
                        ).find((input) =>
                            !input.disabled
                            && input.closest('table') === model.table
                        );
                        if (checkbox) result.set(label, checkbox);
                    }
                );
                if (result.size >= 3) return result;
            }
            return new Map();
        }

        async applyDistributionDepartments(doc, sourceDepartments) {
            const desired = Array.from(new Set(
                (sourceDepartments || [])
                    .map((label) => this.normalizeCopyText(label))
                    .filter(Boolean)
            ));
            if (!desired.length) {
                return {
                    status: 'applied',
                    label: '发送部门打点（0项）',
                    type: 'distribution-table'
                };
            }
            const matched = await this.waitForCopyCondition(() => {
                const model = this.findDistributionTableModel(doc);
                const checkboxMap = this.getDistributionCheckboxMap(model);
                return checkboxMap.size
                    ? { model, checkboxMap }
                    : null;
            }, 3000);
            if (!matched) {
                return {
                    status: 'failed',
                    label: '发送部门打点（' + desired.length + '项）',
                    type: 'distribution-table',
                    reason: '创建页未找到发送部门复选框表格'
                };
            }
            const missing = desired.filter(
                (label) => !matched.checkboxMap.has(label)
            );
            matched.checkboxMap.forEach((checkbox, label) => {
                const shouldBeChecked = desired.includes(label);
                if (checkbox.checked !== shouldBeChecked) {
                    this.dispatchCopyChange(checkbox, true);
                }
            });
            const inconsistent = [];
            matched.checkboxMap.forEach((checkbox, label) => {
                if (checkbox.checked !== desired.includes(label)) {
                    inconsistent.push(label);
                }
            });
            const failures = [];
            if (missing.length) {
                failures.push('目标页未找到：' + missing.join('、'));
            }
            if (inconsistent.length) {
                failures.push('勾选后不一致：' + inconsistent.join('、'));
            }
            return {
                status: failures.length ? 'failed' : 'applied',
                label: '发送部门打点（' + desired.length + '项）',
                type: 'distribution-table',
                reason: failures.join('；')
            };
        }

        getTargetMaterialDataRows(model, sectionType = 'add') {
            if (!model) return [];
            const rows = [];
            for (
                let rowIndex = model.headerRowIndex + 1;
                rowIndex < model.rows.length;
                rowIndex += 1
            ) {
                const row = model.rows[rowIndex];
                const rowText = this.normalizeCopyText(
                    this.getElementOwnText(row)
                );
                if (
                    sectionType === 'add'
                    && /取消物料/.test(rowText)
                ) break;
                const editable = Array.from(
                    row.querySelectorAll('input,textarea,select')
                ).filter((control) =>
                    !control.disabled
                    && control.closest('table') === model.table
                    && !/^(button|submit|reset|hidden)$/i.test(
                        control.type || ''
                    )
                );
                if (editable.length) rows.push({ row, rowIndex });
            }
            return rows;
        }

        findAddMaterialButton(model) {
            if (!model) return null;
            const headerRow = model.rows[model.headerRowIndex];
            const enclosingRow = model.table.closest('td,th')
                ? model.table.closest('td,th').closest('tr')
                : null;
            const roots = Array.from(new Set(
                [headerRow, enclosingRow, model.table].filter(Boolean)
            ));
            const controls = roots.flatMap((root) => Array.from(
                root.querySelectorAll(
                    'button,input[type="button"],input[type="submit"]'
                )
            ));
            return Array.from(new Set(controls)).find((control) => {
                if (
                    control.disabled
                ) return false;
                const caption = this.normalizeCopyText(
                    control.value || control.textContent || ''
                );
                return caption === '+';
            }) || null;
        }

        getTargetMaterialControl(model, rowIndex, key) {
            const columnIndex = model.columns[key];
            if (columnIndex == null || !model.grid[rowIndex]) return null;
            const cell = model.grid[rowIndex][columnIndex];
            if (!cell) return null;
            const controls = Array.from(
                cell.querySelectorAll('input,textarea,select')
            ).filter((control) =>
                !control.disabled
                && control.closest('table') === model.table
                && !/^(button|submit|reset|hidden)$/i.test(
                    control.type || ''
                )
            );
            if (key === 'isNewMaterial') {
                return controls.find((control) =>
                    String(control.type || '').toLowerCase() === 'checkbox'
                ) || null;
            }
            return controls.find((control) =>
                !/^(checkbox|radio)$/i.test(control.type || '')
            ) || null;
        }

        setTargetMaterialControl(control, value) {
            if (!control) return false;
            if (control.tagName === 'SELECT') {
                const option = this.findExactCopyOption(control, value);
                if (!option) return false;
                if (control.value !== option.value) {
                    control.value = option.value;
                    this.dispatchCopyChange(control, false);
                }
                return true;
            }
            return this.setCopyTextControl(control, value == null ? '' : value);
        }

        verifyTargetMaterialControl(control, value, key) {
            if (!control) return false;
            if (key === 'isNewMaterial') {
                return control.checked === Boolean(value);
            }
            if (control.tagName === 'SELECT') {
                const option = control.options
                    ? control.options[control.selectedIndex]
                    : null;
                return Boolean(
                    option
                    && this.normalizeExactCopyValue(option.textContent)
                        === this.normalizeExactCopyValue(value)
                );
            }
            return this.normalizeCopyInputValue(control.value)
                === this.normalizeCopyInputValue(value);
        }

        async applyCopiedMaterialRows(
            doc,
            sourceRows,
            sectionType = 'add'
        ) {
            const rows = Array.isArray(sourceRows) ? sourceRows : [];
            const sectionLabel = sectionType === 'cancel'
                ? '取消物料'
                : '新增物料';
            if (!rows.length) {
                return {
                    status: 'failed',
                    label: sectionLabel + '明细',
                    type: 'material-table',
                    reason: '来源通知单未读取到' + sectionLabel + '行'
                };
            }
            let model = await this.waitForCopyCondition(
                () => this.findMaterialTableModel(doc, sectionType),
                3000
            );
            if (!model) {
                return {
                    status: 'failed',
                    label: sectionLabel + '明细（' + rows.length + '行）',
                    type: 'material-table',
                    reason: '创建页未找到' + sectionLabel + '表'
                };
            }

            let targetRows = this.getTargetMaterialDataRows(
                model,
                sectionType
            );
            let addAttempts = 0;
            while (
                targetRows.length < rows.length
                && addAttempts < rows.length + 2
            ) {
                addAttempts += 1;
                const addButton = this.findAddMaterialButton(model);
                if (!addButton) {
                    return {
                        status: 'failed',
                        label: sectionLabel + '明细（'
                            + rows.length + '行）',
                        type: 'material-table',
                        reason: '只生成 ' + targetRows.length
                            + ' 行，未找到' + sectionLabel + '“+”按钮'
                    };
                }
                addButton.click();
                await this.waitForCopyDomStable(doc, 120, 1200);
                model = this.findMaterialTableModel(doc, sectionType);
                if (!model) break;
                const updatedRows = this.getTargetMaterialDataRows(
                    model,
                    sectionType
                );
                if (updatedRows.length <= targetRows.length) {
                    const previousCount = targetRows.length;
                    await this.waitForCopyCondition(() => {
                        const currentModel = this.findMaterialTableModel(
                            doc,
                            sectionType
                        );
                        return (
                            currentModel
                            && this.getTargetMaterialDataRows(
                                currentModel,
                                sectionType
                            ).length
                                > previousCount
                        ) ? currentModel : null;
                    }, 1000);
                    model = this.findMaterialTableModel(doc, sectionType);
                    if (
                        !model
                        || this.getTargetMaterialDataRows(
                            model,
                            sectionType
                        ).length
                            <= previousCount
                    ) break;
                }
                targetRows = this.getTargetMaterialDataRows(
                    model,
                    sectionType
                );
            }
            if (!model || targetRows.length < rows.length) {
                return {
                    status: 'failed',
                    label: sectionLabel + '明细（' + rows.length + '行）',
                    type: 'material-table',
                    reason: '目标行生成失败：需要 ' + rows.length
                        + ' 行，实际 ' + targetRows.length + ' 行'
                };
            }

            const fieldLabels = {
                level: '层级',
                materialNo: '物料号',
                drawingNo: '图号',
                description: '物料描述',
                quantity: '数量',
                unit: '单位',
                remark: '备注',
                isNewMaterial: '新物料',
                processRoute: '工艺路线',
                completionTime: '要求完工时间',
                unitPrice: '单价',
                addedCost: '追加成本'
            };
            const keys = Object.keys(fieldLabels);
            const failures = [];
            rows.forEach((sourceRow, sourceIndex) => {
                const target = targetRows[sourceIndex];
                keys.forEach((key) => {
                    const columnExists = model.columns[key] != null;
                    const sourceValue = key === 'isNewMaterial'
                        ? Boolean(sourceRow[key])
                        : String(sourceRow[key] == null ? '' : sourceRow[key]);
                    if (!columnExists) {
                        if (sourceValue !== '' && sourceValue !== false) {
                            failures.push(
                                '第' + (sourceIndex + 1) + '行'
                                + fieldLabels[key] + '：目标页无此列'
                            );
                        }
                        return;
                    }
                    const control = this.getTargetMaterialControl(
                        model,
                        target.rowIndex,
                        key
                    );
                    if (!control) {
                        if (sourceValue !== '' && sourceValue !== false) {
                            failures.push(
                                '第' + (sourceIndex + 1) + '行'
                                + fieldLabels[key] + '：未找到输入框'
                            );
                        }
                        return;
                    }
                    if (key === 'isNewMaterial') {
                        if (control.checked !== sourceValue) {
                            this.dispatchCopyChange(control, true);
                        }
                    } else if (!this.setTargetMaterialControl(
                        control,
                        sourceValue
                    )) {
                        failures.push(
                            '第' + (sourceIndex + 1) + '行'
                            + fieldLabels[key] + '：写入失败'
                        );
                    }
                });
            });

            model = this.findMaterialTableModel(doc, sectionType);
            targetRows = this.getTargetMaterialDataRows(
                model,
                sectionType
            );
            rows.forEach((sourceRow, sourceIndex) => {
                const target = targetRows[sourceIndex];
                if (!target) return;
                keys.forEach((key) => {
                    if (model.columns[key] == null) return;
                    const control = this.getTargetMaterialControl(
                        model,
                        target.rowIndex,
                        key
                    );
                    const sourceValue = key === 'isNewMaterial'
                        ? Boolean(sourceRow[key])
                        : String(sourceRow[key] == null ? '' : sourceRow[key]);
                    if (
                        control
                        && !this.verifyTargetMaterialControl(
                            control,
                            sourceValue,
                            key
                        )
                    ) {
                        const message = '第' + (sourceIndex + 1) + '行'
                            + fieldLabels[key] + '：回填后不一致';
                        if (!failures.includes(message)) failures.push(message);
                    }
                });
            });
            return {
                status: failures.length ? 'failed' : 'applied',
                label: sectionLabel + '明细（' + rows.length + '行）',
                type: 'material-table',
                reason: failures.join('；')
            };
        }

        getJiguiCopySchema(template) {
            const fields = template.fields || {};
            return [
                {
                    key: 'workNo',
                    label: '工号',
                    aliases: ['工号'],
                    value: fields.workNo,
                    preferredType: 'auto'
                },
                {
                    key: 'productName',
                    label: '产品名称',
                    aliases: ['产品名称'],
                    value: fields.productName,
                    preferredType: 'auto'
                },
                {
                    key: 'partName',
                    label: '部件名称',
                    aliases: ['部件名称'],
                    value: fields.partName,
                    preferredType: 'auto'
                },
                {
                    key: 'partDrawingNo',
                    label: '部件图号',
                    aliases: ['部件图号'],
                    value: fields.partDrawingNo,
                    preferredType: 'auto'
                },
                {
                    key: 'partClass',
                    label: '部件类属',
                    aliases: ['部件类属'],
                    value: this.getPartClassValues(fields.partClass),
                    preferredType: 'checkbox'
                },
                {
                    key: 'sapRelated',
                    label: '是否与SAP相关',
                    aliases: ['是否与SAP相关', '与SAP相关'],
                    value: fields.sapRelated,
                    preferredType: 'radio'
                },
                {
                    key: 'hasNewMaterial',
                    label: '是否有新物料号',
                    aliases: ['是否有新物料号', '有无新物料号'],
                    value: fields.hasNewMaterial,
                    preferredType: 'radio'
                },
                {
                    key: 'reason',
                    label: '原因',
                    aliases: ['原因'],
                    value: fields.reason,
                    preferredType: 'textarea'
                },
                {
                    key: 'noticeContent',
                    label: '通知内容',
                    aliases: ['通知内容'],
                    value: fields.noticeContent,
                    preferredType: 'textarea'
                }
            ].filter((definition) =>
                Array.isArray(definition.value)
                    ? definition.value.length > 0
                    : String(definition.value || '').trim() !== ''
            );
        }

        getTargetJiguiRelationRows(model) {
            if (!model) return [];
            const rows = [];
            for (
                let rowIndex = model.headerRowIndex + 1;
                rowIndex < model.rows.length;
                rowIndex += 1
            ) {
                const row = model.rows[rowIndex];
                const editable = Array.from(
                    row.querySelectorAll('input,textarea,select')
                ).filter((control) =>
                    !control.disabled
                    && control.closest('table') === model.table
                    && !/^(button|submit|reset|hidden)$/i.test(
                        control.type || ''
                    )
                );
                if (editable.length) rows.push({ row, rowIndex });
            }
            return rows;
        }

        getTargetJiguiRelationControl(model, rowIndex, key) {
            const columnIndex = model.columns[key];
            const cell = model.grid[rowIndex]
                ? model.grid[rowIndex][columnIndex]
                : null;
            if (!cell) return null;
            return Array.from(
                cell.querySelectorAll('input,textarea,select')
            ).find((control) =>
                !control.disabled
                && control.closest('table') === model.table
                && !/^(button|submit|reset|hidden|checkbox|radio)$/i.test(
                    control.type || ''
                )
            ) || null;
        }

        findAddJiguiRelationButton(model) {
            if (!model) return null;
            const roots = [
                model.table,
                model.table.closest('tr')
            ].filter(Boolean);
            return roots.flatMap((root) => Array.from(
                root.querySelectorAll(
                    'button,input[type="button"],input[type="submit"]'
                )
            )).find((control) =>
                !control.disabled
                && this.normalizeCopyText(
                    control.value || control.textContent || ''
                ) === '+'
            ) || null;
        }

        async applyCopiedJiguiRelationRows(doc, sourceRows) {
            const rows = Array.isArray(sourceRows) ? sourceRows : [];
            if (!rows.length) return;
            let model = await this.waitForCopyCondition(
                () => this.findJiguiRelationTableModel(doc, false),
                3000
            );
            if (!model) return;
            let targetRows = this.getTargetJiguiRelationRows(model);
            let attempts = 0;
            while (
                targetRows.length < rows.length
                && attempts < rows.length + 2
            ) {
                attempts += 1;
                const addButton = this.findAddJiguiRelationButton(model);
                if (!addButton) break;
                addButton.click();
                await this.waitForCopyDomStable(doc, 120, 1200);
                model = this.findJiguiRelationTableModel(doc, false);
                if (!model) break;
                targetRows = this.getTargetJiguiRelationRows(model);
            }
            rows.slice(0, targetRows.length).forEach((sourceRow, index) => {
                const targetRow = targetRows[index];
                ['name', 'drawingNo', 'quantity'].forEach((key) => {
                    const control = this.getTargetJiguiRelationControl(
                        model,
                        targetRow.rowIndex,
                        key
                    );
                    if (control) {
                        this.setCopyTextControl(
                            control,
                            sourceRow[key] == null ? '' : sourceRow[key]
                        );
                    }
                });
            });
        }

        async applyJiguiCopyWithoutDiagnostics(
            panel,
            doc,
            session,
            runToken
        ) {
            const template = session.template;
            const schema = this.getJiguiCopySchema(template);
            let pending = schema.slice();
            await this.waitForCopyDomStable(doc);
            if (!this.isCopyRunCurrent(session, runToken)) return;
            for (let pass = 0; pass < 3 && pending.length; pass += 1) {
                const passBeforeCount = pending.length;
                const nextPending = [];
                let passApplied = 0;
                for (const definition of pending) {
                    if (this.verifyCopySchemaField(doc, definition)) {
                        continue;
                    }
                    const result = await this.applyCopySchemaField(
                        doc,
                        definition,
                        pass === 0 ? 350 : 700
                    );
                    if (!this.isCopyRunCurrent(session, runToken)) return;
                    if (result.status === 'applied') passApplied += 1;
                    else nextPending.push(definition);
                }
                pending = nextPending;
                if (!pending.length) break;
                await this.waitForCopyDomStable(
                    doc,
                    passApplied ? 240 : 420,
                    passApplied ? 1800 : 900
                );
                if (!this.isCopyRunCurrent(session, runToken)) return;
                if (
                    pass >= 1
                    && passBeforeCount - nextPending.length === 0
                ) break;
            }
            await this.applyCopiedJiguiRelationRows(
                doc,
                template.relationRows
            );
            if (!this.isCopyRunCurrent(session, runToken)) return;
            if (
                Array.isArray(template.distributionDepartments)
                && template.distributionDepartments.length
            ) {
                await this.applyDistributionDepartments(
                    doc,
                    template.distributionDepartments
                );
                if (!this.isCopyRunCurrent(session, runToken)) return;
            }
            session.completed = true;
            this.showNoticeCopyStatus(
                panel,
                '填写完成，请仔细核对后提交!',
                'success'
            );
            this.noticeCopySession = null;
        }

        async applyNoticeCopyWithoutDiagnostics(
            panel,
            doc,
            session,
            runToken
        ) {
            const template = session.template;
            const createNoticeType = this.getCreateNoticeType(
                template.noticeType
            );
            await this.applyCopySelect(
                doc,
                ['通知单类型', '通知类型'],
                createNoticeType,
                true
            );
            if (!this.isCopyRunCurrent(session, runToken)) return;
            await this.waitForCopyDomStable(doc);
            if (!this.isCopyRunCurrent(session, runToken)) return;

            const schema = this.getNoticeCopySchema(template);
            let pending = schema.slice();
            for (let pass = 0; pass < 5 && pending.length; pass += 1) {
                const passBeforeCount = pending.length;
                const nextPending = [];
                let passApplied = 0;
                for (const definition of pending) {
                    if (this.verifyCopySchemaField(doc, definition)) {
                        continue;
                    }
                    const result = await this.applyCopySchemaField(
                        doc,
                        definition,
                        pass === 0 ? 350 : 700
                    );
                    if (!this.isCopyRunCurrent(session, runToken)) return;
                    if (result.status === 'applied') {
                        passApplied += 1;
                    } else {
                        nextPending.push(definition);
                    }
                }
                pending = nextPending;
                if (!pending.length) break;
                await this.waitForCopyDomStable(
                    doc,
                    passApplied ? 240 : 420,
                    passApplied ? 1800 : 900
                );
                if (!this.isCopyRunCurrent(session, runToken)) return;
                const completedThisPass =
                    passBeforeCount - nextPending.length;
                if (pass >= 1 && completedThisPass === 0) break;
            }

            if (
                this.getCopyPolarity(template.fields.needMaterial)
                    === 'positive'
            ) {
                await this.applyCopiedMaterialRows(
                    doc,
                    template.materialRows,
                    'add'
                );
                if (!this.isCopyRunCurrent(session, runToken)) return;
                if (
                    Array.isArray(template.cancelMaterialRows)
                    && template.cancelMaterialRows.length
                ) {
                    await this.applyCopiedMaterialRows(
                        doc,
                        template.cancelMaterialRows,
                        'cancel'
                    );
                    if (!this.isCopyRunCurrent(session, runToken)) return;
                }
            }

            if (
                Array.isArray(template.distributionDepartments)
                && template.distributionDepartments.length
            ) {
                await this.applyDistributionDepartments(
                    doc,
                    template.distributionDepartments
                );
                if (!this.isCopyRunCurrent(session, runToken)) return;
            }

            session.completed = true;
            this.showNoticeCopyStatus(
                panel,
                '填写完成，请仔细核对后提交!',
                'success'
            );
            this.noticeCopySession = null;
        }

        async applyNoticeCopyTemplate(panel, doc, session, runToken) {
            if (session.copyModule === 'jigui') {
                return this.applyJiguiCopyWithoutDiagnostics(
                    panel,
                    doc,
                    session,
                    runToken
                );
            }
            return this.applyNoticeCopyWithoutDiagnostics(
                panel,
                doc,
                session,
                runToken
            );
        }

        getTodoDetailModule(url) {
            let parsed;
            try {
                parsed = new URL(String(url || ''), 'http://10.16.88.34/');
            } catch (e) {
                return null;
            }
            if (parsed.hostname !== '10.16.88.34') return null;
            const path = parsed.pathname.toLowerCase();
            if (path === '/notice/viewarticle.asp') {
                return { sourceTab: 'tongzhi', documentLabel: '通知单' };
            }
            if (
                path.startsWith('/jigui/')
                && path.endsWith('.asp')
                && !/^\/jigui\/(?:search|createnote|index|default)\.asp$/i.test(path)
            ) {
                return { sourceTab: 'jigui', documentLabel: '机规' };
            }
            return null;
        }

        normalizePersonName(value) {
            return String(value || '')
                .replace(/\u00a0/g, ' ')
                .trim()
                .replace(/\s+/g, '')
                .replace(/[（(].*$/, '');
        }

        extractFillerName(iframeDoc) {
            const labeled = this.extractLabelValue(iframeDoc, [
                '填单人',
                '填 单 人',
                '创建人',
                '创 建 人',
                '编制人',
                '编 制 人',
                '编写人',
                '编 写 人',
                '拟制人',
                '拟 制 人'
            ]);
            if (labeled) {
                return this.normalizePersonName(labeled);
            }
            const text = iframeDoc && iframeDoc.body
                ? (iframeDoc.body.innerText || iframeDoc.body.textContent || '')
                : '';
            const match = text.match(
                /(?:填\s*单\s*人|创\s*建\s*人|编\s*制\s*人|编\s*写\s*人|拟\s*制\s*人)\s*[：:]\s*([^\s，,；;|<>]{1,40})/
            );
            return match ? this.normalizePersonName(match[1]) : '';
        }

        isCurrentUserFiller(iframeDoc) {
            const fillerName = this.extractFillerName(iframeDoc);
            if (!fillerName) return false;
            const currentSystemUser = this.systemUser || this.readCurrentUser();
            const ownNames = [
                this.profile && this.profile.name,
                this.profile && this.profile.systemName,
                currentSystemUser
            ]
                .map((name) => this.normalizePersonName(name))
                .filter(Boolean);
            return ownNames.includes(fillerName);
        }

        isUsableDocNo(value) {
            const normalized = String(value || '')
                .replace(/\u00a0/g, ' ')
                .replace(/^[：:\s]+|[：:\s]+$/g, '')
                .trim();
            if (!normalized) return false;
            const genericLabels = new Set([
                '浏览',
                '查看',
                '详情',
                '详情页面',
                '通知单',
                '机规',
                '创建通知单',
                '创建机规',
                '未校核',
                '待校核',
                '未会签',
                '待会签',
                '未批准',
                '待批准',
                '未分发',
                '未识别编号'
            ]);
            if (genericLabels.has(normalized)) return false;
            return !/^(?:浏览|查看)(?:详情|通知单|机规|附件)?$/u.test(normalized);
        }

        extractDocNo(panel, iframeDoc) {
            // 详情页中的编号是权威来源。列表链接经常只显示“浏览”，
            // 不能先把详情窗口标题当作通知单编号。
            const labeled = this.extractLabelValue(iframeDoc, [
                '编号',
                '编 号',
                '通知单编号',
                '通 知 单 编 号',
                '机规编号',
                '机 规 编 号'
            ]);
            if (this.isUsableDocNo(labeled)) return labeled.trim();

            const text = iframeDoc && iframeDoc.body
                ? (iframeDoc.body.innerText || iframeDoc.body.textContent || '')
                : '';
            const match = text.match(
                /(?:通\s*知\s*单\s*编\s*号|机\s*规\s*编\s*号|编号|编\s*号)\s*[：:]?\s*([^\s]{2,80})/
            );
            const matchedDocNo = match ? match[1].trim() : '';
            if (this.isUsableDocNo(matchedDocNo)) return matchedDocNo;

            // 部分机规详情没有稳定的字段标签，最后才使用窗口标题兜底。
            const titleElement = panel.querySelector('.detail-title');
            const panelTitle = titleElement
                ? (titleElement.textContent || '').replace(/^📄\s*/, '').trim()
                : '';
            return this.isUsableDocNo(panelTitle) ? panelTitle : '';
        }

        extractLabelValue(doc, labels) {
            if (!doc) return '';
            const normalizedLabels = labels.map((item) => item.replace(/\s+/g, ''));
            const cells = Array.from(doc.querySelectorAll('td, th'));
            for (const cell of cells) {
                const ownText = (cell.textContent || '')
                    .replace(/[：:]/g, '')
                    .replace(/\s+/g, '')
                    .trim();
                if (!normalizedLabels.includes(ownText)) continue;
                const next = cell.nextElementSibling;
                if (next) {
                    const value = (next.innerText || next.textContent || '').trim();
                    if (value) return value;
                }
            }
            return '';
        }

        inferTaskType(iframeDoc) {
            const checkValue = this.extractLabelValue(iframeDoc, ['校核']);
            const countersignValue = this.extractLabelValue(iframeDoc, ['会签', '项目部会签']);
            const approveValue = this.extractLabelValue(iframeDoc, ['批准']);
            const normalizeStatus = (value) => String(value || '')
                .replace(/\u00a0/g, '')
                .replace(/\s+/g, '')
                .trim();
            const normalizedCheck = normalizeStatus(checkValue);
            const normalizedCountersign = normalizeStatus(countersignValue);
            const normalizedApprove = normalizeStatus(approveValue);
            if (!normalizedCheck || /未校核|待校核/.test(normalizedCheck)) return '待校核';
            if (
                normalizedCountersign
                && /未会签|待会签/.test(normalizedCountersign)
            ) return '待会签';
            if (
                !normalizedApprove
                || /未批准|待批准/.test(normalizedApprove)
            ) return '待批准';
            return '待校核';
        }

        openCreateDialog(detail) {
            if (!this.profile) {
                window.alert('请先完成姓名和部门设置，再发送待办。');
                this.openIdentityDialog(true);
                return;
            }
            if (this.profile.receiveTasks === false) {
                return;
            }
            const old = document.getElementById('jzt-todo-dialog-overlay');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'jzt-todo-dialog-overlay';
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'background:rgba(15,23,42,.45)',
                'z-index:300000',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif'
            ].join(';');

            const dialog = document.createElement('div');
            dialog.id = 'jigui-detail-panel-todo-dialog';
            dialog.style.cssText = [
                'width:430px',
                'max-width:calc(100vw - 40px)',
                'background:#fff',
                'border:1px solid #dbe3ef',
                'border-radius:0',
                'box-shadow:0 16px 40px rgba(15,23,42,.16)',
                'overflow:hidden',
                'box-sizing:border-box',
                'display:flex',
                'flex-direction:column',
                'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                'font-size:15px',
                'color:#334155'
            ].join(';');
            dialog.innerHTML = `
                <div class="detail-header" style="background:rgb(30,80,220);color:white;height:40px;padding:0;border-radius:0;display:flex;justify-content:space-between;align-items:center;min-height:40px;box-sizing:border-box;">
                    <span class="detail-title" style="font-weight:bold;line-height:1;display:flex;align-items:center;padding-left:0;margin-left:-8px;">📄 通知待办</span>
                    <div style="display:flex;align-items:center;gap:0;height:100%;margin-right:-6px;">
                        <button class="detail-close-btn" type="button" data-action="close" title="关闭" aria-label="关闭" style="width:24px;height:24px;background:none;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;margin:0;transition:background-color .2s;line-height:1;">
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="display:block">
                                <line x1="2.2" y1="2.2" x2="9.8" y2="9.8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                                <line x1="9.8" y1="2.2" x2="2.2" y2="9.8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div style="padding:14px 18px 18px;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:15px;color:#334155;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;color:#334155;font-size:15px;line-height:20px;white-space:nowrap;">
                        <span style="flex:0 0 auto;"><span data-field="document-label"></span>：<strong data-field="doc-no"></strong></span>
                    </div>
                    <label style="display:block;margin-bottom:12px;font-size:15px;color:#334155;">
                        <div style="display:flex;align-items:center;gap:6px;line-height:20px;white-space:nowrap;">
                            <span style="flex:0 0 auto;">接收人：</span>
                            <span style="flex:0 0 auto;color:#ef4444;font-size:12px;font-weight:700;">（需对方安装3.0以上版本插件）</span>
                        </div>
                        <div style="position:relative;margin-top:6px;">
                            <input data-field="recipient-search" type="text" maxlength="40" autocomplete="off" placeholder="请输入姓名查询" style="display:block;width:100%;height:42px;box-sizing:border-box;padding:9px 11px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:15px;outline:none;">
                            <div data-field="recipient-results" style="display:none;position:absolute;left:0;right:0;top:45px;z-index:2;max-height:180px;overflow-y:auto;border:1px solid #94a3b8;border-radius:4px;background:#fff;box-shadow:0 8px 20px rgba(15,23,42,.16);"></div>
                        </div>
                        <div data-field="recipient-hint" style="min-height:0;margin-top:0;color:#64748b;font-size:12px;line-height:18px;"></div>
                    </label>
                    <div style="display:block;margin-bottom:12px;font-size:15px;color:#334155;">
                        待办类型：
                        <div data-field="task-type" role="radiogroup" aria-label="待办类型" style="display:flex;align-items:center;gap:24px;width:100%;height:42px;box-sizing:border-box;margin-top:6px;padding:0 12px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;">
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
                                <input type="radio" name="jzt-todo-task-type" value="待校核" style="width:16px;height:16px;margin:0;accent-color:#2563eb;cursor:pointer;">
                                <span>待校核</span>
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
                                <input type="radio" name="jzt-todo-task-type" value="待会签" style="width:16px;height:16px;margin:0;accent-color:#2563eb;cursor:pointer;">
                                <span>待会签</span>
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
                                <input type="radio" name="jzt-todo-task-type" value="待批准" style="width:16px;height:16px;margin:0;accent-color:#2563eb;cursor:pointer;">
                                <span>待批准</span>
                            </label>
                        </div>
                    </div>
                    <label style="display:block;margin-bottom:0;font-size:15px;color:#334155;">
                        备注（可选）：
                        <textarea data-field="message" maxlength="300" rows="3" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px;border:1px solid #cbd5e1;border-radius:4px;resize:vertical;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:15px;"></textarea>
                    </label>
                    <div data-field="status" style="min-height:18px;color:#64748b;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:13px;line-height:18px;margin-bottom:0;"></div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;">
                        <button type="button" data-action="cancel" style="padding:8px 18px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:14px;">取消</button>
                        <button type="button" data-action="send" style="padding:8px 18px;border:1px solid #1d4ed8;background:#2563eb;color:#fff;border-radius:4px;cursor:pointer;font-family:Microsoft YaHei,微软雅黑,sans-serif;font-size:14px;font-weight:700;">发送待办</button>
                    </div>
                </div>
            `;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const documentLabelElement = dialog.querySelector('[data-field="document-label"]');
            const docNoElement = dialog.querySelector('[data-field="doc-no"]');
            const recipientSearchInput = dialog.querySelector('[data-field="recipient-search"]');
            const recipientResults = dialog.querySelector('[data-field="recipient-results"]');
            const recipientHint = dialog.querySelector('[data-field="recipient-hint"]');
            const taskTypeInputs = Array.from(
                dialog.querySelectorAll('input[name="jzt-todo-task-type"]')
            );
            const messageInput = dialog.querySelector('[data-field="message"]');
            const statusElement = dialog.querySelector('[data-field="status"]');
            const sendButton = dialog.querySelector('[data-action="send"]');
            let cachedUsers = [];
            let usersLoaded = false;
            let selectedRecipient = null;
            documentLabelElement.textContent = detail.documentLabel || '通知单';
            docNoElement.textContent = detail.docNo;
            const inferredTaskType = this.inferTaskType(detail.iframeDoc);
            taskTypeInputs.forEach((input) => {
                input.checked = input.value === inferredTaskType;
            });

            const close = () => overlay.remove();
            const dialogCloseButton = dialog.querySelector('[data-action="close"]');
            dialogCloseButton.addEventListener('click', close);
            dialogCloseButton.addEventListener('mouseenter', () => {
                dialogCloseButton.style.backgroundColor = 'rgba(255,255,255,.15)';
            });
            dialogCloseButton.addEventListener('mouseleave', () => {
                dialogCloseButton.style.backgroundColor = 'transparent';
            });
            dialog.querySelector('[data-action="cancel"]').addEventListener('click', close);

            const getRecipientLabel = (user) => {
                const name = String(user && user.name || '').trim();
                const department = String(user && user.department || '').trim();
                return name && department
                    ? name + '（' + department + '）'
                    : String(user && user.displayName || name || '').trim();
            };

            const hideRecipientResults = () => {
                recipientResults.style.display = 'none';
            };

            const renderRecipientResults = () => {
                const keyword = recipientSearchInput.value.trim().toLocaleLowerCase('zh-CN');
                if (
                    selectedRecipient
                    && recipientSearchInput.value === getRecipientLabel(selectedRecipient)
                ) {
                    hideRecipientResults();
                    recipientHint.textContent = '';
                    return;
                }
                selectedRecipient = null;
                recipientResults.innerHTML = '';
                if (!keyword) {
                    hideRecipientResults();
                    recipientHint.textContent = '';
                    recipientHint.style.color = '#64748b';
                    return;
                }
                if (!usersLoaded) {
                    hideRecipientResults();
                    recipientHint.textContent = '';
                    recipientHint.style.color = '#64748b';
                    return;
                }

                const nameMatches = cachedUsers
                    .filter((user) => {
                        const searchable = [
                            user.name,
                            user.displayName,
                            user.department
                        ].join(' ').toLocaleLowerCase('zh-CN');
                        return searchable.includes(keyword);
                    });
                const matches = nameMatches.sort((left, right) => {
                        const leftExact = String(left.name || '').toLocaleLowerCase('zh-CN') === keyword;
                        const rightExact = String(right.name || '').toLocaleLowerCase('zh-CN') === keyword;
                        if (leftExact !== rightExact) return leftExact ? -1 : 1;
                        return getRecipientLabel(left).localeCompare(
                            getRecipientLabel(right),
                            'zh-CN'
                        );
                    });

                if (!matches.length) {
                    hideRecipientResults();
                    recipientHint.textContent = '未找到已安装3.0以上版本并开启待办接收的用户。';
                    recipientHint.style.color = '#b45309';
                    return;
                }

                matches.forEach((user) => {
                    const resultButton = document.createElement('button');
                    resultButton.type = 'button';
                    resultButton.style.cssText = [
                        'display:flex',
                        'align-items:center',
                        'justify-content:flex-start',
                        'width:100%',
                        'padding:8px 10px',
                        'border:0',
                        'border-bottom:1px solid #e2e8f0',
                        'background:#fff',
                        'color:#1f2937',
                        'cursor:pointer',
                        'font-family:Microsoft YaHei,微软雅黑,sans-serif',
                        'font-size:14px',
                        'text-align:left'
                    ].join(';');

                    const nameElement = document.createElement('span');
                    nameElement.style.cssText = 'min-width:0;overflow:hidden;font-weight:700;text-overflow:ellipsis;white-space:nowrap;';
                    nameElement.textContent = getRecipientLabel(user);

                    resultButton.appendChild(nameElement);
                    resultButton.addEventListener('mouseenter', () => {
                        resultButton.style.backgroundColor = '#eff6ff';
                    });
                    resultButton.addEventListener('mouseleave', () => {
                        resultButton.style.backgroundColor = '#fff';
                    });
                    resultButton.addEventListener('mousedown', (event) => {
                        event.preventDefault();
                    });
                    resultButton.addEventListener('click', () => {
                        selectedRecipient = user;
                        recipientSearchInput.value = getRecipientLabel(user);
                        hideRecipientResults();
                        recipientHint.textContent = '';
                    });
                    recipientResults.appendChild(resultButton);
                });
                recipientResults.style.display = 'block';
                recipientHint.textContent = '找到 ' + matches.length + ' 个可接收待办的用户，请点击选择。';
                recipientHint.style.color = '#2563eb';
            };

            recipientSearchInput.addEventListener('input', renderRecipientResults);
            recipientSearchInput.addEventListener('focus', renderRecipientResults);
            recipientSearchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') hideRecipientResults();
            });
            dialog.addEventListener('mousedown', (event) => {
                if (
                    event.target !== recipientSearchInput
                    && !recipientResults.contains(event.target)
                ) {
                    hideRecipientResults();
                }
            });

            this.getCachedUserDirectory().then((users) => {
                cachedUsers = users;
                usersLoaded = true;
                renderRecipientResults();
            }).catch((error) => {
                usersLoaded = true;
                cachedUsers = [];
                hideRecipientResults();
                recipientHint.textContent = '用户缓存读取失败：' + error.message;
                recipientHint.style.color = '#dc2626';
            });

            sendButton.addEventListener('click', () => {
                const recipientUserId = selectedRecipient && selectedRecipient.id;
                if (!recipientUserId) {
                    statusElement.textContent = '请先输入姓名，并从搜索结果中选择接收人。';
                    statusElement.style.color = '#dc2626';
                    recipientSearchInput.focus();
                    return;
                }
                const selectedTaskType = taskTypeInputs.find((input) => input.checked);
                if (!selectedTaskType) {
                    statusElement.textContent = '请选择待办类型。';
                    statusElement.style.color = '#dc2626';
                    return;
                }
                sendButton.disabled = true;
                sendButton.textContent = '发送中...';
                statusElement.textContent = '';
                const recipientDisplayName = getRecipientLabel(selectedRecipient);
                this.request('POST', '/tasks', {
                    recipientUserId,
                    docNo: detail.docNo,
                    title: detail.title,
                    url: detail.url,
                    taskType: selectedTaskType.value,
                    message: messageInput.value.trim()
                }).then(() => {
                    statusElement.textContent = '待办已发送给 ' + recipientDisplayName;
                    statusElement.style.color = '#15803d';
                    this.refreshTasks(false);
                    window.setTimeout(close, 800);
                }).catch((error) => {
                    statusElement.textContent = error.message;
                    statusElement.style.color = '#dc2626';
                    sendButton.disabled = false;
                    sendButton.textContent = '发送待办';
                });
            });
        }

        syncCompletedTasks(docNo, iframeDoc) {
            if (
                !docNo
                || !this.profile
                || this.profile.receiveTasks === false
                || !this.tasks.length
            ) return;
            const checkValue = this.extractLabelValue(iframeDoc, ['校核']);
            const approveValue = this.extractLabelValue(iframeDoc, ['批准']);
            const isCompletedValue = (value, pendingWords) => {
                const normalized = String(value || '')
                    .replace(/\u00a0/g, '')
                    .replace(/\s+/g, '')
                    .trim();
                return !!normalized && !pendingWords.some((word) =>
                    normalized.includes(String(word).replace(/\s+/g, ''))
                );
            };
            const completedTypes = new Set();
            if (isCompletedValue(checkValue, ['未校核', '待校核'])) completedTypes.add('待校核');
            if (isCompletedValue(approveValue, ['未批准', '待批准'])) completedTypes.add('待批准');
            if (!completedTypes.size) return;

            const matches = this.tasks.filter((task) =>
                task.docNo === docNo && completedTypes.has(task.taskType)
            );
            matches.forEach((task) => {
                this.request('POST', '/tasks/' + encodeURIComponent(task.id) + '/complete', {
                    source: 'original-system-status'
                }).then(() => this.refreshTasks(false)).catch((error) => {
                    console.warn('[待办] 同步完成状态失败:', error.message);
                });
            });
        }
    }

    class SearchPanel {
        constructor() {
            this.isLoading = false;
            this.panel = null;
            this.detailPanel = null; // 保留用于向后兼容
            this.detailPanels = new Map(); // 存储多个窗口，key为窗口ID，value为窗口对象
            this.detailPanelStates = new Map(); // 存储每个窗口的状态
            // 制造令分项复制只在当前页面内暂存，不上传服务器。
            this.zzlTransferBuffer = null;
            this.zzlActiveCreatePanelId = '';
            this.maxZIndex = 10001; // 当前最大z-index
            this.currentTab = 'zhiling'; // 默认制造令作为首页
            this.currentSearchContent = ''; // 当前搜索内容
            this.currentSearchType = 'default'; // 当前搜索类型
            this.isMinimized = false; // 默认展开状态（目标链接区域直接可见，无需点击放大镜）
            this.bodyOverflowState = null; // 保存body的overflow状态
            this.htmlOverflowState = null; // 保存html的overflow状态
            this.isDragging = false; // 是否正在拖拽搜索图标按钮
            // 通知单根页面每5分钟会自动刷新。该页面仅展示进入提示，
            // 不初始化搜索、待办及服务器同步服务。
            this.isNoticeRootMode = /^\/notice\/?$/i.test(
                String(window.location.pathname || '')
            );

            // 预读缓存：不同标签的“首页列表信息”解析结果
            // 用 Map 保存：tab -> parseResult；用另一个 Map 保存：tab -> inflight Promise
            this.tabDefaultContentCache = new Map();
            this.tabDefaultContentPromises = new Map();

            // 记录每个标签页上次展示的“状态”（页码/搜索类型/内容）
            this.tabLastViewState = new Map();

            // 当前展示的页码（由 displayResults() 更新）
            this.currentDisplayedPage = 1;

            // 渲染令牌：用于防止切换标签时异步请求返回覆盖新标签内容
            this.renderToken = 0;
            this.todoManager = new TodoManager(this);
        }

        getLocalDateKey(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return year + '-' + month + '-' + day;
        }

        compareScriptVersions(left, right) {
            const leftParts = String(left || '').trim().split('.');
            const rightParts = String(right || '').trim().split('.');
            const length = Math.max(leftParts.length, rightParts.length);
            for (let index = 0; index < length; index += 1) {
                const leftPart = leftParts[index] || '0';
                const rightPart = rightParts[index] || '0';
                const leftNumber = /^\d+$/.test(leftPart)
                    ? Number(leftPart)
                    : null;
                const rightNumber = /^\d+$/.test(rightPart)
                    ? Number(rightPart)
                    : null;
                if (leftNumber !== null && rightNumber !== null) {
                    if (leftNumber !== rightNumber) {
                        return leftNumber > rightNumber ? 1 : -1;
                    }
                    continue;
                }
                const result = leftPart.localeCompare(rightPart, 'zh-CN', {
                    numeric: true,
                    sensitivity: 'base'
                });
                if (result !== 0) return result > 0 ? 1 : -1;
            }
            return 0;
        }

        showScriptUpdateNotice(version) {
            const notice = this._els && this._els.updateNotice;
            const button = this._els && this._els.updateButton;
            if (!notice || !button) return;
            notice.style.setProperty('display', 'block', 'important');
            button.dataset.version = String(version || '');
            button.title = version
                ? '发现新版本 ' + version + '，点击打开更新页面'
                : '发现新版本，点击打开更新页面';
        }

        hideScriptUpdateNotice() {
            const notice = this._els && this._els.updateNotice;
            if (notice) notice.style.setProperty('display', 'none', 'important');
        }

        openScriptUpdatePage() {
            const separator = SCRIPT_UPDATE_URL.includes('?') ? '&' : '?';
            window.open(
                SCRIPT_UPDATE_URL + separator + '_jzt_update=' + Date.now(),
                '_blank',
                'noopener,noreferrer'
            );
        }

        initDailyScriptUpdateCheck() {
            const cachedVersion = String(GM_getValue(
                SCRIPT_UPDATE_AVAILABLE_VERSION_KEY,
                ''
            ) || '').trim();
            if (
                cachedVersion
                && this.compareScriptVersions(
                    cachedVersion,
                    TODO_CLIENT_VERSION
                ) > 0
            ) {
                this.showScriptUpdateNotice(cachedVersion);
            } else {
                this.hideScriptUpdateNotice();
            }

            const today = this.getLocalDateKey();
            if (GM_getValue(SCRIPT_UPDATE_LAST_CHECK_DATE_KEY, '') === today) {
                return;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: SCRIPT_UPDATE_URL + '?_jzt_check=' + Date.now(),
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                timeout: 15000,
                onload: (response) => {
                    if (response.status < 200 || response.status >= 300) return;
                    const source = String(response.responseText || '');
                    const versionMatch = source.match(
                        /^\s*\/\/\s*@version\s+([^\s]+)\s*$/m
                    );
                    if (!versionMatch) return;
                    const remoteVersion = versionMatch[1].trim();
                    GM_setValue(SCRIPT_UPDATE_LAST_CHECK_DATE_KEY, today);
                    if (
                        this.compareScriptVersions(
                            remoteVersion,
                            TODO_CLIENT_VERSION
                        ) > 0
                    ) {
                        GM_setValue(
                            SCRIPT_UPDATE_AVAILABLE_VERSION_KEY,
                            remoteVersion
                        );
                        this.showScriptUpdateNotice(remoteVersion);
                    } else {
                        GM_setValue(SCRIPT_UPDATE_AVAILABLE_VERSION_KEY, '');
                        this.hideScriptUpdateNotice();
                    }
                },
                onerror: () => {},
                ontimeout: () => {}
            });
        }

        create() {
            if (this.panel) return;

            // 从 localStorage 加载保存的搜索按钮位置
            const savedPanelState = this.loadPanelState();
            const defaultTop = 50;
            const defaultLeft = 50;

            const panel = document.createElement('div');
            panel.id = 'jigui-float-panel';
            if (this.isNoticeRootMode) {
                panel.classList.add('jzt-notice-root-mode');
            }
            panel.style.cssText = `
                position: fixed !important;
                top: ${savedPanelState ? savedPanelState.top : defaultTop}px !important;
                left: ${savedPanelState ? savedPanelState.left : defaultLeft}px !important;
                width: 60px !important;
                height: 60px !important;
                background: #0066cc !important;
                border: 1px solid #2563eb !important;
                border-radius: 50% !important;
                box-shadow: 0 12px 28px rgba(37, 99, 235, 0.28) !important;
                z-index: 99999 !important;
                display: flex !important;
                flex-direction: column !important;
                font-family: "Microsoft YaHei", "微软雅黑", sans-serif !important;
                cursor: pointer !important;
                align-items: center !important;
                justify-content: center !important;
                transition: none !important;
                visibility: visible !important;
                opacity: 1 !important;
            `;

            panel.innerHTML = `
                <div id="search-icon-btn" style="font-size: 28px; color: white; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">🔍</div>
                <div id="panel-header" style="background: #0066cc; color: white; padding: 10px; border-radius: 6px 6px 0 0; display: none; justify-content: space-between; align-items: center; cursor: move;">
                    <span style="font-weight: bold; line-height: 1;">🔍 搜索工具</span>
                    <div style="display: flex; align-items: center; gap: 0; height: 100%;">
                        <button id="minimize-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; font-size: 14px; font-weight: 400; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; margin-right: 8px; transition: background-color 0.2s; line-height: 1;">─</button>
                        <button id="maximize-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; margin-right: 8px; transition: background-color 0.2s; line-height: 1;">⛶</button>
                        <button id="close-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; font-size: 16px; font-weight: 400; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; transition: background-color 0.2s; line-height: 1;">×</button>
                    </div>
                </div>
                <div id="jigui-panel-content" style="display: none; flex: 1; border: none; border-right: 2px solid #0066cc; border-bottom: 2px solid #0066cc; background: #fff5e6; overflow: hidden;">
                    <div id="jigui-left-column">
                        <div id="jzt-search-section">
                        <div id="jigui-tabs" style="display: none; border-bottom: 2px solid #0066cc; background: #f5f5f5; height: 40px; align-items: center; position: relative; z-index: 10; overflow: hidden;">
                            <button class="tab-btn active" data-tab="zhiling" style="width: 240px; height: 40px; padding: 0; margin: 0; background: #6a85b0; color: white; border: none; border-right: 1px solid #909090; cursor: pointer; font-weight: 600; font-size: 18px; line-height: 1; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;">制造令</button>
                            <button class="tab-btn" data-tab="jigui" style="width: 240px; height: 40px; padding: 0; margin: 0; background: #a3b4d0; color: white; border: none; border-right: 1px solid #909090; cursor: pointer; font-weight: 500; font-size: 16px; line-height: 1; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;">机规</button>
                            <button class="tab-btn" data-tab="tongzhi" style="width: 240px; height: 40px; padding: 0; margin: 0; background: #a3b4d0; color: white; border: none; cursor: pointer; font-weight: 500; font-size: 16px; line-height: 1; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;">通知单</button>
                        </div>
                        <div id="search-control-panel" style="width: 239px; padding: 20px 0 0 0; margin: 0; background: #fff5e6; border-right: 2px solid #0066cc; display: flex; flex-direction: column; gap: 16px; box-sizing: content-box;">
                        <div id="search-options-container" style="display: flex; flex-direction: column; gap: 12px; padding: 0 20px;">
                            <!-- 制造令单选按钮 -->
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="zhiling-gonghao" name="zhiling-search-type" value="gonghao" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按工号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="zhiling-user" name="zhiling-search-type" value="user" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按用户</span>
                            </label>
                            <!-- 机规单选按钮 -->
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="jigui-gonghao" name="jigui-search-type" value="gonghao" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按工号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="jigui-number" name="jigui-search-type" value="number" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按编号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="jigui-picname" name="jigui-search-type" value="picname" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按部件名称</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="jigui-writename" name="jigui-search-type" value="writename" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按创建人</span>
                            </label>
                            <!-- 通知单单选按钮 -->
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="tongzhi-product-gonghao" name="tongzhi-search-type" value="product_gonghao" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按工号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="tongzhi-number" name="tongzhi-search-type" value="number" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按编号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="tongzhi-service-gonghao" name="tongzhi-search-type" value="service_gonghao" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按服务订单工号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="tongzhi-picname" name="tongzhi-search-type" value="picname" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按部件名称</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="tongzhi-writename" name="tongzhi-search-type" value="writename" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按创建人</span>
                            </label>
                        </div>
                        <div style="padding: 0 20px;">
                            <input type="text" id="search-content" placeholder="" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 15px;">
                        </div>
                        <div id="search-btn-wrapper" style="padding: 0 20px;">
                            <button id="search-btn" style="width: 100%; padding: 12px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;">搜　索</button>
                        </div>
                        <div id="create-jigui-btn-wrapper" style="padding: 0 20px; padding-bottom: 20px; display: none;">
                            <button id="create-jigui-btn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;">创建机规</button>
                        </div>
                        <div id="create-tongzhi-btn-wrapper" style="padding: 0 20px; padding-bottom: 20px; display: none;">
                            <button id="create-tongzhi-btn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;">创建通知单</button>
                        </div>
                    </div>
                        </div>
                        <div id="jzt-update-notice">
                            <button id="jzt-update-button" type="button" title="发现新版本，点击打开更新页面">
                                <span class="jzt-update-prefix">有新版本，</span>
                                <span class="jzt-update-action">点击更新</span>
                            </button>
                        </div>
                        <div id="jzt-todo-panel">
                            <div id="jzt-todo-list"></div>
                        </div>
                        <div id="jzt-profile-card">
                            <div style="min-width:0;flex:1 1 auto;">
                                <div id="jzt-todo-user">待办身份未设置</div>
                                <div id="jzt-todo-department">请点击右侧设置</div>
                            </div>
                            <button id="jzt-todo-settings" type="button" title="修改姓名、部门和待办接收设置">⚙</button>
                        </div>
                    </div>
                    <div id="search-result-area" style="flex: 1; padding: 20px; background: #fff5e6; overflow: hidden; display: flex; flex-direction: column; min-height: 0; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">
                        <div id="maximized-minimize-only" style="position: absolute; top: 12px; right: 12px; transform: none; z-index: 100100; display: none;">
                            <button id="maximized-minimize-btn" style="width: 28px; height: 28px; background: #dc3545; border: 2px solid #c82333; color: white; cursor: pointer; font-size: 20px; font-weight: bold; padding: 0; border-radius: 4px; box-shadow: none; display: flex; align-items: center; justify-content: center;">−</button>
                        </div>
                        <div id="search-result" style="flex: 1; color: #666; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; font-size: 18px; overflow: auto; min-height: 0; writing-mode: horizontal-tb; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">
                            <div style="color: #0066cc; text-align: center; font-size: 20px; margin-top: 10px; font-family: &quot;Microsoft YaHei&quot;, &quot;微软雅黑&quot;, sans-serif !important;">正在加载页面信息...</div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);
            this.panel = panel;

            if (this.isNoticeRootMode) {
                const modeStyle = document.createElement('style');
                modeStyle.textContent = `
                    #jigui-float-panel.jzt-notice-root-mode #jigui-tabs,
                    #jigui-float-panel.jzt-notice-root-mode #jigui-left-column {
                        display: none !important;
                    }
                    #jigui-float-panel.jzt-notice-root-mode #jigui-panel-content {
                        grid-template-columns: minmax(0, 1fr) !important;
                        width: 100% !important;
                    }
                    #jigui-float-panel.jzt-notice-root-mode #search-result-area {
                        grid-column: 1 / -1 !important;
                        width: 100% !important;
                        height: 100% !important;
                        min-width: 0 !important;
                        padding: 0 !important;
                        border: 0 !important;
                        background: #fff5e6 !important;
                        box-sizing: border-box !important;
                    }
                    #jigui-float-panel.jzt-notice-root-mode #search-result {
                        width: 100% !important;
                        height: 100% !important;
                        flex: 1 1 auto !important;
                        align-items: center !important;
                        justify-content: center !important;
                        overflow: hidden !important;
                        color: #222 !important;
                        font-family: "Microsoft YaHei", "微软雅黑", sans-serif !important;
                    }
                `;
                document.head.appendChild(modeStyle);
            }

            // 缓存常用 DOM 元素，减少重复 querySelector
            this._els = {
                searchResult: panel.querySelector('#search-result'),
                searchResultArea: panel.querySelector('#search-result-area'),
                searchContent: panel.querySelector('#search-content'),
                searchBtn: panel.querySelector('#search-btn'),
                createJiguiBtn: panel.querySelector('#create-jigui-btn'),
                createJiguiBtnWrapper: panel.querySelector('#create-jigui-btn-wrapper'),
                createTongzhiBtn: panel.querySelector('#create-tongzhi-btn'),
                createTongzhiBtnWrapper: panel.querySelector('#create-tongzhi-btn-wrapper'),
                panelHeader: panel.querySelector('#panel-header'),
                jiguiTabs: panel.querySelector('#jigui-tabs'),
                jiguiPanelContent: panel.querySelector('#jigui-panel-content'),
                searchIconBtn: panel.querySelector('#search-icon-btn'),
                closeBtn: panel.querySelector('#close-btn'),
                minimizeBtn: panel.querySelector('#minimize-btn'),
                maximizeBtn: panel.querySelector('#maximize-btn'),
                maximizedMinimizeBtn: panel.querySelector('#maximized-minimize-btn'),
                searchOptionsContainer: panel.querySelector('#search-options-container'),
                updateNotice: panel.querySelector('#jzt-update-notice'),
                updateButton: panel.querySelector('#jzt-update-button'),
                todoList: panel.querySelector('#jzt-todo-list'),
                todoUser: panel.querySelector('#jzt-todo-user'),
                todoDepartment: panel.querySelector('#jzt-todo-department'),
                todoSettings: panel.querySelector('#jzt-todo-settings')
            };

            // 确保面板显示
            this.panel.style.setProperty('display', 'flex', 'important');
            this.panel.style.setProperty('visibility', 'visible', 'important');
            this.panel.style.setProperty('opacity', '1', 'important');

            const searchIconBtn = this._els.searchIconBtn;
            const content = this._els.jiguiPanelContent;
            const tabs = this._els.jiguiTabs;
            const header = this._els.panelHeader;

            if (this.isNoticeRootMode && this._els.searchResult) {
                this._els.searchResult.innerHTML = `
                    <div style="
                        display:flex;
                        width:100%;
                        height:100%;
                        align-items:center;
                        justify-content:center;
                        color:#222;
                        font-family:'Microsoft YaHei','微软雅黑',sans-serif;
                        font-size:28px;
                        font-weight:400;
                        text-align:center;
                        white-space:nowrap;
                    ">
                        <span>请从</span>
                        <a href="http://10.16.88.34/zzl/"
                           target="_blank"
                           rel="noopener noreferrer"
                           style="
                               color:#0066cc;
                               font-size:38px;
                               font-weight:700;
                               line-height:1;
                               text-decoration:underline;
                               text-underline-offset:4px;
                           ">制造令</a>
                        <span>或</span>
                        <a href="http://10.16.88.34/jigui/"
                           target="_blank"
                           rel="noopener noreferrer"
                           style="
                               color:#0066cc;
                               font-size:38px;
                               font-weight:700;
                               line-height:1;
                               text-decoration:underline;
                               text-underline-offset:4px;
                           ">机规</a>
                        <span>进入此工具</span>
                    </div>
                `;
            }

            if (this.isMinimized) {
                // 最小化状态：显示搜索图标按钮，隐藏其他内容
                if (searchIconBtn) {
                    searchIconBtn.style.setProperty('display', 'flex', 'important');
                    searchIconBtn.style.setProperty('visibility', 'visible', 'important');
                    searchIconBtn.style.setProperty('opacity', '1', 'important');
                }
                if (content) content.style.display = 'none';
                if (tabs) tabs.style.display = 'none';
                if (header) header.style.display = 'none';
            } else {
                // 非最小化状态：隐藏搜索图标按钮，显示其他内容，并应用展开尺寸
                if (searchIconBtn) searchIconBtn.style.display = 'none';
                if (content) content.style.display = 'flex';
                if (tabs) tabs.style.display = 'flex';
                if (header) header.style.display = 'flex';
                this.panel.style.setProperty('width', '1200px', 'important');
                this.panel.style.setProperty('height', '700px', 'important');
                this.panel.style.setProperty('border-radius', '0', 'important');
                this.panel.style.setProperty('border-top', 'none', 'important');
                this.panel.style.setProperty('cursor', 'default', 'important');
                this.panel.style.setProperty('background', '#f8fafc', 'important');
            }

            this.attachEventListeners();
            this.makeDraggable();
            if (!this.isNoticeRootMode) {
                this.initTabs();
                this.initDailyScriptUpdateCheck();
                this.todoManager.init();
                if (this._els.todoSettings) {
                    this._els.todoSettings.addEventListener('click', () => {
                        if (this.todoManager.profile) {
                            this.todoManager.openIdentityDialog(false);
                        } else {
                            this.todoManager.openIdentityDialog(true);
                        }
                    });
                }
            }

            // 默认展开且最大化显示
            if (!this.isMinimized) {
                this.toggleMaximize();
            }

            // 监听页面卸载，保存搜索按钮位置
            window.addEventListener('beforeunload', () => {
                this.savePanelState();
            });

            // 移除自动加载首页的逻辑，改为仅在用户切换标签页时加载
            // 如果需要根据当前页面路径自动加载对应模块的首页，可以取消下面的注释
            // const path = (typeof location !== 'undefined' && location.pathname) || '';
            // if (/^\/jigui\/?$/.test(path)) {
            //     this.loadTabDefaultContent('jigui');
            // } else if (/^\/zzl\/?$/.test(path)) {
            //     this.loadTabDefaultContent('zhiling');
            // } else if (/^\/notice\/?$/.test(path)) {
            //     this.loadTabDefaultContent('tongzhi');
            // }
        }

        initTabs() {
            // 默认制造令作为首页
            this.updateSearchOptions('zhiling');
            this.loadTabDefaultContent('zhiling');

            // 后台预读：机规/通知单首页列表，保证切换标签时可直接渲染
            this.prefetchTabDefaultContent('jigui');
            this.prefetchTabDefaultContent('tongzhi');

            // 绑定标签切换事件
            const tabButtons = this.panel.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.getAttribute('data-tab');
                    // 再次点击当前激活标签：切回该标签的主页列表界面
                    if (tab === this.currentTab) {
                        const selectedSearchType = this.getSelectedSearchTypeForTab(tab) || 'default';
                        // 保留当前单选框选择，但首页数据强制刷新（绕过缓存）
                        this.updateSearchOptions(tab, selectedSearchType);
                        this.loadTabDefaultContent(tab, {
                            forceRefresh: true,
                            preserveSearchType: selectedSearchType
                        });
                        return;
                    }
                    this.switchTab(tab);
                });
            });
        }

        switchTab(tab) {
            const prevTab = this.currentTab;
            const prevSelectedType = prevTab ? this.getSelectedSearchTypeForTab(prevTab) : null;
            if (prevTab) this.saveTabViewState(prevTab);

            this.currentTab = tab;

            // 更新标签按钮样式（使用统一色调，点击时颜色加深、字体放大）
            const tabButtons = this.panel.querySelectorAll('.tab-btn');
            const baseColor = '#ffffff';
            const inactiveColor = 'transparent';

            tabButtons.forEach(btn => {
                const btnTab = btn.getAttribute('data-tab');
                if (btnTab === tab) {
                    btn.classList.add('active');
                    btn.style.background = baseColor;
                    btn.style.color = '#2563eb';
                    btn.style.fontWeight = '800';
                    btn.style.fontSize = '18px';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = inactiveColor;
                    btn.style.color = '#64748b';
                    btn.style.fontWeight = '400';
                    btn.style.fontSize = '16px';
                }
            });

            const state = this.tabLastViewState.get(tab);
            const normalizedPrevType = this.normalizeCrossTabSearchType(prevTab, prevSelectedType);
            const mappedSearchType = this.mapSearchTypeToTab(tab, normalizedPrevType);
            const searchTypeOverride = mappedSearchType || (state && state.searchType ? state.searchType : 'default');
            this.updateSearchOptions(tab, searchTypeOverride);
            this.restoreTabView(tab);
        }

        // 保存离开当前标签时的展示状态
        saveTabViewState(tab) {
            if (!tab) return;
            const previous = this.tabLastViewState.get(tab) || {};
            this.tabLastViewState.set(tab, {
                searchContent: this.currentSearchContent || '',
                searchType: this.currentSearchType || 'default',
                pageNum: this.currentDisplayedPage || 1,
                parseResult: previous.parseResult ? this.cloneParseResult(previous.parseResult) : null
            });
        }

        // 切回标签时恢复上次展示的最后页面
        restoreTabView(tab) {
            const state = this.tabLastViewState.get(tab);
            if (!state) {
                this.showTabLoadingMessage();
                this.loadTabDefaultContent(tab);
                return;
            }

            const pageNum = state.pageNum || 1;
            const searchType = state.searchType || 'default';
            const searchContent = state.searchContent || '';
            const hasRealSearchState = !!(searchContent || state.parseResult || (searchType !== 'default' && pageNum !== 1));

            // 优先使用缓存快照直接渲染，避免切换标签时重新请求造成卡顿
            if (state.parseResult) {
                const cached = this.cloneParseResult(state.parseResult);
                cached.currentPage = pageNum;
                this.displayResults(cached, searchType, searchContent);
                return;
            }

            // 默认列表第一页走缓存渲染，其他情况走 loadPage 统一逻辑
            if (!hasRealSearchState || (searchType === 'default' && pageNum === 1)) {
                this.showTabLoadingMessage();
                this.loadTabDefaultContent(tab);
            } else {
                this.showTabLoadingMessage();
                this.loadPage(searchContent, searchType, pageNum);
            }
        }

        showTabLoadingMessage() {
            const resultDiv = this._els && this._els.searchResult;
            if (!resultDiv) return;
            resultDiv.style.display = 'flex';
            resultDiv.style.flexDirection = 'column';
            resultDiv.style.alignItems = 'center';
            resultDiv.style.justifyContent = 'flex-start';
            resultDiv.style.textAlign = 'center';
            resultDiv.innerHTML = '<div style="color: #0066cc; text-align: center; font-size: 20px; margin-top: 10px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">正在加载页面信息...</div>';
        }

        cloneParseResult(parseResult) {
            if (!parseResult) return null;
            const headers = Array.isArray(parseResult.headers) ? parseResult.headers.slice() : [];
            const rows = Array.isArray(parseResult.rows)
                ? parseResult.rows.map(row => Array.isArray(row)
                    ? row.map(cell => {
                        if (cell && typeof cell === 'object') return Object.assign({}, cell);
                        return cell;
                    })
                    : [])
                : [];
            return {
                headers: headers,
                rows: rows,
                totalPages: parseResult.totalPages || 1,
                totalCount: parseResult.totalCount || rows.length,
                pageSize: parseResult.pageSize || 0,
                currentPage: parseResult.currentPage || 1,
                sourceTab: parseResult.sourceTab || null
            };
        }

        getSelectedSearchTypeForTab(tab) {
            if (!this.panel || !tab) return null;
            const selected = this.panel.querySelector('input[name="' + tab + '-search-type"]:checked');
            return selected ? selected.value : null;
        }

        normalizeCrossTabSearchType(tab, searchType) {
            if (!searchType) return null;
            if (tab === 'tongzhi' && searchType === 'product_gonghao') return 'gonghao';
            if (searchType === 'gonghao' || searchType === 'picname' || searchType === 'writename') return searchType;
            return null;
        }

        mapSearchTypeToTab(tab, normalizedType) {
            if (!normalizedType) return null;
            if (normalizedType === 'gonghao') {
                if (tab === 'tongzhi') return 'product_gonghao';
                if (tab === 'zhiling' || tab === 'jigui') return 'gonghao';
            }
            if (normalizedType === 'picname') {
                if (tab === 'jigui' || tab === 'tongzhi') return 'picname';
            }
            if (normalizedType === 'writename') {
                if (tab === 'jigui' || tab === 'tongzhi') return 'writename';
            }
            return null;
        }

        updateSearchOptions(tab, searchTypeOverride) {
            // 获取所有单选按钮元素
            const zhilingGonghao = this.panel.querySelector('#zhiling-gonghao');
            const zhilingUser = this.panel.querySelector('#zhiling-user');
            const jiguiGonghao = this.panel.querySelector('#jigui-gonghao');
            const jiguiNumber = this.panel.querySelector('#jigui-number');
            const jiguiPicname = this.panel.querySelector('#jigui-picname');
            const jiguiWritename = this.panel.querySelector('#jigui-writename');
            const tongzhiNumber = this.panel.querySelector('#tongzhi-number');
            const tongzhiProductGonghao = this.panel.querySelector('#tongzhi-product-gonghao');
            const tongzhiServiceGonghao = this.panel.querySelector('#tongzhi-service-gonghao');
            const tongzhiPicname = this.panel.querySelector('#tongzhi-picname');
            const tongzhiWritename = this.panel.querySelector('#tongzhi-writename');

            const override = searchTypeOverride || 'default';

            // 重置所有单选按钮
            const allRadios = [
                zhilingGonghao, zhilingUser,
                jiguiGonghao, jiguiNumber, jiguiPicname, jiguiWritename,
                tongzhiNumber, tongzhiProductGonghao, tongzhiServiceGonghao, tongzhiPicname, tongzhiWritename
            ];
            allRadios.forEach(radio => {
                if (radio) {
                    radio.checked = false;
                    radio.parentElement.style.display = 'none';
                }
            });

            // 根据当前标签页显示/隐藏相应的选项
            if (tab === 'zhiling') {
                // 制造令：显示"按工号"和"按用户"（单选按钮）
                if (zhilingGonghao) {
                    zhilingGonghao.parentElement.style.display = 'flex';
                    zhilingGonghao.checked = (override === 'default' || override === 'gonghao');
                }
                if (zhilingUser) {
                    zhilingUser.parentElement.style.display = 'flex';
                    zhilingUser.checked = (override === 'user');
                }
            } else if (tab === 'jigui') {
                // 机规：显示"按工号"、"按编号"、"按部件名称"、"按创建人"（单选按钮）
                if (jiguiGonghao) {
                    jiguiGonghao.parentElement.style.display = 'flex';
                    jiguiGonghao.checked = (override === 'default' || override === 'gonghao');
                }
                if (jiguiNumber) jiguiNumber.parentElement.style.display = 'flex';
                if (jiguiPicname) jiguiPicname.parentElement.style.display = 'flex';
                if (jiguiWritename) jiguiWritename.parentElement.style.display = 'flex';

                if (jiguiNumber) jiguiNumber.checked = (override === 'number');
                if (jiguiPicname) jiguiPicname.checked = (override === 'picname');
                if (jiguiWritename) jiguiWritename.checked = (override === 'writename');
            } else if (tab === 'tongzhi') {
                // 通知单：显示所有单选按钮
                if (tongzhiNumber) {
                    tongzhiNumber.parentElement.style.display = 'flex';
                    tongzhiNumber.checked = (override === 'number');
                }
                if (tongzhiProductGonghao) {
                    tongzhiProductGonghao.parentElement.style.display = 'flex';
                    tongzhiProductGonghao.checked = (override === 'default' || override === 'product_gonghao');
                }
                if (tongzhiServiceGonghao) {
                    tongzhiServiceGonghao.parentElement.style.display = 'flex';
                    tongzhiServiceGonghao.checked = (override === 'service_gonghao');
                }
                if (tongzhiPicname) {
                    tongzhiPicname.parentElement.style.display = 'flex';
                    tongzhiPicname.checked = (override === 'picname');
                }
                if (tongzhiWritename) {
                    tongzhiWritename.parentElement.style.display = 'flex';
                    tongzhiWritename.checked = (override === 'writename');
                }
            }
            this.updateCreateButtonVisibility(tab);
        }

        updateCreateButtonVisibility(tab = this.currentTab) {
            const showCreateButtons = GM_getValue(TODO_SHOW_CREATE_BUTTONS_KEY, true) !== false;
            const createJiguiWrapper = this._els && this._els.createJiguiBtnWrapper;
            const createTongzhiWrapper = this._els && this._els.createTongzhiBtnWrapper;

            if (createJiguiWrapper) {
                createJiguiWrapper.style.display = showCreateButtons && tab === 'jigui'
                    ? 'block'
                    : 'none';
            }
            if (createTongzhiWrapper) {
                createTongzhiWrapper.style.display = showCreateButtons && tab === 'tongzhi'
                    ? 'block'
                    : 'none';
            }
        }

        attachEventListeners() {
            const searchBtn = this._els.searchBtn;
            const closeBtn = this._els.closeBtn;
            const minimizeBtn = this._els.minimizeBtn;
            const maximizeBtn = this._els.maximizeBtn;
            const searchInput = this._els.searchContent;
            const searchIconBtn = this._els.searchIconBtn;
            const maximizedMinimizeBtn = this._els.maximizedMinimizeBtn;
            const updateButton = this._els.updateButton;

            if (searchBtn) {
                searchBtn.addEventListener('click', () => this.performSearch());
            }
            if (updateButton) {
                updateButton.addEventListener('click', () => {
                    this.openScriptUpdatePage();
                });
            }
            const createJiguiBtn = this._els.createJiguiBtn;
            if (createJiguiBtn) {
                createJiguiBtn.addEventListener('click', () => {
                    this.openDetailPanel('http://10.16.88.34/jigui/createnote.asp', '创建机规');
                });
            }
            const createTongzhiBtn = this._els.createTongzhiBtn;
            if (createTongzhiBtn) {
                createTongzhiBtn.addEventListener('click', () => {
                    this.openDetailPanel('http://10.16.88.34/notice/createnote.asp', '创建通知单');
                });
            }
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closePanel());
                closeBtn.addEventListener('mouseenter', () => {
                    closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                });
                closeBtn.addEventListener('mouseleave', () => {
                    closeBtn.style.backgroundColor = 'transparent';
                });
            }
            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', () => this.toggleMinimize());
                minimizeBtn.addEventListener('mouseenter', () => {
                    minimizeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                });
                minimizeBtn.addEventListener('mouseleave', () => {
                    minimizeBtn.style.backgroundColor = 'transparent';
                });
            }
            if (maximizeBtn) {
                maximizeBtn.addEventListener('click', () => this.toggleMaximize());
                maximizeBtn.addEventListener('mouseenter', () => {
                    maximizeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                });
                maximizeBtn.addEventListener('mouseleave', () => {
                    maximizeBtn.style.backgroundColor = 'transparent';
                });
            }
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.performSearch();
                });
            }
            // 点击搜索图标按钮时，如果是最小化状态，则最大化
            if (searchIconBtn) {
                searchIconBtn.addEventListener('click', (e) => {
                    if (this.isDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    if (this.isMinimized) {
                        this.toggleMaximize();
                    }
                });
            }
            if (maximizedMinimizeBtn) {
                maximizedMinimizeBtn.addEventListener('click', () => {
                    this.toggleMinimize();
                });
                maximizedMinimizeBtn.addEventListener('mouseenter', () => {
                    maximizedMinimizeBtn.style.background = '#c82333';
                });
                maximizedMinimizeBtn.addEventListener('mouseleave', () => {
                    maximizedMinimizeBtn.style.background = '#dc3545';
                });
            }

            // 搜索结果区事件委托：一次绑定，处理详情链接、分页链接、Goto 按钮
            const resultContainer = this._els.searchResultArea;
            if (resultContainer) {
                resultContainer.addEventListener('click', (e) => {
                    const link = e.target.closest('.jigui-detail-link');
                    if (link) {
                        e.preventDefault();
                        e.stopPropagation();
                        const href = link.getAttribute('data-href') || link.href;
                        const sourceTab = link.getAttribute('data-source-tab') || null;
                        const linkText = link.textContent || link.innerText || '';
                        if (href) this.openDetailPanel(href, linkText, sourceTab);
                        return;
                    }
                    const pageLink = e.target.closest('.jigui-page-link');
                    if (pageLink) {
                        e.preventDefault();
                        const page = parseInt(pageLink.getAttribute('data-page'), 10);
                        if (!isNaN(page)) {
                            this.loadPage(this.currentSearchContent || '', this.currentSearchType || 'default', page);
                        }
                        return;
                    }
                    const gotoBtn = e.target.closest('.jigui-goto-btn');
                    if (gotoBtn) {
                        e.preventDefault();
                        const paginationDiv = resultContainer.querySelector('.jigui-pagination');
                        const gotoInput = paginationDiv && paginationDiv.querySelector('.jigui-goto-page');
                        const totalPagesMatch = paginationDiv && (paginationDiv.textContent || '').match(/\/\s*(\d+)\s*页/);
                        const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 1;
                        if (gotoInput) {
                            const page = parseInt(gotoInput.value, 10);
                            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                                this.loadPage(this.currentSearchContent || '', this.currentSearchType || 'default', page);
                            } else {
                                alert('请输入有效的页码（1-' + totalPages + '）');
                                const curMatch = (paginationDiv && paginationDiv.textContent) ? paginationDiv.textContent.match(/页次[：:]\s*(\d+)/) : null;
                                gotoInput.value = curMatch ? curMatch[1] : 1;
                            }
                        }
                        return;
                    }
                });
                resultContainer.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && e.target.classList.contains('jigui-goto-page')) {
                        e.preventDefault();
                        const page = parseInt(e.target.value, 10);
                        const paginationDiv = resultContainer.querySelector('.jigui-pagination');
                        const totalPagesMatch = paginationDiv && (paginationDiv.textContent || '').match(/\/\s*(\d+)\s*页/);
                        const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 1;
                        if (!isNaN(page) && page >= 1 && page <= totalPages) {
                            this.loadPage(this.currentSearchContent || '', this.currentSearchType || 'default', page);
                        } else {
                            alert('请输入有效的页码（1-' + totalPages + '）');
                        }
                    }
                });
            }

            this.updateMainButtons();
        }

        makeDraggable() {
            const header = this._els.panelHeader;
            const searchIconBtn = this._els.searchIconBtn;
            const content = this._els.jiguiPanelContent;
            const tabs = this._els.jiguiTabs;
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            // 标题栏拖拽
            if (header) {
                header.onmousedown = (e) => {
                    if (e.target.closest('button')) return;
                    if (this.panel.classList.contains('maximized')) return;
                    if (this.isMinimized) return;
                    e.preventDefault();
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    let contentVisibility = '';
                    let tabsVisibility = '';

                    // 用 visibility 隐藏代替 display:none，避免从布局移除导致滚动位置丢失
                    if (content) {
                        contentVisibility = content.style.visibility || '';
                        content.style.setProperty('visibility', 'hidden', 'important');
                    }
                    if (tabs) {
                        tabsVisibility = tabs.style.visibility || '';
                        tabs.style.setProperty('visibility', 'hidden', 'important');
                    }

                    document.onmouseup = () => {
                        document.onmousemove = null;
                        document.onmouseup = null;

                        if (content && contentVisibility !== undefined) {
                            content.style.setProperty('visibility', contentVisibility || 'visible', 'important');
                        }
                        if (tabs && tabsVisibility !== undefined) {
                            tabs.style.setProperty('visibility', tabsVisibility || 'visible', 'important');
                        }

                        this.savePanelState();
                    };
                    document.onmousemove = (e) => {
                        e.preventDefault();
                        pos1 = pos3 - e.clientX;
                        pos2 = pos4 - e.clientY;
                        pos3 = e.clientX;
                        pos4 = e.clientY;
                        const margin = 8;
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        const pw = this.panel.offsetWidth;
                        const ph = this.panel.offsetHeight;
                        let newTop = this.panel.offsetTop - pos2;
                        let newLeft = this.panel.offsetLeft - pos1;
                        newTop = Math.max(margin, Math.min(h - ph - margin, newTop));
                        newLeft = Math.max(margin, Math.min(w - pw - margin, newLeft));
                        this.panel.style.top = newTop + 'px';
                        this.panel.style.left = newLeft + 'px';
                    };
                };
            }

            // 搜索图标按钮拖拽（最小化状态时）
            if (searchIconBtn) {
                let dragStartX = 0;
                let dragStartY = 0;
                let hasMoved = false;

                searchIconBtn.onmousedown = (e) => {
                    if (!this.isMinimized) return;
                    e.preventDefault();
                    e.stopPropagation(); // 阻止触发点击事件

                    // 记录拖拽开始位置
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    hasMoved = false;
                    this.isDragging = false;

                    pos3 = e.clientX;
                    pos4 = e.clientY;

                    document.onmouseup = (e) => {
                        document.onmousemove = null;
                        document.onmouseup = null;

                        // 如果发生了移动，认为是拖拽，保存位置
                        if (hasMoved) {
                            this.savePanelState();
                        }

                        // 延迟重置标志，确保 click 事件能正确判断
                        setTimeout(() => {
                            this.isDragging = false;
                            hasMoved = false;
                        }, 10);
                    };

                    document.onmousemove = (e) => {
                        e.preventDefault();

                        // 计算移动距离
                        const moveX = Math.abs(e.clientX - dragStartX);
                        const moveY = Math.abs(e.clientY - dragStartY);

                        // 如果移动距离超过5px，认为是拖拽
                        if (moveX > 5 || moveY > 5) {
                            hasMoved = true;
                            this.isDragging = true;
                        }

                        pos1 = pos3 - e.clientX;
                        pos2 = pos4 - e.clientY;
                        pos3 = e.clientX;
                        pos4 = e.clientY;
                        const margin = 8;
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        const pw = this.panel.offsetWidth;
                        const ph = this.panel.offsetHeight;
                        let newTop = this.panel.offsetTop - pos2;
                        let newLeft = this.panel.offsetLeft - pos1;
                        newTop = Math.max(margin, Math.min(h - ph - margin, newTop));
                        newLeft = Math.max(margin, Math.min(w - pw - margin, newLeft));
                        this.panel.style.top = newTop + 'px';
                        this.panel.style.left = newLeft + 'px';
                    };
                };
            }
        }

        toggleMinimize() {
            this.panel.style.transition = 'none';
            const content = this._els.jiguiPanelContent;
            const tabs = this._els.jiguiTabs;
            const header = this._els.panelHeader;
            const searchIconBtn = this._els.searchIconBtn;

            if (this.isMinimized) {
                // 恢复显示
                this.isMinimized = false;

                if (content) {
                    content.style.display = 'flex';
                    content.style.flexDirection = 'row';
                }
                if (tabs) {
                    tabs.style.display = 'flex';
                    tabs.style.flexDirection = 'row';
                    tabs.style.alignItems = 'center';
                    tabs.style.height = '40px';
                }
                if (header) header.style.display = 'flex';
                if (searchIconBtn) searchIconBtn.style.display = 'none';

                // 恢复窗口大小
                this.panel.style.width = '1200px';
                this.panel.style.height = '700px';
                this.panel.style.borderRadius = '8px';
                this.panel.style.cursor = 'default';
                this.panel.style.background = '#f8fafc';

                // 更新按钮图标为窗口化状态（最大化图标）
                this.updateMainButtons();
            } else {
                // 最小化：如果当前是最大化状态，先恢复窗口大小
                if (this.panel.classList.contains('maximized')) {
                    this.toggleMaximize();
                }

                this.isMinimized = true;
                if (content) content.style.display = 'none';
                if (tabs) tabs.style.display = 'none';
                if (header) header.style.display = 'none';
                if (searchIconBtn) searchIconBtn.style.display = 'flex';

                // 隐藏最大化状态下的最小化按钮
                const maximizedMinimizeOnly = this.panel.querySelector('#maximized-minimize-only');
                if (maximizedMinimizeOnly) {
                    maximizedMinimizeOnly.style.display = 'none';
                }

                // 设置为搜索按钮样式
                this.panel.style.width = '60px';
                this.panel.style.height = '60px';
                this.panel.style.borderRadius = '50%';
                this.panel.style.cursor = 'pointer';
                this.panel.style.background = '#0066cc';
            }
        }

        toggleMaximize() {
            this.panel.style.transition = 'none';
            const content = this._els.jiguiPanelContent;
            const tabs = this._els.jiguiTabs;
            const header = this._els.panelHeader;
            const searchIconBtn = this._els.searchIconBtn;

            if (this.panel.classList.contains('maximized')) {
                // 恢复窗口
                this.panel.classList.remove('maximized');

                // 恢复背景页面的滚动条
                if (this.bodyOverflowState !== null) {
                    document.body.style.overflow = this.bodyOverflowState;
                } else {
                    document.body.style.overflow = '';
                }
                if (this.htmlOverflowState !== null) {
                    document.documentElement.style.overflow = this.htmlOverflowState;
                } else {
                    document.documentElement.style.overflow = '';
                }
                // 移除鼠标滚轮事件监听
                this.removeWheelListener();

                // 隐藏最大化状态下的最小化按钮
                const maximizedMinimizeOnly = this.panel.querySelector('#maximized-minimize-only');
                if (maximizedMinimizeOnly) {
                    maximizedMinimizeOnly.style.display = 'none';
                }

                // 根据最小化状态恢复显示
                if (this.isMinimized) {
                    // 最小化状态：显示搜索图标按钮，隐藏其他内容
                    if (searchIconBtn) searchIconBtn.style.display = 'flex';
                    if (content) content.style.display = 'none';
                    if (tabs) tabs.style.display = 'none';
                    if (header) header.style.display = 'none';
                } else {
                    // 非最小化状态：隐藏搜索图标按钮，显示其他内容
                    if (searchIconBtn) searchIconBtn.style.display = 'none';
                    if (content) content.style.display = 'flex';
                    if (tabs) tabs.style.display = 'flex';
                    if (header) header.style.display = 'flex';
                }

                // 更新按钮图标为窗口化状态（最大化图标）
                this.updateMainButtons();

                // 恢复窗口大小和位置
                if (this.normalState) {
                    this.panel.style.top = this.normalState.top || '50px';
                    this.panel.style.left = this.normalState.left || '50px';
                    this.panel.style.width = this.normalState.width || '1200px';
                    this.panel.style.height = this.normalState.height || '700px';
                    this.panel.style.maxWidth = '';
                    this.panel.style.maxHeight = '';
                    this.panel.style.borderRadius = this.normalState.borderRadius || '8px';
                    this.panel.style.background = this.normalState.background || '#f8fafc';

                    // 恢复后保存位置
                    setTimeout(() => {
                        this.savePanelState();
                    }, 100);
                    this.panel.style.cursor = this.normalState.cursor || 'default';
                }

                // 恢复所有保存的样式
                if (this.normalState) {
                    Object.keys(this.normalState).forEach(key => {
                        if (this.normalState[key] !== undefined && this.normalState[key] !== null && key !== 'transition') {
                            this.panel.style[key] = this.normalState[key];
                        } else if (key !== 'transition') {
                            this.panel.style[key] = '';
                        }
                    });
                }
                // 确保flex布局正确
                this.panel.style.setProperty('display', 'flex', 'important');
                this.panel.style.setProperty('flex-direction', 'column', 'important');
            } else {
                // 如果当前是最小化状态，先恢复显示
                if (this.isMinimized) {
                    this.isMinimized = false;
                    if (content) content.style.display = 'flex';
                    if (tabs) tabs.style.display = 'flex';
                    if (header) header.style.display = 'flex';
                    if (searchIconBtn) searchIconBtn.style.display = 'none';
                }

                // 保存当前所有样式
                const computedStyle = window.getComputedStyle(this.panel);
                this.normalState = {
                    top: this.panel.style.top || computedStyle.top,
                    left: this.panel.style.left || computedStyle.left,
                    width: this.panel.style.width || computedStyle.width,
                    height: this.panel.style.height || computedStyle.height,
                    maxWidth: this.panel.style.maxWidth || computedStyle.maxWidth,
                    maxHeight: this.panel.style.maxHeight || computedStyle.maxHeight,
                    borderRadius: this.panel.style.borderRadius || computedStyle.borderRadius,
                    background: this.panel.style.background || computedStyle.background,
                    cursor: this.panel.style.cursor || computedStyle.cursor
                };

                // 保存并隐藏背景页面的滚动条
                const bodyComputedStyle = window.getComputedStyle(document.body);
                const htmlComputedStyle = window.getComputedStyle(document.documentElement);
                this.bodyOverflowState = document.body.style.overflow || bodyComputedStyle.overflow;
                this.htmlOverflowState = document.documentElement.style.overflow || htmlComputedStyle.overflow;
                document.body.style.overflow = 'hidden';
                document.documentElement.style.overflow = 'hidden';

                // 隐藏标题栏
                if (header) {
                    header.style.display = 'none';
                }

                // 最大化窗口
                this.panel.classList.add('maximized');
                this.panel.style.top = '0';
                this.panel.style.left = '0';
                this.panel.style.width = '100vw';
                this.panel.style.maxWidth = '100vw';
                this.panel.style.height = '100vh';
                this.panel.style.maxHeight = '100vh';
                this.panel.style.borderRadius = '0';

                // 更新按钮图标为最大化状态（恢复图标）- 虽然标题栏已隐藏，但为了一致性仍更新
                this.updateMainButtons();
                this.panel.style.background = '#f8fafc';
                this.panel.style.cursor = 'default';
                this.panel.style.display = 'flex';
                this.panel.style.flexDirection = 'column';
                this.panel.style.alignItems = 'stretch';
                this.panel.style.justifyContent = 'flex-start';

                // 显示最大化状态下的最小化按钮（仅显示最小化按钮）
                const maximizedMinimizeOnly = this.panel.querySelector('#maximized-minimize-only');
                if (maximizedMinimizeOnly) {
                    maximizedMinimizeOnly.style.display = 'block';
                }

                // 添加鼠标滚轮事件监听，阻止背景页面滚动
                this.addWheelListener();

                // 确保内容显示并正确设置flex布局
                if (content) {
                    content.style.display = 'flex';
                    content.style.flexDirection = 'row';
                    content.style.flex = '1';
                    content.style.minHeight = '0';
                    content.style.overflow = 'hidden';
                }
                if (tabs) {
                    tabs.style.display = 'flex';
                    tabs.style.flexDirection = 'row';
                    tabs.style.flexShrink = '0';
                    tabs.style.alignItems = 'center';
                    tabs.style.height = '40px';
                }
                if (searchIconBtn) {
                    searchIconBtn.style.display = 'none';
                }

                if (this._els.searchResultArea) {
                    this._els.searchResultArea.style.display = 'flex';
                    this._els.searchResultArea.style.flexDirection = 'column';
                    this._els.searchResultArea.style.flex = '1';
                    this._els.searchResultArea.style.minHeight = '0';
                }
                if (this._els.searchResult) {
                    this._els.searchResult.style.writingMode = 'horizontal-tb';
                    this._els.searchResult.style.direction = 'ltr';
                }
            }
        }

        // 添加鼠标滚轮事件监听，阻止背景页面滚动
        addWheelListener() {
            this.wheelHandler = (e) => {
                const isInMainPanel = this.panel && this.panel.contains(e.target);
                let isInDetailPanel = false;
                this.detailPanels.forEach(panel => {
                    if (panel.contains(e.target)) isInDetailPanel = true;
                });
                if (isInMainPanel || isInDetailPanel) return;
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
            // 使用捕获阶段，确保能拦截所有滚轮事件
            document.addEventListener('wheel', this.wheelHandler, { passive: false, capture: true });
            document.addEventListener('mousewheel', this.wheelHandler, { passive: false, capture: true }); // 兼容旧浏览器
        }

        // 移除鼠标滚轮事件监听
        removeWheelListener() {
            if (this.wheelHandler) {
                document.removeEventListener('wheel', this.wheelHandler, { capture: true });
                document.removeEventListener('mousewheel', this.wheelHandler, { capture: true });
                this.wheelHandler = null;
            }
        }

        performSearch() {
            if (this.isLoading) {
                console.log('搜索已在进行中，请等待');
                return;
            }
            const checkedRadio = this.panel.querySelector('input[name="' + this.currentTab + '-search-type"]:checked');
            const searchType = checkedRadio ? checkedRadio.value : null;
            if (!searchType) {
                alert('请选择搜索方式');
                return;
            }
            const searchContent = (this._els.searchContent && this._els.searchContent.value || '').trim();
            if (!searchContent) {
                alert('请输入搜索内容');
                return;
            }
            this.isLoading = true;
            if (this._els.searchBtn) this._els.searchBtn.disabled = true;
            const resultDiv = this._els.searchResult;
            if (resultDiv) resultDiv.innerHTML = '<div style="color: #0066cc; text-align: center; font-size: 20px; margin-top: 10px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">正在搜索...</div>';

            console.log('开始搜索:', '模块=' + this.currentTab, '类型=' + searchType, '内容=' + searchContent);

            // 根据当前标签调用不同的搜索函数
            let searchPromise;
            switch(this.currentTab) {
                case 'zhiling': // 制造令（与其它模式一致，分页展示）
                    searchPromise = this.searchZhiling(searchContent, searchType);
                    break;
                case 'jigui': // 机规（与其它模式一致，分页展示）
                    searchPromise = this.searchJiguiPage(searchContent, searchType, 1)
                        .then(first => ({
                            headers: first.headers,
                            rows: first.rows,
                            totalPages: first.totalPages || 1,
                            totalCount: first.totalCount || first.rows.length,
                            currentPage: 1,
                            pageSize: first.pageSize,
                            sourceTab: first.sourceTab || 'jigui'
                        }));
                    break;
                case 'tongzhi': // 通知单（与其它模式一致，分页展示）
                    searchPromise = this.searchTongzhi(searchContent, searchType);
                    break;
                default:
                    searchPromise = Promise.reject(new Error('未知的搜索模块'));
            }

            searchPromise
                .then(results => {
                    console.log('搜索完成，找到', results.rows.length, '条结果');
                    this.displayResults(results, searchType, searchContent);
                })
                .catch(error => {
                    console.error('搜索失败:', error);
                    if (this._els.searchResult) this._els.searchResult.innerHTML = '<div style="color: red; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">搜索失败: ' + error.message + '</div>';
                })
                .finally(() => {
                    this.isLoading = false;
                    if (this._els.searchBtn) this._els.searchBtn.disabled = false;
                });
        }

        // GBK 编码：旧 ASP 系统使用 GBK/CP936，搜索参数必须按原始字节进行百分号编码。
        // 使用 gbk.js 0.3.0 的完整浏览器编码表；不再使用会把部分 D8-DF 字节映射为 U+FFFD 的 gbk-lite。
        encodeGBK(str) {
            if (!str) return '';
            if (typeof GBK === 'undefined' || typeof GBK.encode !== 'function' || typeof GBK.decode !== 'function') {
                throw new Error('GBK 编码库加载失败，请检查 jsDelivr 网络连接');
            }

            const bytes = Array.from(GBK.encode(String(str)), b => b & 0xFF);
            // gbk.js 对无法编码的字符会使用问号替代。往返校验可防止静默发送错误查询参数。
            if (GBK.decode(bytes) !== String(str)) {
                throw new Error('搜索内容包含 GBK/CP936 无法表示的字符：' + str);
            }
            return bytes.map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
        }

        // 通用：GET 指定 URL，gb2312 解码后返回 HTML 字符串
        fetchUrl(url, referer, options) {
            const noCache = !!(options && options.noCache);
            // 如果没有指定referer，根据URL自动判断
            if (!referer) {
                if (url.includes('/zzl/')) {
                    referer = 'http://10.16.88.34/zzl/';
                } else if (url.includes('/jigui/')) {
                    referer = 'http://10.16.88.34/jigui/';
                } else if (url.includes('/notice/')) {
                    referer = 'http://10.16.88.34/notice/';
                } else if (url.includes('/tongzhi/')) {
                    referer = 'http://10.16.88.34/tongzhi/';
                } else {
                    referer = 'http://10.16.88.34/jigui/'; // 默认
                }
            }

            return new Promise((resolve, reject) => {
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                    'Referer': referer,
                    'Cache-Control': noCache ? 'no-cache, no-store, must-revalidate' : 'max-age=0',
                    'Pragma': noCache ? 'no-cache' : 'max-age=0'
                };
                    if (noCache) headers.Expires = '0';

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: headers,
                    responseType: 'arraybuffer',
                    onload: (response) => {
                        if (response.status === 200) {
                            const decoder = new TextDecoder('gb2312');
                            resolve(decoder.decode(new Uint8Array(response.response)));
                        } else {
                            reject(new Error('请求失败: ' + response.status));
                        }
                    },
                    onerror: (e) => {
                        reject(new Error('请求失败'));
                    }
                });
            });
        }

        // 搜索指定页的结果（按「直接搜索」表单：创建人、部件名称用 content+空 d1/d2；工号/编号用 content+日期）
        searchJiguiPage(content, searchType, pageNum, options) {
            const quiet = options && options.quiet;
            return new Promise((resolve, reject) => {
                const today = new Date();
                const d2Val = today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();
                const encGBK = (s) => this.encodeGBK(s);
                const encURI = (s) => encodeURIComponent(s);
                let valueParam;
                let d1, d2;
                // 与系统直接搜索一致：创建人、部件名称均用 content，且 d1/d2 为空
                if (searchType === 'writename' || searchType === 'picname') {
                    valueParam = 'content=' + encGBK(content);
                    d1 = '';
                    d2 = '';
                } else {
                    valueParam = 'content=' + encGBK(content);
                    d1 = '2002/1/1';
                    d2 = d2Val;
                }

                const base = 'fenlei=' + encURI(searchType) + '&' + valueParam + '&d1=' + encURI(d1) + '&d2=' + encURI(d2);
                let url = 'http://10.16.88.34/jigui/search.asp?' + base;
                if (pageNum > 1) {
                    url = 'http://10.16.88.34/jigui/search.asp?page=' + pageNum + '&' + base;
                }

                if (!quiet) console.log('获取第 ' + pageNum + ' 页，URL: ' + url);

                this.fetchUrl(url)
                    .then(html => {
                        const parseResult = this.parseResponse(html, options);
                        parseResult.sourceTab = 'jigui';
                        if (!quiet) console.log('第 ' + pageNum + ' 页解析完成，找到 ' + parseResult.rows.length + ' 条数据');
                        resolve(parseResult);
                    })
                    .catch(reject);
            });
        }

        parseResponse(html, options) {
            const quiet = options && options.quiet;
            const rows = [];
            let headers = [];
            let totalPages = 1;
            let totalCount = 0;
            let pageSize = 0;

            const strip = (s) => this.stripAllTags(s);
            const htmlPlain = strip(html);

            // 分页区：含 "页次：1/4页 共75篇文章 20篇文章/页" 的片段（先取 raw 再去标签，避免标签打断匹配）
            let blockPlain = htmlPlain;
            const blockRaw = html.match(/页次[：:][\s\S]{0,400}/) || html.match(/(?:>>\s*分页|&gt;&gt;\s*分页|首页|尾页)[\s\S]{0,500}/);
            if (blockRaw && blockRaw[0]) blockPlain = strip(blockRaw[0]);

            // 优先：精确匹配 "页次：1/4页 共75篇文章 20篇文章/页"（总页数、总条数、每页条数一次取出）
            const exact = blockPlain.match(/页次[：:]\s*\d+\s*\/\s*(\d+)\s*页\s+共\s*(\d+)\s*篇(?:\s*文章)?\s+(\d+)\s*篇(?:\s*文章)?\s*\/\s*页/) ||
                blockPlain.match(/页次[：:]\s*\d+\s*\/\s*(\d+)\s*页[\s\S]{0,120}?共\s*(\d+)\s*篇(?:\s*文章)?[\s\S]{0,80}?(\d+)\s*篇(?:\s*文章)?\s*\/\s*页/);
            if (exact) {
                totalPages = parseInt(exact[1], 10) || totalPages;
                totalCount = parseInt(exact[2], 10) || totalCount;
                pageSize = parseInt(exact[3], 10) || pageSize;
                if (!quiet) console.log('分页(精确): 页次 ?/' + totalPages + '页 共' + totalCount + '篇 ' + pageSize + '篇/页');
            } else if (blockPlain.length > 0 && !quiet) {
                console.log('分页区纯文(前200字): ' + blockPlain.slice(0, 200).replace(/\s+/g, ' '));
            }

            if (totalPages <= 1 || totalCount <= 0) {
                const pageInfoPatterns = [
                    { re: /页次[：:]\s*(\d+)\s*\/\s*(\d+)\s*页\s+共\s*(\d+)\s*(?:条|篇\s*文章|篇文章)/, totalPagesIdx: 2, totalCountIdx: 3 },
                    { re: /页次[：:]\s*(\d+)\s*\/\s*(\d+)\s*页/, totalPagesIdx: 2 },
                    { re: /(\d+)\s*\/\s*(\d+)\s*页\s+共\s*(\d+)\s*(?:条|篇\s*文章|篇文章)/, totalPagesIdx: 2, totalCountIdx: 3 },
                    { re: /共\s*(\d+)\s*(?:条|篇\s*文章|篇文章)\s*\/\s*(\d+)\s*页/, totalCountIdx: 1, totalPagesIdx: 2 }
                ];
                for (const { re, totalPagesIdx, totalCountIdx } of pageInfoPatterns) {
                    const m = blockPlain.match(re) || htmlPlain.match(re);
                    if (m) {
                        if (totalPagesIdx != null) totalPages = parseInt(m[totalPagesIdx], 10) || totalPages;
                        if (totalCountIdx != null) totalCount = parseInt(m[totalCountIdx], 10) || totalCount;
                        if (totalPages > 1 || totalCount > 0) {
                            if (!quiet) console.log('分页(备用): 总页数=' + totalPages + ', 总条数=' + totalCount);
                            break;
                        }
                    }
                }
            }

            const parseCountAndPageSize = (str, from) => {
                if (totalCount <= 0) {
                    const countRe = /共\s*(\d+)\s*(?:条|篇\s*文章|篇文章)/g;
                    let m;
                    let maxCount = 0;
                    while ((m = countRe.exec(str)) !== null) {
                        const n = parseInt(m[1], 10);
                        if (n > maxCount) maxCount = n;
                    }
                    if (maxCount > 0) {
                        totalCount = maxCount;
                        if (!quiet) console.log('单独匹配到总条数: ' + totalCount + ' (' + from + ')');
                    }
                }
                if (pageSize <= 0) {
                    const perPageRe = /(?:每页\s*(\d+)\s*条|(\d+)\s*篇(?:\s*文章)?\s*\/\s*页|(\d+)\s*条\s*记录\s*\/\s*页|(\d+)\s*条\s*\/\s*页)/g;
                    let m;
                    while ((m = perPageRe.exec(str)) !== null) {
                        const n = parseInt(m[1] || m[2] || m[3] || m[4], 10);
                        if (n > 0) { pageSize = n; if (!quiet) console.log('匹配到每页条数: ' + pageSize + ' (' + from + ')'); break; }
                    }
                }
            };
            parseCountAndPageSize(blockPlain, '分页区');
            if (totalCount <= 0 || pageSize <= 0) parseCountAndPageSize(htmlPlain, '全页');

            if (!quiet) console.log('分页解析结果: totalPages=' + totalPages + ', totalCount=' + totalCount + ', pageSize=' + pageSize);

            // 查找表格
            const tableRegex = /<table[^>]*border="1"[^>]*>([\s\S]*?)<\/table>/i;
            const tableMatch = html.match(tableRegex);

            if (!tableMatch) {
                if (!quiet) console.log('没有找到表格');
                return { headers: headers, rows: rows, totalPages: totalPages, totalCount: totalCount, pageSize: pageSize > 0 ? pageSize : 0 };
            }

            let tableHtml = tableMatch[1];
            // 处理 tbody 标签
            tableHtml = tableHtml.replace(/<\/?tbody[^>]*>/gi, '');

            // 提取表头
            const headerRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/i;
            const headerMatch = tableHtml.match(headerRegex);

            if (headerMatch) {
                const headerHtml = headerMatch[1];
                const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                let tdMatch;
                while ((tdMatch = tdRegex.exec(headerHtml)) !== null) {
                    headers.push(this.stripAllTags(tdMatch[1]));
                }
            }

            // 提取数据行
            const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let trMatch;
            let rowIndex = 0;

            while ((trMatch = trRegex.exec(tableHtml)) !== null) {
                if (rowIndex === 0) {
                    rowIndex++;
                    continue; // 跳过表头行
                }

                const rowHtml = trMatch[1];
                const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const rowData = [];
                let tdMatch;

                while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
                    const cellHtml = tdMatch[1];

                    // 检查是否有链接
                    if (cellHtml.includes('<a')) {
                        const linkMatch = cellHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
                        if (linkMatch) {
                            rowData.push({
                                type: 'link',
                                text: this.stripAllTags(linkMatch[2]),
                                href: linkMatch[1]
                            });
                        } else {
                            rowData.push(this.stripAllTags(cellHtml));
                        }
                    } else {
                        rowData.push(this.stripAllTags(cellHtml));
                    }
                }

                if (rowData.length > 0) {
                    rows.push(rowData);
                }
                rowIndex++;
            }

            // 兜底：未解析出总条数时，用本页行数
            if (totalCount <= 0 && rows.length > 0) {
                totalCount = rows.length;
                if (!quiet) console.log('未解析到总条数，用本页行数: ' + totalCount);
            }
            // 有总条数时，用「每页条数」或本页行数推算总页数，并覆盖之前解析结果（系统以总条数为准）
            if (totalCount > 0 && rows.length > 0) {
                const effectivePageSize = pageSize > 0 ? pageSize : rows.length;
                const calculated = Math.max(1, Math.ceil(totalCount / effectivePageSize));
                if (calculated !== totalPages) {
                    totalPages = calculated;
                    if (!quiet) console.log('根据总条数计算总页数: ' + totalPages + ' (共 ' + totalCount + ' 条, 每页 ' + effectivePageSize + ' 条)');
                }
            }
            // 仅当完全解析不到总条数时，用本页行数；不再强制 totalPages=2，避免掩盖真实页数
            // 展示用每页条数：与后台分页一致（解析值或本页满页行数），不要用 总条数/总页数（会得到最后一页平均）
            const resolvedPageSize = pageSize > 0 ? pageSize : (rows.length > 0 ? rows.length : 0);

            return { headers: headers, rows: rows, totalPages: totalPages, totalCount: totalCount, pageSize: resolvedPageSize };
        }

        stripAllTags(html) {
            return html
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/\s+/g, ' ')
                .trim();
        }

        cellText(cell) {
            if (cell == null) return '';
            if (typeof cell === 'object' && cell && cell.text != null) return String(cell.text);
            return String(cell);
        }

        getModuleBaseUrl(tab) {
            const tabUrls = {
                'zhiling': 'http://10.16.88.34/zzl/',
                'jigui': 'http://10.16.88.34/jigui/',
                'tongzhi': 'http://10.16.88.34/notice/'
            };
            return tabUrls[tab] || 'http://10.16.88.34/';
        }

        isUpdateGuideUrl(href, fallbackUrl) {
            if (!href) return false;
            try {
                const url = new URL(String(href), fallbackUrl || TODO_UPDATE_GUIDE_ORIGIN);
                return url.origin === TODO_UPDATE_GUIDE_ORIGIN &&
                    url.pathname === TODO_UPDATE_GUIDE_PATH &&
                    !url.search;
            } catch (e) {
                return false;
            }
        }

        // 相对链接必须以“结果来源模块”为基准解析，不能使用入口页面或点击瞬间的 currentTab。
        resolveModuleUrl(href, sourceTab, fallbackUrl) {
            if (!href) return '';
            try {
                const url = new URL(String(href), fallbackUrl || this.getModuleBaseUrl(sourceTab));
                const isInternalSystemUrl =
                    (url.protocol === 'http:' || url.protocol === 'https:') &&
                    url.hostname === '10.16.88.34';
                const isUpdateGuideUrl = this.isUpdateGuideUrl(url.href);
                const isVisitNoteUrl =
                    url.protocol === 'https:' &&
                    (url.hostname === 'visit-note.com' || url.hostname.endsWith('.visit-note.com'));
                if (!isInternalSystemUrl && !isUpdateGuideUrl && !isVisitNoteUrl) return '';
                return url.href;
            } catch (e) {
                console.warn('无法解析链接:', href, e);
                return '';
            }
        }

        displayResults(parseResult, searchType, searchContent) {
            const resultDiv = this._els.searchResult;
            if (!resultDiv) return;
            const sourceTab = parseResult.sourceTab || this.currentTab;
            // 异步搜索返回时如果用户已切换模块，不用旧模块结果覆盖当前界面。
            if (parseResult.sourceTab && sourceTab !== this.currentTab) return;
            let results = parseResult.rows;
            const headers = parseResult.headers;
            let totalPages = parseResult.totalPages || 1;
            let totalCount = parseResult.totalCount || results.length;
            const currentPage = parseResult.currentPage || 1;
            this.currentDisplayedPage = currentPage;
 

            if (results.length === 0) {
                const msg = searchType === 'default'
                    ? '未解析到列表，请使用搜索'
                    : '未找到结果';
                resultDiv.style.display = 'flex';
                resultDiv.style.flexDirection = 'column';
                resultDiv.style.alignItems = 'center';
                resultDiv.style.justifyContent = 'flex-start';
                resultDiv.style.textAlign = 'center';
                resultDiv.innerHTML = '<div style="color: #0066cc; text-align: center; font-size: 20px; margin-top: 10px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">' + msg + '</div>';
                return;
            }

            const isDefault = searchType === 'default';

            // 每页条数：使用解析/接口返回的 pageSize（与源站分页一致）；勿用 总条数/总页数（会得到各页平均）
            let pageSize = typeof parseResult.pageSize === 'number' && parseResult.pageSize > 0
                ? parseResult.pageSize
                : (totalPages <= 1 && results.length > 0 ? results.length : 0);

            // 所有模块：只要有搜索结果就显示分页模块（含仅一页的情况）
            const showPagination = results.length > 0 && totalPages >= 1;

            // 使用flex布局，确保分页控件在底部
            let html = '<div style="display: flex; flex-direction: column; height: 100%; min-height: 0; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">';

            // 表格容器，占据剩余空间，确保可以滚动显示所有内容
            html += '<div style="flex: 1; overflow-x: auto; overflow-y: auto; min-height: 0; position: relative; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;"><table style="border-collapse: collapse; font-size: 14px; white-space: nowrap; width: auto; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">';

            // 添加表头
            // 查找"部件名称"列的索引
            let partNameColumnIndex = -1;
            if (headers.length > 0) {
                headers.forEach((h, idx) => {
                    const headerText = h.trim().replace(/\s+/g, '');
                    if (headerText === '部件名称' || headerText.includes('部件名称')) {
                        partNameColumnIndex = idx;
                    }
                });
            }

            const thStyle = 'padding: 6px 8px; text-align: center; border: 1px solid #999; white-space: nowrap; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;';
            const headerParts = ['<tr style="background: #d0d0d0; border-bottom: 1px solid #999;">'];
            if (headers.length > 0) {
                headers.forEach(header => {
                    headerParts.push('<th style="' + thStyle + '">' + header + '</th>');
                });
            } else if (results[0]) {
                for (let i = 0; i < results[0].length; i++) {
                    headerParts.push('<th style="' + thStyle + '">列' + (i + 1) + '</th>');
                }
            }
            headerParts.push('</tr>');
            html += headerParts.join('');

            let numberColumnIndex = -1;
            let userColumnIndex = -1;
            if (sourceTab === 'zhiling' && headers.length > 0) {
                headers.forEach((h, idx) => {
                    const headerText = h.trim().replace(/\s+/g, '');
                    if (headerText === '编号' || headerText.includes('编号')) numberColumnIndex = idx;
                    if (headerText === '用户' || headerText.includes('用户')) userColumnIndex = idx;
                });
            }

            const rowParts = [];
            results.forEach((row, rowIndex) => {
                const cellParts = [];
                for (let i = 0; i < row.length; i++) {
                    const cell = row[i];
                    const alignStyle = (partNameColumnIndex >= 0 && i === partNameColumnIndex) ? 'text-align: left;' : 'text-align: center;';
                    const tdOpen = '<td style="padding: 6px 8px; ' + alignStyle + ' border: 1px solid #999; white-space: nowrap; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">';
                    if (typeof cell === 'object' && cell.type === 'link') {
                        let href = cell.href;
                        if (sourceTab === 'zhiling') {
                            if (userColumnIndex >= 0 && i === userColumnIndex && numberColumnIndex >= 0 && numberColumnIndex < row.length) {
                                const numberValue = this.cellText(row[numberColumnIndex]);
                                if (numberValue && numberValue.trim()) {
                                    href = 'http://10.16.88.34/zzl/viewtotal.asp?id=' + encodeURIComponent(numberValue.trim());
                                }
                            } else if (userColumnIndex < 0 && numberColumnIndex >= 0 && numberColumnIndex < row.length) {
                                const numberValue = this.cellText(row[numberColumnIndex]);
                                if (numberValue && numberValue.trim()) {
                                    href = 'http://10.16.88.34/zzl/viewtotal.asp?id=' + encodeURIComponent(numberValue.trim());
                                }
                            }
                        }
                        const linkText = cell.text;
                        const isJiguiOrTongzhiLink = sourceTab === 'jigui' || sourceTab === 'tongzhi';
                        const isRedStatusLink = isJiguiOrTongzhiLink && (String(linkText).trim() === '未校核' || String(linkText).trim() === '未批准' || String(linkText).trim() === '未分发');
                        const linkStyle = isRedStatusLink ? 'color: red !important; text-decoration: underline; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;' : 'color: #0066cc; text-decoration: underline; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;';
                        const linkClass = 'jigui-detail-link';
                        const absoluteHref = this.resolveModuleUrl(href, sourceTab);
                        const safeHref = absoluteHref || '#';
                        cellParts.push(tdOpen + '<a href="' + safeHref + '" data-href="' + absoluteHref + '" data-source-tab="' + sourceTab + '" class="' + linkClass + '" style="' + linkStyle + '">' + linkText + '</a></td>');
                    } else {
                        const cellStr = String(cell);
                        const isJiguiOrTongzhi = sourceTab === 'jigui' || sourceTab === 'tongzhi';
                        const isRedStatus = isJiguiOrTongzhi && (cellStr.trim() === '未校核' || cellStr.trim() === '未批准' || cellStr.trim() === '未分发');
                        const cellContent = isRedStatus ? '<span style="color: red !important;">' + cellStr + '</span>' : cellStr;
                        cellParts.push(tdOpen + cellContent + '</td>');
                    }
                }
                rowParts.push('<tr>' + cellParts.join('') + '</tr>');
            });
            html += rowParts.join('') + '</table></div>';

            // 在页面最下方添加分页控件（如果显示）
            if (showPagination) {
                const linkStyle = 'color: #0066cc; text-decoration: underline; cursor: pointer; background: none; border: none; font-size: inherit; padding: 0; margin: 0 2px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;';
                const inactiveStyle = 'color: #c4a574; cursor: default; background: none; border: none; font-size: inherit; padding: 0; margin: 0 2px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;';
                const sep = '<span style="margin: 0 4px; color: #333; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">|</span>';

                const firstActive = currentPage > 1;
                const prevActive = currentPage > 1;
                const nextActive = currentPage < totalPages;
                const lastActive = currentPage < totalPages;

                html += '<div class="jigui-pagination" style="margin-top: 12px; padding: 8px 0; font-size: 15px; color: #333; display: flex; align-items: center; justify-content: flex-end; gap: 4px; flex-wrap: nowrap; white-space: nowrap; flex-shrink: 0; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">';
                html += firstActive
                    ? '<a href="javascript:void(0)" class="jigui-page-link" data-page="1" style="' + linkStyle + '">首页</a>'
                    : '<span style="' + inactiveStyle + '">首页</span>';
                html += sep;
                html += prevActive
                    ? '<a href="javascript:void(0)" class="jigui-page-link" data-page="' + (currentPage - 1) + '" style="' + linkStyle + '">上一页</a>'
                    : '<span style="' + inactiveStyle + '">上一页</span>';
                html += sep;
                html += nextActive
                    ? '<a href="javascript:void(0)" class="jigui-page-link" data-page="' + (currentPage + 1) + '" style="' + linkStyle + '">下一页</a>'
                    : '<span style="' + inactiveStyle + '">下一页</span>';
                html += sep;
                html += lastActive
                    ? '<a href="javascript:void(0)" class="jigui-page-link" data-page="' + totalPages + '" style="' + linkStyle + '">尾页</a>'
                    : '<span style="' + inactiveStyle + '">尾页</span>';
                html += '<span style="margin-left: 8px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">页次：<span style="color: #c00; font-weight: bold; margin: 0 2px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">' + currentPage + '</span> / ' + totalPages + ' 页</span>';
                html += '<span style="margin-left: 8px; color: #666; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">共 ' + totalCount + ' 条</span>';
                if (pageSize > 0) {
                    html += '<span style="margin-left: 8px; color: #666; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">' + pageSize + ' 条/页</span>';
                }
                html += '<span style="margin-left: 8px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">转到：</span>';
                html += '<input type="number" class="jigui-goto-page" min="1" max="' + totalPages + '" value="' + currentPage + '" style="width: 50px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 2px; font-size: 14px; flex-shrink: 0; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">';
                html += '<button class="jigui-goto-btn" style="padding: 2px 8px; margin-left: 4px; background: #808080; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 14px; flex-shrink: 0; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">Goto</button>';
                html += '</div>';
            }

            html += '</div>'; // 关闭最外层的flex容器

            // 更新 resultDiv 的样式，确保内容完整显示
            resultDiv.style.display = 'flex';
            resultDiv.style.flexDirection = 'column';
            resultDiv.style.alignItems = 'stretch';
            resultDiv.style.justifyContent = 'flex-start';
            resultDiv.style.overflow = 'visible';
            resultDiv.style.minHeight = '0';
            resultDiv.style.height = '100%';
            resultDiv.style.textAlign = 'left';
            resultDiv.style.writingMode = 'horizontal-tb';
            resultDiv.style.direction = 'ltr';

            resultDiv.innerHTML = html;
            this.currentSearchContent = searchContent;
            this.currentSearchType = searchType;

            // 每次渲染后缓存当前标签的最后结果，供切换标签时直接秒开
            if (sourceTab) {
                this.tabLastViewState.set(sourceTab, {
                    searchContent: searchContent || '',
                    searchType: searchType || 'default',
                    pageNum: currentPage,
                    parseResult: this.cloneParseResult({
                        headers: headers,
                        rows: results,
                        totalPages: totalPages,
                        totalCount: totalCount,
                        pageSize: pageSize,
                        currentPage: currentPage,
                        sourceTab: sourceTab
                    })
                });
            }
        }

        // 跳转到指定页（非工号搜索时使用，只显示该页数据）
        loadPage(searchContent, searchType, pageNum) {
            const resultDiv = this._els.searchResult;
            const paginationDiv = resultDiv ? resultDiv.querySelector('.jigui-pagination') : null;
            const sourceTab = this.currentTab;

            if (paginationDiv) {
                paginationDiv.style.pointerEvents = 'none';
                paginationDiv.style.opacity = '0.6';
            }

            const token = ++this.renderToken;

            const restore = () => {
                if (paginationDiv) {
                    paginationDiv.style.pointerEvents = '';
                    paginationDiv.style.opacity = '1';
                }
            };

            // 从当前显示的分页信息中读取 totalPages 和 totalCount（避免后续页解析失败覆盖正确值）
            let preservedTotalPages = null;
            let preservedTotalCount = null;
            if (paginationDiv) {
                const pageText = paginationDiv.textContent || '';
                const pageMatch = pageText.match(/页次[：:]\s*\d+\s*\/\s*(\d+)\s*页/);
                const countMatch = pageText.match(/共\s*(\d+)\s*条/);
                if (pageMatch) preservedTotalPages = parseInt(pageMatch[1], 10);
                if (countMatch) preservedTotalCount = parseInt(countMatch[1], 10);
            }

            // 固定本次分页请求的来源模块，避免请求期间切换标签导致 URL 基准变化
            let searchPromise;
            if (searchType === 'default') {
                // 默认列表：直接访问首页URL并添加page参数
                const tabUrls = {
                    'jigui': 'http://10.16.88.34/jigui/',
                    'zhiling': 'http://10.16.88.34/zzl/',
                    'tongzhi': 'http://10.16.88.34/notice/'
                };
                const baseUrl = tabUrls[sourceTab] || tabUrls.jigui;
                const url = pageNum > 1 ? baseUrl + '?page=' + pageNum : baseUrl;
                searchPromise = this.fetchUrl(url).then(html => {
                    const parseResult = this.parseResponse(html);
                    parseResult.currentPage = pageNum;
                    parseResult.sourceTab = sourceTab;
                    return parseResult;
                });
            } else if (sourceTab === 'tongzhi') {
                searchPromise = this.searchTongzhiPage(searchContent, searchType, pageNum);
            } else if (sourceTab === 'jigui') {
                searchPromise = this.searchJiguiPage(searchContent, searchType, pageNum);
            } else if (sourceTab === 'zhiling') {
                searchPromise = this.searchZhilingPage(searchContent, searchType, pageNum);
            } else {
                searchPromise = this.searchJiguiPage(searchContent, searchType, pageNum);
            }

            searchPromise
                .then(pageResult => {
                    pageResult.sourceTab = pageResult.sourceTab || sourceTab;
                    if (pageResult.rows.length === 0 && pageNum > 1) {
                        console.log('第 ' + pageNum + ' 页无数据，回到第 1 页');
                        // 重新获取第1页
                        let firstPagePromise;
                        if (searchType === 'default') {
                            const tabUrls = {
                                'jigui': 'http://10.16.88.34/jigui/',
                                'zhiling': 'http://10.16.88.34/zzl/',
                                'tongzhi': 'http://10.16.88.34/notice/'
                            };
                            const baseUrl = tabUrls[sourceTab] || tabUrls.jigui;
                            firstPagePromise = this.fetchUrl(baseUrl).then(html => {
                                const parseResult = this.parseResponse(html);
                                parseResult.currentPage = 1;
                                parseResult.sourceTab = sourceTab;
                                return parseResult;
                            });
                        } else if (sourceTab === 'tongzhi') {
                            firstPagePromise = this.searchTongzhiPage(searchContent, searchType, 1);
                        } else if (sourceTab === 'jigui') {
                            firstPagePromise = this.searchJiguiPage(searchContent, searchType, 1);
                        } else if (sourceTab === 'zhiling') {
                            firstPagePromise = this.searchZhilingPage(searchContent, searchType, 1);
                        } else {
                            firstPagePromise = this.searchJiguiPage(searchContent, searchType, 1);
                        }
                        return firstPagePromise.then(p1 => {
                            // 重新解析第1页以获取正确的 totalPages 和 totalCount
                            const finalTotalPages = p1.totalPages || preservedTotalPages || 1;
                            const finalTotalCount = p1.totalCount || preservedTotalCount || p1.rows.length;
                            if (this.renderToken !== token) return;
                            this.displayResults({
                                rows: p1.rows,
                                headers: p1.headers,
                                totalPages: finalTotalPages,
                                totalCount: finalTotalCount,
                                currentPage: 1,
                                pageSize: p1.pageSize,
                                sourceTab: p1.sourceTab || sourceTab
                            }, searchType, searchContent);
                        });
                    }
                    // 取较大值：若后续页 HTML 含更大总页数/总条数（如 页次 2/4），则采用以纠正首页解析不足
                    const finalTotalPages = Math.max(preservedTotalPages || 0, pageResult.totalPages || 0) || 1;
                    const finalTotalCount = Math.max(preservedTotalCount || 0, pageResult.totalCount || 0) || pageResult.rows.length;
                    if (this.renderToken !== token) return;
                    this.displayResults({
                        rows: pageResult.rows,
                        headers: pageResult.headers,
                        totalPages: finalTotalPages,
                        totalCount: finalTotalCount,
                        currentPage: pageNum,
                        pageSize: pageResult.pageSize,
                        sourceTab: pageResult.sourceTab || sourceTab
                    }, searchType, searchContent);
                })
                .catch(error => {
                    console.error('加载第 ' + pageNum + ' 页失败:', error);
                    if (this.renderToken !== token) return;
                    restore();
                    alert('加载第 ' + pageNum + ' 页失败: ' + error.message);
                });
        }

        openDetailPanel(href, titleText, sourceTab) {
            if (!href) {
                return;
            }

            // 生成唯一窗口ID
            const panelId = 'jigui-detail-panel-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            // 更新说明图片使用自身尺寸；普通详情页继续沿用用户保存的窗口尺寸。
            const savedState = this.loadDetailPanelState();
            const isUpdateGuidePanel = this.isUpdateGuideUrl(
                href,
                this.getModuleBaseUrl(sourceTab)
            );
            const effectiveSavedState = isUpdateGuidePanel ? null : savedState;
            const windowWidth = window.innerWidth || 1920;
            const windowHeight = window.innerHeight || 1080;
            let defaultWidth = 800;
            let defaultHeight = 600;

            if (isUpdateGuidePanel) {
                const headerHeight = 40;
                const pageHorizontalSpace = 38;
                const pageVerticalSpace = 38;
                const availableWidth = Math.max(1, windowWidth - 20);
                defaultWidth = Math.min(
                    TODO_UPDATE_GUIDE_IMAGE_WIDTH + pageHorizontalSpace,
                    availableWidth
                );
                const displayedImageWidth = Math.max(1, defaultWidth - pageHorizontalSpace);
                const imageScale = Math.min(1, displayedImageWidth / TODO_UPDATE_GUIDE_IMAGE_WIDTH);
                defaultHeight = Math.min(
                    Math.max(1, windowHeight - 20),
                    Math.ceil(
                        headerHeight +
                        pageVerticalSpace +
                        TODO_UPDATE_GUIDE_IMAGE_HEIGHT * imageScale
                    )
                );
            }

            // 计算新窗口位置（避免重叠）
            let top = effectiveSavedState
                ? effectiveSavedState.top
                : (isUpdateGuidePanel ? Math.max(10, (windowHeight - defaultHeight) / 2) : 150);
            let left = effectiveSavedState
                ? effectiveSavedState.left
                : (isUpdateGuidePanel ? Math.max(10, (windowWidth - defaultWidth) / 2) : 700);
            const offset = 30; // 窗口偏移量
            if (!isUpdateGuidePanel) {
                top += (this.detailPanels.size * offset) % 200;
                left += (this.detailPanels.size * offset) % 200;
            }

            // 确保位置：顶部严格限制在窗口内，左右可拖出但至少30px在窗口内
            const dragBackMargin = 30;
            const panelWidth = effectiveSavedState ? effectiveSavedState.width : defaultWidth;
            const panelHeight = effectiveSavedState ? effectiveSavedState.height : defaultHeight;

            // 顶部：严格限制在窗口内
            if (top + panelHeight > windowHeight) top = Math.max(10, windowHeight - panelHeight - 10);
            if (top < 0) top = 10;
            // 左右：可拖出，但至少30px留在窗口内
            left = Math.max(dragBackMargin - panelWidth, Math.min(windowWidth - dragBackMargin, left));

            // 获取新的z-index
            this.maxZIndex += 1;
            const zIndex = this.maxZIndex;

            const detailPanel = document.createElement('div');
            detailPanel.id = panelId;
            detailPanel.dataset.panelId = panelId;
            detailPanel.style.cssText = `
                position: fixed !important;
                top: ${top}px !important;
                left: ${left}px !important;
                width: ${panelWidth}px !important;
                height: ${panelHeight}px !important;
                background: white !important;
                border: 1px solid #dbe3ef !important;
                border-radius: 0 !important;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16) !important;
                z-index: ${zIndex} !important;
                display: flex !important;
                flex-direction: column !important;
                font-family: "Microsoft YaHei", "微软雅黑", sans-serif !important;
                visibility: visible !important;
                opacity: 1 !important;
            `;

            // 初始化窗口状态
            const panelState = {
                isMinimized: false,
                normalState: effectiveSavedState ? {
                    top: effectiveSavedState.top + 'px',
                    left: effectiveSavedState.left + 'px',
                    width: effectiveSavedState.width + 'px',
                    height: effectiveSavedState.height + 'px',
                    maxWidth: '',
                    maxHeight: '',
                    borderRadius: ''
                } : null
            };
            this.detailPanelStates.set(panelId, panelState);

            detailPanel.innerHTML = `
                <div class="detail-header" style="background: rgb(30, 80, 220); color: white; height: 40px; padding: 0; border-radius: 0; display: flex; justify-content: space-between; align-items: center; cursor: move; min-height: 40px; box-sizing: border-box;">
                    <span class="detail-title" style="font-weight: bold; line-height: 1; display: flex; align-items: center; padding-left: 0; margin-left: -8px;">📄 ${titleText || '详情页面'}</span>
                    <div style="display: flex; align-items: center; gap: 0; height: 100%; margin-right: -6px;">
                        <button class="detail-take-no-btn" type="button" title="打开取号页面" style="display: none; align-items: center; justify-content: center; height: 28px; padding: 0; margin-right: 26px; border: none; background: transparent; color: #fff; cursor: pointer; font-size: 14px; font-weight: 800; white-space: nowrap;">去取号</button>
                        <button class="detail-copy-notice-btn" type="button" title="按当前内容复制开单" style="display: none; align-items: center; justify-content: center; height: 28px; padding: 0; margin-right: 26px; border: none; background: transparent; color: #fff; cursor: pointer; font-size: 14px; font-weight: 800; white-space: nowrap;">复制开单</button>
                        <button class="detail-todo-btn" type="button" style="display: none; align-items: center; justify-content: center; height: 28px; padding: 0; margin-right: 26px; border: none; background: transparent; color: #fff; cursor: pointer; font-size: 14px; font-weight: 800; white-space: nowrap;">通知待办</button>
                        <button class="detail-zzl-read-btn" type="button" title="读取当前制造令中的对应分项" style="display: none; align-items: center; justify-content: center; height: 28px; padding: 0; margin-right: 26px; border: none; background: transparent; color: #fff; cursor: pointer; font-size: 14px; font-weight: 800; white-space: nowrap;">读取</button>
                        <button class="detail-zzl-write-btn" type="button" title="写入已读取的制造令分项内容" style="display: none; align-items: center; justify-content: center; height: 28px; padding: 0; margin-right: 26px; border: none; background: transparent; color: #fff; cursor: pointer; font-size: 14px; font-weight: 800; white-space: nowrap;">写入</button>
                        <button class="detail-minimize-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; margin-right: 4px; transition: background-color 0.2s; line-height: 1;">
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="display:block">
                                <line x1="2" y1="6" x2="10" y2="6" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                            </svg>
                        </button>
                        <button class="detail-maximize-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; margin-right: 4px; transition: background-color 0.2s; line-height: 1;">
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="display:block">
                                <rect x="2.2" y="2.2" width="7.6" height="7.6" fill="none" stroke="white" stroke-width="1.4" />
                            </svg>
                        </button>
                        <button class="detail-close-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; transition: background-color 0.2s; line-height: 1;">
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="display:block">
                                <line x1="2.2" y1="2.2" x2="9.8" y2="9.8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                                <line x1="9.8" y1="2.2" x2="2.2" y2="9.8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <iframe class="detail-content" style="flex: 1 1 0; min-height: 0; border: none; width: 100%; height: 100%;"></iframe>
                <div class="detail-resize-handle" style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; z-index: ${zIndex + 1}; background: transparent; border-right: 2px solid rgba(37, 99, 235, 0.35); border-bottom: 2px solid rgba(37, 99, 235, 0.35);"></div>
            `;

            // 确保body存在且可见
            if (!document.body) {
                return;
            }

            document.body.appendChild(detailPanel);

            // 存储窗口引用
            this.detailPanels.set(panelId, detailPanel);
            // 向后兼容
            this.detailPanel = detailPanel;

            // 确保弹窗显示 - 使用多种方式确保可见
            detailPanel.style.setProperty('display', 'flex', 'important');
            detailPanel.style.setProperty('visibility', 'visible', 'important');
            detailPanel.style.setProperty('opacity', '1', 'important');
            detailPanel.style.setProperty('pointer-events', 'auto', 'important');

            // 强制显示，移除任何可能隐藏的类或属性
            detailPanel.removeAttribute('hidden');
            detailPanel.classList.remove('hidden');
            detailPanel.setAttribute('aria-hidden', 'false');

            // 绑定关闭按钮
            const closeBtn = detailPanel.querySelector('.detail-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeDetailPanelById(panelId);
                });
                closeBtn.addEventListener('mouseenter', () => {
                    closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                });
                closeBtn.addEventListener('mouseleave', () => {
                    closeBtn.style.backgroundColor = 'transparent';
                });
            }

            // 绑定最小化按钮
            const minimizeBtn = detailPanel.querySelector('.detail-minimize-btn');
            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDetailMinimizeById(panelId);
                });
                minimizeBtn.addEventListener('mouseenter', () => {
                    minimizeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                });
                minimizeBtn.addEventListener('mouseleave', () => {
                    minimizeBtn.style.backgroundColor = 'transparent';
                });
            }

            // 绑定最大化/恢复按钮
            const maximizeBtn = detailPanel.querySelector('.detail-maximize-btn');
            if (maximizeBtn) {
                maximizeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDetailMaximizeById(panelId);
                });
                maximizeBtn.addEventListener('mouseenter', () => {
                    maximizeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                });
                maximizeBtn.addEventListener('mouseleave', () => {
                    maximizeBtn.style.backgroundColor = 'transparent';
                });
            }

            const zzlReadBtn = detailPanel.querySelector('.detail-zzl-read-btn');
            if (zzlReadBtn) {
                zzlReadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.readZzlTransferData(panelId);
                });
            }

            const zzlWriteBtn = detailPanel.querySelector('.detail-zzl-write-btn');
            if (zzlWriteBtn) {
                zzlWriteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.writeZzlTransferData(panelId);
                });
            }

            // 点击窗口时置顶
            detailPanel.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (detailPanel.dataset.zzlRole === 'create') {
                    this.zzlActiveCreatePanelId = panelId;
                    this.refreshZzlTransferButtons();
                }
                this.bringToFront(panelId);
            });

            // 监听弹窗是否被移除，如果被移除则重新添加
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node === detailPanel || (node.nodeType === 1 && node.id === panelId)) {
                            console.warn('检测到弹窗被移除，尝试重新添加');
                            if (!document.body.contains(detailPanel)) {
                                document.body.appendChild(detailPanel);
                                detailPanel.style.setProperty('display', 'flex', 'important');
                                detailPanel.style.setProperty('visibility', 'visible', 'important');
                                detailPanel.style.setProperty('opacity', '1', 'important');
                            }
                        }
                    });
                });
            });

            // 开始观察body的变化
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 保存observer以便后续清理
            if (!this.detailPanelObservers) {
                this.detailPanelObservers = new Map();
            }
            this.detailPanelObservers.set(panelId, observer);

            // 使详情面板可拖动
            this.makeDetailDraggableById(panelId);

            // 使详情面板可调整大小
            this.makeDetailResizableById(panelId);

            // 更新标题
            const titleElement = detailPanel.querySelector('.detail-title');
            if (titleElement && titleText) {
                titleElement.textContent = '📄 ' + titleText;
            }

            // 确保弹窗可见（移除调试日志，减少控制台输出）

            // 加载内容
            this.loadDetailContentById(panelId, href, sourceTab);

            // 将窗口置顶
            this.bringToFront(panelId);

            // 再次确保弹窗显示（延迟执行，确保DOM完全渲染）
            setTimeout(() => {
                // 强制设置所有显示属性
                detailPanel.style.setProperty('display', 'flex', 'important');
                detailPanel.style.setProperty('visibility', 'visible', 'important');
                detailPanel.style.setProperty('opacity', '1', 'important');
                detailPanel.style.setProperty('pointer-events', 'auto', 'important');
                detailPanel.style.setProperty('position', 'fixed', 'important');

                // 移除可能隐藏的属性
                detailPanel.removeAttribute('hidden');
                detailPanel.classList.remove('hidden');
                detailPanel.setAttribute('aria-hidden', 'false');

                // 确保内容iframe也显示
                const contentIframe = detailPanel.querySelector('.detail-content');
                if (contentIframe) {
                    contentIframe.style.setProperty('display', 'block', 'important');
                    contentIframe.style.setProperty('visibility', 'visible', 'important');
                    contentIframe.style.setProperty('opacity', '1', 'important');
                }

                // 确保标题栏显示
                const header = detailPanel.querySelector('.detail-header');
                if (header) {
                    header.style.setProperty('display', 'flex', 'important');
                    header.style.setProperty('visibility', 'visible', 'important');
                }

                const rect = detailPanel.getBoundingClientRect();

                // 检查是否有其他元素遮挡
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const elementsAtPoint = document.elementsFromPoint(centerX, centerY);

                // 检查弹窗是否在元素栈的最上层
                const panelIndex = elementsAtPoint.indexOf(detailPanel);
                if (panelIndex > 0) {
                    // 如果被遮挡，提高z-index
                    this.maxZIndex = Math.max(this.maxZIndex, 99999);
                    detailPanel.style.setProperty('z-index', this.maxZIndex, 'important');
                }

                // 如果弹窗仍然不可见，尝试强制显示
                if (rect.width === 0 || rect.height === 0) {
                    console.warn('弹窗尺寸为0，尝试修复');
                    detailPanel.style.setProperty('width', defaultWidth + 'px', 'important');
                    detailPanel.style.setProperty('height', defaultHeight + 'px', 'important');
                }

                // 检查弹窗位置：顶部限制在视口内，左右可拖出但至少30px在视口内
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const dragBackMargin = 30;

                let needAdjust = false;
                let newLeft = rect.left;
                let newTop = rect.top;
                if (rect.top < 0 || rect.top + rect.height > viewportHeight) {
                    newTop = Math.max(10, Math.min(rect.top, viewportHeight - rect.height - 10));
                    needAdjust = true;
                }
                if (rect.left + rect.width < dragBackMargin || rect.left > viewportWidth - dragBackMargin) {
                    newLeft = Math.max(dragBackMargin - rect.width, Math.min(viewportWidth - dragBackMargin, rect.left));
                    needAdjust = true;
                }
                if (needAdjust) {
                    detailPanel.style.setProperty('left', newLeft + 'px', 'important');
                    detailPanel.style.setProperty('top', newTop + 'px', 'important');
                }

                // 尝试滚动到弹窗位置
                detailPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            return panelId;
        }

        // 将窗口置顶
        bringToFront(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            this.maxZIndex += 1;
            panel.style.setProperty('z-index', this.maxZIndex, 'important');
            panel.style.setProperty('display', 'flex', 'important');
            panel.style.setProperty('visibility', 'visible', 'important');
            panel.style.setProperty('opacity', '1', 'important');

            // 更新调整大小手柄的z-index
            const resizeHandle = panel.querySelector('.detail-resize-handle');
            if (resizeHandle) {
                resizeHandle.style.setProperty('z-index', (this.maxZIndex + 1).toString(), 'important');
            }
        }

        // 根据ID关闭窗口
        closeDetailPanelById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (panel) {
                // 停止观察
                if (this.detailPanelObservers && this.detailPanelObservers.has(panelId)) {
                    const observer = this.detailPanelObservers.get(panelId);
                    observer.disconnect();
                    this.detailPanelObservers.delete(panelId);
                }

                // 保存窗口状态
                this.saveDetailPanelStateById(panelId);
                panel.remove();
                this.detailPanels.delete(panelId);
                this.detailPanelStates.delete(panelId);
                if (this.zzlActiveCreatePanelId === panelId) {
                    this.zzlActiveCreatePanelId = '';
                    this.refreshZzlTransferButtons();
                }

                // 如果关闭的是当前detailPanel，清空引用
                if (this.detailPanel && this.detailPanel.id === panelId) {
                    this.detailPanel = null;
                }
            }
        }

        makeDetailDraggableById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const header = panel.querySelector('.detail-header');
            if (!header) return;

            header.onmousedown = (e) => {
                // 最大化状态下不能拖动
                if (panel.classList.contains('maximized')) return;
                e.preventDefault();
                e.stopPropagation();

                // 点击时置顶（在拖拽开始前执行一次，避免拖拽过程中重复调用）
                this.bringToFront(panelId);

                // 获取初始位置和鼠标位置（只执行一次，避免重复触发重排）
                const rect = panel.getBoundingClientRect();
                const startX = e.clientX;
                const startY = e.clientY;

                // 从 style 中获取原始 top/left 值，避免使用 offsetTop/offsetLeft（会触发重排）
                let originalTopValue = 0;
                let originalLeftValue = 0;
                const currentTop = panel.style.top;
                const currentLeft = panel.style.left;

                if (currentTop) {
                    originalTopValue = parseFloat(currentTop) || 0;
                } else {
                    // 如果 style 中没有，使用 getBoundingClientRect（只执行一次）
                    originalTopValue = rect.top;
                }

                if (currentLeft) {
                    originalLeftValue = parseFloat(currentLeft) || 0;
                } else {
                    originalLeftValue = rect.left;
                }

                // 获取内容区域，拖拽时禁用指针事件以减轻卡顿，但保持内容可见
                const content = panel.querySelector('.detail-content');
                let contentPointerEvents = '';
                if (content) {
                    contentPointerEvents = content.style.pointerEvents || '';
                    content.style.setProperty('pointer-events', 'none', 'important');
                }

                // 添加拖拽时的样式优化，使用 transform 提升性能
                panel.style.setProperty('will-change', 'transform', 'important');
                panel.style.setProperty('transition', 'none', 'important');
                panel.style.setProperty('pointer-events', 'auto', 'important');
                panel.style.setProperty('backface-visibility', 'hidden', 'important'); // 启用硬件加速

                let rafId = null;
                let currentDeltaX = 0;
                let currentDeltaY = 0;
                let isDragging = true;

                // 使用 requestAnimationFrame 批量更新，避免卡顿
                const updatePosition = () => {
                    if (isDragging) {
                        // 使用 transform 代替 top/left，性能更好（不触发重排，只触发重绘）
                        panel.style.setProperty('transform', `translate3d(${currentDeltaX}px, ${currentDeltaY}px, 0)`, 'important');
                        rafId = requestAnimationFrame(updatePosition);
                    }
                };

                // 启动动画帧循环
                rafId = requestAnimationFrame(updatePosition);

                const handleMouseUp = () => {
                    isDragging = false;

                    // 停止动画帧循环
                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }

                    document.onmousemove = null;
                    document.onmouseup = null;

                    // 将 transform 转换为实际的 top/left 值（使用 requestAnimationFrame 确保在下一帧执行）
                    requestAnimationFrame(() => {
                        const margin = 8;
                        const dragBackMargin = 30; // 左右可拖出窗口，但至少留30px在窗口内便于通过标题栏拖回
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        const rect = panel.getBoundingClientRect();
                        let topVal = originalTopValue + currentDeltaY;
                        let leftVal = originalLeftValue + currentDeltaX;
                        topVal = Math.max(margin, Math.min(h - rect.height - margin, topVal)); // 顶部严格限制在窗口内
                        leftVal = Math.max(dragBackMargin - rect.width, Math.min(w - dragBackMargin, leftVal)); // 左右可拖出，至少30px可见
                        const finalTop = topVal + 'px';
                        const finalLeft = leftVal + 'px';
                        panel.style.setProperty('top', finalTop, 'important');
                        panel.style.setProperty('left', finalLeft, 'important');
                        panel.style.removeProperty('transform');

                        // 移除性能优化样式
                        panel.style.removeProperty('will-change');
                        panel.style.removeProperty('transition');
                        panel.style.removeProperty('backface-visibility');

                        if (content && contentPointerEvents !== undefined) {
                            content.style.setProperty('pointer-events', contentPointerEvents || 'auto', 'important');
                        }

                        // 更新窗口状态（异步执行，不阻塞）
                        setTimeout(() => {
                            const state = this.detailPanelStates.get(panelId);
                            if (state && state.normalState) {
                                state.normalState.top = finalTop;
                                state.normalState.left = finalLeft;
                            }
                            // 拖拽结束后保存状态
                            this.saveDetailPanelStateById(panelId);
                        }, 0);
                    });
                };

                document.onmouseup = handleMouseUp;

                document.onmousemove = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const margin = 8;
                    const dragBackMargin = 30; // 左右可拖出窗口，但至少留30px在窗口内便于通过标题栏拖回
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const rect = panel.getBoundingClientRect();
                    let desiredTop = originalTopValue + (e.clientY - startY);
                    let desiredLeft = originalLeftValue + (e.clientX - startX);
                    desiredTop = Math.max(margin, Math.min(h - rect.height - margin, desiredTop)); // 顶部严格限制在窗口内
                    desiredLeft = Math.max(dragBackMargin - rect.width, Math.min(w - dragBackMargin, desiredLeft)); // 左右可拖出，至少30px可见
                    currentDeltaX = desiredLeft - originalLeftValue;
                    currentDeltaY = desiredTop - originalTopValue;
                };
            };
        }

        makeDetailResizableById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const resizeHandle = panel.querySelector('.detail-resize-handle');
            if (!resizeHandle) return;

            let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;
            const state = this.detailPanelStates.get(panelId);

            const startResize = (clientX, clientY) => {
                startX = clientX;
                startY = clientY;
                startWidth = parseInt(window.getComputedStyle(panel).width, 10);
                startHeight = parseInt(window.getComputedStyle(panel).height, 10);
                startLeft = panel.offsetLeft;
                startTop = panel.offsetTop;
            };

            let isResizing = false;
            const minWidth = 300;
            const minHeight = 200;
            const onMove = (e) => {
                if (!isResizing) return;
                e.preventDefault();
                const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
                const clientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY);
                if (clientX == null || clientY == null) return;

                const width = startWidth + (clientX - startX);
                const height = startHeight + (clientY - startY);

                if (width >= minWidth && height >= minHeight) {
                    panel.style.width = width + 'px';
                    panel.style.height = height + 'px';
                    if (state && state.normalState) {
                        state.normalState.width = width + 'px';
                        state.normalState.height = height + 'px';
                    }
                }
            };

            const onUp = (e) => {
                if (!isResizing) return;
                isResizing = false;
                window.removeEventListener('mousemove', onMove, true);
                window.removeEventListener('mouseup', onUp, true);
                window.removeEventListener('pointermove', onMove, true);
                window.removeEventListener('pointerup', onUp, true);
                window.removeEventListener('blur', onUp, true);
                document.body.style.userSelect = '';
                if (e && e.pointerId != null && resizeHandle.releasePointerCapture) {
                    try { resizeHandle.releasePointerCapture(e.pointerId); } catch (err) {}
                }
                this.saveDetailPanelStateById(panelId);
            };

            const onDown = (e) => {
                if (panel.classList.contains('maximized') || (state && state.isMinimized)) return;
                e.preventDefault();
                e.stopPropagation();
                this.bringToFront(panelId);
                startResize(e.clientX, e.clientY);
                isResizing = true;
                document.body.style.userSelect = 'none';

                if (e.pointerId != null && resizeHandle.setPointerCapture) {
                    try { resizeHandle.setPointerCapture(e.pointerId); } catch (err) {}
                    window.addEventListener('pointermove', onMove, true);
                    window.addEventListener('pointerup', onUp, true);
                } else {
                    window.addEventListener('mousemove', onMove, true);
                    window.addEventListener('mouseup', onUp, true);
                }
                window.addEventListener('blur', onUp, true);
            };

            resizeHandle.onmousedown = null;
            resizeHandle.addEventListener('pointerdown', onDown);
            resizeHandle.addEventListener('mousedown', onDown);
        }

        updateMainButtons() {
            if (!this.panel) return;

            const maximizeBtn = this._els.maximizeBtn;
            if (maximizeBtn) {
                maximizeBtn.textContent = '⛶';
                maximizeBtn.style.fontSize = '12px';
                maximizeBtn.style.fontWeight = 'bold';
                maximizeBtn.style.lineHeight = '1';
            }
        }

        updateDetailButtons() {
            if (!this.detailPanel) return;

            const maximizeBtn = this.detailPanel.querySelector('#detail-maximize-btn');

            // 所有状态下都显示相同的恢复图标样式（⛶），保持统一的字体大小和样式，确保垂直居中，第二个按钮始终加粗
            if (maximizeBtn) {
                maximizeBtn.textContent = '⛶';
                maximizeBtn.style.fontSize = '12px';
                maximizeBtn.style.fontWeight = 'bold';
                maximizeBtn.style.lineHeight = '1';
            }
        }

        /** 将 normalState 中的宽高规范为带单位的字符串，避免纯数字被写成非法 CSS */
        normalizeCssLengthPx(value, fallback) {
            if (value == null || value === '') return fallback;
            if (typeof value === 'number' && !isNaN(value)) return value + 'px';
            const s = String(value).trim();
            if (/^\d+(\.\d+)?$/.test(s)) return s + 'px';
            return s;
        }

        /**
         * 统一恢复详情 iframe 的 flex 与可见性并强制布局（同步，不含 rAF）。
         * 注意：勿在内部使用 rAF，否则「退出最大化后立即最小化」时，下一帧会把已隐藏的 iframe 又显示出来。
         */
        ensureDetailIframeVisible(panel) {
            const contentIframe = panel && panel.querySelector('.detail-content');
            if (!contentIframe) return;

            contentIframe.style.removeProperty('display');
            contentIframe.style.removeProperty('visibility');
            contentIframe.style.removeProperty('height');
            contentIframe.style.removeProperty('min-height');
            contentIframe.style.removeProperty('flex');
            contentIframe.style.removeProperty('flex-basis');
            contentIframe.style.removeProperty('opacity');
            contentIframe.style.removeProperty('overflow');
            contentIframe.style.setProperty('flex', '1 1 0', 'important');
            contentIframe.style.setProperty('min-height', '0', 'important');
            contentIframe.style.setProperty('width', '100%', 'important');
            contentIframe.style.setProperty('height', '100%', 'important');
            contentIframe.style.setProperty('visibility', 'visible', 'important');
            contentIframe.style.setProperty('opacity', '1', 'important');
            void contentIframe.offsetWidth;
            void contentIframe.offsetHeight;
            try {
                const cw = contentIframe.contentWindow;
                if (cw) cw.dispatchEvent(new Event('resize'));
            } catch (e) { /* 跨域 */ }
        }

        toggleDetailMinimizeById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const state = this.detailPanelStates.get(panelId);
            if (!state) return;

            const contentIframe = panel.querySelector('.detail-content');

            if (state.isMinimized) {
                state.isMinimized = false;

                // 获取要恢复的宽度和高度（须带单位，否则部分环境下 height 无效导致 iframe 区域高度为 0）
                const restoreWidth = this.normalizeCssLengthPx(state.normalState && state.normalState.width, '800px');
                const restoreHeight = this.normalizeCssLengthPx(state.normalState && state.normalState.height, '600px');

                // 恢复窗口大小（先恢复父级 flex 容器尺寸，再恢复 iframe，避免子级 height:100% 在父高为 0 时失效）
                const computedStyle = window.getComputedStyle(panel);
                const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
                const widthValue = parseFloat(restoreWidth) || 800;
                const totalWidth = widthValue + borderLeft + borderRight;

                let fullWindowRight;
                let fullWindowTop;
                if (state.normalState && state.normalState.fullWindowRight !== undefined) {
                    fullWindowRight = state.normalState.fullWindowRight;
                    fullWindowTop = state.normalState.fullWindowTop !== undefined ? state.normalState.fullWindowTop : panel.getBoundingClientRect().top;
                } else {
                    const currentRect = panel.getBoundingClientRect();
                    fullWindowRight = currentRect.left + currentRect.width;
                    fullWindowTop = currentRect.top;
                }

                const newLeft = fullWindowRight - totalWidth;
                const newTop = fullWindowTop;

                panel.style.setProperty('left', newLeft + 'px', 'important');
                panel.style.setProperty('top', newTop + 'px', 'important');
                panel.style.setProperty('width', restoreWidth, 'important');
                panel.style.removeProperty('min-width');
                panel.style.setProperty('height', restoreHeight, 'important');
                panel.style.removeProperty('max-height');
                panel.style.removeProperty('min-height');
                panel.style.removeProperty('overflow');
                panel.style.setProperty('background', 'white', 'important');

                const resizeHandle = panel.querySelector('.detail-resize-handle');
                if (resizeHandle) {
                    resizeHandle.style.removeProperty('display');
                }

                this.ensureDetailIframeVisible(panel);
                // 再延后两帧刷新一次，修复部分浏览器在复杂状态切换后 iframe 仍白屏的问题
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.ensureDetailIframeVisible(panel);
                    });
                });

                // 恢复后保存状态
                setTimeout(() => {
                    this.saveDetailPanelStateById(panelId);
                }, 100);
            } else {
                // 如果当前是最大化状态，先恢复窗口大小
                if (panel.classList.contains('maximized')) {
                    this.toggleDetailMaximizeById(panelId);
                }

                // 保存当前状态
                if (!state.normalState) {
                    const computedStyle = window.getComputedStyle(panel);
                    const rect = panel.getBoundingClientRect();
                    state.normalState = {
                        top: panel.style.top || computedStyle.top,
                        left: panel.style.left || computedStyle.left,
                        width: panel.style.width || computedStyle.width,
                        height: panel.style.height || computedStyle.height,
                        maxWidth: '',
                        maxHeight: '',
                        borderRadius: ''
                    };
                }

                // 保存当前整个浮窗的右上角位置（作为锚点）
                const currentRect = panel.getBoundingClientRect();
                const fullWindowRight = currentRect.left + currentRect.width;
                const fullWindowTop = currentRect.top;
                if (state.normalState) {
                    state.normalState.fullWindowRight = fullWindowRight;
                    state.normalState.fullWindowTop = fullWindowTop;
                }

                // 最小化：隐藏内容，只显示标题栏（不用 display:none，避免部分浏览器清空 iframe 内容）
                state.isMinimized = true;
                if (contentIframe) {
                    contentIframe.style.setProperty('height', '0', 'important');
                    contentIframe.style.setProperty('min-height', '0', 'important');
                    contentIframe.style.setProperty('flex', '0 0 0', 'important');
                    contentIframe.style.setProperty('overflow', 'hidden', 'important');
                    contentIframe.style.setProperty('visibility', 'hidden', 'important');
                    contentIframe.style.setProperty('opacity', '0', 'important');
                }

                // 隐藏调整大小手柄
                const resizeHandle = panel.querySelector('.detail-resize-handle');
                if (resizeHandle) {
                    resizeHandle.style.setProperty('display', 'none', 'important');
                }

                // 最小化时，浮窗宽度固定为300px
                const computedStyle = window.getComputedStyle(panel);
                const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
                const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
                const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
                const minimizeWidth = 300;
                const totalMinimizeWidth = minimizeWidth + borderLeft + borderRight;

                // 获取标题栏的实际高度
                const header = panel.querySelector('.detail-header');
                let headerHeight = 0;
                if (header) {
                    const headerRect = header.getBoundingClientRect();
                    headerHeight = headerRect.height;
                } else {
                    // 如果没有找到标题栏，使用默认高度（包括padding）
                    headerHeight = 30; // 大约的标题栏高度
                }

                // 设置窗口高度为标题栏高度（包括边框），使用 !important 确保生效
                // 使用 box-sizing: border-box 确保边框包含在高度内
                panel.style.setProperty('box-sizing', 'border-box', 'important');
                const totalHeight = headerHeight + borderTop + borderBottom;

                // 以右上角为锚点：计算新的 left 和 top
                // right 保持不变，所以 left = right - width
                const newLeft = fullWindowRight - totalMinimizeWidth;
                // top 保持不变（右上角位置不变）
                const newTop = fullWindowTop;

                panel.style.setProperty('height', totalHeight + 'px', 'important');
                panel.style.setProperty('max-height', totalHeight + 'px', 'important');
                panel.style.setProperty('min-height', totalHeight + 'px', 'important');
                panel.style.setProperty('overflow', 'hidden', 'important');
                // 最小化时将窗口背景设置为与标题栏一致，避免显示白色背景
                panel.style.setProperty('background', 'rgb(30, 80, 220)', 'important');

                // 确保标题栏背景可见
                if (header) {
                    header.style.setProperty('background', 'rgb(30, 80, 220)', 'important');
                }

                panel.style.setProperty('width', '300px', 'important');
                panel.style.removeProperty('min-width');
                panel.style.setProperty('left', newLeft + 'px', 'important');
                panel.style.setProperty('top', newTop + 'px', 'important');

                // 最小化后保存状态
                setTimeout(() => {
                    this.saveDetailPanelStateById(panelId);
                }, 100);
            }

            // 更新按钮显示状态
            this.updateDetailButtons();
        }

        toggleDetailMaximizeById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const state = this.detailPanelStates.get(panelId);
            if (!state) return;

            if (panel.classList.contains('maximized')) {
                // 恢复窗口
                panel.classList.remove('maximized');
                // 清除所有important样式
                panel.style.removeProperty('top');
                panel.style.removeProperty('left');
                panel.style.removeProperty('right');
                panel.style.removeProperty('width');
                panel.style.removeProperty('max-width');
                panel.style.removeProperty('height');
                panel.style.removeProperty('max-height');
                panel.style.removeProperty('border-radius');

                // 恢复所有保存的样式
                if (state.normalState) {
                    Object.keys(state.normalState).forEach(key => {
                        if (key !== 'fullWindowRight' && key !== 'fullWindowTop' && state.normalState[key] !== undefined && state.normalState[key] !== null) {
                            panel.style[key] = state.normalState[key];
                        } else if (key !== 'fullWindowRight' && key !== 'fullWindowTop') {
                            panel.style[key] = '';
                        }
                    });

                    // 以右上角为锚点恢复位置
                    if (state.normalState.fullWindowRight !== undefined) {
                        const computedStyle = window.getComputedStyle(panel);
                        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                        const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
                        const widthValue = parseFloat(state.normalState.width) || 800;
                        const totalWidth = widthValue + borderLeft + borderRight;
                        const newLeft = state.normalState.fullWindowRight - totalWidth;
                        const newTop = state.normalState.fullWindowTop !== undefined ? state.normalState.fullWindowTop : panel.getBoundingClientRect().top;
                        panel.style.setProperty('left', newLeft + 'px', 'important');
                        panel.style.setProperty('top', newTop + 'px', 'important');
                    }
                }

                if (state.isMinimized) {
                    const contentIframe = panel.querySelector('.detail-content');
                    if (contentIframe) {
                        contentIframe.style.setProperty('height', '0', 'important');
                        contentIframe.style.setProperty('min-height', '0', 'important');
                        contentIframe.style.setProperty('flex', '0 0 0', 'important');
                        contentIframe.style.setProperty('overflow', 'hidden', 'important');
                        contentIframe.style.setProperty('visibility', 'hidden', 'important');
                        contentIframe.style.setProperty('opacity', '0', 'important');
                    }
                    // 隐藏调整大小手柄
                    const resizeHandle = panel.querySelector('.detail-resize-handle');
                    if (resizeHandle) {
                        resizeHandle.style.setProperty('display', 'none', 'important');
                    }
                    // 获取标题栏的实际高度并设置窗口高度
                    const header = panel.querySelector('.detail-header');
                    const computedStyle = window.getComputedStyle(panel);
                    const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                    const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
                    const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
                    const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
                    let headerHeight = 0;
                    if (header) {
                        const headerRect = header.getBoundingClientRect();
                        headerHeight = headerRect.height;
                    } else {
                        headerHeight = 30;
                    }
                    const totalHeight = headerHeight + borderTop + borderBottom;
                    panel.style.setProperty('box-sizing', 'border-box', 'important');
                    panel.style.setProperty('height', totalHeight + 'px', 'important');
                    panel.style.setProperty('max-height', totalHeight + 'px', 'important');
                    panel.style.setProperty('min-height', totalHeight + 'px', 'important');
                    panel.style.setProperty('overflow', 'hidden', 'important');
                    // 最小化时将窗口背景设置为与标题栏一致，避免显示白色背景
                    panel.style.setProperty('background', 'rgb(30, 80, 220)', 'important');
                    if (header) {
                        header.style.setProperty('background', 'rgb(30, 80, 220)', 'important');
                    }

                    // 以右上角为锚点：更新位置
                    if (state.normalState && state.normalState.fullWindowRight !== undefined) {
                        const minimizeWidth = 300;
                        const totalMinimizeWidth = minimizeWidth + borderLeft + borderRight;
                        const newLeft = state.normalState.fullWindowRight - totalMinimizeWidth;
                        const newTop = state.normalState.fullWindowTop !== undefined ? state.normalState.fullWindowTop : panel.getBoundingClientRect().top;
                        panel.style.setProperty('left', newLeft + 'px', 'important');
                        panel.style.setProperty('top', newTop + 'px', 'important');
                        panel.style.setProperty('width', '300px', 'important');
                    }
                } else {
                    this.ensureDetailIframeVisible(panel);
                    const resizeHandle = panel.querySelector('.detail-resize-handle');
                    if (resizeHandle) {
                        resizeHandle.style.display = 'block';
                    }
                    panel.style.setProperty('background', 'white', 'important');
                }

                // 确保窗口在屏幕可见范围内，并在下一帧再次确保 iframe 可见
                requestAnimationFrame(() => {
                    const rect = panel.getBoundingClientRect();
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                    const dragBackMargin = 30; // 左右可拖出窗口，但至少留30px在窗口内便于通过标题栏拖回
                    let adjustedLeft = parseFloat(panel.style.left) || rect.left;
                    let adjustedTop = parseFloat(panel.style.top) || rect.top;

                    // 左右：可拖出窗口，但至少30px留在窗口内
                    if (adjustedLeft + rect.width < dragBackMargin) adjustedLeft = dragBackMargin - rect.width;
                    else if (adjustedLeft > windowWidth - dragBackMargin) adjustedLeft = windowWidth - dragBackMargin;

                    // 顶部：严格限制在窗口内
                    if (adjustedTop + rect.height < 0) adjustedTop = 10;
                    else if (adjustedTop > windowHeight) adjustedTop = windowHeight - rect.height - 10;
                    else if (adjustedTop + rect.height > windowHeight) adjustedTop = windowHeight - rect.height - 10;
                    else if (adjustedTop < 0) adjustedTop = 10;

                    if (adjustedLeft !== (parseFloat(panel.style.left) || rect.left) ||
                        adjustedTop !== (parseFloat(panel.style.top) || rect.top)) {
                        panel.style.left = adjustedLeft + 'px';
                        panel.style.top = adjustedTop + 'px';
                    }

                    if (!state.isMinimized) {
                        this.ensureDetailIframeVisible(panel);
                    }
                    setTimeout(() => {
                        this.saveDetailPanelStateById(panelId);
                    }, 100);
                });
            } else {
                // 如果是最小化状态，先恢复显示
                if (state.isMinimized) {
                    this.toggleDetailMinimizeById(panelId);
                }

                // 保存当前状态
                if (!state.normalState) {
                    const computedStyle = window.getComputedStyle(panel);
                    state.normalState = {
                        top: panel.style.top || computedStyle.top,
                        left: panel.style.left || computedStyle.left,
                        width: panel.style.width || computedStyle.width,
                        height: panel.style.height || computedStyle.height,
                        maxWidth: '',
                        maxHeight: '',
                        borderRadius: ''
                    };
                } else {
                    const computedStyle = window.getComputedStyle(panel);
                    state.normalState.top = panel.style.top || computedStyle.top;
                    state.normalState.left = panel.style.left || computedStyle.left;
                    state.normalState.width = panel.style.width || computedStyle.width;
                    state.normalState.height = panel.style.height || computedStyle.height;
                }

                // 隐藏调整大小手柄
                const resizeHandle = panel.querySelector('.detail-resize-handle');
                if (resizeHandle) {
                    resizeHandle.style.display = 'none';
                }

                // 最大化窗口：以右上角为锚点，向左下展开
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // 获取当前窗口的右上角位置作为锚点
                        const currentRect = panel.getBoundingClientRect();
                        const anchorRight = currentRect.left + currentRect.width;
                        const anchorTop = currentRect.top;

                        // 保存锚点位置到状态中
                        if (state.normalState) {
                            state.normalState.fullWindowRight = anchorRight;
                            state.normalState.fullWindowTop = anchorTop;
                        }

                        panel.classList.add('maximized');
                        // 以右上角为锚点：right = 0, top = 0
                        panel.style.setProperty('right', '0', 'important');
                        panel.style.setProperty('top', '0', 'important');
                        panel.style.setProperty('left', 'auto', 'important');
                        panel.style.setProperty('width', '100vw', 'important');
                        panel.style.setProperty('max-width', '100vw', 'important');
                        panel.style.setProperty('height', '100vh', 'important');
                        panel.style.setProperty('max-height', '100vh', 'important');
                        panel.style.setProperty('border-radius', '0', 'important');
                    });
                });
            }

            // 更新按钮显示状态
            this.updateDetailButtons();
        }

        loadDetailContentById(panelId, href, sourceTab) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const contentIframe = panel.querySelector('.detail-content');
            if (!contentIframe) return;

            // 主列表传入的链接已经绝对化；这里仅以结果来源模块进行安全兜底，不再依赖可变的 currentTab。
            const fullUrl = this.resolveModuleUrl(href, sourceTab);
            if (!fullUrl) {
                console.error('详情链接无效或不属于内网主机:', href);
                return;
            }

            // 创建通知单页面的“去取号”无需等待 iframe 加载，弹层生成后立即显示。
            this.todoManager.updateTakeNoButton(panel, fullUrl);
            console.log('加载详情页面，URL:', fullUrl);

            // 移除之前的 load 事件监听器（如果存在）
            const oldHandler = contentIframe.dataset.loadHandler;
            if (oldHandler) {
                contentIframe.removeEventListener('load', window[oldHandler]);
                delete window[oldHandler];
            }

            // 添加新的 load 事件监听器，用于检测"浏览附件"链接
            const handlerName = `iframeLoadHandler_${panelId}`;
            const loadHandler = () => {
                try {
                    // load 事件触发时同域文档已可读取，无需再额外等待。
                    const iframeDoc = contentIframe.contentDocument || contentIframe.contentWindow?.document;
                    if (!iframeDoc) {
                        // 跨域情况，无法直接访问内容
                        return;
                    }

                        // 通知单详情页显示“通知待办”，并根据原系统校核/批准字段同步完成状态。
                        this.todoManager.handleDetailLoaded(panel, contentIframe, iframeDoc, fullUrl);
                        // 识别制造令详情页或分项创建页，并立即显示“读取/写入”按钮。
                        this.configureZzlTransferPanel(panelId, iframeDoc, fullUrl);

                        // 弹窗内链接统一在新弹窗中打开，不新开浏览器标签（支持多级弹窗）
                        const self = this;
                        if (!iframeDoc.body.hasAttribute('data-jigui-link-intercept')) {
                            iframeDoc.body.setAttribute('data-jigui-link-intercept', '1');
                            iframeDoc.body.addEventListener('click', function(e) {
                                let node = e.target;
                                let anchor = null;
                                while (node && node !== iframeDoc.body) {
                                    if (node.tagName === 'A' && node.href) {
                                        anchor = node;
                                        break;
                                    }
                                    node = node.parentElement;
                                }
                                if (!anchor || !anchor.href) return;
                                // “浏览附件”不拦截；“下载”不拦截；“返回”点击后关闭当前弹窗
                                const linkText = (anchor.textContent || anchor.innerText || '').trim();
                                if (linkText === '浏览附件' || linkText.includes('浏览附件')) return;
                                if (linkText === '下载' || linkText.includes('下载')) return;
                                if (linkText === '返回' || linkText.includes('返回')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();
                                    self.closeDetailPanelById(panelId);
                                    return;
                                }
                                const href = (anchor.getAttribute('href') || '').trim();
                                if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
                                let linkUrl = anchor.href;
                                try {
                                    if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
                                        const iframeOrigin = contentIframe.contentWindow?.location?.origin || 'http://10.16.88.34';
                                        if (!linkUrl.startsWith(iframeOrigin)) return;
                                    } else {
                                        const base = contentIframe.contentWindow?.location?.href || 'http://10.16.88.34/';
                                        linkUrl = new URL(href, base).href;
                                    }
                                } catch (err) {
                                    return;
                                }
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                const titleText = (anchor.textContent || anchor.innerText || '').trim().slice(0, 50) || '详情';
                                self.openDetailPanel(linkUrl, titleText);
                            }, true);
                        }

                        // 点击弹窗内任意位置（含 iframe 内容区）时置顶，便于多弹窗时点下层可见区域即可切换到该弹窗
                        if (!iframeDoc.body.hasAttribute('data-jigui-bring-to-front')) {
                            iframeDoc.body.setAttribute('data-jigui-bring-to-front', '1');
                            iframeDoc.body.addEventListener('mousedown', function() {
                                self.bringToFront(panelId);
                            }, true);
                        }

                        // 查找包含"浏览附件"文本的所有元素
                        // 首先尝试直接查找 a 标签
                        const allLinks = iframeDoc.querySelectorAll('a');
                        const browseAttachmentElements = [];

                        // 查找包含"浏览附件"的 a 标签
                        allLinks.forEach(link => {
                            const text = (link.textContent || link.innerText || '').trim();
                            if (text === '浏览附件' || text.includes('浏览附件')) {
                                browseAttachmentElements.push(link);
                            }
                        });

                        // 如果没有找到 a 标签，查找所有元素
                        if (browseAttachmentElements.length === 0) {
                            const allElements = iframeDoc.querySelectorAll('*');
                            allElements.forEach(el => {
                                const text = (el.textContent || el.innerText || '').trim();
                                if (text === '浏览附件' || text.includes('浏览附件')) {
                                    browseAttachmentElements.push(el);
                                }
                            });
                        }

                        if (browseAttachmentElements.length > 0) {
                            console.log('找到"浏览附件"链接，数量:', browseAttachmentElements.length);

                            // 找到"浏览附件"链接，拦截点击事件
                            browseAttachmentElements.forEach(element => {
                                // 查找实际的链接元素（可能是 a 标签，或者包含链接的父元素）
                                let linkElement = element;
                                if (element.tagName !== 'A') {
                                    // 向上查找 a 标签
                                    let parent = element.parentElement;
                                    while (parent && parent !== iframeDoc.body) {
                                        if (parent.tagName === 'A' && parent.href) {
                                            linkElement = parent;
                                            break;
                                        }
                                        parent = parent.parentElement;
                                    }
                                }

                                // 添加点击事件监听器
                                const clickHandler = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();

                                    // 获取链接的 href
                                    let attachmentUrl = null;

                                    if (linkElement.tagName === 'A' && linkElement.href) {
                                        attachmentUrl = linkElement.href;
                                    } else if (element.tagName === 'A' && element.href) {
                                        attachmentUrl = element.href;
                                    } else {
                                        // 查找附近的链接
                                        let searchElement = element;
                                        for (let i = 0; i < 3 && searchElement; i++) {
                                            const nearbyLink = searchElement.querySelector('a[href]');
                                            if (nearbyLink && nearbyLink.href) {
                                                attachmentUrl = nearbyLink.href;
                                                break;
                                            }
                                            searchElement = searchElement.parentElement;
                                        }
                                    }

                                    // 如果有 onclick 属性，尝试提取 URL
                                    if (!attachmentUrl) {
                                        const onclickAttr = (element.getAttribute('onclick') || linkElement.getAttribute('onclick') || '').toString();
                                        const urlMatch = onclickAttr.match(/['"]([^'"]+)['"]/);
                                        if (urlMatch) {
                                            attachmentUrl = urlMatch[1];
                                        }
                                    }

                                    if (attachmentUrl) {
                                        // 附件相对地址以当前详情 iframe 的实际页面为基准，避免跨模块拼错目录。
                                        const iframeBaseUrl = contentIframe.contentWindow?.location?.href || fullUrl;
                                        const fullAttachmentUrl = this.resolveModuleUrl(attachmentUrl, sourceTab, iframeBaseUrl);
                                        if (!fullAttachmentUrl) {
                                            console.error('附件链接无效或不属于内网主机:', attachmentUrl);
                                            return;
                                        }

                                        console.log('获取附件列表内容，URL:', fullAttachmentUrl);

                                        // 获取当前 iframe 的 document（原始页面）
                                        const currentIframeDoc = contentIframe.contentDocument || contentIframe.contentWindow?.document;
                                        if (!currentIframeDoc) {
                                            console.error('无法访问 iframe 内容');
                                            return;
                                        }

                                        // 创建一个隐藏的临时 iframe 来加载附件页面
                                        const tempIframe = document.createElement('iframe');
                                        tempIframe.style.cssText = 'position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
                                        document.body.appendChild(tempIframe);

                                        // 监听临时 iframe 加载完成
                                        tempIframe.onload = () => {
                                            try {
                                                // 延迟一下，确保内容完全加载
                                                setTimeout(() => {
                                                    try {
                                                        const attachmentDoc = tempIframe.contentDocument || tempIframe.contentWindow?.document;
                                                        if (!attachmentDoc) {
                                                            console.error('无法访问附件页面内容（可能是跨域）');
                                                            document.body.removeChild(tempIframe);
                                                            return;
                                                        }

                                                        console.log('开始查找附件列表内容...');

                                                        // 查找附件列表内容
                                                        let attachmentContent = null;

                                                        // 首先尝试查找包含"文件名"的内容（更宽松的匹配）
                                                        const allElements = attachmentDoc.querySelectorAll('*');
                                                        let bestMatch = null;
                                                        let bestScore = 0;

                                                        for (const el of allElements) {
                                                            const text = (el.textContent || '').trim();
                                                            const lowerText = text.toLowerCase();

                                                            // 计算匹配分数
                                                            let score = 0;
                                                            if (lowerText.includes('文件名')) score += 10;
                                                            if (lowerText.includes('发布人')) score += 5;
                                                            if (lowerText.includes('下载')) score += 5;
                                                            if (lowerText.includes('附件')) score += 3;

                                                            // 如果包含关键信息且是合适的容器
                                                            if (score > 0 && (el.children.length > 0 || text.length > 30)) {
                                                                if (score > bestScore) {
                                                                    bestScore = score;
                                                                    bestMatch = el;
                                                                }
                                                            }
                                                        }

                                                        if (bestMatch && bestScore >= 10) {
                                                            attachmentContent = bestMatch;
                                                            console.log('找到附件内容，匹配分数:', bestScore);

                                                            // 如果找到的是 body 或 html，尝试查找更具体的容器
                                                            if (attachmentContent.tagName === 'BODY' || attachmentContent.tagName === 'HTML') {
                                                                // 查找包含附件信息的子元素
                                                                const children = attachmentContent.querySelectorAll('*');
                                                                for (const child of children) {
                                                                    const childText = (child.textContent || '').trim().toLowerCase();
                                                                    if (childText.includes('文件名') &&
                                                                        (childText.includes('发布人') || childText.includes('下载'))) {
                                                                        const attachmentCount = (child.textContent.match(/文件名/g) || []).length;
                                                                        if (attachmentCount >= 1) {
                                                                            attachmentContent = child;
                                                                            console.log('找到更精确的附件容器');
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        // 如果没找到，使用 body 的主要内容
                                                        if (!attachmentContent) {
                                                            console.log('未找到特定附件内容，使用 body 内容');
                                                            const body = attachmentDoc.body;
                                                            if (body) {
                                                                // 尝试查找主要内容区域
                                                                attachmentContent = body.querySelector('main, [role="main"], .content, .main, #content, #main, table, div[class*="content"], div[id*="content"]') || body;
                                                            } else {
                                                                attachmentContent = attachmentDoc.documentElement;
                                                            }
                                                        }

                                                        console.log('使用的附件内容元素:', attachmentContent.tagName, attachmentContent.className, attachmentContent.id);

                                                        // 检查是否已经添加过附件区域
                                                        let attachmentSection = currentIframeDoc.getElementById('integrated-attachment-section');
                                                        if (!attachmentSection) {
                                                            // 创建附件区域容器
                                                            attachmentSection = currentIframeDoc.createElement('div');
                                                            attachmentSection.id = 'integrated-attachment-section';
                                                            attachmentSection.style.cssText = 'margin-top: 30px; padding: 20px 20px 20px 40px; border-top: 2px solid #0066cc; background-color: #f9f9f9;';

                                                            // 添加标题
                                                            const title = currentIframeDoc.createElement('h3');
                                                            title.textContent = '附件列表';
                                                            title.style.cssText = 'color: #0066cc; font-size: 18px; font-weight: bold; margin-bottom: 15px; margin-top: 0; padding-left: 0;';
                                                            attachmentSection.appendChild(title);
                                                        } else {
                                                            // 如果已存在，确保样式正确
                                                            attachmentSection.style.paddingLeft = '40px';
                                                            // 清空内容（保留标题）
                                                            while (attachmentSection.children.length > 1) {
                                                                attachmentSection.removeChild(attachmentSection.lastChild);
                                                            }
                                                        }

                                                        // 提取附件内容
                                                        let attachmentHtml = attachmentContent.innerHTML || attachmentContent.outerHTML;

                                                        // 如果内容为空或太短，尝试获取更多内容
                                                        if (!attachmentHtml || attachmentHtml.trim().length < 50) {
                                                            console.log('附件内容太短，尝试获取更多内容');
                                                            if (attachmentContent.parentElement) {
                                                                attachmentHtml = attachmentContent.parentElement.innerHTML || attachmentContent.parentElement.outerHTML;
                                                            }
                                                        }

                                                        console.log('提取的附件内容长度:', attachmentHtml ? attachmentHtml.length : 0);

                                                        const tempDiv = currentIframeDoc.createElement('div');
                                                        tempDiv.innerHTML = attachmentHtml;
                                                        // 为附件内容添加左侧留白
                                                        tempDiv.style.cssText = 'padding-left: 0;';

                                                        // 处理相对路径链接，确保下载链接能正常工作
                                                        const baseUrl = fullAttachmentUrl.substring(0, fullAttachmentUrl.lastIndexOf('/') + 1);
                                                        const allLinks = tempDiv.querySelectorAll('a[href]');
                                                        allLinks.forEach(link => {
                                                            const href = link.getAttribute('href');
                                                            if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('javascript:')) {
                                                                if (href.startsWith('/')) {
                                                                    link.href = 'http://10.16.88.34' + href;
                                                                } else {
                                                                    link.href = baseUrl + href;
                                                                }
                                                            }
                                                        });


                                                        // 复制所有子节点到附件区域
                                                        let addedCount = 0;
                                                        while (tempDiv.firstChild) {
                                                            attachmentSection.appendChild(tempDiv.firstChild);
                                                            addedCount++;
                                                        }

                                                        // 统一附件列表展示：让图标和文字同一行
                                                        const normalizeAttachmentLayout = (root) => {
                                                            const imgs = root.querySelectorAll('img');
                                                            imgs.forEach(img => {
                                                                img.style.display = 'inline-block';
                                                                img.style.verticalAlign = 'middle';
                                                                img.style.marginRight = '6px';
                                                                const next = img.nextSibling;
                                                                if (next && next.nodeType === 1 && next.tagName === 'BR') {
                                                                    next.remove();
                                                                }
                                                                const parent = img.parentElement;
                                                                if (parent && parent !== root) {
                                                                    const tag = parent.tagName.toLowerCase();
                                                                    if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'span') {
                                                                        parent.style.display = 'flex';
                                                                        parent.style.alignItems = 'center';
                                                                        parent.style.gap = '6px';
                                                                        parent.style.flexWrap = 'wrap';
                                                                    }
                                                                }
                                                            });
                                                        };
                                                        normalizeAttachmentLayout(attachmentSection);

                                                        // 如果没有任何内容被添加，显示提示信息
                                                        if (addedCount === 0 && tempDiv.textContent.trim().length === 0) {
                                                            const noContentMsg = currentIframeDoc.createElement('p');
                                                            noContentMsg.textContent = '未找到附件内容';
                                                            noContentMsg.style.cssText = 'color: #999; font-style: italic;';
                                                            attachmentSection.appendChild(noContentMsg);
                                                        }

                                                        // 将附件区域追加到 body 底部
                                                        if (!attachmentSection.parentNode) {
                                                            currentIframeDoc.body.appendChild(attachmentSection);
                                                            console.log('附件区域已添加到 body 底部');
                                                        } else {
                                                            console.log('附件区域已存在于页面中');
                                                        }

                                                        // 滚动到底部显示附件
                                                        setTimeout(() => {
                                                            try {
                                                                attachmentSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                                            } catch (e) {
                                                                // 如果滚动失败，直接滚动到页面底部
                                                                currentIframeDoc.body.scrollTop = currentIframeDoc.body.scrollHeight;
                                                            }
                                                        }, 200);

                                                        console.log('附件列表已追加到页面底部，区域ID:', attachmentSection.id);

                                                        // 清理临时 iframe
                                                        document.body.removeChild(tempIframe);
                                                    } catch (error) {
                                                        console.error('处理附件内容时出错:', error);
                                                        document.body.removeChild(tempIframe);
                                                    }
                                                }, 500);
                                            } catch (error) {
                                                console.error('访问附件页面时出错:', error);
                                                document.body.removeChild(tempIframe);
                                            }
                                        };

                                        // 加载附件页面到临时 iframe
                                        tempIframe.src = fullAttachmentUrl;
                                    } else {
                                        console.log('无法找到"浏览附件"链接的 URL');
                                    }
                                };

                                // 在捕获阶段添加监听器，确保优先处理
                                element.addEventListener('click', clickHandler, true);

                                // 如果元素本身不是链接，也尝试在链接元素上添加
                                if (linkElement !== element && linkElement.tagName === 'A') {
                                    linkElement.addEventListener('click', clickHandler, true);
                                }
                            });
                        }
                } catch (e) {
                    // 跨域或其他错误，忽略
                    console.log('无法访问 iframe 内容（可能是跨域）:', e.message);
                }
            };

            // 保存处理器引用
            contentIframe.dataset.loadHandler = handlerName;
            window[handlerName] = loadHandler;

            // 直接使用iframe加载原页面，完全保持原系统格式
            contentIframe.addEventListener('load', loadHandler);
            contentIframe.src = fullUrl;
        }

        normalizeZzlTransferText(value) {
            return String(value == null ? '' : value)
                .replace(/\u00a0/g, ' ')
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/\s+/g, '')
                .replace(/[：:]+$/g, '')
                .trim();
        }

        getZzlCellValue(cell) {
            if (!cell) return '';
            const controls = Array.from(cell.querySelectorAll('input, select, textarea'));
            const usable = controls.find((control) => {
                const type = String(control.type || '').toLowerCase();
                return !['button', 'submit', 'reset', 'hidden', 'checkbox', 'radio'].includes(type);
            });
            if (usable) {
                if (usable.tagName === 'SELECT') {
                    const option = usable.options && usable.options[usable.selectedIndex];
                    return String(option ? (option.textContent || option.value) : usable.value || '').trim();
                }
                return String(usable.value || '').trim();
            }
            return String(cell.innerText || cell.textContent || '').replace(/\u00a0/g, ' ').trim();
        }

        expandZzlRowCells(row) {
            const result = [];
            Array.from(row && row.cells ? row.cells : []).forEach((cell) => {
                const span = Math.max(1, Number(cell.colSpan) || 1);
                for (let i = 0; i < span; i += 1) result.push(cell);
            });
            return result;
        }

        getZzlTableInfo(table) {
            if (!table || !table.rows) return null;
            const aliases = {
                serial: ['序号', '序列号'],
                description: ['描述', '名称', '物料描述'],
                drawing: ['图号', '图纸号', '图号及规格'],
                quantity: ['数量'],
                remark: ['备注']
            };
            const rows = Array.from(table.rows);
            let best = null;
            rows.forEach((row, rowIndex) => {
                const cells = this.expandZzlRowCells(row);
                const normalized = cells.map((cell) =>
                    this.normalizeZzlTransferText(this.getZzlCellValue(cell))
                );
                const indexMap = {};
                Object.keys(aliases).forEach((key) => {
                    indexMap[key] = normalized.findIndex((text) => aliases[key].includes(text));
                });
                const score = ['serial', 'description', 'drawing', 'quantity', 'remark']
                    .reduce((sum, key) => sum + (indexMap[key] >= 0 ? 1 : 0), 0);
                if (score >= 4 && (!best || score > best.score)) {
                    best = { table, rows, rowIndex, cells, indexMap, score };
                }
            });
            return best;
        }

        detectZzlCreateContext(doc) {
            if (!doc || !doc.body) return null;
            const preferred = Array.from(doc.querySelectorAll(
                'font[color="red"], font[color="#ff0000"], [style*="color: red"], [style*="color:red"], [style*="255, 0, 0"]'
            ));
            const fallback = Array.from(doc.querySelectorAll('font, span, div, td, th, b, strong'));
            const candidates = preferred.concat(fallback);
            let match = null;
            for (const element of candidates) {
                if (element.children && element.children.length > 3) continue;
                const raw = String(element.innerText || element.textContent || '').trim();
                if (!raw || /[\r\n]/.test(raw)) continue;
                const normalized = this.normalizeZzlTransferText(raw);
                const result = normalized.match(/^创建(.{1,24})$/);
                if (!result) continue;
                if (!match || normalized.length < match.raw.length) {
                    const sourceName = result[1];
                    match = {
                        raw: normalized,
                        category: sourceName === '主机部分' ? '主机' : sourceName,
                        isMain: sourceName === '主机部分'
                    };
                }
            }
            return match;
        }

        findZzlSourceTable(doc, context) {
            if (!doc || !context) return null;
            const tables = Array.from(doc.querySelectorAll('table'));
            const allElements = Array.from(doc.querySelectorAll('*'));
            const elementOrder = new Map();
            allElements.forEach((element, index) => elementOrder.set(element, index));
            const category = this.normalizeZzlTransferText(context.category);
            const categoryNames = context.isMain
                ? []
                : Array.from(new Set([
                    category,
                    category.endsWith('清单') ? category : category + '清单'
                ]));
            const categoryAnchors = context.isMain ? [] : Array.from(
                doc.querySelectorAll('td, th, font, span, div, b, strong')
            ).filter((element) => {
                const text = this.normalizeZzlTransferText(
                    element.innerText || element.textContent || ''
                );
                return categoryNames.includes(text);
            });
            const leakAnchors = context.isMain ? Array.from(
                doc.querySelectorAll('td, th, font, span, div, b, strong')
            ).filter((element) => {
                const text = this.normalizeZzlTransferText(
                    element.innerText || element.textContent || ''
                );
                return text === '漏氢量' || text.startsWith('漏氢量');
            }) : [];
            const approvalBoundaryPositions = Array.from(
                doc.querySelectorAll('tr')
            ).filter((row) => {
                const text = this.normalizeZzlTransferText(
                    row.innerText || row.textContent || ''
                );
                return text.includes('编制') &&
                    text.includes('校核') &&
                    text.includes('批准');
            }).map((row) => elementOrder.get(row))
                .filter((position) => Number.isFinite(position))
                .sort((a, b) => a - b);
            const getAnchorBoundary = (anchorPosition) =>
                approvalBoundaryPositions.find((position) =>
                    position > anchorPosition
                );
            const candidates = [];
            tables.forEach((table, order) => {
                const info = this.getZzlTableInfo(table);
                if (!info) return;
                const normalizedTableText = this.normalizeZzlTransferText(table.innerText || table.textContent || '');
                const rowsBeforeHeader = info.rows.slice(0, info.rowIndex + 1);
                const beforeText = this.normalizeZzlTransferText(
                    rowsBeforeHeader.map((row) => row.innerText || row.textContent || '').join(' ')
                );
                let matched = false;
                let score = info.score * 10;
                let contextTable = table;
                if (context.isMain) {
                    // 主机参数行和明细行可能分属两个相邻 table：
                    // 先找“漏氢量”，再选它后面最近的标准明细表。
                    const tablePosition = elementOrder.get(table);
                    let nearestLeakGap = Number.POSITIVE_INFINITY;
                    let nearestLeakAnchor = null;
                    leakAnchors.forEach((anchor) => {
                        const anchorPosition = elementOrder.get(anchor);
                        if (!Number.isFinite(anchorPosition) ||
                            !Number.isFinite(tablePosition) ||
                            anchorPosition > tablePosition) return;
                        const boundary = getAnchorBoundary(anchorPosition);
                        if (Number.isFinite(boundary) &&
                            tablePosition >= boundary) return;
                        const gap = tablePosition - anchorPosition;
                        if (gap < nearestLeakGap) {
                            nearestLeakGap = gap;
                            nearestLeakAnchor = anchor;
                        }
                    });
                    const leakInsideTable = normalizedTableText.includes('漏氢量');
                    const leakImmediatelyBeforeTable =
                        Number.isFinite(nearestLeakGap) &&
                        nearestLeakGap <= 500;
                    matched = leakInsideTable || leakImmediatelyBeforeTable;
                    if (leakInsideTable) {
                        score += 180;
                    } else if (leakImmediatelyBeforeTable) {
                        score += Math.max(60, 170 - nearestLeakGap / 4);
                    }
                    if (nearestLeakAnchor && nearestLeakAnchor.closest('table')) {
                        contextTable = nearestLeakAnchor.closest('table');
                    }
                } else {
                    // 原系统有两种结构：
                    // 1. “名称/分类名”和明细行位于同一 table；
                    // 2. 分类标题是独立 table，明细 table 紧随其后。
                    // 因此除检查表内文字外，还要按 DOM 顺序寻找该分类标题后最近的明细表。
                    const tablePosition = elementOrder.get(table);
                    let nearestAnchorGap = Number.POSITIVE_INFINITY;
                    let nearestCategoryAnchor = null;
                    categoryAnchors.forEach((anchor) => {
                        const anchorPosition = elementOrder.get(anchor);
                        if (!Number.isFinite(anchorPosition) ||
                            !Number.isFinite(tablePosition) ||
                            anchorPosition > tablePosition) return;
                        const boundary = getAnchorBoundary(anchorPosition);
                        if (Number.isFinite(boundary) &&
                            tablePosition >= boundary) return;
                        const gap = tablePosition - anchorPosition;
                        if (gap < nearestAnchorGap) {
                            nearestAnchorGap = gap;
                            nearestCategoryAnchor = anchor;
                        }
                    });
                    const categoryInsideTable = categoryNames.some((name) =>
                        beforeText.includes(name) ||
                        normalizedTableText.startsWith(name)
                    );
                    const categoryImmediatelyBeforeTable =
                        Number.isFinite(nearestAnchorGap) &&
                        nearestAnchorGap <= 500;
                    matched = categoryInsideTable || categoryImmediatelyBeforeTable;
                    if (categoryInsideTable) {
                        score += 120;
                    } else if (categoryImmediatelyBeforeTable) {
                        score += Math.max(45, 110 - nearestAnchorGap / 5);
                    }
                    if (nearestCategoryAnchor && nearestCategoryAnchor.closest('table')) {
                        contextTable = nearestCategoryAnchor.closest('table');
                    }
                }
                if (!matched) return;
                score -= Math.min(30, info.rows.length / 10);
                candidates.push({ table, info, contextTable, order, score });
            });
            if (!candidates.length) {
                // 冷却器等分项只有“安装图/型号/说明”等字段，
                // 不存在“描述/图号/数量/备注”标准明细表。
                const fallbackAnchor = categoryAnchors
                    .map((anchor) => ({
                        anchor,
                        row: anchor.closest('tr'),
                        table: anchor.closest('table'),
                        position: elementOrder.get(anchor)
                    }))
                    .filter((item) => item.row && item.table)
                    .sort((a, b) => a.position - b.position)[0];
                if (fallbackAnchor) {
                    return {
                        table: fallbackAnchor.table,
                        info: null,
                        contextTable: fallbackAnchor.table,
                        startRow: fallbackAnchor.row,
                        fieldOnly: true,
                        order: 0,
                        score: 1
                    };
                }
                return null;
            }
            candidates.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (context.isMain) return a.order - b.order;
                return a.info.rows.length - b.info.rows.length;
            });
            return candidates[0];
        }

        findZzlTargetTable(doc) {
            if (!doc) return null;
            const candidates = Array.from(doc.querySelectorAll('table'))
                .map((table, order) => ({ table, order, info: this.getZzlTableInfo(table) }))
                .filter((item) => item.info);
            if (!candidates.length) return null;
            candidates.sort((a, b) => {
                if (b.info.score !== a.info.score) return b.info.score - a.info.score;
                return a.info.rows.length - b.info.rows.length;
            });
            return candidates[0];
        }

        configureZzlTransferPanel(panelId, iframeDoc, fullUrl) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;
            panel.dataset.zzlRole = '';
            panel.dataset.zzlCategory = '';
            panel.dataset.zzlMain = '0';

            let isZzl = false;
            try {
                isZzl = new URL(fullUrl, window.location.href).pathname.toLowerCase().startsWith('/zzl/');
            } catch (e) {}
            if (!isZzl) {
                this.refreshZzlTransferButtons();
                return;
            }

            const createContext = this.detectZzlCreateContext(iframeDoc);
            if (createContext) {
                panel.dataset.zzlRole = 'create';
                panel.dataset.zzlCategory = createContext.category;
                panel.dataset.zzlMain = createContext.isMain ? '1' : '0';
                this.zzlActiveCreatePanelId = panelId;
                if (!iframeDoc.body.hasAttribute('data-zzl-create-active')) {
                    iframeDoc.body.setAttribute('data-zzl-create-active', '1');
                    iframeDoc.body.addEventListener('mousedown', () => {
                        this.zzlActiveCreatePanelId = panelId;
                        this.refreshZzlTransferButtons();
                    }, true);
                }
            } else {
                // 详情窗口只有在确实包含制造令明细表时才作为读取源。
                const hasDetailTable = Array.from(iframeDoc.querySelectorAll('table'))
                    .some((table) => Boolean(this.getZzlTableInfo(table)));
                if (hasDetailTable) panel.dataset.zzlRole = 'source';
            }
            this.refreshZzlTransferButtons();
        }

        getActiveZzlCreateContext() {
            const panel = this.detailPanels.get(this.zzlActiveCreatePanelId);
            if (!panel || panel.dataset.zzlRole !== 'create') return null;
            return {
                panel,
                panelId: panel.id,
                category: panel.dataset.zzlCategory || '',
                isMain: panel.dataset.zzlMain === '1'
            };
        }

        refreshZzlTransferButtons() {
            const active = this.getActiveZzlCreateContext();
            this.detailPanels.forEach((panel) => {
                const read = panel.querySelector('.detail-zzl-read-btn');
                const write = panel.querySelector('.detail-zzl-write-btn');
                const role = panel.dataset.zzlRole || '';
                if (read) read.style.display = role === 'source' && active ? 'flex' : 'none';
                if (write) write.style.display = role === 'create' ? 'flex' : 'none';
            });
        }

        getZzlExplanationCandidates(doc, detailTable) {
            if (!doc || !detailTable) return [];
            const allElements = Array.from(doc.querySelectorAll('*'));
            const order = new Map();
            allElements.forEach((element, index) => order.set(element, index));
            const tablePosition = order.get(detailTable);
            return Array.from(doc.querySelectorAll('td, th'))
                .filter((cell) =>
                    this.normalizeZzlTransferText(
                        cell.innerText || cell.textContent || ''
                    ) === '说明'
                )
                .map((labelCell) => {
                    const row = labelCell.closest('tr');
                    const containingTable = labelCell.closest('table');
                    const position = order.get(labelCell);
                    let distance = Number.POSITIVE_INFINITY;
                    if (containingTable === detailTable) {
                        distance = 0;
                    } else if (Number.isFinite(position) && Number.isFinite(tablePosition) &&
                        position >= tablePosition) {
                        distance = position - tablePosition;
                    }
                    return { labelCell, row, distance };
                })
                .filter((item) => Number.isFinite(item.distance) && item.distance <= 800)
                .sort((a, b) => a.distance - b.distance);
        }

        writeZzlExplanation(doc, detailTable, value) {
            if (!value) return false;
            const candidates = this.getZzlExplanationCandidates(doc, detailTable);
            for (const candidate of candidates) {
                const cells = Array.from(candidate.row && candidate.row.cells
                    ? candidate.row.cells
                    : []);
                const labelIndex = cells.indexOf(candidate.labelCell);
                const valueCells = labelIndex >= 0 ? cells.slice(labelIndex + 1) : [];
                for (const cell of valueCells) {
                    const textarea = cell.querySelector('textarea');
                    const control = textarea || this.findZzlWritableControl(cell);
                    if (control && this.setZzlControlValue(control, value)) return true;
                }
                // 个别页面把“说明”和输入框拆在相邻容器中，向后做一次短距离查找。
                let node = candidate.labelCell;
                for (let i = 0; i < 12 && node; i += 1) {
                    node = node.nextElementSibling;
                    if (!node) break;
                    const textarea = node.querySelector && node.querySelector('textarea');
                    const control = textarea || this.findZzlWritableControl(node);
                    if (control && this.setZzlControlValue(control, value)) return true;
                }
            }
            return false;
        }

        getZzlPostDetailRows(info, lastDataRowIndex) {
            if (!info || !info.table || !info.table.ownerDocument) return [];
            const docRows = Array.from(info.table.ownerDocument.querySelectorAll('tr'));
            const lastDataRow = info.rows[lastDataRowIndex];
            const startIndex = docRows.indexOf(lastDataRow);
            if (startIndex < 0) return info.rows.slice(lastDataRowIndex + 1);
            const result = [];
            for (let i = startIndex + 1; i < docRows.length && result.length < 80; i += 1) {
                const row = docRows[i];
                const rowText = this.normalizeZzlTransferText(
                    row.innerText || row.textContent || ''
                );
                if (!rowText) continue;
                // 每个制造令分项以编制/校核/批准行结束，不能越界读到下一个分项。
                if (rowText.includes('编制') &&
                    rowText.includes('校核') &&
                    rowText.includes('批准')) break;
                // 如果已经进入下一张标准明细表，也结束当前区块。
                const normalizedCells = Array.from(row.cells || []).map((cell) =>
                    this.normalizeZzlTransferText(
                        cell.innerText || cell.textContent || ''
                    )
                );
                const standardHeaderHits = ['描述', '图号', '数量', '备注']
                    .filter((label) => normalizedCells.includes(label)).length;
                if (standardHeaderHits >= 3) break;
                result.push(row);
            }
            return result;
        }

        collectZzlFieldPairsFromRows(rows, excluded) {
            const result = {};
            const embeddedLabels = [
                '备件BS',
                '工具FS',
                '出厂文件CJ',
                '试验规范',
                '碳刷牌号',
                '励磁机铭牌',
                '底漆与中间漆是否特殊要求',
                '面漆'
            ];
            const escapeRegex = (value) =>
                String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const findFlexibleLabel = (text, label) => {
                // 窄单元格会把“面漆”等字段名显示为两行，innerText 中可能实际包含
                // 空格、换行或不换行空格。匹配时允许字段名每个字符之间存在空白。
                const pattern = Array.from(label)
                    .map((char) => escapeRegex(char))
                    .join('\\s*');
                return new RegExp(pattern).exec(text);
            };
            const assignValue = (label, rawValue) => {
                let currentLabel = label;
                let remaining = String(rawValue || '').trim();
                // 有些旧页面把后续“标签+值”一起塞进前一字段的 td。
                // 按稳定字段名切开，例如“机规另开面漆机规另开”，同时兼容
                // “机规另开面\n漆机规另开”这类由窄单元格产生的文本。
                while (remaining) {
                    let nextLabel = '';
                    let nextIndex = -1;
                    let nextLength = 0;
                    embeddedLabels.forEach((candidate) => {
                        const match = findFlexibleLabel(remaining, candidate);
                        if (!match || match.index <= 0) return;
                        if (nextIndex < 0 || match.index < nextIndex) {
                            nextIndex = match.index;
                            nextLength = match[0].length;
                            nextLabel = candidate;
                        }
                    });
                    if (nextIndex < 0) {
                        result[currentLabel] = remaining;
                        break;
                    }
                    result[currentLabel] = remaining.slice(0, nextIndex).trim();
                    currentLabel = nextLabel;
                    remaining = remaining.slice(nextIndex + nextLength).trim();
                }
            };
            (rows || []).forEach((row) => {
                // 原系统经常用外层 td 包住一张内层字段表。外层行的文本会变成
                // “同主机面漆同主机”这类拼接值，只能读取不含子表的最内层字段行。
                if (row.querySelector && row.querySelector('table')) return;
                const cells = Array.from(row.cells || []);
                for (let i = 0; i + 1 < cells.length; i += 2) {
                    const label = this.normalizeZzlTransferText(
                        this.getZzlCellValue(cells[i])
                    );
                    const value = this.getZzlCellValue(cells[i + 1]).trim();
                    if (!label || !value || label === '说明' ||
                        label.length > 30 || excluded.includes(label)) continue;
                    assignValue(label, value);
                }
            });
            // 二次保护：无论字段来自哪一种旧表格 DOM 结构，只要前一字段中仍混入
            // “面漆”标签，就把它和后续值拆回独立字段，禁止写入同一个输入框。
            const paintRequirementLabel = '底漆与中间漆是否特殊要求';
            const mixedPaintValue = result[paintRequirementLabel];
            if (mixedPaintValue) {
                const match = findFlexibleLabel(mixedPaintValue, '面漆');
                if (match && match.index > 0) {
                    result[paintRequirementLabel] = mixedPaintValue
                        .slice(0, match.index)
                        .trim();
                    result['面漆'] = mixedPaintValue
                        .slice(match.index + match[0].length)
                        .trim();
                }
            }
            return result;
        }

        getZzlFieldOnlySectionRows(tableMatch) {
            const table = tableMatch && tableMatch.table;
            const startRow = tableMatch && tableMatch.startRow;
            if (!table || !startRow || !table.ownerDocument) return [];
            const docRows = Array.from(table.ownerDocument.querySelectorAll('tr'));
            const startIndex = docRows.indexOf(startRow);
            if (startIndex < 0) return [];
            const result = [];
            for (let i = startIndex; i < docRows.length && result.length < 80; i += 1) {
                const row = docRows[i];
                const rowText = this.normalizeZzlTransferText(
                    row.innerText || row.textContent || ''
                );
                if (!rowText) continue;
                if (i > startIndex &&
                    rowText.includes('编制') &&
                    rowText.includes('校核') &&
                    rowText.includes('批准')) break;
                result.push(row);
            }
            return result;
        }

        extractZzlFieldOnlyData(tableMatch, context) {
            const excluded = [
                '工号', '合同号', '项目号', '编号', '序号',
                '编制', '校核', '批准', '填单人', '创建人', '日期'
            ];
            const sectionRows = this.getZzlFieldOnlySectionRows(tableMatch);
            const fields = this.collectZzlFieldPairsFromRows(
                sectionRows,
                excluded
            );
            let explanation = '';
            sectionRows.some((row) => {
                const cells = Array.from(row.cells || []);
                const labelIndex = cells.findIndex((cell) =>
                    this.normalizeZzlTransferText(
                        this.getZzlCellValue(cell)
                    ) === '说明'
                );
                if (labelIndex < 0) return false;
                explanation = cells.slice(labelIndex + 1)
                    .map((cell) => this.getZzlCellValue(cell))
                    .filter(Boolean)
                    .join('\n')
                    .trim();
                return true;
            });
            delete fields['说明'];
            return {
                category: context.category,
                isMain: context.isMain,
                rows: [],
                fields,
                extraFields: {},
                notes: {},
                explanation,
                fieldOnly: true,
                readAt: Date.now()
            };
        }

        extractZzlTransferData(tableMatch, context) {
            if (!tableMatch.info || tableMatch.fieldOnly) {
                return this.extractZzlFieldOnlyData(tableMatch, context);
            }
            const info = tableMatch.info;
            const rows = [];
            let lastDataRowIndex = info.rowIndex;
            let dataRowsStarted = false;
            for (let rowIndex = info.rowIndex + 1; rowIndex < info.rows.length; rowIndex += 1) {
                const row = info.rows[rowIndex];
                const cells = this.expandZzlRowCells(row);
                const serialIndex = info.indexMap.serial >= 0 ? info.indexMap.serial : 0;
                const serial = this.normalizeZzlTransferText(this.getZzlCellValue(cells[serialIndex]));
                const valueAt = (key) => {
                    const index = info.indexMap[key];
                    return index >= 0 ? this.getZzlCellValue(cells[index]) : '';
                };
                const serialIsDetail = /^\d+(?:\.\d+)*$/.test(serial);
                if (serialIsDetail) {
                    dataRowsStarted = true;
                } else if (!dataRowsStarted) {
                    continue;
                } else if (serial) {
                    // 标准明细开始后，首列出现非序号文字即进入附加字段区。
                    break;
                }
                rows.push({
                    serial,
                    description: valueAt('description'),
                    drawing: valueAt('drawing'),
                    quantity: valueAt('quantity'),
                    remark: valueAt('remark')
                });
                lastDataRowIndex = rowIndex;
            }

            const fields = {};
            const excluded = ['工号', '合同号', '项目号', '编号', '序号', '编制', '校核', '批准', '填单人', '创建人', '日期'];
            const headerRows = [];
            const dataHeaderRow = info.rows[info.rowIndex];
            if (tableMatch.contextTable &&
                tableMatch.contextTable !== info.table &&
                tableMatch.contextTable.rows) {
                Array.from(tableMatch.contextTable.rows).forEach((row) => {
                    // 外层 table 可能包住整个分项。只取位于标准明细表头之前、
                    // 且本身不包含标准明细表的参数行，禁止读到底部附加字段。
                    if (row.contains(info.table)) return;
                    const relation = row.compareDocumentPosition(dataHeaderRow);
                    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) {
                        headerRows.push(row);
                    }
                });
            }
            headerRows.push(...info.rows.slice(0, info.rowIndex));
            Object.assign(
                fields,
                this.collectZzlFieldPairsFromRows(headerRows, excluded)
            );

            const postRows = this.getZzlPostDetailRows(info, lastDataRowIndex);
            const extraFields = this.collectZzlFieldPairsFromRows(postRows, excluded);
            const notes = {};
            postRows.forEach((row) => {
                const cells = Array.from(row.cells || []);
                for (let i = 0; i < cells.length - 1; i += 1) {
                    const label = this.normalizeZzlTransferText(this.getZzlCellValue(cells[i]));
                    if (!/(备注|说明|要求|执行信息)/.test(label)) continue;
                    const value = cells.slice(i + 1)
                        .map((cell) => this.getZzlCellValue(cell))
                        .filter(Boolean)
                        .join('\n')
                        .trim();
                    if (value) notes[label] = value;
                }
            });
            let explanation = '';
            postRows.some((row) => {
                const cells = Array.from(row.cells || []);
                const labelIndex = cells.findIndex((cell) =>
                    this.normalizeZzlTransferText(
                        this.getZzlCellValue(cell)
                    ) === '说明'
                );
                if (labelIndex < 0) return false;
                explanation = cells.slice(labelIndex + 1)
                    .map((cell) => this.getZzlCellValue(cell))
                    .filter(Boolean)
                    .join('\n')
                    .trim();
                return Boolean(explanation);
            });
            return {
                category: context.category,
                isMain: context.isMain,
                rows,
                fields,
                extraFields,
                notes,
                // 说明为空时必须保持为空；禁止越过当前分项的
                // “编制/校核/批准”边界向后寻找下一分项说明。
                explanation,
                readAt: Date.now()
            };
        }

        showZzlTransferStatus(panel, text, type) {
            if (!panel) return;
            if (this.todoManager &&
                typeof this.todoManager.showNoticeCopyStatus === 'function') {
                this.todoManager.showNoticeCopyStatus(
                    panel,
                    text,
                    type || 'progress'
                );
            }
        }

        readZzlTransferData(panelId) {
            const sourcePanel = this.detailPanels.get(panelId);
            const active = this.getActiveZzlCreateContext();
            if (!sourcePanel || !active) {
                this.showZzlTransferStatus(
                    sourcePanel,
                    '请先打开并激活一个制造令分项创建窗口。',
                    'warning'
                );
                return;
            }
            const iframe = sourcePanel.querySelector('.detail-content');
            let doc = null;
            try {
                doc = iframe && (iframe.contentDocument || iframe.contentWindow?.document);
            } catch (e) {}
            if (!doc) {
                this.showZzlTransferStatus(
                    sourcePanel,
                    '无法读取当前制造令页面。',
                    'warning'
                );
                return;
            }
            const matched = this.findZzlSourceTable(doc, active);
            if (!matched) {
                this.showZzlTransferStatus(
                    sourcePanel,
                    '未找到“' + active.category + '”对应的明细表。',
                    'warning'
                );
                return;
            }
            const data = this.extractZzlTransferData(matched, active);
            const fieldCount =
                Object.keys(data.fields || {}).length +
                Object.keys(data.extraFields || {}).length +
                Object.keys(data.notes || {}).length +
                (data.explanation ? 1 : 0);
            if (!data.rows.length && !fieldCount) {
                this.showZzlTransferStatus(
                    sourcePanel,
                    '已找到“' + active.category + '”表，但未识别到可复制内容。',
                    'warning'
                );
                return;
            }
            const sourceTitle = sourcePanel.querySelector('.detail-title');
            data.sourceTitle = String(sourceTitle ? sourceTitle.textContent : '').replace(/^[^0-9A-Za-z\u4e00-\u9fff]+/, '').trim();
            this.zzlTransferBuffer = data;
            this.showZzlTransferStatus(
                sourcePanel,
                '读取完成，请到“创建”界面写入',
                'success'
            );
        }

        setZzlControlValue(control, value) {
            if (!control) return false;
            const text = String(value == null ? '' : value);
            if (control.tagName === 'SELECT') {
                const normalized = this.normalizeZzlTransferText(text);
                const option = Array.from(control.options || []).find((item) =>
                    this.normalizeZzlTransferText(item.textContent || item.value) === normalized
                );
                if (!option) return false;
                control.value = option.value;
            } else {
                control.value = text;
                // 对“机规24-259”“机规XX-XXX”等引用编号突出显示，
                // 便于填写人员在提交前重点核对。普通内容恢复页面默认颜色。
                const hasMachineRuleNumber =
                    /机规\s*[A-Za-z0-9]+(?:[-－][A-Za-z0-9.]+)+/i.test(text);
                control.style.color = hasMachineRuleNumber ? '#ff0000' : '';
            }
            ['input', 'change', 'blur'].forEach((type) => {
                control.dispatchEvent(new Event(type, { bubbles: true }));
            });
            return true;
        }

        setZzlDisplayCellValue(cell, value) {
            if (!cell) return false;
            const text = String(value == null ? '' : value);
            const walker = cell.ownerDocument.createTreeWalker(
                cell,
                NodeFilter.SHOW_TEXT
            );
            let firstTextNode = null;
            let node = walker.nextNode();
            while (node) {
                if (String(node.nodeValue || '').trim()) {
                    firstTextNode = node;
                    break;
                }
                node = walker.nextNode();
            }
            if (firstTextNode) {
                firstTextNode.nodeValue = text;
            } else {
                cell.appendChild(cell.ownerDocument.createTextNode(text));
            }
            return true;
        }

        findZzlWritableControl(cell) {
            if (!cell) return null;
            return Array.from(cell.querySelectorAll('input, textarea, select')).find((control) => {
                const type = String(control.type || '').toLowerCase();
                return !control.disabled && !control.readOnly &&
                    !['button', 'submit', 'reset', 'hidden', 'checkbox', 'radio'].includes(type);
            }) || null;
        }

        findZzlWritableControlByLabel(doc, label) {
            const normalizedLabel = this.normalizeZzlTransferText(label);
            if (!doc || !normalizedLabel) return null;
            const cells = Array.from(doc.querySelectorAll('td, th'));
            for (const cell of cells) {
                if (this.normalizeZzlTransferText(
                    this.getZzlCellValue(cell)
                ) !== normalizedLabel) continue;
                let target = cell.nextElementSibling;
                while (target && !/^(TD|TH)$/.test(target.tagName)) {
                    target = target.nextElementSibling;
                }
                const control = this.findZzlWritableControl(target);
                if (control) return control;
            }
            return null;
        }

        fillZzlFieldByLabel(doc, label, value) {
            if (!value) return false;
            const control = this.findZzlWritableControlByLabel(doc, label);
            return Boolean(control && this.setZzlControlValue(control, value));
        }

        repairZzlPaintTargetFields(doc) {
            const requirementControl = this.findZzlWritableControlByLabel(
                doc,
                '底漆与中间漆是否特殊要求'
            );
            const finishPaintControl = this.findZzlWritableControlByLabel(
                doc,
                '面漆'
            );
            if (!requirementControl || !finishPaintControl) return false;

            const mixedValue = String(requirementControl.value || '');
            // 最终写入保护：旧页面可能在读取阶段把同一行后半段合并为
            // “机规另开面漆机规另开”。无论来源 DOM 如何嵌套，都在目标页
            // 将它强制拆回两个独立字段。
            const match = /面\s*漆/.exec(mixedValue);
            if (!match || match.index <= 0) return false;

            const requirementValue = mixedValue.slice(0, match.index).trim();
            const finishPaintValue = mixedValue
                .slice(match.index + match[0].length)
                .trim();
            this.setZzlControlValue(requirementControl, requirementValue);
            this.setZzlControlValue(finishPaintControl, finishPaintValue);
            return true;
        }

        writeZzlTransferData(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel || panel.dataset.zzlRole !== 'create') return;
            const context = {
                category: panel.dataset.zzlCategory || '',
                isMain: panel.dataset.zzlMain === '1'
            };
            const data = this.zzlTransferBuffer;
            if (!data) {
                this.showZzlTransferStatus(
                    panel,
                    '还没有读取内容，请先在制造令详情窗口点击“读取”。',
                    'warning'
                );
                return;
            }
            if (data.category !== context.category || Boolean(data.isMain) !== Boolean(context.isMain)) {
                this.showZzlTransferStatus(
                    panel,
                    '已读取“' + data.category + '”，与当前“' +
                        context.category + '”分类不一致。',
                    'warning'
                );
                return;
            }
            const iframe = panel.querySelector('.detail-content');
            let doc = null;
            try {
                doc = iframe && (iframe.contentDocument || iframe.contentWindow?.document);
            } catch (e) {}
            if (!doc) {
                this.showZzlTransferStatus(
                    panel,
                    '无法访问当前创建页面。',
                    'warning'
                );
                return;
            }
            const target = this.findZzlTargetTable(doc);
            if (!target && data.rows.length) {
                this.showZzlTransferStatus(
                    panel,
                    '未在创建页面中识别到明细表。',
                    'warning'
                );
                return;
            }

            const targetRows = [];
            const targetInfo = target ? target.info : null;
            if (targetInfo) {
                for (let i = targetInfo.rowIndex + 1;
                    i < targetInfo.rows.length;
                    i += 1) {
                    const row = targetInfo.rows[i];
                    const cells = this.expandZzlRowCells(row);
                    const serialIndex = targetInfo.indexMap.serial >= 0
                        ? targetInfo.indexMap.serial
                        : 0;
                    const serial = this.normalizeZzlTransferText(
                        this.getZzlCellValue(cells[serialIndex])
                    );
                    if (/^\d+(?:[.．。]\d+)*[.．。]?$/.test(serial)) {
                        targetRows.push({ row, cells, serial });
                    }
                }
            }
            if (data.rows.length && !targetRows.length) {
                this.showZzlTransferStatus(
                    panel,
                    '创建页面中没有识别到可填写的明细行。',
                    'warning'
                );
                return;
            }

            let filledRows = 0;
            targetRows.forEach((targetRow, index) => {
                const sourceRow = data.rows[index] || {
                    serial: '',
                    description: '',
                    drawing: '',
                    quantity: '',
                    remark: ''
                };
                let changed = false;
                const serialColumnIndex = targetInfo.indexMap.serial;
                if (serialColumnIndex >= 0) {
                    const serialControl = this.findZzlWritableControl(
                        targetRow.cells[serialColumnIndex]
                    );
                    if (serialControl && this.setZzlControlValue(
                        serialControl,
                        sourceRow.serial
                    )) {
                        changed = true;
                    } else if (!serialControl && this.setZzlDisplayCellValue(
                        targetRow.cells[serialColumnIndex],
                        sourceRow.serial
                    )) {
                        changed = true;
                    }
                }
                ['description', 'drawing', 'quantity', 'remark'].forEach((key) => {
                    const columnIndex = targetInfo.indexMap[key];
                    if (columnIndex < 0) return;
                    const control = this.findZzlWritableControl(
                        targetRow.cells[columnIndex]
                    );
                    if (control && this.setZzlControlValue(
                        control,
                        sourceRow[key]
                    )) changed = true;
                });
                if (changed && index < data.rows.length) filledRows += 1;
            });

            let filledFields = 0;
            Object.keys(data.fields).forEach((label) => {
                if (this.fillZzlFieldByLabel(doc, label, data.fields[label])) filledFields += 1;
            });
            Object.keys(data.extraFields || {}).forEach((label) => {
                if (this.fillZzlFieldByLabel(
                    doc,
                    label,
                    data.extraFields[label]
                )) filledFields += 1;
            });
            Object.keys(data.notes).forEach((label) => {
                if (this.fillZzlFieldByLabel(doc, label, data.notes[label])) filledFields += 1;
            });
            this.repairZzlPaintTargetFields(doc);
            const explanationWritten = target
                ? this.writeZzlExplanation(
                    doc,
                    target.table,
                    data.explanation
                )
                : this.fillZzlFieldByLabel(
                    doc,
                    '说明',
                    data.explanation
                );
            if (explanationWritten) {
                filledFields += 1;
            }

            this.showZzlTransferStatus(
                panel,
                '写入完成，请仔细核对后提交',
                'success'
            );
        }

        saveDetailPanelStateById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const state = this.detailPanelStates.get(panelId);
            if (!state) return;

            // 如果是最大化状态，不保存（恢复时应该恢复到正常状态）
            if (panel.classList.contains('maximized')) return;

            // 如果是最小化状态，保存最小化前的状态
            if (state.isMinimized && state.normalState) {
                const savedState = {
                    top: parseFloat(state.normalState.top) || 150,
                    left: parseFloat(state.normalState.left) || 700,
                    width: parseFloat(state.normalState.width) || 800,
                    height: parseFloat(state.normalState.height) || 600
                };
                localStorage.setItem('jigui_detail_panel_state', JSON.stringify(savedState));
                return;
            }

            // 保存当前状态
            const rect = panel.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(panel);
            const savedState = {
                top: rect.top,
                left: rect.left,
                width: parseFloat(computedStyle.width),
                height: parseFloat(computedStyle.height)
            };
            localStorage.setItem('jigui_detail_panel_state', JSON.stringify(savedState));

            // 更新窗口状态
            if (state.normalState) {
                state.normalState.top = panel.style.top;
                state.normalState.left = panel.style.left;
                state.normalState.width = computedStyle.width;
                state.normalState.height = computedStyle.height;
            }
        }

        loadDetailPanelState() {
            try {
                const saved = localStorage.getItem('jigui_detail_panel_state');
                if (saved) {
                    const state = JSON.parse(saved);
                    // 验证状态是否有效
                    if (state && typeof state.top === 'number' && typeof state.left === 'number' &&
                        typeof state.width === 'number' && typeof state.height === 'number') {
                        // 确保位置：顶部严格限制在窗口内，左右可拖出但至少30px在窗口内
                        const windowWidth = window.innerWidth;
                        const windowHeight = window.innerHeight;
                        const dragBackMargin = 30;
                        const minWidth = 300;
                        const minHeight = 200;

                        let top = Math.max(0, Math.min(state.top, windowHeight - minHeight));
                        let left = Math.max(dragBackMargin - state.width, Math.min(windowWidth - dragBackMargin, state.left));
                        let width = Math.max(minWidth, state.width);
                        let height = Math.max(minHeight, Math.min(state.height, windowHeight - top));

                        return { top, left, width, height };
                    }
                }
            } catch (e) {
                console.error('加载窗口状态失败:', e);
            }
            return null;
        }

        savePanelState() {
            if (!this.panel) return;

            // 如果是最大化状态，不保存位置（恢复时应该恢复到正常状态）
            if (this.panel.classList.contains('maximized')) return;

            // 保存当前位置
            const rect = this.panel.getBoundingClientRect();
            const state = {
                top: rect.top,
                left: rect.left
            };
            localStorage.setItem('jigui_panel_state', JSON.stringify(state));
        }

        loadPanelState() {
            try {
                const saved = localStorage.getItem('jigui_panel_state');
                if (saved) {
                    const state = JSON.parse(saved);
                    // 验证状态是否有效
                    if (state && typeof state.top === 'number' && typeof state.left === 'number') {
                        // 确保按钮在屏幕可见范围内
                        const windowWidth = window.innerWidth;
                        const windowHeight = window.innerHeight;
                        const buttonSize = 60; // 按钮大小

                        // 调整位置，确保在屏幕内
                        let top = Math.max(0, Math.min(state.top, windowHeight - buttonSize));
                        let left = Math.max(0, Math.min(state.left, windowWidth - buttonSize));

                        return { top, left };
                    }
                }
            } catch (e) {
                console.error('加载搜索按钮状态失败:', e);
            }
            return null;
        }

        // 预取指定标签的“首页列表信息”（只抓取+解析，不直接渲染）
        prefetchTabDefaultContent(tab) {
            const tabUrls = {
                'jigui': 'http://10.16.88.34/jigui/',
                'zhiling': 'http://10.16.88.34/zzl/',  // 制造令模块
                'tongzhi': 'http://10.16.88.34/notice/'  // 通知单模块
            };

            const indexUrl = tabUrls[tab];
            if (!indexUrl) return;

            // 已缓存或正在预取则跳过
            if (this.tabDefaultContentCache.has(tab)) {
                console.log('[预载] 跳过，已命中缓存:', tab);
                return;
            }
            if (this.tabDefaultContentPromises.has(tab)) {
                console.log('[预载] 跳过，已有进行中的请求:', tab);
                return;
            }

            console.log('[预载] 开始:', tab, indexUrl);

            const inflight = this.fetchUrl(indexUrl)
                .then(html => {
                    const parseResult = this.parseResponse(html);
                    parseResult.currentPage = 1;
                    parseResult.sourceTab = tab;
                    return parseResult;
                });

            this.tabDefaultContentPromises.set(tab, inflight);

            inflight
                .then(parseResult => {
                    this.tabDefaultContentCache.set(tab, parseResult);
                    this.tabDefaultContentPromises.delete(tab);
                    console.log('[预载] 成功:', tab, 'rows=' + ((parseResult && parseResult.rows && parseResult.rows.length) || 0));
                })
                .catch(err => {
                    console.error('[预载] 失败:', tab, err);
                    this.tabDefaultContentPromises.delete(tab);
                });
        }

        // 根据标签页加载对应的首页内容
        loadTabDefaultContent(tab, options) {
            const resultDiv = this._els.searchResult;
            if (!resultDiv) return;
            const forceRefresh = !!(options && options.forceRefresh);
            const preserveSearchType = options && options.preserveSearchType ? options.preserveSearchType : null;
            // 每次渲染首页都更新 token，用于让正在进行的异步请求失效
            const token = ++this.renderToken;
            const tabUrls = {
                'jigui': 'http://10.16.88.34/jigui/',
                'zhiling': 'http://10.16.88.34/zzl/',  // 制造令模块
                'tongzhi': 'http://10.16.88.34/notice/'  // 通知单模块
            };

            const indexUrl = tabUrls[tab];

            if (!indexUrl) {
                resultDiv.innerHTML = '<div style="color: #666; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">搜索结果</div>';
                return;
            }

            // 强制刷新：清理缓存和 inflight，直接请求最新首页内容
            if (forceRefresh) {
                this.tabDefaultContentCache.delete(tab);
                this.tabDefaultContentPromises.delete(tab);
            }

            // 命中缓存：直接渲染
            if (!forceRefresh && this.tabDefaultContentCache.has(tab)) {
                console.log('[标签加载] 命中缓存，直接渲染:', tab);
                const parseResult = this.tabDefaultContentCache.get(tab);
                parseResult.currentPage = 1;
                // 保存搜索状态，供分页使用
                this.currentSearchContent = '';
                this.currentSearchType = 'default';
                this.displayResults(parseResult, 'default', '');
                if (preserveSearchType) this.updateSearchOptions(tab, preserveSearchType);
                console.log(tab + ' 首页(缓存)渲染完成，' + (parseResult.rows ? parseResult.rows.length : 0) + ' 条');
                return;
            }

            // 如果预取仍在进行中：等待同一个 inflight promise
            const inflight = forceRefresh ? null : this.tabDefaultContentPromises.get(tab);
            if (inflight) {
                console.log('[标签加载] 复用进行中的预载请求:', tab);
            } else {
                console.log(forceRefresh ? '[标签加载] 强制刷新，发起新请求:' : '[标签加载] 未命中缓存，发起新请求:', tab, indexUrl);
            }
            resultDiv.innerHTML = '<div style="color: #0066cc; text-align: center; font-size: 20px; margin-top: 10px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">正在加载页面信息...</div>';

            const loadPromise = inflight
                ? inflight
                : this.fetchUrl(
                    forceRefresh ? this.appendNoCacheParam(indexUrl) : indexUrl,
                    null,
                    forceRefresh ? { noCache: true } : null
                ).then(html => {
                    const parseResult = this.parseResponse(html);
                    parseResult.currentPage = 1;
                    parseResult.sourceTab = tab;
                    return parseResult;
                });

            // 若是自己发起的加载，把它也纳入 inflight，避免重复请求
            if (!inflight) {
                this.tabDefaultContentPromises.set(tab, loadPromise);
            }

            loadPromise
                .then(parseResult => {
                    this.tabDefaultContentCache.set(tab, parseResult);
                    this.tabDefaultContentPromises.delete(tab);
                    console.log('[标签加载] 成功:', tab, 'rows=' + ((parseResult && parseResult.rows && parseResult.rows.length) || 0));
                    // 若在这期间又切换了标签，避免旧请求覆盖新标签内容
                    if (this.renderToken !== token) return;
                    // 保存搜索状态，供分页使用
                    this.currentSearchContent = '';
                    this.currentSearchType = 'default';
                    this.displayResults(parseResult, 'default', '');
                    if (preserveSearchType) {
                        this.updateSearchOptions(tab, preserveSearchType);
                        const state = this.tabLastViewState.get(tab) || {};
                        this.tabLastViewState.set(tab, Object.assign({}, state, {
                            searchType: preserveSearchType
                        }));
                    }
                    console.log(tab + ' 首页加载完成，' + parseResult.rows.length + ' 条');
                })
                .catch(err => {
                    console.error('加载首页失败:', err);
                    this.tabDefaultContentPromises.delete(tab);
                    if (this.renderToken !== token) return;
                    resultDiv.innerHTML = '<div style="color: red; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">加载首页失败: ' + (err && err.message ? err.message : '') + '</div>';
                });
        }

        appendNoCacheParam(url) {
            const hasQuery = url.indexOf('?') >= 0;
            return url + (hasQuery ? '&' : '?') + '_ts=' + Date.now();
        }

        // 制造令搜索（单页）
        searchZhilingPage(content, searchType, pageNum, options) {
            const quiet = options && options.quiet;
            return new Promise((resolve, reject) => {
                const encGBK = (s) => this.encodeGBK(s);
                const encURI = (s) => encodeURIComponent(s);

                // 制造令模块使用 search1.asp，参数格式：fenlei=gh&content=xxx&Submit=%B2%E9%D1%AF
                // Submit参数是GBK编码的"查询"按钮值
                const submitValue = '%B2%E9%D1%AF'; // GBK编码的"查询"

                let fenleiValue;
                if (searchType === 'gonghao') {
                    fenleiValue = 'gh';  // 工号使用 gh
                } else if (searchType === 'user') {
                    fenleiValue = 'yh';  // 用户使用 yh
                } else {
                    reject(new Error('不支持的搜索类型'));
                    return;
                }

                // 构建URL：http://10.16.88.34/zzl/search1.asp?fenlei=gh&content=xxx&Submit=%B2%E9%D1%AF
                let url = 'http://10.16.88.34/zzl/search1.asp?fenlei=' + encURI(fenleiValue) +
                           '&content=' + encGBK(content) +
                           '&Submit=' + submitValue;

                // 如果pageNum > 1，添加分页参数
                if (pageNum > 1) {
                    url = 'http://10.16.88.34/zzl/search1.asp?page=' + pageNum + '&fenlei=' + encURI(fenleiValue) +
                          '&content=' + encGBK(content) +
                          '&Submit=' + submitValue;
                }

                if (!quiet) console.log('制造令搜索第 ' + pageNum + ' 页 URL:', url);

                // 使用专门的请求方法，设置正确的Referer
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9',
                        'Referer': 'http://10.16.88.34/zzl/',  // 制造令模块的Referer
                        'Cache-Control': 'max-age=0'
                    },
                    responseType: 'arraybuffer',
                    onload: (response) => {
                        if (response.status === 200) {
                            const decoder = new TextDecoder('gb2312');
                            const html = decoder.decode(new Uint8Array(response.response));
                            const parseResult = this.parseResponse(html, options);
                            parseResult.sourceTab = 'zhiling';
                            resolve(parseResult);
                        } else {
                            reject(new Error('请求失败: ' + response.status));
                        }
                    },
                    onerror: (e) => {
                        reject(new Error('请求失败'));
                    }
                });
            });
        }

        // 制造令搜索（兼容旧接口，非工号搜索时使用）
        searchZhiling(content, searchType) {
            return this.searchZhilingPage(content, searchType, 1);
        }

        // 通知单搜索（单页）
        searchTongzhiPage(content, searchType, pageNum, options) {
            const quiet = options && options.quiet;
            return new Promise((resolve, reject) => {
                const encGBK = (s) => this.encodeGBK(s);
                const encURI = (s) => encodeURIComponent(s);
                let url;
                const baseUrl = 'http://10.16.88.34/notice/search.asp?';  // 使用notice路径

                // Submit4参数是GBK编码的"查询"按钮值
                const submitValue = '%B2%E9%D1%AF'; // GBK编码的"查询"

                let baseParams = '';
                if (searchType === 'number') {
                    baseParams = 'fenlei=number&content=' + encGBK(content) + '&d1=&d2=&Submit4=' + submitValue;
                } else if (searchType === 'product_gonghao') {
                    // 按产品工号搜索：fenlei=gonghao&content=xxx&d1=&d2=&Submit4=%B2%E9%D1%AF
                    baseParams = 'fenlei=gonghao&content=' + encGBK(content) + '&d1=&d2=&Submit4=' + submitValue;
                } else if (searchType === 'service_gonghao') {
                    // 按服务工号搜索：fenlei=fwddgh&content=xxx&d1=2002/1/1&d2=&Submit4=%B2%E9%D1%AF
                    baseParams = 'fenlei=fwddgh&content=' + encGBK(content) + '&d1=2002/1/1&d2=&Submit4=' + submitValue;
                } else if (searchType === 'picname') {
                    baseParams = 'fenlei=picname&content=' + encGBK(content) + '&d1=&d2=&Submit4=' + submitValue;
                } else if (searchType === 'writename') {
                    baseParams = 'fenlei=writename&content=' + encGBK(content) + '&d1=&d2=&Submit4=' + submitValue;
                } else {
                    reject(new Error('不支持的搜索类型'));
                    return;
                }

                // 如果pageNum > 1，添加分页参数
                if (pageNum > 1) {
                    url = baseUrl + 'page=' + pageNum + '&' + baseParams;
                } else {
                    url = baseUrl + baseParams;
                }

                if (!quiet) console.log('通知单搜索第 ' + pageNum + ' 页 URL:', url);
                this.fetchUrl(url, 'http://10.16.88.34/notice/')
                    .then(html => {
                        const parseResult = this.parseResponse(html, options);
                        parseResult.sourceTab = 'tongzhi';
                        resolve(parseResult);
                    })
                    .catch(reject);
            });
        }

        // 通知单搜索（兼容旧接口，非工号搜索时使用）
        searchTongzhi(content, searchType) {
            return this.searchTongzhiPage(content, searchType, 1);
        }

        closePanel() {
            // 如果面板处于最大化状态，恢复背景页面的滚动条
            if (this.panel && this.panel.classList.contains('maximized')) {
                if (this.bodyOverflowState !== null) {
                    document.body.style.overflow = this.bodyOverflowState;
                } else {
                    document.body.style.overflow = '';
                }
                if (this.htmlOverflowState !== null) {
                    document.documentElement.style.overflow = this.htmlOverflowState;
                } else {
                    document.documentElement.style.overflow = '';
                }
                // 移除鼠标滚轮事件监听
                this.removeWheelListener();
            }
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
            }
        }
    }

    // 初始化 - 确保DOM加载完成后再创建
    const searchPanel = new SearchPanel();

    // 如果DOM已经加载完成，立即创建；否则等待DOM加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            searchPanel.create();
        });
    } else {
        // DOM已经加载完成，立即创建
        searchPanel.create();
    }

    console.log('机规搜索工具已加载');
})();
