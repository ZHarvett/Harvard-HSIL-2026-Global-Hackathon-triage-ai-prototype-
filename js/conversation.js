/**
 * TriageAI — Conversation Engine
 * HSIL 2026 Hackathon Prototype
 * 
 * Manages the chat-like interaction flow between the patient and the system.
 * Handles:
 * - Initial symptom collection via chat interface
 * - Follow-up question generation based on detected symptoms
 * - Care gap question integration
 * - Simulated voice input via Web Speech API
 * 
 * In production, this would be powered by an LLM (e.g., GPT-4, Claude) with
 * medical guardrails and a structured clinical reasoning chain. The conversation
 * would adapt dynamically based on patient responses.
 * 
 * For this prototype, we use a state machine with hardcoded question flows
 * triggered by keyword detection from the triage engine.
 */

const Conversation = (() => {
    'use strict';

    // ==========================================
    // Conversation State
    // ==========================================
    let state = {
        phase: 'initial', // initial | followup | gaps | complete
        analysis: null,
        gaps: [],
        gapQuestions: [],
        currentQuestionIndex: 0,
        answers: {},
        messages: []
    };

    // ==========================================
    // Base follow-up questions (asked after initial symptom input)
    // These are contextual — only relevant ones are shown
    // ==========================================
    const BASE_FOLLOWUPS = {
        duration: {
            text: 'How long have you been experiencing these symptoms?',
            context: 'Knowing the duration helps us assess urgency.',
            options: [
                { label: 'Started today', value: 'today' },
                { label: 'A few days', value: 'few_days' },
                { label: '1-2 weeks', value: '1_2_weeks' },
                { label: '3 or more weeks', value: '3_plus_weeks' },
                { label: 'More than a month', value: 'over_month' }
            ],
            // Only ask if duration wasn't detected in initial input
            shouldAsk: (analysis) => !analysis.duration
        },
        severity: {
            text: 'How would you rate the severity of your main symptom?',
            context: 'This helps us prioritise your care appropriately.',
            options: [
                { label: 'Mild — I can manage', value: 'mild' },
                { label: 'Moderate — It\'s affecting my daily activities', value: 'moderate' },
                { label: 'Severe — I\'m in a lot of pain/discomfort', value: 'severe' },
                { label: 'Very severe — I need help urgently', value: 'very_severe' }
            ],
            shouldAsk: () => true
        },
        nightSweats: {
            text: 'Have you been experiencing night sweats (waking up with your clothes or bedding wet from sweat)?',
            context: 'Night sweats can be an important symptom to track.',
            options: [
                { label: 'Yes, frequently', value: 'yes_frequent' },
                { label: 'Yes, occasionally', value: 'yes_occasional' },
                { label: 'No', value: 'no' }
            ],
            shouldAsk: (analysis) => {
                const symptoms = new Set(analysis.symptoms.keys());
                return symptoms.has('cough') && !symptoms.has('nightSweats');
            }
        },
        weightLoss: {
            text: 'Have you noticed any unintentional weight loss recently?',
            context: 'Unexpected weight changes can help us understand what\'s happening.',
            options: [
                { label: 'Yes, I\'ve lost weight without trying', value: 'yes' },
                { label: 'No, my weight is stable', value: 'no' },
                { label: 'I\'m not sure', value: 'unsure' }
            ],
            shouldAsk: (analysis) => {
                const symptoms = new Set(analysis.symptoms.keys());
                return (symptoms.has('cough') || symptoms.has('fever') || symptoms.has('fatigue'))
                    && !symptoms.has('weightLoss');
            }
        }
    };

    // ==========================================
    // System message templates
    // ==========================================
    const SYSTEM_MESSAGES = {
        analyzing: 'Let me review what you\'ve told me...',
        followupIntro: 'Thank you. I have a few more questions to help the sister assess you properly.',
        gapIntro: 'Based on what you\'ve shared, I\'d like to ask about a couple more things to make sure we don\'t miss anything important.',
        complete: 'Thank you for answering all the questions. I\'m preparing your assessment summary for the sister now.',
        error: 'I didn\'t quite catch that. Could you try again?'
    };

    // ==========================================
    // Core Functions
    // ==========================================

    /**
     * Initialize conversation state
     */
    function init() {
        state = {
            phase: 'initial',
            analysis: null,
            gaps: [],
            gapQuestions: [],
            currentQuestionIndex: 0,
            answers: {},
            messages: []
        };
    }

    /**
     * Process initial symptom input from patient
     * @param {string} text - Patient's symptom description
     * @returns {Object} Next action for the UI
     */
    function processInitialInput(text) {
        // Analyze symptoms
        state.analysis = TriageEngine.analyzeSymptoms(text);
        state.phase = 'followup';

        // Build question queue: base follow-ups + care gap questions
        const questions = [];

        // Add relevant base follow-ups
        for (const [key, q] of Object.entries(BASE_FOLLOWUPS)) {
            if (q.shouldAsk(state.analysis)) {
                questions.push({
                    key,
                    text: q.text,
                    context: q.context,
                    options: q.options,
                    source: 'followup'
                });
            }
        }

        // Detect care gaps and add their questions
        state.gaps = CareGaps.detectGaps(state.analysis);
        const gapQuestions = CareGaps.getGapQuestions(state.gaps);

        for (const gq of gapQuestions) {
            // Avoid duplicate questions
            if (!questions.find(q => q.key === gq.key)) {
                questions.push({
                    ...gq,
                    source: 'gap'
                });
            }
        }

        // Limit total questions to avoid patient fatigue
        state.gapQuestions = questions.slice(0, 6);
        state.currentQuestionIndex = 0;

        // Determine what symptoms were found
        const symptomCount = state.analysis.symptoms.size;
        let responseText;

        if (symptomCount === 0) {
            responseText = 'I want to make sure I understand correctly. Could you tell me more about what\'s bothering you? For example, do you have any pain, cough, fever, or other symptoms?';
            state.phase = 'initial'; // Stay in initial phase
            return {
                type: 'retry',
                message: responseText
            };
        }

        // Build acknowledgment message
        const symptomLabels = [...state.analysis.symptoms.values()].map(s => s.label.toLowerCase());
        if (symptomLabels.length === 1) {
            responseText = `I understand you're experiencing ${symptomLabels[0]}. Let me ask a few more questions to help the sister assess you properly.`;
        } else {
            const last = symptomLabels.pop();
            responseText = `I understand you're experiencing ${symptomLabels.join(', ')} and ${last}. Let me ask a few more questions.`;
        }

        return {
            type: 'acknowledged',
            message: responseText,
            symptomCount,
            hasQuestions: state.gapQuestions.length > 0,
            firstQuestion: state.gapQuestions.length > 0 ? state.gapQuestions[0] : null,
            totalQuestions: state.gapQuestions.length
        };
    }

    /**
     * Process answer to a follow-up question
     * @param {string} questionKey - The question identifier
     * @param {string} answer - The selected answer value
     * @returns {Object} Next action for the UI
     */
    function processAnswer(questionKey, answer) {
        // Store answer
        state.answers[questionKey] = answer;

        // Update analysis with new information
        state.analysis = TriageEngine.updateAnalysis(state.analysis, questionKey, answer);

        // Move to next question
        state.currentQuestionIndex++;

        if (state.currentQuestionIndex >= state.gapQuestions.length) {
            // All questions answered — move to summary
            state.phase = 'complete';
            return {
                type: 'complete',
                message: SYSTEM_MESSAGES.complete,
                analysis: state.analysis,
                gaps: state.gaps,
                answers: state.answers
            };
        }

        // Return next question
        const nextQuestion = state.gapQuestions[state.currentQuestionIndex];
        const isGapQuestion = nextQuestion.source === 'gap';

        return {
            type: 'next_question',
            question: nextQuestion,
            questionNumber: state.currentQuestionIndex + 1,
            totalQuestions: state.gapQuestions.length,
            isGapQuestion,
            // Show gap intro message when transitioning from follow-ups to gap questions
            showGapIntro: isGapQuestion && state.currentQuestionIndex > 0 &&
                state.gapQuestions[state.currentQuestionIndex - 1].source !== 'gap'
        };
    }

    /**
     * Get the final assessment data for summary generation
     */
    function getAssessmentData() {
        const triageScore = TriageEngine.calculateTriageScore(state.analysis);
        const gapSummary = CareGaps.generateGapSummary(state.gaps, state.answers);

        return {
            triage: triageScore,
            analysis: state.analysis,
            gaps: gapSummary,
            answers: state.answers,
            timestamp: new Date().toISOString(),
            assessmentId: generateAssessmentId()
        };
    }

    /**
     * Get current conversation state (for UI)
     */
    function getState() {
        return { ...state };
    }

    // ==========================================
    // Voice Input (Web Speech API)
    // ==========================================
    let recognition = null;
    let isListening = false;

    /**
     * Initialize Web Speech API if available
     */
    function initVoiceInput() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-ZA'; // South African English
            return true;
        }
        return false;
    }

    /**
     * Start/stop voice recognition
     * @param {Function} onResult - Callback with transcribed text
     * @param {Function} onStateChange - Callback for recording state changes
     */
    function toggleVoice(onResult, onStateChange) {
        if (!recognition) {
            // Fallback: focus the text input
            return false;
        }

        if (isListening) {
            recognition.stop();
            isListening = false;
            onStateChange(false);
            return false;
        }

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            onResult(transcript, event.results[event.results.length - 1].isFinal);
        };

        recognition.onend = () => {
            isListening = false;
            onStateChange(false);
        };

        recognition.onerror = (event) => {
            console.log('Speech recognition error:', event.error);
            isListening = false;
            onStateChange(false);
        };

        recognition.start();
        isListening = true;
        onStateChange(true);
        return true;
    }

    // ==========================================
    // Helpers
    // ==========================================

    function generateAssessmentId() {
        const now = new Date();
        const date = now.toISOString().slice(0, 10).replace(/-/g, '');
        const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
        return `TRG-${date}-${seq}`;
    }

    // Public API
    return {
        init,
        processInitialInput,
        processAnswer,
        getAssessmentData,
        getState,
        initVoiceInput,
        toggleVoice
    };
})();
