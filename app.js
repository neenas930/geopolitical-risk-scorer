const CLAUDE_KEY = "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";
const NEWS_KEY = "8d8db3f83b3343a1aa36b17cb296a4a4";

const DIMENSION_INFO = {
  s1: {
    title: "Political Stability",
    description: "Measures the risk of government instability, democratic backsliding, coups, or leadership crises. Scored from news about elections, opposition crackdowns, institutional conflicts, and geopolitical tensions."
  },
  s2: {
    title: "Sanctions Risk",
    description: "Measures exposure to US, EU, or UN sanctions. Scored from news about diplomatic deterioration, alignment with sanctioned states, OFAC advisories, and secondary sanctions risk for banks and corporates."
  },
  s3: {
    title: "Currency Risk",
    description: "Measures FX depreciation pressure, inflation, and balance of payments stress. Currency and debt receive 1.2x weight in the overall score as they are most directly relevant to capital markets."
  },
  s4: {
    title: "Debt Sustainability",
    description: "Measures sovereign debt stress including IMF program risk, credit rating changes, external refinancing needs, fiscal deficits, and bond spread movements. Weighted 1.2x in the overall score."
  },
  s5: {
    title: "Social Unrest",
    description: "Measures civil instability including protests, strikes, cost-of-living driven unrest, and inequality indicators. Often a leading indicator for political and currency deterioration."
  }
};

const NewsAPI = {
  async fetchHeadlines(country) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(country)}+economy+politics+currency&sortBy=publishedAt&pageSize=20&language=en&apiKey=${NEWS_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("NewsAPI request failed");
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message || "NewsAPI error");
    return data.articles;
  },
};

const ClaudeAPI = {
  async analyzeRisk(country, articles) {
    const headlines = articles
      .map((a, i) => `${i + 1}. ${a.title} (${a.source.name})`)
      .join("\n");

    const prompt = `You are a geopolitical risk analyst. Based on the following recent news headlines about ${country}, score the country across 5 risk dimensions on a scale of 1-10 where 1 = very low risk and 10 = very high risk.

NEWS HEADLINES:
${headlines}

Respond ONLY with a valid JSON object in exactly this format, no other text:
{
  "political_stability": { "score": 0.0, "change": "+0.0", "direction": "up", "explanation": "one sentence" },
  "sanctions_risk": { "score": 0.0, "change": "+0.0", "direction": "stable", "explanation": "one sentence" },
  "currency_risk": { "score": 0.0, "change": "+0.0", "direction": "up", "explanation": "one sentence" },
  "debt_sustainability": { "score": 0.0, "change": "+0.0", "direction": "down", "explanation": "one sentence" },
  "social_unrest": { "score": 0.0, "change": "+0.0", "direction": "stable", "explanation": "one sentence" },
  "overall_summary": "2-3 sentence plain English summary of the country risk profile for a finance professional.",
  "article_count": 0
}

Rules:
- direction must be one of: "up", "down", "stable"
- change should reflect estimated month-over-month movement e.g. "+0.4" or "-0.2"
- article_count is the number of headlines you used
- Be grounded in the headlines provided, do not invent facts`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error("Claude API request failed");
    const data = await response.json();
    const text = data.content[0].text.trim();
    return JSON.parse(text);
  },
};

const UI = {
  getColorClass(score) {
    if (score >= 7) return "red";
    if (score >= 4.5) return "amber";
    return "green";
  },

  getBarClass(score) {
    if (score >= 7) return "bar-red";
    if (score >= 4.5) return "bar-amber";
    return "bar-green";
  },

  getRiskLabel(score) {
    if (score >= 8) return "Very High Risk";
    if (score >= 6.5) return "High Risk";
    if (score >= 4.5) return "Moderate Risk";
    if (score >= 2.5) return "Low Risk";
    return "Very Low Risk";
  },

  getChangeText(direction, change) {
    if (direction === "up") return `↑ ${change} vs last month`;
    if (direction === "down") return `↓ ${change} vs last month`;
    return "→ Stable";
  },

  getNewsTag(headline) {
    const h = headline.toLowerCase();
    if (h.includes("sanction") || h.includes("tariff") || h.includes("ban"))
      return ["tag-amber", "Sanctions"];
    if (h.includes("currenc") || h.includes("inflation") || h.includes("lira") || h.includes("peso") || h.includes("exchange"))
      return ["tag-red", "Currency"];
    if (h.includes("debt") || h.includes("imf") || h.includes("bond") || h.includes("deficit") || h.includes("credit"))
      return ["tag-blue", "Debt"];
    if (h.includes("protest") || h.includes("unrest") || h.includes("strike") || h.includes("riot"))
      return ["tag-red", "Social"];
    if (h.includes("election") || h.includes("president") || h.includes("government") || h.includes("minister") || h.includes("parliament"))
      return ["tag-blue", "Political"];
    return ["tag-green", "General"];
  },

  getCountryCode(country) {
    const codes = {
      turkey: "TR", brazil: "BR", egypt: "EG", germany: "DE",
      france: "FR", china: "CN", india: "IN", russia: "RU",
      argentina: "AR", nigeria: "NG", pakistan: "PK", ukraine: "UA",
      mexico: "MX", indonesia: "ID", venezuela: "VE", ethiopia: "ET",
      kenya: "KE", ghana: "GH", thailand: "TH", vietnam: "VN",
      "united states": "US", japan: "JP", "south korea": "KR",
      italy: "IT", spain: "ES", portugal: "PT", greece: "GR",
    };
    return codes[country.toLowerCase()] || country.slice(0, 2).toUpperCase();
  },

  timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  },

  showLoading(country) {
    document.getElementById("loadingText").textContent =
      `Fetching live news and analyzing ${country}...`;
    document.getElementById("loading").style.display = "flex";
    document.getElementById("results").style.display = "none";
    document.getElementById("error").style.display = "none";
  },

  showError(message) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("errorMessage").textContent = message;
    document.getElementById("error").style.display = "block";
  },

  setupTooltips() {
    const tooltip = document.getElementById("tooltip");

    Object.keys(DIMENSION_INFO).forEach((id) => {
      const card = document.getElementById("card-" + id);
      if (!card) return;
      const info = DIMENSION_INFO[id];

      card.addEventListener("mouseenter", (e) => {
        tooltip.querySelector(".tooltip-title").textContent = info.title;
        tooltip.querySelector(".tooltip-body").textContent = info.description;
        tooltip.style.display = "block";
        UI.positionTooltip(e, tooltip);
      });

      card.addEventListener("mousemove", (e) => {
        UI.positionTooltip(e, tooltip);
      });

      card.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    });
  },

  positionTooltip(e, tooltip) {
    const offset = 16;
    let x = e.clientX + offset;
    let y = e.clientY + offset;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (x + tw > window.innerWidth - 16) x = e.clientX - tw - offset;
    if (y + th > window.innerHeight - 16) y = e.clientY - th - offset;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  },

  renderResults(country, scores, articles) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("results").style.display = "block";

    const overall = (
      (scores.political_stability.score +
        scores.sanctions_risk.score +
        scores.currency_risk.score * 1.2 +
        scores.debt_sustainability.score * 1.2 +
        scores.social_unrest.score) / 5.4
    ).toFixed(1);

    document.getElementById("badge").textContent = UI.getCountryCode(country);
    document.getElementById("countryName").textContent =
      country.charAt(0).toUpperCase() + country.slice(1);
    document.getElementById("countryMeta").textContent =
      `Based on ${scores.article_count} news articles · ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

    const oc = UI.getColorClass(parseFloat(overall));
    document.getElementById("overallScore").textContent = overall;
    document.getElementById("overallScore").className = "overall-num " + oc;
    document.getElementById("overallDesc").textContent = UI.getRiskLabel(parseFloat(overall));
    document.getElementById("overallDesc").className = "overall-desc " + oc;

    const dimensions = [
      ["s1", "b1", "c1", "e1", scores.political_stability],
      ["s2", "b2", "c2", "e2", scores.sanctions_risk],
      ["s3", "b3", "c3", "e3", scores.currency_risk],
      ["s4", "b4", "c4", "e4", scores.debt_sustainability],
      ["s5", "b5", "c5", "e5", scores.social_unrest],
    ];

    dimensions.forEach(([sid, bid, cid, eid, dim]) => {
      const sc = UI.getColorClass(dim.score);
      document.getElementById(sid).textContent = dim.score.toFixed(1);
      document.getElementById(sid).className = "score-num " + sc;
      document.getElementById(bid).style.width = (dim.score * 10) + "%";
      document.getElementById(bid).className = "score-bar " + UI.getBarClass(dim.score);
      document.getElementById(cid).textContent = UI.getChangeText(dim.direction, dim.change);
      document.getElementById(cid).className = "score-change " + sc;
      document.getElementById(eid).textContent = dim.explanation;
    });

    document.getElementById("summary").textContent = scores.overall_summary;

    const newsHtml = articles.slice(0, 5).map((a) => {
      const [tagClass, tagLabel] = UI.getNewsTag(a.title);
      return `
        <div class="news-item">
          <span class="news-tag ${tagClass}">${tagLabel}</span>
          <div>
            <div class="news-text">${a.title}</div>
            <div class="news-source">${a.source.name} · ${UI.timeAgo(a.publishedAt)}</div>
          </div>
        </div>`;
    }).join("");

    document.getElementById("newsItems").innerHTML = newsHtml;
    document.getElementById("lastUpdated").textContent =
      `Last updated: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} EST`;

    UI.setupTooltips();
  },
};

async function analyzeCountry() {
  const country = document.getElementById("countryInput").value.trim();
  if (!country) return;

  UI.showLoading(country);

  try {
    const articles = await NewsAPI.fetchHeadlines(country);
    if (!articles || articles.length === 0) {
      throw new Error(`No news found for "${country}". Try a different country name.`);
    }
    const scores = await ClaudeAPI.analyzeRisk(country, articles);
    UI.renderResults(country, scores, articles);
  } catch (err) {
    UI.showError(err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("countryInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") analyzeCountry();
  });
});