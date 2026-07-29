import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { BloodPressureSession, DateRange, ExportReportOptions, LanguageOption, HealthSeverity } from '../types/bloodPressure';
import logoSvgRaw from '../assets/app-logo.svg?raw';
import { filterSessionsByDateRange } from './exportCsv';
import {
  getHealthAssessment,
  getHealthCategoriesMap,
  getHealthCategory,
  getCulpritLabel,
  getConfirmedPulsePressureAlerts,
  getHealthDisclaimer,
  getSessionMedicationContext,
} from './healthClassification';

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

export async function downloadPDFReport(
  sessions: BloodPressureSession[],
  dateRange: DateRange,
  options: ExportReportOptions = {},
  lang: LanguageOption = 'es'
): Promise<PDFGenerationResult> {
  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';
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
  const total = filtered.length;
  let sumSys = 0;
  let sumDia = 0;
  let sumPulse = 0;

  filtered.forEach((s) => {
    sumSys += s.averageSystolic;
    sumDia += s.averageDiastolic;
    sumPulse += s.averageHeartRate;
  });

  const avgSys = total > 0 ? Math.round(sumSys / total) : 0;
  const avgDia = total > 0 ? Math.round(sumDia / total) : 0;
  const avgPulse = total > 0 ? Math.round(sumPulse / total) : 0;
  const takesMedication = options.takesAntihypertensiveMedication === true;
  const avgAssessment = getHealthAssessment(avgSys, avgDia, avgPulse, lang, takesMedication);
  const avgCategory = avgAssessment.category;

  // Calcular periodo de fechas real
  let realPeriodStr = '';
  const timestamps = filtered.map((s) => new Date(s.timestamp).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const minDStr = new Date(minT).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const maxDStr = new Date(maxT).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  realPeriodStr = minDStr === maxDStr ? minDStr : isEn ? `From ${minDStr} to ${maxDStr}` : `Del ${minDStr} al ${maxDStr}`;

  // Formatear metadatos de paciente
  let patientInfoStr = '';
  if (!options.hidePatientData) {
    const parts: string[] = [];
    if (options.patientName) {
      parts.push(`<strong>${isEn ? 'Patient:' : 'Paciente:'}</strong> ${options.patientName}`);
    }

    const computedAge = options.patientAge || (options.patientBirthDate ? calculateAge(options.patientBirthDate) : '');
    if (computedAge !== '' && computedAge !== undefined && computedAge !== null) {
      parts.push(`<strong>${isEn ? 'Age:' : 'Edad:'}</strong> ${computedAge} ${isEn ? 'years' : 'años'}`);
    }

    if (options.patientSex) {
      const s = options.patientSex.toLowerCase();
      let sexLetter = '';
      if (s === 'masculino' || s === 'male' || s === 'm') sexLetter = 'M';
      else if (s === 'femenino' || s === 'female' || s === 'f') sexLetter = 'F';

      if (sexLetter) {
        parts.push(`<strong>${sexLetter}</strong>`);
      }
    }
    parts.push(`<strong>${isEn ? 'Antihypertensive medication:' : 'Medicación antihipertensiva:'}</strong> ${takesMedication ? (isEn ? 'Yes' : 'Sí') : 'No'}`);

    patientInfoStr = parts.length > 0 ? parts.join(' | ') : '';
  }

  // Logo SVG
  const logoPath = "M 1195 1174 L 1174 1195 L 1172 1195 L 1165 1202 L 1163 1202 L 1162 1204 L 1160 1204 L 1159 1206 L 1157 1206 L 1155 1209 L 1151 1210 L 1150 1212 L 1144 1214 L 1143 1216 L 1141 1216 L 1141 1217 L 1139 1217 L 1139 1218 L 1137 1218 L 1135 1220 L 1132 1220 L 1132 1221 L 1130 1221 L 1128 1223 L 1125 1223 L 1123 1225 L 1111 1228 L 1111 1229 L 1107 1229 L 1107 1230 L 1103 1230 L 1103 1231 L 1099 1231 L 1099 1232 L 1094 1232 L 1094 1233 L 1088 1233 L 1088 1234 L 1080 1234 L 1080 1235 L 174 1235 L 174 1234 L 166 1234 L 166 1233 L 160 1233 L 160 1232 L 155 1232 L 155 1231 L 147 1230 L 147 1229 L 140 1228 L 140 1227 L 137 1227 L 135 1225 L 129 1224 L 127 1222 L 124 1222 L 124 1221 L 122 1221 L 122 1220 L 120 1220 L 120 1219 L 118 1219 L 118 1218 L 116 1218 L 116 1217 L 106 1213 L 102 1209 L 100 1209 L 97 1206 L 95 1206 L 94 1204 L 92 1204 L 86 1198 L 84 1198 L 79 1192 L 77 1192 L 61 1176 L 61 1174 L 56 1170 L 56 1168 L 53 1166 L 53 1164 L 50 1162 L 50 1160 L 48 1159 L 48 1157 L 44 1153 L 43 1149 L 41 1148 L 41 1146 L 40 1146 L 40 1144 L 39 1144 L 39 1142 L 38 1142 L 38 1140 L 37 1140 L 37 1138 L 36 1138 L 36 1136 L 35 1136 L 35 1134 L 34 1134 L 34 1132 L 32 1130 L 32 1127 L 30 1125 L 30 1122 L 28 1120 L 28 1117 L 27 1117 L 27 1114 L 26 1114 L 26 1111 L 25 1111 L 25 1107 L 24 1107 L 24 1103 L 23 1103 L 23 1099 L 22 1099 L 22 1094 L 21 1094 L 21 1089 L 20 1089 L 20 1081 L 19 1081 L 19 175 L 20 175 L 20 167 L 21 167 L 22 156 L 23 156 L 25 144 L 26 144 L 28 135 L 30 133 L 30 130 L 32 128 L 32 125 L 33 125 L 33 123 L 34 123 L 34 121 L 35 121 L 35 119 L 36 119 L 40 109 L 42 108 L 44 102 L 46 101 L 46 99 L 48 98 L 50 93 L 57 86 L 57 84 L 63 79 L 63 77 L 77 63 L 79 63 L 84 57 L 86 57 L 88 54 L 90 54 L 92 51 L 94 51 L 95 49 L 97 49 L 98 47 L 103 45 L 104 43 L 106 43 L 106 42 L 112 40 L 113 38 L 115 38 L 117 36 L 120 36 L 120 35 L 128 32 L 128 31 L 131 31 L 131 30 L 134 30 L 136 28 L 139 28 L 139 27 L 142 27 L 142 26 L 146 26 L 146 25 L 149 25 L 149 24 L 154 24 L 154 23 L 163 22 L 163 21 L 170 21 L 170 20 L 179 20 L 179 19 L 1075 19 L 1075 20 L 1084 20 L 1084 21 L 1091 21 L 1091 22 L 1101 23 L 1101 24 L 1112 26 L 1112 27 L 1121 29 L 1123 31 L 1126 31 L 1128 33 L 1131 33 L 1131 34 L 1133 34 L 1133 35 L 1135 35 L 1135 36 L 1145 40 L 1146 42 L 1152 44 L 1153 46 L 1158 48 L 1160 51 L 1165 53 L 1167 56 L 1169 56 L 1173 61 L 1175 61 L 1193 79 L 1193 81 L 1202 90 L 1202 92 L 1204 93 L 1204 95 L 1207 97 L 1208 101 L 1212 105 L 1215 113 L 1217 114 L 1218 119 L 1219 119 L 1219 121 L 1220 121 L 1220 123 L 1221 123 L 1221 125 L 1223 127 L 1223 130 L 1225 132 L 1225 135 L 1226 135 L 1226 138 L 1227 138 L 1227 141 L 1228 141 L 1228 144 L 1229 144 L 1229 148 L 1230 148 L 1230 152 L 1231 152 L 1231 156 L 1232 156 L 1232 161 L 1233 161 L 1234 175 L 1235 175 L 1235 1081 L 1234 1081 L 1234 1089 L 1233 1089 L 1233 1094 L 1232 1094 L 1230 1108 L 1229 1108 L 1229 1111 L 1228 1111 L 1228 1115 L 1227 1115 L 1226 1121 L 1225 1121 L 1224 1126 L 1222 1128 L 1222 1131 L 1221 1131 L 1221 1133 L 1220 1133 L 1220 1135 L 1219 1135 L 1215 1145 L 1213 1146 L 1211 1152 L 1209 1153 L 1209 1155 L 1207 1156 L 1205 1161 L 1202 1163 L 1202 1165 L 1199 1167 L 1199 1169 L 1195 1172 Z";
  const reportLogoMarkup = logoSvgRaw
    .replace(/<\?xml[^>]*\?>/i, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace('<svg ', '<svg style="width: 42px; height: 42px; flex-shrink: 0; color: #1f2937;" ')
    .replace('role="img"', 'aria-hidden="true"')
    .replace('aria-labelledby="title desc"', '')
    .trim()
    || `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" style="width: 42px; height: 42px; flex-shrink: 0; color: #1f2937;" aria-hidden="true"><path d="${logoPath}" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>`;

  const renderAlertBadges = (alerts: ReturnType<typeof getHealthAssessment>['alerts']) =>
    alerts
      .map(
        (alert) => `
          <span title="${alert.description}" style="display:inline-block; padding:2px 6px; border-radius:9999px; font-size:8.5px; line-height:1.2; font-weight:600; background:${alert.badgeBg}; color:${alert.badgeText};">
            ${alert.name}
          </span>
        `
      )
      .join('');

  // Los avisos pueden ocupar más de una línea; se reduce el número de filas para evitar cortes.
  const ROWS_PER_PAGE = 10;
  const tablePagesCount = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const totalPDFPages = 1 + tablePagesCount; // Página 1 = Gráficos y Resumen

  // Generar HTML de los gráficos para la Página 1
  const svgLineChartHtml = generateChartSVG(chronological, locale, isEn);
  const categoryDistributionHtml = generateCategoryDistributionHTML(filtered, lang, takesMedication);

  // Función para construir la cabecera estándar de cualquier página
  const buildPageHeader = (pageTitle: string, pageNum: number) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${reportLogoMarkup}
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #0f172a; font-weight: 700;">${pageTitle}</h1>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">${patientInfoStr ? patientInfoStr + ' | ' : ''}<strong>${isEn ? 'Period:' : 'Periodo:'}</strong> ${realPeriodStr}</p>
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
      ${isEn ? 'Personal and private log document.' : 'Documento de registro personal y privado.'} ${getHealthDisclaimer(lang)}
    </div>
  `;

  // Array de elementos DOM temporales
  const pageContainers: HTMLDivElement[] = [];

  // ==========================================
  // PÁGINA 1: RESUMEN Y GRÁFICOS (evolución + categorías ESC 2024)
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
    ${buildPageHeader(isEn ? 'Blood Pressure Clinical Report' : 'Informe Clínico de Tensión Arterial', 1)}

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
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: center;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 2px;">${isEn ? 'Avg Systolic' : 'Promedio Sistólico'}</div>
        <div style="font-size: 19px; font-weight: 800; color: #0f172a;">${avgSys} <span style="font-size: 11px; font-weight: 400; color: #64748b;">mmHg</span></div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: center;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 2px;">${isEn ? 'Avg Diastolic' : 'Promedio Diastólico'}</div>
        <div style="font-size: 19px; font-weight: 800; color: #0f172a;">${avgDia} <span style="font-size: 11px; font-weight: 400; color: #64748b;">mmHg</span></div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: center;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 2px;">${isEn ? 'Avg Pulse' : 'Promedio Pulsaciones'}</div>
        <div style="font-size: 19px; font-weight: 800; color: #64748b;">${avgPulse} <span style="font-size: 11px; font-weight: 400; color: #64748b;">${isEn ? 'BPM' : 'ppm'}</span></div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: center;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 2px;">${isEn ? 'Global Status' : 'Estado Global'}</div>
        <div style="font-size: 13.5px; color: ${avgCategory.colorHex}; font-weight: 700; padding-top: 2px;">
          ${avgCategory.name}
        </div>
      </div>
    </div>

    <!-- 1. Gráfico de Evolución (ARRIBA - ANCHO COMPLETO 100%) -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; width: 100%; box-sizing: border-box;">
      <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>${isEn ? 'Blood Pressure Evolution' : 'Evolución Tensión Arterial'}</span>
        <div style="display: flex; gap: 12px; font-size: 9.5px; font-weight: 500; color: #64748b;">
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:7px; height:7px; background:#ef4444; border-radius:50%; display:inline-block;"></span> ${isEn ? 'Systolic' : 'Sistólica'}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:7px; height:7px; background:#3b82f6; border-radius:50%; display:inline-block;"></span> ${isEn ? 'Diastolic' : 'Diastólica'}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:7px; height:7px; background:#64748b; border-radius:50%; display:inline-block;"></span> ${isEn ? 'Pulse' : 'Pulsaciones'}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width:9px; height:7px; background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.4); display:inline-block;"></span> ${isEn ? 'Healthy Range' : 'Rango Saludable'}</span>
        </div>
      </div>
      ${svgLineChartHtml}
    </div>

    <!-- 2. Gráfico de distribución ESC 2024 -->
    ${categoryDistributionHtml}

    ${buildPageFooter()}
  `;

  pageContainers.push(page1);

  // ==========================================
  // PÁGINAS 2+: HISTORIAL DE MEDICIONES POR BLOQUES
  // ==========================================
  for (let pageIdx = 0; pageIdx < tablePagesCount; pageIdx++) {
    const pageNum = pageIdx + 2;
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

    const rowsHtml = pageSessions
      .map((s, index) => {
        const d = new Date(s.timestamp);
        const dateStr = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const sessionTakesMedication = getSessionMedicationContext(s.readings, takesMedication);
        const assessment = getHealthAssessment(
          s.averageSystolic,
          s.averageDiastolic,
          s.averageHeartRate,
          lang,
          sessionTakesMedication
        );
        const sessionAlerts = [...assessment.alerts, ...getConfirmedPulsePressureAlerts(s.readings, lang)];
        const cat = assessment.category;
        const armLabel = s.arm === 'left' ? (isEn ? 'Left' : 'Izq') : (isEn ? 'Right' : 'Der');
        const sessionTag = s.readings.length > 1 ? (isEn ? ` (Avg of ${s.readings.length} readings)` : ` (Media de ${s.readings.length} tomas)`) : '';
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
        <tr style="background-color: ${bg};">
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong>${dateStr}</strong> ${timeStr}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#ef4444;">${s.averageSystolic}</strong> mmHg</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#3b82f6;">${s.averageDiastolic}</strong> mmHg</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;"><strong style="font-size:12px; color:#64748b;">${s.averageHeartRate}</strong> ${isEn ? 'BPM' : 'ppm'}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">${armLabel}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">
            <span style="display:inline-block; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:600; background:${cat.badgeBg}; color:${cat.badgeText};">
              ${cat.name}
            </span>
            ${assessment.culprit !== 'none' ? `<div style="font-size:8.5px; color:#475569; margin-top:3px;">${getCulpritLabel(assessment.culprit, assessment.category.key, lang)}</div>` : ''}
            ${
              sessionAlerts.length > 0
                ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px;">${renderAlertBadges(sessionAlerts)}</div>`
                : ''
            }
          </td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0;">${(s.notes || '') + sessionTag}</td>
        </tr>
      `;
      })
      .join('');

    pageContainer.innerHTML = `
      ${buildPageHeader(isEn ? 'Measurement History' : 'Historial de Mediciones', pageNum)}

      <h3 style="font-size:14px; color:#1e293b; margin: 0 0 10px 0;">
        ${isEn ? `Measurements Log (${filtered.length} total records)` : `Registro de mediciones (${filtered.length} tomas totales)`}
      </h3>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; text-align: left;">
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Date & Time' : 'Fecha y Hora'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Systolic' : 'Sistólica'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Diastolic' : 'Diastólica'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Pulse' : 'Pulso'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Arm' : 'Brazo'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'BP Category / Alerts' : 'Categoría PA / Avisos'}</th>
            <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">${isEn ? 'Notes / Session' : 'Notas / Sesión'}</th>
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

      await new Promise((resolve) => setTimeout(resolve, 150));

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
function generateChartSVG(chronologicalSessions: BloodPressureSession[], locale = 'es-ES', isEn = false): string {
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
      <!-- Banda Rango Saludable -->
      <rect x="${paddingLeft}" y="${idealSysY}" width="${chartWidth}" height="${Math.max(0, idealDiaY - idealSysY)}" fill="rgba(16, 185, 129, 0.1)" rx="3" />
      <line x1="${paddingLeft}" y1="${idealSysY}" x2="${width - paddingRight}" y2="${idealSysY}" stroke="rgba(16, 185, 129, 0.4)" stroke-dasharray="3 3" />

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

// Gráfico de barras verticales por categorías europeas ESC 2024
function generateCategoryDistributionHTML(sessions: BloodPressureSession[], lang: LanguageOption = 'es', takesMedication = false): string {
  const isEn = lang === 'en';
  const total = sessions.length;

  const counts: Record<HealthSeverity, number> = {
    hypotension: 0,
    overtreatment: 0,
    optimal: 0,
    elevated: 0,
    hypertension: 0,
  };

  let hasMedicatedSessions = false;
  sessions.forEach((s) => {
    const sessionTakesMedication = getSessionMedicationContext(s.readings, takesMedication);
    hasMedicatedSessions ||= sessionTakesMedication;
    const cat = getHealthCategory(s.averageSystolic, s.averageDiastolic, lang, sessionTakesMedication);
    counts[cat.key]++;
  });
  const categoriesMap = getHealthCategoriesMap(lang, hasMedicatedSessions || takesMedication);

  const keys: HealthSeverity[] = hasMedicatedSessions ? ['hypotension', 'overtreatment', 'optimal', 'elevated', 'hypertension'] : ['hypotension', 'optimal', 'elevated', 'hypertension'];
  const maxCount = Math.max(1, ...Object.values(counts));

  const svgWidth = 720;
  const svgHeight = 135;
  const paddingTop = 22;
  const paddingBottom = 32;
  const paddingLeft = 30;
  const paddingRight = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barGroupWidth = chartWidth / keys.length;
  const barWidth = Math.min(38, barGroupWidth * 0.52);

  const barsSvgHtml = keys
    .map((key, idx) => {
      const count = counts[key];
      const pct = total > 0 ? (count / total) * 100 : 0;
      const cat = categoriesMap[key];

      const groupCenterX = paddingLeft + (idx + 0.5) * barGroupWidth;
      const barX = groupCenterX - barWidth / 2;

      const barH = count > 0 ? Math.max(8, (count / maxCount) * chartHeight) : 2;
      const barY = svgHeight - paddingBottom - barH;

      const labelText = count > 0 ? `${count} (${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%)` : '0';
      const labelY = Math.max(12, barY - 4);
      const xLabel = cat.name;

      return `
        <g>
          <!-- Barra vertical por categoría ESC 2024 -->
          <rect
            x="${barX}"
            y="${barY}"
            width="${barWidth}"
            height="${barH}"
            fill="${count > 0 ? cat.colorHex : '#e2e8f0'}"
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
      <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>${isEn ? 'Distribution by BP Category' : 'Distribución por Categorías de PA'}</span>
        <span style="font-size: 10px; color: #64748b; font-weight: 500;">${total} ${isEn ? 'readings total' : 'tomas totales'}</span>
      </div>

      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; overflow:visible; display:block; margin: 0 auto;">
        <!-- Línea Base Eje X -->
        <line x1="${paddingLeft}" y1="${svgHeight - paddingBottom}" x2="${svgWidth - paddingRight}" y2="${svgHeight - paddingBottom}" stroke="#cbd5e1" stroke-width="1" />

        ${barsSvgHtml}
      </svg>
    </div>
  `;
}
