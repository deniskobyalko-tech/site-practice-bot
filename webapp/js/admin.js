const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = "/site-practice";
const AUTH_HEADER = { Authorization: "tma " + tg.initData };

const STATUS_LABELS = {
    registered: "Регистрация",
    step_1: "Шаг 1",
    step_2: "Шаг 2",
    step_3: "Шаг 3",
    submitted: "Сдано",
};

async function api(method, path) {
    const resp = await fetch(API_BASE + path, {
        method,
        headers: AUTH_HEADER,
    });
    if (!resp.ok) throw new Error(resp.statusText);
    return resp.json();
}

async function loadStudents() {
    const group = document.getElementById("group-filter").value;
    const query = group ? "?group=" + encodeURIComponent(group) : "";

    try {
        const students = await api("GET", "/api/admin/students" + query);
        const list = document.getElementById("students-list");
        const empty = document.getElementById("empty-state");
        const count = document.getElementById("count");

        count.textContent = students.length + " чел.";

        if (students.length === 0) {
            list.innerHTML = "";
            empty.classList.remove("hidden");
            return;
        }

        empty.classList.add("hidden");
        list.innerHTML = students
            .map(function (s) {
                return '<div class="student-row" data-id="' + s.id + '">' +
                    '<div class="student-meta">' +
                        '<div>' +
                            '<div class="student-name">' + esc(s.name) + '</div>' +
                            '<div class="student-group">' + esc(s.group_name) + '</div>' +
                        '</div>' +
                        '<span class="status-badge status-' + s.status + '">' + (STATUS_LABELS[s.status] || s.status) + '</span>' +
                    '</div>' +
                    '<div class="student-detail" id="detail-' + s.id + '"></div>' +
                '</div>';
            })
            .join("");

        list.querySelectorAll(".student-row").forEach(function (row) {
            row.addEventListener("click", function () {
                toggleDetail(row.dataset.id);
            });
        });
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

async function toggleDetail(studentId) {
    const detail = document.getElementById("detail-" + studentId);
    if (detail.classList.contains("open")) {
        detail.classList.remove("open");
        return;
    }

    try {
        const subs = await api("GET", "/api/admin/student/" + studentId);
        var html = "";
        if (subs.length === 0) {
            html = '<div class="detail-answer">Нет ответов</div>';
        } else {
            html = subs.map(function (s) {
                return renderStep(s.step, s.answers);
            }).join("");
        }
        html += '<button class="btn-reset-student" data-sid="' + studentId + '" style="margin-top:8px;padding:8px 16px;background:transparent;border:1px solid #f44336;color:#f44336;border-radius:8px;font-size:13px;cursor:pointer">Сбросить прохождение</button>';
        detail.innerHTML = html;
        detail.querySelector(".btn-reset-student").addEventListener("click", function (e) {
            e.stopPropagation();
            resetStudent(studentId);
        });
        detail.classList.add("open");
    } catch (e) {
        detail.innerHTML = '<div class="detail-answer">Ошибка загрузки</div>';
        detail.classList.add("open");
    }
}

function renderStep(step, answers) {
    var titles = { 1: "Анализ сайта", 2: "Сравнительный анализ", 3: "Аудит и рекомендации" };
    var html = '<div class="detail-step"><h4>Шаг ' + step + ': ' + titles[step] + '</h4>';

    if (step === 1) {
        html += field("Сайт", answers.site);
        html += field("Задача", answers.task);
        html += field("Действие", answers.action);
        html += field("Интерфейс", answers.interface);
        html += field("Метрика", answers.metric);
        html += field("CTA", answers.q1_cta);
        html += field("Соц. доказательство", answers.q2_social_proof);
        html += field("Кликов", (answers.q3_clicks || "—") + " — " + (answers.q3_comment || ""));
        html += field("Доп. задачи", answers.q4_additional);
    } else if (step === 2) {
        html += field("URL 1", answers.url1);
        html += field("URL 2", answers.url2);
        if (answers.site1) {
            html += '<div style="margin:4px 0;color:var(--link);font-size:13px">Сайт 1:</div>';
            Object.entries(answers.site1).forEach(function (entry) {
                html += field(entry[0], entry[1]);
            });
        }
        if (answers.site2) {
            html += '<div style="margin:4px 0;color:var(--link);font-size:13px">Сайт 2:</div>';
            Object.entries(answers.site2).forEach(function (entry) {
                html += field(entry[0], entry[1]);
            });
        }
        html += field("Почему разделены", answers.why_split);
    } else if (step === 3) {
        if (answers.checklist) {
            answers.checklist.forEach(function (c) {
                var icon = c.answer === "yes" ? "+" : c.answer === "no" ? "-" : "?";
                html += field("[" + icon + "] " + c.question, c.comment);
            });
        }
        html += field("Убрать", answers.remove);
        html += field("Добавить", answers.add);
        html += field("Изменить", answers.change);
    }

    html += "</div>";
    return html;
}

function field(label, value) {
    if (!value) return "";
    return '<div class="detail-answer"><strong>' + esc(label) + ':</strong> ' + esc(String(value)) + '</div>';
}

function esc(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

// Reset student
async function resetStudent(studentId) {
    if (!confirm("Сбросить прохождение этого студента? Он сможет пройти заново.")) return;
    try {
        await fetch(API_BASE + "/api/admin/reset/" + studentId, {
            method: "POST",
            headers: AUTH_HEADER,
        });
        loadStudents();
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

// CSV export
document.getElementById("btn-export").addEventListener("click", async function () {
    var group = document.getElementById("group-filter").value;
    var query = group ? "?group=" + encodeURIComponent(group) : "";
    try {
        var resp = await fetch(API_BASE + "/api/admin/export" + query, {
            headers: AUTH_HEADER,
        });
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "practice_results.csv";
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        tg.showAlert("Ошибка экспорта: " + e.message);
    }
});

// Filter
document.getElementById("group-filter").addEventListener("change", loadStudents);

// Init
loadStudents();

// --- Quiz Tab ---

var activeTab = "practice";

document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        activeTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(function (b) {
            b.style.borderBottomColor = "transparent";
            b.style.color = "var(--hint)";
            b.classList.remove("active");
        });
        btn.style.borderBottomColor = "var(--btn-bg)";
        btn.style.color = "var(--text)";
        btn.classList.add("active");

        document.getElementById("tab-practice").classList.toggle("hidden", activeTab !== "practice");
        document.getElementById("tab-express").classList.toggle("hidden", activeTab !== "express");
        document.getElementById("tab-exam").classList.toggle("hidden", activeTab !== "exam");
        document.getElementById("tab-quiz").classList.toggle("hidden", activeTab !== "quiz");

        if (activeTab === "quiz") loadQuizStudents();
        if (activeTab === "express") loadExpressStudents();
        if (activeTab === "exam") loadExamStudents();
    });
});

async function loadQuizStudents() {
    var group = document.getElementById("quiz-group-filter").value;
    var query = group ? "?group=" + encodeURIComponent(group) : "";
    try {
        var students = await api("GET", "/api/admin/quiz/students" + query);
        var list = document.getElementById("quiz-students-list");
        var empty = document.getElementById("quiz-empty-state");

        if (students.length === 0) {
            list.innerHTML = "";
            empty.classList.remove("hidden");
            return;
        }

        empty.classList.add("hidden");
        list.innerHTML = students.map(function (s) {
            return '<div class="student-row" data-quiz-sid="' + s.student_id + '">' +
                '<div class="student-meta">' +
                    '<div>' +
                        '<div class="student-name">' + esc(s.name) + '</div>' +
                        '<div class="student-group">' + esc(s.group_name) + '</div>' +
                    '</div>' +
                    '<span class="status-badge status-submitted">' + s.score + '/5</span>' +
                '</div>' +
                '<div class="student-detail" id="quiz-detail-' + s.student_id + '"></div>' +
            '</div>';
        }).join("");

        list.querySelectorAll(".student-row").forEach(function (row) {
            row.addEventListener("click", function () {
                toggleQuizDetail(row.dataset.quizSid);
            });
        });
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

async function toggleQuizDetail(studentId) {
    var detail = document.getElementById("quiz-detail-" + studentId);
    if (detail.classList.contains("open")) {
        detail.classList.remove("open");
        return;
    }
    try {
        var data = await api("GET", "/api/admin/quiz/student/" + studentId);
        var html = '<div class="detail-step"><h4>Результат: ' + data.score + ' из ' + data.total + '</h4>';
        var questions = Object.keys(data.details);
        questions.sort();
        questions.forEach(function (qId, i) {
            var d = data.details[qId];
            var color = d.is_correct ? "#4caf50" : "#f44336";
            html += '<div class="detail-answer" style="margin:6px 0;padding:6px;border-left:3px solid ' + color + ';padding-left:8px">';
            html += '<strong>' + (i + 1) + '. ' + esc(d.text) + '</strong><br>';
            html += '<span style="color:' + color + '">' + esc(d.student_answer || "—") + '</span>';
            if (!d.is_correct) {
                html += ' <span style="color:var(--hint)">→ ' + esc(d.correct_answer) + '</span>';
            }
            html += '</div>';
        });
        html += '</div>';
        html += '<button class="btn-reset-quiz" data-sid="' + studentId + '" style="margin-top:8px;padding:8px 16px;background:transparent;border:1px solid #f44336;color:#f44336;border-radius:8px;font-size:13px;cursor:pointer">Сбросить тест</button>';
        detail.innerHTML = html;
        detail.querySelector(".btn-reset-quiz").addEventListener("click", function (e) {
            e.stopPropagation();
            resetQuiz(studentId);
        });
        detail.classList.add("open");
    } catch (e) {
        detail.innerHTML = '<div class="detail-answer">Ошибка загрузки</div>';
        detail.classList.add("open");
    }
}

async function resetQuiz(studentId) {
    if (!confirm("Сбросить тест этого студента? Он сможет пройти заново.")) return;
    try {
        await fetch(API_BASE + "/api/admin/quiz/reset/" + studentId, {
            method: "POST",
            headers: AUTH_HEADER,
        });
        loadQuizStudents();
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

// Quiz CSV export
document.getElementById("btn-quiz-export").addEventListener("click", async function () {
    var group = document.getElementById("quiz-group-filter").value;
    var query = group ? "?group=" + encodeURIComponent(group) : "";
    try {
        var resp = await fetch(API_BASE + "/api/admin/quiz/export" + query, { headers: AUTH_HEADER });
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "quiz_results.csv";
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        tg.showAlert("Ошибка экспорта: " + e.message);
    }
});

// Quiz filter
document.getElementById("quiz-group-filter").addEventListener("change", loadQuizStudents);

// --- Express Tab ("Практика на пару") ---

async function loadExpressStudents() {
    var group = document.getElementById("express-group-filter").value;
    var query = group ? "?group=" + encodeURIComponent(group) : "";
    try {
        var students = await api("GET", "/api/admin/express/students" + query);
        var list = document.getElementById("express-students-list");
        var empty = document.getElementById("express-empty-state");

        if (students.length === 0) {
            list.innerHTML = "";
            empty.classList.remove("hidden");
            return;
        }

        empty.classList.add("hidden");
        list.innerHTML = students.map(function (s) {
            var total = s.total_steps || 9;
            var statusLabel = s.status === "submitted"
                ? "Сдано " + s.steps_done + "/" + total
                : "Идёт " + s.steps_done + "/" + total;
            return '<div class="student-row" data-express-sid="' + s.student_id + '">' +
                '<div class="student-meta">' +
                    '<div>' +
                        '<div class="student-name">' + esc(s.name) + '</div>' +
                        '<div class="student-group">' + esc(s.group_name) + '</div>' +
                    '</div>' +
                    '<span class="status-badge status-' + s.status + '">' + statusLabel + '</span>' +
                '</div>' +
                '<div class="student-detail" id="express-detail-' + s.student_id + '"></div>' +
            '</div>';
        }).join("");

        list.querySelectorAll(".student-row").forEach(function (row) {
            row.addEventListener("click", function () {
                toggleExpressDetail(row.dataset.expressSid);
            });
        });
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

async function toggleExpressDetail(studentId) {
    var detail = document.getElementById("express-detail-" + studentId);
    if (detail.classList.contains("open")) {
        detail.classList.remove("open");
        return;
    }
    try {
        var data = await api("GET", "/api/admin/express/student/" + studentId);
        var html = '';
        (data.topics || []).forEach(function (block) {
            html += '<div style="margin:14px 0 6px;color:var(--link);font-size:13px;font-weight:600">' +
                esc(block.emoji || "") + " " + esc(block.topic_title) + '</div>';
            block.submissions.forEach(function (s) {
                html += '<div class="detail-step">';
                html += '<h4>Шаг ' + s.step + ': ' + esc(s.step_title) + '</h4>';
                if (s.criteria) {
                    html += '<div class="detail-answer" style="font-style:italic;color:var(--hint)">Критерий: ' + esc(s.criteria) + '</div>';
                }
                s.fields.forEach(function (f) {
                    var val = s.answers[f.id] || "";
                    if (!val) return;
                    html += '<div class="detail-answer" style="margin:6px 0 0"><strong>' + esc(f.label) + ':</strong></div>';
                    html += '<div class="detail-answer" style="white-space:pre-wrap;color:var(--text);background:var(--secondary-bg);padding:8px 10px;border-radius:6px;margin-top:4px;font-size:13px">' + esc(val) + '</div>';
                });
                html += '</div>';
            });
        });
        html += '<button class="btn-reset-express" data-sid="' + studentId + '" style="margin-top:8px;padding:8px 16px;background:transparent;border:1px solid #f44336;color:#f44336;border-radius:8px;font-size:13px;cursor:pointer">Сбросить</button>';
        detail.innerHTML = html;
        detail.querySelector(".btn-reset-express").addEventListener("click", function (e) {
            e.stopPropagation();
            resetExpress(studentId);
        });
        detail.classList.add("open");
    } catch (e) {
        detail.innerHTML = '<div class="detail-answer">Ошибка загрузки</div>';
        detail.classList.add("open");
    }
}

async function resetExpress(studentId) {
    if (!confirm("Сбросить «Практику на пару» этого студента?")) return;
    try {
        await fetch(API_BASE + "/api/admin/express/reset/" + studentId, {
            method: "POST",
            headers: AUTH_HEADER,
        });
        loadExpressStudents();
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

document.getElementById("btn-express-export").addEventListener("click", async function () {
    var group = document.getElementById("express-group-filter").value;
    var query = group ? "?group=" + encodeURIComponent(group) : "";
    try {
        var resp = await fetch(API_BASE + "/api/admin/express/export" + query, { headers: AUTH_HEADER });
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "express_results.csv";
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        tg.showAlert("Ошибка экспорта: " + e.message);
    }
});

document.getElementById("express-group-filter").addEventListener("change", loadExpressStudents);

// --- Exam tab («Создание и поддержка сайта», 2026-05-16) ---

async function loadExamStudents() {
    var group = document.getElementById("exam-group-filter").value;
    var query = group ? "?group=" + encodeURIComponent(group) : "";
    try {
        var students = await api("GET", "/api/admin/exam/students" + query);
        var list = document.getElementById("exam-students-list");
        var empty = document.getElementById("exam-empty-state");

        if (students.length === 0) {
            list.innerHTML = "";
            empty.classList.remove("hidden");
            return;
        }

        empty.classList.add("hidden");
        list.innerHTML = students.map(function (s) {
            return '<div class="student-row" data-exam-sid="' + s.student_id + '">' +
                '<div class="student-meta">' +
                    '<div>' +
                        '<div class="student-name">' + esc(s.name) + '</div>' +
                        '<div class="student-group">' + esc(s.group_name) + '</div>' +
                    '</div>' +
                    '<span class="status-badge status-submitted">' + s.mcq_score + '/' + s.mcq_total + '</span>' +
                '</div>' +
                '<div class="student-detail" id="exam-detail-' + s.student_id + '"></div>' +
            '</div>';
        }).join("");

        list.querySelectorAll(".student-row").forEach(function (row) {
            row.addEventListener("click", function () {
                toggleExamDetail(row.dataset.examSid);
            });
        });
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

async function toggleExamDetail(studentId) {
    var detail = document.getElementById("exam-detail-" + studentId);
    if (detail.classList.contains("open")) {
        detail.classList.remove("open");
        return;
    }
    try {
        var data = await api("GET", "/api/admin/exam/student/" + studentId);
        var html = '';
        html += '<div style="margin:8px 0 12px;color:var(--link);font-weight:600;font-size:14px">' +
            'Часть 1: ' + data.score + '/' + data.total + '</div>';

        // MCQ answers with correct-answer indication. Server stores raw answers
        // as {qid: option_idx_string}; meta about questions/correct lives on
        // the static exam page, so here we just show "what student picked".
        html += '<div style="margin-bottom:14px">';
        Object.keys(data.mcq_answers).sort(function (a, b) { return +a - +b; }).forEach(function (k) {
            var picked = data.mcq_answers[k];
            html += '<div class="detail-answer" style="margin:4px 0">Q' + (+k + 1) +
                ': <strong>' + esc(picked === null || picked === undefined ? "—" : ("вариант " + (+picked + 1))) +
                '</strong></div>';
        });
        html += '</div>';

        // Open answers
        html += '<div style="margin:14px 0 8px;color:var(--link);font-weight:600;font-size:14px">' +
            'Часть 2: развёрнутые ответы</div>';
        var keys = Object.keys(data.open_answers);
        if (keys.length === 0) {
            html += '<div class="detail-answer">— нет ответов</div>';
        } else {
            keys.forEach(function (k) {
                var text = data.open_answers[k] || "";
                html += '<div class="detail-answer" style="white-space:pre-wrap;color:var(--text);background:var(--secondary-bg);padding:10px 12px;border-radius:8px;margin:6px 0;font-size:13px">';
                html += '<strong style="display:block;margin-bottom:6px;color:var(--link)">Вопрос #' + (+k + 1) + '</strong>';
                html += esc(text || "—");
                html += '</div>';
            });
        }

        html += '<div style="margin-top:10px;color:var(--hint);font-size:12px">Сдано: ' + esc(data.submitted_at || "") + '</div>';
        html += '<button class="btn-reset-exam" data-sid="' + studentId + '" style="margin-top:8px;padding:8px 16px;background:transparent;border:1px solid #f44336;color:#f44336;border-radius:8px;font-size:13px;cursor:pointer">Сбросить экзамен</button>';
        detail.innerHTML = html;
        detail.querySelector(".btn-reset-exam").addEventListener("click", function (e) {
            e.stopPropagation();
            resetExam(studentId);
        });
        detail.classList.add("open");
    } catch (e) {
        detail.innerHTML = '<div class="detail-answer">Ошибка загрузки</div>';
        detail.classList.add("open");
    }
}

async function resetExam(studentId) {
    if (!confirm("Сбросить экзамен этого студента? Он сможет пересдать.")) return;
    try {
        await fetch(API_BASE + "/api/admin/exam/reset/" + studentId, {
            method: "POST",
            headers: AUTH_HEADER,
        });
        loadExamStudents();
    } catch (e) {
        tg.showAlert("Ошибка: " + e.message);
    }
}

document.getElementById("exam-group-filter").addEventListener("change", loadExamStudents);
