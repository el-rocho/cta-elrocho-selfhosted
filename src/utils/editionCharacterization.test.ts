/// <reference types="node" />

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  AppSettings,
  BloodPressureReading,
  BloodPressureSession,
  GuidelineProfile,
  LanguageOption,
} from '../types/bloodPressure';
import { DEFAULT_SETTINGS } from '../services/storageService';
import {
  getGuidelineDescription,
  getGuidelineName,
  getHealthAssessment,
  getHealthCategories,
  getHealthDisclaimer,
} from './healthClassification';
import {
  assessTreatmentTarget,
  getGuidelineTreatmentTarget,
} from './treatmentTarget';
import { processReadingsIntoSessions } from './whiteCoatAlgorithm';
import { analyzeBloodPressureTrends } from './trendAnalysis';

const profiles: GuidelineProfile[] = ['esc-2024', 'aha-acc-2025', 'ish-2020'];
const languages: LanguageOption[] = ['es', 'en'];

function reading(
  id: string,
  minute: number,
  systolic: number,
  diastolic: number,
  heartRate: number
): BloodPressureReading {
  return {
    id,
    timestamp: new Date(Date.UTC(2026, 6, 31, 9, minute)).toISOString(),
    systolic,
    diastolic,
    heartRate,
    arm: 'left',
    pulsePressureWarningConfirmed: true,
    takesAntihypertensiveMedication: true,
  };
}

function trendSession(
  id: string,
  day: number,
  systolic: number,
  diastolic: number
): BloodPressureSession {
  return {
    id,
    timestamp: new Date(Date.UTC(2026, 6, day, 9)).toISOString(),
    readings: [],
    averageSystolic: systolic,
    averageDiastolic: diastolic,
    averageHeartRate: 70,
    discardedCount: 0,
    arm: 'left',
  };
}

function targetSettings(profile: GuidelineProfile): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    guidelineProfile: profile,
    treatmentTargetMode: 'guideline',
    takesAntihypertensiveMedication: true,
    patientAge: 65,
  };
}

function buildEditionCharacterization() {
  const assessmentCases = [
    { id: 'low', systolic: 89, diastolic: 59, heartRate: 49 },
    { id: 'normal-boundary', systolic: 119, diastolic: 69, heartRate: 50 },
    { id: 'guide-boundary', systolic: 135, diastolic: 85, heartRate: 100 },
    { id: 'high-pulse-pressure', systolic: 141, diastolic: 80, heartRate: 101 },
    { id: 'extreme', systolic: 180, diastolic: 120, heartRate: 70 },
  ];

  const assessments = Object.fromEntries(
    profiles.map((profile) => [
      profile,
      Object.fromEntries(
        languages.map((language) => [
          language,
          {
            guideline: {
              name: getGuidelineName(profile, language),
              description: getGuidelineDescription(profile, language),
              disclaimer: getHealthDisclaimer(language, profile),
            },
            categories: getHealthCategories(profile, language),
            cases: assessmentCases.map((item) => ({
              id: item.id,
              result: getHealthAssessment(
                item.systolic,
                item.diastolic,
                item.heartRate,
                language,
                profile,
                true
              ),
            })),
          },
        ])
      ),
    ])
  );

  const targets = Object.fromEntries(
    profiles.map((profile) => [
      profile,
      {
        age64: getGuidelineTreatmentTarget(profile, 64),
        age65: getGuidelineTreatmentTarget(profile, 65),
        below: assessTreatmentTarget(110, 65, targetSettings(profile)),
        within: assessTreatmentTarget(125, 75, targetSettings(profile)),
        above: assessTreatmentTarget(145, 95, targetSettings(profile)),
      },
    ])
  );

  const filterSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    enableWhiteCoatFilter: true,
    whiteCoatIntervalMinutes: 5,
    takesAntihypertensiveMedication: true,
  };
  const filtered = processReadingsIntoSessions(
    [
      reading('initial', 0, 170, 100, 82),
      reading('middle', 2, 150, 90, 76),
      reading('effective', 4, 130, 80, 70),
      reading('stable', 5, 128, 78, 68),
    ],
    filterSettings
  ).sessions.map((session) => ({
    averageSystolic: session.averageSystolic,
    averageDiastolic: session.averageDiastolic,
    averageHeartRate: session.averageHeartRate,
    discardedCount: session.discardedCount,
    effectiveReadingIds: session.readings.slice(session.discardedCount).map((item) => item.id),
  }));

  const trendSessions = [
    trendSession('day-1', 1, 142, 91),
    trendSession('day-8', 8, 140, 89),
    trendSession('day-15', 15, 136, 86),
    trendSession('day-28', 28, 132, 82),
  ];
  const trends = Object.fromEntries(
    profiles.map((profile) => [profile, analyzeBloodPressureTrends(trendSessions, profile)])
  );

  return { assessments, targets, filtered, trends };
}

describe('cross-edition clinical characterization contract', () => {
  it('produces a deterministic result document', () => {
    const characterization = buildEditionCharacterization();

    expect(Object.keys(characterization.assessments)).toEqual(profiles);
    expect(Object.keys(characterization.targets)).toEqual(profiles);
    expect(characterization.filtered).toHaveLength(1);

    const outputPath = process.env.CTA_CHARACTERIZATION_OUTPUT;
    if (outputPath) {
      writeFileSync(outputPath, `${JSON.stringify(characterization, null, 2)}\n`, 'utf8');
    }
  });
});
