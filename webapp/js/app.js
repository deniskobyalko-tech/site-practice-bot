const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = "/site-practice";
const AUTH_HEADER = { Authorization: "tma " + tg.initData };

const CHECKLIST_ITEMS = [
    "CTA виден без скролла",
    "Понятно, что делать, за 5 секунд",
    "Цена / выгода видна сразу",
    "Есть социальное доказательство",
    "Нет лишних переходов до целевого действия",
    "Мобильная версия работает так же хорошо",
];

const GROUPS = ["МДК01", "МДК02", "МДК03", "МДК04"];

let currentStep = 0;
let studentData = null;

// --- API helpers ---

async function api(method, path, body) {
    const opts = {
        method,
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(API_BASE + path, opts);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || resp.statusText);
    }
    return resp.json();
}

// --- Screens ---

function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");

    const bar = document.getElementById("progress-bar");
    if (id.startsWith("screen-step")) {
        bar.classList.remove("hidden");
        const step = parseInt(id.replace("screen-step", ""));
        updateProgressBar(step);
    } else {
        bar.classList.add("hidden");
    }
}

function updateProgressBar(activeStep) {
    document.querySelectorAll(".step-indicator").forEach((el) => {
        const s = parseInt(el.dataset.step);
        el.classList.remove("active", "done");
        if (s === activeStep) el.classList.add("active");
        else if (s < activeStep) el.classList.add("done");
    });
}

// --- Registration ---

function initRegistration() {
    const container = document.getElementById("group-select");
    container.innerHTML = "";
    let selectedGroup = null;

    GROUPS.forEach((g) => {
        const btn = document.createElement("div");
        btn.className = "group-btn";
        btn.textContent = g;
        btn.addEventListener("click", () => {
            container.querySelectorAll(".group-btn").forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedGroup = g;
        });
        container.appendChild(btn);
    });

    document.getElementById("btn-register").addEventListener("click", async () => {
        const name = document.getElementById("reg-name").value.trim();
        if (!selectedGroup) return tg.showAlert("Выберите группу");
        if (!name) return tg.showAlert("Введите ФИО");

        try {
            await api("POST", "/api/register", { name, group: selectedGroup });
            await loadStudent();
        } catch (e) {
            tg.showAlert("Ошибка: " + e.message);
        }
    });
}

// --- Load student & resume ---

async function loadStudent() {
    try {
        const data = await api("GET", "/api/student");
        studentData = data;
        const completed = data.progress.completed_steps;

        if (data.progress.status === "submitted") {
            showScreen("screen-done");
            return;
        }

        await loadSites();
        initChecklist();

        // Restore saved answers
        for (const sub of data.progress.submissions) {
            restoreAnswers(sub.step, JSON.parse(sub.answers));
        }

        // Go to next incomplete step
        const nextStep = completed.length === 0 ? 1 : Math.max(...completed) + 1;
        showScreen("screen-step" + Math.min(nextStep, 3));
    } catch {
        showScreen("screen-register");
    }
}

// --- Sites dropdown ---

async function loadSites() {
    try {
        const sites = await api("GET", "/api/sites");
        const select = document.getElementById("site-select");
        select.innerHTML = '<option value="">— Выберите сайт —</option>';

        const categories = {};
        sites.forEach((s) => {
            if (!categories[s.category]) categories[s.category] = [];
            categories[s.category].push(s);
        });

        Object.entries(categories).forEach(([cat, items]) => {
            const group = document.createElement("optgroup");
            group.label = cat;
            items.forEach((s) => {
                const opt = document.createElement("option");
                opt.value = s.url;
                opt.textContent = s.name;
                group.appendChild(opt);
            });
            select.appendChild(group);
        });

        const customOpt = document.createElement("option");
        customOpt.value = "__custom__";
        customOpt.textContent = "Свой сайт...";
        select.appendChild(customOpt);

        select.addEventListener("change", () => {
            const customGroup = document.getElementById("custom-url-group");
            if (select.value === "__custom__") customGroup.classList.remove("hidden");
            else customGroup.classList.add("hidden");
        });
    } catch (e) {
        console.error("Failed to load sites:", e);
    }
}

// --- Checklist ---

function initChecklist() {
    const container = document.getElementById("checklist");
    container.innerHTML = "";

    CHECKLIST_ITEMS.forEach((text, i) => {
        const div = document.createElement("div");
        div.className = "checklist-item";
        div.innerHTML =
            '<label>' + text + '</label>' +
            '<div class="toggle-group">' +
                '<button class="toggle-btn" data-idx="' + i + '" data-val="yes">Да</button>' +
                '<button class="toggle-btn" data-idx="' + i + '" data-val="no">Нет</button>' +
            '</div>' +
            '<textarea id="s3-check-' + i + '" rows="1" placeholder="Комментарий"></textarea>';
        container.appendChild(div);
    });

    container.addEventListener("click", (e) => {
        if (!e.target.classList.contains("toggle-btn")) return;
        const idx = e.target.dataset.idx;
        const val = e.target.dataset.val;
        container.querySelectorAll('.toggle-btn[data-idx="' + idx + '"]').forEach((b) => {
            b.classList.remove("selected-yes", "selected-no");
        });
        e.target.classList.add(val === "yes" ? "selected-yes" : "selected-no");
    });
}

// --- Collect answers ---

function collectStep1() {
    const select = document.getElementById("site-select");
    const site = select.value === "__custom__"
        ? document.getElementById("custom-url").value.trim()
        : select.value;

    return {
        site,
        task: document.getElementById("s1-task").value.trim(),
        action: document.getElementById("s1-action").value.trim(),
        interface: document.getElementById("s1-interface").value.trim(),
        metric: document.getElementById("s1-metric").value.trim(),
        q1_cta: document.getElementById("s1-q1").value.trim(),
        q2_social_proof: document.getElementById("s1-q2").value.trim(),
        q3_clicks: document.getElementById("s1-q3-num").value,
        q3_comment: document.getElementById("s1-q3-comment").value.trim(),
        q4_additional: document.getElementById("s1-q4").value.trim(),
    };
}

function collectStep2() {
    return {
        url1: document.getElementById("s2-url1").value.trim(),
        url2: document.getElementById("s2-url2").value.trim(),
        site1: {
            task: document.getElementById("s2-s1-task").value.trim(),
            audience: document.getElementById("s2-s1-audience").value.trim(),
            cta: document.getElementById("s2-s1-cta").value.trim(),
            content: document.getElementById("s2-s1-content").value.trim(),
            metric: document.getElementById("s2-s1-metric").value.trim(),
        },
        site2: {
            task: document.getElementById("s2-s2-task").value.trim(),
            audience: document.getElementById("s2-s2-audience").value.trim(),
            cta: document.getElementById("s2-s2-cta").value.trim(),
            content: document.getElementById("s2-s2-content").value.trim(),
            metric: document.getElementById("s2-s2-metric").value.trim(),
        },
        why_split: document.getElementById("s2-why").value.trim(),
    };
}

function collectStep3() {
    const checklist = CHECKLIST_ITEMS.map((text, i) => {
        const yesBtn = document.querySelector('.toggle-btn[data-idx="' + i + '"].selected-yes');
        const noBtn = document.querySelector('.toggle-btn[data-idx="' + i + '"].selected-no');
        return {
            question: text,
            answer: yesBtn ? "yes" : noBtn ? "no" : null,
            comment: document.getElementById("s3-check-" + i).value.trim(),
        };
    });

    return {
        checklist,
        remove: document.getElementById("s3-remove").value.trim(),
        add: document.getElementById("s3-add").value.trim(),
        change: document.getElementById("s3-change").value.trim(),
    };
}

// --- Restore answers ---

function restoreAnswers(step, answers) {
    if (step === 1) {
        const select = document.getElementById("site-select");
        const opts = Array.from(select.options).map((o) => o.value);
        if (opts.includes(answers.site)) {
            select.value = answers.site;
        } else if (answers.site) {
            select.value = "__custom__";
            document.getElementById("custom-url").value = answers.site;
            document.getElementById("custom-url-group").classList.remove("hidden");
        }
        document.getElementById("s1-task").value = answers.task || "";
        document.getElementById("s1-action").value = answers.action || "";
        document.getElementById("s1-interface").value = answers.interface || "";
        document.getElementById("s1-metric").value = answers.metric || "";
        document.getElementById("s1-q1").value = answers.q1_cta || "";
        document.getElementById("s1-q2").value = answers.q2_social_proof || "";
        document.getElementById("s1-q3-num").value = answers.q3_clicks || "";
        document.getElementById("s1-q3-comment").value = answers.q3_comment || "";
        document.getElementById("s1-q4").value = answers.q4_additional || "";
    } else if (step === 2) {
        document.getElementById("s2-url1").value = answers.url1 || "";
        document.getElementById("s2-url2").value = answers.url2 || "";
        ["task", "audience", "cta", "content", "metric"].forEach((f) => {
            document.getElementById("s2-s1-" + f).value = (answers.site1 && answers.site1[f]) || "";
            document.getElementById("s2-s2-" + f).value = (answers.site2 && answers.site2[f]) || "";
        });
        document.getElementById("s2-why").value = answers.why_split || "";
    } else if (step === 3) {
        if (answers.checklist) {
            answers.checklist.forEach((item, i) => {
                if (item.answer) {
                    const btn = document.querySelector(
                        '.toggle-btn[data-idx="' + i + '"][data-val="' + item.answer + '"]'
                    );
                    if (btn) btn.classList.add(item.answer === "yes" ? "selected-yes" : "selected-no");
                }
                document.getElementById("s3-check-" + i).value = item.comment || "";
            });
        }
        document.getElementById("s3-remove").value = answers.remove || "";
        document.getElementById("s3-add").value = answers.add || "";
        document.getElementById("s3-change").value = answers.change || "";
    }
}

// --- Navigation ---

async function submitStep(step, answers) {
    try {
        const result = await api("POST", "/api/submit/" + step, answers);
        return result;
    } catch (e) {
        tg.showAlert("Ошибка сохранения: " + e.message);
        return null;
    }
}

document.getElementById("btn-next-1").addEventListener("click", async () => {
    const answers = collectStep1();
    if (!answers.site) return tg.showAlert("Выберите сайт");
    if (!answers.task) return tg.showAlert("Заполните поле Задача");
    const result = await submitStep(1, answers);
    if (result) showScreen("screen-step2");
});

document.getElementById("btn-back-2").addEventListener("click", () => showScreen("screen-step1"));

document.getElementById("btn-next-2").addEventListener("click", async () => {
    const answers = collectStep2();
    if (!answers.url1 || !answers.url2) return tg.showAlert("Введите оба URL");
    const result = await submitStep(2, answers);
    if (result) showScreen("screen-step3");
});

document.getElementById("btn-back-3").addEventListener("click", () => showScreen("screen-step2"));

document.getElementById("btn-submit").addEventListener("click", async () => {
    const answers = collectStep3();
    const unanswered = answers.checklist.filter((c) => c.answer === null);
    if (unanswered.length > 0) return tg.showAlert("Ответьте на все пункты чек-листа");

    tg.showConfirm("Сдать практику? После сдачи редактирование будет недоступно.", async (ok) => {
        if (!ok) return;
        const result = await submitStep(3, answers);
        if (result) {
            api("POST", "/api/notify-completion", {}).catch(() => {});
            showScreen("screen-done");
            tg.MainButton.hide();
        }
    });
});

// --- Review mode (read-only) ---

document.getElementById("btn-review").addEventListener("click", async () => {
    try {
        const data = await api("GET", "/api/student");
        const container = document.getElementById("review-content");
        container.innerHTML = "";
        const stepTitles = { 1: "Анализ сайта", 2: "Сравнительный анализ", 3: "Аудит и рекомендации" };
        for (const sub of data.progress.submissions) {
            const answers = JSON.parse(sub.answers);
            const div = document.createElement("div");
            div.style.marginBottom = "16px";
            let html = '<h3>Шаг ' + sub.step + ': ' + stepTitles[sub.step] + '</h3>';
            Object.entries(answers).forEach(([k, v]) => {
                if (v && typeof v === "string") {
                    html += '<div class="hint" style="margin:4px 0"><strong>' + k + ':</strong> ' + v + '</div>';
                } else if (Array.isArray(v)) {
                    v.forEach((item) => {
                        if (item.question) {
                            const icon = item.answer === "yes" ? "+" : item.answer === "no" ? "-" : "?";
                            html += '<div class="hint" style="margin:4px 0"><strong>[' + icon + '] ' + item.question + ':</strong> ' + (item.comment || "") + '</div>';
                        }
                    });
                } else if (v && typeof v === "object") {
                    Object.entries(v).forEach(([k2, v2]) => {
                        if (v2) html += '<div class="hint" style="margin:4px 0"><strong>' + k + '.' + k2 + ':</strong> ' + v2 + '</div>';
                    });
                }
            });
            div.innerHTML = html;
            container.appendChild(div);
        }
        showScreen("screen-review");
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
});

document.getElementById("btn-back-review").addEventListener("click", () => showScreen("screen-done"));

// --- Auto-save on blur ---

let saveTimer = null;
function setupAutoSave() {
    document.querySelectorAll("textarea, input").forEach((el) => {
        el.addEventListener("blur", () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                const screen = document.querySelector(".screen:not(.hidden)");
                if (!screen) return;
                const id = screen.id;
                if (id === "screen-step1") await submitStep(1, collectStep1()).catch(() => {});
                else if (id === "screen-step2") await submitStep(2, collectStep2()).catch(() => {});
                else if (id === "screen-step3") await submitStep(3, collectStep3()).catch(() => {});
            }, 500);
        });
    });
}

// --- Init ---

initRegistration();
loadStudent().then(() => setupAutoSave());
