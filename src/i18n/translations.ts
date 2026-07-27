import type { LanguageOption } from '../types/bloodPressure';

export const translations = {
  es: {
    // Header
    header: {
      title: 'Control Tensión Arterial',
      subtitle: 'Registro diario y análisis de presión sanguínea',
      exportBtn: 'Exportar / Imprimir',
      badgePrivate: 'Privado & Offline',
      exportTooltip: 'Exportar e Importar datos (CSV / PDF)',
      settingsTooltip: 'Configuración',
      darkMode: 'Modo Oscuro',
      lightMode: 'Modo Claro',
    },

    // Formulario de lectura
    form: {
      title: 'Nueva Lectura de Tensión',
      modeKeyboard: 'Teclado',
      modeWheel: 'Rueda',
      systolic: 'Sistólica',
      diastolic: 'Diastólica',
      heartRate: 'Pulsaciones',
      armLabel: 'Brazo:',
      armLeft: 'Izquierdo',
      armRight: 'Derecho',
      notesPlaceholder: 'Notas opcionales (ej. tras caminar 15 min)...',
      submit: 'Guardar Medición',
      validationAlert: 'Por favor, introduce valores válidos para Sistólica, Diastólica y Pulsaciones.',
    },

    // Banner Bata Blanca
    whiteCoatBanner: {
      activeTitle: 'Filtro Bata Blanca Activo',
      inactiveTitle: 'Filtro Bata Blanca Inactivo',
      activeDesc: 'Eliminando tomas iniciales elevadas en mediciones continuadas ({mins} min).',
      inactiveDesc: 'Puedes activar el filtrado automático de sesgo de ansiedad en configuración.',
      configure: 'Configurar',
    },

    // Gráfico y Estadísticas
    trend: {
      title: 'Tendencia y Evolución',
      avgSystolic: 'Promedio Sistólica',
      avgDiastolic: 'Promedio Diastólica',
      avgHeartRate: 'Promedio Pulsaciones',
      totalSessions: 'Total Sesiones',
      sysShort: 'Sistólica',
      diaShort: 'Diastólica',
      bpmShort: 'Pulsaciones',
      sessionAverage: 'Promedio sesión',
      noData: 'Sin datos en el rango seleccionado',
      categories: {
        optimal: { name: 'Óptima', desc: 'Sistólica < 120 y Diastólica < 80 mmHg' },
        normal: { name: 'Normal', desc: 'Sistólica 120-129 y/o Diastólica 80-84 mmHg' },
        elevated: { name: 'Normal - Alta', desc: 'Sistólica 130-139 y/o Diastólica 85-89 mmHg' },
        stage1: { name: 'Hipertensión Grado 1', desc: 'Sistólica 140-159 y/o Diastólica 90-99 mmHg' },
        stage2: { name: 'Hipertensión Grado 2', desc: 'Sistólica 160-179 y/o Diastólica 100-109 mmHg' },
        crisis: { name: 'Crisis Hipertensiva', desc: 'Sistólica ≥ 180 y/o Diastólica ≥ 110 mmHg' },
      },
    },

    // Lista de lecturas
    list: {
      title: 'Historial de Mediciones',
      editHint: 'Para modificar datos mantener pulsado',
      preset7Days: '7 Días',
      preset30Days: '30 Días',
      preset90Days: '90 Días',
      presetAll: 'Todo',
      readingsCount: '{count} toma(s)',
      whiteCoatDiscarded: 'Descartadas por Bata Blanca: {count}',
      arm: 'Brazo',
      armLeft: 'Izquierdo',
      armRight: 'Derecho',
      editBtn: 'Editar',
      deleteSessionConfirm: '¿Seguro que deseas eliminar esta sesión de medición?',
      deleteReadingConfirm: '¿Seguro que deseas eliminar esta toma individual?',
      emptyState: 'No hay mediciones registradas en el periodo seleccionado.',
    },

    // Modal de Edición
    editModal: {
      title: 'Editar',
      systolic: 'Sistólica',
      diastolic: 'Diastólica',
      heartRate: 'Pulsaciones',
      notesPlaceholder: 'Añadir o corregir observaciones...',
      save: 'Guardar Cambios',
      cancel: 'Cancelar',
    },

    // Configuración
    settings: {
      title: 'Configuración',
      close: 'Cerrar',
      languageTitle: 'Idioma de la aplicación:',
      langSpanish: 'Español (ES)',
      langEnglish: 'English (EN)',
      patientProfile: 'Perfil del paciente:',
      patientProfileDesc: 'Datos personales que se mostrarán en los informes y exportaciones.',
      fullName: 'Nombre completo:',
      fullNamePlaceholder: 'Ej. Juan Pérez',
      sexLabel: 'Sexo:',
      sexMale: 'Masculino',
      sexFemale: 'Femenino',
      age: 'Edad (años):',
      agePlaceholder: '65',
      birthDate: 'Fecha de nacimiento:',
      backupTitle: 'Copias de Seguridad:',
      backupDesc: 'Frecuencia para guardar automáticamente copias CSV en el almacenamiento local.',
      backupDaily: 'Diarias (00:00)',
      backupWeekly: 'Semanales',
      backupMonthly: 'Mensuales',
      backupDisabled: 'Desactivadas',
      storageTitle: 'Almacenamiento en dispositivo:',
      storageDesc: 'Las copias de seguridad, automáticas y manuales, se guardan en la carpeta predeterminada de Descargas del dispositivo.',
      lastBackup: 'Última copia:',
      lastBackupNone: 'Ninguna copia realizada todavía',
      downloadBackup: 'Descargar copia',
      whiteCoatTitle: 'Filtro Síndrome bata blanca',
      whiteCoatDesc: 'Si realiza varias mediciones continuadas distanciadas entre ellas menos del intervalo de tiempo definido, se descartarán las primeras tomas elevadas para eliminar el sesgo de ansiedad inicial, con el resto de los datos se calcula la media y se almacena como una única medición.',
      intervalLabel: 'Intervalo máximo entre tomas consecutivas:',
      minutesText: '{mins} minutos',
      defaultArmTitle: 'Brazo utilizado por defecto:',
      defaultArmLeft: 'Brazo Izquierdo',
      defaultArmRight: 'Brazo Derecho',
      resetDemo: 'Restaurar datos Demo',
      clearAll: 'Eliminar todos los datos',
    },

    // Exportación e Importación
    export: {
      title: 'Exportación e Importación de Datos',
      tabPdf: 'Exportar PDF (Informe Clínico)',
      tabCsv: 'Exportar / Importar CSV',
      pdfSectionTitle: 'Generar Informe Médico PDF',
      filterRangeLabel: 'Rango de datos a incluir:',
      hidePatientData: 'Ocultar datos personales en el informe',
      clinicalNotesLabel: 'Observaciones / Notas para el profesional médico:',
      clinicalNotesPlaceholder: 'Añadir notas médicas o contexto de salud...',
      downloadPdf: 'Descargar Informe PDF',
      openPdfBtn: 'Abrir PDF',
      csvExportTitle: 'Exportar Copia de Seguridad CSV',
      csvExportDesc: 'Descarga un archivo CSV compatible con Hojas de Cálculo y copias de seguridad.',
      downloadCsv: 'Descargar Archivo CSV',
      csvImportTitle: 'Importar Datos desde CSV',
      csvImportDesc: 'Selecciona un archivo CSV guardado previamente para restaurar tu historial.',
      selectCsv: 'Seleccionar archivo CSV...',
      previewTitle: 'VISTA PREVIA DEL INFORME',
    },

    // Aviso Legal
    legal: {
      title: 'Aviso Legal & Política de Privacidad',
      footerLink: 'Aviso Legal & Privacidad (RGPD)',
      close: 'Entendido y Cerrar',
    },

    // Notificaciones Toast y Alertas
    toast: {
      autoBackup: '✓ Copia de seguridad automática CSV guardada ({date})',
      importedCount: '✓ Se han importado {count} registros nuevos.',
      noDataToExport: 'No hay registros suficientes para exportar copia de seguridad.',
      manualBackupSuccess: '✓ Copia de seguridad CSV descargada en tu carpeta Descargas.',
      pdfDownloadStarting: 'Generando informe PDF...',
      pdfDownloadSuccess: 'Informe descargado',
      resetDemoConfirm: '¿Deseas restaurar los datos de ejemplo predeterminados?',
      resetDemoSuccess: '✓ Se han restaurado los datos de ejemplo.',
      clearAllConfirm: '¿Seguro que deseas ELIMINAR TODOS los datos? Esta acción borrará permanentemente todo tu historial.',
      clearAllSuccess: '✓ Se han eliminado todos los datos de la aplicación.',
      updateSuccess: '✓ Toma de tensión actualizada correctamente.',
    },

    // Generador de PDF e Informes
    pdfReport: {
      title: 'INFORME CLÍNICO DE TENSIÓN ARTERIAL',
      subtitle: 'Seguimiento y Registro para Control Médico',
      patientLabel: 'PACIENTE:',
      ageLabel: 'Edad:',
      sexLabel: 'Sexo:',
      periodLabel: 'Período del informe:',
      totalReadingsLabel: 'Total lecturas procesadas:',
      averageLabel: 'Promedio Global:',
      observationsLabel: 'OBSERVACIONES / NOTAS:',
      thDate: 'Fecha / Hora',
      thSys: 'SYS (mmHg)',
      thDia: 'DIA (mmHg)',
      thBpm: 'PPM',
      thCategory: 'Categoría OMS',
      thArm: 'Brazo',
      thNotes: 'Notas',
      footerNotice: 'Documento de registro personal y privado. No constituye diagnóstico médico.',
    },
  },

  en: {
    // Header
    header: {
      title: 'Control Tensión Arterial',
      subtitle: 'Daily blood pressure logging and analysis',
      exportBtn: 'Export / Print',
      badgePrivate: 'Private & Offline',
      exportTooltip: 'Export & Import data (CSV / PDF)',
      settingsTooltip: 'Settings',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
    },

    // Reading Form
    form: {
      title: 'New Pressure Reading',
      modeKeyboard: 'Keyboard',
      modeWheel: 'Wheel',
      systolic: 'Systolic',
      diastolic: 'Diastolic',
      heartRate: 'Pulse',
      armLabel: 'Arm:',
      armLeft: 'Left',
      armRight: 'Right',
      notesPlaceholder: 'Optional notes (e.g. after 15 min walk)...',
      submit: 'Save Reading',
      validationAlert: 'Please enter valid values for Systolic, Diastolic, and Pulse.',
    },

    // White Coat Banner
    whiteCoatBanner: {
      activeTitle: 'White Coat Filter Active',
      inactiveTitle: 'White Coat Filter Inactive',
      activeDesc: 'Discarding initial elevated readings in continuous measurements ({mins} min).',
      inactiveDesc: 'You can enable automatic anxiety bias filtering in settings.',
      configure: 'Configure',
    },

    // Trend & Stats
    trend: {
      title: 'Trend & Evolution',
      avgSystolic: 'Avg Systolic',
      avgDiastolic: 'Avg Diastolic',
      avgHeartRate: 'Avg Pulse',
      totalSessions: 'Total Sessions',
      sysShort: 'Systolic',
      diaShort: 'Diastolic',
      bpmShort: 'Pulse',
      sessionAverage: 'Session average',
      noData: 'No data in selected range',
      categories: {
        optimal: { name: 'Optimal', desc: 'Systolic < 120 and Diastolic < 80 mmHg' },
        normal: { name: 'Normal', desc: 'Systolic 120-129 and/or Diastolic 80-84 mmHg' },
        elevated: { name: 'Elevated', desc: 'Systolic 130-139 and/or Diastolic 85-89 mmHg' },
        stage1: { name: 'Stage 1 Hypertension', desc: 'Systolic 140-159 and/or Diastolic 90-99 mmHg' },
        stage2: { name: 'Stage 2 Hypertension', desc: 'Systolic 160-179 and/or Diastolic 100-109 mmHg' },
        crisis: { name: 'Hypertensive Crisis', desc: 'Systolic ≥ 180 and/or Diastolic ≥ 110 mmHg' },
      },
    },

    // Reading List
    list: {
      title: 'Measurement History',
      editHint: 'To modify data hold press',
      preset7Days: '7 Days',
      preset30Days: '30 Days',
      preset90Days: '90 Days',
      presetAll: 'All',
      readingsCount: '{count} reading(s)',
      whiteCoatDiscarded: 'Discarded by White Coat: {count}',
      arm: 'Arm',
      armLeft: 'Left',
      armRight: 'Right',
      editBtn: 'Edit',
      deleteSessionConfirm: 'Are you sure you want to delete this measurement session?',
      deleteReadingConfirm: 'Are you sure you want to delete this single reading?',
      emptyState: 'No readings recorded in the selected period.',
    },

    // Edit Modal
    editModal: {
      title: 'Edit',
      systolic: 'Systolic',
      diastolic: 'Diastolic',
      heartRate: 'Pulse',
      notesPlaceholder: 'Add or correct observations...',
      save: 'Save Changes',
      cancel: 'Cancel',
    },

    // Settings
    settings: {
      title: 'Settings',
      close: 'Close',
      languageTitle: 'Application Language:',
      langSpanish: 'Español (ES)',
      langEnglish: 'English (EN)',
      patientProfile: 'Patient Profile:',
      patientProfileDesc: 'Personal details shown in reports and exports.',
      fullName: 'Full name:',
      fullNamePlaceholder: 'e.g. John Doe',
      sexLabel: 'Sex:',
      sexMale: 'Male',
      sexFemale: 'Female',
      age: 'Age (years):',
      agePlaceholder: '65',
      birthDate: 'Date of birth:',
      backupTitle: 'Backups:',
      backupDesc: 'Frequency for automatically saving CSV backups to local storage.',
      backupDaily: 'Daily (00:00)',
      backupWeekly: 'Weekly',
      backupMonthly: 'Monthly',
      backupDisabled: 'Disabled',
      storageTitle: 'Device Storage:',
      storageDesc: 'Automatic and manual backups are saved in the default Downloads folder of the device.',
      lastBackup: 'Last backup:',
      lastBackupNone: 'No backup completed yet',
      downloadBackup: 'Download backup',
      whiteCoatTitle: 'White Coat Syndrome Filter',
      whiteCoatDesc: 'If you take multiple continuous measurements spaced less than the defined interval, the initial elevated readings will be discarded to eliminate anxiety bias, and the average of the remaining data will be stored as a single measurement.',
      intervalLabel: 'Maximum interval between consecutive readings:',
      minutesText: '{mins} minutes',
      defaultArmTitle: 'Default arm used:',
      defaultArmLeft: 'Left Arm',
      defaultArmRight: 'Right Arm',
      resetDemo: 'Restore Demo Data',
      clearAll: 'Delete All Data',
    },

    // Export & Import
    export: {
      title: 'Data Export & Import',
      tabPdf: 'Export PDF (Clinical Report)',
      tabCsv: 'Export / Import CSV',
      pdfSectionTitle: 'Generate Medical PDF Report',
      filterRangeLabel: 'Data range to include:',
      hidePatientData: 'Hide personal data in report',
      clinicalNotesLabel: 'Remarks / Notes for medical professional:',
      clinicalNotesPlaceholder: 'Add medical notes or health context...',
      downloadPdf: 'Download PDF Report',
      openPdfBtn: 'Open PDF',
      csvExportTitle: 'Export CSV Backup',
      csvExportDesc: 'Download a CSV file compatible with Spreadsheets and backups.',
      downloadCsv: 'Download CSV File',
      csvImportTitle: 'Import Data from CSV',
      csvImportDesc: 'Select a previously saved CSV file to restore your history.',
      selectCsv: 'Select CSV file...',
      previewTitle: 'REPORT PREVIEW',
    },

    // Legal Notice
    legal: {
      title: 'Legal Notice & Privacy Policy',
      footerLink: 'Legal Notice & Privacy (GDPR)',
      close: 'Understood & Close',
    },

    // Toast Notifications & Alerts
    toast: {
      autoBackup: '✓ Automatic CSV backup saved ({date})',
      importedCount: '✓ Imported {count} new records.',
      noDataToExport: 'Not enough records to export backup.',
      manualBackupSuccess: '✓ CSV backup downloaded to your Downloads folder.',
      pdfDownloadStarting: 'Generating PDF report...',
      pdfDownloadSuccess: 'Report downloaded',
      resetDemoConfirm: 'Do you want to restore default example data?',
      resetDemoSuccess: '✓ Default example data restored.',
      clearAllConfirm: 'Are you sure you want to DELETE ALL data? This action will permanently erase all your history.',
      clearAllSuccess: '✓ All application data has been deleted.',
      updateSuccess: '✓ Pressure reading updated successfully.',
    },

    // PDF Report Generator
    pdfReport: {
      title: 'BLOOD PRESSURE CLINICAL REPORT',
      subtitle: 'Tracking and Registry for Medical Monitoring',
      patientLabel: 'PATIENT:',
      ageLabel: 'Age:',
      sexLabel: 'Sex:',
      periodLabel: 'Report Period:',
      totalReadingsLabel: 'Total processed readings:',
      averageLabel: 'Global Average:',
      observationsLabel: 'REMARKS / NOTES:',
      thDate: 'Date / Time',
      thSys: 'SYS (mmHg)',
      thDia: 'DIA (mmHg)',
      thBpm: 'BPM',
      thCategory: 'WHO Category',
      thArm: 'Arm',
      thNotes: 'Notes',
      footerNotice: 'Personal and private log document. Does not constitute a medical diagnosis.',
    },
  },
} as const;

export type TranslationSchema = typeof translations.es;

/**
 * Función auxiliar para obtener un texto traducido por clave con interpolación de parámetros.
 * Ejemplo: getTranslation('es', 'form.title') o getTranslation('es', 'whiteCoatBanner.activeDesc', { mins: 5 })
 */
export function getTranslation(
  lang: LanguageOption,
  path: string,
  params?: Record<string, string | number>
): string {
  const keys = path.split('.');
  let current: any = translations[lang] || translations.es;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      // Fallback a español si no se encuentra la clave
      let fallback: any = translations.es;
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return path;
        }
      }
      current = fallback;
      break;
    }
  }

  if (typeof current !== 'string') {
    return path;
  }

  if (!params) return current;

  let result = current;
  Object.entries(params).forEach(([paramKey, val]) => {
    result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
  });

  return result;
}
