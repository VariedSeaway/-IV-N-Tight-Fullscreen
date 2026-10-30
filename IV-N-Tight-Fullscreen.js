// ==UserScript==
// @name         IV-N Tight：全螢幕
// @namespace    https://tampermonkey.net/
// @version      3.0
// @description  DMM iframe 全螢幕、16:9 自適應、黑色背景、ESC 還原
// @match        https://play.games.dmm.co.jp/game/pjivn_293854*
// @match        https://osapi.dmm.com/gadgets/ifr*
// @run-at       document-idle
// @all-frames   true
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const KEY = 'IVNT_FULLSCREEN_MSG_30';
    const BASE_W = 1280;
    const BASE_H = 720;

    const host = location.hostname;
    const isTop = window === window.top;
    const isDMM = host === 'play.games.dmm.co.jp' && isTop;
    const isGadget = host === 'osapi.dmm.com';

    function injectStyle(id, css) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            (document.head || document.documentElement).appendChild(el);
        }
        el.textContent = css;
    }
    function removeStyle(id) {
        document.getElementById(id)?.remove();
    }

    // =========================================
    // 1. 最外層 (play.games.dmm.co.jp)
    // =========================================
    if (isDMM) {
        let active = false;
        let fallback = false;

        const getFrame = () =>
            document.querySelector('#game_frame') ||
            document.querySelector('iframe[src*="osapi.dmm.com"]');

        const send = (type, target) => {
            const frame = getFrame();
            const win = target || frame?.contentWindow;
            try { win?.postMessage({ key: KEY, type }, '*'); } catch (_) {}
        };

        const button = document.createElement('button');
        button.id = 'ivnt-fullscreen-button';
        button.textContent = '⛶ 全螢幕';
        button.style.cssText = `
            position: fixed !important; top: 15px !important; right: 15px !important;
            z-index: 2147483647 !important; background: #673ab7 !important;
            color: #fff !important; border: 1px solid #b39ddb !important;
            border-radius: 6px !important; padding: 10px 16px !important;
            font: bold 14px sans-serif !important; cursor: pointer !important;
            box-shadow: 0 2px 8px rgba(0,0,0,.5) !important;
        `;
        const mount = () => {
            if (document.body && !button.isConnected) document.body.appendChild(button);
        };
        mount();
        new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });

        async function start() {
            const frame = getFrame();
            if (!frame || active) return;
            active = true;
            button.textContent = '退出全螢幕';
            send('ON');

            try {
                await frame.requestFullscreen();
                fallback = false;
            } catch (_) {
                // 備案：用 fixed 鋪滿（不隱藏任何元素）
                fallback = true;
                frame.setAttribute('data-ivnt', '1');
                injectStyle('ivnt-top-style', `
                    html, body { overflow: hidden !important; }
                    iframe[data-ivnt="1"] {
                        position: fixed !important; inset: 0 !important;
                        width: 100vw !important; height: 100vh !important;
                        max-width: none !important; margin: 0 !important;
                        border: 0 !important; background: #000 !important;
                        z-index: 2147483640 !important;
                    }
                `);
            }
        }

        function stop() {
            if (!active) return;
            active = false;
            button.textContent = '⛶ 全螢幕';
            send('OFF');

            getFrame()?.removeAttribute('data-ivnt');
            removeStyle('ivnt-top-style');
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            fallback = false;
            window.dispatchEvent(new Event('resize'));
        }

        button.addEventListener('click', () => (active ? stop() : start()));

        document.addEventListener('fullscreenchange', () => {
            if (active && !fallback && !document.fullscreenElement) stop();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && active && fallback) stop();
        }, true);

        // 中繼層載入完成後詢問目前狀態
        window.addEventListener('message', e => {
            if (e.data?.key === KEY && e.data.type === 'HELLO') {
                send(active ? 'ON' : 'OFF', e.source);
            }
        });

        return;
    }

    // =========================================
    // 2. 中繼層 (osapi.dmm.com)：隱藏裝飾，16:9 等比縮放置中
    // =========================================
    if (isGadget) {
        let active = false;

        function fit() {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const scale = Math.min(vw / BASE_W, vh / BASE_H);
            const ox = (vw - BASE_W * scale) / 2;
            const oy = (vh - BASE_H * scale) / 2;

            injectStyle('ivnt-gadget-style', `
                html, body {
                    overflow: hidden !important; background: #000 !important;
                    margin: 0 !important; padding: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                }
                #UnitFrameBG, #UnitFrameBGBattle, #Newsbg, .gameNews, #twitter_div,
                #bottom_spacer, #pageVisibleArea, #debugView, #item_shop_banner, #page_banner {
                    display: none !important;
                }
                #gameFrame {
                    position: fixed !important; inset: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    max-width: none !important; min-width: 0 !important;
                    margin: 0 !important; transform: none !important;
                    background: #000 !important;
                }
                #UnityFrame {
                    position: fixed !important; inset: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    left: 0 !important; top: 0 !important;
                    margin: 0 !important; transform: none !important;
                    overflow: hidden !important; z-index: 2147483640 !important;
                }
                #gameHTML5Canvas {
                    position: absolute !important; left: 0 !important; top: 0 !important;
                    width: ${BASE_W}px !important; height: ${BASE_H}px !important;
                    transform-origin: top left !important;
                    transform: translate(${ox}px, ${oy}px) scale(${scale}) !important;
                }
            `);
        }

        window.addEventListener('message', e => {
            if (e.data?.key !== KEY) return;
            if (e.data.type === 'ON') {
                active = true;
                fit();
            } else if (e.data.type === 'OFF') {
                active = false;
                removeStyle('ivnt-gadget-style');
                window.fitGameCanvas?.();
            }
        });

        window.addEventListener('resize', () => { if (active) fit(); });

        // 載入後向外層確認目前是否已在全螢幕
        try { window.parent.postMessage({ key: KEY, type: 'HELLO' }, '*'); } catch (_) {}
    }
})();
