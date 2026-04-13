var tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

var API_BASE = "/site-practice";
var AUTH_HEADER = { Authorization: "tma " + tg.initData };

var questions = [];
var currentIndex = 0;
var answers = {};

function getResultMessage(score) {
    if (score >= 9) return "Отличный результат! Вы прекрасно разбираетесь в метриках";
    if (score >= 7) return "Хороший результат! Есть что подтянуть";
    if (score >= 5) return "Неплохо, но стоит повторить материал";
    return "Нужно подучить метрики — попробуйте ещё раз";
}

function showResult(score) {
    document.getElementById("result-score").textContent = score;
    var msgEl = document.getElementById("result-message");
    if (msgEl) msgEl.textContent = getResultMessage(score);
    showScreen("result");
}

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
    var resp = await fetch(API_BASE + path, opts);
    return resp;
}

async function init() {
    var resp = await api("GET", "/api/quiz/result");
    if (resp.status === 404) {
        showScreen("register");
        return;
    }
    var result = await resp.json();
    if (result.submitted) {
        showResult(result.score);
        return;
    }
    var qResp = await api("GET", "/api/quiz/questions");
    questions = await qResp.json();
    showScreen("start");
}

function renderQuestion(animate) {
    var body = document.getElementById("question-body");
    var q = questions[currentIndex];

    function doRender() {
        document.getElementById("quiz-progress").textContent = "Вопрос " + (currentIndex + 1) + " из " + questions.length;
        document.getElementById("progress-fill").style.width = ((currentIndex + 1) / questions.length * 100) + "%";
        document.getElementById("quiz-question-text").textContent = q.text;

        var optionsHtml = q.options.map(function (opt) {
            return '<div class="option-card" data-value="' + escAttr(opt) + '">' + esc(opt) + '</div>';
        }).join("");
        document.getElementById("quiz-options").innerHTML = optionsHtml;
        document.getElementById("btn-next").disabled = true;

        document.querySelectorAll(".option-card").forEach(function (card) {
            card.addEventListener("click", function () {
                document.querySelectorAll(".option-card").forEach(function (c) {
                    c.classList.remove("selected");
                });
                card.classList.add("selected");
                answers[q.id] = card.dataset.value;
                document.getElementById("btn-next").disabled = false;
            });
        });

        if (animate) {
            body.classList.add("slide-in");
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    body.classList.remove("slide-in");
                });
            });
        }
    }

    if (animate) {
        body.classList.add("slide-out");
        setTimeout(function () {
            body.classList.remove("slide-out");
            doRender();
        }, 250);
    } else {
        doRender();
    }
}

function showAnalyzingThenResult(score) {
    showScreen("analyzing");

    // Mark steps as "done" progressively
    var steps = document.querySelectorAll("#screen-analyzing .analyzing-step");
    setTimeout(function () {
        if (steps[1]) {
            steps[1].classList.add("done");
            steps[1].querySelector(".step-icon").textContent = "✓";
        }
    }, 900);
    setTimeout(function () {
        if (steps[2]) {
            steps[2].classList.add("done");
            steps[2].querySelector(".step-icon").textContent = "✓";
        }
    }, 1600);

    setTimeout(function () {
        showResult(score);
    }, 2200);
}

function esc(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

function escAttr(str) {
    return (str || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Registration
var selectedGroup = "";

document.querySelectorAll("#quiz-group-select .group-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        document.querySelectorAll("#quiz-group-select .group-btn").forEach(function (b) {
            b.classList.remove("selected");
        });
        btn.classList.add("selected");
        selectedGroup = btn.dataset.val;
    });
});

document.getElementById("btn-register").addEventListener("click", async function () {
    var name = document.getElementById("quiz-reg-name").value.trim();
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
    var qResp = await api("GET", "/api/quiz/questions");
    questions = await qResp.json();
    showScreen("start");
});

// Start button
document.getElementById("btn-start").addEventListener("click", function () {
    currentIndex = 0;
    answers = {};
    showScreen("question");
    renderQuestion(false);
});

// Next button
document.getElementById("btn-next").addEventListener("click", async function () {
    currentIndex++;
    if (currentIndex < questions.length) {
        renderQuestion(true);
    } else {
        // Submit
        document.getElementById("btn-next").disabled = true;

        // Show analyzing screen immediately
        showScreen("analyzing");

        var resp = await api("POST", "/api/quiz/submit", { answers: answers });
        var result;
        if (resp.status === 409) {
            var fallback = await api("GET", "/api/quiz/result");
            result = await fallback.json();
        } else {
            result = await resp.json();
        }

        // Animate analyzing steps, then show result
        var steps = document.querySelectorAll("#screen-analyzing .analyzing-step");
        setTimeout(function () {
            if (steps[1]) {
                steps[1].classList.add("done");
                steps[1].querySelector(".step-icon").textContent = "\u2713";
            }
        }, 700);
        setTimeout(function () {
            if (steps[2]) {
                steps[2].classList.add("done");
                steps[2].querySelector(".step-icon").textContent = "\u2713";
            }
        }, 1400);
        setTimeout(function () {
            showResult(result.score);
        }, 2000);
    }
});

init();
