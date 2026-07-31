import React, { useMemo } from 'react';
import {
  ArrowDownFromLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Info,
} from 'lucide-react';
import type { BloodPressureSession, GuidelineProfile } from '../types/bloodPressure';
import { useLanguage } from '../i18n/useLanguage';
import { getGuidelineName } from '../utils/healthClassification';
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
  const analysis = useMemo(
    () => analyzeBloodPressureTrends(sessions, guidelineProfile),
    [sessions, guidelineProfile]
  );
  const locale = language === 'en' ? 'en-US' : 'es-ES';
  const formatDate = (timestamp?: string) =>
    timestamp
      ? new Date(timestamp).toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';
  const formatDifference = (value: number) => `${value > 0 ? '+' : ''}${value}`;

  return (
    <section className="card trend-insights-card" aria-labelledby="trend-insights-title">
      <div className="trend-insights-header">
        <div className="trend-insights-heading">
          <ChartNoAxesColumnIncreasing size={24} />
          <div>
            <h2 id="trend-insights-title">{t('trendInsights.title')}</h2>
          </div>
        </div>
        <span className="trend-guideline-badge">
          {getGuidelineName(guidelineProfile, language)}
        </span>
      </div>

      {analysis.status === 'insufficient' ? (
        <div className="trend-status-card insufficient">
          <CalendarDays size={22} />
          <div>
            <strong>{t('trendInsights.insufficientTitle')}</strong>
            <p>
              {t('trendInsights.insufficientDesc', {
                requiredSessions: analysis.requiredSessions,
                requiredDays: analysis.requiredDays,
                sessions: analysis.sessionsUsed,
                days: analysis.daysUsed,
              })}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="trend-analysis-meta">
            <span>
              {t('trendInsights.readySummary', {
                sessions: analysis.sessionsUsed,
                days: analysis.daysUsed,
                systolic: analysis.averageSystolic ?? 0,
                diastolic: analysis.averageDiastolic ?? 0,
              })}
            </span>
            <span>
              {t('trendInsights.period', {
                start: formatDate(analysis.periodStart),
                end: formatDate(analysis.periodEnd),
              })}
            </span>
          </div>

          {analysis.comparison && (
            <div className="trend-fortnight-comparison">
              <div className="trend-comparison-header">
                <div>
                  <ArrowRightLeft size={18} />
                  <strong>{t('trendInsights.comparisonTitle')}</strong>
                </div>
                <span className={`trend-coverage-badge ${analysis.comparison.coverage}`}>
                  {t(
                    analysis.comparison.coverage === 'supported'
                      ? 'trendInsights.coverageSupported'
                      : 'trendInsights.coverageSparse'
                  )}
                </span>
              </div>
              <div className="trend-comparison-grid">
                <div>
                  <span>{t('trendInsights.firstFortnight')}</span>
                  <strong>
                    {analysis.comparison.firstAverageSystolic}/
                    {analysis.comparison.firstAverageDiastolic}
                  </strong>
                  <small>
                    {t('trendInsights.daysWithData', {
                      days: analysis.comparison.firstDays,
                    })}
                  </small>
                </div>
                <div>
                  <span>{t('trendInsights.lastFortnight')}</span>
                  <strong>
                    {analysis.comparison.lastAverageSystolic}/
                    {analysis.comparison.lastAverageDiastolic}
                  </strong>
                  <small>
                    {t('trendInsights.daysWithData', {
                      days: analysis.comparison.lastDays,
                    })}
                  </small>
                </div>
                <div className="trend-comparison-difference">
                  <span>{t('trendInsights.difference')}</span>
                  <strong>
                    {formatDifference(analysis.comparison.systolicDifference)}/
                    {formatDifference(analysis.comparison.diastolicDifference)}
                  </strong>
                  <small>mmHg</small>
                </div>
              </div>
              {analysis.comparison.coverage === 'sparse' && (
                <p>{t('trendInsights.sparseExplanation')}</p>
              )}
            </div>
          )}

          {analysis.insights.length === 0 ? (
            <div className="trend-status-card no-pattern">
              <CircleCheck size={22} />
              <div>
                <strong>{t('trendInsights.noPatternTitle')}</strong>
                <p>{t('trendInsights.noPatternDesc')}</p>
              </div>
            </div>
          ) : (
            <div className="trend-insight-list">
              {analysis.insights.map((insight) => {
                const isHigh = insight.key === 'repeatedAboveThreshold';
                return (
                  <article
                    key={insight.key}
                    className={`trend-insight-item ${isHigh ? 'high' : 'low'}`}
                  >
                    {isHigh ? (
                      <ArrowUpFromLine size={22} />
                    ) : (
                      <ArrowDownFromLine size={22} />
                    )}
                    <div>
                      <strong>
                        {t(
                          isHigh
                            ? 'trendInsights.aboveTitle'
                            : 'trendInsights.lowTitle'
                        )}
                      </strong>
                      <p>
                        {t(
                          isHigh
                            ? 'trendInsights.aboveDesc'
                            : 'trendInsights.lowDesc',
                          {
                            matchingDays: insight.matchingDays,
                            totalDays: insight.totalDays,
                            systolic: insight.averageSystolic,
                            diastolic: insight.averageDiastolic,
                          }
                        )}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <p className="trend-insights-disclaimer">
        <Info size={15} />
        <span>{t('trendInsights.disclaimer')}</span>
      </p>
    </section>
  );
};
