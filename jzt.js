// ==UserScript==
// @name         制造令/机规/通知单搜索工具
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  快捷搜索制造令/机规/通知单工具
// @author       10432987
// @match        http://10.16.88.34/notice/
// @match        http://10.16.88.34/zzl/
// @match        http://10.16.88.34/jigui/
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/gh/bestmike007/gbk-lite@master/lib/gbk-lite.min.js
// @downloadURL  https://gh.sevencdn.com/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/jzt.js
// @updateURL    https://gh.sevencdn.com/https://raw.githubusercontent.com/wd89124/tampermonkey/refs/heads/main/jzt.js
// ==/UserScript==

(function() {
    'use strict';

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

    class SearchPanel {
        constructor() {
            this.isLoading = false;
            this.panel = null;
            this.detailPanel = null; // 保留用于向后兼容
            this.detailPanels = new Map(); // 存储多个窗口，key为窗口ID，value为窗口对象
            this.detailPanelStates = new Map(); // 存储每个窗口的状态
            this.maxZIndex = 10001; // 当前最大z-index
            this.currentTab = 'zhiling'; // 默认制造令作为首页
            this.currentSearchContent = ''; // 当前搜索内容
            this.currentSearchType = 'default'; // 当前搜索类型
            this.isMinimized = false; // 默认展开状态（目标链接区域直接可见，无需点击放大镜）
            this.isDetailMinimized = false; // 弹出窗口最小化状态（保留用于向后兼容）
            this.bodyOverflowState = null; // 保存body的overflow状态
            this.htmlOverflowState = null; // 保存html的overflow状态
            this.isDragging = false; // 是否正在拖拽搜索图标按钮
        }

        create() {
            if (this.panel) return;

            // 从 localStorage 加载保存的搜索按钮位置
            const savedPanelState = this.loadPanelState();
            const defaultTop = 50;
            const defaultLeft = 50;

            const panel = document.createElement('div');
            panel.id = 'jigui-float-panel';
            panel.style.cssText = `
                position: fixed !important;
                top: ${savedPanelState ? savedPanelState.top : defaultTop}px !important;
                left: ${savedPanelState ? savedPanelState.left : defaultLeft}px !important;
                width: 60px !important;
                height: 60px !important;
                background: #0066cc !important;
                border: 2px solid #0066cc !important;
                border-radius: 50% !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
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
                <div id="jigui-tabs" style="display: none; border-bottom: 2px solid #0066cc; background: #f5f5f5; height: 40px; align-items: center; position: relative; z-index: 10; overflow: hidden;">
                    <button class="tab-btn active" data-tab="zhiling" style="width: 240px; height: 40px; padding: 0; margin: 0; background: #6a85b0; color: white; border: none; border-right: 1px solid #909090; cursor: pointer; font-weight: 600; font-size: 18px; line-height: 1; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;">制造令</button>
                    <button class="tab-btn" data-tab="jigui" style="width: 240px; height: 40px; padding: 0; margin: 0; background: #a3b4d0; color: white; border: none; border-right: 1px solid #909090; cursor: pointer; font-weight: 500; font-size: 16px; line-height: 1; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;">机规</button>
                    <button class="tab-btn" data-tab="tongzhi" style="width: 240px; height: 40px; padding: 0; margin: 0; background: #a3b4d0; color: white; border: none; cursor: pointer; font-weight: 500; font-size: 16px; line-height: 1; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;">通知单</button>
                    <div id="maximized-minimize-only" style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%); z-index: 10001; display: none;">
                        <button id="maximized-minimize-btn" style="width: 28px; height: 28px; background: #dc3545; border: 2px solid #c82333; color: white; cursor: pointer; font-size: 20px; font-weight: bold; padding: 0; border-radius: 4px; box-shadow: none; display: flex; align-items: center; justify-content: center;">−</button>
                    </div>
                </div>
                <div id="jigui-panel-content" style="display: none; flex: 1; border: none; border-right: 2px solid #0066cc; border-bottom: 2px solid #0066cc; background: #fff5e6; overflow: hidden;">
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
                                <input type="radio" id="tongzhi-number" name="tongzhi-search-type" value="number" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按编号</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; display: none;">
                                <input type="radio" id="tongzhi-product-gonghao" name="tongzhi-search-type" value="product_gonghao" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 15px; font-weight: 500;">按产品工号</span>
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
                            <input type="text" id="search-content" placeholder="搜索框" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 15px;">
                        </div>
                        <div style="padding: 0 20px;">
                            <button id="search-btn" style="width: 100%; padding: 12px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;">搜　索</button>
                        </div>
                        <div style="flex: 1; min-height: 0;"></div>
                        <div id="create-jigui-btn-wrapper" style="padding: 0 20px; padding-bottom: 20px; display: none;">
                            <button id="create-jigui-btn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;">创建机规</button>
                        </div>
                        <div id="create-tongzhi-btn-wrapper" style="padding: 0 20px; padding-bottom: 20px; display: none;">
                            <button id="create-tongzhi-btn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;">创建通知单</button>
                        </div>
                    </div>
                    <div id="search-result-area" style="flex: 1; padding: 20px; background: #fff5e6; overflow: hidden; display: flex; flex-direction: column; min-height: 0; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">
                        <div id="search-result" style="flex: 1; color: #666; text-align: center; display: flex; align-items: center; justify-content: center; font-size: 18px; overflow: auto; min-height: 0; writing-mode: horizontal-tb; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">
                            搜索结果
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);
            this.panel = panel;

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
                searchOptionsContainer: panel.querySelector('#search-options-container')
            };

            // 确保面板显示
            this.panel.style.setProperty('display', 'flex', 'important');
            this.panel.style.setProperty('visibility', 'visible', 'important');
            this.panel.style.setProperty('opacity', '1', 'important');

            const searchIconBtn = this._els.searchIconBtn;
            const content = this._els.jiguiPanelContent;
            const tabs = this._els.jiguiTabs;
            const header = this._els.panelHeader;

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
                this.panel.style.setProperty('border-radius', '8px', 'important');
                this.panel.style.setProperty('cursor', 'default', 'important');
                this.panel.style.setProperty('background', '#fff5e6', 'important');
            }

            this.attachEventListeners();
            this.makeDraggable();
            this.initTabs();

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

            // 绑定标签切换事件
            const tabButtons = this.panel.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.getAttribute('data-tab');
                    this.switchTab(tab);
                });
            });
        }

        switchTab(tab) {
            this.currentTab = tab;

            // 更新标签按钮样式（使用统一色调，点击时颜色加深、字体放大）
            const tabButtons = this.panel.querySelectorAll('.tab-btn');
            const baseColor = '#6a85b0';      // 激活状态：深蓝色
            const inactiveColor = '#a3b4d0';  // 未激活状态：浅蓝色

            tabButtons.forEach(btn => {
                const btnTab = btn.getAttribute('data-tab');
                if (btnTab === tab) {
                    btn.classList.add('active');
                    btn.style.background = baseColor;
                    btn.style.color = 'white';
                    btn.style.fontWeight = '600';
                    btn.style.fontSize = '18px';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = inactiveColor;
                    btn.style.color = 'white';
                    btn.style.fontWeight = '500';
                    btn.style.fontSize = '16px';
                }
            });

            this.updateSearchOptions(tab);
            this.loadTabDefaultContent(tab);
        }

        updateSearchOptions(tab) {
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
                    zhilingGonghao.checked = true; // 默认选中
                }
                if (zhilingUser) zhilingUser.parentElement.style.display = 'flex';
            } else if (tab === 'jigui') {
                // 机规：显示"按工号"、"按编号"、"按部件名称"、"按创建人"（单选按钮）
                if (jiguiGonghao) {
                    jiguiGonghao.parentElement.style.display = 'flex';
                    jiguiGonghao.checked = true; // 默认选中
                }
                if (jiguiNumber) jiguiNumber.parentElement.style.display = 'flex';
                if (jiguiPicname) jiguiPicname.parentElement.style.display = 'flex';
                if (jiguiWritename) jiguiWritename.parentElement.style.display = 'flex';
                // 显示"创建机规"按钮
                const createJiguiWrapper = this._els && this._els.createJiguiBtnWrapper;
                if (createJiguiWrapper) createJiguiWrapper.style.display = 'block';
            } else if (tab === 'tongzhi') {
                // 通知单：显示所有单选按钮
                if (tongzhiNumber) {
                    tongzhiNumber.parentElement.style.display = 'flex';
                    tongzhiNumber.checked = true; // 默认选中
                }
                if (tongzhiProductGonghao) tongzhiProductGonghao.parentElement.style.display = 'flex';
                if (tongzhiServiceGonghao) tongzhiServiceGonghao.parentElement.style.display = 'flex';
                if (tongzhiPicname) tongzhiPicname.parentElement.style.display = 'flex';
                if (tongzhiWritename) tongzhiWritename.parentElement.style.display = 'flex';
                // 显示"创建通知单"按钮
                const createTongzhiWrapper = this._els && this._els.createTongzhiBtnWrapper;
                if (createTongzhiWrapper) createTongzhiWrapper.style.display = 'block';
            }
            // 非机规标签时隐藏"创建机规"按钮
            if (tab !== 'jigui') {
                const createJiguiWrapper = this._els && this._els.createJiguiBtnWrapper;
                if (createJiguiWrapper) createJiguiWrapper.style.display = 'none';
            }
            // 非通知单标签时隐藏"创建通知单"按钮
            if (tab !== 'tongzhi') {
                const createTongzhiWrapper = this._els && this._els.createTongzhiBtnWrapper;
                if (createTongzhiWrapper) createTongzhiWrapper.style.display = 'none';
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

            if (searchBtn) {
                searchBtn.addEventListener('click', () => this.performSearch());
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
                        const href = link.getAttribute('data-href');
                        const linkText = link.textContent || link.innerText || '';
                        if (href) this.openDetailPanel(href, linkText);
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
                this.panel.style.background = '#fff5e6';

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
                    this.panel.style.background = this.normalState.background || '#fff5e6';

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
                this.panel.style.background = '#fff5e6';
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
            if (resultDiv) resultDiv.innerHTML = '<div style="color: #0066cc; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">正在搜索...</div>';

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
                            currentPage: 1
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

        // 并发池：最多 limit 个任务同时执行，保证真正并发（避免环境串行化）
        _runWithConcurrencyLimit(tasks, limit) {
            const results = [];
            let nextIndex = 0;
            let running = 0;
            return new Promise((resolve, reject) => {
                const runOne = () => {
                    if (nextIndex >= tasks.length && running === 0) {
                        resolve(results);
                        return;
                    }
                    while (running < limit && nextIndex < tasks.length) {
                        const i = nextIndex++;
                        running++;
                        tasks[i]().then(
                            value => { results[i] = value; running--; runOne(); },
                            err => { running--; reject(err); }
                        );
                    }
                };
                runOne();
            });
        }

        // 搜索所有页面的结果（按工号：第1页与第2~6页同时进并发池，再视总页数拉取剩余页）
        searchJiguiAllPages(content, searchType) {
            const self = this;
            const CONCURRENCY = 6;
            const INITIAL_PAGES = 6;
            return new Promise((resolve, reject) => {
                if (searchType !== 'gonghao') {
                    self.searchJiguiPage(content, searchType, 1)
                        .then(first => resolve({ headers: first.headers, rows: first.rows, totalPages: first.totalPages || 1, totalCount: first.totalCount || first.rows.length, currentPage: 1 }))
                        .catch(reject);
                    return;
                }
                const initialTasks = [];
                for (let pageNum = 1; pageNum <= INITIAL_PAGES; pageNum++) {
                    initialTasks.push(() =>
                        self.searchJiguiPage(content, searchType, pageNum, pageNum === 1 ? undefined : { quiet: true })
                            .then(res => ({ pageNum, res }))
                            .catch(err => ({ pageNum, res: null, err }))
                    );
                }
                console.log('[机规] 第 1~' + INITIAL_PAGES + ' 页同时进并发池，共 ' + INITIAL_PAGES + ' 个请求');
                self._runWithConcurrencyLimit(initialTasks, CONCURRENCY)
                    .then(initialResults => {
                        const firstRes = initialResults[0] && initialResults[0].res;
                        if (!firstRes) return Promise.reject(initialResults[0] && initialResults[0].err || new Error('第1页获取失败'));
                        const totalPages = firstRes.totalPages;
                        const totalCount = firstRes.totalCount;
                        const allHeaders = firstRes.headers;
                        let allRows = [];
                        const useCount = Math.min(totalPages, INITIAL_PAGES);
                        for (let i = 0; i < useCount; i++) {
                            const r = initialResults[i] && initialResults[i].res;
                            if (r && r.rows) allRows = allRows.concat(r.rows);
                        }
                        console.log('第 1~' + useCount + ' 页获取完成，总页数: ' + totalPages + '，当前共 ' + allRows.length + ' 条');

                        if (totalPages <= INITIAL_PAGES) {
                            console.log('所有页面获取完成，共 ' + allRows.length + ' 条数据');
                            return { headers: allHeaders, rows: allRows, totalPages: totalPages, totalCount: totalCount, currentPage: totalPages };
                        }
                        const restCount = totalPages - INITIAL_PAGES;
                        console.log('[机规] 使用并发池拉取第 ' + (INITIAL_PAGES + 1) + ' 至 ' + totalPages + ' 页，共 ' + restCount + ' 页');
                        const tasks = [];
                        for (let pageNum = INITIAL_PAGES + 1; pageNum <= totalPages; pageNum++) {
                            tasks.push(() =>
                                self.searchJiguiPage(content, searchType, pageNum, { quiet: true })
                                    .then(pageResult => {
                                        console.log('第 ' + pageNum + ' 页获取完成，' + pageResult.rows.length + ' 条数据');
                                        return { pageNum, rows: pageResult.rows };
                                    })
                                    .catch(error => {
                                        console.error('第 ' + pageNum + ' 页获取失败:', error);
                                        return { pageNum, rows: [] };
                                    })
                            );
                        }
                        return self._runWithConcurrencyLimit(tasks, CONCURRENCY).then(restResults => {
                            restResults.sort((a, b) => a.pageNum - b.pageNum);
                            restResults.forEach(r => { allRows = allRows.concat(r.rows); });
                            console.log('所有页面获取完成，共 ' + allRows.length + ' 条数据');
                            return { headers: allHeaders, rows: allRows, totalPages: totalPages, totalCount: totalCount, currentPage: totalPages };
                        });
                    })
                    .then(resolve)
                    .catch(reject);
            });
        }

        // GBK 编码：机规系统使用 GBK/GB2312，搜索参数需与直接搜索一致
        // 优先使用 gbk-lite（@require）对全部文字正确编码；不可用时回退
        encodeGBK(str) {
            if (!str) return '';
            if (typeof GBK !== 'undefined') {
                try {
                    const bytes = GBK.toBytes(GBK.fromString(str));
                    return bytes.map(b => '%' + (b & 0xFF).toString(16).toUpperCase().padStart(2, '0')).join('');
                } catch (e) {
                    console.warn('encodeGBK(gbk-lite):', e);
                }
            }
            let result = '';
            for (let i = 0; i < str.length; i++) {
                const char = str.charAt(i);
                const code = char.charCodeAt(0);
                if (code < 0x80) {
                    result += encodeURIComponent(char);
                } else {
                    const escaped = escape(char);
                    if (escaped.startsWith('%u')) {
                        const utf16 = parseInt(escaped.slice(2), 16);
                        const gbkBytes = this.unicodeToGBKBytes(utf16);
                        if (gbkBytes) {
                            result += '%' + gbkBytes[0].toString(16).toUpperCase().padStart(2, '0') +
                                     '%' + gbkBytes[1].toString(16).toUpperCase().padStart(2, '0');
                        } else {
                            result += encodeURIComponent(char);
                        }
                    } else {
                        result += escaped;
                    }
                }
            }
            return result;
        }

        unicodeToGBKBytes(unicode) {
            const commonChars = {
                0x6C49: [0xBA, 0xBA], 0x897F: [0xCE, 0xF7],
                0x6CB9: [0xD3, 0xCD], 0x6F06: [0xC6, 0xE1],
            };
            if (commonChars[unicode]) return commonChars[unicode];
            if (unicode >= 0x4E00 && unicode <= 0x9FA5) {
                const gbk = 0xA1A0 + (unicode - 0x4E00);
                return [(gbk >> 8) & 0xFF, gbk & 0xFF];
            }
            return null;
        }

        // 通用：GET 指定 URL，gb2312 解码后返回 HTML 字符串
        fetchUrl(url, referer) {
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
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9',
                        'Referer': referer,
                        'Cache-Control': 'max-age=0'
                    },
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
                    const perPageRe = /(?:每页\s*(\d+)\s*条|(\d+)\s*篇(?:\s*文章)?\s*\/\s*页|(\d+)\s*条\s*\/\s*页)/g;
                    let m;
                    while ((m = perPageRe.exec(str)) !== null) {
                        const n = parseInt(m[1] || m[2] || m[3], 10);
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
                return { headers: headers, rows: rows, totalPages: totalPages, totalCount: totalCount };
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

            return { headers: headers, rows: rows, totalPages: totalPages, totalCount: totalCount };
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

        displayResults(parseResult, searchType, searchContent) {
            const resultDiv = this._els.searchResult;
            if (!resultDiv) return;
            let results = parseResult.rows;
            const headers = parseResult.headers;
            let totalPages = parseResult.totalPages || 1;
            let totalCount = parseResult.totalCount || results.length;
            const currentPage = parseResult.currentPage || 1;

            if (results.length === 0) {
                const msg = searchType === 'default'
                    ? '未解析到列表，请使用搜索'
                    : '未找到结果';
                resultDiv.innerHTML = '<div style="color: #666; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">' + msg + '</div>';
                return;
            }

            const isDefault = searchType === 'default';

            // 计算每页条数
            const pageSize = results.length > 0 && totalPages > 0 ? Math.ceil(totalCount / totalPages) : results.length;

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
            if (this.currentTab === 'zhiling' && headers.length > 0) {
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
                        if (this.currentTab === 'zhiling') {
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
                        const isJiguiOrTongzhiLink = this.currentTab === 'jigui' || this.currentTab === 'tongzhi';
                        const isRedStatusLink = isJiguiOrTongzhiLink && (String(linkText).trim() === '未校核' || String(linkText).trim() === '未批准' || String(linkText).trim() === '未分发');
                        const linkStyle = isRedStatusLink ? 'color: red !important; text-decoration: underline; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;' : 'color: #0066cc; text-decoration: underline; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;';
                        cellParts.push(tdOpen + '<a href="javascript:void(0)" data-href="' + href + '" class="jigui-detail-link" style="' + linkStyle + '">' + linkText + '</a></td>');
                    } else {
                        const cellStr = String(cell);
                        const isJiguiOrTongzhi = this.currentTab === 'jigui' || this.currentTab === 'tongzhi';
                        const isRedStatus = isJiguiOrTongzhi && (cellStr.trim() === '未校核' || cellStr.trim() === '未批准' || cellStr.trim() === '未分发');
                        const cellContent = isRedStatus ? '<span style="color: red !important;">' + cellStr + '</span>' : cellStr;
                        cellParts.push(tdOpen + cellContent + '</td>');
                    }
                }
                rowParts.push('<tr style="border-bottom: 1px solid #999;">' + cellParts.join('') + '</tr>');
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
        }

        // 跳转到指定页（非工号搜索时使用，只显示该页数据）
        loadPage(searchContent, searchType, pageNum) {
            const resultDiv = this._els.searchResult;
            const paginationDiv = resultDiv ? resultDiv.querySelector('.jigui-pagination') : null;

            if (paginationDiv) {
                paginationDiv.style.pointerEvents = 'none';
                paginationDiv.style.opacity = '0.6';
            }

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

            // 根据当前标签页和搜索类型选择对应的搜索函数
            let searchPromise;
            if (searchType === 'default') {
                // 默认列表：直接访问首页URL并添加page参数
                const tabUrls = {
                    'jigui': 'http://10.16.88.34/jigui/',
                    'zhiling': 'http://10.16.88.34/zzl/',
                    'tongzhi': 'http://10.16.88.34/notice/'
                };
                const baseUrl = tabUrls[this.currentTab] || tabUrls['jigui'];
                const url = pageNum > 1 ? baseUrl + '?page=' + pageNum : baseUrl;
                searchPromise = this.fetchUrl(url).then(html => {
                    const parseResult = this.parseResponse(html);
                    parseResult.currentPage = pageNum;
                    return parseResult;
                });
            } else if (this.currentTab === 'tongzhi') {
                searchPromise = this.searchTongzhiPage(searchContent, searchType, pageNum);
            } else if (this.currentTab === 'jigui') {
                searchPromise = this.searchJiguiPage(searchContent, searchType, pageNum);
            } else if (this.currentTab === 'zhiling') {
                searchPromise = this.searchZhilingPage(searchContent, searchType, pageNum);
            } else {
                searchPromise = this.searchJiguiPage(searchContent, searchType, pageNum);
            }

            searchPromise
                .then(pageResult => {
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
                            const baseUrl = tabUrls[this.currentTab] || tabUrls['jigui'];
                            firstPagePromise = this.fetchUrl(baseUrl).then(html => {
                                const parseResult = this.parseResponse(html);
                                parseResult.currentPage = 1;
                                return parseResult;
                            });
                        } else if (this.currentTab === 'tongzhi') {
                            firstPagePromise = this.searchTongzhiPage(searchContent, searchType, 1);
                        } else if (this.currentTab === 'jigui') {
                            firstPagePromise = this.searchJiguiPage(searchContent, searchType, 1);
                        } else if (this.currentTab === 'zhiling') {
                            firstPagePromise = this.searchZhilingPage(searchContent, searchType, 1);
                        } else {
                            firstPagePromise = this.searchJiguiPage(searchContent, searchType, 1);
                        }
                        return firstPagePromise.then(p1 => {
                            // 重新解析第1页以获取正确的 totalPages 和 totalCount
                            const finalTotalPages = p1.totalPages || preservedTotalPages || 1;
                            const finalTotalCount = p1.totalCount || preservedTotalCount || p1.rows.length;
                            this.displayResults({
                                rows: p1.rows,
                                headers: p1.headers,
                                totalPages: finalTotalPages,
                                totalCount: finalTotalCount,
                                currentPage: 1
                            }, searchType, searchContent);
                        });
                    }
                    // 取较大值：若后续页 HTML 含更大总页数/总条数（如 页次 2/4），则采用以纠正首页解析不足
                    const finalTotalPages = Math.max(preservedTotalPages || 0, pageResult.totalPages || 0) || 1;
                    const finalTotalCount = Math.max(preservedTotalCount || 0, pageResult.totalCount || 0) || pageResult.rows.length;
                    this.displayResults({
                        rows: pageResult.rows,
                        headers: pageResult.headers,
                        totalPages: finalTotalPages,
                        totalCount: finalTotalCount,
                        currentPage: pageNum
                    }, searchType, searchContent);
                })
                .catch(error => {
                    console.error('加载第 ' + pageNum + ' 页失败:', error);
                    restore();
                    alert('加载第 ' + pageNum + ' 页失败: ' + error.message);
                });
        }

        openDetailPanel(href, titleText) {
            if (!href) {
                return;
            }

            // 生成唯一窗口ID
            const panelId = 'jigui-detail-panel-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            // 从 localStorage 加载保存的窗口位置和大小
            const savedState = this.loadDetailPanelState();
            const defaultTop = 150;
            const defaultLeft = 700;
            const defaultWidth = 800;
            const defaultHeight = 600;

            // 计算新窗口位置（避免重叠）
            let top = savedState ? savedState.top : defaultTop;
            let left = savedState ? savedState.left : defaultLeft;
            const offset = 30; // 窗口偏移量
            top += (this.detailPanels.size * offset) % 200;
            left += (this.detailPanels.size * offset) % 200;

            // 确保位置在屏幕可见范围内
            const windowWidth = window.innerWidth || 1920;
            const windowHeight = window.innerHeight || 1080;
            const panelWidth = savedState ? savedState.width : defaultWidth;
            const panelHeight = savedState ? savedState.height : defaultHeight;

            // 调整位置，确保在屏幕内
            if (left + panelWidth > windowWidth) {
                left = Math.max(10, windowWidth - panelWidth - 10);
            }
            if (top + panelHeight > windowHeight) {
                top = Math.max(10, windowHeight - panelHeight - 10);
            }
            if (left < 0) left = 10;
            if (top < 0) top = 10;

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
                width: ${savedState ? savedState.width : defaultWidth}px !important;
                height: ${savedState ? savedState.height : defaultHeight}px !important;
                background: white !important;
                border: 2px solid #0066cc !important;
                border-radius: 0 !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
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
                normalState: savedState ? {
                    top: savedState.top + 'px',
                    left: savedState.left + 'px',
                    width: savedState.width + 'px',
                    height: savedState.height + 'px',
                    maxWidth: '',
                    maxHeight: '',
                    borderRadius: ''
                } : null
            };
            this.detailPanelStates.set(panelId, panelState);

            detailPanel.innerHTML = `
                <div class="detail-header" style="background: #0066cc; color: white; padding: 5px 8px; border-radius: 0; display: flex; justify-content: space-between; align-items: center; cursor: move; min-height: 0;">
                    <span class="detail-title" style="font-weight: bold; line-height: 1;">📄 ${titleText || '详情页面'}</span>
                    <div style="display: flex; align-items: center; gap: 0; height: 100%;">
                        <button class="detail-minimize-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; font-size: 14px; font-weight: 400; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; margin-right: 8px; transition: background-color 0.2s; line-height: 1;">─</button>
                        <button class="detail-maximize-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; margin-right: 8px; transition: background-color 0.2s; line-height: 1;">⛶</button>
                        <button class="detail-close-btn" style="width: 24px; height: 24px; background: none; border: none; color: white; cursor: pointer; font-size: 16px; font-weight: 400; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; transition: background-color 0.2s; line-height: 1;">×</button>
                    </div>
                </div>
                <iframe class="detail-content" style="flex: 1; border: none; width: 100%; height: 100%;"></iframe>
                <div class="detail-resize-handle" style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; z-index: ${zIndex + 1}; background: transparent; border-right: 2px solid #0066cc; border-bottom: 2px solid #0066cc;"></div>
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

            // 点击窗口时置顶
            detailPanel.addEventListener('mousedown', (e) => {
                e.stopPropagation();
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
            this.loadDetailContentById(panelId, href);

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

                // 检查弹窗是否在视口内
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // 如果弹窗不在视口内，调整位置
                if (rect.right > viewportWidth || rect.bottom > viewportHeight || rect.left < 0 || rect.top < 0) {
                    let newLeft = Math.max(10, Math.min(rect.left, viewportWidth - rect.width - 10));
                    let newTop = Math.max(10, Math.min(rect.top, viewportHeight - rect.height - 10));
                    detailPanel.style.setProperty('left', newLeft + 'px', 'important');
                    detailPanel.style.setProperty('top', newTop + 'px', 'important');
                }

                // 尝试滚动到弹窗位置
                detailPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
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

                // 如果关闭的是当前detailPanel，清空引用
                if (this.detailPanel && this.detailPanel.id === panelId) {
                    this.detailPanel = null;
                }
            }
        }

        // 向后兼容的关闭方法
        closeDetailPanel() {
            if (this.detailPanel) {
                this.closeDetailPanelById(this.detailPanel.id);
            }
        }

        makeDetailDraggable() {
            if (this.detailPanel) {
                this.makeDetailDraggableById(this.detailPanel.id);
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

                // 获取内容区域，拖拽时用 visibility 隐藏（不脱离布局，滚动位置不会丢失）
                const content = panel.querySelector('.detail-content');
                let contentVisibility = '';
                if (content) {
                    contentVisibility = content.style.visibility || '';
                    content.style.setProperty('visibility', 'hidden', 'important');
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
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        const rect = panel.getBoundingClientRect();
                        let topVal = originalTopValue + currentDeltaY;
                        let leftVal = originalLeftValue + currentDeltaX;
                        topVal = Math.max(margin, Math.min(h - rect.height - margin, topVal));
                        leftVal = Math.max(margin, Math.min(w - rect.width - margin, leftVal));
                        const finalTop = topVal + 'px';
                        const finalLeft = leftVal + 'px';
                        panel.style.setProperty('top', finalTop, 'important');
                        panel.style.setProperty('left', finalLeft, 'important');
                        panel.style.removeProperty('transform');

                        // 移除性能优化样式
                        panel.style.removeProperty('will-change');
                        panel.style.removeProperty('transition');
                        panel.style.removeProperty('backface-visibility');

                        if (content && contentVisibility !== undefined) {
                            content.style.setProperty('visibility', contentVisibility || 'visible', 'important');
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
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const rect = panel.getBoundingClientRect();
                    let desiredTop = originalTopValue + (e.clientY - startY);
                    let desiredLeft = originalLeftValue + (e.clientX - startX);
                    desiredTop = Math.max(margin, Math.min(h - rect.height - margin, desiredTop));
                    desiredLeft = Math.max(margin, Math.min(w - rect.width - margin, desiredLeft));
                    currentDeltaX = desiredLeft - originalLeftValue;
                    currentDeltaY = desiredTop - originalTopValue;
                };
            };
        }

        makeDetailResizable() {
            if (this.detailPanel) {
                this.makeDetailResizableById(this.detailPanel.id);
            }
        }

        makeDetailResizableById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const resizeHandle = panel.querySelector('.detail-resize-handle');
            if (!resizeHandle) return;

            let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;
            const state = this.detailPanelStates.get(panelId);

            resizeHandle.onmousedown = (e) => {
                // 最大化或最小化状态下不能调整大小
                if (panel.classList.contains('maximized') || (state && state.isMinimized)) return;

                e.preventDefault();
                e.stopPropagation();

                // 点击时置顶
                this.bringToFront(panelId);

                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(window.getComputedStyle(panel).width, 10);
                startHeight = parseInt(window.getComputedStyle(panel).height, 10);
                startLeft = panel.offsetLeft;
                startTop = panel.offsetTop;

                document.onmousemove = (e) => {
                    e.preventDefault();

                    const width = startWidth + (e.clientX - startX);
                    const height = startHeight + (e.clientY - startY);

                    // 设置最小尺寸限制
                    const minWidth = 300;
                    const minHeight = 200;

                    if (width >= minWidth && height >= minHeight) {
                        panel.style.width = width + 'px';
                        panel.style.height = height + 'px';

                        // 更新保存的状态
                        if (state && state.normalState) {
                            state.normalState.width = width + 'px';
                            state.normalState.height = height + 'px';
                        }
                    }
                };

                document.onmouseup = () => {
                    document.onmousemove = null;
                    document.onmouseup = null;
                    // 调整大小结束后保存状态
                    this.saveDetailPanelStateById(panelId);
                };
            };
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

        toggleDetailMinimizeById(panelId) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const state = this.detailPanelStates.get(panelId);
            if (!state) return;

            const contentIframe = panel.querySelector('.detail-content');

            if (state.isMinimized) {
                state.isMinimized = false;
                if (contentIframe) {
                    contentIframe.style.removeProperty('display');
                    contentIframe.style.removeProperty('visibility');
                    contentIframe.style.removeProperty('height');
                    contentIframe.style.removeProperty('min-height');
                    contentIframe.style.removeProperty('flex');
                    contentIframe.style.removeProperty('opacity');
                    contentIframe.style.removeProperty('overflow');
                    contentIframe.style.setProperty('flex', '1', 'important');
                    contentIframe.style.setProperty('width', '100%', 'important');
                    contentIframe.style.setProperty('height', '100%', 'important');
                    // 强制重新加载 iframe，避免恢复后内容空白
                    const src = contentIframe.src;
                    if (src && src !== 'about:blank') {
                        contentIframe.src = 'about:blank';
                        setTimeout(() => { contentIframe.src = src; }, 50);
                    }
                }

                // 显示调整大小手柄
                const resizeHandle = panel.querySelector('.detail-resize-handle');
                if (resizeHandle) {
                    resizeHandle.style.removeProperty('display');
                }

                // 获取要恢复的宽度和高度
                const restoreWidth = (state.normalState && state.normalState.width) ? state.normalState.width : '800px';
                const restoreHeight = (state.normalState && state.normalState.height) ? state.normalState.height : '600px';

                // 恢复窗口大小
                const computedStyle = window.getComputedStyle(panel);
                const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
                const widthValue = parseFloat(restoreWidth);
                const totalWidth = widthValue + borderLeft + borderRight;

                // 以右上角为锚点：获取当前右上角位置（如果保存了则使用保存的位置）
                let fullWindowRight, fullWindowTop;
                if (state.normalState && state.normalState.fullWindowRight !== undefined) {
                    fullWindowRight = state.normalState.fullWindowRight;
                    fullWindowTop = state.normalState.fullWindowTop !== undefined ? state.normalState.fullWindowTop : panel.getBoundingClientRect().top;
                } else {
                    const currentRect = panel.getBoundingClientRect();
                    fullWindowRight = currentRect.left + currentRect.width;
                    fullWindowTop = currentRect.top;
                }

                // 计算新的 left（保持右上角位置不变）
                const newLeft = fullWindowRight - totalWidth;
                // top 保持不变（右上角位置不变）
                const newTop = fullWindowTop;

                panel.style.setProperty('left', newLeft + 'px', 'important');
                panel.style.setProperty('top', newTop + 'px', 'important');
                panel.style.setProperty('width', restoreWidth, 'important');
                panel.style.removeProperty('min-width');
                panel.style.setProperty('height', restoreHeight, 'important');
                // 清除最小化时设置的样式限制
                panel.style.removeProperty('max-height');
                panel.style.removeProperty('min-height');
                panel.style.removeProperty('overflow');
                // 恢复窗口背景色为白色
                panel.style.setProperty('background', 'white', 'important');

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
                panel.style.setProperty('background', '#0066cc', 'important');

                // 确保标题栏背景可见
                if (header) {
                    header.style.setProperty('background', '#0066cc', 'important');
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

        toggleDetailMinimize() {
            if (this.detailPanel) {
                this.toggleDetailMinimizeById(this.detailPanel.id);
            }
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
                    panel.style.setProperty('background', '#0066cc', 'important');
                    if (header) {
                        header.style.setProperty('background', '#0066cc', 'important');
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
                    const contentIframe = panel.querySelector('.detail-content');
                    if (contentIframe) {
                        contentIframe.style.removeProperty('display');
                        contentIframe.style.removeProperty('visibility');
                        contentIframe.style.removeProperty('height');
                        contentIframe.style.removeProperty('min-height');
                        contentIframe.style.removeProperty('opacity');
                        contentIframe.style.removeProperty('flex');
                        contentIframe.style.removeProperty('overflow');
                        contentIframe.style.setProperty('flex', '1', 'important');
                        contentIframe.style.setProperty('width', '100%', 'important');
                        contentIframe.style.setProperty('height', '100%', 'important');
                        const src = contentIframe.src;
                        if (src && src !== 'about:blank') {
                            contentIframe.src = 'about:blank';
                            setTimeout(() => { contentIframe.src = src; }, 50);
                        }
                    }
                    const resizeHandle = panel.querySelector('.detail-resize-handle');
                    if (resizeHandle) {
                        resizeHandle.style.display = 'block';
                    }
                    panel.style.setProperty('background', 'white', 'important');
                }

                // 确保窗口在屏幕可见范围内，并在下一帧再次确保 iframe 可见（避免内容区空白）
                requestAnimationFrame(() => {
                    const rect = panel.getBoundingClientRect();
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                    let adjustedLeft = parseFloat(panel.style.left) || rect.left;
                    let adjustedTop = parseFloat(panel.style.top) || rect.top;

                    if (adjustedLeft + rect.width < 0) adjustedLeft = 10;
                    else if (adjustedLeft > windowWidth) adjustedLeft = windowWidth - rect.width - 10;
                    else if (adjustedLeft + rect.width > windowWidth) adjustedLeft = windowWidth - rect.width - 10;
                    else if (adjustedLeft < 0) adjustedLeft = 10;

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
                        const contentIframe = panel.querySelector('.detail-content');
                        if (contentIframe) {
                            contentIframe.style.setProperty('flex', '1', 'important');
                            contentIframe.style.setProperty('display', 'block', 'important');
                            contentIframe.style.setProperty('visibility', 'visible', 'important');
                            contentIframe.style.removeProperty('height');
                            contentIframe.style.removeProperty('opacity');
                            void contentIframe.offsetHeight;
                        }
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

        toggleDetailMaximize() {
            if (this.detailPanel) {
                this.toggleDetailMaximizeById(this.detailPanel.id);
            }
        }


        loadDetailContentById(panelId, href) {
            const panel = this.detailPanels.get(panelId);
            if (!panel) return;

            const contentIframe = panel.querySelector('.detail-content');
            if (!contentIframe) return;

            // 确保URL是完整的绝对URL
            let fullUrl = href;
            if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
                // 如果是相对URL，根据当前标签页构建完整URL
                if (this.currentTab === 'zhiling') {
                    if (href.startsWith('/')) {
                        fullUrl = 'http://10.16.88.34' + href;
                    } else {
                        fullUrl = 'http://10.16.88.34/zzl/' + href;
                    }
                } else if (this.currentTab === 'jigui') {
                    if (href.startsWith('/')) {
                        fullUrl = 'http://10.16.88.34' + href;
                    } else {
                        fullUrl = 'http://10.16.88.34/jigui/' + href;
                    }
                } else if (this.currentTab === 'tongzhi') {
                    if (href.startsWith('/')) {
                        fullUrl = 'http://10.16.88.34' + href;
                    } else {
                        fullUrl = 'http://10.16.88.34/notice/' + href;
                    }
                }
            }

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
                // 延迟执行，确保 iframe 内容完全加载
                setTimeout(() => {
                    try {
                        // 尝试访问 iframe 内容（同域情况下）
                        const iframeDoc = contentIframe.contentDocument || contentIframe.contentWindow?.document;
                        if (!iframeDoc) {
                            // 跨域情况，无法直接访问内容
                            return;
                        }

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
                                        // 构建完整 URL
                                        let fullAttachmentUrl = attachmentUrl;
                                        if (!attachmentUrl.startsWith('http://') && !attachmentUrl.startsWith('https://')) {
                                            if (attachmentUrl.startsWith('/')) {
                                                fullAttachmentUrl = 'http://10.16.88.34' + attachmentUrl;
                                            } else {
                                                // 根据当前标签页构建完整URL
                                                if (this.currentTab === 'zhiling') {
                                                    fullAttachmentUrl = 'http://10.16.88.34/zzl/' + attachmentUrl;
                                                } else if (this.currentTab === 'jigui') {
                                                    fullAttachmentUrl = 'http://10.16.88.34/jigui/' + attachmentUrl;
                                                } else if (this.currentTab === 'tongzhi') {
                                                    fullAttachmentUrl = 'http://10.16.88.34/notice/' + attachmentUrl;
                                                } else {
                                                    fullAttachmentUrl = 'http://10.16.88.34/' + attachmentUrl;
                                                }
                                            }
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

                                                        console.log('已添加', addedCount, '个子元素到附件区域');

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
                }, 500); // 延迟 500ms，确保内容完全加载
            };

            // 保存处理器引用
            contentIframe.dataset.loadHandler = handlerName;
            window[handlerName] = loadHandler;

            // 直接使用iframe加载原页面，完全保持原系统格式
            contentIframe.addEventListener('load', loadHandler);
            contentIframe.src = fullUrl;
        }

        loadDetailContent(href) {
            if (this.detailPanel) {
                this.loadDetailContentById(this.detailPanel.id, href);
            }
        }

        closeDetailPanel() {
            if (this.detailPanel) {
                // 保存窗口状态到 localStorage
                this.saveDetailPanelState();
                this.detailPanel.style.display = 'none';
            }
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

        saveDetailPanelState() {
            if (this.detailPanel) {
                this.saveDetailPanelStateById(this.detailPanel.id);
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
                        // 确保窗口在屏幕可见范围内
                        const windowWidth = window.innerWidth;
                        const windowHeight = window.innerHeight;
                        const minWidth = 300;
                        const minHeight = 200;

                        // 调整位置和大小，确保在屏幕内
                        let top = Math.max(0, Math.min(state.top, windowHeight - minHeight));
                        let left = Math.max(0, Math.min(state.left, windowWidth - minWidth));
                        let width = Math.max(minWidth, Math.min(state.width, windowWidth - left));
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

        clearSearch() {
            if (this._els.searchContent) this._els.searchContent.value = '';
            // 清空所有单选按钮
            const allRadios = [
                this.panel.querySelector('#zhiling-gonghao'),
                this.panel.querySelector('#zhiling-user'),
                this.panel.querySelector('#jigui-gonghao'),
                this.panel.querySelector('#jigui-number'),
                this.panel.querySelector('#jigui-picname'),
                this.panel.querySelector('#jigui-writename'),
                this.panel.querySelector('#tongzhi-number'),
                this.panel.querySelector('#tongzhi-product-gonghao'),
                this.panel.querySelector('#tongzhi-service-gonghao'),
                this.panel.querySelector('#tongzhi-picname'),
                this.panel.querySelector('#tongzhi-writename')
            ];
            allRadios.forEach(radio => {
                if (radio) radio.checked = false;
            });
            this.updateSearchOptions(this.currentTab);
            if (this._els.searchResult) this._els.searchResult.innerHTML = '<div style="color: #666; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">搜索结果</div>';
        }

        // 根据标签页加载对应的首页内容
        loadTabDefaultContent(tab) {
            const resultDiv = this._els.searchResult;
            if (!resultDiv) return;
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

            resultDiv.innerHTML = '<div style="color: #0066cc; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">正在加载首页信息...</div>';

            this.fetchUrl(indexUrl)
                .then(html => {
                    const parseResult = this.parseResponse(html);
                    parseResult.currentPage = 1;
                    // 保存搜索状态，供分页使用
                    this.currentSearchContent = '';
                    this.currentSearchType = 'default';
                    this.displayResults(parseResult, 'default', '');
                    console.log(tab + ' 首页加载完成，' + parseResult.rows.length + ' 条');
                })
                .catch(err => {
                    console.error('加载首页失败:', err);
                    resultDiv.innerHTML = '<div style="color: red; text-align: center; font-size: 18px; font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif !important;">加载首页失败: ' + (err && err.message ? err.message : '') + '</div>';
                });
        }

        // 进入首页时默认拉取并展示 http://10.16.88.34/jigui/ 的全部内容（保留用于初始化）
        loadDefaultContent() {
            const path = (typeof location !== 'undefined' && location.pathname) || '';
            if (/^\/jigui\/?$/.test(path)) {
                this.loadTabDefaultContent('jigui');
            }
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

        // 制造令搜索所有分页（按工号：第1页与第2~6页同时进并发池，再视总页数拉取剩余页）
        searchZhilingAllPages(content, searchType) {
            const self = this;
            const CONCURRENCY = 6;
            const INITIAL_PAGES = 6;
            return new Promise((resolve, reject) => {
                if (searchType !== 'gonghao') {
                    self.searchZhilingPage(content, searchType, 1)
                        .then(first => resolve({ headers: first.headers, rows: first.rows, totalPages: first.totalPages || 1, totalCount: first.totalCount || first.rows.length, currentPage: 1 }))
                        .catch(reject);
                    return;
                }
                const initialTasks = [];
                for (let pageNum = 1; pageNum <= INITIAL_PAGES; pageNum++) {
                    initialTasks.push(() =>
                        self.searchZhilingPage(content, searchType, pageNum, pageNum === 1 ? undefined : { quiet: true })
                            .then(res => ({ pageNum, res }))
                            .catch(err => ({ pageNum, res: null, err }))
                    );
                }
                console.log('[制造令] 第 1~' + INITIAL_PAGES + ' 页同时进并发池，共 ' + INITIAL_PAGES + ' 个请求');
                self._runWithConcurrencyLimit(initialTasks, CONCURRENCY)
                    .then(initialResults => {
                        const firstRes = initialResults[0] && initialResults[0].res;
                        if (!firstRes) return Promise.reject(initialResults[0] && initialResults[0].err || new Error('第1页获取失败'));
                        const totalPages = firstRes.totalPages;
                        const totalCount = firstRes.totalCount;
                        const allHeaders = firstRes.headers;
                        let allRows = [];
                        const useCount = Math.min(totalPages, INITIAL_PAGES);
                        for (let i = 0; i < useCount; i++) {
                            const r = initialResults[i] && initialResults[i].res;
                            if (r && r.rows) allRows = allRows.concat(r.rows);
                        }
                        console.log('制造令第 1~' + useCount + ' 页获取完成，总页数: ' + totalPages + '，当前共 ' + allRows.length + ' 条');

                        if (totalPages <= INITIAL_PAGES) {
                            console.log('制造令所有页面获取完成，共 ' + allRows.length + ' 条数据');
                            return { headers: allHeaders, rows: allRows, totalPages: totalPages, totalCount: totalCount, currentPage: totalPages };
                        }
                        const restCount = totalPages - INITIAL_PAGES;
                        console.log('[制造令] 使用并发池拉取第 ' + (INITIAL_PAGES + 1) + ' 至 ' + totalPages + ' 页，共 ' + restCount + ' 页');
                        const restTasks = [];
                        for (let pageNum = INITIAL_PAGES + 1; pageNum <= totalPages; pageNum++) {
                            restTasks.push(() =>
                                self.searchZhilingPage(content, searchType, pageNum, { quiet: true })
                                    .then(pageResult => {
                                        console.log('制造令第 ' + pageNum + ' 页获取完成，' + pageResult.rows.length + ' 条数据');
                                        return { pageNum, rows: pageResult.rows };
                                    })
                                    .catch(error => {
                                        console.error('制造令第 ' + pageNum + ' 页获取失败:', error);
                                        return { pageNum, rows: [] };
                                    })
                            );
                        }
                        return self._runWithConcurrencyLimit(restTasks, CONCURRENCY).then(restResults => {
                            restResults.sort((a, b) => a.pageNum - b.pageNum);
                            restResults.forEach(r => { allRows = allRows.concat(r.rows); });
                            console.log('制造令所有页面获取完成，共 ' + allRows.length + ' 条数据');
                            return { headers: allHeaders, rows: allRows, totalPages: totalPages, totalCount: totalCount, currentPage: totalPages };
                        });
                    })
                    .then(resolve)
                    .catch(reject);
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
                        resolve(parseResult);
                    })
                    .catch(reject);
            });
        }

        // 通知单搜索所有分页（按产品工号或服务订单工号：第1页与第2~6页同时进并发池，再视总页数拉取剩余页）
        searchTongzhiAllPages(content, searchType) {
            const self = this;
            const isGonghao = searchType === 'product_gonghao' || searchType === 'service_gonghao';
            const CONCURRENCY = 6;
            const INITIAL_PAGES = 6; // 第1批：第1~6页同时发起，不等第1页返回再发第2~6页
            return new Promise((resolve, reject) => {
                if (!isGonghao) {
                    self.searchTongzhiPage(content, searchType, 1)
                        .then(first => resolve({ headers: first.headers, rows: first.rows, totalPages: first.totalPages || 1, totalCount: first.totalCount || first.rows.length, currentPage: 1 }))
                        .catch(reject);
                    return;
                }
                // 按工号：第1~6页同时进并发池，一起发出
                const initialTasks = [];
                for (let pageNum = 1; pageNum <= INITIAL_PAGES; pageNum++) {
                    initialTasks.push(() =>
                        self.searchTongzhiPage(content, searchType, pageNum, pageNum === 1 ? undefined : { quiet: true })
                            .then(res => ({ pageNum, res }))
                            .catch(err => ({ pageNum, res: null, err }))
                    );
                }
                console.log('[通知单] 第 1~' + INITIAL_PAGES + ' 页同时进并发池，共 ' + INITIAL_PAGES + ' 个请求');
                self._runWithConcurrencyLimit(initialTasks, CONCURRENCY)
                    .then(initialResults => {
                        const firstRes = initialResults[0] && initialResults[0].res;
                        if (!firstRes) return Promise.reject(initialResults[0] && initialResults[0].err || new Error('第1页获取失败'));
                        const totalPages = firstRes.totalPages;
                        const totalCount = firstRes.totalCount;
                        const allHeaders = firstRes.headers;
                        let allRows = [];
                        const useCount = Math.min(totalPages, INITIAL_PAGES);
                        for (let i = 0; i < useCount; i++) {
                            const r = initialResults[i] && initialResults[i].res;
                            if (r && r.rows) allRows = allRows.concat(r.rows);
                        }
                        console.log('通知单第 1~' + useCount + ' 页获取完成，总页数: ' + totalPages + '，当前共 ' + allRows.length + ' 条');

                        if (totalPages <= INITIAL_PAGES) {
                            console.log('通知单所有页面获取完成，共 ' + allRows.length + ' 条数据');
                            return { headers: allHeaders, rows: allRows, totalPages: totalPages, totalCount: totalCount, currentPage: totalPages };
                        }
                        const restCount = totalPages - INITIAL_PAGES;
                        console.log('[通知单] 使用并发池拉取第 ' + (INITIAL_PAGES + 1) + ' 至 ' + totalPages + ' 页，共 ' + restCount + ' 页');
                        const restTasks = [];
                        for (let pageNum = INITIAL_PAGES + 1; pageNum <= totalPages; pageNum++) {
                            restTasks.push(() =>
                                self.searchTongzhiPage(content, searchType, pageNum, { quiet: true })
                                    .then(pageResult => {
                                        console.log('通知单第 ' + pageNum + ' 页获取完成，' + pageResult.rows.length + ' 条数据');
                                        return { pageNum, rows: pageResult.rows };
                                    })
                                    .catch(error => {
                                        console.error('通知单第 ' + pageNum + ' 页获取失败:', error);
                                        return { pageNum, rows: [] };
                                    })
                            );
                        }
                        return self._runWithConcurrencyLimit(restTasks, CONCURRENCY).then(restResults => {
                            restResults.sort((a, b) => a.pageNum - b.pageNum);
                            restResults.forEach(r => { allRows = allRows.concat(r.rows); });
                            console.log('通知单所有页面获取完成，共 ' + allRows.length + ' 条数据');
                            return { headers: allHeaders, rows: allRows, totalPages: totalPages, totalCount: totalCount, currentPage: totalPages };
                        });
                    })
                    .then(resolve)
                    .catch(reject);
            });
        }

        // 通知单搜索（兼容旧接口，非工号搜索时使用）
        searchTongzhi(content, searchType) {
            return this.searchTongzhiPage(content, searchType, 1);
        }

        // 全局搜索
        searchGlobal(content, searchType) {
            return new Promise((resolve, reject) => {
                if (searchType !== 'gonghao') {
                    reject(new Error('全局搜索目前只支持工号'));
                    return;
                }

                const encGBK = (s) => this.encodeGBK(s);

                // 全局搜索可能需要同时搜索多个模块，然后合并结果
                // 这里先实现简单的单模块搜索，后续可以扩展为多模块聚合
                const url = 'http://10.16.88.34/search.asp?type=global&gonghao=' + encGBK(content);

                console.log('全局搜索 URL:', url);
                this.fetchUrl(url)
                    .then(html => {
                        const parseResult = this.parseResponse(html);
                        resolve(parseResult);
                    })
                    .catch(reject);
            });
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
