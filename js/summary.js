/**
 * TriageAI — Summary Generator
 * HSIL 2026 Hackathon Prototype
 * 
 * Generates the nurse-facing clinical summary view.
 * This is the primary output of the triage system — what the sister sees
 * when the patient arrives at the consultation room.
 * 
 * Design considerations for SA PHC context:
 * - Quick-scan format (nurses see 40+ patients/day)
 * - Cape Triage Score color prominently displayed
 * - Care gaps highlighted with specific actions
 * - No jargon — clear, actionable language
 * - Timestamp and assessment ID for record-keeping
 */

const Summary = (() => {
    'use strict';

    /**
     * Render the complete summary view
     * @param {Object} assessmentData - From Conversation.getAssessmentData()
     */
    function render(assessmentData) {
        const { triage, analysis, gaps, answers, timestamp, assessmentId } = assessmentData;

        // Update triage banner
        renderTriageBanner(triage);

        // Update presenting complaint
        renderPresentingComplaint(analysis);

        // Update symptom list
        renderSymptomList(triage.matchedSymptoms, analysis);

        // Update care gaps
        renderCareGaps(gaps, answers);

        // Update suggested actions
        renderActions(triage, gaps, answers);

        // Update metadata
        renderMeta(assessmentId, timestamp);
    }

    /**
     * Render the triage acuity banner
     */
    function renderTriageBanner(triage) {
        const banner = document.getElementById('triageBanner');
        const level = document.getElementById('triageLevel');
        const time = document.getElementById('triageTime');
        const scoreValue = banner.querySelector('.score-value');

        // Remove existing triage classes
        banner.className = 'triage-banner';
        banner.classList.add(`triage-${triage.color}`);

        level.textContent = triage.label;
        time.textContent = triage.time;
        scoreValue.textContent = triage.code;
    }

    /**
     * Render the presenting complaint narrative
     */
    function renderPresentingComplaint(analysis) {
        const container = document.getElementById('presentingComplaint');

        // Build a clinical narrative from the analysis
        const symptoms = [...analysis.symptoms.values()];
        const parts = [];

        // Main symptoms
        if (symptoms.length > 0) {
            const symptomNames = symptoms.map(s => s.label.toLowerCase());
            parts.push(`Patient reports ${symptomNames.join(', ')}`);
        }

        // Duration
        if (analysis.duration) {
            parts.push(`Duration: approximately ${analysis.duration.value} ${analysis.duration.unit}`);
        }

        // Severity
        if (analysis.severity === 'high') {
            parts.push('Patient describes symptoms as severe');
        } else if (analysis.severity === 'low') {
            parts.push('Patient describes symptoms as mild');
        }

        // Follow-up answers that add context
        if (analysis.followUpAnswers) {
            if (analysis.followUpAnswers.nightSweats && analysis.followUpAnswers.nightSweats.includes('yes')) {
                parts.push('Reports night sweats');
            }
            if (analysis.followUpAnswers.weightLoss === 'yes') {
                parts.push('Reports unintentional weight loss');
            }
            if (analysis.followUpAnswers.tbContact === 'yes') {
                parts.push('Reports known TB contact in household');
            }
        }

        // Original text
        const narrative = parts.join('. ') + '.';

        container.innerHTML = `
            <p>${narrative}</p>
            <p class="original-text" style="margin-top: 8px; font-style: italic; color: var(--text-muted); font-size: var(--font-size-xs);">
                Patient's own words: "${analysis.rawText}"
            </p>
        `;
    }

    /**
     * Render the symptom list
     */
    function renderSymptomList(matchedSymptoms, analysis) {
        const list = document.getElementById('symptomList');
        list.innerHTML = '';

        if (matchedSymptoms.length === 0) {
            list.innerHTML = '<li>No specific symptoms identified from initial screening</li>';
            return;
        }

        for (const symptom of matchedSymptoms) {
            const li = document.createElement('li');
            let text = symptom.label;

            // Add duration context if relevant
            if (symptom.category === 'respiratory' && analysis.duration) {
                text += ` (${analysis.duration.value} ${analysis.duration.unit})`;
            }

            // Add severity context
            if (analysis.severity === 'high') {
                text += ' — reported as severe';
            }

            li.textContent = text;
            list.appendChild(li);
        }

        // Add symptoms from follow-up answers
        if (analysis.followUpAnswers) {
            if (analysis.followUpAnswers.nightSweats && analysis.followUpAnswers.nightSweats.includes('yes')) {
                const li = document.createElement('li');
                li.textContent = 'Night sweats (confirmed in follow-up)';
                list.appendChild(li);
            }
            if (analysis.followUpAnswers.weightLoss === 'yes') {
                const li = document.createElement('li');
                li.textContent = 'Unintentional weight loss (confirmed in follow-up)';
                list.appendChild(li);
            }
        }
    }

    /**
     * Render care gaps section
     */
    function renderCareGaps(gaps, answers) {
        const card = document.getElementById('careGapsCard');
        const list = document.getElementById('gapList');
        list.innerHTML = '';

        // Filter to gaps that are actually concerning
        const significantGaps = gaps.filter(gap => {
            if (gap.id === 'clinic_visit') return true; // Always show
            if (gap.id === 'tb_risk') return true;
            if (gap.id === 'hiv_screening') return true;
            if (gap.id === 'chronic_medication') {
                return answers.medicationAdherence && answers.medicationAdherence !== 'adherent';
            }
            return true;
        });

        if (significantGaps.length === 0) {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');

        for (const gap of significantGaps) {
            const li = document.createElement('li');
            let text = `<strong>${gap.name}:</strong> ${gap.message}`;

            // Add answer context
            if (gap.answers) {
                if (gap.answers.tbTest === 'no' || gap.answers.tbTest === 'unsure') {
                    text += ' <em>(Patient has not been recently tested)</em>';
                }
                if (gap.answers.tbContact === 'yes') {
                    text += ' <em>(Known TB contact in household)</em>';
                }
                if (gap.answers.hivTest === 'never') {
                    text += ' <em>(Patient has never been tested for HIV)</em>';
                }
                if (gap.answers.medicationAdherence === 'stopped') {
                    text += ' <em>(Patient reports stopping medication)</em>';
                } else if (gap.answers.medicationAdherence === 'partial') {
                    text += ' <em>(Patient reports missing doses)</em>';
                }
            }

            li.innerHTML = text;
            list.appendChild(li);
        }
    }

    /**
     * Render suggested actions for the nurse
     */
    function renderActions(triage, gaps, answers) {
        const list = document.getElementById('actionList');
        list.innerHTML = '';

        const actions = [];

        // Triage-based actions
        if (triage.color === 'red') {
            actions.push('IMMEDIATE: Assess airway, breathing, circulation. Call doctor if available.');
        } else if (triage.color === 'orange') {
            actions.push('URGENT: Perform vital signs assessment within 10 minutes.');
        }

        // Gap-based actions
        for (const gap of gaps) {
            if (gap.id === 'tb_risk') {
                if (answers.tbTest === 'no' || answers.tbTest === 'unsure' || answers.tbTest === 'yes_old') {
                    actions.push('Collect sputum sample for GeneXpert MTB/RIF testing.');
                }
                if (answers.tbContact === 'yes') {
                    actions.push('Screen household contacts for TB symptoms. Refer for contact tracing.');
                }
            }
            if (gap.id === 'hiv_screening') {
                if (answers.hivTest === 'never' || answers.hivTest === 'old') {
                    actions.push('Offer HIV counselling and testing (HCT) per national guidelines.');
                }
            }
            if (gap.id === 'chronic_medication') {
                if (answers.medicationAdherence === 'stopped' || answers.medicationAdherence === 'partial') {
                    actions.push('Review chronic medication adherence. Assess barriers and provide adherence counselling.');
                }
                if (answers.lastRefill === 'overdue') {
                    actions.push('Medication refill overdue. Issue new script and schedule follow-up.');
                }
            }
        }

        // Standard actions
        actions.push('Record vital signs: BP, pulse, temperature, respiratory rate, SpO2.');
        actions.push('Update patient file with triage assessment and care gap findings.');

        // Render
        for (const action of actions) {
            const li = document.createElement('li');
            li.textContent = action;
            list.appendChild(li);
        }
    }

    /**
     * Render assessment metadata
     */
    function renderMeta(assessmentId, timestamp) {
        document.getElementById('assessmentId').textContent = assessmentId;

        const date = new Date(timestamp);
        const options = {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Johannesburg'
        };
        document.getElementById('assessmentTime').textContent =
            date.toLocaleDateString('en-ZA', options) + ' SAST';

        // Language
        const langMap = { en: 'English', xh: 'isiXhosa', zu: 'isiZulu', af: 'Afrikaans' };
        const selectedLang = document.querySelector('.language-btn.selected');
        const langCode = selectedLang ? selectedLang.dataset.lang : 'en';
        document.getElementById('assessmentLang').textContent = langMap[langCode] || 'English';
    }

    // Public API
    return {
        render
    };
})();
