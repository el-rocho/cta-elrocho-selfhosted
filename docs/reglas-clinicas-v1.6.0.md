# Matriz clínica versionada — v1.6.0

## Control del documento

| Campo | Valor |
|---|---|
| Versión de la matriz | 1.6.0 |
| Versión de aplicación comprobada | 1.6.0-beta.1 |
| Fecha de revisión técnica | 31 de julio de 2026 |
| Idiomas de interfaz | Español e inglés |
| Estado | Transcripción técnica del comportamiento implementado; pendiente de validación clínica formal |
| Ámbito | Registro domiciliario de presión arterial y pulso en adultos |

Este documento es la fuente de control para revisar las reglas clínicas que ejecuta la aplicación. No sustituye a las guías, no establece diagnósticos y no autoriza cambios de medicación. Las recomendaciones individuales del facultativo prevalecen siempre sobre los valores predeterminados.

### Tipos de regla

- **[GUÍA]**: regla trasladada de la fuente oficial indicada.
- **[ADAPTACIÓN DOMICILIARIA]**: transformación necesaria para presentar mediciones realizadas en casa.
- **[REGLA APP]**: criterio prudencial o de producto que no debe atribuirse literalmente a las tres guías.

Si código, traducciones, informes o este documento discrepan, la discrepancia se considera un defecto. Hasta resolverlo, el código determina el comportamiento ejecutado, pero no convierte una adaptación propia en recomendación oficial.

## 1. Convenciones y precedencia

- Todas las presiones se expresan en `mmHg` y el pulso en pulsaciones por minuto (`ppm`).
- Los intervalos son de números enteros. Por ejemplo, `120–134` equivale a `>= 120 && < 135`.
- `AND` exige que se cumplan ambas dimensiones; `OR` basta con una.
- Se evalúa primero la **regla extrema universal**. Después se clasifica sistólica y diastólica por separado y prevalece la dimensión de mayor rango.
- Si ambas dimensiones alcanzan el mismo rango no neutro, el causante mostrado es «ambas». Si solo una alcanza el rango mayor, se identifica esa dimensión.
- La categoría general y el estado del objetivo terapéutico son independientes y pueden mostrarse simultáneamente.
- Seleccionar otra guía solo recalcula categorías, avisos, tendencias y objetivos recomendados. Nunca modifica las mediciones guardadas.

### Precedencia universal exacta

1. Si `sistólica >= 180 OR diastólica >= 120`, categoría `extreme`.
2. En otro caso, calcular las categorías de ambas dimensiones según la guía y conservar la de rango más alto.
3. Solo si el rango más alto es neutro y `sistólica < 90 OR diastólica < 60`, sustituir la categoría por `low`.
4. El aviso independiente de valor bajo sí se genera siempre que `sistólica < 90 OR diastólica < 60`, aunque la otra dimensión produzca una categoría alta. Por ello una lectura puede tener categoría alta y, a la vez, aviso de valor bajo.

## 2. Valor efectivo de una sesión domiciliaria

Las reglas de las secciones siguientes se aplican al **resultado efectivo de la sesión**, no necesariamente a la toma individual más desfavorable.

### Sin filtro de bata blanca

Cada toma es una sesión independiente y sus valores son los valores efectivos.

### Con filtro de bata blanca [REGLA APP]

El filtro está desactivado de forma predeterminada. Cuando se activa:

- Agrupa tomas consecutivas si la separación respecto de la toma anterior es `<= 5` minutos y el contexto de medicación es el mismo. El intervalo es fijo y no configurable.
- Una sesión completa se guarda y presenta como un único resultado.
- Con 1 toma: no descarta ninguna.
- Con 2 tomas: descarta la primera si `SYS1 >= SYS2 + 8 OR DIA1 >= DIA2 + 4`; si no, conserva ambas.
- Con 3 tomas: descarta siempre la primera y conserva las dos últimas.
- Con 4 o más: recorre las tomas desde la primera. Para cada toma `i`, calcula la media de todas las posteriores. Descarta el prefijo hasta `i` mientras `SYSi >= media_SYS_posterior + 8 OR DIAi >= media_DIA_posterior + 4`; se detiene ante la primera toma que no cumpla la condición. Puede quedar una sola toma efectiva.
- El resultado efectivo es la media aritmética de las tomas conservadas para sistólica, diastólica y pulso, redondeada con `Math.round` al entero más próximo.
- Semáforo, objetivo, avisos de sesión, exportación, informe y tendencias usan esas medias efectivas. Las tomas descartadas siguen visibles dentro del desglose, pero no determinan esos resultados.
- Los avisos de presión de pulso confirmados se recopilan únicamente de las tomas efectivas y se deduplican por tipo dentro de la sesión.

Este filtro representa una regla de acomodación diseñada para usuarios que presentan un descenso progresivo al repetir la medición. No diagnostica «hipertensión de bata blanca» ni reproduce un algoritmo validado de ESC, AHA/ACC o ISH. Sus márgenes `8/4 mmHg`, el descarte fijo de la primera de tres tomas y la posibilidad de conservar una sola toma requieren validación clínica específica.

## 3. Clasificación general por guía

En todas las tablas se presupone que no se ha activado antes la regla extrema universal.

### 3.1 Europea — ESC 2024

| Clave | Etiqueta española | Condición exacta aplicada al valor domiciliario | Color |
|---|---|---|---|
| `low` | Lectura baja | Rango de ambas dimensiones neutro y `SYS < 90 OR DIA < 60` | Azul |
| `normal` | Presión no elevada | `SYS < 120 AND DIA < 70` | Verde |
| `elevated` | Presión elevada | (`SYS 120–134 OR DIA 70–84`) y ninguna dimensión alcanza el umbral superior | Amarillo/ámbar |
| `hypertension` | Sobre el umbral domiciliario | `SYS >= 135 OR DIA >= 85` | Naranja |
| `extreme` | Lectura muy alta | `SYS >= 180 OR DIA >= 120` | Rojo |

**Adaptación aplicada:** la ESC 2024 define en consulta presión elevada como `SYS 120–139 OR DIA 70–89` e hipertensión como `SYS >= 140 OR DIA >= 90`. La aplicación conserva el límite inferior ESC (`120/70`), pero sustituye el corte superior de consulta por el umbral domiciliario `135/85`. Por tanto, las etiquetas entre `135/85` y `139/89` son una **adaptación domiciliaria**, no una reproducción literal de las categorías de consulta.

### 3.2 Estadounidense — AHA/ACC 2025

| Clave | Etiqueta española | Condición exacta | Color |
|---|---|---|---|
| `low` | Lectura baja | Rango de ambas dimensiones neutro y `SYS < 90 OR DIA < 60` | Azul |
| `normal` | Presión normal | `SYS < 120 AND DIA < 80` | Verde |
| `elevated` | Presión elevada | `SYS 120–129 AND DIA < 80` | Amarillo/ámbar |
| `stage1` | Hipertensión fase 1 | `SYS 130–139 OR DIA 80–89`, salvo que la otra dimensión sea fase 2 | Naranja |
| `stage2` | Hipertensión fase 2 | `SYS >= 140 OR DIA >= 90` | Naranja oscuro |
| `extreme` | Lectura muy alta | `SYS >= 180 OR DIA >= 120` | Rojo |

**Adaptación aplicada:** se muestran las categorías AHA/ACC también sobre registros domiciliarios. La guía fomenta la monitorización domiciliaria, pero estas bandas son su marco general de clasificación; la aplicación no calcula equivalencias domiciliarias alternativas para este perfil.

### 3.3 Internacional — ISH 2020

| Clave | Etiqueta española | Condición exacta aplicada al valor domiciliario | Color |
|---|---|---|---|
| `low` | Lectura baja | Rango de ambas dimensiones neutro y `SYS < 90 OR DIA < 60` | Azul |
| `belowThreshold` | Por debajo del umbral domiciliario | `SYS < 135 AND DIA < 85` | Verde |
| `aboveThreshold` | Sobre el umbral domiciliario | `SYS >= 135 OR DIA >= 85` | Naranja |
| `extreme` | Lectura muy alta | `SYS >= 180 OR DIA >= 120` | Rojo |

**Adaptación aplicada:** la guía ISH utiliza `135/85` como umbral de hipertensión en medición domiciliaria. La aplicación lo simplifica a dos estados informativos, además de las reglas universales de lectura baja y extrema; no muestra los grados de presión de consulta de ISH.

## 4. Objetivo terapéutico

El objetivo solo se muestra y evalúa cuando la toma está marcada como realizada por una persona que toma medicación antihipertensiva. No cambia la clasificación general ni la medición.

### 4.1 Objetivos predeterminados

| Perfil | Edad resuelta | Intervalo implementado, `SYS/DIA` | Operadores exactos | Procedencia |
|---|---:|---|---|---|
| ESC 2024 | Cualquier edad | `120–129 / 70–79` | mínimos y máximos inclusivos | [GUÍA], si se tolera; la guía contempla excepciones e individualización |
| AHA/ACC 2025 | Cualquier edad | `<130 / <80` | `SYS <= 129 AND DIA <= 79`; sin mínimo | [GUÍA], objetivo general; la aplicación no añade límite inferior |
| ISH 2020 | Edad desconocida o `<65` | `120–129 / 70–79` | mínimos y máximos inclusivos | [ADAPTACIÓN APP] de `<130/80`: se añaden mínimos `120/70` para representar posible valor inferior al objetivo |
| ISH 2020 | `>=65` | `120–139 / 70–89` | mínimos y máximos inclusivos | [ADAPTACIÓN APP] de `<140/90` si se tolera: se añaden mínimos `120/70` |

La edad se toma primero de `patientAge` si es numérica; en caso contrario se calcula desde la fecha de nacimiento en la fecha actual. Si no puede resolverse, ISH usa el intervalo de edad desconocida (`120–129/70–79`). ESC y AHA/ACC no cambian por edad en esta versión.

Los valores inferiores añadidos en ISH no son el modo literal en que la guía formula sus objetivos y deben recibir aprobación clínica. En ESC, la guía también exige valorar tolerancia, fragilidad, síntomas y circunstancias individuales; la aplicación no puede modelar esas excepciones y permite que el facultativo sustituya el intervalo.

### 4.2 Objetivo personalizado por el facultativo

- Los cuatro límites son editables: sistólica mínima/máxima (`70–250`) y diastólica mínima/máxima (`40–150`).
- Guardar `0` como mínimo significa «sin límite inferior».
- Cada mínimo definido debe ser `<=` a su máximo.
- Si la configuración personalizada no es válida, se recupera el objetivo predeterminado de la guía.
- «Restaurar recomendados» vuelve a cargar los valores de la tabla anterior.

### 4.3 Estado exacto de la etiqueta

Sea el intervalo `SYSmin..SYSmax / DIAmin..DIAmax`:

- `below`: (`SYSmin` existe y `SYS < SYSmin`) `OR` (`DIAmin` existe y `DIA < DIAmin`). Etiqueta `↓ Objetivo`.
- `above`: `SYS > SYSmax OR DIA > DIAmax`. Etiqueta `↑ Objetivo`.
- `mixed`: se cumplen a la vez `below` y `above`, normalmente porque una dimensión está por debajo y la otra por encima. Visualmente usa el mismo naranja oscuro que `above`.
- `within`: no se cumple ninguna condición anterior. Etiqueta `Objetivo`.

Para AHA/ACC no puede aparecer `below` porque su objetivo predeterminado no tiene mínimos. Un objetivo personalizado sí puede producir cualquiera de los cuatro estados.

## 5. Pulso y presión de pulso

### 5.1 Pulso

| Aviso | Condición exacta | Nivel/ámbito | Color | Comportamiento informativo |
|---|---|---|---|---|
| `bradycardia` / Pulso bajo | pulso válido y `< 50` | `info` / medición | Azul claro | Indica frecuencia inferior a 50 ppm en reposo y que puede ser habitual en deportistas entrenados. Exactamente `50` no avisa. |
| `tachycardia` / Pulso elevado | pulso válido y `> 100` | `caution` / medición | Naranja | Recomienda repetir tras reposo y valorar el contexto. Exactamente `100` no avisa. |
| `hypotensionTachycardia` | categoría general `low` `AND` pulso `> 100` | `warning` / medición | Rosa/rojo | Recomienda repetir y valorar cómo se encuentra la persona. |
| `hypertensionTachycardia` | dirección de categoría `high` o `extreme` `AND` pulso `> 100` | `warning` / medición | Rojo | Advierte de carga hemodinámica elevada y seguimiento. |

Los avisos combinados no sustituyen al aviso simple de pulso elevado: pueden aparecer juntos. El umbral bajo `<50` es una **regla conservadora de la aplicación**; referencias generales suelen definir bradicardia adulta por debajo de 60 ppm, con múltiples excepciones. La aplicación evita convertir `50–59` en aviso, pero no diagnostica ritmos ni arritmias.

### 5.2 Presión de pulso [REGLA APP]

`presión de pulso = sistólica - diastólica`

| Aviso | Condición exacta | Nivel/ámbito | Color |
|---|---|---|---|
| `narrowPulsePressure` / PP estrecha | `PP < 25` | `warning` / medición | Ámbar |
| `widePulsePressure` / PP ancha | `PP > 60` | `warning` / medición | Ámbar |

- Exactamente `25` o `60 mmHg` no produce aviso.
- Antes de guardar, una lectura fuera del intervalo `25–60` solicita revisar el manguito y repetir la medición.
- El aviso queda asociado a los datos solo cuando el usuario confirma que ya repitió y desea guardarlos.
- Una confirmación previa similar del mismo día —diferencia absoluta `<=5 mmHg` tanto en sistólica como en diastólica— evita repetir el diálogo.
- En una sesión filtrada solo cuentan las tomas efectivas; cada tipo de aviso se muestra una vez.

Los límites `25/60`, la confirmación y la deduplicación son heurísticas de seguridad de la aplicación. No se presentan como umbrales diagnósticos de ESC 2024, AHA/ACC 2025 o ISH 2020 y requieren validación clínica independiente.

## 6. Avisos de presión y regla extrema

| Aviso | Condición exacta | Nivel/ámbito | Color | Mensaje funcional |
|---|---|---|---|---|
| `lowBloodPressure` | `SYS < 90 OR DIA < 60` | `caution` / medición | Azul | No siempre representa una urgencia; repetir la medición y valorar cómo se encuentra la persona. |
| `extremeHighPressure` | `SYS >= 180 OR DIA >= 120` | `urgent` / seguridad | Rojo | Repetir sentado y en reposo. Si hay dolor torácico, falta de aire, debilidad o adormecimiento repentinos, dificultad para hablar, cambio visual, confusión o desmayo, puede tratarse de una urgencia médica; valorar llamar al 112. |

La aplicación no pregunta síntomas, no diagnostica y no hace triaje. La regla extrema únicamente activa un aviso informativo de seguridad. El operador implementado es inclusivo (`>=`) y disyuntivo (`OR`) para las tres guías. AHA/ACC 2025 describe presión severa con valores `>180/120`; por tanto, incluir exactamente `180` o `120` es una decisión prudencial propia de la aplicación.

## 7. Colores de categorías y etiquetas

### 7.1 Categoría general

| Claves | Rol | Rango | Color principal | Fondo de etiqueta | Texto |
|---|---|---:|---|---|---|
| `normal`, `belowThreshold` | Verde | 0 | `#10b981` | `rgba(16,185,129,0.15)` | `#047857` |
| `low` | Azul | 1 | `#2563eb` | `rgba(37,99,235,0.14)` | `#1d4ed8` |
| `elevated` | Ámbar | 2 | `#d97706` | `rgba(217,119,6,0.16)` | `#a16207` |
| `hypertension`, `stage1`, `aboveThreshold` | Naranja | 3 | `#f97316` | `rgba(249,115,22,0.16)` | `#c2410c` |
| `stage2` | Naranja oscuro | 4 | `#ea580c` | `rgba(234,88,12,0.17)` | `#9a3412` |
| `extreme` | Rojo | 5 | `#dc2626` | `rgba(220,38,38,0.16)` | `#b91c1c` |

Los rangos de color sirven para resolver la dimensión más desfavorable; no son puntuaciones clínicas ni se suman.

### 7.2 Objetivo terapéutico

| Estado | Texto visible | Fondo | Texto | Punto |
|---|---|---|---|---|
| `within` | Objetivo | `rgba(16,185,129,0.14)` | `#047857` | `#10b981` |
| `below` | ↓ Objetivo | `rgba(251,146,60,0.15)` | `#ea580c` | `#fb923c` |
| `above` | ↑ Objetivo | `rgba(194,65,12,0.16)` | `#9a3412` | `#c2410c` |
| `mixed` | ↕ Objetivo | igual que `above` | `#9a3412` | `#c2410c` |

### 7.3 Avisos

Los estilos exactos de los avisos son:

- Extremo e hipertensión con taquicardia: rojo `#dc2626`.
- Valor bajo: azul `#2563eb`.
- Presión de pulso estrecha o ancha: ámbar `#f59e0b`.
- Pulso bajo: azul claro `#0ea5e9`.
- Pulso elevado: naranja `#f97316`.
- Hipotensión con taquicardia: rosa/rojo `#e11d48`.

## 8. Tendencias y evolución

Los avisos de tendencia están separados conceptualmente de los avisos de una medición puntual.

- Ventana corta: últimos `28` días contados desde el día de la sesión más reciente (`día más reciente - 27` hasta el final del día más reciente).
- Antes de analizar, todas las sesiones efectivas del mismo día se agregan en una media diaria redondeada de sistólica, diastólica y pulso. No se cambia a medias semanales o mensuales.
- Datos mínimos para el patrón: `>=3` medias diarias dentro de la ventana, procedentes por tanto de `>=3` días distintos.
- Cada media diaria se clasifica con la guía seleccionada. El patrón mostrado es la categoría que aparece más veces en la ventana de cuatro semanas.
- Si dos o más categorías empatan con la frecuencia máxima, no se elige una arbitrariamente y se muestra `Sin patrón predominante`.
- La comparación de evolución divide la ventana en los primeros 14 días y los últimos 14. Calcula la diferencia `media_última_quincena - media_primera_quincena` por dimensión.
- La comparación se considera respaldada cuando existen al menos dos días con datos en cada quincena. Solo entonces la interfaz muestra las diferencias de sistólica y diastólica mediante flechas; con menos cobertura muestra `Datos insuficientes`.
- Gráficas de largo alcance: `28 días`, `3 meses`, `6 meses` y `1 año`, siempre con medias diarias y tomando como final el día de la sesión más reciente disponible.

## 9. Límites técnicos de entrada

Estos límites validan plausibilidad y formato; no son umbrales diagnósticos:

- Sistólica: entero entre `50` y `260`, ambos incluidos.
- Diastólica: entero entre `30` y `160`, ambos incluidos.
- Pulso: entero entre `30` y `220`, ambos incluidos.
- Debe cumplirse `diastólica < sistólica`; la igualdad no se guarda.

## 10. Trazabilidad obligatoria

| Materia | Implementación ejecutable | Texto/presentación | Consumidores que deben coincidir | Pruebas principales |
|---|---|---|---|---|
| Perfiles, categorías, alertas y fuentes | `src/utils/healthClassification.ts` | `src/i18n/translations.ts` | formulario, listado, CSV, PDF | `src/utils/healthClassification.test.ts` |
| Objetivos terapéuticos | `src/utils/treatmentTarget.ts` | `src/i18n/translations.ts`, `src/index.css` | configuración, formulario, listado, PDF/CSV | `src/utils/treatmentTarget.test.ts` |
| Filtro de bata blanca y valor efectivo | `src/utils/whiteCoatAlgorithm.ts` | `src/i18n/translations.ts` | listado, gráficas, CSV, PDF | `src/utils/whiteCoatAlgorithm.test.ts` |
| Tendencias y medias diarias | `src/utils/trendAnalysis.ts` | `src/i18n/translations.ts` | panel de tendencias, gráfica | `src/utils/trendAnalysis.test.ts` |
| Validación y presión de pulso | `src/utils/readingValidation.ts` | `src/i18n/translations.ts` | formulario de medición | `src/utils/readingValidation.test.ts` |
| Colores | `src/utils/healthClassification.ts`, `src/index.css` | estilos claro/oscuro | tarjetas, leyendas, etiquetas e informes | revisión visual y pruebas de componentes |
| Exportaciones clínicas | `src/utils/exportCsv.ts`, `src/utils/pdfReportContent.ts`, `src/utils/pdfGenerator.ts` | contenido CSV/PDF | descarga e informe | `src/utils/reportExports.test.ts` |
| Persistencia de objetivos en servidor | `server/db.js`, `server/index.js` | API de ajustes | edición autoalojada | `server/db.test.js` |
| Paridad entre ediciones | reglas y traducciones anteriores | español e inglés | individual, cliente y autoalojada | `src/utils/editionCharacterization.test.ts` y `npm run test:editions` |

Antes de publicar una revisión clínica debe comprobarse que las tres ediciones —individual, cliente y autoalojada— contienen la misma matriz y la misma lógica. Todo cambio de umbral, operador, prioridad, objetivo, texto clínico o color semántico exige:

1. nueva versión de este documento;
2. cambio coordinado en código y traducciones;
3. pruebas de frontera (`límite - 1`, `límite`, `límite + 1`) en sistólica y diastólica;
4. comprobación de tarjetas, tendencias, CSV y PDF;
5. fecha y responsable de revisión clínica.

Desde el repositorio individual, `npm run test:editions` ejecuta el mismo documento de caracterización en las tres ediciones y compara sus resultados JSON completos. La orden falla mostrando las primeras diferencias de ruta y valor si cambian categorías, avisos, traducciones clínicas, objetivos, filtro o tendencias.

## 11. Fuentes oficiales revisadas

### ESC 2024

- McEvoy JW et al. *2024 ESC Guidelines for the management of elevated blood pressure and hypertension*. European Heart Journal. DOI: [10.1093/eurheartj/ehae178](https://academic.oup.com/eurheartj/article/45/38/3912/7741010).
- European Society of Cardiology. [Essential Messages from the 2024 ESC Guidelines](https://www.escardio.org/static-file/Escardio/Guidelines/Products/Essential%20Messages/2024%20EM/Essential%20Messages_2024%20HTN.pdf): categorías de consulta y objetivo tratado `120–129/70–79`, si se tolera.

### AHA/ACC 2025

- Jones DW et al. *2025 High Blood Pressure Guideline*. Circulation. DOI: [10.1161/CIR.0000000000001356](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001356).
- American Heart Association. [Top Things to Know: 2025 High Blood Pressure Guideline](https://professional.heart.org/en/science-news/2025-high-blood-pressure-guideline/top-things-to-know): categorías, objetivo general `<130/80`, monitorización domiciliaria y definición de presión severa.
- American Heart Association. [Home Blood Pressure Monitoring](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home): técnica domiciliaria y actuación informativa ante lecturas muy altas.

### ISH 2020

- Unger T et al. *2020 International Society of Hypertension Global Hypertension Practice Guidelines*. Hypertension. DOI: [10.1161/HYPERTENSIONAHA.120.15026](https://www.ahajournals.org/doi/10.1161/HYPERTENSIONAHA.120.15026).
- International Society of Hypertension. [Página oficial de recursos de las guías globales 2020](https://ish-world.com/global-hypertension-practice-guidelines/).

### Pulso

- American Heart Association. [All About Heart Rate](https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse): referencia general de pulso en reposo y excepciones.
- American Heart Association. [Tachycardia: Fast Heart Rate](https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/tachycardia--fast-heart-rate): taquicardia en reposo por encima de 100 ppm.

## 12. Puntos expresamente pendientes de validación clínica

1. Híbrido ESC domiciliario: conservar `120/70` y desplazar el umbral superior a `135/85`.
2. Regla extrema común `SYS >=180 OR DIA >=120`, especialmente los valores exactamente iguales al límite.
3. Límites inferiores `120/70` añadidos a los objetivos ISH y comportamiento más estricto cuando la edad es desconocida.
4. Umbral de pulso bajo `<50` frente a la referencia general `<60`.
5. Límites de presión de pulso `<25` y `>60` y su diálogo de confirmación.
6. Algoritmo de acomodación del filtro de bata blanca (`8/4`, reglas de descarte y sesión que puede quedar reducida a una toma).
7. Patrón mensual basado en la categoría modal de al menos tres medias diarias y tratamiento de los empates sin categoría predominante.

Hasta que estos puntos sean revisados por un profesional competente, deben describirse como adaptaciones de la aplicación y no como recomendaciones literales de las guías.
