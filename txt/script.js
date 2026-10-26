/**
 * Windows Poznámkový blok (notepad.exe) — Kompletní klientská logika
 * Čistý Vanilla JavaScript bez externích závislostí.
 */

(function () {
    'use strict';

    // =========================================================================
    // STAV APLIKACE A DOKUMENTU
    // =========================================================================
    const state = {
        fileName: 'Bez názvu',
        fileHandle: null,      // FileSystemFileHandle, pokud je dostupný
        savedContent: '',      // Obsah naposledy uloženého/načteného stavu
        isDirty: false,        // Indikátor neuložených změn (*)
        encoding: 'UTF-8',     // 'UTF-8' nebo 'UTF-8-BOM'
        lineEnding: 'CRLF',    // 'CRLF' (Windows), 'LF' (Unix), 'CR' (Mac)
        wordWrap: false,
        statusBarVisible: true,
        statusBarUserPref: true, // Zapamatování stavu stavového řádku před zapnutím zalamování
        font: {
            family: 'Consolas',
            style: 'normal',
            weight: 'normal',
            sizePt: 11
        },
        pageSetup: {
            size: 'A4',
            orientation: 'portrait',
            margins: { left: 20, right: 20, top: 25, bottom: 25 },
            header: '&f',
            footer: 'Stránka &p'
        },
        find: {
            query: '',
            replaceWith: '',
            matchCase: false,
            wrapAround: true,
            direction: 'down'
        },
        history: {
            stack: [''],
            index: 0,
            isInternalChange: false
        },
        window: {
            isMaximized: false,
            isMinimized: false,
            restoreRect: { left: 100, top: 60, width: 800, height: 500 }
        },
        pendingActionAfterSave: null
    };

    // =========================================================================
    // DOM ELEMENTY
    // =========================================================================
    const dom = {
        notepadWindow: document.getElementById('notepad-window'),
        titlebar: document.getElementById('titlebar'),
        windowTitle: document.getElementById('window-title'),
        minimizedBar: document.getElementById('minimized-bar'),
        minimizedTitle: document.getElementById('minimized-title'),
        btnMinimize: document.getElementById('btn-minimize'),
        btnMaximize: document.getElementById('btn-maximize'),
        btnClose: document.getElementById('btn-close'),
        iconMaximize: document.getElementById('icon-maximize'),
        iconRestore: document.getElementById('icon-restore'),

        menubar: document.getElementById('menubar'),
        menuItems: document.querySelectorAll('.menu-item'),
        editor: document.getElementById('editor'),
        statusbar: document.getElementById('statusbar'),
        statusPos: document.getElementById('status-pos'),
        statusEol: document.getElementById('status-eol'),
        statusEncoding: document.getElementById('status-encoding'),

        checkWordWrap: document.getElementById('check-word-wrap'),
        checkStatusBar: document.getElementById('check-status-bar'),
        menuItemWordWrap: document.getElementById('menu-item-word-wrap'),
        menuItemStatusBar: document.getElementById('menu-item-status-bar'),

        contextMenu: document.getElementById('context-menu'),
        modalBackdrop: document.getElementById('modal-backdrop'),
        fileInput: document.getElementById('file-input'),

        // Položky menu Úpravy pro dynamické povolování/zakazování
        menuUndo: document.getElementById('menu-item-undo'),
        menuRedo: document.getElementById('menu-item-redo'),
        menuCut: document.getElementById('menu-item-cut'),
        menuCopy: document.getElementById('menu-item-copy'),
        menuDelete: document.getElementById('menu-item-delete'),
        menuFind: document.getElementById('menu-item-find'),
        menuFindNext: document.getElementById('menu-item-find-next'),
        menuGoto: document.getElementById('menu-item-goto'),

        ctxUndo: document.getElementById('ctx-undo'),
        ctxRedo: document.getElementById('ctx-redo'),
        ctxCut: document.getElementById('ctx-cut'),
        ctxCopy: document.getElementById('ctx-copy'),
        ctxDelete: document.getElementById('ctx-delete'),
        ctxSelectAll: document.getElementById('ctx-select-all'),

        // Dialogy
        dialogUnsaved: document.getElementById('dialog-unsaved'),
        unsavedMessage: document.getElementById('unsaved-message'),
        btnUnsavedSave: document.getElementById('btn-unsaved-save'),
        btnUnsavedDontSave: document.getElementById('btn-unsaved-dontsave'),
        btnUnsavedCancel: document.getElementById('btn-unsaved-cancel'),

        dialogSaveAs: document.getElementById('dialog-save-as'),
        saveFilenameInput: document.getElementById('save-filename-input'),
        saveTypeSelect: document.getElementById('save-type-select'),
        saveEncodingSelect: document.getElementById('save-encoding-select'),
        btnSaveAsConfirm: document.getElementById('btn-save-as-confirm'),

        dialogFind: document.getElementById('dialog-find'),
        findInput: document.getElementById('find-input'),
        findMatchCase: document.getElementById('find-match-case'),
        findWrapAround: document.getElementById('find-wrap-around'),
        findDirUp: document.getElementById('find-dir-up'),
        findDirDown: document.getElementById('find-dir-down'),
        btnFindNext: document.getElementById('btn-find-next'),

        dialogReplace: document.getElementById('dialog-replace'),
        replaceFindInput: document.getElementById('replace-find-input'),
        replaceWithInput: document.getElementById('replace-with-input'),
        replaceMatchCase: document.getElementById('replace-match-case'),
        replaceWrapAround: document.getElementById('replace-wrap-around'),
        btnReplaceFindNext: document.getElementById('btn-replace-find-next'),
        btnReplaceOne: document.getElementById('btn-replace-one'),
        btnReplaceAll: document.getElementById('btn-replace-all'),

        dialogGoto: document.getElementById('dialog-goto'),
        gotoLineInput: document.getElementById('goto-line-input'),
        btnGotoConfirm: document.getElementById('btn-goto-confirm'),

        dialogFont: document.getElementById('dialog-font'),
        fontFamilyInput: document.getElementById('font-family-input'),
        fontFamilyList: document.getElementById('font-family-list'),
        fontStyleInput: document.getElementById('font-style-input'),
        fontStyleList: document.getElementById('font-style-list'),
        fontSizeInput: document.getElementById('font-size-input'),
        fontSizeList: document.getElementById('font-size-list'),
        fontSampleBox: document.getElementById('font-sample-box'),
        btnFontOk: document.getElementById('btn-font-ok'),

        dialogPageSetup: document.getElementById('dialog-page-setup'),
        pageSizeSelect: document.getElementById('page-size-select'),
        orientPortrait: document.getElementById('orient-portrait'),
        orientLandscape: document.getElementById('orient-landscape'),
        marginLeft: document.getElementById('margin-left'),
        marginRight: document.getElementById('margin-right'),
        marginTop: document.getElementById('margin-top'),
        marginBottom: document.getElementById('margin-bottom'),
        pageHeaderInput: document.getElementById('page-header-input'),
        pageFooterInput: document.getElementById('page-footer-input'),
        pagePreviewSheet: document.getElementById('page-preview-sheet'),
        pagePreviewMargins: document.getElementById('page-preview-margins'),
        btnPageSetupOk: document.getElementById('btn-page-setup-ok'),

        dialogHelp: document.getElementById('dialog-help'),
        dialogAbout: document.getElementById('dialog-about'),

        dialogAlert: document.getElementById('dialog-alert'),
        alertMessageText: document.getElementById('alert-message-text'),

        printHeader: document.getElementById('print-header'),
        printContent: document.getElementById('print-content'),
        printFooter: document.getElementById('print-footer')
    };

    // =========================================================================
    // AKTUALIZACE UI A STAVOVÉHO ŘÁDKU
    // =========================================================================

    function updateWindowTitle() {
        const prefix = state.isDirty ? '*' : '';
        const title = `${prefix}${state.fileName} - Poznámkový blok`;
        dom.windowTitle.textContent = title;
        dom.minimizedTitle.textContent = title;
        document.title = title;
    }

    function checkDirtyState() {
        const currentVal = dom.editor.value;
        const dirty = currentVal !== state.savedContent;
        if (dirty !== state.isDirty) {
            state.isDirty = dirty;
            updateWindowTitle();
        }
    }

    function recordHistorySnapshot() {
        if (state.history.isInternalChange) return;
        const currentVal = dom.editor.value;
        if (state.history.stack[state.history.index] === currentVal) return;

        // Oříznout budoucí kroky při nové změně
        state.history.stack = state.history.stack.slice(0, state.history.index + 1);
        state.history.stack.push(currentVal);
        if (state.history.stack.length > 200) {
            state.history.stack.shift();
        } else {
            state.history.index++;
        }
    }

    function updateStatusBar() {
        const val = dom.editor.value;
        const selStart = dom.editor.selectionStart || 0;
        const textUpToCursor = val.substring(0, selStart);
        const lines = textUpToCursor.split('\n');
        const lineNum = lines.length;
        const colNum = lines[lines.length - 1].length + 1;

        dom.statusPos.textContent = `Řádek ${lineNum}, sloupec ${colNum}`;

        if (state.lineEnding === 'CRLF') {
            dom.statusEol.textContent = 'Windows (CRLF)';
        } else if (state.lineEnding === 'LF') {
            dom.statusEol.textContent = 'Unix (LF)';
        } else {
            dom.statusEol.textContent = 'Macintosh (CR)';
        }

        dom.statusEncoding.textContent = state.encoding === 'UTF-8-BOM' ? 'UTF-8 s BOM' : 'UTF-8';
    }

    function updateStatusBarVisibility() {
        // V klasickém Notepadu je při zapnutém zalamování řádků stavový řádek i příkaz Přejít na nedostupný
        if (state.wordWrap) {
            dom.statusbar.style.display = 'none';
            dom.menuItemStatusBar.classList.add('disabled');
            dom.checkStatusBar.textContent = '';
            dom.menuItemStatusBar.classList.remove('checked');
        } else {
            dom.menuItemStatusBar.classList.remove('disabled');
            if (state.statusBarUserPref) {
                state.statusBarVisible = true;
                dom.statusbar.style.display = 'flex';
                dom.checkStatusBar.textContent = '✓';
                dom.menuItemStatusBar.classList.add('checked');
            } else {
                state.statusBarVisible = false;
                dom.statusbar.style.display = 'none';
                dom.checkStatusBar.textContent = '';
                dom.menuItemStatusBar.classList.remove('checked');
            }
        }
    }

    function updateEditMenuStates() {
        const hasSelection = dom.editor.selectionStart !== dom.editor.selectionEnd;
        const hasText = dom.editor.value.length > 0;
        const canUndo = state.history.index > 0;
        const canRedo = state.history.index < state.history.stack.length - 1;

        setMenuEntryEnabled(dom.menuUndo, canUndo);
        setMenuEntryEnabled(dom.ctxUndo, canUndo);

        setMenuEntryEnabled(dom.menuRedo, canRedo);
        setMenuEntryEnabled(dom.ctxRedo, canRedo);

        setMenuEntryEnabled(dom.menuCut, hasSelection);
        setMenuEntryEnabled(dom.ctxCut, hasSelection);

        setMenuEntryEnabled(dom.menuCopy, hasSelection);
        setMenuEntryEnabled(dom.ctxCopy, hasSelection);

        setMenuEntryEnabled(dom.menuDelete, hasSelection);
        setMenuEntryEnabled(dom.ctxDelete, hasSelection);

        setMenuEntryEnabled(dom.menuFind, hasText);
        setMenuEntryEnabled(dom.menuFindNext, hasText);
        setMenuEntryEnabled(dom.menuGoto, !state.wordWrap);
        setMenuEntryEnabled(dom.ctxSelectAll, hasText);
    }

    function setMenuEntryEnabled(el, enabled) {
        if (!el) return;
        if (enabled) {
            el.classList.remove('disabled');
        } else {
            el.classList.add('disabled');
        }
    }

    function applyFontToEditor() {
        dom.editor.style.fontFamily = `${state.font.family}, monospace`;
        dom.editor.style.fontStyle = state.font.style;
        dom.editor.style.fontWeight = state.font.weight;
        dom.editor.style.fontSize = `${state.font.sizePt}pt`;
    }

    // =========================================================================
    // OVLÁDÁNÍ HLAVNÍHO OKNA (PŘESOUVÁNÍ, ZMĚNA VELIKOSTI, MIN/MAX/ZAVŘÍT)
    // =========================================================================

    function initWindowControls() {
        // Přizpůsobení počáteční velikosti menším obrazovkám
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const initW = Math.min(800, vw - 20);
        const initH = Math.min(500, vh - 20);
        const initLeft = Math.max(10, Math.round((vw - initW) / 2));
        const initTop = Math.max(10, Math.round((vh - initH) / 2));

        dom.notepadWindow.style.width = `${initW}px`;
        dom.notepadWindow.style.height = `${initH}px`;
        dom.notepadWindow.style.left = `${initLeft}px`;
        dom.notepadWindow.style.top = `${initTop}px`;
        state.window.restoreRect = { left: initLeft, top: initTop, width: initW, height: initH };

        // Přesouvání okna tažením titulkového pruhu
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        dom.titlebar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.win-caption-btn')) return;
            if (state.window.isMaximized) return;
            isDragging = true;
            const rect = dom.notepadWindow.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            closeAllMenus();
        });

        dom.titlebar.addEventListener('dblclick', (e) => {
            if (e.target.closest('.win-caption-btn')) return;
            toggleMaximize();
        });

        // Změna velikosti okna
        let isResizing = false;
        let resizeDir = '';
        let startX = 0, startY = 0;
        let startRect = null;

        document.querySelectorAll('.resize-handle').forEach((handle) => {
            handle.addEventListener('mousedown', (e) => {
                if (state.window.isMaximized) return;
                e.stopPropagation();
                isResizing = true;
                resizeDir = handle.getAttribute('data-resize');
                startX = e.clientX;
                startY = e.clientY;
                const r = dom.notepadWindow.getBoundingClientRect();
                startRect = { left: r.left, top: r.top, width: r.width, height: r.height };
                closeAllMenus();
            });
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const newLeft = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragOffsetX));
                const newTop = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffsetY));
                dom.notepadWindow.style.left = `${newLeft}px`;
                dom.notepadWindow.style.top = `${newTop}px`;
            } else if (isResizing && startRect) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let { left, top, width, height } = startRect;
                const minW = 280;
                const minH = 180;

                if (resizeDir.includes('e')) {
                    width = Math.max(minW, startRect.width + dx);
                }
                if (resizeDir.includes('s')) {
                    height = Math.max(minH, startRect.height + dy);
                }
                if (resizeDir.includes('w')) {
                    const possibleW = startRect.width - dx;
                    if (possibleW >= minW) {
                        width = possibleW;
                        left = startRect.left + dx;
                    }
                }
                if (resizeDir.includes('n')) {
                    const possibleH = startRect.height - dy;
                    if (possibleH >= minH) {
                        height = possibleH;
                        top = Math.max(0, startRect.top + dy);
                    }
                }

                dom.notepadWindow.style.left = `${left}px`;
                dom.notepadWindow.style.top = `${top}px`;
                dom.notepadWindow.style.width = `${width}px`;
                dom.notepadWindow.style.height = `${height}px`;
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
        });

        // Tlačítka titulkového pruhu
        dom.btnMinimize.addEventListener('click', () => {
            closeAllMenus();
            state.window.isMinimized = true;
            dom.notepadWindow.style.display = 'none';
            dom.minimizedBar.style.display = 'flex';
        });

        dom.minimizedBar.addEventListener('click', () => {
            state.window.isMinimized = false;
            dom.minimizedBar.style.display = 'none';
            dom.notepadWindow.style.display = 'flex';
            dom.editor.focus();
        });

        dom.btnMaximize.addEventListener('click', () => {
            closeAllMenus();
            toggleMaximize();
            dom.editor.focus();
        });

        dom.btnClose.addEventListener('click', () => {
            closeAllMenus();
            executeAction('exit');
        });

        // Přesouvání nemodálních dialogů (Hledat, Nahradit)
        document.querySelectorAll('.win-dialog').forEach((dlg) => {
            const bar = dlg.querySelector('.dialog-titlebar');
            if (!bar) return;
            let dlgDrag = false;
            let dOffX = 0, dOffY = 0;

            bar.addEventListener('mousedown', (e) => {
                if (e.target.closest('.win-caption-btn')) return;
                dlgDrag = true;
                const rect = dlg.getBoundingClientRect();
                dlg.style.transform = 'none';
                dlg.style.left = `${rect.left}px`;
                dlg.style.top = `${rect.top}px`;
                dOffX = e.clientX - rect.left;
                dOffY = e.clientY - rect.top;
            });

            window.addEventListener('mousemove', (e) => {
                if (!dlgDrag) return;
                const nl = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dOffX));
                const nt = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dOffY));
                dlg.style.left = `${nl}px`;
                dlg.style.top = `${nt}px`;
            });

            window.addEventListener('mouseup', () => {
                dlgDrag = false;
            });
        });
    }

    function toggleMaximize() {
        if (!state.window.isMaximized) {
            const r = dom.notepadWindow.getBoundingClientRect();
            state.window.restoreRect = { left: r.left, top: r.top, width: r.width, height: r.height };
            state.window.isMaximized = true;
            dom.notepadWindow.classList.add('maximized');
            dom.iconMaximize.style.display = 'none';
            dom.iconRestore.style.display = 'block';
            dom.btnMaximize.title = 'Obnovit z maxima';
        } else {
            state.window.isMaximized = false;
            dom.notepadWindow.classList.remove('maximized');
            const { left, top, width, height } = state.window.restoreRect;
            dom.notepadWindow.style.left = `${left}px`;
            dom.notepadWindow.style.top = `${top}px`;
            dom.notepadWindow.style.width = `${width}px`;
            dom.notepadWindow.style.height = `${height}px`;
            dom.iconMaximize.style.display = 'block';
            dom.iconRestore.style.display = 'none';
            dom.btnMaximize.title = 'Maximalizovat';
        }
    }

    // =========================================================================
    // NABÍDKY (MENUBAR A KONTEXTOVÁ NABÍDKA)
    // =========================================================================

    let isMenuBarActive = false;

    function closeAllMenus() {
        isMenuBarActive = false;
        dom.menuItems.forEach((item) => item.classList.remove('open'));
        dom.contextMenu.style.display = 'none';
    }

    function initMenus() {
        dom.menuItems.forEach((item) => {
            item.addEventListener('mousedown', (e) => {
                if (e.target.closest('.menu-dropdown')) return;
                e.preventDefault();
                e.stopPropagation();
                dom.contextMenu.style.display = 'none';

                const alreadyOpen = item.classList.contains('open');
                dom.menuItems.forEach((i) => i.classList.remove('open'));

                if (!alreadyOpen) {
                    updateEditMenuStates();
                    item.classList.add('open');
                    isMenuBarActive = true;
                } else {
                    isMenuBarActive = false;
                }
            });

            item.addEventListener('mouseenter', () => {
                if (isMenuBarActive) {
                    dom.menuItems.forEach((i) => i.classList.remove('open'));
                    updateEditMenuStates();
                    item.classList.add('open');
                }
            });
        });

        // Kliknutí na položku v menu nebo kontextové nabídce
        document.querySelectorAll('.menu-entry').forEach((entry) => {
            entry.addEventListener('click', (e) => {
                e.stopPropagation();
                if (entry.classList.contains('disabled')) return;
                const action = entry.getAttribute('data-action');
                closeAllMenus();
                if (action) {
                    executeAction(action);
                }
            });
        });

        // Kontextová nabídka v editoru
        dom.editor.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            closeAllMenus();
            updateEditMenuStates();

            dom.contextMenu.style.display = 'block';
            const menuRect = dom.contextMenu.getBoundingClientRect();
            let x = e.clientX;
            let y = e.clientY;

            if (x + menuRect.width > window.innerWidth) {
                x = Math.max(4, window.innerWidth - menuRect.width - 4);
            }
            if (y + menuRect.height > window.innerHeight) {
                y = Math.max(4, window.innerHeight - menuRect.height - 4);
            }

            dom.contextMenu.style.left = `${x}px`;
            dom.contextMenu.style.top = `${y}px`;
        });

        // Zavření nabídek kliknutím mimo
        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.win-menubar') && !e.target.closest('#context-menu')) {
                closeAllMenus();
            }
        });
    }

    // =========================================================================
    // ROZBOČOVAČ AKCÍ A OPERACÍ
    // =========================================================================

    function executeAction(action) {
        switch (action) {
            // SOUBOR
            case 'new':
                confirmDiscardOrSave(() => createNewDocument());
                break;
            case 'open':
                confirmDiscardOrSave(() => triggerOpenFile());
                break;
            case 'save':
                saveDocument(false);
                break;
            case 'save-as':
                openSaveAsDialog();
                break;
            case 'page-setup':
                openPageSetupDialog();
                break;
            case 'print':
                printDocument();
                break;
            case 'exit':
                confirmDiscardOrSave(() => exitApplication());
                break;

            // ÚPRAVY
            case 'undo':
                performUndo();
                break;
            case 'redo':
                performRedo();
                break;
            case 'cut':
                performCut();
                break;
            case 'copy':
                performCopy();
                break;
            case 'paste':
                performPaste();
                break;
            case 'delete':
                performDelete();
                break;
            case 'find':
                openFindDialog();
                break;
            case 'find-next':
                performFindNext();
                break;
            case 'replace':
                openReplaceDialog();
                break;
            case 'goto':
                openGotoDialog();
                break;
            case 'select-all':
                dom.editor.focus();
                dom.editor.select();
                updateStatusBar();
                break;
            case 'time-date':
                insertTimeDate();
                break;

            // FORMÁT
            case 'word-wrap':
                toggleWordWrap();
                break;
            case 'font':
                openFontDialog();
                break;

            // ZOBRAZIT
            case 'status-bar':
                toggleStatusBar();
                break;

            // NÁPOVĚDA
            case 'help-view':
                openModalDialog(dom.dialogHelp);
                break;
            case 'about':
                openModalDialog(dom.dialogAbout);
                break;
        }
    }

    // =========================================================================
    // SOUBOROVÉ OPERACE (NOVÝ, OTEVŘÍT, ULOŽIT, ULOŽIT JAKO, TISK, KONEC)
    // =========================================================================

    function confirmDiscardOrSave(nextCallback) {
        if (!state.isDirty) {
            nextCallback();
            return;
        }
        state.pendingActionAfterSave = nextCallback;
        dom.unsavedMessage.textContent = `Chcete uložit změny v souboru ${state.fileName}?`;
        openModalDialog(dom.dialogUnsaved);
        dom.btnUnsavedSave.focus();
    }

    function createNewDocument() {
        state.fileName = 'Bez názvu';
        state.fileHandle = null;
        state.savedContent = '';
        state.isDirty = false;
        state.encoding = 'UTF-8';
        state.lineEnding = 'CRLF';
        dom.editor.value = '';
        state.history.stack = [''];
        state.history.index = 0;
        updateWindowTitle();
        updateStatusBar();
        dom.editor.focus();
    }

    async function triggerOpenFile() {
        // Pokud prohlížeč podporuje File System Access API, nabídneme nativní systémový výběr s handlem
        if (window.showOpenFilePicker) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [
                        {
                            description: 'Textové dokumenty (*.txt; *.log; *.md; *.html; *.css; *.js; *.json)',
                            accept: {
                                'text/plain': ['.txt', '.log', '.md', '.ini', '.cfg', '.csv'],
                                'text/html': ['.html', '.htm'],
                                'text/css': ['.css'],
                                'text/javascript': ['.js'],
                                'application/json': ['.json']
                            }
                        }
                    ],
                    multiple: false
                });
                const file = await handle.getFile();
                await loadFileObject(file, handle);
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    dom.editor.focus();
                    return;
                }
                // Při zamítnutí v iframe/sandboxu plynule přejdeme na klasický <input type="file">
            }
        }
        dom.fileInput.value = '';
        dom.fileInput.click();
    }

    async function loadFileObject(file, fileHandle = null) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Detekce UTF-8 BOM (EF BB BF)
        let hasBom = false;
        let textBytes = bytes;
        if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
            hasBom = true;
            textBytes = bytes.subarray(3);
        }

        const decoder = new TextDecoder('utf-8');
        const rawText = decoder.decode(textBytes);

        // Detekce původního zakončení řádků souboru
        if (rawText.includes('\r\n')) {
            state.lineEnding = 'CRLF';
        } else if (rawText.includes('\n')) {
            state.lineEnding = 'LF';
        } else if (rawText.includes('\r')) {
            state.lineEnding = 'CR';
        } else {
            state.lineEnding = 'CRLF';
        }

        // <textarea> interně normalizuje konce řádků na \n
        const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        state.fileName = file.name;
        state.fileHandle = fileHandle;
        state.encoding = hasBom ? 'UTF-8-BOM' : 'UTF-8';
        dom.editor.value = normalizedText;
        state.savedContent = dom.editor.value;
        state.isDirty = false;
        state.history.stack = [dom.editor.value];
        state.history.index = 0;

        dom.editor.setSelectionRange(0, 0);
        dom.editor.scrollTop = 0;
        updateWindowTitle();
        updateStatusBar();
        dom.editor.focus();
    }

    function formatContentForSaving(text) {
        if (state.lineEnding === 'CRLF') {
            return text.replace(/\r?\n/g, '\r\n');
        } else if (state.lineEnding === 'CR') {
            return text.replace(/\r?\n/g, '\r');
        }
        return text;
    }

    function buildBlobForSaving(text) {
        const formattedText = formatContentForSaving(text);
        const parts = [];
        if (state.encoding === 'UTF-8-BOM') {
            parts.push(new Uint8Array([0xEF, 0xBB, 0xBF]));
        }
        parts.push(formattedText);
        return new Blob(parts, { type: 'text/plain;charset=utf-8' });
    }

    async function saveDocument(forceSaveAs = false) {
        if (forceSaveAs || state.fileName === 'Bez názvu') {
            openSaveAsDialog();
            return;
        }

        // Pokud máme platný FileSystemFileHandle, zapíšeme přímo do souboru
        if (state.fileHandle && state.fileHandle.createWritable) {
            try {
                const writable = await state.fileHandle.createWritable();
                const blob = buildBlobForSaving(dom.editor.value);
                await writable.write(blob);
                await writable.close();
                finalizeSaveSuccess();
                return;
            } catch (err) {
                // Záložní stažení při selhání přímého zápisu
            }
        }

        downloadDocumentBlob(state.fileName);
        finalizeSaveSuccess();
    }

    function downloadDocumentBlob(filename) {
        const blob = buildBlobForSaving(dom.editor.value);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function finalizeSaveSuccess() {
        state.savedContent = dom.editor.value;
        state.isDirty = false;
        updateWindowTitle();
        updateStatusBar();

        if (typeof state.pendingActionAfterSave === 'function') {
            const nextFn = state.pendingActionAfterSave;
            state.pendingActionAfterSave = null;
            nextFn();
        } else {
            dom.editor.focus();
        }
    }

    function openSaveAsDialog() {
        let suggested = state.fileName;
        if (suggested === 'Bez názvu') {
            suggested = 'Bez názvu.txt';
        }
        dom.saveFilenameInput.value = suggested;
        dom.saveEncodingSelect.value = state.encoding;
        openModalDialog(dom.dialogSaveAs);
        dom.saveFilenameInput.focus();
        dom.saveFilenameInput.select();
    }

    async function confirmSaveAsDialog() {
        let name = dom.saveFilenameInput.value.trim();
        if (!name) {
            showAlert('Zadejte platný název souboru.');
            return;
        }
        const extOption = dom.saveTypeSelect.value;
        if (extOption === '.txt' && !name.includes('.')) {
            name += '.txt';
        }

        state.fileName = name;
        state.encoding = dom.saveEncodingSelect.value;
        closeDialog(dom.dialogSaveAs);

        // Volitelné využití showSaveFilePicker, pokud jej prohlížeč v daném kontextu povolí
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: state.fileName,
                    types: [
                        {
                            description: 'Textový dokument',
                            accept: { 'text/plain': ['.txt', '.log', '.md', '.html', '.css', '.js', '.json'] }
                        }
                    ]
                });
                state.fileHandle = handle;
                state.fileName = handle.name;
                const writable = await handle.createWritable();
                await writable.write(buildBlobForSaving(dom.editor.value));
                await writable.close();
                finalizeSaveSuccess();
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    dom.editor.focus();
                    return;
                }
                // Při nepovoleném File System API v iframe pokračujeme přímým stažením souboru
            }
        }

        downloadDocumentBlob(state.fileName);
        finalizeSaveSuccess();
    }

    function formatHeaderFooterTokens(template) {
        const now = new Date();
        return template
            .replace(/&f/gi, state.fileName)
            .replace(/&p/gi, '1')
            .replace(/&d/gi, now.toLocaleDateString('cs-CZ'))
            .replace(/&t/gi, now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }));
    }

    function printDocument() {
        dom.printHeader.textContent = formatHeaderFooterTokens(state.pageSetup.header);
        dom.printFooter.textContent = formatHeaderFooterTokens(state.pageSetup.footer);
        dom.printContent.textContent = dom.editor.value;
        dom.printContent.style.fontFamily = `${state.font.family}, monospace`;
        dom.printContent.style.fontSize = `${state.font.sizePt}pt`;
        dom.printContent.style.fontStyle = state.font.style;
        dom.printContent.style.fontWeight = state.font.weight;

        const m = state.pageSetup.margins;
        dom.printContent.style.padding = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;

        window.print();
        dom.editor.focus();
    }

    function exitApplication() {
        // V prostředí webového prohlížeče nelze skriptem zavřít uživatelem otevřený panel,
        // proto vyčistíme dokument a resetujeme okno do výchozího stavu.
        createNewDocument();
    }

    // =========================================================================
    // ÚPRAVY TEXTU (ZPĚT, ZNOVU, SCHRÁNKA, ČAS A DATUM)
    // =========================================================================

    function replaceSelectionInEditor(replacementText, selectInserted = false) {
        dom.editor.focus();
        const start = dom.editor.selectionStart;
        const end = dom.editor.selectionEnd;
        const val = dom.editor.value;

        dom.editor.value = val.substring(0, start) + replacementText + val.substring(end);
        const newCursorPos = start + replacementText.length;

        if (selectInserted) {
            dom.editor.setSelectionRange(start, newCursorPos);
        } else {
            dom.editor.setSelectionRange(newCursorPos, newCursorPos);
        }

        recordHistorySnapshot();
        checkDirtyState();
        updateStatusBar();
    }

    function performUndo() {
        if (state.history.index > 0) {
            state.history.isInternalChange = true;
            state.history.index--;
            dom.editor.value = state.history.stack[state.history.index];
            state.history.isInternalChange = false;
            checkDirtyState();
            updateStatusBar();
            dom.editor.focus();
        }
    }

    function performRedo() {
        if (state.history.index < state.history.stack.length - 1) {
            state.history.isInternalChange = true;
            state.history.index++;
            dom.editor.value = state.history.stack[state.history.index];
            state.history.isInternalChange = false;
            checkDirtyState();
            updateStatusBar();
            dom.editor.focus();
        }
    }

    async function performCut() {
        const start = dom.editor.selectionStart;
        const end = dom.editor.selectionEnd;
        if (start === end) return;
        const selectedText = dom.editor.value.substring(start, end);

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(selectedText);
            } else {
                document.execCommand('copy');
            }
        } catch (_) {
            document.execCommand('copy');
        }
        replaceSelectionInEditor('');
    }

    async function performCopy() {
        const start = dom.editor.selectionStart;
        const end = dom.editor.selectionEnd;
        if (start === end) return;
        const selectedText = dom.editor.value.substring(start, end);

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(selectedText);
            } else {
                document.execCommand('copy');
            }
        } catch (_) {
            document.execCommand('copy');
        }
        dom.editor.focus();
    }

    async function performPaste() {
        dom.editor.focus();
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const clipText = await navigator.clipboard.readText();
                if (typeof clipText === 'string') {
                    replaceSelectionInEditor(clipText.replace(/\r\n/g, '\n'));
                    return;
                }
            }
        } catch (_) {
            // Pokud prohlížeč nepovolí přímé čtení schránky bez Ctrl+V, zkusíme execCommand
        }
        const ok = document.execCommand('paste');
        if (!ok) {
            showAlert('Pro vložení ze systémové schránky použijte klávesovou zkratku Ctrl+V.');
        }
    }

    function performDelete() {
        const start = dom.editor.selectionStart;
        const end = dom.editor.selectionEnd;
        if (start !== end) {
            replaceSelectionInEditor('');
        } else if (start < dom.editor.value.length) {
            dom.editor.setSelectionRange(start, start + 1);
            replaceSelectionInEditor('');
        }
    }

    function insertTimeDate() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('cs-CZ');
        replaceSelectionInEditor(`${timeStr} ${dateStr}`);
    }

    // =========================================================================
    // HLEDÁNÍ, NAHRAZOVÁNÍ A PŘEJÍT NA ŘÁDEK
    // =========================================================================

    function openFindDialog() {
        closeDialog(dom.dialogReplace);
        const sel = dom.editor.value.substring(dom.editor.selectionStart, dom.editor.selectionEnd);
        if (sel && !sel.includes('\n')) {
            state.find.query = sel;
        }
        dom.findInput.value = state.find.query;
        dom.findMatchCase.checked = state.find.matchCase;
        dom.findWrapAround.checked = state.find.wrapAround;
        dom.findDirUp.checked = state.find.direction === 'up';
        dom.findDirDown.checked = state.find.direction !== 'up';

        dom.dialogFind.style.display = 'flex';
        dom.findInput.focus();
        dom.findInput.select();
    }

    function openReplaceDialog() {
        closeDialog(dom.dialogFind);
        const sel = dom.editor.value.substring(dom.editor.selectionStart, dom.editor.selectionEnd);
        if (sel && !sel.includes('\n')) {
            state.find.query = sel;
        }
        dom.replaceFindInput.value = state.find.query;
        dom.replaceWithInput.value = state.find.replaceWith;
        dom.replaceMatchCase.checked = state.find.matchCase;
        dom.replaceWrapAround.checked = state.find.wrapAround;

        dom.dialogReplace.style.display = 'flex';
        dom.replaceFindInput.focus();
        dom.replaceFindInput.select();
    }

    function syncFindStateFromActiveDialog() {
        if (dom.dialogFind.style.display !== 'none') {
            state.find.query = dom.findInput.value;
            state.find.matchCase = dom.findMatchCase.checked;
            state.find.wrapAround = dom.findWrapAround.checked;
            state.find.direction = dom.findDirUp.checked ? 'up' : 'down';
        } else if (dom.dialogReplace.style.display !== 'none') {
            state.find.query = dom.replaceFindInput.value;
            state.find.replaceWith = dom.replaceWithInput.value;
            state.find.matchCase = dom.replaceMatchCase.checked;
            state.find.wrapAround = dom.replaceWrapAround.checked;
            state.find.direction = 'down';
        }
    }

    function findOccurrence(query, direction, matchCase, wrapAround) {
        if (!query) return false;
        const rawText = dom.editor.value;
        const haystack = matchCase ? rawText : rawText.toLowerCase();
        const needle = matchCase ? query : query.toLowerCase();

        let foundIndex = -1;

        if (direction === 'down') {
            const startPos = dom.editor.selectionEnd;
            foundIndex = haystack.indexOf(needle, startPos);
            if (foundIndex === -1 && wrapAround) {
                foundIndex = haystack.indexOf(needle, 0);
            }
        } else {
            const startPos = dom.editor.selectionStart - 1;
            if (startPos >= 0) {
                foundIndex = haystack.lastIndexOf(needle, startPos);
            }
            if (foundIndex === -1 && wrapAround) {
                foundIndex = haystack.lastIndexOf(needle);
            }
        }

        if (foundIndex !== -1) {
            dom.editor.focus();
            dom.editor.setSelectionRange(foundIndex, foundIndex + query.length);
            scrollEditorToSelection();
            updateStatusBar();
            return true;
        }
        return false;
    }

    function scrollEditorToSelection() {
        const textUpToSel = dom.editor.value.substring(0, dom.editor.selectionStart);
        const lineIndex = textUpToSel.split('\n').length - 1;
        const lineHeight = parseFloat(getComputedStyle(dom.editor).lineHeight) || 18;
        const targetScroll = Math.max(0, (lineIndex - 3) * lineHeight);
        if (targetScroll < dom.editor.scrollTop || targetScroll > dom.editor.scrollTop + dom.editor.clientHeight - 30) {
            dom.editor.scrollTop = targetScroll;
        }
    }

    function performFindNext() {
        syncFindStateFromActiveDialog();
        if (!state.find.query) {
            openFindDialog();
            return;
        }
        const ok = findOccurrence(
            state.find.query,
            state.find.direction,
            state.find.matchCase,
            state.find.wrapAround
        );
        if (!ok) {
            showAlert(`Nelze najít „${state.find.query}“.`);
        }
    }

    function performReplaceOne() {
        syncFindStateFromActiveDialog();
        const query = state.find.query;
        if (!query) return;

        const currentSelection = dom.editor.value.substring(dom.editor.selectionStart, dom.editor.selectionEnd);
        const isCurrentMatch = state.find.matchCase
            ? currentSelection === query
            : currentSelection.toLowerCase() === query.toLowerCase();

        if (isCurrentMatch) {
            replaceSelectionInEditor(state.find.replaceWith, false);
        }

        const foundNext = findOccurrence(query, 'down', state.find.matchCase, state.find.wrapAround);
        if (!foundNext && !isCurrentMatch) {
            showAlert(`Nelze najít „${query}“.`);
        }
    }

    function performReplaceAll() {
        syncFindStateFromActiveDialog();
        const query = state.find.query;
        if (!query) return;

        const rawText = dom.editor.value;
        const flags = state.find.matchCase ? 'g' : 'gi';
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedQuery, flags);

        if (!regex.test(rawText)) {
            showAlert(`Nelze najít „${query}“.`);
            return;
        }

        dom.editor.value = rawText.replace(regex, state.find.replaceWith);
        recordHistorySnapshot();
        checkDirtyState();
        updateStatusBar();
        dom.editor.focus();
    }

    function openGotoDialog() {
        if (state.wordWrap) return;
        const textUpToCursor = dom.editor.value.substring(0, dom.editor.selectionStart);
        const currentLine = textUpToCursor.split('\n').length;
        dom.gotoLineInput.value = String(currentLine);
        openModalDialog(dom.dialogGoto);
        dom.gotoLineInput.focus();
        dom.gotoLineInput.select();
    }

    function confirmGotoLine() {
        const lineNum = parseInt(dom.gotoLineInput.value.trim(), 10);
        const lines = dom.editor.value.split('\n');

        if (isNaN(lineNum) || lineNum < 1 || lineNum > lines.length) {
            showAlert('Číslo řádku je mimo celkový počet řádků.');
            return;
        }

        let charOffset = 0;
        for (let i = 0; i < lineNum - 1; i++) {
            charOffset += lines[i].length + 1;
        }

        closeDialog(dom.dialogGoto);
        dom.editor.focus();
        dom.editor.setSelectionRange(charOffset, charOffset);
        scrollEditorToSelection();
        updateStatusBar();
    }

    // =========================================================================
    // FORMÁT A ZOBRAZENÍ (ZALAMOVÁNÍ ŘÁDKŮ, PÍSMO, STAVOVÝ ŘÁDEK)
    // =========================================================================

    function toggleWordWrap() {
        state.wordWrap = !state.wordWrap;
        if (state.wordWrap) {
            dom.editor.classList.add('word-wrap');
            dom.editor.setAttribute('wrap', 'soft');
            dom.checkWordWrap.textContent = '✓';
            dom.menuItemWordWrap.classList.add('checked');
        } else {
            dom.editor.classList.remove('word-wrap');
            dom.editor.setAttribute('wrap', 'off');
            dom.checkWordWrap.textContent = '';
            dom.menuItemWordWrap.classList.remove('checked');
        }
        updateStatusBarVisibility();
        updateStatusBar();
        dom.editor.focus();
    }

    function toggleStatusBar() {
        if (state.wordWrap) return;
        state.statusBarUserPref = !state.statusBarUserPref;
        updateStatusBarVisibility();
        dom.editor.focus();
    }

    function openFontDialog() {
        dom.fontFamilyList.value = state.font.family;
        dom.fontFamilyInput.value = dom.fontFamilyList.options[dom.fontFamilyList.selectedIndex]?.text || state.font.family;

        const styleKey = `${state.font.style}-${state.font.weight}`;
        dom.fontStyleList.value = styleKey;
        dom.fontStyleInput.value = dom.fontStyleList.options[dom.fontStyleList.selectedIndex]?.text || 'Obyčejné';

        dom.fontSizeList.value = String(state.font.sizePt);
        dom.fontSizeInput.value = String(state.font.sizePt);

        updateFontDialogPreview();
        openModalDialog(dom.dialogFont);
    }

    function updateFontDialogPreview() {
        const fam = dom.fontFamilyList.value || state.font.family;
        const [st, wt] = (dom.fontStyleList.value || 'normal-normal').split('-');
        const sz = parseInt(dom.fontSizeInput.value, 10) || state.font.sizePt;

        dom.fontSampleBox.style.fontFamily = `${fam}, monospace`;
        dom.fontSampleBox.style.fontStyle = st;
        dom.fontSampleBox.style.fontWeight = wt;
        dom.fontSampleBox.style.fontSize = `${Math.min(36, Math.max(8, sz))}pt`;
    }

    function confirmFontDialog() {
        const fam = dom.fontFamilyList.value || state.font.family;
        const [st, wt] = (dom.fontStyleList.value || 'normal-normal').split('-');
        const parsedSize = parseInt(dom.fontSizeInput.value, 10);
        const sizePt = (!isNaN(parsedSize) && parsedSize >= 6 && parsedSize <= 72) ? parsedSize : state.font.sizePt;

        state.font.family = fam;
        state.font.style = st;
        state.font.weight = wt;
        state.font.sizePt = sizePt;

        applyFontToEditor();
        closeDialog(dom.dialogFont);
        dom.editor.focus();
    }

    // =========================================================================
    // VZHLED STRÁNKY (NASTAVENÍ STRÁNKY)
    // =========================================================================

    function openPageSetupDialog() {
        dom.pageSizeSelect.value = state.pageSetup.size;
        dom.orientPortrait.checked = state.pageSetup.orientation === 'portrait';
        dom.orientLandscape.checked = state.pageSetup.orientation === 'landscape';
        dom.marginLeft.value = state.pageSetup.margins.left;
        dom.marginRight.value = state.pageSetup.margins.right;
        dom.marginTop.value = state.pageSetup.margins.top;
        dom.marginBottom.value = state.pageSetup.margins.bottom;
        dom.pageHeaderInput.value = state.pageSetup.header;
        dom.pageFooterInput.value = state.pageSetup.footer;

        updatePageSetupPreview();
        openModalDialog(dom.dialogPageSetup);
    }

    function updatePageSetupPreview() {
        const isLandscape = dom.orientLandscape.checked;
        dom.pagePreviewSheet.style.width = isLandscape ? '90px' : '64px';
        dom.pagePreviewSheet.style.height = isLandscape ? '64px' : '90px';

        const ml = Math.min(25, Math.max(2, Math.round((parseFloat(dom.marginLeft.value) || 0) * 0.4)));
        const mr = Math.min(25, Math.max(2, Math.round((parseFloat(dom.marginRight.value) || 0) * 0.4)));
        const mt = Math.min(25, Math.max(2, Math.round((parseFloat(dom.marginTop.value) || 0) * 0.4)));
        const mb = Math.min(25, Math.max(2, Math.round((parseFloat(dom.marginBottom.value) || 0) * 0.4)));

        dom.pagePreviewMargins.style.left = `${ml}px`;
        dom.pagePreviewMargins.style.right = `${mr}px`;
        dom.pagePreviewMargins.style.top = `${mt}px`;
        dom.pagePreviewMargins.style.bottom = `${mb}px`;
    }

    function confirmPageSetupDialog() {
        state.pageSetup.size = dom.pageSizeSelect.value;
        state.pageSetup.orientation = dom.orientLandscape.checked ? 'landscape' : 'portrait';
        state.pageSetup.margins = {
            left: Math.max(0, parseFloat(dom.marginLeft.value) || 0),
            right: Math.max(0, parseFloat(dom.marginRight.value) || 0),
            top: Math.max(0, parseFloat(dom.marginTop.value) || 0),
            bottom: Math.max(0, parseFloat(dom.marginBottom.value) || 0)
        };
        state.pageSetup.header = dom.pageHeaderInput.value;
        state.pageSetup.footer = dom.pageFooterInput.value;

        closeDialog(dom.dialogPageSetup);
        dom.editor.focus();
    }

    // =========================================================================
    // SPRÁVA DIALOGOVÝCH OKEN
    // =========================================================================

    function openModalDialog(dialogEl) {
        closeAllMenus();
        dom.modalBackdrop.style.display = 'block';
        dialogEl.style.display = 'flex';
    }

    function closeDialog(dialogEl) {
        if (!dialogEl) return;
        dialogEl.style.display = 'none';

        const anyModalOpen = Array.from(document.querySelectorAll('.modal-dialog')).some(
            (el) => el.style.display !== 'none'
        );
        if (!anyModalOpen) {
            dom.modalBackdrop.style.display = 'none';
            dom.editor.focus();
        }
    }

    function showAlert(message) {
        dom.alertMessageText.textContent = message;
        openModalDialog(dom.dialogAlert);
        document.getElementById('btn-alert-ok').focus();
    }

    function initDialogs() {
        document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-close-dialog');
                const dlg = document.getElementById(targetId);
                if (targetId === 'dialog-unsaved') {
                    state.pendingActionAfterSave = null;
                }
                closeDialog(dlg);
            });
        });

        // Dialog Neuložené změny
        dom.btnUnsavedSave.addEventListener('click', () => {
            closeDialog(dom.dialogUnsaved);
            saveDocument(false);
        });
        dom.btnUnsavedDontSave.addEventListener('click', () => {
            const nextFn = state.pendingActionAfterSave;
            state.pendingActionAfterSave = null;
            closeDialog(dom.dialogUnsaved);
            if (typeof nextFn === 'function') nextFn();
        });
        dom.btnUnsavedCancel.addEventListener('click', () => {
            state.pendingActionAfterSave = null;
            closeDialog(dom.dialogUnsaved);
        });

        // Dialog Uložit jako
        dom.btnSaveAsConfirm.addEventListener('click', confirmSaveAsDialog);

        // Dialog Hledat & Nahradit
        dom.btnFindNext.addEventListener('click', performFindNext);
        dom.btnReplaceFindNext.addEventListener('click', performFindNext);
        dom.btnReplaceOne.addEventListener('click', performReplaceOne);
        dom.btnReplaceAll.addEventListener('click', performReplaceAll);

        // Dialog Přejít na řádek
        dom.btnGotoConfirm.addEventListener('click', confirmGotoLine);

        // Dialog Písmo
        dom.fontFamilyList.addEventListener('change', () => {
            dom.fontFamilyInput.value = dom.fontFamilyList.options[dom.fontFamilyList.selectedIndex].text;
            updateFontDialogPreview();
        });
        dom.fontStyleList.addEventListener('change', () => {
            dom.fontStyleInput.value = dom.fontStyleList.options[dom.fontStyleList.selectedIndex].text;
            updateFontDialogPreview();
        });
        dom.fontSizeList.addEventListener('change', () => {
            dom.fontSizeInput.value = dom.fontSizeList.value;
            updateFontDialogPreview();
        });
        dom.fontSizeInput.addEventListener('input', updateFontDialogPreview);
        dom.btnFontOk.addEventListener('click', confirmFontDialog);

        // Dialog Vzhled stránky
        [dom.orientPortrait, dom.orientLandscape, dom.marginLeft, dom.marginRight, dom.marginTop, dom.marginBottom].forEach((el) => {
            el.addEventListener('input', updatePageSetupPreview);
            el.addEventListener('change', updatePageSetupPreview);
        });
        dom.btnPageSetupOk.addEventListener('click', confirmPageSetupDialog);

        // Otevření souboru přes skrytý <input type="file">
        dom.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                await loadFileObject(file, null);
            }
        });
    }

    // =========================================================================
    // UDÁLOSTI EDITORU A KLÁVESOVÉ ZKRATKY
    // =========================================================================

    function initEditorAndShortcuts() {
        dom.editor.addEventListener('input', () => {
            recordHistorySnapshot();
            checkDirtyState();
            updateStatusBar();
        });

        ['click', 'keyup', 'mouseup', 'select'].forEach((evtName) => {
            dom.editor.addEventListener(evtName, updateStatusBar);
        });

        // Podpora vložení tabulátoru klávesou Tab přímo v editoru (jako v nativním Notepadu)
        dom.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                replaceSelectionInEditor('\t');
            }
        });

        // Globální klávesové zkratky
        window.addEventListener('keydown', (e) => {
            // Escape zavírá otevřené nabídky nebo dialogy
            if (e.key === 'Escape') {
                if (isMenuBarActive || dom.contextMenu.style.display !== 'none') {
                    closeAllMenus();
                    dom.editor.focus();
                    return;
                }
                const openDialogs = Array.from(document.querySelectorAll('.win-dialog')).filter(
                    (el) => el.style.display !== 'none'
                );
                if (openDialogs.length > 0) {
                    const topDialog = openDialogs[openDialogs.length - 1];
                    if (topDialog.id === 'dialog-unsaved') {
                        state.pendingActionAfterSave = null;
                    }
                    closeDialog(topDialog);
                    return;
                }
            }

            // Enter v aktivním dialogu odešle výchozí tlačítko
            if (e.key === 'Enter') {
                const activeModal = Array.from(document.querySelectorAll('.win-dialog')).find(
                    (el) => el.style.display !== 'none' && el.contains(document.activeElement)
                );
                if (activeModal && document.activeElement.tagName !== 'BUTTON') {
                    e.preventDefault();
                    const defBtn = activeModal.querySelector('.default-btn');
                    if (defBtn) defBtn.click();
                    return;
                }
            }

            // F3 — Najít další
            if (e.key === 'F3') {
                e.preventDefault();
                executeAction('find-next');
                return;
            }

            // F5 — Čas a datum
            if (e.key === 'F5') {
                e.preventDefault();
                executeAction('time-date');
                return;
            }

            // Kombinace s Ctrl
            if (e.ctrlKey && !e.altKey) {
                const key = e.key.toLowerCase();

                if (key === 'n' && !e.shiftKey) {
                    e.preventDefault();
                    executeAction('new');
                } else if (key === 'o' && !e.shiftKey) {
                    e.preventDefault();
                    executeAction('open');
                } else if (key === 's' && !e.shiftKey) {
                    e.preventDefault();
                    executeAction('save');
                } else if (key === 's' && e.shiftKey) {
                    e.preventDefault();
                    executeAction('save-as');
                } else if (key === 'p' && !e.shiftKey) {
                    e.preventDefault();
                    executeAction('print');
                } else if (key === 'f' && !e.shiftKey) {
                    e.preventDefault();
                    executeAction('find');
                } else if (key === 'h' && !e.shiftKey) {
                    e.preventDefault();
                    executeAction('replace');
                } else if (key === 'g' && !e.shiftKey) {
                    e.preventDefault();
                    if (!state.wordWrap) executeAction('goto');
                } else if (key === 'z' && !e.shiftKey && document.activeElement === dom.editor) {
                    e.preventDefault();
                    performUndo();
                } else if (key === 'y' && !e.shiftKey && document.activeElement === dom.editor) {
                    e.preventDefault();
                    performRedo();
                }
            }
        });

        // Ochrana před nechtěným zavřením karty prohlížeče s neuloženým textem
        window.addEventListener('beforeunload', (e) => {
            if (state.isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // =========================================================================
    // INICIALIZACE PO SPUŠTĚNÍ
    // =========================================================================

    function init() {
        initWindowControls();
        initMenus();
        initDialogs();
        initEditorAndShortcuts();
        applyFontToEditor();
        updateWindowTitle();
        updateStatusBarVisibility();
        updateStatusBar();
        dom.editor.focus();
    }

    init();
})();
