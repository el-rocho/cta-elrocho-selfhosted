import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { AppSettings, BloodPressureSession, DateRange, ExportReportOptions, GuidelineProfile, LanguageOption } from '../types/bloodPressure';
import logoSvgRaw from '../assets/app-logo.svg?raw';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { filterSessionsByDateRange } from './exportCsv';
import {
  getHealthCategories,
  getHealthCategory,
  getGuidelineName,
} from './healthClassification';
import { buildPDFMeasurementRowsHTML } from './pdfReportContent';
import { calculatePeriodSummary, calculateTrendCardStatistics, type MeasurementStatistics, type ModeStatus } from './summaryStatistics';
import { formatTreatmentTarget, getTreatmentTarget } from './treatmentTarget';
import { getSessionResultTypeLegend } from './sessionResultType';

export interface PDFGenerationResult {
  success: boolean;
  fileUri?: string;
  blobUrl?: string;
  filename?: string;
  isNative?: boolean;
}

export function calculateAge(birthDateStr?: string): number | '' {
  if (!birthDateStr) return '';
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : '';
}

export function buildPDFPatientInfoHTML(
  options: ExportReportOptions,
  reportSettings: AppSettings,
  lang: LanguageOption = 'es'
): string {
  const isEn = lang === 'en';
  const parts: string[] = [];
  if (!options.hidePatientData) {
    if (options.patientName) parts.push(options.patientName);
    const computedAge = options.patientAge || (options.patientBirthDate ? calculateAge(options.patientBirthDate) : '');
    if (computedAge !== '' && computedAge !== undefined && computedAge !== null) {
      parts.push(`${computedAge} ${isEn ? 'y.' : 'a.'}`);
    }
    if (options.patientSex) {
      const sex = options.patientSex.toLowerCase();
      if (sex === 'masculino' || sex === 'male' || sex === 'm') parts.push('M');
      if (sex === 'femenino' || sex === 'female' || sex === 'f') parts.push('F');
    }
  }

  const takesMedication = options.takesAntihypertensiveMedication === true;
  const showInformationalLabels = options.showInformationalLabels ?? true;
  if (takesMedication) {
    const medicationText = `${isEn ? 'Antihypertensive medication' : 'Medicación antihipertensiva'}: ${isEn ? 'Yes' : 'Sí'}`;
    parts.push(`<strong>${medicationText}</strong>`);
    if (showInformationalLabels) parts.push(`${isEn ? 'Target' : 'Objetivo'} ${formatTreatmentTarget(getTreatmentTarget(reportSettings))} mmHg`);
  }
  return parts.join(' | ');
}

export function buildPDFResultTypeLegendHTML(lang: LanguageOption = 'es'): string {
  return getSessionResultTypeLegend(lang)
    .map(({ key, reportCode, reportLabel, color }) => `<span data-result-type-legend="${key}" style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap;"><span style="display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; border-radius:4px; background:${color}; color:#111827; font-size:9px; line-height:1; font-weight:700;">${reportCode}</span>${reportLabel}</span>`)
    .join('');
}

export async function downloadPDFReport(
  sessions: BloodPressureSession[],
  dateRange: DateRange,
  options: ExportReportOptions = {},
  lang: LanguageOption = 'es'
): Promise<PDFGenerationResult> {
  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';
  const guidelineProfile = options.guidelineProfile ?? 'esc-2024';
  const showInformationalLabels = options.showInformationalLabels ?? true;
  const filtered = filterSessionsByDateRange(sessions, dateRange);

  if (filtered.length === 0) {
    alert(isEn ? 'No blood pressure records found for selected period.' : 'No hay registros de tensión en el periodo seleccionado.');
    return { success: false };
  }

  // Ordenar de más antiguo a más reciente para el gráfico de líneas
  const chronological = [...filtered].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Estadísticas para el resumen
  const reportSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    patientName: options.patientName ?? DEFAULT_SETTINGS.patientName,
    patientSex: options.patientSex ?? DEFAULT_SETTINGS.patientSex,
    patientAge: options.patientAge ?? DEFAULT_SETTINGS.patientAge,
    patientBirthDate: options.patientBirthDate ?? DEFAULT_SETTINGS.patientBirthDate,
    takesAntihypertensiveMedication: options.takesAntihypertensiveMedication ?? DEFAULT_SETTINGS.takesAntihypertensiveMedication,
    guidelineProfile,
    showInformationalLabels,
    treatmentTargetMode: options.treatmentTargetMode ?? DEFAULT_SETTINGS.treatmentTargetMode,
    customTargetSystolicMin: options.customTargetSystolicMin ?? DEFAULT_SETTINGS.customTargetSystolicMin,
    customTargetSystolicMax: options.customTargetSystolicMax ?? DEFAULT_SETTINGS.customTargetSystolicMax,
    customTargetDiastolicMin: options.customTargetDiastolicMin ?? DEFAULT_SETTINGS.customTargetDiastolicMin,
    customTargetDiastolicMax: options.customTargetDiastolicMax ?? DEFAULT_SETTINGS.customTargetDiastolicMax,
  };
  const periodSummary = calculatePeriodSummary(filtered, reportSettings);
  const { estimatedMap, pressureLoad, pulsePressure } = periodSummary.cardiovascular;
  const trendSummary = calculateTrendCardStatistics(sessions, reportSettings);

  // Calcular periodo de fechas real
  let realPeriodStr = '';
  const timestamps = filtered.map((s) => new Date(s.timestamp).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const minDStr = new Date(minT).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const maxDStr = new Date(maxT).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  realPeriodStr = minDStr === maxDStr ? minDStr : isEn ? `From ${minDStr} to ${maxDStr}` : `Del ${minDStr} al ${maxDStr}`;

  // Formatear metadatos de paciente
  const patientInfoStr = buildPDFPatientInfoHTML(options, reportSettings, lang);

  // Logo SVG
  const logoPath = "M 1195 1174 L 1174 1195 L 1172 1195 L 1165 1202 L 1163 1202 L 1162 1204 L 1160 1204 L 1159 1206 L 1157 1206 L 1155 1209 L 1151 1210 L 1150 1212 L 1144 1214 L 1143 1216 L 1141 1216 L 1141 1217 L 1139 1217 L 1139 1218 L 1137 1218 L 1135 1220 L 1132 1220 L 1132 1221 L 1130 1221 L 1128 1223 L 1125 1223 L 1123 1225 L 1111 1228 L 1111 1229 L 1107 1229 L 1107 1230 L 1103 1230 L 1103 1231 L 1099 1231 L 1099 1232 L 1094 1232 L 1094 1233 L 1088 1233 L 1088 1234 L 1080 1234 L 1080 1235 L 174 1235 L 174 1234 L 166 1234 L 166 1233 L 160 1233 L 160 1232 L 155 1232 L 155 1231 L 147 1230 L 147 1229 L 140 1228 L 140 1227 L 137 1227 L 135 1225 L 129 1224 L 127 1222 L 124 1222 L 124 1221 L 122 1221 L 122 1220 L 120 1220 L 120 1219 L 118 1219 L 118 1218 L 116 1218 L 116 1217 L 106 1213 L 102 1209 L 100 1209 L 97 1206 L 95 1206 L 94 1204 L 92 1204 L 86 1198 L 84 1198 L 79 1192 L 77 1192 L 61 1176 L 61 1174 L 56 1170 L 56 1168 L 53 1166 L 53 1164 L 50 1162 L 50 1160 L 48 1159 L 48 1157 L 44 1153 L 43 1149 L 41 1148 L 41 1146 L 40 1146 L 40 1144 L 39 1144 L 39 1142 L 38 1142 L 38 1140 L 37 1140 L 37 1138 L 36 1138 L 36 1136 L 35 1136 L 35 1134 L 34 1134 L 34 1132 L 32 1130 L 32 1127 L 30 1125 L 30 1122 L 28 1120 L 28 1117 L 27 1117 L 27 1114 L 26 1114 L 26 1111 L 25 1111 L 25 1107 L 24 1107 L 24 1103 L 23 1103 L 23 1099 L 22 1099 L 22 1094 L 21 1094 L 21 1089 L 20 1089 L 20 1081 L 19 1081 L 19 175 L 20 175 L 20 167 L 21 167 L 22 156 L 23 156 L 25 144 L 26 144 L 28 135 L 30 133 L 30 130 L 32 128 L 32 125 L 33 125 L 33 123 L 34 123 L 34 121 L 35 121 L 35 119 L 36 119 L 40 109 L 42 108 L 44 102 L 46 101 L 46 99 L 48 98 L 50 93 L 57 86 L 57 84 L 63 79 L 63 77 L 77 63 L 79 63 L 84 57 L 86 57 L 88 54 L 90 54 L 92 51 L 94 51 L 95 49 L 97 49 L 98 47 L 103 45 L 104 43 L 106 43 L 106 42 L 112 40 L 113 38 L 115 38 L 117 36 L 120 36 L 120 35 L 128 32 L 128 31 L 131 31 L 131 30 L 134 30 L 136 28 L 139 28 L 139 27 L 142 27 L 142 26 L 146 26 L 146 25 L 149 25 L 149 24 L 154 24 L 154 23 L 163 22 L 163 21 L 170 21 L 170 20 L 179 20 L 179 19 L 1075 19 L 1075 20 L 1084 20 L 1084 21 L 1091 21 L 1091 22 L 1101 23 L 1101 24 L 1112 26 L 1112 27 L 1121 29 L 1123 31 L 1126 31 L 1128 33 L 1131 33 L 1131 34 L 1133 34 L 1133 35 L 1135 35 L 1135 36 L 1145 40 L 1146 42 L 1152 44 L 1153 46 L 1158 48 L 1160 51 L 1165 53 L 1167 56 L 1169 56 L 1173 61 L 1175 61 L 1193 79 L 1193 81 L 1202 90 L 1202 92 L 1204 93 L 1204 95 L 1207 97 L 1208 101 L 1212 105 L 1215 113 L 1217 114 L 1218 119 L 1219 119 L 1219 121 L 1220 121 L 1220 123 L 1221 123 L 1221 125 L 1223 127 L 1223 130 L 1225 132 L 1225 135 L 1226 135 L 1226 138 L 1227 138 L 1227 141 L 1228 141 L 1228 144 L 1229 144 L 1229 148 L 1230 148 L 1230 152 L 1231 152 L 1231 156 L 1232 156 L 1232 161 L 1233 161 L 1234 175 L 1235 175 L 1235 1081 L 1234 1081 L 1234 1089 L 1233 1089 L 1233 1094 L 1232 1094 L 1230 1108 L 1229 1108 L 1229 1111 L 1228 1111 L 1228 1115 L 1227 1115 L 1226 1121 L 1225 1121 L 1224 1126 L 1222 1128 L 1222 1131 L 1221 1131 L 1221 1133 L 1220 1133 L 1220 1135 L 1219 1135 L 1215 1145 L 1213 1146 L 1211 1152 L 1209 1153 L 1209 1155 L 1207 1156 L 1205 1161 L 1202 1163 L 1202 1165 L 1199 1167 L 1199 1169 L 1195 1172 Z";
  const reportLogoSvg = logoSvgRaw
    .replace(/<\?xml[^>]*\?>/i, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .trim()
    || `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" style="width: 42px; height: 42px; flex-shrink: 0; color: #1f2937;" aria-hidden="true"><path d="${logoPath}" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>`;
  const reportLogoFallbackUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(reportLogoSvg)}`;
  const reportLogoMarkup = `<img src="${import.meta.env.BASE_URL}logo-day.png" data-fallback-src="${reportLogoFallbackUrl}" onerror="this.onerror=null;this.src=this.dataset.fallbackSrc" alt="" style="display:block; width:48px; height:48px; flex-shrink:0; object-fit:contain;" />`;

  // Los avisos pueden ocupar más de una línea; se reduce el número de filas para evitar cortes.
  const ROWS_PER_PAGE = 10;
  const tablePagesCount = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const totalPDFPages = 2 + tablePagesCount; // Página 1 = Resumen; página 2 = Dispersión sistólica/diastólica

  // Generar HTML de los gráficos para la Página 1
  const svgLineChartHtml = generateChartSVG(chronological, locale, isEn, showInformationalLabels);
  const categoryDistributionHtml = showInformationalLabels ? generateCategoryDistributionHTML(filtered, lang, guidelineProfile) : '';
  const bloodPressureScatterHtml = generateBloodPressureScatterHTML(filtered, lang, showInformationalLabels);
  const categories = getHealthCategories(guidelineProfile, lang);
  const periodCategory = periodSummary.categoryMode.value
    ? categories.find(({ key }) => key === periodSummary.categoryMode.value)
    : undefined;
  const trendAnalysis = trendSummary.analysis;
  const trendComparison = trendAnalysis.status === 'ready' && trendAnalysis.comparison?.coverage === 'supported'
    ? trendAnalysis.comparison
    : undefined;
  const trendPatternCategory = trendAnalysis.status === 'ready' && trendAnalysis.pattern
    ? categories.find(({ key }) => key === trendAnalysis.pattern?.categoryKey)
    : undefined;

  const modeFallback = (status: ModeStatus) => status === 'tie'
    ? (isEn ? 'No predominant value' : 'Sin predominio')
    : (isEn ? 'Not available' : 'No disponible');
  const targetPresentation = (status: 'within' | 'below' | 'above' | 'mixed') => {
    if (status === 'within') return { label: isEn ? 'Target' : 'Objetivo', background: '#d1fae5', color: '#047857' };
    if (status === 'below') return { label: isEn ? '↓ Target' : '↓ Objetivo', background: '#ffedd5', color: '#c2410c' };
    if (status === 'mixed') return { label: isEn ? '↕ Target' : '↕ Objetivo', background: '#fee2e2', color: '#b91c1c' };
    return { label: isEn ? '↑ Target' : '↑ Objetivo', background: '#fee2e2', color: '#b91c1c' };
  };
  const renderTargetMode = (mode: typeof periodSummary.targetMode) => {
    if (!mode.value) return `<span style="color:#64748b; font-size:10px;">${modeFallback(mode.status)}</span>`;
    const presentation = targetPresentation(mode.value.status);
    return `<span style="display:inline-block; padding:2px 7px; border-radius:999px; background:${presentation.background}; color:${presentation.color}; font-size:10px; font-weight:700;">${presentation.label}</span>`;
  };
  const renderCategoryMode = (category: typeof periodCategory, status: ModeStatus) => category
    ? `<span style="display:inline-block; padding:2px 7px; border-radius:999px; background:${category.badgeBg}; color:${category.badgeText}; font-size:10px; font-weight:700;">${category.name}</span>`
    : `<span style="color:#64748b; font-size:10px;">${modeFallback(status)}</span>`;
  const renderMetricCard = (
    title: string,
    statistics: MeasurementStatistics,
    unit: string,
    color: string
  ) => `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px 8px; min-width:0;">
      <div style="font-size:10px; color:#0f172a; font-weight:700; text-align:center; margin-bottom:5px;">${title}</div>
      ${[
        [isEn ? 'Average' : 'Promedio', statistics.average, unit, color],
        [isEn ? 'Maximum' : 'Máxima', statistics.maximum, '', '#0f172a'],
        [isEn ? 'Minimum' : 'Mínima', statistics.minimum, '', '#0f172a'],
        [isEn ? '90% below' : '90 % debajo de', statistics.percentile90, '', '#0f172a'],
        [isEn ? '90% above' : '90 % encima de', statistics.percentile10, '', '#0f172a'],
      ].map(([label, value, valueUnit, valueColor]) => `
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:4px; padding:1.5px 0; border-bottom:1px solid #e2e8f0; font-size:8px;">
          <span style="color:#64748b;">${label}:</span>
          <strong style="color:${valueColor}; font-size:9px;">${value} <small style="font-size:7px; font-weight:400; color:#64748b;">${valueUnit}</small></strong>
        </div>
      `).join('')}
    </div>
  `;
  const trendValue = (difference: number) => `${difference > 0 ? '↑' : difference < 0 ? '↓' : '→'} ${Math.abs(difference)} mmHg`;
  const statusCardHtml = showInformationalLabels ? `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px 8px; min-width:0; text-align:center;">
      <div style="font-size:10px; color:#0f172a; font-weight:700; margin-bottom:8px; white-space:nowrap;">${isEn ? 'Period Global Status' : 'Estado Global periodo'}</div>
      ${renderCategoryMode(periodCategory, periodSummary.categoryMode.status)}
      <div style="margin:7px 0 5px; border-top:1px solid #e2e8f0;"></div>
      ${renderTargetMode(periodSummary.targetMode)}
    </div>
  ` : '';
  const trendCardHtml = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px 8px; min-width:0; text-align:center;">
      <div style="font-size:10px; color:#0f172a; font-weight:700; margin-bottom:8px; white-space:nowrap;">${isEn ? 'Trend last month' : 'Tendencia último mes'}</div>
      ${trendComparison
        ? `<div style="font-size:10px; font-weight:700;"><span style="color:#dc2626;">S: ${trendValue(trendComparison.systolicDifference)}</span><br><span style="color:#2563eb;">D: ${trendValue(trendComparison.diastolicDifference)}</span></div>`
        : `<span style="color:#64748b; font-size:10px;">${isEn ? 'Not available' : 'No disponible'}</span>`}
      ${showInformationalLabels ? `<div style="margin:6px 0 4px; border-top:1px solid #e2e8f0;"></div>
      <div style="display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:3px;">
        ${renderCategoryMode(trendPatternCategory, trendAnalysis.status === 'ready' ? 'tie' : 'none')}
        ${renderTargetMode(trendSummary.targetMode)}
      </div>` : ''}
    </div>
  `;

  // Función para construir la cabecera estándar de cualquier página
  const buildPageHeader = (pageTitle: string, pageNum: number) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${reportLogoMarkup}
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #0f172a; font-weight: 700;">${pageTitle}</h1>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">${patientInfoStr ? patientInfoStr + ' | ' : ''}${showInformationalLabels ? `<strong>${getGuidelineName(guidelineProfile, lang)}</strong> | ` : ''}${realPeriodStr}</p>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #64748b;">
        <p style="margin:0;">${isEn ? 'Generated:' : 'Generado:'} ${new Date().toLocaleDateString(locale)} ${new Date().toLocaleTimeString(locale)}</p>
        <p style="margin:4px 0 0 0; font-weight: 600; color: #3b82f6;">${isEn ? `Page ${pageNum} of ${totalPDFPages}` : `Página ${pageNum} de ${totalPDFPages}`}</p>
      </div>
    </div>
  `;

  // Pie de página estándar
  const buildPageFooter = () => `
    <div style="margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; text-align: center;">
      ${isEn ? 'The information provided must not be interpreted as a diagnosis under any circumstances. Always consult your doctor before making any decision.' : 'La información proporcionada no debe ser interpretada en ningún caso como un diagnóstico. Para cualquier decisión consulte siempre con su médico.'}
    </div>
  `;

  // Array de elementos DOM temporales
  const pageContainers: HTMLDivElement[] = [];

  // ==========================================
  // PÁGINA 1: RESUMEN Y GRÁFICOS (evolución + categorías)
  // ==========================================
  const page1 = document.createElement('div');
  page1.style.position = 'absolute';
  page1.style.top = '0';
  page1.style.left = '0';
  page1.style.width = '1050px';
  page1.style.zIndex = '999999';
  page1.style.backgroundColor = '#ffffff';
  page1.style.color = '#1e293b';
  page1.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  page1.style.padding = '18px';
  page1.style.boxSizing = 'border-box';

  page1.innerHTML = `
    ${buildPageHeader(isEn ? 'Home Blood Pressure Report' : 'Informe Tensión Arterial domiciliaria', 1)}

    ${
      options.reportNotes
        ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 11.5px;">
        <strong>${isEn ? 'Medical Remarks:' : 'Observaciones Médico-Clínicas:'}</strong>
        <p style="margin:2px 0 0 0; font-style:italic;">"${options.reportNotes}"</p>
      </div>
    `
        : ''
    }

    <!-- Tarjetas KPI Resumen -->
    <div style="display:grid; grid-template-columns:repeat(${showInformationalLabels ? 5 : 4}, minmax(0, 1fr)); gap:8px; margin-bottom:12px;">
      ${renderMetricCard(isEn ? 'Systolic' : 'Sistólica', periodSummary.systolic, 'mmHg', '#dc2626')}
      ${renderMetricCard(isEn ? 'Diastolic' : 'Diastólica', periodSummary.diastolic, 'mmHg', '#2563eb')}
      ${renderMetricCard(isEn ? 'Pulse' : 'Pulsaciones', periodSummary.heartRate, isEn ? 'BPM' : 'ppm', '#64748b')}
      ${statusCardHtml}
      ${trendCardHtml}
    </div>

    <div style="display:grid; grid-template-columns:1.45fr 1.05fr 0.9fr; align-items:center; padding:7px 10px; margin-bottom:12px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; font-size:8.6px; color:#64748b;">
      <span style="display:inline-flex; align-items:baseline; gap:4px; padding-right:10px; white-space:nowrap;"><strong style="color:#0f172a;">${isEn ? 'Home pressure load:' : 'Carga presiva domiciliaria:'}</strong><span>${isEn ? 'Readings ≥135/85' : 'Mediciones ≥135/85'} <strong style="color:#b45309; font-size:11px;">${pressureLoad.elevatedPercentage} %</strong> ${pressureLoad.elevatedSessions} ${isEn ? 'of' : 'de'} ${pressureLoad.totalSessions} ${isEn ? 'sessions' : 'sesiones'}</span></span>
      <span style="padding-left:10px; border-left:1px solid #cbd5e1; white-space:nowrap;"><strong style="color:#0f172a;">${isEn ? 'Estimated Mean Arterial Pressure:' : 'Presión Arterial Media estimada:'}</strong> <strong style="color:#2563eb; font-size:11px;">${estimatedMap.average}</strong> mmHg</span>
      <span style="padding-left:10px; border-left:1px solid #cbd5e1; white-space:nowrap;"><strong style="color:#0f172a;">${isEn ? 'Mean pulse pressure:' : 'Presión de pulso media:'}</strong> <strong style="color:#7c3aed; font-size:11px;">${pulsePressure.average}</strong> mmHg</span>
    </div>

    <!-- 1. Gráfico de Evolución (ARRIBA - ANCHO COMPLETO 100%) -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; width: 100%; box-sizing: border-box;">
      <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>${isEn ? 'Evolution' : 'Evolución'}</span>
        <div style="display: flex; gap: 12px; font-size: 9.5px; font-weight: 500; color: #64748b;">
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:7px; height:7px; background:#ef4444; border-radius:50%; display:inline-block;"></span> ${isEn ? 'Systolic' : 'Sistólica'}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:7px; height:7px; background:#3b82f6; border-radius:50%; display:inline-block;"></span> ${isEn ? 'Diastolic' : 'Diastólica'}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:7px; height:7px; background:#64748b; border-radius:50%; display:inline-block;"></span> ${isEn ? 'Pulse' : 'Pulsaciones'}</span>
          ${showInformationalLabels ? `<span style="display: flex; align-items: center; gap: 4px;"><span style="width:9px; height:7px; background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.4); display:inline-block;"></span> ${isEn ? 'Healthy Range' : 'Rango Saludable'}</span>` : ''}
        </div>
      </div>
      ${svgLineChartHtml}
    </div>

    <!-- 2. Distribución por categorías a ancho completo -->
    ${categoryDistributionHtml}

    ${buildPageFooter()}
  `;

  pageContainers.push(page1);

  // ==========================================
  // PÁGINA 2: DIAGRAMA DE DISPERSIÓN SISTÓLICA/DIASTÓLICA
  // ==========================================
  const page2 = document.createElement('div');
  page2.style.position = 'absolute';
  page2.style.top = '0';
  page2.style.left = '0';
  page2.style.width = '1050px';
  page2.style.height = '720px';
  page2.style.zIndex = '999999';
  page2.style.backgroundColor = '#ffffff';
  page2.style.color = '#1e293b';
  page2.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  page2.style.padding = '18px';
  page2.style.boxSizing = 'border-box';

  page2.innerHTML = `
    <div style="height:100%; display:flex; flex-direction:column;">
      ${buildPageHeader(isEn ? 'Systolic/Diastolic Scatter Plot' : 'Diagrama de dispersión Sistólica/Diastólica', 2)}
      <div style="flex:1; display:flex; align-items:center; width:100%;">
        ${bloodPressureScatterHtml}
      </div>
      ${buildPageFooter()}
    </div>
  `;

  pageContainers.push(page2);

  // ==========================================
  // PÁGINAS 3+: HISTORIAL DE MEDICIONES POR BLOQUES
  // ==========================================
  for (let pageIdx = 0; pageIdx < tablePagesCount; pageIdx++) {
    const pageNum = pageIdx + 3;
    const startIndex = pageIdx * ROWS_PER_PAGE;
    const pageSessions = filtered.slice(startIndex, startIndex + ROWS_PER_PAGE);

    const pageContainer = document.createElement('div');
    pageContainer.style.position = 'absolute';
    pageContainer.style.top = '0';
    pageContainer.style.left = '0';
    pageContainer.style.width = '1050px';
    pageContainer.style.zIndex = '999999';
    pageContainer.style.backgroundColor = '#ffffff';
    pageContainer.style.color = '#1e293b';
    pageContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    pageContainer.style.padding = '20px';
    pageContainer.style.boxSizing = 'border-box';

    const rowsHtml = buildPDFMeasurementRowsHTML(pageSessions, lang, guidelineProfile, reportSettings);

    pageContainer.innerHTML = `
      ${buildPageHeader(isEn ? 'Measurement History' : 'Historial de Mediciones', pageNum)}

      <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; margin:0 0 10px 0;">
        <h3 style="font-size:14px; color:#1e293b; margin:0; white-space:nowrap;">
          ${isEn ? `Log: ${filtered.length} measurements` : `Registro: ${filtered.length} mediciones`}
        </h3>
        <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px; color:#64748b; font-size:9px;">
          ${buildPDFResultTypeLegendHTML(lang)}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; text-align: left;">
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Date & Time' : 'Fecha y Hora'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Systolic' : 'Sistólica'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Diastolic' : 'Diastólica'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Pulse' : 'Pulso'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Arm' : 'Brazo'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${showInformationalLabels ? (isEn ? 'Classification' : 'Clasificación') : (isEn ? 'Safety notices' : 'Avisos de seguridad')}</th>
            ${showInformationalLabels ? `<th style="padding: 8px 8px; border-bottom: 2px solid #cbd5e1; text-align:center;">${isEn ? 'Target' : 'Objetivo'}</th>` : ''}
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Notes' : 'Notas'}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${buildPageFooter()}
    `;

    pageContainers.push(pageContainer);
  }

  // Nombre del archivo PDF
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateTimeStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  const filenamePrefix = isEn ? 'blood_pressure_report' : 'informe_tension_arterial';
  const filename = `${filenamePrefix}_${dateTimeStr}.pdf`;

  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 297 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 210 mm
    const imgWidth = pdfWidth - 16; // 8mm margen a cada lado

    // Renderizar página a página
    for (let i = 0; i < pageContainers.length; i++) {
      const container = pageContainers[i];
      document.body.appendChild(container);

      await Promise.all(
        Array.from(container.querySelectorAll('img')).map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener('load', () => resolve(), { once: true });
              image.addEventListener('error', () => resolve(), { once: true });
            });
          }
          await image.decode?.().catch(() => undefined);
        })
      );

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1050,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (i > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', 8, 8, imgWidth, Math.min(imgHeight, pdfHeight - 16));

      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }

    const isNative = Capacitor.isNativePlatform();
    let fileUri = '';
    let blobUrl = '';

    if (isNative) {
      const base64Data = pdf.output('datauristring').split(',')[1];
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      fileUri = writeResult.uri;
    } else {
      const pdfBlob = pdf.output('blob');
      blobUrl = URL.createObjectURL(pdfBlob);
      pdf.save(filename);
    }

    return {
      success: true,
      fileUri,
      blobUrl,
      filename,
      isNative,
    };
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert(isEn ? 'Error generating PDF report.' : 'Error al generar el informe PDF.');
    return { success: false };
  } finally {
    pageContainers.forEach((container) => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    });
  }
}

export function printPDFReport(
  sessions: BloodPressureSession[],
  dateRange: DateRange,
  options: ExportReportOptions = {},
  lang: LanguageOption = 'es'
): void {
  downloadPDFReport(sessions, dateRange, options, lang);
}

// Gráfico de líneas (Evolución Tensión) a ancho completo (970px)
function generateChartSVG(chronologicalSessions: BloodPressureSession[], locale = 'es-ES', isEn = false, showInformationalLabels = true): string {
  if (chronologicalSessions.length === 0) {
    return `<p style="text-align:center; color:#94a3b8; font-size:12px;">${isEn ? 'No data to chart in this period' : 'Sin datos para graficar en este periodo'}</p>`;
  }

  const width = 970;
  const height = 150;
  const paddingLeft = 35;
  const paddingRight = 25;
  const paddingTop = 10;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const minVal = 40;
  const maxVal = 200;

  const getY = (val: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    return height - paddingBottom - ratio * chartHeight;
  };

  const getX = (index: number) => {
    if (chronologicalSessions.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (chronologicalSessions.length - 1)) * chartWidth;
  };

  const sysPoints = chronologicalSessions.map((s, i) => ({ x: getX(i), y: getY(s.averageSystolic) }));
  const diaPoints = chronologicalSessions.map((s, i) => ({ x: getX(i), y: getY(s.averageDiastolic) }));
  const pulsePoints = chronologicalSessions.map((s, i) => ({ x: getX(i), y: getY(s.averageHeartRate) }));

  const sysPath = sysPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const diaPath = diaPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const pulsePath = pulsePoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');

  const idealSysY = getY(120);
  const idealDiaY = getY(80);

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; overflow:visible; display:block;">
      ${showInformationalLabels ? `<!-- Banda Rango Saludable -->
      <rect x="${paddingLeft}" y="${idealSysY}" width="${chartWidth}" height="${Math.max(0, idealDiaY - idealSysY)}" fill="rgba(16, 185, 129, 0.1)" rx="3" />
      <line x1="${paddingLeft}" y1="${idealSysY}" x2="${width - paddingRight}" y2="${idealSysY}" stroke="rgba(16, 185, 129, 0.4)" stroke-dasharray="3 3" />` : ''}

      <!-- Escala Y -->
      ${[60, 90, 120, 150, 180]
        .map((val) => {
          const y = getY(val);
          return `
          <g>
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="2 2" />
            <text x="${paddingLeft - 6}" y="${y + 3}" text-anchor="end" fill="#94a3b8" font-size="9">${val}</text>
          </g>
        `;
        })
        .join('')}

      <!-- Líneas -->
      <path d="${pulsePath}" fill="none" stroke="#64748b" stroke-width="0.8" stroke-linecap="round" stroke-dasharray="4 3" />
      <path d="${sysPath}" fill="none" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round" />
      <path d="${diaPath}" fill="none" stroke="#3b82f6" stroke-width="1.2" stroke-linecap="round" />

      <!-- Puntos -->
      ${sysPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#ef4444" stroke="#ffffff" stroke-width="0.75" />`).join('')}
      ${diaPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#3b82f6" stroke="#ffffff" stroke-width="0.75" />`).join('')}
      ${pulsePoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#64748b" stroke="#ffffff" stroke-width="0.75" />`).join('')}

      <!-- Eje X (Fechas) -->
      ${chronologicalSessions
        .map((s, i) => {
          if (chronologicalSessions.length > 20 && i % Math.ceil(chronologicalSessions.length / 15) !== 0) return '';
          const x = getX(i);
          const dateLabel = new Date(s.timestamp).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
          return `<text x="${x}" y="${height - 6}" text-anchor="middle" fill="#64748b" font-size="8.5">${dateLabel}</text>`;
        })
        .join('')}
    </svg>
  `;
}

// Diagrama de dispersión de las medias efectivas de sesión (diastólica en X, sistólica en Y).
export function generateBloodPressureScatterHTML(
  sessions: BloodPressureSession[],
  lang: LanguageOption = 'es',
  showInformationalLabels = true
): string {
  const isEn = lang === 'en';
  const width = 940;
  const height = 480;
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 28;
  const paddingBottom = 46;
  const xMin = 30;
  const xMax = 160;
  const yMin = 50;
  const yMax = 260;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const x = (value: number) => paddingLeft + ((Math.max(xMin, Math.min(xMax, value)) - xMin) / (xMax - xMin)) * chartWidth;
  const y = (value: number) => paddingTop + (1 - (Math.max(yMin, Math.min(yMax, value)) - yMin) / (yMax - yMin)) * chartHeight;
  const isolatedCount = sessions.filter((session) =>
    session.averageSystolic >= 135 &&
    session.averageSystolic < 180 &&
    session.averageDiastolic < 85
  ).length;
  const veryHighSingleCount = sessions.filter((session) => {
    const systolicVeryHigh = session.averageSystolic >= 180;
    const diastolicVeryHigh = session.averageDiastolic >= 120;
    return systolicVeryHigh !== diastolicVeryHigh;
  }).length;
  const veryHighBothCount = sessions.filter((session) =>
    session.averageSystolic >= 180 && session.averageDiastolic >= 120
  ).length;
  const unhighlightedCount = sessions.length - isolatedCount - veryHighSingleCount - veryHighBothCount;
  const xTicks = [30, 60, 85, 120, 160];
  const yTicks = [50, 100, 135, 180, 220, 260];
  const points = sessions.map((session) => {
    const isVeryHighBoth = session.averageSystolic >= 180 && session.averageDiastolic >= 120;
    const isExtreme = session.averageSystolic >= 180 || session.averageDiastolic >= 120;
    const isIsolated = !isExtreme && session.averageSystolic >= 135 && session.averageDiastolic < 85;
    const fill = isVeryHighBoth ? '#991b1b' : isExtreme ? '#dc2626' : showInformationalLabels && isIsolated ? '#d97706' : '#4f46e5';
    return `<circle data-reading-point="true" cx="${x(session.averageDiastolic)}" cy="${y(session.averageSystolic)}" r="3.6" fill="${fill}" fill-opacity="0.72" stroke="#ffffff" stroke-width="0.8" />`;
  }).join('');

  return `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; width:100%; box-sizing:border-box; text-align:center;">
      <div style="margin-bottom:6px; display:flex; justify-content:flex-end; align-items:center;">
        <span style="font-size:10px; color:#64748b; font-weight:500; white-space:nowrap;">${sessions.length} ${isEn ? 'readings' : 'tomas'}</span>
      </div>
      <div style="display:flex; gap:14px; justify-content:center; align-items:center; flex-wrap:wrap; margin-bottom:4px; color:#64748b; font-size:9.5px;">
        ${showInformationalLabels ? `<span><i style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#ffffff; border:1px solid #cbd5e1; vertical-align:-1px;"></i> ${isEn ? 'No highlighted values' : 'Sin valores destacados'}: ${unhighlightedCount}</span>
        <span><i style="display:inline-block; width:9px; height:9px; border-radius:2px; background:rgba(217,119,6,.18); border:1px solid #d97706; vertical-align:-1px;"></i> ${isEn ? 'Isolated systolic pattern' : 'Patrón sistólico aislado'}: ${isolatedCount}</span>` : ''}
        <span><i style="display:inline-block; width:9px; height:9px; border-radius:2px; background:rgba(220,38,38,.09); border:1px solid #f87171; vertical-align:-1px;"></i> ${isEn ? 'Very high value' : 'Valor muy alto'}: ${veryHighSingleCount}</span>
        <span><i style="display:inline-block; width:9px; height:9px; border-radius:2px; background:rgba(220,38,38,.18); border:1px solid #991b1b; vertical-align:-1px;"></i> ${isEn ? 'Both values very high' : 'Ambos valores muy altos'}: ${veryHighBothCount}</span>
      </div>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; overflow:visible; display:block; margin:0 auto;">
        ${showInformationalLabels ? `<rect x="${paddingLeft}" y="${y(180)}" width="${x(85) - paddingLeft}" height="${y(135) - y(180)}" fill="rgba(217,119,6,0.10)" />` : ''}
        <rect x="${paddingLeft}" y="${paddingTop}" width="${chartWidth}" height="${y(180) - paddingTop}" fill="rgba(220,38,38,0.09)" />
        <rect x="${x(120)}" y="${paddingTop}" width="${width - paddingRight - x(120)}" height="${chartHeight}" fill="rgba(220,38,38,0.09)" />
        ${yTicks.map((tick) => `<g><line x1="${paddingLeft}" y1="${y(tick)}" x2="${width - paddingRight}" y2="${y(tick)}" stroke="#e2e8f0" stroke-width="0.8"/><text x="${paddingLeft - 8}" y="${y(tick) + 4}" text-anchor="end" fill="#64748b" font-size="11">${tick}</text></g>`).join('')}
        ${xTicks.map((tick) => `<g><line x1="${x(tick)}" y1="${paddingTop}" x2="${x(tick)}" y2="${height - paddingBottom}" stroke="#e2e8f0" stroke-width="0.8"/><text x="${x(tick)}" y="${height - 25}" text-anchor="middle" fill="#64748b" font-size="11">${tick}</text></g>`).join('')}
        ${showInformationalLabels ? `<line x1="${paddingLeft}" y1="${y(135)}" x2="${width - paddingRight}" y2="${y(135)}" stroke="#d97706" stroke-width="0.9" stroke-dasharray="3 2" />
        <line x1="${x(85)}" y1="${paddingTop}" x2="${x(85)}" y2="${height - paddingBottom}" stroke="#d97706" stroke-width="0.9" stroke-dasharray="3 2" />` : ''}
        ${points}
        <text x="${paddingLeft + chartWidth / 2}" y="${height - 6}" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">${isEn ? 'Diastolic' : 'Diastólica'} (mmHg)</text>
        <text x="14" y="${paddingTop + chartHeight / 2}" text-anchor="middle" fill="#475569" font-size="12" font-weight="600" transform="rotate(-90 14 ${paddingTop + chartHeight / 2})">${isEn ? 'Systolic' : 'Sistólica'} (mmHg)</text>
      </svg>
    </div>
  `;
}
// Gráfico de barras verticales por categorías de la referencia seleccionada
function generateCategoryDistributionHTML(
  sessions: BloodPressureSession[],
  lang: LanguageOption = 'es',
  guidelineProfile: GuidelineProfile = 'esc-2024'
): string {
  const isEn = lang === 'en';
  const total = sessions.length;
  const categories = getHealthCategories(guidelineProfile, lang);
  const counts = new Map(categories.map((category) => [category.key, 0]));

  sessions.forEach((s) => {
    const category = getHealthCategory(
      s.averageSystolic,
      s.averageDiastolic,
      lang,
      guidelineProfile
    );
    counts.set(category.key, (counts.get(category.key) ?? 0) + 1);
  });
  const maxCount = Math.max(1, ...counts.values());

  const svgWidth = 720;
  const svgHeight = 135;
  const paddingTop = 22;
  const paddingBottom = 32;
  const paddingLeft = 30;
  const paddingRight = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barGroupWidth = chartWidth / categories.length;
  const barWidth = Math.min(38, barGroupWidth * 0.52);

  const barsSvgHtml = categories
    .map((category, idx) => {
      const count = counts.get(category.key) ?? 0;
      const pct = total > 0 ? (count / total) * 100 : 0;

      const groupCenterX = paddingLeft + (idx + 0.5) * barGroupWidth;
      const barX = groupCenterX - barWidth / 2;

      const barH = count > 0 ? Math.max(8, (count / maxCount) * chartHeight) : 2;
      const barY = svgHeight - paddingBottom - barH;

      const labelText = count > 0 ? `${count} (${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%)` : '0';
      const labelY = Math.max(12, barY - 4);
      const xLabel = category.name;

      return `
        <g>
          <!-- Barra vertical por categoría de la referencia seleccionada -->
          <rect
            x="${barX}"
            y="${barY}"
            width="${barWidth}"
            height="${barH}"
            fill="${count > 0 ? category.colorHex : '#e2e8f0'}"
            rx="4"
          />

          <!-- Texto encima de la barra (Toma y Porcentaje) -->
          <text
            x="${groupCenterX}"
            y="${labelY}"
            text-anchor="middle"
            fill="${count > 0 ? '#0f172a' : '#94a3b8'}"
            font-size="9"
            font-weight="${count > 0 ? '700' : '400'}"
          >${labelText}</text>

          <!-- Nombre de Categoría en Eje X -->
          <text
            x="${groupCenterX}"
            y="${svgHeight - 12}"
            text-anchor="middle"
            fill="#334155"
            font-size="9"
            font-weight="600"
          >${xLabel}</text>
        </g>
      `;
    })
    .join('');

  return `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 0 auto; width: 780px; box-sizing: border-box; text-align: center;">
      <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap:8px;">
        <span>${isEn ? 'Distribution by category' : 'Distribución por categorías'} · ${getGuidelineName(guidelineProfile, lang)}</span>
        <span style="font-size: 10px; color: #64748b; font-weight: 500; white-space:nowrap;">${total} ${isEn ? 'readings' : 'tomas'}</span>
      </div>

      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; overflow:visible; display:block; margin: 0 auto;">
        <!-- Línea Base Eje X -->
        <line x1="${paddingLeft}" y1="${svgHeight - paddingBottom}" x2="${svgWidth - paddingRight}" y2="${svgHeight - paddingBottom}" stroke="#cbd5e1" stroke-width="1" />

        ${barsSvgHtml}
      </svg>
    </div>
  `;
}
