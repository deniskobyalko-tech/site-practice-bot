// --- Funnel & Metrics Tree (interactive lecture companion) ---

var FUNNEL_DATA = {
    traffic: {
        title: "Трафик — откуда приходят",
        metrics: [
            { name: "DAU", desc: "Daily Active Users — сколько уникальных людей зашли сегодня." },
            { name: "MAU", desc: "Monthly Active Users — размер активной аудитории за месяц." },
            { name: "Источники", desc: "Откуда: органика (SEO), реклама, прямой заход, соцсети, реферал." },
        ],
        insight: "Много визитов ≠ хорошо. Важно качество: откуда пришли и что сделали.",
    },
    engagement: {
        title: "Вовлечение — что делают на сайте",
        metrics: [
            { name: "Bounce Rate", desc: "% ушедших без единого действия. > 60% — тревога." },
            { name: "Время на сайте", desc: "Среднее время сессии. Долго ≠ хорошо, может быть заблудился." },
            { name: "Глубина просмотра", desc: "Сколько страниц за визит. Магазин: 3–5 — норма." },
        ],
        insight: "Этот этап показывает, совпадает ли сайт с ожиданием пользователя.",
    },
    action: {
        title: "Целевое действие — конверсия",
        metrics: [
            { name: "CR (Conversion Rate)", desc: "% визитов → целевое действие. E-commerce: 1–3%." },
            { name: "Кол-во заказов", desc: "DAU × CR = заказы. Главная формула." },
            { name: "Средний чек (AOV)", desc: "Сколько тратят за заказ. Можно поднять upsell'ом." },
        ],
        insight: "Если трафик есть, а конверсий нет — проблема на сайте: CTA, оффер, форма.",
    },
    retention: {
        title: "Возврат и деньги",
        metrics: [
            { name: "Retention", desc: "% вернувшихся за 30 дней. Без retention привлечение = слив денег." },
            { name: "LTV", desc: "Lifetime Value — сколько клиент принесёт за всё время." },
            { name: "Выручка", desc: "Заказы × Средний чек. Итог всей воронки." },
        ],
        insight: "Нет смысла лить трафик, если retention = 0. Сначала удержание, потом привлечение.",
    },
};

// --- Tree Data ---

var TREE_DATA = {
    revenue: {
        title: "Выручка",
        formula: "Выручка = Кол-во заказов × Средний чек",
        desc: "Итоговый результат. Чтобы понять почему упала — разложи на множители и найди слабое звено.",
        links: "Иди вниз по дереву: что упало — заказы или средний чек? Если заказы — смотри DAU и CR.",
    },
    orders: {
        title: "Кол-во заказов",
        formula: "Заказы = DAU × CR",
        desc: "Сколько целевых действий за период. Зависит от трафика и конверсии.",
        links: "Мало заказов при хорошем DAU → проблема в CR. Мало заказов при низком DAU → проблема в трафике.",
    },
    aov: {
        title: "Средний чек (AOV)",
        formula: "AOV = Выручка / Кол-во заказов",
        desc: "Сколько денег приносит один заказ. Можно поднять upsell'ом, cross-sell'ом, бандлами.",
        links: "Низкий AOV при хорошем CR → пользователи покупают, но мало тратят. Работай над товарной матрицей.",
    },
    dau: {
        title: "DAU (Daily Active Users)",
        formula: "Уникальные пользователи за день",
        desc: "Сколько реальных людей зашли на сайт сегодня. Один человек = один DAU.",
        links: "DAU/MAU = Stickiness. Если > 20% — продукт «липкий». Если DAU падает — смотри источники трафика.",
    },
    mau: {
        title: "MAU (Monthly Active Users)",
        formula: "Уникальные пользователи за месяц",
        desc: "Размер аудитории. MAU большой, DAU маленький = люди приходят, но не возвращаются.",
        links: "Рост MAU без роста DAU — одноразовый трафик. Нужен retention.",
    },
    cr: {
        title: "CR (Conversion Rate)",
        formula: "CR = Целевые действия / DAU × 100%",
        desc: "Какой % пользователей совершает целевое действие. Главный показатель эффективности сайта.",
        links: "CR падает → смотри bounce и время. Быстро уходят — первый экран. Сидят долго, не покупают — CTA/оффер.",
    },
    bounce: {
        title: "Bounce Rate",
        formula: "Bounce = Ушли без действия / Все визиты × 100%",
        desc: "Процент людей, которые зашли и сразу ушли. Первый индикатор проблемы.",
        links: "Высокий bounce + высокий DAU = нецелевой трафик. Высокий bounce + низкое время = плохая посадочная.",
    },
    time: {
        title: "Время на сайте",
        formula: "Среднее время сессии",
        desc: "Само по себе ничего не значит. Читай вместе с bounce и глубиной.",
        links: "Мало времени + высокий bounce = контент не совпадает. Много времени + мало конверсий = запутался.",
    },
    depth: {
        title: "Глубина просмотра",
        formula: "Среднее кол-во страниц за визит",
        desc: "Сколько страниц смотрит за визит. Глубина 1 = bounce. Глубина 10+ = заблудился.",
        links: "Для магазина 3–5 — норма. Для лендинга 1–2 — ок. Контекст решает.",
    },
    retention: {
        title: "Retention",
        formula: "% вернувшихся в течение 30 дней",
        desc: "Возвращаются ли клиенты. Без retention привлечение убыточно.",
        links: "Retention × ARPU = LTV. Нет retention = каждый клиент одноразовый = дорого.",
    },
    ltv: {
        title: "LTV (Lifetime Value)",
        formula: "LTV = ARPU × Среднее кол-во покупок",
        desc: "Сколько клиент принесёт за всё время. LTV должен быть > стоимости привлечения.",
        links: "LTV < CAC = убыток. LTV > CAC × 3 = здоровая экономика.",
    },
    organic: {
        title: "Органика (SEO)",
        formula: "Бесплатный трафик из поисковых систем",
        desc: "Пользователи находят сайт через Яндекс/Google. Долгий, но бесплатный канал.",
        links: "Растёт медленно, но самый ценный. Высокий % органики = сильный бренд или хороший SEO.",
    },
    paid: {
        title: "Платный трафик",
        formula: "Реклама: контекст, таргет, баннеры",
        desc: "Быстрый, но платный. Ключевые метрики: CPC, CTR, CPA, ROAS.",
        links: "Если платный трафик = 80%+ всего трафика — зависимость. Нужна диверсификация.",
    },
    direct: {
        title: "Прямой трафик",
        formula: "Пользователь ввёл URL напрямую или из закладок",
        desc: "Показатель узнаваемости бренда. Чем больше direct — тем сильнее бренд.",
        links: "Высокий direct + высокий retention = лояльная аудитория.",
    },
    referral: {
        title: "Реферальный трафик",
        formula: "Переходы с других сайтов, соцсетей, рассылок",
        desc: "Виральность и партнёрства. Бесплатный канал через рекомендации.",
        links: "Реферал — самый дешёвый канал. NPS > 50 = высокий потенциал рефералов.",
    },
};

// --- Funnel interaction ---

function showFunnelInfo(el) {
    var step = el.dataset.step;
    var data = FUNNEL_DATA[step];
    if (!data) return;

    document.querySelectorAll(".funnel-step").forEach(function (s) {
        s.classList.remove("active");
    });
    el.classList.add("active");

    var html = '<div class="info-title">' + data.title + '</div>';
    html += '<div class="info-metrics">';
    data.metrics.forEach(function (m) {
        html += '<div class="info-metric"><strong>' + m.name + '</strong> — ' + m.desc + '</div>';
    });
    html += '</div>';
    html += '<div class="info-insight">' + data.insight + '</div>';

    var container = document.getElementById("funnel-info");
    container.innerHTML = html;
    container.style.display = "block";
}

// --- Tree interaction ---

function showTreeInfo(key) {
    var data = TREE_DATA[key];
    if (!data) return;

    document.querySelectorAll(".tree-node").forEach(function (n) {
        n.classList.remove("active");
    });
    var targetEl = document.querySelector('.tree-node[data-key="' + key + '"]');
    if (targetEl) targetEl.classList.add("active");

    var html = '<div class="info-title">' + data.title + '</div>';
    html += '<div class="info-formula">' + data.formula + '</div>';
    html += '<div class="info-desc">' + data.desc + '</div>';
    html += '<div class="info-links">' + data.links + '</div>';

    var container = document.getElementById("tree-info");
    container.innerHTML = html;
    container.style.display = "block";
}
