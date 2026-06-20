const state = {
  data: null,
  language: "English",
  mode: "daily",
  date: null
};

const labels = {
  English: "영어",
  Japanese: "일본어",
  Chinese: "중국어"
};

const modeLabels = {
  daily: "오늘 문장",
  issues: "세계 이슈"
};

const $ = (selector) => document.querySelector(selector);
const bootStartedAt = Date.now();

init();

async function init() {
  try {
    const response = await fetch(`data/lessons.json?updated=${Date.now()}`, { cache: "no-store" });
    state.data = await response.json();
    state.date = newestDateFor(state.language, state.mode);

    $("#todayLabel").textContent = new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "full"
    }).format(new Date());

    renderLanguageTabs();
    renderModeTabs();
    bindNav();
    bindInteractions();
    render();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  } finally {
    hideSplash();
  }
}

function renderLanguageTabs() {
  const root = $("#languageTabs");
  root.innerHTML = Object.keys(labels)
    .map((language) => tabButton(language, labels[language], state.language === language))
    .join("");
  root.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.language = button.dataset.value;
      state.date = newestDateFor(state.language, state.mode);
      animateContentRefresh();
      render();
    });
  });
}

function renderModeTabs() {
  const root = $("#modeTabs");
  root.innerHTML = Object.entries(modeLabels)
    .map(([mode, label]) => tabButton(mode, label, state.mode === mode))
    .join("");
  root.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.value;
      state.date = newestDateFor(state.language, state.mode);
      animateContentRefresh();
      render();
    });
  });
}

function bindNav() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === "review") {
        showReview();
        return;
      }
      state.mode = button.dataset.mode;
      state.date = newestDateFor(state.language, state.mode);
      animateContentRefresh();
      render();
    });
  });

  $("#randomCardButton").addEventListener("click", () => {
    const lesson = activeLesson();
    const cards = state.mode === "daily" ? lesson?.sentences : lesson?.issueCards;
    if (!cards?.length) return;
    const card = cards[Math.floor(Math.random() * cards.length)];
    $("#practiceLine").textContent = card.original || card.title;
    $("#practiceLine").classList.remove("pulse");
    requestAnimationFrame(() => $("#practiceLine").classList.add("pulse"));
    window.scrollTo({ top: document.querySelector(".content-grid").offsetTop - 12, behavior: "smooth" });
  });

  $("#dateRail").addEventListener("click", (event) => {
    const button = event.target.closest(".date-chip");
    if (!button || button.disabled) return;
    state.date = button.dataset.date;
    animateContentRefresh();
    render();
  });

  $("#prevMonthButton").addEventListener("click", () => moveMonth(-1));
  $("#nextMonthButton").addEventListener("click", () => moveMonth(1));
}

function bindInteractions() {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("button, .lesson-card, .expression-item, select");
    if (!target) return;
    target.classList.add("is-pressing");
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      const target = event.target.closest("button, .lesson-card, .expression-item, select");
      if (!target) return;
      target.classList.remove("is-pressing");
    });
  });

  $("#cardList").addEventListener("click", (event) => {
    const cardElement = event.target.closest(".lesson-card");
    if (!cardElement || cardElement.classList.contains("review-card")) return;
    const title = cardElement.querySelector("h3")?.textContent?.trim();
    if (!title) return;
    $("#practiceLine").textContent = title;
    $("#practiceLine").classList.remove("pulse");
    cardElement.classList.remove("card-picked");
    requestAnimationFrame(() => {
      $("#practiceLine").classList.add("pulse");
      cardElement.classList.add("card-picked");
    });
  });
}

function render() {
  renderLanguageTabs();
  renderModeTabs();
  updateBottomNav();
  renderDates();
  renderStats();
  renderContent();
}

function renderDates() {
  const dates = lessonsFor(state.language, state.mode).map((lesson) => lesson.date).sort();
  const available = new Set(dates);
  const activeDate = state.date || dates.at(-1);
  const activeMonth = monthKey(activeDate || dates.at(-1) || new Date().toISOString().slice(0, 10));
  const monthDates = datesForMonth(activeMonth);
  const months = availableMonths();
  const monthIndex = months.indexOf(activeMonth);

  $("#monthLabel").textContent = formatMonthLabel(activeMonth);
  $("#prevMonthButton").disabled = monthIndex <= 0;
  $("#nextMonthButton").disabled = monthIndex === -1 || monthIndex >= months.length - 1;
  $("#dateRail").innerHTML = monthDates
    .map((date) => dateChip(date, available.has(date), date === activeDate))
    .join("");

  requestAnimationFrame(() => {
    $("#dateRail .date-chip.active")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });
}

function renderStats() {
  const daily = lessonsFor(state.language, "daily");
  const issues = lessonsFor(state.language, "issues");
  const sentenceCount = daily.reduce((sum, lesson) => sum + lesson.sentences.length, 0);
  const expressionCount = daily.reduce((sum, lesson) => sum + lesson.expressions.length, 0)
    + issues.reduce((sum, lesson) => sum + lesson.expressions.length, 0);

  $("#stats").innerHTML = [
    ["언어", labels[state.language]],
    ["문장", sentenceCount],
    ["이슈", issues.length],
    ["표현", expressionCount]
  ]
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderContent() {
  const lesson = activeLesson();
  const isDaily = state.mode === "daily";
  $("#activeTypeLabel").textContent = isDaily ? "Sentences" : "World Issue";
  $("#activeTitle").textContent = `${labels[state.language]} ${isDaily ? "문장 카드" : "이슈 카드"}`;
  $("#heroTitle").textContent = `${labels[state.language]} ${isDaily ? "오늘 문장을" : "세계 이슈를"} 꺼내볼까요?`;
  $("#heroCopy").textContent = isDaily
    ? "바로 말할 수 있는 문장과 고난이도 표현을 가볍게 반복해요."
    : "뉴스 맥락을 언어 표현으로 바꿔서 생각하는 힘을 키워요.";

  if (!lesson) {
    $("#cardList").innerHTML = `<div class="empty">아직 표시할 카드가 없어요.</div>`;
    $("#expressionList").innerHTML = "";
    $("#practiceLine").textContent = "자료가 추가되면 여기에 연습 문장이 나타나요.";
    return;
  }

  const cards = isDaily ? lesson.sentences : lesson.issueCards;
  $("#cardList").innerHTML = cards.length
    ? cards.map((card) => lessonCard(card, isDaily)).join("")
    : `<div class="empty">이 날짜에는 카드가 비어 있어요.</div>`;

  const expressions = lesson.expressions.slice(0, 8);
  $("#expressionList").innerHTML = expressions.length
    ? expressions.map(expressionItem).join("")
    : `<div class="empty">표현이 아직 없어요.</div>`;

  $("#practiceLine").textContent = lesson.practice || cards[0]?.original || cards[0]?.title || "오늘 배운 표현을 한 문장으로 말해보세요.";
}

function showReview() {
  animateContentRefresh();
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === "review");
  });

  const allLessons = [
    ...lessonsFor(state.language, "daily").map((lesson) => ({ ...lesson, kind: "문장" })),
    ...lessonsFor(state.language, "issues").map((lesson) => ({ ...lesson, kind: "이슈" }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  $("#activeTypeLabel").textContent = "Review";
  $("#activeTitle").textContent = `${labels[state.language]} 복습 리스트`;
  $("#heroTitle").textContent = "차곡차곡 쌓인 학습 기록";
  $("#heroCopy").textContent = "최근 날짜부터 문장과 이슈를 다시 열어보며 짧게 복습해요.";
  $("#monthLabel").textContent = "복습";
  $("#prevMonthButton").disabled = true;
  $("#nextMonthButton").disabled = true;
  $("#dateRail").innerHTML = "";
  $("#stats").innerHTML = [
    ["언어", labels[state.language]],
    ["기록", allLessons.length],
    ["최근", allLessons[0]?.date || "-"],
    ["모드", "복습"]
  ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");

  $("#cardList").innerHTML = allLessons.map((lesson) => `
    <button class="lesson-card review-card" type="button" data-kind="${lesson.kind}" data-date="${lesson.date}">
      <h3>${lesson.kind} · ${lesson.date}</h3>
      <p class="translation">${escapeHtml(lesson.title)}</p>
    </button>
  `).join("");

  document.querySelectorAll(".review-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.mode = card.dataset.kind === "문장" ? "daily" : "issues";
      state.date = card.dataset.date;
      render();
    });
  });
}

function animateContentRefresh() {
  const targets = [$("#cardList"), $("#stats"), $(".side-panel")].filter(Boolean);
  targets.forEach((target) => {
    target.classList.remove("content-refresh");
    requestAnimationFrame(() => target.classList.add("content-refresh"));
  });
}

function hideSplash() {
  const splash = $("#splash");
  if (!splash) return;
  const remaining = Math.max(0, 720 - (Date.now() - bootStartedAt));
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => splash.remove(), 520);
  }, remaining);
}

function lessonCard(card, isDaily) {
  const title = escapeHtml(card.original || card.title);
  const reading = escapeHtml(card.reading || "");
  const translation = escapeHtml(card.korean || card.translation || "");
  const chips = (card.expressions || []).slice(0, 4).map((item) => `<span class="chip">${escapeHtml(item.term)}</span>`).join("");
  return `
    <article class="lesson-card">
      ${reading ? `<p class="reading-line">${reading}</p>` : ""}
      <h3>${title}</h3>
      ${translation ? `<p class="translation">${translation}</p>` : ""}
      <div class="chips">${chips}</div>
    </article>
  `;
}

function expressionItem(item) {
  const reading = escapeHtml(item.reading || "");
  const meaning = escapeHtml(item.meaning || item.note || "");
  const note = escapeHtml(item.note || "");
  return `
    <div class="expression-item">
      <strong>${escapeHtml(item.term)}</strong>
      ${reading ? `<em>${reading}</em>` : ""}
      ${meaning ? `<span>${meaning}</span>` : ""}
      ${note && note !== meaning ? `<small>${note}</small>` : ""}
    </div>
  `;
}

function tabButton(value, label, active) {
  return `<button type="button" data-value="${escapeHtml(value)}" class="${active ? "active" : ""}">${escapeHtml(label)}</button>`;
}

function dateChip(date, available, active) {
  const day = Number(date.slice(8, 10));
  return `
    <button
      class="date-chip${active ? " active" : ""}"
      type="button"
      data-date="${escapeHtml(date)}"
      ${available ? "" : "disabled"}
      aria-label="${escapeHtml(formatDateLabel(date))}"
    >
      <span>${day}</span>
    </button>
  `;
}

function updateBottomNav() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
}

function lessonsFor(language, mode) {
  return state.data?.[mode]?.[language] || [];
}

function newestDateFor(language, mode) {
  return lessonsFor(language, mode).map((lesson) => lesson.date).sort().pop() || null;
}

function activeLesson() {
  return lessonsFor(state.language, state.mode).find((lesson) => lesson.date === state.date);
}

function moveMonth(offset) {
  const dates = lessonsFor(state.language, state.mode).map((lesson) => lesson.date).sort();
  const months = availableMonths();
  const activeMonth = monthKey(state.date || dates.at(-1) || new Date().toISOString().slice(0, 10));
  const nextMonth = months[months.indexOf(activeMonth) + offset];
  if (!nextMonth) return;
  const nextDates = dates.filter((date) => monthKey(date) === nextMonth);
  state.date = offset > 0 ? nextDates[0] : nextDates.at(-1);
  animateContentRefresh();
  render();
}

function availableMonths() {
  return [...new Set(lessonsFor(state.language, state.mode).map((lesson) => monthKey(lesson.date)))].sort();
}

function datesForMonth(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => `${year}-${pad2(month)}-${pad2(index + 1)}`);
}

function monthKey(dateString) {
  return dateString.slice(0, 7);
}

function formatMonthLabel(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function formatDateLabel(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
