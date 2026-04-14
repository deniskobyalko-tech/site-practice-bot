// --- Funnel & Metrics Tree (interactive lecture companion) ---

var FUNNEL_DATA = {
    traffic: {
        title: "Трафик — откуда приходят",
        metrics: [
            { name: "Визиты", desc: "Сколько раз зашли на сайт. 1 человек = может быть несколько визитов." },
            { name: "Уникальные пользователи", desc: "Сколько реальных людей. Один браузер = один пользователь." },
            { name: "Источники", desc: "Откуда пришли: поиск, реклама, соцсети, прямой заход, реферал." },
        ],
        insight: "Много визитов ≠ хорошо. Важно качество: откуда пришли и что сделали.",
    },
    engagement: {
        title: "Вовлечение — что делают на сайте",
        metrics: [
            { name: "Bounce Rate", desc: "% ушедших без единого действия. > 60% — тревога." },
            { name: "Время на сайте", desc: "Среднее время сессии. Долго ≠ хорошо — может быть заблудился." },
            { name: "Глубина просмотра", desc: "Сколько страниц за визит. Для магазина 3–5 — норма." },
        ],
        insight: "Этот этап показывает, совпадает ли сайт с ожиданием пользователя.",
    },
    action: {
        title: "Целевое действие — конверсия",
        metrics: [
            { name: "CR (Conversion Rate)", desc: "% визитов, завершившихся целевым действием. E-commerce: 1–3%." },
            { name: "Количество конверсий", desc: "Заявки, покупки, звонки — то, ради чего существует сайт." },
            { name: "Средний чек / ARPU", desc: "Сколько денег приносит один пользователь / заказ." },
        ],
        insight: "Если трафик есть, а конверсий нет — проблема на сайте: CTA, оффер, форма.",
    },
    retention: {
        title: "Возврат — приходят ли снова",
        metrics: [
            { name: "Retention 30d", desc: "% вернувшихся в течение 30 дней. E-commerce: 20–35%." },
            { name: "LTV", desc: "Сколько денег клиент принесёт за всё время. LTV должен быть > стоимости привлечения." },
            { name: "Повторные покупки", desc: "Доля заказов от вернувшихся. Показатель лояльности." },
        ],
        insight: "Нет смысла лить трафик, если retention = 0. Сначала удержание, потом привлечение.",
    },
};

var TREE_DATA = {
    revenue: {
        title: "Выручка",
        formula: "Выручка = Визиты × CR × ARPU",
        desc: "Главная метрика бизнеса. Раскладывается на три множителя — упал любой из них, падает выручка.",
        links: "Чтобы понять почему упала выручка, смотри каждый множитель отдельно: визиты, конверсию, средний чек.",
    },
    visits: {
        title: "Визиты",
        formula: "Количество сессий на сайте за период",
        desc: "Сколько раз пользователи зашли на сайт. Один человек может создать несколько визитов.",
        links: "Если визиты падают — смотри источники трафика. Если растут, но выручка нет — смотри CR и Bounce Rate.",
    },
    cr: {
        title: "CR (Conversion Rate)",
        formula: "CR = целевые действия / визиты × 100%",
        desc: "Какой процент визитов завершается покупкой, заявкой или звонком.",
        links: "CR падает → смотри Bounce Rate и Время. Если пользователи уходят быстро — проблема в посадочной. Если сидят долго, но не покупают — проблема в CTA/оффере.",
    },
    arpu: {
        title: "ARPU (средний доход на пользователя)",
        formula: "ARPU = выручка / кол-во пользователей",
        desc: "Сколько денег в среднем приносит один пользователь за период.",
        links: "Низкий ARPU → подумай про upsell, cross-sell, повышение среднего чека. ARPU × Retention = LTV.",
    },
    bounce: {
        title: "Bounce Rate",
        formula: "Bounce Rate = ушли без действия / все визиты × 100%",
        desc: "Процент пользователей, которые зашли и сразу ушли, ничего не сделав.",
        links: "Высокий bounce при хорошем трафике = проблема с посадочной страницей. При плохом трафике = нецелевые посетители.",
    },
    time: {
        title: "Время на сайте",
        formula: "Среднее время сессии пользователя",
        desc: "Сколько времени проводят на сайте. Читай вместе с bounce и глубиной — само по себе не говорит ничего.",
        links: "Мало времени + высокий bounce = контент не совпадает с ожиданием. Много времени + мало конверсий = запутанная навигация.",
    },
    depth: {
        title: "Глубина просмотра",
        formula: "Среднее кол-во просмотренных страниц за визит",
        desc: "Сколько страниц смотрит пользователь за один визит. Для магазина 3–5 — норма.",
        links: "Глубина 1 = пользователь не пошёл дальше первой страницы (= bounce). Глубина 10+ = возможно, заблудился.",
    },
    retention: {
        title: "Retention 30d",
        formula: "% пользователей, вернувшихся в течение 30 дней",
        desc: "Какая доля пользователей возвращается на сайт. Показатель ценности продукта.",
        links: "Retention влияет на LTV: чем чаще возвращаются, тем больше заработаешь. Без retention привлечение = слив денег.",
    },
};

// --- Funnel interaction ---

function showFunnelInfo(el) {
    var step = el.dataset.step;
    var data = FUNNEL_DATA[step];
    if (!data) return;

    // Highlight active
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

    // Highlight active
    document.querySelectorAll(".tree-node").forEach(function (n) {
        n.classList.remove("active");
    });
    // Find and highlight the clicked node
    document.querySelectorAll(".tree-node").forEach(function (n) {
        if (n.textContent.trim() === data.title ||
            (key === "revenue" && n.textContent.trim() === "Выручка") ||
            (key === "visits" && n.textContent.trim() === "Визиты") ||
            (key === "cr" && n.textContent.trim() === "CR") ||
            (key === "arpu" && n.textContent.trim() === "ARPU") ||
            (key === "bounce" && n.textContent.trim() === "Bounce Rate") ||
            (key === "time" && n.textContent.trim() === "Время") ||
            (key === "depth" && n.textContent.trim() === "Глубина") ||
            (key === "retention" && n.textContent.trim() === "Retention")) {
            n.classList.add("active");
        }
    });

    var html = '<div class="info-title">' + data.title + '</div>';
    html += '<div class="info-formula">' + data.formula + '</div>';
    html += '<div class="info-desc">' + data.desc + '</div>';
    html += '<div class="info-links">' + data.links + '</div>';

    var container = document.getElementById("tree-info");
    container.innerHTML = html;
    container.style.display = "block";
}
