var tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

var API_BASE = "/site-practice";
var AUTH_HEADER = { Authorization: "tma " + tg.initData };

var state = {
    topic: null,           // 'content' | 'ux' | 'metrics' | null
    task: null,            // full task object from /api/express/task/{topic}
    stepIndex: 0,          // 0..2
    answersByStep: {},     // { 1: { v1: '...', v2: '...' }, ... }
    completedSteps: [],    // [1, 2, ...]
};

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
        s.classList.add("hidden");
    });
    document.getElementById("screen-" + id).classList.remove("hidden");
}

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

async function init() {
    var resp = await api("GET", "/api/express/progress");
    if (resp.status === 404) {
        // Not registered yet — show registration form.
        showScreen("register");
        return;
    }
    if (!resp.ok) {
        tg.showAlert("Не удалось загрузить прогресс");
        return;
    }
    var progress = await resp.json();
    state.answersByStep = progress.answers_by_step || {};
    state.completedSteps = progress.completed_steps || [];

    if (progress.status === "submitted") {
        showScreen("done");
        return;
    }

    if (progress.topic) {
        // Resume locked topic on the next unfinished step (or the last one if all touched).
        state.topic = progress.topic;
        await loadTask(progress.topic);
        var nextStep = nextUnfinishedStep();
        state.stepIndex = nextStep;
        renderStep();
        showScreen("step");
        return;
    }

    await renderTopics();
    showScreen("pick");
}

function nextUnfinishedStep() {
    for (var i = 0; i < 3; i++) {
        if (state.completedSteps.indexOf(i + 1) === -1) return i;
    }
    return 2; // all done but somehow not submitted — show last
}

async function renderTopics() {
    var resp = await api("GET", "/api/express/topics");
    if (!resp.ok) {
        tg.showAlert("Не удалось загрузить темы");
        return;
    }
    var topics = await resp.json();
    var html = topics.map(function (t) {
        return '<div class="topic-card" data-id="' + escAttr(t.id) + '">' +
            '<div class="emoji">' + esc(t.emoji) + '</div>' +
            '<div class="body">' +
                '<div class="title">' + esc(t.title) + '</div>' +
                '<div class="short">' + esc(t.short) + '</div>' +
                '<div class="meta">' +
                    '<span>' + esc(t.steps_count) + ' шага</span>' +
                    '<span>' + esc(t.duration) + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join("");
    document.getElementById("topics-list").innerHTML = html;

    document.querySelectorAll(".topic-card").forEach(function (card) {
        card.addEventListener("click", function () {
            var topicId = card.dataset.id;
            chooseTopic(topicId);
        });
    });
}

async function loadTask(topicId) {
    var resp = await api("GET", "/api/express/task/" + encodeURIComponent(topicId));
    if (!resp.ok) {
        tg.showAlert("Не удалось загрузить задание");
        return;
    }
    state.task = await resp.json();
}

async function chooseTopic(topicId) {
    state.topic = topicId;
    state.stepIndex = 0;
    await loadTask(topicId);
    renderStep();
    showScreen("step");
}

function renderStep() {
    var step = state.task.steps[state.stepIndex];
    var total = state.task.steps.length;
    var stepNo = state.stepIndex + 1;

    document.getElementById("step-progress").textContent =
        "Шаг " + stepNo + " из " + total + " · " + state.task.title;
    document.getElementById("step-progress-fill").style.width =
        (stepNo / total * 100) + "%";
    document.getElementById("step-title").textContent = step.title;
    document.getElementById("step-brief").textContent = step.brief;

    var prevAnswers = state.answersByStep[step.id] || {};

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

    var backBtn = document.getElementById("btn-step-back");
    backBtn.disabled = state.stepIndex === 0;
    backBtn.style.opacity = state.stepIndex === 0 ? "0.4" : "1";

    var nextBtn = document.getElementById("btn-step-next");
    nextBtn.textContent = state.stepIndex === total - 1
        ? "Сдать работу"
        : "Сохранить и далее";

    window.scrollTo(0, 0);
}

function collectAnswers() {
    var step = state.task.steps[state.stepIndex];
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
    var step = state.task.steps[state.stepIndex];
    var collected = collectAnswers();
    if (!collected.hasAny) {
        tg.showAlert("Заполните хотя бы одно поле перед сохранением");
        return false;
    }
    var resp = await api("POST", "/api/express/step/" + step.id, {
        topic: state.topic,
        answers: collected.answers,
    });
    if (resp.status === 409) {
        var body = await resp.json().catch(function () { return {}; });
        if ((body.detail || "").indexOf("submitted") !== -1) {
            showScreen("done");
            return false;
        }
        tg.showAlert("Тема уже закреплена за вами — её не сменить.");
        return false;
    }
    if (!resp.ok) {
        tg.showAlert("Не удалось сохранить — попробуйте ещё раз");
        return false;
    }
    var data = await resp.json();
    state.completedSteps = data.progress.completed_steps;
    state.answersByStep[step.id] = collected.answers;
    return data.progress.status === "submitted";
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
        if (state.stepIndex < state.task.steps.length - 1) {
            state.stepIndex++;
            renderStep();
        } else {
            // All steps saved but somehow status not submitted — should not happen normally.
            // Re-fetch progress to be safe.
            await init();
        }
    } finally {
        btn.disabled = false;
    }
});

document.getElementById("btn-step-back").addEventListener("click", function () {
    if (state.stepIndex === 0) return;
    // Preserve current draft in memory (we don't save unsaved drafts going back).
    var step = state.task.steps[state.stepIndex];
    var collected = collectAnswers();
    if (collected.hasAny) {
        state.answersByStep[step.id] = Object.assign(
            {},
            state.answersByStep[step.id] || {},
            collected.answers
        );
    }
    state.stepIndex--;
    renderStep();
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
    await renderTopics();
    showScreen("pick");
});

init();
