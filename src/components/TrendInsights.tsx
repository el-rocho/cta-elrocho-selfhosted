import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChartNoAxesColumnIncreasing,
  Info,
  Tags,
  TrendingUp,
  X,
} from 'lucide-react';
import type { BloodPressureSession, GuidelineProfile } from '../types/bloodPressure';
import { useLanguage } from '../i18n/useLanguage';
import { getGuidelineName, getHealthCategoriesMap } from '../utils/healthClassification';
import { analyzeBloodPressureTrends } from '../utils/trendAnalysis';

interface TrendInsightsProps {
  sessions: BloodPressureSession[];
  guidelineProfile: GuidelineProfile;
}

export const TrendInsights: React.FC<TrendInsightsProps> = ({
  sessions,
  guidelineProfile,
}) => {
  const { t, language } = useLanguage();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const analysis = useMemo(
    () => analyzeBloodPressureTrends(sessions, guidelineProfile),
    [sessions, guidelineProfile]
  );
  const comparison = analysis.status === 'ready' && analysis.comparison?.coverage === 'supported'
    ? analysis.comparison
    : undefined;
  const systolicDifference = comparison?.systolicDifference ?? 0;
  const diastolicDifference = comparison?.diastolicDifference ?? 0;
  const SystolicArrow = systolicDifference > 0
    ? ArrowUp
    : systolicDifference < 0
      ? ArrowDown
      : ArrowRight;
  const DiastolicArrow = diastolicDifference > 0
    ? ArrowUp
    : diastolicDifference < 0
      ? ArrowDown
      : ArrowRight;
  const patternCategory = analysis.status === 'ready' && analysis.pattern
    ? getHealthCategoriesMap(language, guidelineProfile)[analysis.pattern.categoryKey]
    : undefined;

  return (
    <section className="card trend-insights-card" aria-labelledby="trend-insights-title">
      <div className="trend-insights-header">
        <div className="trend-insights-heading">
          <ChartNoAxesColumnIncreasing size={24} />
          <h2 id="trend-insights-title">{t('trendInsights.title')}</h2>
        </div>
        {comparison ? (
          <div className="trend-month-values">
            <span className="trend-month-value systolic">
              <span>{t('form.systolic')}</span>
              <SystolicArrow size={15} aria-hidden="true" />
              <strong>{Math.abs(systolicDifference)}</strong>
              <small>mmHg</small>
            </span>
            <span className="trend-month-value diastolic">
              <span>{t('form.diastolic')}</span>
              <DiastolicArrow size={15} aria-hidden="true" />
              <strong>{Math.abs(diastolicDifference)}</strong>
              <small>mmHg</small>
            </span>
          </div>
        ) : (
          <span className="trend-insufficient-badge">
            {t('trendInsights.insufficientTitle')}
          </span>
        )}
        {analysis.status === 'ready' && (
          <div className="trend-pattern-row">
            <strong>{t('trendInsights.patternTitle')}</strong>
            {patternCategory ? (
              <span
                className="trend-pattern-category"
                style={{
                  backgroundColor: patternCategory.badgeBg,
                  color: patternCategory.badgeText,
                }}
              >
                {patternCategory.name}
              </span>
            ) : (
              <span className="trend-pattern-none">{t('trendInsights.noPatternTitle')}</span>
            )}
          </div>
        )}
        <span className="trend-guideline-badge">
          {getGuidelineName(guidelineProfile, language)}
        </span>
        <button
          type="button"
          className="settings-info-button trend-info-button"
          title={t('trendInsights.infoTooltip')}
          aria-label={t('trendInsights.infoTooltip')}
          onClick={() => setIsInfoOpen(true)}
        >
          <Info size={17} />
        </button>
      </div>
      {isInfoOpen && createPortal(
        <div
          className="modal-overlay settings-info-overlay"
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            className="modal-content settings-info-dialog trend-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trend-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <Info size={24} className="modal-icon text-blue legal-icon-main" />
                <h2 id="trend-info-title" className="settings-info-title">
                  {t('trendInsights.infoTitle')}
                </h2>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                aria-label={t('settings.close')}
                onClick={() => setIsInfoOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body settings-info-body measurement-guide-body trend-info-body">
              <div className="settings-subcard measurement-guide-main-card trend-info-card">
                <TrendingUp size={22} className="legal-icon-block trend-info-icon" />
                <div>
                  <strong>{t('trendInsights.infoTrendTitle')}</strong>
                  <p>{t('trendInsights.infoTrendText')}</p>
                </div>
              </div>
              <div className="settings-subcard measurement-guide-advice-card trend-info-card">
                <Tags size={22} className="legal-icon-block trend-info-icon" />
                <div>
                  <strong>{t('trendInsights.infoPatternTitle')}</strong>
                  <p>{t('trendInsights.infoPatternText')}</p>
                </div>
              </div>
              <div className="settings-info-note trend-info-note">
                <p>{t('trendInsights.infoDailyAverages')}</p>
                <p>{t('trendInsights.infoCaution')}</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};
