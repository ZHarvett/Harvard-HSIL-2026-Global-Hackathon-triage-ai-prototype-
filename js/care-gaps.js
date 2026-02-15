/**
 * TriageAI — Care Gap Detection Engine
 * HSIL 2026 Hackathon Prototype
 * 
 * Identifies potential care gaps based on symptom patterns and patient responses.
 * This is the "smart" layer that demonstrates agentic AI thinking — the system
 * doesn't just triage, it proactively identifies missed care opportunities.
 * 
 * In South Africa's PHC context, common care gaps include:
 * - Undiagnosed TB (SA has one of the highest TB burdens globally)
 * - HIV testing gaps (especially in high-prevalence areas like KZN, EC)
 * - Chronic medication non-adherence (diabetes, hypertension, ARVs)
 * - Missed antenatal visits
 * - Incomplete childhood immunisation schedules
 * 
 * In production, this would integrate with patient records (e.g., TIER.Net for HIV,
 * ETR.Net for TB) to check actual care history. Here we simulate with rules.
 */

const CareGaps = (() => {
    'use strict';

    // ==========================================
    // Care Gap Rules
    // Each rule defines conditions and the resulting gap flag
    // ==========================================
    const GAP_RULES = [
        {
            id: 'tb_risk',
            name: 'TB Screening Required',
            priority: 'high',
            icon: '🫁',
            /**
             * TB risk criteria (aligned with SA National TB Programme):
             * - Cough lasting ≥2 weeks
             * - Plus any of: weight loss, night sweats, fever
             * - Or: known HIV+ status
             * 
             * South Africa has ~300,000 new TB cases annually.
             * Early detection in PHC clinics is critical.
             */
            check: (analysis) => {
                const symptoms = new Set(analysis.symptoms.keys());
                const hasCough = symptoms.has('cough');
                const hasSystemicSymptoms = symptoms.has('weightLoss') ||
                    symptoms.has('nightSweats') ||
                    symptoms.has('fever');
                const hasHIV = symptoms.has('hiv');
                const longDuration = analysis.duration && analysis.duration.days >= 14;

                // Cough + duration + systemic symptoms
                if (hasCough && longDuration && hasSystemicSymptoms) return true;
                // Cough + HIV
                if (hasCough && hasHIV) return true;
                // Cough + long duration alone
                if (hasCough && longDuration) return true;
                // Multiple systemic symptoms without cough
                if (hasSystemicSymptoms && (symptoms.has('fatigue') || hasHIV)) return true;

                return false;
            },
            message: 'Patient presents with symptoms consistent with TB risk profile. Recommend GeneXpert sputum test.',
            nurseAction: 'Collect sputum sample for GeneXpert MTB/RIF testing. Check TB register for previous results.',
            questions: [
                {
                    key: 'tbTest',
                    text: 'You mentioned a cough that\'s been going on for a while. Have you been tested for TB (tuberculosis) recently?',
                    context: 'TB is common in our communities. Early testing helps us treat it quickly.',
                    options: [
                        { label: 'No, I haven\'t been tested', value: 'no' },
                        { label: 'Yes, in the last 3 months', value: 'yes_recent' },
                        { label: 'Yes, but more than 3 months ago', value: 'yes_old' },
                        { label: 'I\'m not sure', value: 'unsure' }
                    ]
                },
                {
                    key: 'tbContact',
                    text: 'Has anyone in your household or close contacts been diagnosed with TB?',
                    context: 'TB can spread between people living in close contact.',
                    options: [
                        { label: 'Yes', value: 'yes' },
                        { label: 'No', value: 'no' },
                        { label: 'I\'m not sure', value: 'unsure' }
                    ]
                }
            ]
        },
        {
            id: 'hiv_screening',
            name: 'HIV Testing Recommended',
            priority: 'high',
            icon: '🔬',
            /**
             * HIV testing should be offered to all patients in high-prevalence
             * settings (SA national prevalence ~13%). Especially if presenting
             * with TB symptoms, recurrent infections, or weight loss.
             */
            check: (analysis) => {
                const symptoms = new Set(analysis.symptoms.keys());
                // TB-like symptoms without known HIV status
                const tbSymptoms = symptoms.has('cough') &&
                    (symptoms.has('weightLoss') || symptoms.has('nightSweats'));
                // Recurrent infections pattern
                const recurrentInfections = symptoms.has('fever') && symptoms.has('fatigue');

                return (tbSymptoms || recurrentInfections) && !symptoms.has('hiv');
            },
            message: 'Consider offering HIV counselling and testing (HCT) given symptom profile.',
            nurseAction: 'Offer HIV counselling and testing per national guidelines. Document consent.',
            questions: [
                {
                    key: 'hivTest',
                    text: 'When was your last HIV test?',
                    context: 'Regular HIV testing is recommended for everyone. It helps us provide the best care.',
                    options: [
                        { label: 'In the last 3 months', value: 'recent' },
                        { label: 'More than 3 months ago', value: 'old' },
                        { label: 'I\'ve never been tested', value: 'never' },
                        { label: 'I prefer not to say', value: 'decline' }
                    ]
                }
            ]
        },
        {
            id: 'chronic_medication',
            name: 'Medication Adherence Check',
            priority: 'medium',
            icon: '💊',
            /**
             * Chronic medication non-adherence is a major issue in SA PHC.
             * Common chronic conditions: diabetes, hypertension, HIV (ARVs).
             * Patients often miss refills due to long clinic queues.
             */
            check: (analysis) => {
                const symptoms = new Set(analysis.symptoms.keys());
                return symptoms.has('diabetes') || symptoms.has('hypertension') || symptoms.has('hiv');
            },
            message: 'Patient reports chronic condition. Verify medication adherence and last refill date.',
            nurseAction: 'Check chronic medication script. Verify last collection date. Assess adherence barriers.',
            questions: [
                {
                    key: 'medicationAdherence',
                    text: 'Are you currently taking any chronic medication (for diabetes, blood pressure, HIV, or other conditions)?',
                    context: 'This helps us make sure your treatment plan is on track.',
                    options: [
                        { label: 'Yes, I take it every day', value: 'adherent' },
                        { label: 'Yes, but I sometimes miss doses', value: 'partial' },
                        { label: 'I stopped taking it', value: 'stopped' },
                        { label: 'No chronic medication', value: 'none' }
                    ]
                },
                {
                    key: 'lastRefill',
                    text: 'When did you last collect your medication from the clinic or pharmacy?',
                    context: 'Missing refills can affect your health. We want to help you stay on track.',
                    options: [
                        { label: 'This month', value: 'current' },
                        { label: 'Last month', value: 'last_month' },
                        { label: 'More than 2 months ago', value: 'overdue' },
                        { label: 'I can\'t remember', value: 'unsure' }
                    ]
                }
            ]
        },
        {
            id: 'clinic_visit',
            name: 'Follow-up Visit Gap',
            priority: 'low',
            icon: '📅',
            /**
             * Many patients in SA PHC settings miss scheduled follow-ups
             * due to transport costs, long waiting times, or work commitments.
             * This is a universal check for all patients.
             */
            check: () => true, // Always ask
            message: 'Verify patient\'s last clinic visit and any outstanding follow-up appointments.',
            nurseAction: 'Check patient file for missed appointments. Schedule follow-up if needed.',
            questions: [
                {
                    key: 'lastVisit',
                    text: 'When was the last time you visited this clinic or any other clinic?',
                    context: 'This helps us understand your health history better.',
                    options: [
                        { label: 'In the last month', value: 'recent' },
                        { label: '1-3 months ago', value: 'moderate' },
                        { label: 'More than 3 months ago', value: 'long' },
                        { label: 'This is my first visit', value: 'first' }
                    ]
                }
            ]
        }
    ];

    // ==========================================
    // Core Functions
    // ==========================================

    /**
     * Detect care gaps based on symptom analysis
     * @param {Object} analysis - Output from TriageEngine.analyzeSymptoms()
     * @returns {Array} Detected care gaps with questions and actions
     */
    function detectGaps(analysis) {
        const gaps = [];

        for (const rule of GAP_RULES) {
            if (rule.check(analysis)) {
                gaps.push({
                    id: rule.id,
                    name: rule.name,
                    priority: rule.priority,
                    icon: rule.icon,
                    message: rule.message,
                    nurseAction: rule.nurseAction,
                    questions: rule.questions
                });
            }
        }

        // Sort by priority: high > medium > low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return gaps;
    }

    /**
     * Get all follow-up questions from detected gaps
     * Returns a flat list of questions to ask, limited to avoid fatigue
     */
    function getGapQuestions(gaps) {
        const questions = [];
        const maxQuestions = 4; // Don't overwhelm the patient

        for (const gap of gaps) {
            for (const question of gap.questions) {
                if (questions.length < maxQuestions) {
                    questions.push({
                        ...question,
                        gapId: gap.id,
                        gapName: gap.name,
                        gapPriority: gap.priority
                    });
                }
            }
        }

        return questions;
    }

    /**
     * Generate care gap summary for nurse view
     */
    function generateGapSummary(gaps, answers) {
        return gaps.map(gap => {
            const gapAnswers = {};
            for (const q of gap.questions) {
                if (answers[q.key]) {
                    gapAnswers[q.key] = answers[q.key];
                }
            }

            let severity = 'info';
            if (gap.priority === 'high') {
                // Check if answers increase concern
                if (gapAnswers.tbTest === 'no' || gapAnswers.tbTest === 'unsure') {
                    severity = 'critical';
                } else if (gapAnswers.hivTest === 'never') {
                    severity = 'critical';
                } else {
                    severity = 'warning';
                }
            }

            return {
                ...gap,
                answers: gapAnswers,
                severity
            };
        });
    }

    // Public API
    return {
        detectGaps,
        getGapQuestions,
        generateGapSummary,
        GAP_RULES
    };
})();
