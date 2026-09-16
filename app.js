"use strict";

const STORAGE_KEY = "pystudy-progress-v1";
const THEME_KEY = "pystudy-theme-v1";

const difficultyLabels = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用"
};

const state = {
  questions: [],
  sessionQuestions: [],
  currentIndex: 0,
  selectedIndex: null,
  sessionAnswers: {},
  sessionRecorded: new Set(),
  sessionScore: 0,
  resultFilter: null,
  progress: loadProgress()
};

const elements = {};

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  cacheElements();
  applySavedTheme();
  bindEvents();

  try {
    const response = await fetch("questions.json");

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    state.questions = await response.json();

    validateQuestions(state.questions);
    buildCategoryFilters();
    updateDashboard();
    updateAvailableCount();
  } catch (error) {
    console.error(error);

    elements.setupMessage.textContent =
      "questions.jsonを読み込めませんでした。ローカルサーバーから開いてください。";

    elements.startButton.disabled = true;
  }
}

function cacheElements() {
  const ids = [
    "homeView",
    "quizView",
    "resultView",
    "homeButton",
    "themeButton",
    "themeIcon",
    "totalAnsweredStat",
    "accuracyStat",
    "streakStat",
    "weakStat",
    "availableCount",
    "categoryFilters",
    "selectAllCategoriesButton",
    "difficultySelect",
    "questionCountSelect",
    "startButton",
    "setupMessage",
    "resetDataButton",
    "quizScoreText",
    "progressText",
    "progressBar",
    "quitButton",
    "questionCard",
    "questionCategory",
    "questionDifficulty",
    "favoriteButton",
    "questionNumber",
    "questionText",
    "questionCode",
    "optionsContainer",
    "checkButton",
    "showAnswerButton",
    "explanationPanel",
    "resultHeading",
    "resultIcon",
    "resultLabel",
    "resultTitle",
    "correctAnswerText",
    "explanationText",
    "memoryTipBox",
    "memoryTipText",
    "previousButton",
    "nextButton",
    "resultRing",
    "finalAccuracy",
    "finalTitle",
    "finalMessage",
    "finalCorrect",
    "finalWrong",
    "finalRevealed",
    "retryWrongButton",
    "returnHomeButton",
    "toast",
    "confirmDialog"
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.homeButton.addEventListener("click", returnHome);
  elements.themeButton.addEventListener("click", toggleTheme);
  elements.startButton.addEventListener("click", startQuiz);
  elements.quitButton.addEventListener("click", returnHome);
  elements.previousButton.addEventListener("click", previousQuestion);
  elements.nextButton.addEventListener("click", nextQuestion);
  elements.checkButton.addEventListener("click", checkAnswer);
  elements.showAnswerButton.addEventListener("click", showAnswer);
  elements.favoriteButton.addEventListener("click", toggleFavorite);
  elements.returnHomeButton.addEventListener("click", returnHome);
  elements.retryWrongButton.addEventListener("click", retryWrongQuestions);
  elements.resetDataButton.addEventListener("click", openResetDialog);

  elements.selectAllCategoriesButton.addEventListener(
    "click",
    toggleAllCategories
  );

  elements.difficultySelect.addEventListener(
    "change",
    updateAvailableCount
  );

  elements.questionCountSelect.addEventListener(
    "change",
    updateAvailableCount
  );

  document.querySelectorAll('input[name="quizMode"]').forEach((radio) => {
    radio.addEventListener("change", updateAvailableCount);
  });

  elements.confirmDialog.addEventListener("close", () => {
    if (elements.confirmDialog.returnValue === "confirm") {
      resetProgress();
    }
  });

  document.addEventListener("keydown", handleKeyboard);
}

function validateQuestions(questions) {
  if (!Array.isArray(questions)) {
    throw new Error("questions.jsonの形式が正しくありません。");
  }

  questions.forEach((question) => {
    const required = [
      "id",
      "category",
      "difficulty",
      "question",
      "options",
      "answer",
      "explanation"
    ];

    required.forEach((key) => {
      if (!(key in question)) {
        throw new Error(`問題 ${question.id ?? "不明"} に ${key} がありません。`);
      }
    });

    if (
      !Array.isArray(question.options) ||
      question.answer < 0 ||
      question.answer >= question.options.length
    ) {
      throw new Error(`問題 ${question.id} の選択肢または正解番号が不正です。`);
    }
  });
}

function buildCategoryFilters() {
  const categories = [
    ...new Set(state.questions.map((question) => question.category))
  ];

  elements.categoryFilters.innerHTML = "";

  categories.forEach((category) => {
    const label = document.createElement("label");
    label.className = "category-filter";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = category;
    input.checked = true;
    input.addEventListener("change", updateAvailableCount);

    const span = document.createElement("span");
    span.textContent = category;

    label.append(input, span);
    elements.categoryFilters.append(label);
  });
}

function getSelectedCategories() {
  return [
    ...elements.categoryFilters.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ].map((input) => input.value);
}

function getSelectedMode() {
  return document.querySelector(
    'input[name="quizMode"]:checked'
  ).value;
}

function getFilteredQuestions() {
  const categories = getSelectedCategories();
  const difficulty = elements.difficultySelect.value;
  const mode = getSelectedMode();

  return state.questions.filter((question) => {
    const categoryMatch = categories.includes(question.category);

    const difficultyMatch =
      difficulty === "all" ||
      question.difficulty === difficulty;

    const record = state.progress.questionStats[question.id] ?? {
      correct: 0,
      wrong: 0
    };

    let modeMatch = true;

    if (mode === "weak") {
      modeMatch =
        record.wrong > 0 &&
        record.wrong >= record.correct;
    }

    if (mode === "favorite") {
      modeMatch = state.progress.favorites.includes(question.id);
    }

    return categoryMatch && difficultyMatch && modeMatch;
  });
}

function updateAvailableCount() {
  if (!state.questions.length) {
    return;
  }

  const filtered = getFilteredQuestions();

  elements.availableCount.textContent = `${filtered.length}問`;
  elements.setupMessage.textContent = "";

  if (filtered.length === 0) {
    const mode = getSelectedMode();

    if (mode === "weak") {
      elements.setupMessage.textContent =
        "条件に一致する苦手問題がまだありません。";
    } else if (mode === "favorite") {
      elements.setupMessage.textContent =
        "条件に一致するお気に入り問題がありません。";
    } else {
      elements.setupMessage.textContent =
        "条件に一致する問題がありません。";
    }
  }
}

function toggleAllCategories() {
  const checkboxes = [
    ...elements.categoryFilters.querySelectorAll(
      'input[type="checkbox"]'
    )
  ];

  const allSelected = checkboxes.every((checkbox) => checkbox.checked);

  checkboxes.forEach((checkbox) => {
    checkbox.checked = !allSelected;
  });

  elements.selectAllCategoriesButton.textContent =
    allSelected ? "すべて選択" : "すべて解除";

  updateAvailableCount();
}

function startQuiz() {
  let questions = getFilteredQuestions();

  if (questions.length === 0) {
    showToast("出題できる問題がありません");
    return;
  }

  const mode = getSelectedMode();
  const countValue = elements.questionCountSelect.value;

  if (mode === "random" || mode === "weak") {
    questions = shuffleArray([...questions]);
  } else {
    questions = [...questions];
  }

  if (countValue !== "all") {
    questions = questions.slice(0, Number(countValue));
  }

  beginSession(questions);
}

function beginSession(questions) {
  state.sessionQuestions = questions;
  state.currentIndex = 0;
  state.selectedIndex = null;
  state.sessionAnswers = {};
  state.sessionRecorded = new Set();
  state.sessionScore = 0;

  showView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const question = getCurrentQuestion();

  if (!question) {
    showResults();
    return;
  }

  state.selectedIndex =
    state.sessionAnswers[question.id]?.selectedIndex ?? null;

  const answerState = state.sessionAnswers[question.id] ?? null;

  elements.questionCategory.textContent = question.category;
  elements.questionDifficulty.textContent =
    difficultyLabels[question.difficulty];

  elements.questionDifficulty.classList.toggle(
    "advanced",
    question.difficulty === "advanced"
  );

  elements.questionNumber.textContent =
    `QUESTION ${String(state.currentIndex + 1).padStart(2, "0")}`;

  elements.questionText.textContent = question.question;

  if (question.code) {
    elements.questionCode.classList.remove("hidden");
    elements.questionCode.querySelector("code").textContent = question.code;
  } else {
    elements.questionCode.classList.add("hidden");
    elements.questionCode.querySelector("code").textContent = "";
  }

  updateFavoriteButton(question.id);
  renderOptions(question, answerState);
  renderExplanation(question, answerState);
  updateQuizProgress();

  elements.previousButton.disabled = state.currentIndex === 0;

  elements.nextButton.textContent =
    state.currentIndex === state.sessionQuestions.length - 1
      ? "結果を見る →"
      : "次の問題 →";

  elements.checkButton.disabled = state.selectedIndex === null;

  restartCardAnimation();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderOptions(question, answerState) {
  elements.optionsContainer.innerHTML = "";

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.dataset.index = String(index);
    button.setAttribute("role", "radio");
    button.setAttribute(
      "aria-checked",
      String(state.selectedIndex === index)
    );

    if (state.selectedIndex === index) {
      button.classList.add("selected");
    }

    if (answerState?.revealed) {
      if (index === question.answer) {
        button.classList.add("correct");
      }

      if (
        answerState.status === "wrong" &&
        index === answerState.selectedIndex
      ) {
        button.classList.add("wrong");
      }
    }

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");
    text.className = "option-text";
    text.textContent = option;

    button.append(letter, text);

    button.addEventListener("click", () => {
      selectOption(index);
    });

    elements.optionsContainer.append(button);
  });
}

function selectOption(index) {
  const question = getCurrentQuestion();

  state.selectedIndex = index;

  const oldState = state.sessionAnswers[question.id];

  if (oldState?.revealed) {
    state.sessionAnswers[question.id] = {
      ...oldState,
      selectedIndex: index,
      status: null,
      revealed: false,
      revealOnly: false
    };
  } else {
    state.sessionAnswers[question.id] = {
      selectedIndex: index,
      status: null,
      revealed: false,
      revealOnly: false
    };
  }

  elements.checkButton.disabled = false;
  renderOptions(question, state.sessionAnswers[question.id]);
  renderExplanation(question, state.sessionAnswers[question.id]);
}

function checkAnswer() {
  const question = getCurrentQuestion();

  if (state.selectedIndex === null) {
    showToast("選択肢を選んでください");
    return;
  }

  const isCorrect = state.selectedIndex === question.answer;

  state.sessionAnswers[question.id] = {
    selectedIndex: state.selectedIndex,
    status: isCorrect ? "correct" : "wrong",
    revealed: true,
    revealOnly: false
  };

  if (!state.sessionRecorded.has(question.id)) {
    recordAnswer(question.id, isCorrect);
    state.sessionRecorded.add(question.id);

    if (isCorrect) {
      state.sessionScore += 1;
    }
  }

  renderOptions(question, state.sessionAnswers[question.id]);
  renderExplanation(question, state.sessionAnswers[question.id]);
  updateQuizProgress();

  requestAnimationFrame(() => {
    elements.explanationPanel.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  });
}

function showAnswer() {
  const question = getCurrentQuestion();

  state.sessionAnswers[question.id] = {
    selectedIndex: state.selectedIndex,
    status: "revealed",
    revealed: true,
    revealOnly: true
  };

  renderOptions(question, state.sessionAnswers[question.id]);
  renderExplanation(question, state.sessionAnswers[question.id]);

  requestAnimationFrame(() => {
    elements.explanationPanel.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  });
}

function renderExplanation(question, answerState) {
  if (!answerState?.revealed) {
    elements.explanationPanel.classList.add("hidden");
    return;
  }

  elements.explanationPanel.classList.remove("hidden");

  elements.resultHeading.classList.remove(
    "correct",
    "wrong",
    "reveal"
  );

  if (answerState.status === "correct") {
    elements.resultHeading.classList.add("correct");
    elements.resultIcon.textContent = "✓";
    elements.resultLabel.textContent = "CORRECT";
    elements.resultTitle.textContent = "正解です！";
  } else if (answerState.status === "wrong") {
    elements.resultHeading.classList.add("wrong");
    elements.resultIcon.textContent = "×";
    elements.resultLabel.textContent = "RETRY";
    elements.resultTitle.textContent = "惜しい！もう一度確認";
  } else {
    elements.resultHeading.classList.add("reveal");
    elements.resultIcon.textContent = "!";
    elements.resultLabel.textContent = "ANSWER";
    elements.resultTitle.textContent = "答えを確認しましょう";
  }

  elements.correctAnswerText.textContent =
    question.options[question.answer];

  elements.explanationText.textContent = question.explanation;

  if (question.memoryTip) {
    elements.memoryTipBox.classList.remove("hidden");
    elements.memoryTipText.textContent = question.memoryTip;
  } else {
    elements.memoryTipBox.classList.add("hidden");
    elements.memoryTipText.textContent = "";
  }
}

function updateQuizProgress() {
  const total = state.sessionQuestions.length;
  const current = state.currentIndex + 1;
  const percent = total > 0 ? (current / total) * 100 : 0;

  elements.progressText.textContent = `${current} / ${total}`;
  elements.progressBar.style.width = `${percent}%`;
  elements.quizScoreText.textContent = `正解 ${state.sessionScore}`;
}

function nextQuestion() {
  if (state.currentIndex >= state.sessionQuestions.length - 1) {
    showResults();
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
}

function previousQuestion() {
  if (state.currentIndex <= 0) {
    return;
  }

  state.currentIndex -= 1;
  renderQuestion();
}

function getCurrentQuestion() {
  return state.sessionQuestions[state.currentIndex];
}

function recordAnswer(questionId, isCorrect) {
  const record = state.progress.questionStats[questionId] ?? {
    correct: 0,
    wrong: 0
  };

  state.progress.totalAnswered += 1;

  if (isCorrect) {
    state.progress.totalCorrect += 1;
    state.progress.currentStreak += 1;
    state.progress.bestStreak = Math.max(
      state.progress.bestStreak,
      state.progress.currentStreak
    );

    record.correct += 1;
  } else {
    state.progress.currentStreak = 0;
    record.wrong += 1;
  }

  state.progress.questionStats[questionId] = record;
  saveProgress();
  updateDashboard();
}

function toggleFavorite() {
  const question = getCurrentQuestion();
  const favorites = state.progress.favorites;
  const index = favorites.indexOf(question.id);

  if (index >= 0) {
    favorites.splice(index, 1);
    showToast("お気に入りから削除しました");
  } else {
    favorites.push(question.id);
    showToast("お気に入りに追加しました");
  }

  saveProgress();
  updateFavoriteButton(question.id);
  updateAvailableCount();
}

function updateFavoriteButton(questionId) {
  const isFavorite = state.progress.favorites.includes(questionId);

  elements.favoriteButton.classList.toggle("active", isFavorite);
  elements.favoriteButton.textContent = isFavorite ? "★" : "☆";
  elements.favoriteButton.setAttribute(
    "aria-label",
    isFavorite
      ? "お気に入りから削除"
      : "お気に入りに追加"
  );
}

function showResults() {
  const answerValues = Object.values(state.sessionAnswers);

  const correct = answerValues.filter(
    (answer) => answer.status === "correct"
  ).length;

  const wrong = answerValues.filter(
    (answer) => answer.status === "wrong"
  ).length;

  const revealed = answerValues.filter(
    (answer) => answer.revealOnly
  ).length;

  const judged = correct + wrong;
  const accuracy = judged === 0
    ? 0
    : Math.round((correct / judged) * 100);

  elements.finalAccuracy.textContent = `${accuracy}%`;
  elements.finalCorrect.textContent = String(correct);
  elements.finalWrong.textContent = String(wrong);
  elements.finalRevealed.textContent = String(revealed);
  elements.resultRing.style.setProperty(
    "--score-angle",
    `${accuracy}%`
  );

  if (accuracy >= 90) {
    elements.finalTitle.textContent = "すばらしい仕上がり！";
    elements.finalMessage.textContent =
      "かなり定着しています。応用問題や苦手分野も確認しておきましょう。";
  } else if (accuracy >= 70) {
    elements.finalTitle.textContent = "合格圏が見えてきました！";
    elements.finalMessage.textContent =
      "間違えた問題を復習すれば、さらに安定した得点が狙えます。";
  } else if (accuracy >= 50) {
    elements.finalTitle.textContent = "ここから伸ばせます！";
    elements.finalMessage.textContent =
      "解説を読み直し、苦手復習モードでもう一度挑戦しましょう。";
  } else {
    elements.finalTitle.textContent = "まずは用語から確認！";
    elements.finalMessage.textContent =
      "焦らず、答えと解説を確認しながら少しずつ覚えていきましょう。";
  }

  const wrongIds = state.sessionQuestions
    .filter((question) => {
      const answer = state.sessionAnswers[question.id];
      return answer?.status === "wrong" || answer?.revealOnly;
    })
    .map((question) => question.id);

  state.resultFilter = wrongIds;
  elements.retryWrongButton.disabled = wrongIds.length === 0;

  showView("result");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function retryWrongQuestions() {
  if (!state.resultFilter?.length) {
    showToast("復習対象の問題はありません");
    return;
  }

  const questions = state.resultFilter
    .map((id) => state.questions.find((question) => question.id === id))
    .filter(Boolean);

  beginSession(shuffleArray(questions));
}

function returnHome() {
  showView("home");
  updateDashboard();
  updateAvailableCount();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showView(viewName) {
  elements.homeView.classList.toggle("hidden", viewName !== "home");
  elements.quizView.classList.toggle("hidden", viewName !== "quiz");
  elements.resultView.classList.toggle("hidden", viewName !== "result");
}

function updateDashboard() {
  const total = state.progress.totalAnswered;
  const correct = state.progress.totalCorrect;
  const accuracy = total === 0
    ? 0
    : Math.round((correct / total) * 100);

  const weakCount = Object.values(
    state.progress.questionStats
  ).filter((record) => {
    return record.wrong > 0 && record.wrong >= record.correct;
  }).length;

  elements.totalAnsweredStat.textContent = String(total);
  elements.accuracyStat.textContent = `${accuracy}%`;
  elements.streakStat.textContent =
    String(state.progress.currentStreak);
  elements.weakStat.textContent = String(weakCount);
}

function openResetDialog() {
  if (typeof elements.confirmDialog.showModal === "function") {
    elements.confirmDialog.showModal();
  } else if (window.confirm("学習記録を初期化しますか？")) {
    resetProgress();
  }
}

function resetProgress() {
  state.progress = createDefaultProgress();
  saveProgress();
  updateDashboard();
  updateAvailableCount();
  showToast("学習記録を初期化しました");
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return createDefaultProgress();
    }

    return {
      ...createDefaultProgress(),
      ...JSON.parse(saved)
    };
  } catch {
    return createDefaultProgress();
  }
}

function createDefaultProgress() {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    favorites: [],
    questionStats: {}
  };
}

function saveProgress() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state.progress)
  );
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const systemDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  const theme = saved ?? (systemDark ? "dark" : "light");

  document.documentElement.dataset.theme = theme;
  elements.themeIcon.textContent = theme === "dark" ? "☀" : "☾";
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";

  document.documentElement.dataset.theme = next;
  elements.themeIcon.textContent = next === "dark" ? "☀" : "☾";

  localStorage.setItem(THEME_KEY, next);
}

function handleKeyboard(event) {
  if (elements.quizView.classList.contains("hidden")) {
    return;
  }

  const question = getCurrentQuestion();

  if (!question) {
    return;
  }

  const number = Number(event.key);

  if (
    Number.isInteger(number) &&
    number >= 1 &&
    number <= question.options.length
  ) {
    selectOption(number - 1);
    return;
  }

  if (event.key === "Enter" && state.selectedIndex !== null) {
    checkAnswer();
  }

  if (event.key === "ArrowRight") {
    nextQuestion();
  }

  if (event.key === "ArrowLeft") {
    previousQuestion();
  }
}

function restartCardAnimation() {
  elements.questionCard.classList.remove("animate");
  void elements.questionCard.offsetWidth;
  elements.questionCard.classList.add("animate");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  window.clearTimeout(showToast.timer);

  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function shuffleArray(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [array[index], array[randomIndex]] = [
      array[randomIndex],
      array[index]
    ];
  }

  return array;
}
