"""
Campaign Diagnosis Practice (Practice #2) — scenario definitions.
Mirrors metrics-channels.js but used server-side for deterministic dashboard generation.
"""
import hashlib

# 11 metrics the dashboard shows
METRICS_META = [
    {"id": "impressions", "name": "Impressions (SEO)", "unit": "", "fmt": "int"},
    {"id": "avg_position", "name": "Avg Position", "unit": "", "fmt": "float"},
    {"id": "organic_ctr", "name": "Organic CTR", "unit": "%", "fmt": "float"},
    {"id": "ppc_ctr", "name": "CTR (Контекст)", "unit": "%", "fmt": "float"},
    {"id": "avg_cpc", "name": "Avg CPC", "unit": "₽", "fmt": "int"},
    {"id": "conv_rate", "name": "Conv Rate", "unit": "%", "fmt": "float"},
    {"id": "cost_conv", "name": "Cost/Conv (CPA)", "unit": "₽", "fmt": "int"},
    {"id": "reach", "name": "Reach", "unit": "", "fmt": "int"},
    {"id": "frequency", "name": "Frequency", "unit": "", "fmt": "float"},
    {"id": "cpm", "name": "CPM", "unit": "₽", "fmt": "int"},
    {"id": "viewability", "name": "Viewability", "unit": "%", "fmt": "int"},
]

# Scenario definitions (id, title, ranges per metric)
SCENARIOS = {
    "seo_snippet": {
        "title": "SEO: показы есть, кликов нет",
        "ranges": {
            "impressions": (40000, 90000),
            "avg_position": (4, 8),
            "organic_ctr": (0.8, 2.5),
            "ppc_ctr": (4, 7),
            "avg_cpc": (40, 100),
            "conv_rate": (2, 4),
            "cost_conv": (1000, 2500),
            "reach": (100000, 300000),
            "frequency": (3.0, 4.5),
            "cpm": (400, 700),
            "viewability": (60, 75),
        },
    },
    "ppc_drain": {
        "title": "Контекст: деньги в трубу",
        "ranges": {
            "impressions": (10000, 25000),
            "avg_position": (5, 10),
            "organic_ctr": (3, 6),
            "ppc_ctr": (0.8, 2.2),
            "avg_cpc": (180, 400),
            "conv_rate": (0.3, 1.0),
            "cost_conv": (8000, 20000),
            "reach": (80000, 200000),
            "frequency": (2.5, 4.0),
            "cpm": (400, 800),
            "viewability": (50, 70),
        },
    },
    "media_fake_reach": {
        "title": "Медийка: охват есть, бренда нет",
        "ranges": {
            "impressions": (5000, 15000),
            "avg_position": (6, 12),
            "organic_ctr": (1.5, 3.5),
            "ppc_ctr": (3, 6),
            "avg_cpc": (50, 120),
            "conv_rate": (1.5, 3),
            "cost_conv": (2000, 4000),
            "reach": (800000, 1500000),
            "frequency": (1.0, 1.8),
            "cpm": (80, 180),
            "viewability": (25, 40),
        },
    },
    "audience_burned": {
        "title": "Перегретая аудитория",
        "ranges": {
            "impressions": (80000, 150000),
            "avg_position": (3, 7),
            "organic_ctr": (3, 6),
            "ppc_ctr": (1.2, 2.5),
            "avg_cpc": (150, 300),
            "conv_rate": (1.5, 3),
            "cost_conv": (4000, 9000),
            "reach": (40000, 80000),
            "frequency": (8, 14),
            "cpm": (700, 1300),
            "viewability": (55, 70),
        },
    },
    "ppc_ceiling": {
        "title": "Контекст упёрся в потолок",
        "ranges": {
            "impressions": (15000, 30000),
            "avg_position": (2, 5),
            "organic_ctr": (5, 10),
            "ppc_ctr": (6, 10),
            "avg_cpc": (150, 350),
            "conv_rate": (4, 7),
            "cost_conv": (2500, 5000),
            "reach": (100000, 250000),
            "frequency": (3, 5),
            "cpm": (500, 900),
            "viewability": (55, 75),
        },
    },
}


def _seeded_value(seed_str: str, salt: str, vmin: float, vmax: float, is_float: bool) -> float:
    """Deterministic pseudo-random value in [vmin, vmax] based on (seed, salt)."""
    h = hashlib.md5(f"{seed_str}:{salt}".encode()).hexdigest()
    frac = int(h[:8], 16) / 0xFFFFFFFF
    val = vmin + (vmax - vmin) * frac
    if is_float:
        return round(val, 1)
    return int(round(val))


def build_dashboard(scenario_type: str, student_id: int) -> dict:
    """
    Return dashboard of 11 metric values for a scenario, deterministic by student_id.
    Same student always sees the same numbers.
    """
    if scenario_type not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_type}")
    sc = SCENARIOS[scenario_type]
    seed = f"student{student_id}"
    values = {}
    for meta in METRICS_META:
        mid = meta["id"]
        vmin, vmax = sc["ranges"][mid]
        is_float = meta["fmt"] == "float"
        values[mid] = _seeded_value(seed, mid, vmin, vmax, is_float)
    return {
        "scenario_type": scenario_type,
        "title": sc["title"],
        "metrics_meta": METRICS_META,
        "values": values,
    }
