import random

QUIZ_QUESTIONS = [
    {
        "id": "q1",
        "text": "Как называется метрика, показывающая количество посещений сайта за период?",
        "options": ["Конверсия", "Сессии (визиты)", "Показы", "Охват"],
        "correct": "Сессии (визиты)",
    },
    {
        "id": "q2",
        "text": "Какая метрика показывает долю пользователей, совершивших целевое действие?",
        "options": ["CTR", "Bounce Rate", "Конверсия (CR)", "CPC"],
        "correct": "Конверсия (CR)",
    },
    {
        "id": "q3",
        "text": "Что измеряет метрика CTR (Click-Through Rate)?",
        "options": ["Стоимость клика", "Количество показов", "Отношение кликов к показам", "Время на сайте"],
        "correct": "Отношение кликов к показам",
    },
    {
        "id": "q4",
        "text": "Что показывает показатель отказов (Bounce Rate)?",
        "options": [
            "Процент вернувшихся пользователей",
            "Процент пользователей, покинувших сайт после просмотра одной страницы",
            "Процент конверсии",
            "Среднее время на сайте",
        ],
        "correct": "Процент пользователей, покинувших сайт после просмотра одной страницы",
    },
    {
        "id": "q5",
        "text": "Какая метрика показывает стоимость привлечения одного клиента?",
        "options": ["ROI", "LTV", "CPM", "CAC (Customer Acquisition Cost)"],
        "correct": "CAC (Customer Acquisition Cost)",
    },
    {
        "id": "q6",
        "text": "Что измеряет метрика CPM?",
        "options": ["Стоимость за клик", "Стоимость за конверсию", "Стоимость за 1000 показов", "Стоимость за подписчика"],
        "correct": "Стоимость за 1000 показов",
    },
    {
        "id": "q7",
        "text": "Какая метрика показывает общую ценность клиента за всё время взаимодействия с бизнесом?",
        "options": ["CAC", "ROMI", "AOV", "LTV (Lifetime Value)"],
        "correct": "LTV (Lifetime Value)",
    },
    {
        "id": "q8",
        "text": "Что показывает метрика средняя глубина просмотра?",
        "options": ["Время на одной странице", "Количество визитов", "Среднее количество страниц за одну сессию", "Процент отказов"],
        "correct": "Среднее количество страниц за одну сессию",
    },
    {
        "id": "q9",
        "text": "Какая метрика показывает возврат инвестиций в маркетинг?",
        "options": ["CTR", "CPA", "ROMI (Return on Marketing Investment)", "CPM"],
        "correct": "ROMI (Return on Marketing Investment)",
    },
    {
        "id": "q10",
        "text": "Что измеряет метрика CPA (Cost Per Action)?",
        "options": ["Стоимость за 1000 показов", "Стоимость за клик", "Доход с клиента", "Стоимость за целевое действие"],
        "correct": "Стоимость за целевое действие",
    },
]


def get_shuffled_questions() -> list[dict]:
    """Return questions with shuffled order and shuffled options. No correct answers included."""
    questions = list(QUIZ_QUESTIONS)
    random.shuffle(questions)
    result = []
    for q in questions:
        options = list(q["options"])
        random.shuffle(options)
        result.append({
            "id": q["id"],
            "text": q["text"],
            "options": options,
        })
    return result


def score_answers(answers: dict[str, str]) -> tuple[float, dict[str, dict]]:
    """Score student answers. Returns (score, details).
    Each correct answer = 0.5 points. Max = 5.0.
    details: {question_id: {text, student_answer, correct_answer, is_correct}}
    """
    score = 0.0
    details = {}
    for q in QUIZ_QUESTIONS:
        student_answer = answers.get(q["id"], "")
        is_correct = student_answer == q["correct"]
        if is_correct:
            score += 0.5
        details[q["id"]] = {
            "text": q["text"],
            "student_answer": student_answer,
            "correct_answer": q["correct"],
            "is_correct": is_correct,
        }
    return score, details
