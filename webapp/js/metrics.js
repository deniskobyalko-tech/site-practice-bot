// --- Metrics Trainer v3 — General business focus ---

var METRIC_LINKS = {
    visits: "Смотри вместе с Bounce Rate и CR — много визитов при высоком bounce = проблема с качеством трафика или сайтом.",
    bounce: "Читай вместе с Временем и Глубиной. Высокий bounce + мало времени = страница не совпадает с ожиданием.",
    time: "Читай вместе с Bounce Rate и Глубиной. Долго ≠ хорошо — может быть пользователь просто заблудился.",
    depth: "Глубина 1 = bounce. Глубина 10+ = запутался. Норма для магазина: 3–5 страниц.",
    cr: "Выручка = Визиты × CR × ARPU. Если CR падает — смотри bounce и время, чтобы понять где теряются.",
    arpu: "ARPU × количество покупок = LTV. Низкий ARPU можно поднять upsell'ом и cross-sell'ом.",
    ltv: "Сравни с расходами на привлечение. Если LTV < стоимость клиента — бизнес теряет деньги.",
    retention: "Retention влияет на LTV: чем чаще возвращаются, тем больше заработаешь за жизнь клиента.",
};

var METRICS = [
    {
        id: "visits",
        name: "Визиты",
        format: "number",
        goodDirection: "up",
        formula: "Количество сессий на сайте за период",
        norms: "Зависит от бизнеса.\nВажно смотреть в динамике.\n1 человек = может быть несколько визитов.",
        interpret: function (val) {
            if (val > 40000) return val.toLocaleString("ru") + " — высокий трафик. Проверь качество: если bounce тоже высокий, трафик нецелевой.";
            if (val < 10000) return val.toLocaleString("ru") + " — мало трафика. Нужно работать с источниками.";
            return val.toLocaleString("ru") + " — нормальный уровень.";
        },
    },
    {
        id: "bounce",
        name: "Bounce Rate",
        format: "percent",
        goodDirection: "down",
        formula: "Bounce Rate = ушли без действия / все визиты × 100%",
        norms: "< 40% — отлично\n40–60% — норма для блогов\n> 60% — сигнал тревоги",
        interpret: function (val) {
            if (val > 60) return val + "% — тревога. Пользователи уходят, не сделав ничего.";
            if (val > 40) return val + "% — норма, но следи за динамикой.";
            return val + "% — отлично, пользователи вовлечены.";
        },
    },
    {
        id: "time",
        name: "Время на сайте",
        format: "time",
        goodDirection: "up",
        formula: "Среднее время сессии пользователя",
        norms: "Магазин: 2–4 мин\nБлог: 3–5 мин\n< 30 сек — проблема",
        interpret: function (val) {
            if (val < 30) return formatTime(val) + " — критически мало. Контент не совпадает с ожиданием.";
            if (val < 60) return formatTime(val) + " — мало. Пользователь не находит нужное.";
            if (val < 180) return formatTime(val) + " — нормально.";
            return formatTime(val) + " — хорошо, высокая вовлечённость.";
        },
    },
    {
        id: "depth",
        name: "Глубина",
        format: "number_decimal",
        goodDirection: "up",
        formula: "Среднее количество просмотренных страниц за визит",
        norms: "Магазин: 3–5 страниц\nБлог: 1.5–3\nЛендинг: 1–2\nГлубина 1 = bounce",
        interpret: function (val) {
            if (val < 1.5) return val.toFixed(1) + " стр. — мало. Пользователи не идут дальше первой страницы.";
            if (val < 4) return val.toFixed(1) + " стр. — нормально для магазина.";
            if (val < 8) return val.toFixed(1) + " стр. — хорошая вовлечённость.";
            return val.toFixed(1) + " стр. — очень много. Возможно, навигация запутанная.";
        },
    },
    {
        id: "cr",
        name: "CR",
        format: "percent_decimal",
        goodDirection: "up",
        formula: "CR = целевые действия / визиты × 100%",
        norms: "E-commerce: 1–3%\nЛидогенерация: 3–7%\nSaaS: 2–5%\n< 1% — проблема с воронкой",
        interpret: function (val) {
            if (val < 0.5) return val.toFixed(1) + "% — критически низкая. Воронка сломана.";
            if (val < 1) return val.toFixed(1) + "% — низкая. Проблемы с конверсией.";
            if (val < 3) return val.toFixed(1) + "% — нормальная для e-commerce.";
            return val.toFixed(1) + "% — хорошая конверсия.";
        },
    },
    {
        id: "arpu",
        name: "ARPU",
        format: "currency",
        goodDirection: "up",
        formula: "ARPU = выручка / кол-во пользователей за период",
        norms: "E-commerce: ₽500–3 000\nSaaS: ₽1 000–10 000\nНизкий ARPU → upsell, cross-sell.",
        interpret: function (val) {
            if (val < 500) return "₽" + val + " — низкий. Нужно работать над средним чеком.";
            if (val < 2000) return "₽" + val.toLocaleString("ru") + " — средний. Есть потенциал.";
            return "₽" + val.toLocaleString("ru") + " — хороший ARPU.";
        },
    },
    {
        id: "ltv",
        name: "LTV",
        format: "currency",
        goodDirection: "up",
        formula: "LTV = ARPU × среднее кол-во покупок за жизнь клиента",
        norms: "E-commerce: ₽3 000–15 000\nSaaS: ₽10 000–100 000\nLTV должен быть > стоимости привлечения.",
        interpret: function (val) {
            if (val < 3000) return "₽" + val.toLocaleString("ru") + " — низкий. Клиенты не возвращаются или мало тратят.";
            if (val < 8000) return "₽" + val.toLocaleString("ru") + " — средний. Работай над retention.";
            return "₽" + val.toLocaleString("ru") + " — хороший LTV.";
        },
    },
    {
        id: "retention",
        name: "Retention 30d",
        format: "percent",
        goodDirection: "up",
        formula: "% пользователей, вернувшихся в течение 30 дней",
        norms: "E-commerce: 20–35%\nSaaS: 40–60%\nМедиа: 30–50%\n< 15% — проблема с продуктом",
        interpret: function (val) {
            if (val < 15) return val + "% — критически низкий. Пользователи не возвращаются.";
            if (val < 25) return val + "% — ниже нормы. Нужно работать над лояльностью.";
            if (val < 40) return val + "% — нормальный для e-commerce.";
            return val + "% — отличный retention.";
        },
    },
];

// --- Simplified general business scenarios ---

var SCENARIOS = [
    {
        type: "traffic_quality",
        title: "Проблема с качеством трафика",
        diagnosis:
            "Трафик высокий, но пользователи уходят мгновенно.\n\n" +
            "Проблема: на сайт приходят не те люди. Источники трафика нецелевые — сайт привлекает не свою аудиторию.\n\n" +
            "Что делать:\n• Проанализируй источники трафика — откуда приходят\n• Сравни контент сайта с ожиданиями аудитории\n• Посмотри какие страницы открывают первыми\n• Проверь, что первый экран отвечает на вопрос «зачем я тут?»",
        forecast: "Если не менять: сайт будет получать много визитов, но без конверсий. Расходы растут, доходы нет.",
        ranges: {
            visits: { min: 30000, max: 60000, deltaMin: 20, deltaMax: 40 },
            bounce: { min: 65, max: 85, deltaMin: 15, deltaMax: 30 },
            time: { min: 10, max: 35, deltaMin: -65, deltaMax: -40 },
            depth: { min: 1.0, max: 1.4, deltaMin: -50, deltaMax: -30 },
            cr: { min: 0.2, max: 0.6, deltaMin: -60, deltaMax: -35 },
            arpu: { min: 800, max: 2000, deltaMin: -5, deltaMax: 5 },
            ltv: { min: 2000, max: 5000, deltaMin: -10, deltaMax: 5 },
            retention: { min: 8, max: 15, deltaMin: -30, deltaMax: -10 },
        },
    },
    {
        type: "broken_funnel",
        title: "Сломанная воронка",
        diagnosis:
            "Пользователи приходят, смотрят, но не покупают.\n\n" +
            "Проблема: сайт вовлекает, но не конвертирует. Скорее всего проблема с CTA, оффером, ценой или формой заявки.\n\n" +
            "Что делать:\n• Проверь: понятно ли что делать на сайте за 5 секунд?\n• CTA виден без скролла?\n• Сколько шагов до целевого действия?\n• Попробуй A/B тест заголовка и кнопки",
        forecast: "Если не менять: трафик есть, время на сайте нормальное, но выручка стоит на месте. Каждый день теряешь потенциальных клиентов.",
        ranges: {
            visits: { min: 20000, max: 35000, deltaMin: 5, deltaMax: 15 },
            bounce: { min: 30, max: 45, deltaMin: -5, deltaMax: 5 },
            time: { min: 120, max: 240, deltaMin: -5, deltaMax: 10 },
            depth: { min: 3.0, max: 6.0, deltaMin: -5, deltaMax: 10 },
            cr: { min: 0.2, max: 0.5, deltaMin: -70, deltaMax: -45 },
            arpu: { min: 1000, max: 2500, deltaMin: -5, deltaMax: 5 },
            ltv: { min: 4000, max: 8000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 25, max: 40, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "landing_problem",
        title: "Проблема с первым экраном",
        diagnosis:
            "Люди приходят и сразу уходят — первый экран не работает.\n\n" +
            "Проблема: посадочная страница не удерживает. Медленная загрузка, контент не совпадает с ожиданием, плохой мобильный UX.\n\n" +
            "Что делать:\n• Проверь скорость загрузки (PageSpeed)\n• Совпадает ли заголовок с тем, откуда пришёл пользователь?\n• Проверь мобильную версию\n• Добавь элементы доверия (отзывы, кейсы)",
        forecast: "Если не менять: 70–85% трафика теряется на первом экране. Это прямые потери.",
        ranges: {
            visits: { min: 20000, max: 40000, deltaMin: 5, deltaMax: 15 },
            bounce: { min: 70, max: 90, deltaMin: 20, deltaMax: 35 },
            time: { min: 8, max: 25, deltaMin: -70, deltaMax: -50 },
            depth: { min: 1.0, max: 1.3, deltaMin: -60, deltaMax: -40 },
            cr: { min: 0.1, max: 0.4, deltaMin: -65, deltaMax: -45 },
            arpu: { min: 800, max: 1500, deltaMin: -5, deltaMax: 5 },
            ltv: { min: 2000, max: 4000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 5, max: 12, deltaMin: -35, deltaMax: -15 },
        },
    },
    {
        type: "retention_problem",
        title: "Проблема с удержанием",
        diagnosis:
            "Конверсия нормальная, но клиенты не возвращаются.\n\n" +
            "Проблема: продукт/сервис не создаёт привычку. Клиенты покупают один раз и уходят. LTV низкий.\n\n" +
            "Что делать:\n• Проверь email/push-коммуникации после покупки\n• Есть ли программа лояльности?\n• Есть ли повод вернуться (новинки, акции, контент)?\n• Сравни retention по сегментам — где теряем?",
        forecast: "Если не менять: бизнес будет постоянно тратить на привлечение новых, не зарабатывая на повторных. Юнит-экономика не сойдётся.",
        ranges: {
            visits: { min: 15000, max: 30000, deltaMin: -15, deltaMax: 5 },
            bounce: { min: 30, max: 45, deltaMin: -5, deltaMax: 5 },
            time: { min: 90, max: 180, deltaMin: -10, deltaMax: 10 },
            depth: { min: 3.0, max: 5.0, deltaMin: -5, deltaMax: 5 },
            cr: { min: 1.5, max: 3.5, deltaMin: -10, deltaMax: 5 },
            arpu: { min: 600, max: 1200, deltaMin: -15, deltaMax: -5 },
            ltv: { min: 1500, max: 3000, deltaMin: -40, deltaMax: -20 },
            retention: { min: 5, max: 12, deltaMin: -50, deltaMax: -25 },
        },
    },
    {
        type: "low_arpu",
        title: "Низкий средний чек",
        diagnosis:
            "Конверсия есть, retention нормальный, но выручка не растёт.\n\n" +
            "Проблема: пользователи покупают, но мало тратят. Средний чек низкий, upsell не работает.\n\n" +
            "Что делать:\n• Проверь: есть ли блоки «С этим покупают» / «Вам понравится»?\n• Есть ли пороги бесплатной доставки?\n• Работает ли рекомендательная система?\n• Попробуй бандлы и комплекты",
        forecast: "Если не менять: при текущем ARPU выручка растёт только за счёт трафика. Это дорого и не масштабируется.",
        ranges: {
            visits: { min: 20000, max: 35000, deltaMin: 5, deltaMax: 15 },
            bounce: { min: 30, max: 42, deltaMin: -5, deltaMax: 5 },
            time: { min: 120, max: 200, deltaMin: -5, deltaMax: 10 },
            depth: { min: 4.0, max: 7.0, deltaMin: 5, deltaMax: 15 },
            cr: { min: 2.0, max: 4.0, deltaMin: -5, deltaMax: 10 },
            arpu: { min: 300, max: 600, deltaMin: -25, deltaMax: -10 },
            ltv: { min: 1500, max: 3500, deltaMin: -20, deltaMax: -5 },
            retention: { min: 25, max: 40, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "everything_declining",
        title: "Общий спад",
        diagnosis:
            "Все метрики ухудшаются одновременно.\n\n" +
            "Проблема: это может быть сезонность, устаревший продукт, или конкуренты перехватили аудиторию.\n\n" +
            "Что делать:\n• Сравни с прошлым годом — это сезонность?\n• Посмотри конкурентов — что они изменили?\n• Проверь технические проблемы (скорость, ошибки)\n• Проанализируй: когда начался спад и что изменилось?",
        forecast: "Если не менять: тренд продолжится. Без диагностики причины любые действия будут случайными.",
        ranges: {
            visits: { min: 8000, max: 18000, deltaMin: -35, deltaMax: -15 },
            bounce: { min: 50, max: 70, deltaMin: 10, deltaMax: 25 },
            time: { min: 40, max: 90, deltaMin: -35, deltaMax: -15 },
            depth: { min: 1.5, max: 3.0, deltaMin: -30, deltaMax: -10 },
            cr: { min: 0.4, max: 1.0, deltaMin: -45, deltaMax: -20 },
            arpu: { min: 500, max: 1200, deltaMin: -20, deltaMax: -5 },
            ltv: { min: 2000, max: 5000, deltaMin: -30, deltaMax: -10 },
            retention: { min: 10, max: 20, deltaMin: -30, deltaMax: -10 },
        },
    },
];

// --- Helpers ---

function randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals) {
    var val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals || 1));
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function formatValue(metric, value) {
    if (metric.format === "number") return value.toLocaleString("ru");
    if (metric.format === "number_decimal") return value.toFixed(1);
    if (metric.format === "percent") return value + "%";
    if (metric.format === "percent_decimal") return value.toFixed(1) + "%";
    if (metric.format === "time") return formatTime(value);
    if (metric.format === "currency") return "₽" + value.toLocaleString("ru");
    return String(value);
}

function formatDelta(metric, delta) {
    var sign = delta >= 0 ? "+" : "";
    var arrow = delta >= 0 ? " ↑" : " ↓";
    return sign + delta + "%" + arrow;
}

function isDeltaGood(metric, delta) {
    if (delta === 0) return false;
    if (metric.goodDirection === "up") return delta > 0;
    return delta < 0;
}

// --- State ---

var currentScenario = null;
var currentValues = {};
var currentDeltas = {};
var activeTooltip = null;

// --- Generate ---

function generateScenario() {
    var idx = randBetween(0, SCENARIOS.length - 1);
    currentScenario = SCENARIOS[idx];

    METRICS.forEach(function (metric) {
        var range = currentScenario.ranges[metric.id];
        if (metric.format === "percent_decimal" || metric.format === "number_decimal") {
            currentValues[metric.id] = randFloat(range.min, range.max, 1);
        } else {
            currentValues[metric.id] = randBetween(range.min, range.max);
        }
        currentDeltas[metric.id] = randBetween(range.deltaMin, range.deltaMax);
    });

    renderDashboard();
    hideDiagnosis();
    hideHint();
    hideHypothesis();
    closeTooltip();
}

// --- Render ---

function renderDashboard() {
    var grid = document.getElementById("metrics-grid");
    grid.innerHTML = "";

    METRICS.forEach(function (metric) {
        var value = currentValues[metric.id];
        var delta = currentDeltas[metric.id];
        var good = isDeltaGood(metric, delta);

        var card = document.createElement("div");
        card.className = "metric-card";
        card.dataset.metricId = metric.id;

        card.innerHTML =
            '<div class="metric-name">' + metric.name + "</div>" +
            '<div class="metric-value">' + formatValue(metric, value) + "</div>" +
            '<div class="metric-delta ' + (good ? "delta-good" : "delta-bad") + '">' +
            formatDelta(metric, delta) +
            "</div>";

        card.addEventListener("click", function (e) {
            e.stopPropagation();
            showTooltip(metric, card);
        });

        grid.appendChild(card);
    });
}

// --- Tooltips ---

function showTooltip(metric, cardEl) {
    closeTooltip();

    var value = currentValues[metric.id];
    var interpretation = metric.interpret(value);
    var link = METRIC_LINKS[metric.id] || "";

    var tooltip = document.createElement("div");
    tooltip.className = "metric-tooltip";
    tooltip.innerHTML =
        '<div class="tooltip-title">' + metric.name + "</div>" +
        '<div class="tooltip-formula">' + metric.formula.replace(/\n/g, "<br>") + "</div>" +
        '<div class="tooltip-norms">' + metric.norms.replace(/\n/g, "<br>") + "</div>" +
        '<div class="tooltip-interpret">' + interpretation + "</div>" +
        (link ? '<div class="tooltip-link">' + link + "</div>" : "");

    tooltip.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    cardEl.style.position = "relative";
    cardEl.appendChild(tooltip);
    activeTooltip = tooltip;
}

function closeTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

document.addEventListener("click", function () {
    closeTooltip();
});

// --- Hint ---

function showHint() {
    document.getElementById("hint-content").style.display = "block";
    document.getElementById("btn-show-hint").style.display = "none";
}

function hideHint() {
    document.getElementById("hint-content").style.display = "none";
    document.getElementById("btn-show-hint").style.display = "block";
}

// --- Diagnosis ---

function showDiagnosis() {
    var diagnosisText = currentScenario.diagnosis;
    if (currentScenario.forecast) {
        diagnosisText += "\n\nЕсли ничего не делать:\n" + currentScenario.forecast;
    }
    var block = document.getElementById("diagnosis-content");
    block.textContent = diagnosisText;
    block.style.display = "block";
    document.getElementById("btn-show-diagnosis").style.display = "none";
    document.getElementById("hypothesis-block").style.display = "block";
}

function hideDiagnosis() {
    document.getElementById("diagnosis-content").style.display = "none";
    document.getElementById("btn-show-diagnosis").style.display = "block";
}

// --- Hypothesis ---

function hideHypothesis() {
    var block = document.getElementById("hypothesis-block");
    if (block) block.style.display = "none";
    var result = document.getElementById("hypothesis-result");
    if (result) result.style.display = "none";
    var textarea = document.getElementById("hypothesis-text");
    if (textarea) textarea.value = "";
}

function saveHypothesis() {
    var text = document.getElementById("hypothesis-text").value.trim();
    if (!text) return;
    var result = document.getElementById("hypothesis-result");
    result.textContent = "Гипотеза сохранена. Обсуди её с преподавателем.";
    result.style.display = "block";
}

// --- Init ---

document.getElementById("btn-new-scenario").addEventListener("click", generateScenario);
document.getElementById("btn-show-diagnosis").addEventListener("click", showDiagnosis);
document.getElementById("btn-show-hint").addEventListener("click", showHint);
document.getElementById("btn-save-hypothesis").addEventListener("click", saveHypothesis);

generateScenario();
