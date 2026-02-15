/**
 * TriageAI — Main Application Controller
 * HSIL 2026 Hackathon Prototype
 * 
 * Orchestrates screen navigation, UI updates, and ties together
 * the triage engine, care gap detection, conversation flow, and summary.
 * 
 * This is the glue layer. In production, this would be a proper
 * framework (React/Vue) with state management. For this prototype,
 * vanilla JS keeps it simple and dependency-free.
 */

// ==========================================
// Global State
// ==========================================
let currentScreen = 'screen-welcome';
let selectedLanguage = 'en';
let voiceAvailable = false;
let screenHistory = [];

// ==========================================
// Screen Navigation
// ==========================================

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show target screen
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        screenHistory.push(currentScreen);
        currentScreen = screenId;

        // Scroll to top
        window.scrollTo(0, 0);
    }
}

function goBack() {
    if (screenHistory.length > 0) {
        const previousScreen = screenHistory.pop();
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(previousScreen).classList.add('active');
        currentScreen = previousScreen;
        window.scrollTo(0, 0);
    }
}

// ==========================================
// Welcome Screen
// ==========================================

function selectLanguage(lang) {
    selectedLanguage = lang;

    // Update button states
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.lang === lang);
    });

    // In production, this would switch the entire UI language.
    // For the prototype, we show a brief note for non-English selections.
    if (lang !== 'en') {
        const welcomeText = document.querySelector('.welcome-text');
        const originalText = 'Welcome to the clinic. This assistant will help assess your symptoms so the sister can see you faster.';

        // Show language acknowledgment (prototype uses English for all)
        welcomeText.textContent = originalText;

        const notice = document.querySelector('.welcome-text-secondary');
        const langNames = { xh: 'isiXhosa', zu: 'isiZulu', af: 'Afrikaans' };
        notice.textContent = `${langNames[lang]} language support coming soon. Continuing in English for this demo.`;
    }
}

function startAssessment() {
    // Initialize conversation engine
    Conversation.init();

    // Initialize voice input
    voiceAvailable = Conversation.initVoiceInput();

    // Update mic button visibility/state
    const micContainer = document.getElementById('voiceInputContainer');
    if (!voiceAvailable) {
        document.getElementById('micLabel').textContent = 'Voice input not available in this browser';
        document.getElementById('micButton').style.opacity = '0.5';
    }

    // Clear previous chat messages (keep the initial system message)
    const chatMessages = document.getElementById('chatMessages');
    const messages = chatMessages.querySelectorAll('.message');
    messages.forEach((msg, i) => {
        if (i > 0) msg.remove();
    });

    // Clear input
    document.getElementById('symptomInput').value = '';

    showScreen('screen-input');

    // Focus the text input after transition
    setTimeout(() => {
        document.getElementById('symptomInput').focus();
    }, 300);
}

// ==========================================
// Chat / Symptom Input Screen
// ==========================================

function toggleVoiceInput() {
    if (!voiceAvailable) {
        // Focus text input as fallback
        document.getElementById('symptomInput').focus();
        return;
    }

    const started = Conversation.toggleVoice(
        // onResult callback
        (transcript, isFinal) => {
            const input = document.getElementById('symptomInput');
            input.value = transcript;
            if (isFinal) {
                // Auto-send after final result
                setTimeout(() => sendMessage(), 500);
            }
        },
        // onStateChange callback
        (isRecording) => {
            const micButton = document.getElementById('micButton');
            const micLabel = document.getElementById('micLabel');

            if (isRecording) {
                micButton.classList.add('recording');
                micLabel.textContent = 'Listening... Tap to stop';
            } else {
                micButton.classList.remove('recording');
                micLabel.textContent = 'Tap to speak';
            }
        }
    );
}

function sendMessage() {
    const input = document.getElementById('symptomInput');
    const text = input.value.trim();

    if (!text) return;

    // Add user message to chat
    addChatMessage(text, 'user');
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    // Process after a brief delay (simulates AI thinking)
    setTimeout(() => {
        hideTypingIndicator();

        // Process through conversation engine
        const result = Conversation.processInitialInput(text);

        if (result.type === 'retry') {
            addChatMessage(result.message, 'system');
            return;
        }

        if (result.type === 'acknowledged') {
            // Show acknowledgment
            addChatMessage(result.message, 'system');

            if (result.hasQuestions) {
                // Transition to questions screen after a moment
                setTimeout(() => {
                    addChatMessage('I\'ll now ask you a few quick questions. This will only take a minute.', 'system');

                    setTimeout(() => {
                        showQuestionsScreen(result.firstQuestion, result.totalQuestions);
                    }, 1500);
                }, 1000);
            } else {
                // No questions needed — go straight to summary
                setTimeout(() => {
                    finishAssessment();
                }, 1000);
            }
        }
    }, 1200);
}

function addChatMessage(text, type) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    if (type === 'system') {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 7v10M7 12h10" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="message-bubble">
                <p>${text}</p>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-avatar">P</div>
            <div class="message-bubble">
                <p>${text}</p>
            </div>
        `;
    }

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'message system-message';
    typing.id = 'typingIndicator';
    typing.innerHTML = `
        <div class="message-avatar">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 7v10M7 12h10" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

// ==========================================
// Questions Screen
// ==========================================

function showQuestionsScreen(firstQuestion, totalQuestions) {
    showScreen('screen-questions');
    renderQuestion(firstQuestion, 1, totalQuestions);
}

function renderQuestion(question, number, total) {
    const container = document.getElementById('questionsContainer');
    const progress = document.getElementById('questionProgress');
    const progressText = document.getElementById('progressText');

    // Update progress
    const pct = (number / total) * 100;
    progress.style.width = `${pct}%`;
    progressText.textContent = `Question ${number} of ${total}`;

    // Build question card
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'question-card fade-in';

    let contextHTML = '';
    if (question.context) {
        contextHTML = `<p class="question-context">${question.context}</p>`;
    }

    // Check if this is a care gap question (show special styling)
    let gapBadge = '';
    if (question.source === 'gap' && question.gapPriority === 'high') {
        gapBadge = `<div class="care-gap-highlight"><strong>🔍 Smart screening question</strong> — Based on your symptoms, this is important to check.</div>`;
    }

    card.innerHTML = `
        ${gapBadge}
        <p class="question-text">${question.text}</p>
        ${contextHTML}
        <div class="answer-options">
            ${question.options.map(opt => `
                <button class="answer-btn" onclick="answerQuestion('${question.key}', '${opt.value}', this)">
                    <span class="answer-indicator"></span>
                    <span>${opt.label}</span>
                </button>
            `).join('')}
        </div>
    `;

    container.appendChild(card);
}

function answerQuestion(questionKey, answerValue, buttonEl) {
    // Visual feedback
    document.querySelectorAll('.answer-btn').forEach(btn => btn.classList.remove('selected'));
    buttonEl.classList.add('selected');

    // Disable all buttons briefly
    document.querySelectorAll('.answer-btn').forEach(btn => btn.disabled = true);

    // Process answer
    setTimeout(() => {
        const result = Conversation.processAnswer(questionKey, answerValue);

        if (result.type === 'complete') {
            // All questions done — show summary
            finishAssessment();
        } else if (result.type === 'next_question') {
            renderQuestion(result.question, result.questionNumber, result.totalQuestions);
        }
    }, 500);
}

// ==========================================
// Summary / Completion
// ==========================================

function finishAssessment() {
    // Get final assessment data
    const assessmentData = Conversation.getAssessmentData();

    // Render summary
    Summary.render(assessmentData);

    // Show summary screen
    showScreen('screen-summary');
}

function resetAssessment() {
    // Reset state
    screenHistory = [];
    Conversation.init();

    // Reset UI
    document.getElementById('symptomInput').value = '';

    // Clear chat messages except first
    const chatMessages = document.getElementById('chatMessages');
    const messages = chatMessages.querySelectorAll('.message');
    messages.forEach((msg, i) => {
        if (i > 0) msg.remove();
    });

    // Go to welcome
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-welcome').classList.add('active');
    currentScreen = 'screen-welcome';
    window.scrollTo(0, 0);
}

// ==========================================
// Keyboard Shortcuts
// ==========================================

document.addEventListener('keydown', (e) => {
    // Enter to send message (when in chat screen)
    if (e.key === 'Enter' && !e.shiftKey && currentScreen === 'screen-input') {
        const input = document.getElementById('symptomInput');
        if (document.activeElement === input && input.value.trim()) {
            e.preventDefault();
            sendMessage();
        }
    }
});

// ==========================================
// Demo Helper — Pre-fill for quick demo
// ==========================================

// Add a subtle demo helper: double-tap the logo to auto-fill a demo scenario
document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.logo-icon');
    let tapCount = 0;
    let tapTimer;

    if (logo) {
        logo.addEventListener('click', () => {
            tapCount++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => { tapCount = 0; }, 500);

            if (tapCount === 2) {
                // Auto-start with demo data
                startAssessment();
                setTimeout(() => {
                    document.getElementById('symptomInput').value =
                        'I have had a bad cough for about 3 weeks now. I also have night sweats and I have been losing weight.';
                }, 500);
                tapCount = 0;
            }
        });
    }

    console.log(
        '%c🏥 TriageAI — HSIL 2026 Hackathon Prototype',
        'font-size: 16px; font-weight: bold; color: #1a5276;'
    );
    console.log(
        '%cThis is a concept prototype demonstrating AI-assisted triage for South African PHC clinics.\nNo real patient data is collected. No clinical decisions should be based on this demo.',
        'font-size: 12px; color: #666;'
    );
    console.log(
        '%cTip: Double-tap the logo on the welcome screen to auto-fill a demo scenario.',
        'font-size: 12px; color: #27ae60;'
    );
});
