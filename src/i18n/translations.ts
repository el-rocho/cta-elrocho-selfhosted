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
      whiteCoatFilterActive: 'Filtro {minutes} min activo',
      validationAlert: 'Por favor, introduce valores válidos para Sistólica, Diastólica y Pulsaciones.',
      diastolicMustBeLower: 'La presión diastólica debe ser menor que la sistólica. Revisa los valores: esta medición no se puede guardar.',
      pulsePressureTitle: 'Revisa el manguito y repite la medición',
      pulsePressureWarning: 'La diferencia entre sistólica y diastólica parece desajustada. Si ya has repetido la toma y confirmas que es correcta, puedes guardar los datos.',
      cancel: 'Cancelar',
      forceSave: 'Confirmar y guardar',
      measurementGuideTooltip: '¿Cómo realizar una medición válida?',
      measurementGuideTitle: 'Cómo realizar una medición válida',
      measurementGuideClose: 'Cerrar recomendaciones',
      measurementGuideEssentialsTitle: 'Preparación y postura correctas',
      measurementGuideIntro: 'Utilizar tensiómetro',
      measurementGuideIntroStrong: 'validado, de brazo y con manguito de tamaño adecuado',
      measurementGuideSameArm: 'Medir habitualmente el mismo brazo y horario similar de mañana y tarde.',
      measurementGuidePreparationTitle: 'Preparación:',
      measurementGuidePreparation: 'Evita comidas, café, tabaco y ejercicio durante los 30 minutos anteriores. Vacía la vejiga.',
      measurementGuideRestTitle: 'Reposo:',
      measurementGuideRest: 'Siéntate y descansa tranquilamente durante 5 minutos.',
      measurementGuidePostureTitle: 'Postura:',
      measurementGuidePosture: 'Espalda apoyada, los pies en el suelo y las piernas sin cruzar.',
      measurementGuideArmTitle: 'Brazo:',
      measurementGuideArm: 'Coloca el manguito sobre la piel, sin ropa que comprima. Apoya el brazo relajado, con el manguito a la altura del corazón.',
      measurementGuideDuringTitle: 'Durante la medición:',
      measurementGuideDuring: 'Relajado, no hables, no te muevas ni utilices el móvil.',
      measurementGuideAdviceTitle: 'Consejo:',
      measurementGuideAdviceStart: 'Realiza',
      measurementGuideAdviceStrong: 'tres tomas separadas entre 1 y 2 minutos',
      measurementGuideAdviceEnd: 'descarta la primera y calcula la media de las dos últimas',
      measurementGuideAdviceAlternative: 'o activa el',
      measurementGuideFilter: 'Filtro de bata blanca',
      measurementGuideFilterEnd: 'de la aplicación.',
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
      title: 'Evolución a largo plazo',
      range28Days: '4 semanas',
      range3Months: '3 meses',
      range6Months: '6 meses',
      range1Year: '1 año',
      dailyAverage: 'Media diaria',
      dailyAveragesCount: '{days} día(s) con media',
      sessionsOnDay: '{count} sesión(es) efectiva(s) este día',
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
        hypotension: { unmedicatedName: 'Hipotensión', unmedicatedDesc: 'Sistólica < 90 o diastólica < 60 mmHg', medicatedName: 'Hipotensión severa', medicatedDesc: 'Sistólica < 90 o diastólica < 60 mmHg' },
        overtreatment: { unmedicatedName: 'Valor bajo', unmedicatedDesc: 'Categoría usada solo con medicación', medicatedName: 'Subóptimo', medicatedDesc: 'Si se repite en varias mediciones puedes consultar con tu médico por si desea revisar el tratamiento, dependerá de tu caso en particular.' },
        optimal: { unmedicatedName: 'Óptimo', unmedicatedDesc: 'Sistólica 90–119 y diastólica 60–79 mmHg', medicatedName: 'Óptimo', medicatedDesc: 'Sistólica 115–124 y diastólica 65–74 mmHg' },
        elevated: { unmedicatedName: 'Presión elevada', unmedicatedDesc: 'Sistólica 120–134 o diastólica 80–84 mmHg', medicatedName: 'Subóptimo', medicatedDesc: 'Si se repite en varias mediciones puedes consultar con tu médico por si desea revisar el tratamiento, dependerá de tu caso en particular.' },
        hypertension: { unmedicatedName: 'Hipertensión', unmedicatedDesc: 'Sistólica ≥ 135 o diastólica ≥ 85 mmHg', medicatedName: 'Hipertensión', medicatedDesc: 'Sistólica ≥ 135 o diastólica ≥ 85 mmHg' },
      },
    },

    guidelines: {
      common: {
        low: { name: 'Lectura baja', desc: 'Sistólica inferior a 90 o diastólica inferior a 60 mmHg. Valora repetir la medición y cómo te encuentras.' },
        extreme: { name: 'Lectura muy alta', desc: 'Sistólica igual o superior a 180 o diastólica igual o superior a 120 mmHg.' },
      },
      esc2024: {
        name: 'Europea ESC 2024',
        description: 'Clasificación ESC 2024 para medias domiciliarias.',
        categories: {
          normal: { name: 'Presión no elevada', desc: 'Sistólica < 120 y diastólica < 70 mmHg.' },
          elevated: { name: 'Presión elevada', desc: 'Sistólica 120–134 o diastólica 70–84 mmHg.' },
          hypertension: { name: 'Sobre el umbral domiciliario', desc: 'Sistólica ≥ 135 o diastólica ≥ 85 mmHg.' },
        },
      },
      ahaAcc2025: {
        name: 'Estadounidense AHA/ACC 2025',
        description: 'Categorías AHA/ACC 2025 aplicadas al registro domiciliario.',
        categories: {
          normal: { name: 'Normal', desc: 'Sistólica < 120 y diastólica < 80 mmHg.' },
          elevated: { name: 'Presión elevada', desc: 'Sistólica 120–129 y diastólica < 80 mmHg.' },
          stage1: { name: 'Hipertensión fase 1', desc: 'Sistólica 130–139 o diastólica 80–89 mmHg.' },
          stage2: { name: 'Hipertensión fase 2', desc: 'Sistólica ≥ 140 o diastólica ≥ 90 mmHg.' },
        },
      },
      ish2020: {
        name: 'Internacional ISH 2020',
        description: 'Comparación simplificada con el umbral domiciliario ISH 2020.',
        categories: {
          belowThreshold: { name: 'Por debajo del umbral', desc: 'Sistólica < 135 y diastólica < 85 mmHg.' },
          aboveThreshold: { name: 'Sobre el umbral domiciliario', desc: 'Sistólica ≥ 135 o diastólica ≥ 85 mmHg.' },
        },
      },
    },

    trendInsights: {
      title: 'Evolución detectada',
      insufficientTitle: 'Aún no hay datos suficientes',
      insufficientDesc: 'Se necesitan al menos {requiredSessions} sesiones efectivas repartidas en {requiredDays} días dentro de cuatro semanas. Disponibles: {sessions} sesiones en {days} días.',
      readySummary: '{sessions} sesiones efectivas en {days} días · media del periodo {systolic}/{diastolic}',
      period: 'Periodo evaluado: {start} – {end}',
      comparisonTitle: 'Comparación entre quincenas',
      firstFortnight: 'Primeros 14 días',
      lastFortnight: 'Últimos 14 días',
      daysWithData: '{days} día(s) con datos',
      difference: 'Diferencia',
      coverageSupported: 'Cobertura suficiente',
      coverageSparse: 'Datos escasos',
      sparseExplanation: 'Comparación orientativa basada en pocas fechas. Se muestran los valores para su revisión, sin interpretar el cambio como una tendencia confirmada.',
      noPatternTitle: 'Sin patrón repetido con estas reglas',
      noPatternDesc: 'Hay datos suficientes para el análisis, pero no se repiten valores altos o bajos en al menos dos tercios de los días evaluados.',
      aboveTitle: 'Valores repetidos sobre el umbral',
      aboveDesc: 'En {matchingDays} de {totalDays} días, la media diaria estuvo sobre el umbral de la guía seleccionada. Media del periodo: {systolic}/{diastolic} mmHg.',
      lowTitle: 'Valores bajos repetidos',
      lowDesc: 'En {matchingDays} de {totalDays} días, la media diaria tuvo una sistólica inferior a 90 o una diastólica inferior a 60. Media del periodo: {systolic}/{diastolic} mmHg.',
      disclaimer: 'Evolución de las últimas cuatro semanas disponibles. No constituye un diagnóstico.',
    },

    healthAlerts: {
      title: 'Avisos informativos',
      disclaimer: 'Información orientativa basada en {guideline}. La aplicación no realiza diagnósticos ni permite ajustar la medicación. Una medición aislada debe interpretarse con cautela.',
      extremeHighPressure: {
        name: 'Aviso por lectura muy alta ({systolic}/{diastolic})',
        desc: 'Repite la medición tras permanecer sentado y en reposo. Si presenta dolor torácico, dificultad respiratoria, debilidad o adormecimiento súbito, dificultad para hablar, alteración visual, confusión o desmayo, puede tratarse de una urgencia médica; valore llamar al 112.',
      },
      lowBloodPressure: {
        name: 'Valor bajo ({systolic}/{diastolic})',
        desc: 'La sistólica es inferior a 90 o la diastólica es inferior a 60 mmHg. No siempre representa una urgencia; repite la medición y valora cómo te encuentras.',
      },
      narrowPulsePressure: {
        name: 'PP estrecha ({value})',
        desc: 'Presión de pulso inferior a 25 mmHg. Repite la medición y consulta si persiste o hay síntomas.',
      },
      widePulsePressure: {
        name: 'PP ancha ({value})',
        desc: 'Presión de pulso superior a 60 mmHg. Su relevancia depende de la edad y del contexto clínico.',
      },
      bradycardia: {
        name: 'Pulso bajo ({value} ppm)',
        desc: 'Frecuencia inferior a 50 ppm en reposo. Puede ser habitual en deportistas entrenados.',
      },
      tachycardia: {
        name: 'Pulso alto ({value} ppm)',
        desc: 'Frecuencia superior a 100 ppm en reposo. Repite la medición tras descansar.',
      },
      hypotensionTachycardia: {
        name: 'Hipotensión + pulso alto',
        desc: 'Combinación que conviene repetir y valorar, especialmente si hay mareo, debilidad o desmayo.',
      },
      hypertensionTachycardia: {
        name: 'Hipertensión + pulso alto',
        desc: 'Combinación que supone una carga hemodinámica elevada y merece seguimiento.',
      },
    },
    healthAssessment: { culprit: {
      low: { systolic: 'Sistólica baja', diastolic: 'Diastólica baja', both: 'Sistólica y diastólica bajas' },
      high: { systolic: 'Sistólica elevada', diastolic: 'Diastólica elevada', both: 'Sistólica y diastólica elevadas' },
    } },

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
      dateTimeTitle: 'Fecha y hora de la toma',
      date: 'Fecha',
      time: 'Hora',
      dateTimeRequired: 'Introduce una fecha y una hora válidas.',
      dateTimeFuture: 'La fecha y la hora no pueden estar en el futuro.',
      systolic: 'Sistólica',
      diastolic: 'Diastólica',
      heartRate: 'Pulsaciones',
      notesPlaceholder: 'Añadir o corregir observaciones...',
      save: 'Guardar Cambios',
      cancel: 'Cancelar',
    },

    treatmentTarget: {
      status: { within: 'Objetivo', below: '↓ Objetivo', above: '↑ Objetivo', mixed: '↕ Objetivo' },
      sourceGuideline: 'Objetivo recomendado por la guía',
      sourceCustom: 'Objetivo indicado por el médico',
    },

    // Configuración
    settings: {
      title: 'Configuración',
      close: 'Cerrar',
      languageTitle: 'Idioma de la aplicación:',
      langSpanish: 'Español (ES)',
      langEnglish: 'English (EN)',
      guidelineTitle: 'Referencia para el semáforo:',
      guidelineDesc: 'Cambia la clasificación y los textos informativos; no modifica ninguna medición guardada.',
      guidelineEsc: 'Europea ESC 2024',
      guidelineEscDesc: 'Umbrales domiciliarios: no elevada, elevada y sobre 135/85.',
      guidelineAha: 'Estadounidense AHA/ACC 2025',
      guidelineAhaDesc: 'Normal, elevada, hipertensión fase 1 y fase 2.',
      guidelineIsh: 'Internacional ISH 2020',
      guidelineIshDesc: 'Comparación simple por debajo o por encima de 135/85 en domicilio.',
      patientProfile: 'Perfil del paciente:',
      fullName: 'Nombre completo:',
      fullNamePlaceholder: 'Ej. Juan Pérez',
      sexMale: 'Masculino',
      sexFemale: 'Femenino',
      medicationLabel: '¿Toma medicación antihipertensiva?',
      medicationYes: 'SÍ toma medicación',
      medicationNo: 'NO toma medicación',
      medicationChangeTitle: 'Cambiar contexto de medicación',
      medicationChangeYes: 'sí tomas medicación antihipertensiva',
      medicationChangeNo: 'no tomas medicación antihipertensiva',
      medicationChangeValuesUnchanged: 'Los valores de las mediciones no cambian.',
      medicationChangeMessage: '¿Qué quieres hacer con el contexto de medicación guardado en el historial? El semáforo depende de la guía seleccionada, no de este dato.',
      medicationKeepHistory: 'Conservar historial',
      medicationKeepHistoryDesc: 'Mantiene los avisos y comentarios que tenía cada toma cuando fue registrada. Solo las futuras mediciones usarán la nueva configuración. Usa esta opción si se trata de un cambio real de contexto.',
      medicationRecalculateHistory: 'Recalcular todo',
      medicationRecalculateHistoryDesc: 'Recalcula todos los avisos y comentarios de las mediciones. Usa esta opción si las mediciones guardadas se realizaron sin el contexto de medicación correcto.',
      medicationKeepButton: 'Conservar',
      medicationRecalculateButton: 'Recalcular',
      medicationChangeCancel: 'Cancelar',
      medicationChangeFailed: 'No se pudo actualizar el contexto de medicación. No se han aplicado todos los cambios.',
      targetTitle: 'Objetivo del tratamiento',
      targetGuideline: 'Recomendado por la guía',
      targetSystolicMin: 'Sistólica mínima', targetSystolicMax: 'Sistólica máxima', targetDiastolicMin: 'Diastólica mínima', targetDiastolicMax: 'Diastólica máxima',
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
      csvImportDesc: 'Selecciona una copia CSV de la aplicación o un archivo exportado por MyTherapy.',
      selectCsv: 'Seleccionar archivo CSV...',
      importPreviewTitle: 'Revisar antes de importar',
      importFormatNative: 'Copia de seguridad de Control Tensión Arterial',
      importFormatMyTherapy: 'Archivo de datos MyTherapy detectado',
      importReadingsReady: 'mediciones preparadas',
      importRowsIgnored: 'registros no relacionados ignorados',
      importShorthandNormalized: 'mediciones abreviadas normalizadas',
      importInvalidReadings: 'mediciones inválidas descartadas',
      importMyTherapyNotice: 'MyTherapy no indica el brazo. Se utilizará el brazo predeterminado: {arm}. Los registros de medicación, analíticas y actividad no se importarán.',
      importShorthandNotice: 'Se han interpretado {count} mediciones abreviadas, por ejemplo 12/8 como 120/80. Confirma el resumen antes de continuar.',
      importIncompleteNotice: '{count} grupos no contenían el mismo número de valores sistólicos, diastólicos y de pulso; solo se conservarán las mediciones completas.',
      confirmImport: 'Confirmar importación',
      selectAnotherCsv: 'Elegir otro archivo',
      importNoValidReadings: 'No se encontraron mediciones de tensión válidas o el formato del archivo no es reconocible.',
      importReadError: 'No se pudo leer el archivo CSV seleccionado.',
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
      thCategory: 'Categoría PA',
      thArm: 'Brazo',
      thNotes: 'Notas',
      footerNotice: 'Documento de registro personal. Información orientativa basada en ESC 2024; los umbrales no reproducen literalmente las guías y pueden contener errores.',
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
      whiteCoatFilterActive: '{minutes} min filter active',
      validationAlert: 'Please enter valid values for Systolic, Diastolic, and Pulse.',
      diastolicMustBeLower: 'Diastolic pressure must be lower than systolic pressure. Check the values: this reading cannot be saved.',
      pulsePressureTitle: 'Check the cuff and repeat the reading',
      pulsePressureWarning: 'The difference between systolic and diastolic pressure looks unusual. If you have already repeated the measurement and confirm it is correct, you can save the data.',
      cancel: 'Cancel',
      forceSave: 'Confirm and save',
      measurementGuideTooltip: 'How do I take a valid measurement?',
      measurementGuideTitle: 'How to take a valid measurement',
      measurementGuideClose: 'Close recommendations',
      measurementGuideEssentialsTitle: 'Correct preparation and posture',
      measurementGuideIntro: 'Use a blood pressure monitor that is',
      measurementGuideIntroStrong: 'validated, upper-arm based, and fitted with the correct cuff size',
      measurementGuideSameArm: 'Usually use the same arm and similar morning and evening measurement times.',
      measurementGuidePreparationTitle: 'Preparation:',
      measurementGuidePreparation: 'Avoid meals, coffee, tobacco, and exercise for the previous 30 minutes. Empty your bladder.',
      measurementGuideRestTitle: 'Rest:',
      measurementGuideRest: 'Sit down and rest quietly for 5 minutes.',
      measurementGuidePostureTitle: 'Posture:',
      measurementGuidePosture: 'Back supported, feet flat on the floor, and legs uncrossed.',
      measurementGuideArmTitle: 'Arm:',
      measurementGuideArm: 'Place the cuff directly on the skin, without constricting clothing. Rest your arm in a relaxed position with the cuff at heart level.',
      measurementGuideDuringTitle: 'During the measurement:',
      measurementGuideDuring: 'Stay relaxed; do not talk, move, or use your phone.',
      measurementGuideAdviceTitle: 'Advice:',
      measurementGuideAdviceStart: 'Take',
      measurementGuideAdviceStrong: 'three readings 1 to 2 minutes apart',
      measurementGuideAdviceEnd: 'discard the first and average the final two',
      measurementGuideAdviceAlternative: 'or enable the',
      measurementGuideFilter: 'White Coat Filter',
      measurementGuideFilterEnd: 'in the app.',
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
      title: 'Long-term evolution',
      range28Days: '4 weeks',
      range3Months: '3 months',
      range6Months: '6 months',
      range1Year: '1 year',
      dailyAverage: 'Daily average',
      dailyAveragesCount: '{days} day(s) with an average',
      sessionsOnDay: '{count} effective session(s) on this day',
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
        hypotension: { unmedicatedName: 'Hypotension', unmedicatedDesc: 'Systolic < 90 or diastolic < 60 mmHg', medicatedName: 'Severe hypotension', medicatedDesc: 'Systolic < 90 or diastolic < 60 mmHg' },
        overtreatment: { unmedicatedName: 'Low value', unmedicatedDesc: 'Category used only with medication', medicatedName: 'Suboptimal', medicatedDesc: 'If this recurs across several readings, you can consult your doctor in case they wish to review the treatment; it will depend on your individual circumstances.' },
        optimal: { unmedicatedName: 'Optimal', unmedicatedDesc: 'Systolic 90–119 and diastolic 60–79 mmHg', medicatedName: 'Optimal', medicatedDesc: 'Systolic 115–124 and diastolic 65–74 mmHg' },
        elevated: { unmedicatedName: 'Elevated pressure', unmedicatedDesc: 'Systolic 120–134 or diastolic 80–84 mmHg', medicatedName: 'Suboptimal', medicatedDesc: 'If this recurs across several readings, you can consult your doctor in case they wish to review the treatment; it will depend on your individual circumstances.' },
        hypertension: { unmedicatedName: 'Hypertension', unmedicatedDesc: 'Systolic ≥ 135 or diastolic ≥ 85 mmHg', medicatedName: 'Hypertension', medicatedDesc: 'Systolic ≥ 135 or diastolic ≥ 85 mmHg' },
      },
    },

    guidelines: {
      common: {
        low: { name: 'Low reading', desc: 'Systolic below 90 or diastolic below 60 mmHg. Consider repeating the measurement and how you feel.' },
        extreme: { name: 'Very high reading', desc: 'Systolic at or above 180 or diastolic at or above 120 mmHg.' },
      },
      esc2024: {
        name: 'European ESC 2024',
        description: 'ESC 2024 classification for home averages.',
        categories: {
          normal: { name: 'Non-elevated pressure', desc: 'Systolic < 120 and diastolic < 70 mmHg.' },
          elevated: { name: 'Elevated pressure', desc: 'Systolic 120–134 or diastolic 70–84 mmHg.' },
          hypertension: { name: 'Above the home threshold', desc: 'Systolic ≥ 135 or diastolic ≥ 85 mmHg.' },
        },
      },
      ahaAcc2025: {
        name: 'US AHA/ACC 2025',
        description: 'AHA/ACC 2025 categories applied to the home log.',
        categories: {
          normal: { name: 'Normal', desc: 'Systolic < 120 and diastolic < 80 mmHg.' },
          elevated: { name: 'Elevated pressure', desc: 'Systolic 120–129 and diastolic < 80 mmHg.' },
          stage1: { name: 'Stage 1 hypertension', desc: 'Systolic 130–139 or diastolic 80–89 mmHg.' },
          stage2: { name: 'Stage 2 hypertension', desc: 'Systolic ≥ 140 or diastolic ≥ 90 mmHg.' },
        },
      },
      ish2020: {
        name: 'International ISH 2020',
        description: 'Simplified comparison with the ISH 2020 home threshold.',
        categories: {
          belowThreshold: { name: 'Below threshold', desc: 'Systolic < 135 and diastolic < 85 mmHg.' },
          aboveThreshold: { name: 'Above the home threshold', desc: 'Systolic ≥ 135 or diastolic ≥ 85 mmHg.' },
        },
      },
    },

    trendInsights: {
      title: 'Detected evolution',
      insufficientTitle: 'Not enough data yet',
      insufficientDesc: 'At least {requiredSessions} effective sessions across {requiredDays} days within four weeks are required. Available: {sessions} sessions across {days} days.',
      readySummary: '{sessions} effective sessions across {days} days · period average {systolic}/{diastolic}',
      period: 'Period assessed: {start} – {end}',
      comparisonTitle: 'Fortnight comparison',
      firstFortnight: 'First 14 days',
      lastFortnight: 'Last 14 days',
      daysWithData: '{days} day(s) with data',
      difference: 'Difference',
      coverageSupported: 'Sufficient coverage',
      coverageSparse: 'Sparse data',
      sparseExplanation: 'An indicative comparison based on few dates. Values are shown for review without interpreting the change as a confirmed trend.',
      noPatternTitle: 'No repeated pattern under these rules',
      noPatternDesc: 'There is enough data for analysis, but high or low values do not recur on at least two thirds of the assessed days.',
      aboveTitle: 'Repeated values above the threshold',
      aboveDesc: 'On {matchingDays} of {totalDays} days, the daily average was above the selected guideline threshold. Period average: {systolic}/{diastolic} mmHg.',
      lowTitle: 'Repeated low values',
      lowDesc: 'On {matchingDays} of {totalDays} days, the daily average had systolic below 90 or diastolic below 60. Period average: {systolic}/{diastolic} mmHg.',
      disclaimer: 'Evolution over the latest four weeks available. This is not a diagnosis.',
    },

    healthAlerts: {
      title: 'Informational alerts',
      disclaimer: 'Informational guidance based on {guideline}. The application does not diagnose or support medication changes. A single reading should be interpreted cautiously.',
      extremeHighPressure: {
        name: 'Very high reading notice ({systolic}/{diastolic})',
        desc: 'Repeat the measurement after sitting quietly at rest. If you have chest pain, difficulty breathing, sudden weakness or numbness, trouble speaking, vision changes, confusion or fainting, this could be a medical emergency; consider calling 112.',
      },
      lowBloodPressure: {
        name: 'Low value ({systolic}/{diastolic})',
        desc: 'Systolic is below 90 or diastolic is below 60 mmHg. This is not always an emergency; repeat the measurement and consider how you feel.',
      },
      narrowPulsePressure: {
        name: 'Narrow PP ({value})',
        desc: 'Pulse pressure below 25 mmHg. Repeat the measurement and seek advice if it persists or symptoms occur.',
      },
      widePulsePressure: {
        name: 'Wide PP ({value})',
        desc: 'Pulse pressure above 60 mmHg. Its relevance depends on age and clinical context.',
      },
      bradycardia: {
        name: 'Low pulse ({value} BPM)',
        desc: 'Resting rate below 50 BPM. This may be usual in trained athletes.',
      },
      tachycardia: {
        name: 'High pulse ({value} BPM)',
        desc: 'Resting rate above 100 BPM. Repeat the measurement after resting.',
      },
      hypotensionTachycardia: {
        name: 'Hypotension + high pulse',
        desc: 'A combination worth repeating and assessing, especially with dizziness, weakness or fainting.',
      },
      hypertensionTachycardia: {
        name: 'Hypertension + high pulse',
        desc: 'A combination representing elevated hemodynamic load that deserves follow-up.',
      },
    },
    healthAssessment: { culprit: {
      low: { systolic: 'Low systolic', diastolic: 'Low diastolic', both: 'Low systolic and diastolic' },
      high: { systolic: 'Elevated systolic', diastolic: 'Elevated diastolic', both: 'Elevated systolic and diastolic' },
    } },

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
      dateTimeTitle: 'Reading date and time',
      date: 'Date',
      time: 'Time',
      dateTimeRequired: 'Enter a valid date and time.',
      dateTimeFuture: 'The date and time cannot be in the future.',
      systolic: 'Systolic',
      diastolic: 'Diastolic',
      heartRate: 'Pulse',
      notesPlaceholder: 'Add or correct observations...',
      save: 'Save Changes',
      cancel: 'Cancel',
    },

    treatmentTarget: {
      status: { within: 'Target', below: '↓ Target', above: '↑ Target', mixed: '↕ Target' },
      sourceGuideline: 'Guideline-recommended target',
      sourceCustom: 'Doctor-defined target',
    },

    // Settings
    settings: {
      title: 'Settings',
      close: 'Close',
      languageTitle: 'Application Language:',
      langSpanish: 'Español (ES)',
      langEnglish: 'English (EN)',
      guidelineTitle: 'Traffic-light reference:',
      guidelineDesc: 'Changes the classification and explanatory text; it never alters stored readings.',
      guidelineEsc: 'European ESC 2024',
      guidelineEscDesc: 'Home thresholds: non-elevated, elevated, and above 135/85.',
      guidelineAha: 'US AHA/ACC 2025',
      guidelineAhaDesc: 'Normal, elevated, stage 1 hypertension, and stage 2.',
      guidelineIsh: 'International ISH 2020',
      guidelineIshDesc: 'Simple comparison below or above the 135/85 home threshold.',
      patientProfile: 'Patient Profile:',
      fullName: 'Full name:',
      fullNamePlaceholder: 'e.g. John Doe',
      sexMale: 'Male',
      sexFemale: 'Female',
      medicationLabel: 'Do you take antihypertensive medication?',
      medicationYes: 'YES, takes medication',
      medicationNo: 'NO medication',
      medicationChangeTitle: 'Change medication context',
      medicationChangeYes: 'you take antihypertensive medication',
      medicationChangeNo: 'you do not take antihypertensive medication',
      medicationChangeValuesUnchanged: 'The measurement values do not change.',
      medicationChangeMessage: 'What would you like to do with the medication context stored in the history? The traffic light depends on the selected guideline, not this field.',
      medicationKeepHistory: 'Keep history',
      medicationKeepHistoryDesc: 'Keeps the notices and comments that each reading had when it was recorded. Only future readings will use the new setting. Use this option when this is a real change of context.',
      medicationRecalculateHistory: 'Recalculate all',
      medicationRecalculateHistoryDesc: 'Recalculates all notices and comments for the readings. Use this option when the stored readings were recorded with an incorrect medication context.',
      medicationKeepButton: 'Keep',
      medicationRecalculateButton: 'Recalculate',
      medicationChangeCancel: 'Cancel',
      medicationChangeFailed: 'The medication context could not be updated. Not all changes were applied.',
      targetTitle: 'Treatment target',
      targetGuideline: 'Guideline recommendation',
      targetSystolicMin: 'Minimum systolic', targetSystolicMax: 'Maximum systolic', targetDiastolicMin: 'Minimum diastolic', targetDiastolicMax: 'Maximum diastolic',
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
      csvImportDesc: 'Select an app CSV backup or a data file exported by MyTherapy.',
      selectCsv: 'Select CSV file...',
      importPreviewTitle: 'Review before importing',
      importFormatNative: 'Blood Pressure Control backup',
      importFormatMyTherapy: 'MyTherapy data file detected',
      importReadingsReady: 'measurements ready',
      importRowsIgnored: 'unrelated records ignored',
      importShorthandNormalized: 'shorthand measurements normalized',
      importInvalidReadings: 'invalid measurements discarded',
      importMyTherapyNotice: 'MyTherapy does not provide the arm. The default arm will be used: {arm}. Medication, laboratory and activity records will not be imported.',
      importShorthandNotice: '{count} shorthand measurements were interpreted, for example 12/8 as 120/80. Review the summary before continuing.',
      importIncompleteNotice: '{count} groups did not contain the same number of systolic, diastolic and pulse values; only complete measurements will be kept.',
      confirmImport: 'Confirm import',
      selectAnotherCsv: 'Choose another file',
      importNoValidReadings: 'No valid blood pressure measurements were found or the file format is not recognized.',
      importReadError: 'The selected CSV file could not be read.',
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
      thCategory: 'BP Category',
      thArm: 'Arm',
      thNotes: 'Notes',
      footerNotice: 'Personal log document. Informational guidance based on ESC 2024; the thresholds are not a literal reproduction of the guidelines and may contain errors.',
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
