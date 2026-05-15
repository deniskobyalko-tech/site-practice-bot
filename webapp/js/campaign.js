// --- Campaign Diagnosis Practice (Practice #2) ---

var API_BASE = "/site-practice";
var currentStep = 1;
var dashboard = null;
var progress = null;

function getAuthHeaders() {
    var headers = { "Content-Type": "application/json" };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        headers["Authorization"] = "tma " + window.Telegram.WebApp.initData;
    } else {
        var token = localStorage.getItem("webToken");
        if (token) headers["Authorization"] = "Bearer " + token;
    }
    return headers;
}

async function apiGet(path) {
    var res = await fetch(API_BASE + path, { headers: getAuthHeaders() });
    if (!res.ok) {
        var err = await res.text();
        throw new Error("HTTP " + res.status + ": " + err);
    }
    return res.json();
}

async function apiPost(path, body) {
    var res = await fetch(API_BASE + path, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        var err = await res.text();
        throw new Error("HTTP " + res.status + ": " + err);
    }
    return res.json();
}

// --- Rendering ---

function formatMetricValue(meta, value) {
    if (meta.fmt === "float") {
        var txt = value.toFixed(1);
    } else {
        var txt = Math.round(value).toLocaleString("ru");
    }
    if (meta.unit === "₽") return "₽" + txt;
    if (meta.unit === "%") return txt + "%";
    return txt;
}

function renderDashboard() {
    var grid = document.getElementById("dashboard-grid");
    grid.innerHTML = "";
    dashboard.metrics_meta.forEach(function (meta) {
        var value = dashboard.values[meta.id];
        var card = document.createElement("div");
        card.className = "metric-card";
        card.innerHTML =
            '<div class="metric-name">' + meta.name + "</div>" +
            '<div class="metric-value">' + formatMetricValue(meta, value) + "</div>";
        grid.appendChild(card);
    });
    document.getElementById("scenario-title-1").textContent =
        "Сценарий: " + dashboard.title;
    document.getElementById("all-done-scenario").textContent =
        "Сценарий: " + dashboard.title;
}

// --- Wizard navigation ---

function goToStep(n) {
    currentStep = n;
    for (var i = 1; i <= 3; i++) {
        var stepEl = document.getElementById("step-" + i);
        var dotEl = document.getElementById("dot-" + i);
        stepEl.classList.toggle("active", i === n);
        dotEl.classList.toggle("active", i === n);
    }
    // Mark completed steps
    if (progress && progress.completed_steps) {
        progress.completed_steps.forEach(function (s) {
            document.getElementById("dot-" + s).classList.add("done");
        });
    }
    window.scrollTo(0, 0);
}

function getStepAnswers(step) {
    var answers = {};
    var root = document.getElementById("step-" + step);
    root.querySelectorAll("textarea, input[type=text]").forEach(function (el) {
        answers[el.name] = el.value.trim();
    });
    root.querySelectorAll("input[type=radio]:checked").forEach(function (el) {
        answers[el.name] = el.value;
    });
    return answers;
}

function validateStep(step, answers) {
    var required = {
        1: ["q1_channel", "q2_funnel", "q3_symptoms"],
        2: ["q4_root_main", "q5_root_secondary", "q6_evidence"],
        3: ["q7_actions", "q8_hypothesis", "q9_forecast"],
    };
    for (var i = 0; i < required[step].length; i++) {
        var k = required[step][i];
        if (!answers[k] || !answers[k].trim()) {
            return "Заполни все поля на шаге " + step + " (не хватает: " + k + ")";
        }
    }
    return null;
}

async function saveStep(step) {
    var errEl = document.getElementById("save-error");
    errEl.style.display = "none";
    var answers = getStepAnswers(step);
    var err = validateStep(step, answers);
    if (err) {
        errEl.textContent = err;
        errEl.style.display = "block";
        return;
    }
    try {
        await apiPost("/api/campaign/submit/" + step, { answers: answers });
        // Refresh progress
        progress = await apiGet("/api/campaign/progress");
        if (progress.completed_steps.length === 3) {
            document.getElementById("all-done").style.display = "block";
        }
        if (step < 3) {
            goToStep(step + 1);
        } else {
            goToStep(3);
            document.getElementById("all-done").style.display = "block";
        }
    } catch (e) {
        errEl.textContent = "Ошибка сохранения: " + e.message;
        errEl.style.display = "block";
    }
}

function prefillAnswers() {
    if (!progress || !progress.submissions) return;
    progress.submissions.forEach(function (sub) {
        try {
            var ans = typeof sub.answers === "string" ? JSON.parse(sub.answers) : sub.answers;
            var root = document.getElementById("step-" + sub.step);
            if (!root) return;
            Object.keys(ans).forEach(function (k) {
                var v = ans[k];
                var ta = root.querySelector("[name='" + k + "']");
                if (ta && ta.tagName === "TEXTAREA") {
                    ta.value = v;
                }
                var radio = root.querySelector("input[name='" + k + "'][value='" + v + "']");
                if (radio) radio.checked = true;
            });
        } catch (e) {}
    });
}

// --- Init ---

async function init() {
    try {
        dashboard = await apiGet("/api/campaign/dashboard");
        progress = await apiGet("/api/campaign/progress");
        renderDashboard();
        prefillAnswers();
        document.getElementById("wizard-root").style.display = "block";
        if (progress.completed_steps.length === 3) {
            document.getElementById("all-done").style.display = "block";
            goToStep(1);
        } else {
            // Jump to first incomplete step
            var firstIncomplete = 1;
            for (var i = 1; i <= 3; i++) {
                if (progress.completed_steps.indexOf(i) === -1) {
                    firstIncomplete = i;
                    break;
                }
            }
            goToStep(firstIncomplete);
        }
    } catch (e) {
        if (String(e.message).indexOf("404") !== -1) {
            document.getElementById("not-registered").style.display = "block";
        } else {
            var errEl = document.getElementById("save-error");
            errEl.textContent = "Ошибка загрузки: " + e.message;
            errEl.style.display = "block";
            document.getElementById("wizard-root").style.display = "block";
        }
    }
}

init();
