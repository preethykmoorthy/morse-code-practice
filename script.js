"use strict";

/* =========================================
   MORSE NOTE — OFFLINE WRITING STUDIO
   ========================================= */

const $ = (selector) => document.querySelector(selector);

const morseInput = $("#morseInput");
const englishOutput = $("#englishOutput");
const documentTitle = $("#documentTitle");
const documentCategory = $("#documentCategory");
const inputMode = $("#inputMode");
const saveStatus = $("#saveStatus");
const toast = $("#toast");

const STORAGE_KEY = "morsenote.documents.v1";
const ACTIVE_KEY = "morsenote.active.v1";

const MORSE = {
    A: ".-",    B: "-...",  C: "-.-.",  D: "-..",
    E: ".",     F: "..-.",  G: "--.",   H: "....",
    I: "..",    J: ".---",  K: "-.-",   L: ".-..",
    M: "--",    N: "-.",    O: "---",   P: ".--.",
    Q: "--.-",  R: ".-.",   S: "...",   T: "-",
    U: "..-",   V: "...-",  W: ".--",   X: "-..-",
    Y: "-.--",  Z: "--..",

    "0": "-----", "1": ".----", "2": "..---",
    "3": "...--", "4": "....-", "5": ".....",
    "6": "-....", "7": "--...", "8": "---..",
    "9": "----.",

    ".": ".-.-.-",
    ",": "--..--",
    "?": "..--..",
    "'": ".----.",
    "!": "-.-.--",
    "/": "-..-.",
    "(": "-.--.",
    ")": "-.--.-",
    "&": ".-...",
    ":": "---...",
    ";": "-.-.-.",
    "=": "-...-",
    "+": ".-.-.",
    "-": "-....-",
    "_": "..--.-",
    "\"": ".-..-.",
    "$": "...-..-",
    "@": ".--.-."
};

const REVERSE_MORSE = Object.fromEntries(
    Object.entries(MORSE).map(([character, code]) => [
        code,
        character
    ])
);

let documents = [];
let activeDocumentId = null;
let selectedCategory = "All";
let saveTimer = null;
let toastTimer = null;
let pressStartedAt = null;
let keyerPressHandled = false;

/* =========================================
   STORAGE
   ========================================= */

function loadDocuments() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];

        documents = Array.isArray(parsed)
            ? parsed.filter(doc =>
                doc &&
                typeof doc.id === "string" &&
                typeof doc.title === "string" &&
                typeof doc.morse === "string"
            )
            : [];
    } catch (error) {
        console.error("Could not load documents:", error);
        documents = [];
        showToast("Saved data could not be read.");
    }
}

function persistDocuments() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(documents)
        );

        saveStatus.textContent = "● Saved locally";
        saveStatus.style.color = "var(--green)";

        return true;
    } catch (error) {
        console.error("Could not save documents:", error);

        saveStatus.textContent = "● Save failed";
        saveStatus.style.color = "#d34b4b";

        showToast(
            "Could not save. Export a backup before continuing."
        );

        return false;
    }
}

function scheduleSave() {
    saveStatus.textContent = "● Saving...";
    saveStatus.style.color = "var(--muted)";

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
        saveCurrentDocument();
    }, 300);
}

function saveCurrentDocument() {
    if (!activeDocumentId) return;

    const doc = documents.find(
        item => item.id === activeDocumentId
    );

    if (!doc) return;

    doc.title =
        documentTitle.value.trim() || "Untitled document";

    doc.category = documentCategory.value;
    doc.morse = morseInput.value;
    doc.updatedAt = new Date().toISOString();

    persistDocuments();
    renderDocumentList();
}

function createDocument(title, category) {
    const doc = {
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) +
              Math.random().toString(36).slice(2),

        title: title.trim() || "Untitled document",
        category,
        morse: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    documents.unshift(doc);

    if (!persistDocuments()) {
        documents.shift();
        return;
    }

    openDocument(doc.id);
    showToast("New document created.");
}

function openDocument(id) {
    clearTimeout(saveTimer);

    const doc = documents.find(item => item.id === id);

    if (!doc) return;

    activeDocumentId = id;

    documentTitle.value = doc.title;
    documentCategory.value = doc.category;
    morseInput.value = doc.morse;

    decodeMorse();
    localStorage.setItem(ACTIVE_KEY, id);

    renderDocumentList();
}

function deleteDocument(id) {
    const doc = documents.find(item => item.id === id);

    if (!doc) return;

    const confirmed = confirm(
        `Delete "${doc.title}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    documents = documents.filter(item => item.id !== id);

    if (activeDocumentId === id) {
        activeDocumentId = null;
    }

    persistDocuments();

    if (activeDocumentId) {
        openDocument(activeDocumentId);
    } else if (documents.length) {
        openDocument(documents[0].id);
    } else {
        createDocument("My first document", "Notes");
    }

    renderDocumentList();
    showToast("Document deleted.");
}

/* =========================================
   MORSE DECODER
   ========================================= */

function normalizeMorse(code) {
    return code
        .replace(/[−–—]/g, "-")
        .replace(/[•·]/g, ".")
        .replace(/[^\s./-]/g, "");
}

function decodeMorse() {
    const source = normalizeMorse(morseInput.value);

    const decoded = source
        .split("/")
        .map(word => {
            return word
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map(code => REVERSE_MORSE[code] || "�")
                .join("");
        })
        .join(" ");

    englishOutput.value = decoded;

    updateCounts();
}

function updateCounts() {
    const text = englishOutput.value;
    const trimmed = text.trim();

    const words = trimmed
        ? trimmed.split(/\s+/).length
        : 0;

    $("#characterCount").textContent =
        `${text.length} character${text.length === 1 ? "" : "s"}`;

    $("#wordCount").textContent =
        `${words} word${words === 1 ? "" : "s"}`;
}

/* =========================================
   EDITOR INPUT
   ========================================= */

morseInput.addEventListener("input", () => {
    decodeMorse();
    scheduleSave();
});

documentTitle.addEventListener("input", scheduleSave);
documentCategory.addEventListener("change", scheduleSave);

/*
Direct mode:
    Type dots and dashes.
    Space separates letters.
    / separates words.

Telegraph mode:
    Short spacebar press = dot.
    Long spacebar press = dash.
    Tab = next letter.
    Enter = next word.
*/

morseInput.addEventListener("keydown", event => {
    if (inputMode.value !== "keyer") return;

    // Spacebar: start timing for dot or dash
    if (event.code === "Space") {
        event.preventDefault();

        if (!event.repeat && pressStartedAt === null) {
            pressStartedAt = performance.now();
            keyerPressHandled = false;
        }

        return;
    }

    // 0: separate letters
    if (event.code === "Digit0" || event.code === "Numpad0") {
        event.preventDefault();

        if (!event.repeat) {
            appendMorseSeparator(" ");
        }

        return;
    }

    // Enter: separate words
    if (event.key === "Enter") {
        event.preventDefault();
        appendMorseSeparator(" / ");
        return;
    }

    // Allow deleting characters
    if (event.key === "Backspace" || event.key === "Delete") {
        return;
    }

    // Block other printable keys in telegraph mode
    if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
    ) {
        event.preventDefault();
    }
});

function handleKeyerRelease(event) {
    if (event.code !== "Space") return;
    if (pressStartedAt === null) return;
    if (inputMode.value !== "keyer") return;

    const duration = performance.now() - pressStartedAt;

    pressStartedAt = null;
    keyerPressHandled = true;

    const symbol = duration >= 220 ? "-" : ".";

    appendMorseSymbol(symbol);
}

morseInput.addEventListener("keyup", handleKeyerRelease);

/*
Handle releasing the spacebar outside the editor
as well, such as when the pointer moves away.
*/
window.addEventListener("keyup", event => {
    if (
        event.code === "Space" &&
        pressStartedAt !== null &&
        document.activeElement !== morseInput
    ) {
        handleKeyerRelease(event);
    }
});

window.addEventListener("blur", () => {
    pressStartedAt = null;
});

function appendMorseSymbol(symbol) {
    insertAtCursor(morseInput, symbol);
    decodeMorse();
    scheduleSave();
}

function appendMorseSeparator(separator) {
    const value = morseInput.value;

    /*
    Avoid adding repeated letter separators.
    Keep the input readable and easy to edit.
    */
    if (separator === " ") {
        if (!value || /\s$/.test(value)) return;
    }

    if (separator === " / ") {
        if (!value.trim() || /\/\s*$/.test(value)) return;
    }

    insertAtCursor(morseInput, separator);
    decodeMorse();
    scheduleSave();
}

function insertAtCursor(element, text) {
    const start = element.selectionStart;
    const end = element.selectionEnd;

    element.setRangeText(
        text,
        start,
        end,
        "end"
    );

    element.focus();
}

/* =========================================
   NOTEBOOK SIDEBAR
   ========================================= */

const documentList = document.createElement("div");

documentList.id = "documentList";
documentList.style.marginTop = "16px";

$(".sidebar-bottom").before(documentList);

function renderDocumentList() {
    documentList.replaceChildren();

    const search = $("#searchInput").value
        .trim()
        .toLowerCase();

    const filtered = documents.filter(doc => {
        const matchesCategory =
            selectedCategory === "All" ||
            doc.category === selectedCategory;

        const matchesSearch =
            doc.title.toLowerCase().includes(search);

        return matchesCategory && matchesSearch;
    });

    $("#documentCount").textContent = documents.length;

    if (!filtered.length) {
        const empty = document.createElement("p");

        empty.textContent = documents.length
            ? "No matching documents."
            : "Your notebook is empty.";

        empty.style.cssText =
            "color:var(--muted);font-size:11px;line-height:1.6";

        documentList.append(empty);
        return;
    }

    filtered.forEach(doc => {
        const row = document.createElement("div");

        row.style.cssText = `
            display:flex;
            align-items:center;
            gap:4px;
            margin:4px 0;
            border-radius:7px;
            background:${
                doc.id === activeDocumentId
                    ? "var(--accent-light)"
                    : "transparent"
            };
        `;

        const openButton = document.createElement("button");

        openButton.textContent = doc.title;
        openButton.title = doc.title;

        openButton.style.cssText = `
            flex:1;
            min-width:0;
            padding:10px 8px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            border:0;
            background:transparent;
            color:${
                doc.id === activeDocumentId
                    ? "var(--accent)"
                    : "var(--text)"
            };
            text-align:left;
            font-size:11px;
            font-weight:${
                doc.id === activeDocumentId ? "700" : "400"
            };
        `;

        openButton.addEventListener("click", () => {
            saveCurrentDocument();
            openDocument(doc.id);
        });

        const deleteButton = document.createElement("button");

        deleteButton.textContent = "×";
        deleteButton.title = "Delete document";

        deleteButton.style.cssText = `
            border:0;
            background:transparent;
            color:var(--muted);
            padding:6px 9px;
            font-size:17px;
        `;

        deleteButton.addEventListener("click", () => {
            deleteDocument(doc.id);
        });

        row.append(openButton, deleteButton);
        documentList.append(row);
    });
}

/* =========================================
   CATEGORIES AND SEARCH
   ========================================= */

document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;

        document.querySelectorAll(".category").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderDocumentList();
    });
});

$("#searchInput").addEventListener("input", renderDocumentList);

/* =========================================
   NEW DOCUMENT
   ========================================= */

const modal = $("#newDocumentModal");

function showNewDocumentDialog() {
    modal.classList.remove("hidden");
    $("#newTitle").value = "";
    $("#newCategory").value = "Books";
    $("#newTitle").focus();
}

function closeNewDocumentDialog() {
    modal.classList.add("hidden");
}

$("#newDocumentBtn").addEventListener(
    "click",
    showNewDocumentDialog
);

$("#sidebarNewBtn").addEventListener(
    "click",
    showNewDocumentDialog
);

$("#cancelNewBtn").addEventListener(
    "click",
    closeNewDocumentDialog
);

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeNewDocumentDialog();
    }
});

$("#newDocumentForm").addEventListener("submit", event => {
    event.preventDefault();

    saveCurrentDocument();

    const title = $("#newTitle").value;
    const category = $("#newCategory").value;

    createDocument(title, category);

    closeNewDocumentDialog();
});

/* =========================================
   DOWNLOADS
   ========================================= */

function downloadText(filename, text) {
    const blob = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;

    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(title) {
    return (
        title
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
            .trim()
            .slice(0, 120) || "MorseNote"
    );
}

function downloadMorse() {
    saveCurrentDocument();

    const title = safeFilename(documentTitle.value);

    downloadText(
        `${title}_Morse.txt`,
        morseInput.value
    );

    showToast("Morse source downloaded.");
}

function downloadEnglish() {
    saveCurrentDocument();

    const title = safeFilename(documentTitle.value);

    downloadText(
        `${title}_English.txt`,
        englishOutput.value
    );

    showToast("English output downloaded.");
}

$("#downloadMorseBtn").addEventListener(
    "click",
    downloadMorse
);

$("#downloadEnglishBtn").addEventListener(
    "click",
    downloadEnglish
);

$("#downloadBothBtn").addEventListener("click", () => {
    saveCurrentDocument();

    const title = safeFilename(documentTitle.value);

    downloadText(
        `${title}_Morse.txt`,
        morseInput.value
    );

    setTimeout(() => {
        downloadText(
            `${title}_English.txt`,
            englishOutput.value
        );
    }, 350);

    showToast("Exporting both versions...");
});

/* =========================================
   TOAST NOTIFICATIONS
   ========================================= */

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

/* =========================================
   STARTUP
   ========================================= */

function initialize() {
    loadDocuments();

    if (!documents.length) {
        createDocument("My first document", "Notes");
    } else {
        const previousId = localStorage.getItem(ACTIVE_KEY);

        const previousDocument = documents.find(
            doc => doc.id === previousId
        );

        openDocument(
            previousDocument
                ? previousDocument.id
                : documents[0].id
        );
    }

    renderDocumentList();
}

initialize();