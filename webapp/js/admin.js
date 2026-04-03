const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = "";
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
        if (subs.length === 0) {
            detail.innerHTML = '<div class="detail-answer">Нет ответов</div>';
        } else {
            detail.innerHTML = subs.map(function (s) {
                return renderStep(s.step, s.answers);
            }).join("");
        }
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
