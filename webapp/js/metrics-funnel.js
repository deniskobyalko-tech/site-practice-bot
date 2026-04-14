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
    dau: {
        title: "DAU (Daily Active Users)",
        formula: "Количество уникальных пользователей за день",
        desc: "Сколько реальных людей зашли на сайт сегодня. Один человек = один DAU, сколько бы раз ни заходил.",
        links: "DAU / MAU = Stickiness. Если DAU/MAU > 20% — продукт «липкий», пользователи возвращаются каждый день.",
    },
    mau: {
        title: "MAU (Monthly Active Users)",
        formula: "Количество уникальных пользователей за месяц",
        desc: "Размер активной аудитории. MAU растёт — продукт привлекает. MAU падает — теряешь людей.",
        links: "Сравни с DAU: если MAU большой, а DAU маленький — люди приходят, но не возвращаются.",
    },
    revenue: {
        title: "Выручка",
        formula: "Выручка = Целевые действия × ARPU",
        desc: "Итоговый результат воронки. Всё что выше в дереве — влияет на эту цифру.",
        links: "Упала выручка? Иди вверх по дереву: целевые действия в норме? CR в норме? DAU в норме? Найди этап, где ломается.",
    },
    conversions: {
        title: "Целевые действия",
        formula: "Целевые действия = DAU × CR",
        desc: "Покупки, заявки, звонки — то, ради чего существует сайт. Количество, не процент.",
        links: "Мало конверсий при хорошем DAU → проблема в CR. Мало конверсий при низком DAU → проблема в трафике.",
    },
    cr: {
        title: "CR (Conversion Rate)",
        formula: "CR = целевые действия / DAU × 100%",
        desc: "Какой процент пользователей совершает целевое действие. Главный показатель эффективности сайта.",
        links: "CR падает → смотри Bounce Rate и Время. Если уходят быстро — первый экран не работает. Если сидят долго, но не покупают — проблема в CTA/оффере.",
    },
    arpu: {
        title: "ARPU (средний доход на пользователя)",
        formula: "ARPU = выручка / кол-во пользователей",
        desc: "Сколько денег в среднем приносит один пользователь. Можно поднять upsell'ом, cross-sell'ом, повышением цен.",
        links: "ARPU × количество целевых действий = Выручка. Низкий ARPU при хорошем CR → работай над средним чеком.",
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
    var NODE_LABELS = {
        dau: "DAU", mau: "MAU", revenue: "Выручка", conversions: "Целевые действия",
        cr: "CR", arpu: "ARPU", bounce: "Bounce Rate", time: "Время",
        depth: "Глубина", retention: "Retention", visits: "Визиты",
    };
    var targetLabel = NODE_LABELS[key] || "";
    document.querySelectorAll(".tree-node").forEach(function (n) {
        if (n.textContent.trim() === targetLabel) {
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
