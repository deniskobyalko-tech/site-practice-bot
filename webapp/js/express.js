var tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

var API_BASE = "/site-practice";
var AUTH_HEADER = { Authorization: "tma " + tg.initData };

// Fixed order — students walk topics sequentially.
var TOPIC_ORDER = ["content", "ux", "metrics"];
var STEPS_PER_TOPIC = 3;
var TOTAL_STEPS = TOPIC_ORDER.length * STEPS_PER_TOPIC;

var state = {
    tasks: {},                  // { content: {...}, ux: {...}, metrics: {...} }
    topicsSummary: [],          // for intro screen
    topicIndex: 0,              // 0..2
    stepIndex: 0,               // 0..2 (within current topic)
    answersByTopic: {},         // { content: { 1: {...}, 2: {...} }, ux: {...}, ... }
    completedByTopic: {},       // { content: [1,2], ux: [1], ... }
    totalCompleted: 0,
};

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
        s.classList.add("hidden");
    });
    document.getElementById("screen-" + id).classList.remove("hidden");
    // Native Telegram BackButton is only meaningful on step screens.
    if (id === "step") {
        updateBackButton();
    } else {
        tg.BackButton.hide();
    }
}

function updateBackButton() {
    var isFirstOverall = state.topicIndex === 0 && state.stepIndex === 0;
    if (isFirstOverall) tg.BackButton.hide();
    else tg.BackButton.show();
    var topBtn = document.getElementById("btn-step-back-top");
    if (topBtn) topBtn.classList.toggle("hidden", isFirstOverall);
}

function goBackOneStep() {
    preserveCurrentDraftInState();
    if (rewindPosition()) {
        renderStep();
        updateBackButton();
    }
}

tg.BackButton.onClick(goBackOneStep);
document.getElementById("btn-step-back-top").addEventListener("click", goBackOneStep);

async function api(method, path, body) {
    var opts = { method: method, headers: Object.assign({}, AUTH_HEADER) };
    if (body) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }
    return fetch(API_BASE + path, opts);
}

function esc(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

function escAttr(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Render brief text with clickable links. esc() the text first to keep XSS safe,
// then linkify http(s):// URLs.
function briefHtml(text) {
    var escaped = esc(text);
    return escaped.replace(/https?:\/\/[^\s<]+/g, function (url) {
        return '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
}

function topicAt(idx) { return TOPIC_ORDER[idx]; }
function currentTopic() { return topicAt(state.topicIndex); }
function currentTask() { return state.tasks[currentTopic()]; }
function currentStep() {
    var task = currentTask();
    if (!task) return null;
    return task.steps[state.stepIndex];
}
function overallStepNumber() {
    return state.topicIndex * STEPS_PER_TOPIC + state.stepIndex + 1;
}

async function loadAllTasks() {
    for (var i = 0; i < TOPIC_ORDER.length; i++) {
        var t = TOPIC_ORDER[i];
        if (state.tasks[t]) continue;
        var resp = await api("GET", "/api/express/task/" + t);
        if (!resp.ok) {
            tg.showAlert("Не удалось загрузить задания");
            throw new Error("task load failed");
        }
        state.tasks[t] = await resp.json();
    }
}

async function loadTopicsSummary() {
    var resp = await api("GET", "/api/express/topics");
    if (!resp.ok) return;
    state.topicsSummary = await resp.json();
}

function findNextUnfinishedPosition() {
    // Walk topics × steps in fixed order, return first (topicIdx, stepIdx) not yet done.
    for (var ti = 0; ti < TOPIC_ORDER.length; ti++) {
        var topicId = TOPIC_ORDER[ti];
        var done = state.completedByTopic[topicId] || [];
        for (var si = 1; si <= STEPS_PER_TOPIC; si++) {
            if (done.indexOf(si) === -1) {
                return { topicIndex: ti, stepIndex: si - 1 };
            }
        }
    }
    return { topicIndex: TOPIC_ORDER.length - 1, stepIndex: STEPS_PER_TOPIC - 1 };
}

async function init() {
    var resp = await api("GET", "/api/express/progress");
    if (resp.status === 404) {
        showScreen("register");
        return;
    }
    if (!resp.ok) {
        tg.showAlert("Не удалось загрузить прогресс");
        return;
    }
    var progress = await resp.json();
    state.answersByTopic = progress.answers_by_topic || {};
    state.completedByTopic = progress.completed_by_topic || {};
    state.totalCompleted = progress.total_completed || 0;

    if (progress.status === "submitted") {
        showScreen("done");
        return;
    }

    await loadAllTasks();

    if (progress.status === "not_started") {
        await loadTopicsSummary();
        renderIntro();
        showScreen("intro");
        return;
    }

    var pos = findNextUnfinishedPosition();
    state.topicIndex = pos.topicIndex;
    state.stepIndex = pos.stepIndex;
    renderStep();
    showScreen("step");
}

function renderIntro() {
    var list = document.getElementById("intro-topics-list");
    var html = state.topicsSummary.map(function (t, i) {
        return '<li><strong>' + esc(t.emoji) + ' ' + esc(t.title) + '</strong> — ' + esc(t.short) + '</li>';
    }).join("");
    if (!html) {
        html = TOPIC_ORDER.map(function (id) {
            var task = state.tasks[id];
            if (!task) return '';
            return '<li><strong>' + esc(task.emoji || "") + ' ' + esc(task.title) + '</strong></li>';
        }).join("");
    }
    list.innerHTML = html;
}

function renderStep() {
    var task = currentTask();
    var step = currentStep();
    if (!task || !step) return;

    document.getElementById("step-progress-label").textContent =
        "Шаг " + overallStepNumber() + " из " + TOTAL_STEPS;
    document.getElementById("topic-pill").innerHTML =
        esc(task.emoji || "") + " " + esc(task.title) +
        " · " + (state.stepIndex + 1) + "/" + STEPS_PER_TOPIC;
    document.getElementById("step-progress-fill").style.width =
        (overallStepNumber() / TOTAL_STEPS * 100) + "%";
    document.getElementById("step-title").textContent = step.title;
    document.getElementById("step-brief").innerHTML = briefHtml(step.brief);

    var topicAnswers = state.answersByTopic[task.id] || {};
    var prevAnswers = topicAnswers[step.id] || topicAnswers[String(step.id)] || {};

    var fieldsHtml = step.fields.map(function (f) {
        var existing = prevAnswers[f.id] || "";
        var savedPill = existing
            ? '<span class="saved-pill">сохранено</span>'
            : '';
        return '<div class="form-group">' +
            '<label>' + esc(f.label) + savedPill + '</label>' +
            '<textarea data-field-id="' + escAttr(f.id) + '" ' +
                'rows="' + (f.rows || 5) + '" ' +
                'placeholder="' + escAttr(f.placeholder || "") + '">' +
                esc(existing) +
            '</textarea>' +
        '</div>';
    }).join("");
    document.getElementById("step-fields").innerHTML = fieldsHtml;

    updateBackButton();

    var nextBtn = document.getElementById("btn-step-next");
    var isLastOverall = state.topicIndex === TOPIC_ORDER.length - 1
        && state.stepIndex === STEPS_PER_TOPIC - 1;
    nextBtn.textContent = isLastOverall ? "Сдать работу" : "Сохранить и далее";

    window.scrollTo(0, 0);
}

function collectAnswers() {
    var step = currentStep();
    var answers = {};
    var hasAny = false;
    step.fields.forEach(function (f) {
        var el = document.querySelector('textarea[data-field-id="' + f.id + '"]');
        var val = el ? el.value.trim() : "";
        answers[f.id] = val;
        if (val) hasAny = true;
    });
    return { answers: answers, hasAny: hasAny };
}

async function saveCurrentStep() {
    var topic = currentTopic();
    var step = currentStep();
    var collected = collectAnswers();
    if (!collected.hasAny) {
        tg.showAlert("Заполните хотя бы одно поле перед сохранением");
        return false;
    }
    var resp = await api("POST", "/api/express/step/" + step.id, {
        topic: topic,
        answers: collected.answers,
    });
    if (resp.status === 409) {
        showScreen("done");
        return false;
    }
    if (!resp.ok) {
        tg.showAlert("Не удалось сохранить — попробуйте ещё раз");
        return false;
    }
    var data = await resp.json();
    state.completedByTopic = data.progress.completed_by_topic || {};
    state.totalCompleted = data.progress.total_completed || 0;
    if (!state.answersByTopic[topic]) state.answersByTopic[topic] = {};
    state.answersByTopic[topic][step.id] = collected.answers;
    return data.progress.status === "submitted";
}

function preserveCurrentDraftInState() {
    var topic = currentTopic();
    var step = currentStep();
    var collected = collectAnswers();
    if (!collected.hasAny) return;
    if (!state.answersByTopic[topic]) state.answersByTopic[topic] = {};
    state.answersByTopic[topic][step.id] = Object.assign(
        {},
        state.answersByTopic[topic][step.id] || {},
        collected.answers
    );
}

function advancePosition() {
    if (state.stepIndex < STEPS_PER_TOPIC - 1) {
        state.stepIndex++;
        return true;
    }
    if (state.topicIndex < TOPIC_ORDER.length - 1) {
        state.topicIndex++;
        state.stepIndex = 0;
        return true;
    }
    return false; // already last
}

function rewindPosition() {
    if (state.stepIndex > 0) {
        state.stepIndex--;
        return true;
    }
    if (state.topicIndex > 0) {
        state.topicIndex--;
        state.stepIndex = STEPS_PER_TOPIC - 1;
        return true;
    }
    return false;
}

document.getElementById("btn-step-next").addEventListener("click", async function () {
    var btn = this;
    btn.disabled = true;
    try {
        var submitted = await saveCurrentStep();
        if (submitted) {
            showScreen("done");
            return;
        }
        var moved = advancePosition();
        if (!moved) {
            // Saved last cell but progress hasn't flipped to 'submitted' — refetch to be safe.
            await init();
            return;
        }
        renderStep();
    } finally {
        btn.disabled = false;
    }
});


document.getElementById("btn-intro-start").addEventListener("click", function () {
    state.topicIndex = 0;
    state.stepIndex = 0;
    renderStep();
    showScreen("step");
});

// Registration
var selectedGroup = "";
document.querySelectorAll("#express-group-select .group-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        document.querySelectorAll("#express-group-select .group-btn").forEach(function (b) {
            b.classList.remove("selected");
        });
        btn.classList.add("selected");
        selectedGroup = btn.dataset.val;
    });
});

document.getElementById("btn-register").addEventListener("click", async function () {
    var name = document.getElementById("express-reg-name").value.trim();
    if (!selectedGroup) {
        tg.showAlert("Выберите группу");
        return;
    }
    if (!name) {
        tg.showAlert("Введите ФИО");
        return;
    }
    var resp = await api("POST", "/api/register", { name: name, group: selectedGroup });
    if (!resp.ok) {
        tg.showAlert("Ошибка регистрации");
        return;
    }
    await loadAllTasks();
    await loadTopicsSummary();
    renderIntro();
    showScreen("intro");
});

// Intercept clicks on brief links so they open in the external browser
// rather than getting captured by the Telegram webview.
document.getElementById("step-brief").addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    if (tg.openLink) tg.openLink(a.href);
    else window.open(a.href, "_blank");
});

init();
