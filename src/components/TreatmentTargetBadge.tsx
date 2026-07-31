import type { TreatmentTargetAssessment } from '../utils/treatmentTarget';
import { useLanguage } from '../i18n/useLanguage';

interface TreatmentTargetBadgeProps {
  assessment: TreatmentTargetAssessment;
  compact?: boolean;
  live?: boolean;
}

export const TreatmentTargetBadge: React.FC<TreatmentTargetBadgeProps> = ({
  assessment,
  compact = false,
  live = false,
}) => {
  const { t } = useLanguage();
  const sourceKey =
    assessment.target.source === 'custom'
      ? 'treatmentTarget.sourceCustom'
      : 'treatmentTarget.sourceGuideline';
  const title = `${t(`treatmentTarget.status.${assessment.status}`)}. ${t(sourceKey)}: ${assessment.targetLabel} mmHg.`;

  return (
    <span
      className={`treatment-target-badge status-${assessment.status} ${compact ? 'compact' : live ? 'live' : ''}`}
      title={title}
    >
      <span className="dot" />
      <strong>{t(`treatmentTarget.status.${assessment.status}`)}</strong>
    </span>
  );
};
