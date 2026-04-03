// Web version — no Telegram dependency
const API_BASE = "/site-practice";
var AUTH_HEADER = {};
var savedToken = localStorage.getItem("practice_token");
if (savedToken) AUTH_HEADER = { Authorization: "Bearer " + savedToken };

var tg = {
    showAlert: function (msg) { alert(msg); },
    showConfirm: function (msg, cb) { cb(confirm(msg)); },
};

const CHECKLIST_ITEMS = [
    "CTA виден без скролла",
    "Понятно, что делать, за 5 секунд",
    "Цена / выгода видна сразу",
    "Есть социальное доказательство",
    "Нет лишних переходов до целевого действия",
    "Мобильная версия работает так же хорошо",
];

const GROUPS = ["МДК01", "МДК02", "МДК03", "МДК04"];

let studentData = null;
let chosenSite = "";

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
    window.scrollTo(0, 0);

    const bar = document.getElementById("progress-bar");
    // step1a/1b/1c all show step 1 active
    if (id.startsWith("screen-step1")) {
        bar.classList.remove("hidden");
        updateProgressBar(1);
    } else if (id === "screen-step2") {
        bar.classList.remove("hidden");
        updateProgressBar(2);
    } else if (id === "screen-step3" || id === "screen-summary") {
        bar.classList.remove("hidden");
        updateProgressBar(3);
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

// --- Site reminder ---

function getSiteName() {
    var select = document.getElementById("site-select");
    if (select.value === "__custom__") return document.getElementById("custom-url").value.trim();
    if (select.value) return select.options[select.selectedIndex].textContent + " (" + select.value + ")";
    return "";
}

function updateReminders() {
    chosenSite = getSiteName();
    var platform = getSelectedPlatform();
    var platformLabel = platform === "web" ? "WEB" : platform === "mobile" ? "Мобильный WEB" : "";
    var text = chosenSite;
    if (platformLabel) text += " — " + platformLabel;
    document.querySelectorAll(".site-reminder").forEach(function (el) {
        el.textContent = text || "";
        el.style.display = text ? "block" : "none";
    });
}

// --- Registration ---

function initRegistration() {
    var container = document.getElementById("group-select");
    container.innerHTML = "";
    var selectedGroup = null;

    GROUPS.forEach(function (g) {
        var btn = document.createElement("div");
        btn.className = "group-btn";
        btn.textContent = g;
        btn.addEventListener("click", function () {
            container.querySelectorAll(".group-btn").forEach(function (b) { b.classList.remove("selected"); });
            btn.classList.add("selected");
            selectedGroup = g;
        });
        container.appendChild(btn);
    });

    document.getElementById("btn-register").addEventListener("click", async function () {
        var name = document.getElementById("reg-name").value.trim();
        if (!selectedGroup) return tg.showAlert("Выберите группу");
        if (!name) return tg.showAlert("Введите ФИО");

        try {
            var opts = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name, group: selectedGroup }),
            };
            var resp = await fetch(API_BASE + "/api/web-register", opts);
            if (!resp.ok) throw new Error((await resp.json().catch(function(){return {};})).detail || resp.statusText);
            var result = await resp.json();
            localStorage.setItem("practice_token", result.token);
            AUTH_HEADER = { Authorization: "Bearer " + result.token };
            await loadStudent();
        } catch (e) {
            tg.showAlert("Ошибка: " + e.message);
        }
    });
}

// --- Load student & resume ---

async function loadStudent() {
    try {
        var data = await api("GET", "/api/student");
        studentData = data;
        var completed = data.progress.completed_steps;

        if (data.progress.status === "submitted") {
            if (data.is_admin) {
                document.getElementById("btn-reset").style.display = "block";
            }
            showScreen("screen-done");
            return;
        }

        await loadSites();
        initChecklist();

        for (var i = 0; i < data.progress.submissions.length; i++) {
            var sub = data.progress.submissions[i];
            restoreAnswers(sub.step, JSON.parse(sub.answers));
        }

        updateReminders();

        if (completed.length === 0) {
            showScreen("screen-step1a");
        } else {
            var maxStep = Math.max.apply(null, completed);
            if (maxStep >= 3) showScreen("screen-step3");
            else if (maxStep === 2) showScreen("screen-step3");
            else if (maxStep === 1) showScreen("screen-step2");
        }
    } catch (e) {
        showScreen("screen-register");
    }
}

// --- Sites dropdown ---

async function loadSites() {
    try {
        var sites = await api("GET", "/api/sites");
        var select = document.getElementById("site-select");
        select.innerHTML = '<option value="">— Выберите сайт —</option>';

        var categories = {};
        sites.forEach(function (s) {
            if (!categories[s.category]) categories[s.category] = [];
            categories[s.category].push(s);
        });

        Object.entries(categories).forEach(function (entry) {
            var cat = entry[0], items = entry[1];
            var group = document.createElement("optgroup");
            group.label = cat;
            items.forEach(function (s) {
                var opt = document.createElement("option");
                opt.value = s.url;
                opt.textContent = s.name;
                group.appendChild(opt);
            });
            select.appendChild(group);
        });

        var customOpt = document.createElement("option");
        customOpt.value = "__custom__";
        customOpt.textContent = "Свой сайт...";
        select.appendChild(customOpt);

        select.addEventListener("change", function () {
            var customGroup = document.getElementById("custom-url-group");
            if (select.value === "__custom__") customGroup.classList.remove("hidden");
            else customGroup.classList.add("hidden");
        });
    } catch (e) {
        console.error("Failed to load sites:", e);
    }
}

// --- Platform select ---

document.getElementById("platform-select").addEventListener("click", function (e) {
    var btn = e.target.closest(".group-btn");
    if (!btn) return;
    document.querySelectorAll("#platform-select .group-btn").forEach(function (b) { b.classList.remove("selected"); });
    btn.classList.add("selected");
});

function getSelectedPlatform() {
    var selected = document.querySelector("#platform-select .group-btn.selected");
    return selected ? selected.dataset.val : null;
}

// --- Step 2: dynamic site titles ---

function updateStep2Titles() {
    var url1 = document.getElementById("s2-url1").value.trim();
    var url2 = document.getElementById("s2-url2").value.trim();
    document.getElementById("s2-title-1").textContent = url1 ? urlToName(url1) : "Сайт 1";
    document.getElementById("s2-title-2").textContent = url2 ? urlToName(url2) : "Сайт 2";
}

function urlToName(url) {
    try {
        var hostname = new URL(url).hostname.replace("www.", "");
        return hostname;
    } catch (e) {
        return url;
    }
}

document.getElementById("s2-url1").addEventListener("input", updateStep2Titles);
document.getElementById("s2-url2").addEventListener("input", updateStep2Titles);

// --- Checklist ---

function initChecklist() {
    var container = document.getElementById("checklist");
    container.innerHTML = "";

    CHECKLIST_ITEMS.forEach(function (text, i) {
        var div = document.createElement("div");
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

    container.addEventListener("click", function (e) {
        if (!e.target.classList.contains("toggle-btn")) return;
        var idx = e.target.dataset.idx;
        var val = e.target.dataset.val;
        container.querySelectorAll('.toggle-btn[data-idx="' + idx + '"]').forEach(function (b) {
            b.classList.remove("selected-yes", "selected-no");
        });
        e.target.classList.add(val === "yes" ? "selected-yes" : "selected-no");
    });
}

// --- Collect answers ---

function collectStep1() {
    var select = document.getElementById("site-select");
    var site = select.value === "__custom__"
        ? document.getElementById("custom-url").value.trim()
        : select.value;

    return {
        site: site,
        platform: getSelectedPlatform(),
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
    var checklist = CHECKLIST_ITEMS.map(function (text, i) {
        var yesBtn = document.querySelector('.toggle-btn[data-idx="' + i + '"].selected-yes');
        var noBtn = document.querySelector('.toggle-btn[data-idx="' + i + '"].selected-no');
        return {
            question: text,
            answer: yesBtn ? "yes" : noBtn ? "no" : null,
            comment: document.getElementById("s3-check-" + i).value.trim(),
        };
    });

    return {
        checklist: checklist,
        remove: document.getElementById("s3-remove").value.trim(),
        add: document.getElementById("s3-add").value.trim(),
        change: document.getElementById("s3-change").value.trim(),
    };
}

// --- Restore answers ---

function restoreAnswers(step, answers) {
    if (step === 1) {
        var select = document.getElementById("site-select");
        var opts = Array.from(select.options).map(function (o) { return o.value; });
        if (opts.includes(answers.site)) {
            select.value = answers.site;
        } else if (answers.site) {
            select.value = "__custom__";
            document.getElementById("custom-url").value = answers.site;
            document.getElementById("custom-url-group").classList.remove("hidden");
        }
        if (answers.platform) {
            var btn = document.querySelector('#platform-select .group-btn[data-val="' + answers.platform + '"]');
            if (btn) {
                document.querySelectorAll("#platform-select .group-btn").forEach(function (b) { b.classList.remove("selected"); });
                btn.classList.add("selected");
            }
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
        ["task", "audience", "cta", "content", "metric"].forEach(function (f) {
            document.getElementById("s2-s1-" + f).value = (answers.site1 && answers.site1[f]) || "";
            document.getElementById("s2-s2-" + f).value = (answers.site2 && answers.site2[f]) || "";
        });
        document.getElementById("s2-why").value = answers.why_split || "";
        updateStep2Titles();
    } else if (step === 3) {
        if (answers.checklist) {
            answers.checklist.forEach(function (item, i) {
                if (item.answer) {
                    var btn = document.querySelector(
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

// --- Count filled fields ---

function countFilled(obj) {
    var total = 0, filled = 0;
    function walk(val) {
        if (val === null || val === undefined) return;
        if (Array.isArray(val)) {
            val.forEach(function (item) {
                if (item && typeof item === "object" && item.question) {
                    total++; if (item.answer) filled++;
                    total++; if (item.comment) filled++;
                } else { walk(item); }
            });
        } else if (typeof val === "object") {
            Object.values(val).forEach(walk);
        } else {
            total++;
            if (String(val).trim() !== "") filled++;
        }
    }
    walk(obj);
    return { total: total, filled: filled };
}

// --- Summary screen ---

function showSummary() {
    var s1 = collectStep1();
    var s2 = collectStep2();
    var s3 = collectStep3();

    var c1 = countFilled(s1);
    var c2 = countFilled(s2);
    var c3 = countFilled(s3);
    var totalFilled = c1.filled + c2.filled + c3.filled;
    var totalAll = c1.total + c2.total + c3.total;

    var html = '';
    html += '<div class="summary-stat ' + (totalFilled === totalAll ? "ok" : "warn") + '">';
    html += '<span>Заполнено полей</span>';
    html += '<span class="count">' + totalFilled + ' / ' + totalAll + '</span>';
    html += '</div>';

    html += '<div class="summary-section"><h4>Шаг 1: Анализ сайта</h4>';
    html += '<div class="summary-field"><strong>Сайт:</strong> ' + esc(s1.site || "—") + '</div>';
    html += '<div class="summary-field"><strong>Платформа:</strong> ' + esc(s1.platform === "web" ? "WEB" : s1.platform === "mobile" ? "Мобильный WEB" : "—") + '</div>';
    html += '<div class="summary-field"><strong>Задача:</strong> ' + esc(s1.task || "—") + '</div>';
    html += '<div class="summary-field"><strong>Действие:</strong> ' + esc(s1.action || "—") + '</div>';
    html += '<div class="summary-field"><strong>Интерфейс:</strong> ' + esc(s1.interface || "—") + '</div>';
    html += '<div class="summary-field"><strong>Метрика:</strong> ' + esc(s1.metric || "—") + '</div>';
    html += '</div>';

    html += '<div class="summary-section"><h4>Шаг 2: Сравнение</h4>';
    html += '<div class="summary-field"><strong>Сайт 1:</strong> ' + esc(s2.url1 || "—") + '</div>';
    html += '<div class="summary-field"><strong>Сайт 2:</strong> ' + esc(s2.url2 || "—") + '</div>';
    html += '<div class="summary-field"><strong>Вывод:</strong> ' + esc(s2.why_split || "—") + '</div>';
    html += '</div>';

    html += '<div class="summary-section"><h4>Шаг 3: Аудит</h4>';
    var answered = s3.checklist.filter(function (c) { return c.answer; }).length;
    html += '<div class="summary-field"><strong>Чек-лист:</strong> ' + answered + ' / ' + s3.checklist.length + ' отвечено</div>';
    html += '<div class="summary-field"><strong>Убрать:</strong> ' + esc(s3.remove || "—") + '</div>';
    html += '<div class="summary-field"><strong>Добавить:</strong> ' + esc(s3.add || "—") + '</div>';
    html += '<div class="summary-field"><strong>Изменить:</strong> ' + esc(s3.change || "—") + '</div>';
    html += '</div>';

    document.getElementById("summary-content").innerHTML = html;
    showScreen("screen-summary");
}

function esc(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// --- Navigation ---

async function submitStep(step, answers) {
    try {
        return await api("POST", "/api/submit/" + step, answers);
    } catch (e) {
        tg.showAlert("Ошибка сохранения: " + e.message);
        return null;
    }
}

// Step 1a -> 1b
document.getElementById("btn-next-1a").addEventListener("click", function () {
    var select = document.getElementById("site-select");
    var site = select.value === "__custom__" ? document.getElementById("custom-url").value.trim() : select.value;
    if (!site) return tg.showAlert("Выберите сайт");
    if (!getSelectedPlatform()) return tg.showAlert("Выберите версию: WEB или Мобильный WEB");
    updateReminders();
    showScreen("screen-step1b");
});

// Step 1b -> 1c
document.getElementById("btn-back-1b").addEventListener("click", function () { showScreen("screen-step1a"); });
document.getElementById("btn-next-1b").addEventListener("click", function () {
    var t = document.getElementById("s1-task").value.trim();
    var a = document.getElementById("s1-action").value.trim();
    var i = document.getElementById("s1-interface").value.trim();
    var m = document.getElementById("s1-metric").value.trim();
    if (!t) return tg.showAlert("Заполните поле Задача");
    if (!a) return tg.showAlert("Заполните поле Действие");
    if (!i) return tg.showAlert("Заполните поле Интерфейс");
    if (!m) return tg.showAlert("Заполните поле Метрика");
    showScreen("screen-step1c");
});

// Step 1c -> Step 2
document.getElementById("btn-back-1c").addEventListener("click", function () { showScreen("screen-step1b"); });
document.getElementById("btn-next-1c").addEventListener("click", async function () {
    var answers = collectStep1();
    if (!answers.q1_cta) return tg.showAlert("Заполните вопрос про CTA");
    if (!answers.q2_social_proof) return tg.showAlert("Заполните вопрос про социальное доказательство");
    if (!answers.q3_clicks) return tg.showAlert("Укажите количество кликов");
    if (!answers.q4_additional) return tg.showAlert("Заполните вопрос про доп. задачи");
    var result = await submitStep(1, answers);
    if (result) showScreen("screen-step2");
});

// Step 2 -> Step 3
document.getElementById("btn-back-2").addEventListener("click", function () { showScreen("screen-step1c"); });
document.getElementById("btn-next-2").addEventListener("click", async function () {
    var answers = collectStep2();
    if (!answers.url1 || !answers.url2) return tg.showAlert("Введите оба URL");
    if (!answers.site1.task) return tg.showAlert("Заполните задачу для Сайта 1");
    if (!answers.site2.task) return tg.showAlert("Заполните задачу для Сайта 2");
    if (!answers.why_split) return tg.showAlert("Заполните вывод о различиях");
    var result = await submitStep(2, answers);
    if (result) {
        updateReminders();
        showScreen("screen-step3");
    }
});

// Step 3 -> Summary
document.getElementById("btn-back-3").addEventListener("click", function () { showScreen("screen-step2"); });
document.getElementById("btn-submit").addEventListener("click", function () {
    var answers = collectStep3();
    var unanswered = answers.checklist.filter(function (c) { return c.answer === null; });
    if (unanswered.length > 0) return tg.showAlert("Ответьте на все пункты чек-листа");
    if (!answers.remove) return tg.showAlert("Заполните рекомендацию Что убрать");
    if (!answers.add) return tg.showAlert("Заполните рекомендацию Что добавить");
    if (!answers.change) return tg.showAlert("Заполните рекомендацию Что изменить");
    showSummary();
});

// Summary -> submit
document.getElementById("btn-back-summary").addEventListener("click", function () { showScreen("screen-step3"); });
document.getElementById("btn-confirm-submit").addEventListener("click", async function () {
    var answers = collectStep3();
    var result = await submitStep(3, answers);
    if (result) {
        // no bot notification in web version
        showScreen("screen-done");
    }
});

// --- Review ---

document.getElementById("btn-review").addEventListener("click", async function () {
    try {
        var data = await api("GET", "/api/student");
        var container = document.getElementById("review-content");
        container.innerHTML = "";
        var stepTitles = { 1: "Анализ сайта", 2: "Сравнительный анализ", 3: "Аудит и рекомендации" };
        for (var idx = 0; idx < data.progress.submissions.length; idx++) {
            var sub = data.progress.submissions[idx];
            var answers = JSON.parse(sub.answers);
            var div = document.createElement("div");
            div.style.marginBottom = "16px";
            var html = '<h3>Шаг ' + sub.step + ': ' + stepTitles[sub.step] + '</h3>';
            Object.entries(answers).forEach(function (pair) {
                var k = pair[0], v = pair[1];
                if (v && typeof v === "string") {
                    html += '<div class="hint" style="margin:4px 0"><strong>' + k + ':</strong> ' + esc(v) + '</div>';
                } else if (Array.isArray(v)) {
                    v.forEach(function (item) {
                        if (item.question) {
                            var icon = item.answer === "yes" ? "+" : item.answer === "no" ? "-" : "?";
                            html += '<div class="hint" style="margin:4px 0"><strong>[' + icon + '] ' + esc(item.question) + ':</strong> ' + esc(item.comment || "") + '</div>';
                        }
                    });
                } else if (v && typeof v === "object") {
                    Object.entries(v).forEach(function (p) {
                        if (p[1]) html += '<div class="hint" style="margin:4px 0"><strong>' + k + '.' + p[0] + ':</strong> ' + esc(p[1]) + '</div>';
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

document.getElementById("btn-back-review").addEventListener("click", function () { showScreen("screen-done"); });

document.getElementById("btn-reset").addEventListener("click", function () {
    tg.showConfirm("Обнулить все ответы и пройти заново?", async function (ok) {
        if (!ok) return;
        try {
            await api("POST", "/api/reset", {});
            window.location.reload();
        } catch (e) {
            tg.showAlert("Ошибка: " + e.message);
        }
    });
});

// --- Auto-save on blur ---

var saveTimer = null;
function setupAutoSave() {
    document.querySelectorAll("textarea, input").forEach(function (el) {
        el.addEventListener("blur", function () {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(async function () {
                var screen = document.querySelector(".screen:not(.hidden)");
                if (!screen) return;
                var id = screen.id;
                if (id.startsWith("screen-step1")) await submitStep(1, collectStep1()).catch(function () {});
                else if (id === "screen-step2") await submitStep(2, collectStep2()).catch(function () {});
                else if (id === "screen-step3") await submitStep(3, collectStep3()).catch(function () {});
            }, 500);
        });
    });
}

// --- Init ---

initRegistration();
loadStudent().then(function () { setupAutoSave(); });
