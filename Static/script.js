const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");

const chatBox = document.getElementById("chatBox");
const queryInput = document.getElementById("queryInput");
const sendBtn = document.getElementById("sendBtn");

const documentSelect = document.getElementById("documentSelect");
const quizBtn = document.getElementById("quizBtn");

const jumpBtn = document.getElementById("jumpBtn");

let currentQuiz = null;
let quizScore = 0;
let answeredQuestions = 0;
let incorrectQuestions = [];


// Spring engine
function makePressable(element) {
    if (!element) return;

    element.addEventListener("pointerdown", () => {
        element.classList.add("pressed");
    });

    element.addEventListener("pointerup", () => {
        element.classList.remove("pressed");
    });

    element.addEventListener("pointerleave", () => {
        element.classList.remove("pressed");
    });
}


document.querySelectorAll(".pressable").forEach(makePressable);


// Escape HTML
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Scroll chat to bottom
function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}


// Add normal message
function appendMessageWrapper(type, innerHtml) {
    const wrapper = document.createElement("div");

    wrapper.className =
        type === "user"
            ? "message-wrapper user-wrapper"
            : "message-wrapper ai-wrapper";

    const message = document.createElement("div");

    message.className =
        type === "user"
            ? "message user-msg"
            : "message ai-msg";

    message.innerHTML = innerHtml;

    wrapper.appendChild(message);
    chatBox.appendChild(wrapper);

    scrollToBottom();

    return message;
}


// Typing indicator
function showTyping() {
    const wrapper = document.createElement("div");

    wrapper.className = "message-wrapper ai-wrapper";
    wrapper.id = "typingWrapper";

    wrapper.innerHTML = `
        <div class="message ai-msg typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    chatBox.appendChild(wrapper);

    scrollToBottom();
}


// Remove typing indicator
function hideTyping() {
    const typingWrapper =
        document.getElementById("typingWrapper");

    if (typingWrapper) {
        typingWrapper.remove();
    }
}


// Render sources
function renderSources(sources) {
    if (!sources || sources.length === 0) {
        return "";
    }

    return `
        <div class="sources">
            <div class="sources-title">Sources</div>

            ${sources.map((s, i) => {
                const filename =
                    s.metadata?.source || "Unknown";

                const page =
                    s.metadata?.page || "?";

                const encodedFilename =
                    encodeURIComponent(filename);

                return `
                    <a
                        class="source-card"
                        href="/uploads/${encodedFilename}#page=${page}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <strong>
                            Source ${i + 1}
                            · ${escapeHtml(filename)}
                            · Page ${escapeHtml(page)}
                        </strong>

                        <div>
                            ${escapeHtml(
                                s.content.substring(0, 150)
                            )}...
                        </div>
                    </a>
                `;
            }).join("")}
        </div>
    `;
}


// Ask StudyLens
async function askQuestion() {
    const query =
        queryInput.value.trim();

    const documentName =
        documentSelect.value;

    if (!query) return;

    if (!documentName) {
        appendMessageWrapper(
            "ai",
            "Please upload and select a document first."
        );

        return;
    }

    appendMessageWrapper(
        "user",
        escapeHtml(query)
    );

    queryInput.value = "";

    showTyping();

    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: query,
                document: documentName
            })
        });

        const data =
            await response.json();

        hideTyping();

        appendMessageWrapper(
            "ai",
            `
                <div>
                    ${escapeHtml(data.answer)}
                </div>

                ${renderSources(data.sources)}
            `
        );

    } catch (error) {
        hideTyping();

        appendMessageWrapper(
            "ai",
            "Something went wrong while asking the question."
        );

        console.error(error);
    }
}


// Generate quiz
async function generateQuiz() {
    const documentName =
        documentSelect.value;

    if (!documentName) {
        appendMessageWrapper(
            "ai",
            "Please upload and select a document first."
        );

        return;
    }

    showTyping();

    try {
        const response = await fetch("/quiz", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                document: documentName,
                num_questions: 5
            })
        });

        const quiz =
            await response.json();

        hideTyping();

        currentQuiz = quiz;

        quizScore = 0;
        answeredQuestions = 0;
        incorrectQuestions = [];

        renderQuiz(quiz);

    } catch (error) {
        hideTyping();

        appendMessageWrapper(
            "ai",
            "Something went wrong while generating the quiz."
        );

        console.error(error);
    }
}


// Render quiz
function renderQuiz(quiz) {
    if (!quiz || !quiz.questions) {
        appendMessageWrapper(
            "ai",
            "The quiz could not be generated."
        );

        return;
    }

    const quizHtml = `
        <div class="quiz-container">

            <div class="quiz-title">
                Quiz Time 🧠
            </div>

            <div class="quiz-subtitle">
                Test your understanding of the selected document.
            </div>

            ${quiz.questions.map((question, questionIndex) => `
                <div
                    class="quiz-card"
                    data-question="${questionIndex}"
                >

                    <div class="quiz-question">
                        ${questionIndex + 1}.
                        ${escapeHtml(question.question)}
                    </div>

                    <div class="quiz-options">

                        ${question.options.map((option, optionIndex) => `
                            <button
                                type="button"
                                class="quiz-option pressable"
                                data-question="${questionIndex}"
                                data-option="${optionIndex}"
                            >
                                ${escapeHtml(option)}
                            </button>
                        `).join("")}

                    </div>

                    <div
                        class="quiz-feedback"
                        id="quiz-feedback-${questionIndex}"
                    ></div>

                </div>
            `).join("")}

        </div>
    `;

    appendMessageWrapper(
        "ai",
        quizHtml
    );

    document
        .querySelectorAll(".quiz-option")
        .forEach(makePressable);
}


// Handle quiz answers
function handleQuizAnswer(button) {
    if (!currentQuiz) return;

    const questionIndex =
        Number(button.dataset.question);

    const optionIndex =
        Number(button.dataset.option);

    const question =
        currentQuiz.questions[questionIndex];

    if (!question) return;

    const quizCard =
        button.closest(".quiz-card");

    const options =
        quizCard.querySelectorAll(".quiz-option");

    const feedback =
        quizCard.querySelector(
            `#quiz-feedback-${questionIndex}`
        );

    const selectedAnswer =
        question.options[optionIndex];

    const correctAnswer =
        question.correct_answer;

    const isCorrect =
        selectedAnswer === correctAnswer;


    // Update score
    answeredQuestions++;

    if (isCorrect) {
        quizScore++;
    } else {
        incorrectQuestions.push(question);
    }


    // Prevent answering again
    options.forEach(option => {
        option.disabled = true;
        option.classList.add("quiz-disabled");
    });


    // Mark correct answer
    options.forEach(option => {
        const index =
            Number(option.dataset.option);

        if (
            question.options[index] === correctAnswer
        ) {
            option.classList.add("quiz-correct");
        }
    });


    // Mark selected wrong answer
    if (!isCorrect) {
        button.classList.add("quiz-wrong");
    }


    // Show explanation
    feedback.innerHTML = `
        <div class="quiz-result">
            <strong>
                ${isCorrect ? "Correct ✓" : "Incorrect ✗"}
            </strong>

            <p>
                ${escapeHtml(question.explanation)}
            </p>

            <a
                class="quiz-source"
                href="/uploads/${encodeURIComponent(
                    documentSelect.value
                )}#page=${question.page}"
                target="_blank"
                rel="noopener noreferrer"
            >
                Source · Page ${escapeHtml(question.page)}
            </a>
        </div>
    `;




    // Show final result
    if (
        answeredQuestions ===
        currentQuiz.questions.length
    ) {
        showQuizResult();
    }
}


// Show quiz result
function showQuizResult() {
    appendMessageWrapper(
        "ai",
        `
        <div class="quiz-result-card">

            <div class="quiz-title">
                Quiz Complete 🎉
            </div>

            <div class="quiz-score">
                You scored
                <strong>
                    ${quizScore}/${currentQuiz.questions.length}
                </strong>
            </div>

            <div class="quiz-score-message">
                ${
                    quizScore === currentQuiz.questions.length
                        ? "Perfect score!"
                        : `${incorrectQuestions.length} question(s) need another look.`
                }
            </div>

            ${
                incorrectQuestions.length > 0
                    ? `
                        <button
                            type="button"
                            class="retry-quiz-btn pressable"
                            id="retryQuizBtn"
                        >
                            Retry Incorrect
                        </button>
                    `
                    : ""
            }

        </div>
        `
    );


    const retryBtn =
        document.getElementById("retryQuizBtn");

    if (retryBtn) {
        makePressable(retryBtn);

        retryBtn.addEventListener(
            "click",
            retryIncorrectQuestions
        );
    }
}


// Retry incorrect questions
function retryIncorrectQuestions() {
    currentQuiz = {
        questions: [...incorrectQuestions]
    };

    quizScore = 0;
    answeredQuestions = 0;
    incorrectQuestions = [];

    renderQuiz(currentQuiz);
}


// Quiz option click
chatBox.addEventListener("click", event => {
    const option =
        event.target.closest(".quiz-option");

    if (!option) return;

    handleQuizAnswer(option);
});


// Upload files
uploadBtn.addEventListener("click", async () => {

    const files =
        fileInput.files;

    if (!files.length) {
        uploadStatus.textContent =
            "Choose a PDF first.";

        return;
    }

    uploadStatus.textContent =
        "Uploading...";

    try {

        for (const file of files) {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            const response =
                await fetch("/upload", {
                    method: "POST",
                    body: formData
                });

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    "Upload failed"
                );
            }


            // Add document to selector
            const option =
                document.createElement("option");

            option.value =
                file.name;

            option.textContent =
                file.name;

            documentSelect.appendChild(
                option
            );
        }


        // Remove placeholder
        const placeholder =
            documentSelect.querySelector(
                'option[value=""]'
            );

        if (placeholder) {
            placeholder.remove();
        }


        // Select first uploaded document
        if (!documentSelect.value) {
            documentSelect.selectedIndex = 0;
        }


        uploadStatus.textContent =
            "Uploaded successfully.";

        fileInput.value = "";

    } catch (error) {

        uploadStatus.textContent =
            "Upload failed.";

        console.error(error);
    }
});


// Ask button
sendBtn.addEventListener(
    "click",
    askQuestion
);


// Enter key
queryInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            event.preventDefault();
            askQuestion();
        }

    }
);


// Quiz button
quizBtn.addEventListener(
    "click",
    generateQuiz
);


// Jump button
jumpBtn.addEventListener(
    "click",
    scrollToBottom
);


// Show / hide jump button
chatBox.addEventListener(
    "scroll",
    () => {

        const distanceFromBottom =
            chatBox.scrollHeight -
            chatBox.scrollTop -
            chatBox.clientHeight;

        jumpBtn.hidden =
            distanceFromBottom < 150;
    }
);