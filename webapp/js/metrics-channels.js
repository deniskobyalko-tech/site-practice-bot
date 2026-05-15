// --- Channel Metrics Trainer v1 — SEO, Контекст, Медийка ---

var METRIC_LINKS = {
    impressions: "Растёт Impressions без роста кликов — падают позиции или плохой сниппет.",
    avg_position: "Пара с Organic CTR. Топ-3 должен давать CTR >10%. Если нет — проблема в сниппете.",
    organic_ctr: "CTR ниже нормы для своей позиции = плохой title/description.",
    ppc_ctr: "Низкий CTR → нерелевантная семантика или слабое объявление. Аукцион наказывает.",
    avg_cpc: "Высокий CPC при низком CTR — Яндекс/Google штрафуют за качество. Чиним CTR → CPC падает.",
    conv_rate: "Высокий CTR + низкий Conv Rate = проблема посадочной/оффера, не рекламы.",
    cost_conv: "CPA должен быть ниже маржи. CPA > маржа = каждая продажа убыточна.",
    reach: "Reach × Frequency = Impressions. Верхняя воронка = Reach.",
    frequency: "1–2 недокрут. 3–5 оптимум. 8+ выгорание.",
    cpm: "Слишком дешёвый CPM часто = боты/плохие площадки. Проверь viewability.",
    viewability: "IAB стандарт ≥50%. Ниже 40% — площадки мусорные.",
};

var METRICS = [
    // --- SEO ---
    {
        id: "impressions",
        name: "Impressions (SEO)",
        format: "number",
        goodDirection: "up",
        formula: "Сколько раз страница показалась в выдаче\n(Яндекс.Вебмастер / Google Search Console)",
        norms: "Зависит от тематики.\nТренд важнее абсолюта.\nРост Impressions без роста кликов → проверь сниппет и позицию.",
        interpret: function (val) {
            if (val < 5000) return val.toLocaleString("ru") + " — мало. Сайт молодой или плохо индексируется.";
            if (val < 50000) return val.toLocaleString("ru") + " — средний уровень для нишевого бизнеса.";
            return val.toLocaleString("ru") + " — хороший охват в выдаче.";
        },
    },
    {
        id: "avg_position",
        name: "Avg Position",
        format: "number_decimal",
        goodDirection: "down",
        formula: "Средняя позиция в выдаче по всем запросам",
        norms: "1–3 — топ, собирает 50%+ кликов\n4–10 — первая страница\n11+ — вторая, кликов почти нет",
        interpret: function (val) {
            if (val <= 3) return val.toFixed(1) + " — топ-3. Лучшее место для CTR.";
            if (val <= 10) return val.toFixed(1) + " — первая страница, но вне топ-3 теряешь половину кликов.";
            if (val <= 20) return val.toFixed(1) + " — вторая страница, трафика почти нет.";
            return val.toFixed(1) + " — вне топа.";
        },
    },
    {
        id: "organic_ctr",
        name: "Organic CTR",
        format: "percent_decimal",
        goodDirection: "up",
        formula: "Organic CTR = Органические клики / Impressions × 100%",
        norms: "Позиция 1: ~25%\nПозиция 3: ~11%\nПозиция 10: ~2%\nНиже нормы для позиции → плохой сниппет.",
        interpret: function (val) {
            if (val < 1) return val.toFixed(1) + "% — очень низкий. Проверь сниппет и позицию.";
            if (val < 3) return val.toFixed(1) + "% — низкий, сниппет не цепляет.";
            if (val < 8) return val.toFixed(1) + "% — норма для позиций вне топ-3.";
            return val.toFixed(1) + "% — отлично, скорее всего топ-3.";
        },
    },
    // --- Контекст ---
    {
        id: "ppc_ctr",
        name: "CTR (Контекст)",
        format: "percent_decimal",
        goodDirection: "up",
        formula: "CTR = Клики / Показы × 100%",
        norms: "Поиск: 3–8% норма, >10% хорошо\nРСЯ/КМС: 0.5–1.5%\nНизкий CTR на поиске → нерелевантная семантика.",
        interpret: function (val) {
            if (val < 2) return val.toFixed(1) + "% — очень низкий. Проверь семантику и тексты.";
            if (val < 5) return val.toFixed(1) + "% — низкий для поиска, норма для РСЯ.";
            if (val < 10) return val.toFixed(1) + "% — хороший CTR для поиска.";
            return val.toFixed(1) + "% — отлично, релевантная семантика.";
        },
    },
    {
        id: "avg_cpc",
        name: "Avg CPC",
        format: "currency",
        goodDirection: "down",
        formula: "Avg CPC = Расход / Клики",
        norms: "E-commerce: 30–150 ₽\nЮр/мед/финансы: 200–1000 ₽\nРСЯ/КМС дешевле в 2–3 раза",
        interpret: function (val) {
            if (val < 30) return "₽" + val + " — очень дёшево. Либо РСЯ, либо низкая конкуренция.";
            if (val < 100) return "₽" + val + " — норма для e-commerce.";
            if (val < 300) return "₽" + val + " — средняя конкуренция.";
            return "₽" + val.toLocaleString("ru") + " — дорого. Проверь качество объявлений и минус-слова.";
        },
    },
    {
        id: "conv_rate",
        name: "Conv Rate",
        format: "percent_decimal",
        goodDirection: "up",
        formula: "Conv Rate = Конверсии / Клики × 100%",
        norms: "E-commerce: 2–5%\nЛидген: 3–8%\nSaaS: 2–5%\n<1% — проблема с посадочной, не с рекламой.",
        interpret: function (val) {
            if (val < 1) return val.toFixed(1) + "% — критически низкий. Проблема на посадочной.";
            if (val < 3) return val.toFixed(1) + "% — средний, есть куда расти.";
            if (val < 6) return val.toFixed(1) + "% — хороший уровень.";
            return val.toFixed(1) + "% — отличный Conv Rate.";
        },
    },
    {
        id: "cost_conv",
        name: "Cost/Conv (CPA)",
        format: "currency",
        goodDirection: "down",
        formula: "Cost/Conv = Расход / Конверсии",
        norms: "Должен быть меньше маржи.\nCPA > маржа → продажа убыточна.",
        interpret: function (val) {
            if (val < 500) return "₽" + val + " — дёшево. Проверь качество лидов.";
            if (val < 2000) return "₽" + val.toLocaleString("ru") + " — нормально для e-commerce.";
            if (val < 5000) return "₽" + val.toLocaleString("ru") + " — средне, ОК для дорогих товаров.";
            return "₽" + val.toLocaleString("ru") + " — дорого. Проверь юнит-экономику.";
        },
    },
    // --- Медийка ---
    {
        id: "reach",
        name: "Reach",
        format: "number",
        goodDirection: "up",
        formula: "Уникальных пользователей увидели рекламу",
        norms: "Зависит от бюджета и таргетинга.\nВерхняя воронка — миллионы.\nСмотри параллельно Frequency.",
        interpret: function (val) {
            if (val < 50000) return val.toLocaleString("ru") + " — мало. Маленький бюджет или узкий таргетинг.";
            if (val < 500000) return val.toLocaleString("ru") + " — средний охват.";
            return val.toLocaleString("ru") + " — большой охват, массовая кампания.";
        },
    },
    {
        id: "frequency",
        name: "Frequency",
        format: "number_decimal",
        goodDirection: "up",
        formula: "Frequency = Показы / Reach",
        norms: "1–2 — недокрут, пользователь забудет\n3–5 — оптимум, формируется знание\n6–8 — начинается усталость\n8+ — выгорание аудитории",
        interpret: function (val) {
            if (val < 2) return val.toFixed(1) + " — недокрут. Увеличь бюджет или сузь аудиторию.";
            if (val < 6) return val.toFixed(1) + " — оптимум.";
            if (val < 9) return val.toFixed(1) + " — усталость. Меняй креатив.";
            return val.toFixed(1) + " — перекрут, аудитория выгорает.";
        },
    },
    {
        id: "cpm",
        name: "CPM",
        format: "currency",
        goodDirection: "down",
        formula: "CPM = Расход / Показы × 1000",
        norms: "Массовые площадки: 200–500 ₽\nКачественный таргетинг: 500–1500 ₽\nПремиум: 2000+ ₽",
        interpret: function (val) {
            if (val < 200) return "₽" + val + " — дёшево. Проверь площадки (возможны боты).";
            if (val < 700) return "₽" + val + " — средний CPM.";
            if (val < 1500) return "₽" + val.toLocaleString("ru") + " — качественная аудитория.";
            return "₽" + val.toLocaleString("ru") + " — премиум, должна быть очень целевая аудитория.";
        },
    },
    {
        id: "viewability",
        name: "Viewability",
        format: "percent",
        goodDirection: "up",
        formula: "Viewability = Видимые показы / Все показы × 100%",
        norms: "IAB: ≥50% баннера видно ≥1 сек\n<40% — мусорные площадки\n>70% — отлично",
        interpret: function (val) {
            if (val < 40) return val + "% — много невидимых показов. Площадки под подозрением.";
            if (val < 60) return val + "% — средне, на грани нормы.";
            if (val < 75) return val + "% — хороший уровень.";
            return val + "% — отличная видимость.";
        },
    },
];

// --- Scenarios ---

var SCENARIOS = [
    {
        type: "seo_snippet",
        title: "SEO: показы есть, кликов нет",
        diagnosis:
            "Позиция хорошая (4–8), Impressions растут — но Organic CTR упал.\n\n" +
            "Проблема: пользователи видят сайт в выдаче, но кликают на конкурента. Сниппет (title + description) слабый или не соответствует запросу.\n\n" +
            "Что делать:\n" +
            "• Title: ключевой запрос + выгода (цена/бренд/условия/УТП)\n" +
            "• Description 150–160 символов, с призывом к действию\n" +
            "• Подключи микроразметку (цены, рейтинг, FAQ, хлебные крошки)\n" +
            "• Сравни свой сниппет с первыми 3 конкурентами — чего у тебя нет?",
        forecast: "Если не менять: позиции начнут падать. Поисковик видит низкий CTR и считает страницу нерелевантной запросу.",
        ranges: {
            impressions: { min: 40000, max: 90000, deltaMin: 10, deltaMax: 30 },
            avg_position: { min: 4, max: 8, deltaMin: -5, deltaMax: 5 },
            organic_ctr: { min: 0.8, max: 2.5, deltaMin: -50, deltaMax: -30 },
            ppc_ctr: { min: 4, max: 7, deltaMin: -5, deltaMax: 5 },
            avg_cpc: { min: 40, max: 100, deltaMin: -5, deltaMax: 5 },
            conv_rate: { min: 2, max: 4, deltaMin: -5, deltaMax: 5 },
            cost_conv: { min: 1000, max: 2500, deltaMin: -5, deltaMax: 5 },
            reach: { min: 100000, max: 300000, deltaMin: -5, deltaMax: 5 },
            frequency: { min: 3.0, max: 4.5, deltaMin: -5, deltaMax: 5 },
            cpm: { min: 400, max: 700, deltaMin: -5, deltaMax: 5 },
            viewability: { min: 60, max: 75, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "ppc_drain",
        title: "Контекст: деньги в трубу",
        diagnosis:
            "CTR низкий, CPC высокий, Conv Rate критический, CPA в несколько раз выше маржи.\n\n" +
            "Проблема: реклама показывается не тем людям. Широкие соответствия без минус-слов, нерелевантная семантика. Аукцион наказывает за низкий CTR — поднимает CPC.\n\n" +
            "Что делать:\n" +
            "• Почисти поисковые запросы — найди мусорные (отчёт «по запросам»)\n" +
            "• Добавь минус-слова: −бу, −бесплатно, −своими руками, −реферат, −отзывы\n" +
            "• Сузь соответствия: широкое → фразовое/точное\n" +
            "• Пересмотри тексты под целевые запросы\n" +
            "• Проверь: посадочная вообще под эти запросы?",
        forecast: "Если не менять: бюджет выгорит за неделю без продаж. CPA > маржи = чистый убыток с каждого заказа.",
        ranges: {
            impressions: { min: 10000, max: 25000, deltaMin: -5, deltaMax: 5 },
            avg_position: { min: 5, max: 10, deltaMin: -5, deltaMax: 5 },
            organic_ctr: { min: 3, max: 6, deltaMin: -5, deltaMax: 5 },
            ppc_ctr: { min: 0.8, max: 2.2, deltaMin: -40, deltaMax: -20 },
            avg_cpc: { min: 180, max: 400, deltaMin: 20, deltaMax: 50 },
            conv_rate: { min: 0.3, max: 1.0, deltaMin: -50, deltaMax: -30 },
            cost_conv: { min: 8000, max: 20000, deltaMin: 40, deltaMax: 80 },
            reach: { min: 80000, max: 200000, deltaMin: -5, deltaMax: 5 },
            frequency: { min: 2.5, max: 4.0, deltaMin: -5, deltaMax: 5 },
            cpm: { min: 400, max: 800, deltaMin: -5, deltaMax: 5 },
            viewability: { min: 50, max: 70, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "media_fake_reach",
        title: "Медийка: охват есть, бренда нет",
        diagnosis:
            "Reach огромный, Viewability ниже 40%, Frequency = 1. Бренд не запоминается.\n\n" +
            "Проблема: медиаплан закупает «грязный» инвентарь. Показы есть — но пользователь их не видит (невидимая зона экрана) либо видит 1 раз и забывает. Формально охват — миллион, фактически — ноль эффекта.\n\n" +
            "Что делать:\n" +
            "• Требуй у DSP отчёт по viewability и прогноз ≥60%\n" +
            "• Включи whitelist качественных площадок, blacklist мусорных\n" +
            "• Подключи антифрод (IAS, DoubleVerify, Adriver)\n" +
            "• Сузь аудиторию и подними частоту до 3–5\n" +
            "• CPM вырастет — но это нормально, качество дороже",
        forecast: "Если не менять: бюджет уходит в пустоту. Brand Lift покажет «все видели, но никто не помнит».",
        ranges: {
            impressions: { min: 5000, max: 15000, deltaMin: -5, deltaMax: 5 },
            avg_position: { min: 6, max: 12, deltaMin: -5, deltaMax: 5 },
            organic_ctr: { min: 1.5, max: 3.5, deltaMin: -5, deltaMax: 5 },
            ppc_ctr: { min: 3, max: 6, deltaMin: -5, deltaMax: 5 },
            avg_cpc: { min: 50, max: 120, deltaMin: -5, deltaMax: 5 },
            conv_rate: { min: 1.5, max: 3, deltaMin: -5, deltaMax: 5 },
            cost_conv: { min: 2000, max: 4000, deltaMin: -5, deltaMax: 5 },
            reach: { min: 800000, max: 1500000, deltaMin: 20, deltaMax: 40 },
            frequency: { min: 1.0, max: 1.8, deltaMin: -10, deltaMax: 5 },
            cpm: { min: 80, max: 180, deltaMin: -20, deltaMax: -5 },
            viewability: { min: 25, max: 40, deltaMin: -20, deltaMax: -5 },
        },
    },
    {
        type: "audience_burned",
        title: "Перегретая аудитория",
        diagnosis:
            "Frequency 8+, CTR падает, CPC растёт, CPA ползёт вверх.\n\n" +
            "Проблема: крутишь одну и ту же рекламу на одной и той же узкой аудитории. Люди видели её 10+ раз, привыкли, игнорируют. Алгоритмы поднимают ставку, чтобы выкупить показ — а кликов всё равно нет.\n\n" +
            "Что делать:\n" +
            "• Обнови креатив (новый визуал, новый оффер, новая механика)\n" +
            "• Расширь аудиторию: look-alike, смежные сегменты\n" +
            "• Сделай паузу 2–3 недели — дай аудитории «остыть»\n" +
            "• Переключись на retention (работа с уже знакомой базой)",
        forecast: "Если не менять: CTR → CPC ↑ → CPA взорвётся. Аудитория выработает «слепое пятно» к бренду.",
        ranges: {
            impressions: { min: 80000, max: 150000, deltaMin: -5, deltaMax: 5 },
            avg_position: { min: 3, max: 7, deltaMin: -5, deltaMax: 5 },
            organic_ctr: { min: 3, max: 6, deltaMin: -5, deltaMax: 5 },
            ppc_ctr: { min: 1.2, max: 2.5, deltaMin: -35, deltaMax: -15 },
            avg_cpc: { min: 150, max: 300, deltaMin: 15, deltaMax: 35 },
            conv_rate: { min: 1.5, max: 3, deltaMin: -15, deltaMax: -5 },
            cost_conv: { min: 4000, max: 9000, deltaMin: 20, deltaMax: 40 },
            reach: { min: 40000, max: 80000, deltaMin: -5, deltaMax: 5 },
            frequency: { min: 8, max: 14, deltaMin: 30, deltaMax: 60 },
            cpm: { min: 700, max: 1300, deltaMin: 10, deltaMax: 25 },
            viewability: { min: 55, max: 70, deltaMin: -5, deltaMax: 5 },
        },
    },
    {
        type: "ppc_ceiling",
        title: "Контекст упёрся в потолок",
        diagnosis:
            "CTR хороший, Conv Rate хороший — но Impressions не растут, CPA ползёт вверх.\n\n" +
            "Проблема: исчерпана горячая семантика. Бюджет выкупает всех, кто в день ищет «купить X» — и таких людей больше нет. Каждый следующий клик стоит дороже, потому что перебиваем всё более слабую аудиторию.\n\n" +
            "Что делать:\n" +
            "• Расширяй семантику: информационные запросы, смежные темы\n" +
            "• Подключи холодные каналы: медийка, SEO, контент-маркетинг\n" +
            "• Проверь географию — есть ли регионы без охвата?\n" +
            "• Запусти look-alike по существующим клиентам\n" +
            "• Подключи ретаргетинг на тех, кто был на сайте",
        forecast: "Если не менять: рост через бюджет невозможен. CPA продолжит расти, бизнес упрётся в потолок.",
        ranges: {
            impressions: { min: 15000, max: 30000, deltaMin: -5, deltaMax: 5 },
            avg_position: { min: 2, max: 5, deltaMin: -5, deltaMax: 5 },
            organic_ctr: { min: 5, max: 10, deltaMin: -5, deltaMax: 5 },
            ppc_ctr: { min: 6, max: 10, deltaMin: -5, deltaMax: 5 },
            avg_cpc: { min: 150, max: 350, deltaMin: 15, deltaMax: 30 },
            conv_rate: { min: 4, max: 7, deltaMin: -5, deltaMax: 5 },
            cost_conv: { min: 2500, max: 5000, deltaMin: 20, deltaMax: 40 },
            reach: { min: 100000, max: 250000, deltaMin: -5, deltaMax: 5 },
            frequency: { min: 3, max: 5, deltaMin: -5, deltaMax: 5 },
            cpm: { min: 500, max: 900, deltaMin: -5, deltaMax: 5 },
            viewability: { min: 55, max: 75, deltaMin: -5, deltaMax: 5 },
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

function formatValue(metric, value) {
    if (metric.format === "number") return value.toLocaleString("ru");
    if (metric.format === "number_decimal") return value.toFixed(1);
    if (metric.format === "percent") return value + "%";
    if (metric.format === "percent_decimal") return value.toFixed(1) + "%";
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
var activeTooltipCard = null;

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
    cardEl.classList.add("tooltip-open");
    cardEl.appendChild(tooltip);
    activeTooltip = tooltip;
    activeTooltipCard = cardEl;
}

function closeTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
    if (activeTooltipCard) {
        activeTooltipCard.classList.remove("tooltip-open");
        activeTooltipCard = null;
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
