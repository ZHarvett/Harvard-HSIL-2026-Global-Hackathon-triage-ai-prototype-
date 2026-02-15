/**
 * TriageAI — Triage Engine
 * HSIL 2026 Hackathon Prototype
 * 
 * Implements keyword-based symptom detection and Cape Triage Score (CTS) classification.
 * 
 * The Cape Triage Score is the standard triage system used across South African
 * public healthcare facilities. It classifies patients into acuity levels:
 * 
 *   RED    — Emergency: Immediate attention required
 *   ORANGE — Very Urgent: Attention within 10 minutes
 *   YELLOW — Urgent: Attention within 60 minutes
 *   GREEN  — Routine: Attention within 240 minutes
 * 
 * In production, this would be replaced by an LLM-based clinical reasoning engine
 * with proper medical ontology mapping (SNOMED-CT, ICD-10). This prototype uses
 * simple keyword matching to demonstrate the concept.
 * 
 * References:
 * - South African Triage Scale (SATS): Gottschalk et al., 2006
 * - Cape Triage Group guidelines
 */

const TriageEngine = (() => {
    'use strict';

    // ==========================================
    // Symptom keyword patterns
    // Each pattern maps keywords to a symptom category
    // ==========================================
    const SYMPTOM_PATTERNS = {
        cough: {
            keywords: ['cough', 'coughing', 'ukhohlela', 'hoest'],
            category: 'respiratory',
            label: 'Cough'
        },
        chestPain: {
            keywords: ['chest pain', 'chest hurts', 'pain in chest', 'chest is sore', 'isifuba sibuhlungu'],
            category: 'cardiovascular',
            label: 'Chest pain'
        },
        breathingDifficulty: {
            keywords: ['breathing', 'breathe', 'short of breath', 'shortness of breath', 'cant breathe', "can't breathe", 'difficulty breathing', 'breathless'],
            category: 'respiratory',
            label: 'Breathing difficulty'
        },
        fever: {
            keywords: ['fever', 'hot', 'temperature', 'burning up', 'umkhuhlane', 'koors'],
            category: 'systemic',
            label: 'Fever'
        },
        headache: {
            keywords: ['headache', 'head hurts', 'head is sore', 'head pain', 'iintlungu zeentloko'],
            category: 'neurological',
            label: 'Headache'
        },
        neckStiffness: {
            keywords: ['stiff neck', 'neck stiff', 'neck is stiff', 'neck hurts', 'neck pain'],
            category: 'neurological',
            label: 'Neck stiffness'
        },
        weightLoss: {
            keywords: ['weight loss', 'losing weight', 'lost weight', 'getting thin', 'thin'],
            category: 'systemic',
            label: 'Unintentional weight loss'
        },
        nightSweats: {
            keywords: ['night sweats', 'sweating at night', 'wake up sweating', 'sweats'],
            category: 'systemic',
            label: 'Night sweats'
        },
        diarrhoea: {
            keywords: ['diarrhoea', 'diarrhea', 'loose stool', 'running stomach', 'stomach running'],
            category: 'gastrointestinal',
            label: 'Diarrhoea'
        },
        vomiting: {
            keywords: ['vomit', 'vomiting', 'throwing up', 'nausea', 'sick', 'ukugabha'],
            category: 'gastrointestinal',
            label: 'Vomiting/Nausea'
        },
        abdominalPain: {
            keywords: ['stomach pain', 'stomach ache', 'tummy pain', 'abdominal pain', 'belly pain', 'stomach hurts', 'stomach is sore'],
            category: 'gastrointestinal',
            label: 'Abdominal pain'
        },
        bleeding: {
            keywords: ['bleeding', 'blood', 'bleed'],
            category: 'trauma',
            label: 'Bleeding'
        },
        rash: {
            keywords: ['rash', 'skin', 'itchy', 'itching', 'spots'],
            category: 'dermatological',
            label: 'Skin rash/irritation'
        },
        dizziness: {
            keywords: ['dizzy', 'dizziness', 'lightheaded', 'faint', 'fainting'],
            category: 'neurological',
            label: 'Dizziness'
        },
        fatigue: {
            keywords: ['tired', 'fatigue', 'exhausted', 'weak', 'no energy', 'weakness'],
            category: 'systemic',
            label: 'Fatigue/Weakness'
        },
        pain: {
            keywords: ['pain', 'sore', 'hurts', 'ache', 'aching'],
            category: 'general',
            label: 'General pain'
        },
        confusion: {
            keywords: ['confused', 'confusion', 'disoriented', 'not making sense'],
            category: 'neurological',
            label: 'Confusion/Altered mental state'
        },
        diabetes: {
            keywords: ['diabetes', 'sugar', 'diabetic', 'blood sugar', 'insulin'],
            category: 'chronic',
            label: 'Diabetes-related'
        },
        hypertension: {
            keywords: ['blood pressure', 'high blood pressure', 'hypertension', 'bp'],
            category: 'chronic',
            label: 'Hypertension-related'
        },
        hiv: {
            keywords: ['hiv', 'arv', 'arvs', 'antiretroviral', 'cd4'],
            category: 'chronic',
            label: 'HIV-related'
        }
    };

    // ==========================================
    // Duration extraction patterns
    // ==========================================
    const DURATION_PATTERNS = [
        { regex: /(\d+)\s*week/i, unit: 'weeks' },
        { regex: /(\d+)\s*day/i, unit: 'days' },
        { regex: /(\d+)\s*month/i, unit: 'months' },
        { regex: /few\s*days/i, value: 3, unit: 'days' },
        { regex: /few\s*weeks/i, value: 3, unit: 'weeks' },
        { regex: /couple\s*(of\s*)?days/i, value: 2, unit: 'days' },
        { regex: /couple\s*(of\s*)?weeks/i, value: 2, unit: 'weeks' },
        { regex: /long\s*time/i, value: 4, unit: 'weeks' },
        { regex: /today|just\s*now|this\s*morning|tonight/i, value: 0, unit: 'days' },
        { regex: /yesterday/i, value: 1, unit: 'days' },
        { regex: /last\s*week/i, value: 7, unit: 'days' },
        { regex: /since\s*(last\s*)?monday|tuesday|wednesday|thursday|friday|saturday|sunday/i, value: 5, unit: 'days' }
    ];

    // ==========================================
    // Severity indicators
    // ==========================================
    const SEVERITY_KEYWORDS = {
        high: ['severe', 'very bad', 'terrible', 'worst', 'extreme', 'unbearable', 'excruciating', 'really bad', 'so much pain'],
        moderate: ['moderate', 'quite bad', 'getting worse', 'bad', 'painful'],
        low: ['mild', 'slight', 'a little', 'small', 'minor', 'not too bad']
    };

    // ==========================================
    // Cape Triage Score Rules
    // Simplified rule-based classification
    // ==========================================
    const TRIAGE_RULES = {
        red: {
            label: 'RED — EMERGENCY',
            code: 'R',
            time: 'Immediate attention required',
            color: 'red',
            conditions: [
                // Chest pain + breathing difficulty = possible MI/PE
                (symptoms) => symptoms.has('chestPain') && symptoms.has('breathingDifficulty'),
                // Altered mental state
                (symptoms) => symptoms.has('confusion'),
                // Meningitis signs: fever + headache + neck stiffness
                (symptoms) => symptoms.has('fever') && symptoms.has('headache') && symptoms.has('neckStiffness'),
                // Severe bleeding
                (symptoms, context) => symptoms.has('bleeding') && context.severity === 'high'
            ]
        },
        orange: {
            label: 'ORANGE — VERY URGENT',
            code: 'O',
            time: 'Target: within 10 minutes',
            color: 'orange',
            conditions: [
                // High fever with any other symptom
                (symptoms, context) => symptoms.has('fever') && context.severity === 'high',
                // Chest pain alone
                (symptoms) => symptoms.has('chestPain'),
                // Breathing difficulty alone
                (symptoms) => symptoms.has('breathingDifficulty'),
                // Severe pain
                (symptoms, context) => context.severity === 'high'
            ]
        },
        yellow: {
            label: 'YELLOW — URGENT',
            code: 'Y',
            time: 'Target: within 60 minutes',
            color: 'yellow',
            conditions: [
                // TB risk factors (cough + systemic symptoms)
                (symptoms) => symptoms.has('cough') && (symptoms.has('weightLoss') || symptoms.has('nightSweats') || symptoms.has('fever')),
                // Fever with moderate severity
                (symptoms) => symptoms.has('fever'),
                // Persistent cough (>2 weeks)
                (symptoms, context) => symptoms.has('cough') && context.durationDays > 14,
                // Multiple symptoms
                (symptoms) => symptoms.size >= 3,
                // Moderate pain
                (symptoms, context) => context.severity === 'moderate'
            ]
        },
        green: {
            label: 'GREEN — ROUTINE',
            code: 'G',
            time: 'Target: within 240 minutes',
            color: 'green',
            conditions: [
                // Default — everything else
                () => true
            ]
        }
    };

    // ==========================================
    // Core Functions
    // ==========================================

    /**
     * Extract symptoms from free-text input
     * @param {string} text - Patient's symptom description
     * @returns {Object} Detected symptoms and metadata
     */
    function analyzeSymptoms(text) {
        const normalizedText = text.toLowerCase().trim();
        const detectedSymptoms = new Map();

        // Match symptom patterns
        for (const [key, pattern] of Object.entries(SYMPTOM_PATTERNS)) {
            for (const keyword of pattern.keywords) {
                if (normalizedText.includes(keyword)) {
                    detectedSymptoms.set(key, {
                        ...pattern,
                        matchedKeyword: keyword
                    });
                    break;
                }
            }
        }

        // Extract duration
        const duration = extractDuration(normalizedText);

        // Assess severity
        const severity = assessSeverity(normalizedText);

        return {
            symptoms: detectedSymptoms,
            duration,
            severity,
            rawText: text,
            categories: [...new Set([...detectedSymptoms.values()].map(s => s.category))]
        };
    }

    /**
     * Extract duration from text
     */
    function extractDuration(text) {
        for (const pattern of DURATION_PATTERNS) {
            const match = text.match(pattern.regex);
            if (match) {
                const value = pattern.value !== undefined ? pattern.value : parseInt(match[1]);
                let days = value;
                if (pattern.unit === 'weeks') days = value * 7;
                if (pattern.unit === 'months') days = value * 30;
                return {
                    value,
                    unit: pattern.unit,
                    days,
                    text: match[0]
                };
            }
        }
        return null;
    }

    /**
     * Assess severity from text
     */
    function assessSeverity(text) {
        for (const [level, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    return level;
                }
            }
        }
        return 'moderate'; // Default to moderate if unclear
    }

    /**
     * Calculate Cape Triage Score based on detected symptoms
     * @param {Object} analysis - Output from analyzeSymptoms()
     * @returns {Object} Triage classification
     */
    function calculateTriageScore(analysis) {
        const symptomKeys = new Set(analysis.symptoms.keys());
        const context = {
            severity: analysis.severity,
            durationDays: analysis.duration ? analysis.duration.days : 0,
            symptomCount: analysis.symptoms.size
        };

        // Check rules in priority order: red → orange → yellow → green
        for (const [level, rule] of Object.entries(TRIAGE_RULES)) {
            for (const condition of rule.conditions) {
                if (condition(symptomKeys, context)) {
                    return {
                        level,
                        label: rule.label,
                        code: rule.code,
                        time: rule.time,
                        color: rule.color,
                        matchedSymptoms: [...analysis.symptoms.entries()].map(([key, val]) => ({
                            key,
                            label: val.label,
                            category: val.category
                        }))
                    };
                }
            }
        }

        // Fallback to green
        return {
            level: 'green',
            ...TRIAGE_RULES.green,
            matchedSymptoms: []
        };
    }

    /**
     * Update analysis with additional information from follow-up questions
     */
    function updateAnalysis(existingAnalysis, questionKey, answer) {
        // Clone the analysis
        const updated = {
            ...existingAnalysis,
            symptoms: new Map(existingAnalysis.symptoms),
            followUpAnswers: {
                ...(existingAnalysis.followUpAnswers || {}),
                [questionKey]: answer
            }
        };

        // Add symptoms based on follow-up answers
        if (questionKey === 'duration' && answer.includes('week')) {
            const weeks = parseInt(answer) || 3;
            updated.duration = { value: weeks, unit: 'weeks', days: weeks * 7 };
        }

        if (questionKey === 'severity') {
            if (answer.toLowerCase().includes('severe') || answer.toLowerCase().includes('very bad')) {
                updated.severity = 'high';
            } else if (answer.toLowerCase().includes('mild') || answer.toLowerCase().includes('little')) {
                updated.severity = 'low';
            }
        }

        if (questionKey === 'tbTest' && answer.toLowerCase().includes('no')) {
            // Flag that TB test is needed
            updated.tbTestNeeded = true;
        }

        if (questionKey === 'nightSweats' && (answer.toLowerCase().includes('yes') || answer.toLowerCase() === 'yes')) {
            updated.symptoms.set('nightSweats', {
                ...SYMPTOM_PATTERNS.nightSweats,
                matchedKeyword: 'night sweats (reported in follow-up)'
            });
        }

        if (questionKey === 'weightLoss' && (answer.toLowerCase().includes('yes') || answer.toLowerCase() === 'yes')) {
            updated.symptoms.set('weightLoss', {
                ...SYMPTOM_PATTERNS.weightLoss,
                matchedKeyword: 'weight loss (reported in follow-up)'
            });
        }

        if (questionKey === 'medicationAdherence' && answer.toLowerCase().includes('no')) {
            updated.medicationNonAdherent = true;
        }

        return updated;
    }

    // Public API
    return {
        analyzeSymptoms,
        calculateTriageScore,
        updateAnalysis,
        SYMPTOM_PATTERNS,
        TRIAGE_RULES
    };
})();
