// --- Metrics Trainer v2 ---

// --- 1. Metric relationships (for tooltip links) ---
var METRIC_LINKS = {
    visits: "Смотри вместе с Bounce Rate и CR — много визитов при высоком bounce = нецелевой трафик.",
    bounce: "Читай вместе с Временем на сайте. Высокий bounce + низкое время = проблема с посадочной или трафиком.",
    time: "Читай вместе с Bounce Rate и Глубиной. Долго ≠ хорошо, если пользователь просто заблудился.",
    ctr: "CTR влияет на CPC: выше CTR → Яндекс снижает ставку → дешевле клик.",
    cpc: "CPC = f(CTR, конкуренция). Посмотри CTR — если он низкий, CPC будет расти.",
    cr: "CPA = CPC ÷ CR. Если CR падает при нормальном CPC — проблема на сайте, не в рекламе.",
    cpa: "CPA = CPC ÷ CR. Чтобы понять причину роста CPA, смотри CPC и CR по отдельности.",
    ltv: "Сравни с CPA: если LTV < CPA, бизнес теряет деньги на каждом клиенте.",
    retention: "Retention влияет на LTV: чем чаще возвращаются, тем выше пожизненная ценность.",
    arpu: "ARPU × Retention = LTV. Низкий ARPU при хорошем retention можно поднять upsell'ом.",
};

var METRICS = [
    {
        id: "visits",
        name: "Визиты",
        format: "number",
        goodDirection: "up",
        formula: "Количество сессий на сайте за период",
        norms: "Зависит от бизнеса. Важно смотреть в динамике и сравнивать с уникальными пользователями.",
        interpret: function (val) {
            if (val > 40000) return val.toLocaleString("ru") + " — высокий трафик. Проверь качество: если bounce тоже высокий, трафик нецелевой.";
            if (val < 10000) return val.toLocaleString("ru") + " — низкий трафик. Проверь рекламу и источники.";
            return val.toLocaleString("ru") + " — нормальный уровень трафика.";
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
            if (val > 60) return val + "% — тревога. Проверь посадочную страницу или качество трафика.";
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
        norms: "Зависит от типа сайта.\nМагазин: 2–4 мин\nБлог: 3–5 мин\n< 30 сек — проблема",
        interpret: function (val) {
            if (val < 30) return formatTime(val) + " — критически мало. Контент не совпадает с ожиданием.";
            if (val < 60) return formatTime(val) + " — мало. Пользователь не находит нужное.";
            if (val < 180) return formatTime(val) + " — нормально.";
            return formatTime(val) + " — хорошо, высокая вовлечённость.";
        },
    },
    {
        id: "ctr",
        name: "CTR",
        format: "percent_decimal",
        goodDirection: "up",
        formula: "CTR = клики / показы × 100%",
        norms: "Поиск Яндекс: 5–10% хорошо\nМедийная реклама: 0.3–1% норма\nПоиск < 1% — плохой заголовок",
        interpret: function (val) {
            if (val < 1) return val.toFixed(1) + "% — низкий. Объявление не цепляет. Меняй заголовок, не бюджет.";
            if (val < 5) return val.toFixed(1) + "% — средний. Есть потенциал для улучшения.";
            return val.toFixed(1) + "% — хороший CTR.";
        },
    },
    {
        id: "cpc",
        name: "CPC",
        format: "currency",
        goodDirection: "down",
        formula: "CPC = расходы на рекламу / число кликов",
        norms: "Зависит от ниши.\nE-commerce: ₽30–80\nНедвижимость: ₽100–300\nB2B: ₽80–200",
        interpret: function (val) {
            if (val > 150) return "₽" + val + " — дорого. Улучши релевантность, подними CTR.";
            if (val > 80) return "₽" + val + " — средний. Проверь конкурентов в аукционе.";
            return "₽" + val + " — хорошая цена клика.";
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
            if (val < 0.5) return val.toFixed(1) + "% — критически низкая. Воронка сломана: проверь CTA, оффер, форму.";
            if (val < 1) return val.toFixed(1) + "% — низкая. Есть проблемы с конверсией на сайте.";
            if (val < 3) return val.toFixed(1) + "% — нормальная для e-commerce.";
            return val.toFixed(1) + "% — хорошая конверсия.";
        },
    },
    {
        id: "cpa",
        name: "CPA",
        format: "currency",
        goodDirection: "down",
        formula: "CPA = расходы / целевые действия\nТакже: CPA = CPC ÷ CR",
        norms: "Покупка: ₽500–2000\nЗвонок: ₽200–500\nЗаявка: ₽100–300\nВсегда сравнивай с LTV.",
        interpret: function (val) {
            if (val > 5000) return "₽" + val.toLocaleString("ru") + " — критически дорого. Проблема в воронке или в рекламе.";
            if (val > 2000) return "₽" + val.toLocaleString("ru") + " — высокий. Проверь конверсию на сайте.";
            return "₽" + val.toLocaleString("ru") + " — в пределах нормы.";
        },
    },
    // --- Business metrics (LTV, Retention, ARPU) ---
    {
        id: "ltv",
        name: "LTV",
        format: "currency",
        goodDirection: "up",
        formula: "LTV = ARPU × среднее кол-во покупок за жизнь клиента",
        norms: "E-commerce: ₽3 000–15 000\nSaaS: ₽10 000–100 000\nLTV должен быть > CPA минимум в 3 раза.",
        interpret: function (val) {
            var cpa = currentValues["cpa"] || 1;
            var ratio = (val / cpa).toFixed(1);
            if (val / cpa < 1) return "₽" + val.toLocaleString("ru") + " — LTV/CPA = " + ratio + "x. Убыток: клиент стоит дороже, чем приносит.";
            if (val / cpa < 3) return "₽" + val.toLocaleString("ru") + " — LTV/CPA = " + ratio + "x. Маржинально, но рискованно.";
            return "₽" + val.toLocaleString("ru") + " — LTV/CPA = " + ratio + "x. Здоровая экономика.";
        },
    },
    {
        id: "retention",
        name: "Retention 30d",
        format: "percent",
        goodDirection: "up",
        formula: "% пользователей, вернувшихся на сайт в течение 30 дней",
        norms: "E-commerce: 20–35%\nSaaS: 40–60%\nМедиа: 30–50%\n< 15% — серьёзная проблема с продуктом",
        interpret: function (val) {
            if (val < 15) return val + "% — критически низкий. Пользователи не возвращаются — проблема с продуктом или ценностью.";
            if (val < 25) return val + "% — ниже нормы. Проверь email/push, программу лояльности.";
            if (val < 40) return val + "% — нормальный для e-commerce.";
            return val + "% — отличный retention.";
        },
    },
    {
        id: "arpu",
        name: "ARPU",
        format: "currency",
        goodDirection: "up",
        formula: "ARPU = выручка / кол-во пользователей за период",
        norms: "Зависит от бизнеса.\nE-commerce: ₽500–3 000\nSaaS: ₽1 000–10 000\nНизкий ARPU можно поднять upsell'ом.",
        interpret: function (val) {
            if (val < 500) return "₽" + val + " — низкий. Подумай про upsell, cross-sell, повышение среднего чека.";
            if (val < 2000) return "₽" + val.toLocaleString("ru") + " — средний. Есть потенциал для роста.";
            return "₽" + val.toLocaleString("ru") + " — хороший ARPU.";
        },
    },
];

var SCENARIOS = [
    {
        type: "irrelevant_traffic",
        title: "Нерелевантный трафик",
        diagnosis:
            "Трафик высокий, но пользователи уходят мгновенно.\n\n" +
            "Проблема: источники трафика нецелевые — ключевые слова слишком широкие или объявление не совпадает с посадочной страницей.\n\n" +
            "Что делать:\n• Проверь UTM-метки и источники трафика\n• Посмотри Вебвизор — где пользователи уходят\n• Сравни текст объявления с содержанием страницы\n• Добавь минус-слова в рекламу",
        forecast: "Если не менять: бюджет продолжит сливаться на нецелевой трафик. CPA будет расти на 15–20% каждую неделю, пока не закончится бюджет.",
        ranges: {
            visits: { min: 30000, max: 60000, deltaMin: 20, deltaMax: 40 },
            bounce: { min: 60, max: 80, deltaMin: 15, deltaMax: 25 },
            time: { min: 15, max: 45, deltaMin: -60, deltaMax: -40 },
            ctr: { min: 3, max: 8, deltaMin: -5, deltaMax: 5 },
            cpc: { min: 40, max: 90, deltaMin: -10, deltaMax: 15 },
            cr: { min: 0.3, max: 0.8, deltaMin: -60, deltaMax: -30 },
            cpa: { min: 3000, max: 6000, deltaMin: 80, deltaMax: 150 },
            ltv: { min: 4000, max: 8000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 20, max: 35, deltaMin: -10, deltaMax: 5 },
            arpu: { min: 800, max: 2000, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "bad_ad",
        title: "Плохое объявление",
        diagnosis:
            "CTR упал — объявление не привлекает клики.\n\n" +
            "Проблема: заголовок не цепляет аудиторию, нет конкретики или УТП. Конкуренты выглядят лучше в поиске.\n\n" +
            "Что делать:\n• Измени заголовок — добавь цену, срок, выгоду\n• Добавь быстрые ссылки и расширения\n• Посмотри объявления конкурентов\n• Проверь: может быть запрос слишком широкий",
        forecast: "Если не менять: показы останутся, но кликов будет всё меньше. CPC продолжит расти, бюджет будет тратиться на показы без переходов.",
        ranges: {
            visits: { min: 5000, max: 15000, deltaMin: -50, deltaMax: -30 },
            bounce: { min: 30, max: 45, deltaMin: -5, deltaMax: 5 },
            time: { min: 90, max: 180, deltaMin: -10, deltaMax: 10 },
            ctr: { min: 0.2, max: 0.8, deltaMin: -70, deltaMax: -50 },
            cpc: { min: 100, max: 200, deltaMin: 40, deltaMax: 80 },
            cr: { min: 1.5, max: 3, deltaMin: -10, deltaMax: 10 },
            cpa: { min: 4000, max: 8000, deltaMin: 100, deltaMax: 200 },
            ltv: { min: 5000, max: 12000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 25, max: 40, deltaMin: -5, deltaMax: 5 },
            arpu: { min: 1000, max: 2500, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "broken_funnel",
        title: "Сломанная воронка",
        diagnosis:
            "Трафик нормальный, конверсия на нуле.\n\n" +
            "Проблема: реклама работает, пользователи приходят, но на сайте что-то ломает конверсию — плохой CTA, непонятный оффер, длинная форма.\n\n" +
            "Что делать:\n• A/B тест CTA-кнопки и оффера\n• Упрости форму заявки\n• Проверь путь пользователя через Вебвизор\n• НЕ трогай ставки — проблема не в рекламе",
        forecast: "Если не менять: при бюджете ₽18 000/день через 2 недели вы потратите ₽252 000 почти без конверсий. CPA уйдёт за ₽15 000.",
        ranges: {
            visits: { min: 20000, max: 35000, deltaMin: 5, deltaMax: 15 },
            bounce: { min: 30, max: 45, deltaMin: -5, deltaMax: 5 },
            time: { min: 90, max: 180, deltaMin: -10, deltaMax: 10 },
            ctr: { min: 3, max: 8, deltaMin: -5, deltaMax: 5 },
            cpc: { min: 40, max: 90, deltaMin: -10, deltaMax: 10 },
            cr: { min: 0.2, max: 0.6, deltaMin: -70, deltaMax: -50 },
            cpa: { min: 5000, max: 10000, deltaMin: 100, deltaMax: 200 },
            ltv: { min: 5000, max: 10000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 25, max: 40, deltaMin: -5, deltaMax: 5 },
            arpu: { min: 1000, max: 2500, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "audience_burnout",
        title: "Выгоревшая аудитория",
        diagnosis:
            "Все метрики ухудшаются одновременно.\n\n" +
            "Проблема: аудитория видела рекламу слишком много раз, устала. Частотность показов высокая, креативы приелись.\n\n" +
            "Что делать:\n• Обнови креативы — новые картинки, заголовки, офферы\n• Расширь таргетинг на новые сегменты\n• Попробуй новые каналы (РСЯ, соцсети)\n• Проверь частотность показов",
        forecast: "Если не менять: аудитория полностью выгорит за 3–4 недели. CTR упадёт ниже 0.5%, CPC вырастет в 2 раза, реклама станет убыточной.",
        ranges: {
            visits: { min: 10000, max: 20000, deltaMin: -40, deltaMax: -20 },
            bounce: { min: 45, max: 65, deltaMin: 10, deltaMax: 20 },
            time: { min: 40, max: 80, deltaMin: -40, deltaMax: -20 },
            ctr: { min: 1, max: 3, deltaMin: -50, deltaMax: -30 },
            cpc: { min: 80, max: 150, deltaMin: 30, deltaMax: 60 },
            cr: { min: 0.5, max: 1.2, deltaMin: -40, deltaMax: -20 },
            cpa: { min: 3000, max: 7000, deltaMin: 60, deltaMax: 120 },
            ltv: { min: 4000, max: 8000, deltaMin: -15, deltaMax: -5 },
            retention: { min: 15, max: 25, deltaMin: -25, deltaMax: -10 },
            arpu: { min: 600, max: 1500, deltaMin: -20, deltaMax: -5 },
        },
    },
    {
        type: "landing_problem",
        title: "Проблема с посадочной",
        diagnosis:
            "Реклама работает, но страница не удерживает.\n\n" +
            "Проблема: объявление релевантное (CTR в норме), но посадочная страница разочаровывает — медленно грузится, контент не совпадает с ожиданием, плохой мобильный UX.\n\n" +
            "Что делать:\n• Проверь скорость загрузки (PageSpeed)\n• Сравни заголовок объявления с заголовком страницы\n• Проверь мобильную версию\n• Добавь элементы доверия (отзывы, рейтинг)",
        forecast: "Если не менять: каждый день теряешь 70–85% трафика на первом экране. При CPC ₽60 и 30 000 визитов — это ₽1.2 млн/мес впустую.",
        ranges: {
            visits: { min: 20000, max: 40000, deltaMin: 5, deltaMax: 15 },
            bounce: { min: 65, max: 85, deltaMin: 20, deltaMax: 35 },
            time: { min: 10, max: 30, deltaMin: -70, deltaMax: -50 },
            ctr: { min: 3, max: 8, deltaMin: -5, deltaMax: 5 },
            cpc: { min: 40, max: 90, deltaMin: -10, deltaMax: 10 },
            cr: { min: 0.3, max: 0.8, deltaMin: -60, deltaMax: -40 },
            cpa: { min: 3000, max: 6000, deltaMin: 80, deltaMax: 140 },
            ltv: { min: 4000, max: 8000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 10, max: 20, deltaMin: -30, deltaMax: -10 },
            arpu: { min: 500, max: 1200, deltaMin: -10, deltaMax: 5 },
        },
    },
    // --- 6. New scenario: Market CPC growth ---
    {
        type: "market_cpc_growth",
        title: "Рыночный рост CPC",
        diagnosis:
            "CPC вырос, но проблема не в тебе — рынок перегрет.\n\n" +
            "Проблема: аукцион разогнан конкурентами, медиаинфляция. Твои объявления работают нормально (CTR в норме), но клики стали дороже для всех.\n\n" +
            "Что делать:\n• Не паникуй и не режь бюджет — это рыночный тренд\n• Расширь семантику на менее конкурентные запросы\n• Попробуй РСЯ и другие форматы\n• Считай юнит-экономику: если LTV > CPA × 3, можно продолжать\n• Инвестируй в SEO и органику — снижай зависимость от платного трафика",
        forecast: "Если не менять: CPC продолжит расти с рынком (~5–10% в квартал). Без диверсификации каналов маржинальность будет снижаться.",
        ranges: {
            visits: { min: 18000, max: 30000, deltaMin: -15, deltaMax: -5 },
            bounce: { min: 30, max: 45, deltaMin: -5, deltaMax: 5 },
            time: { min: 90, max: 180, deltaMin: -5, deltaMax: 10 },
            ctr: { min: 4, max: 8, deltaMin: -5, deltaMax: 5 },
            cpc: { min: 120, max: 250, deltaMin: 35, deltaMax: 70 },
            cr: { min: 1.5, max: 3, deltaMin: -10, deltaMax: 5 },
            cpa: { min: 2500, max: 5000, deltaMin: 30, deltaMax: 70 },
            ltv: { min: 8000, max: 15000, deltaMin: -5, deltaMax: 5 },
            retention: { min: 25, max: 40, deltaMin: -5, deltaMax: 5 },
            arpu: { min: 1200, max: 3000, deltaMin: -5, deltaMax: 5 },
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
        if (metric.format === "percent_decimal") {
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

// --- Tooltips with metric links ---

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

// --- 2. Thinking Model hint ---

function showHint() {
    document.getElementById("hint-content").style.display = "block";
    document.getElementById("btn-show-hint").style.display = "none";
}

function hideHint() {
    document.getElementById("hint-content").style.display = "none";
    document.getElementById("btn-show-hint").style.display = "block";
}

// --- Diagnosis with forecast ---

function showDiagnosis() {
    var diagnosisText = currentScenario.diagnosis;
    if (currentScenario.forecast) {
        diagnosisText += "\n\nЕсли ничего не делать:\n" + currentScenario.forecast;
    }
    var block = document.getElementById("diagnosis-content");
    block.textContent = diagnosisText;
    block.style.display = "block";
    document.getElementById("btn-show-diagnosis").style.display = "none";

    // Show hypothesis form after diagnosis
    document.getElementById("hypothesis-block").style.display = "block";
}

function hideDiagnosis() {
    document.getElementById("diagnosis-content").style.display = "none";
    document.getElementById("btn-show-diagnosis").style.display = "block";
}

// --- 5. Hypothesis form ---

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
    result.textContent = "Гипотеза сохранена. Обсуди её с преподавателем на следующем занятии.";
    result.style.display = "block";
}

// --- Init ---

document.getElementById("btn-new-scenario").addEventListener("click", generateScenario);
document.getElementById("btn-show-diagnosis").addEventListener("click", showDiagnosis);
document.getElementById("btn-show-hint").addEventListener("click", showHint);
document.getElementById("btn-save-hypothesis").addEventListener("click", saveHypothesis);

generateScenario();
