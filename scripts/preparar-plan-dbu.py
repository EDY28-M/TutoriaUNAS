"""Genera una propuesta editable; no firma ni remite documentos institucionales."""
from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'analisis-tutoria'
OUT.mkdir(parents=True, exist_ok=True)
doc = Document()
s = doc.sections[0]
s.page_width, s.page_height = Cm(21), Cm(29.7)
s.top_margin, s.bottom_margin = Cm(1.8), Cm(1.8)
s.left_margin, s.right_margin = Cm(2), Cm(2)
s.header_distance, s.footer_distance = Cm(.8), Cm(.8)
for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2']:
    style = doc.styles[name]
    style.font.name = 'Manrope'
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.font.size = Pt({'Title': 21, 'Subtitle': 11, 'Heading 1': 14, 'Heading 2': 11.5}.get(name, 10.5))
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.08
    style.font.underline = False
    for border in style.element.xpath('.//w:pBdr'):
        border.getparent().remove(border)
doc.styles['Normal'].paragraph_format.widow_control = True
header = s.header.paragraphs[0]
header.text = 'UNAS   |   Sistema de Gestión de la Tutoría'
header.style = doc.styles['Normal']
header.runs[0].font.size = Pt(9)
footer = s.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('Propuesta para revisión institucional   |   27 de octubre de 2026   |   ')
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
for run in footer.runs: run.font.size = Pt(8)
doc.core_properties.title = 'Plan de trabajo para la consulta de información de Bienestar Universitario'
doc.core_properties.subject = 'Precisión del requerimiento de la carta 001026 de 2026 DIBU'
doc.core_properties.author = 'Sistema de Gestión de la Tutoría'

def p(text):
    return doc.add_paragraph(text)

def h(text, level=1):
    return doc.add_heading(text, level)

def page(title):
    doc.add_page_break(); h(title)

def table(headers, rows, widths):
    t = doc.add_table(rows=1, cols=len(headers)); t.autofit = False
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for col, width in zip(t.columns, widths): col.width = Cm(width)
    for cell, text in zip(t.rows[0].cells, headers): cell.text = text
    repeat = OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(repeat)
    for row in rows:
        for cell, text in zip(t.add_row().cells, row): cell.text = text
    for i, row in enumerate(t.rows):
        trpr = row._tr.get_or_add_trPr(); trpr.append(OxmlElement('w:cantSplit'))
        for j, cell in enumerate(row.cells):
            cell.width = Cm(widths[j]); cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            pr = cell._tc.get_or_add_tcPr()
            shade = OxmlElement('w:shd'); shade.set(qn('w:fill'), 'E7EDF3' if i == 0 else ('F7F9FB' if i % 2 == 0 else 'FFFFFF')); pr.append(shade)
            margins = OxmlElement('w:tcMar')
            for side in ['top', 'left', 'bottom', 'right']:
                el = OxmlElement('w:' + side); el.set(qn('w:w'), '85'); el.set(qn('w:type'), 'dxa'); margins.append(el)
            pr.append(margins)
            borders = OxmlElement('w:tcBorders')
            for side in ['top', 'left', 'bottom', 'right']:
                el = OxmlElement('w:' + side); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), '4'); el.set(qn('w:color'), 'D9D9D9'); borders.append(el)
            pr.append(borders)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(2)
                paragraph.paragraph_format.line_spacing = 1.02
                for run in paragraph.runs:
                    run.font.size = Pt(9)
                    run.font.bold = i == 0
                    run.font.color.rgb = RGBColor(0, 0, 0)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return t

doc.add_paragraph('Plan de trabajo para la consulta de información de Bienestar Universitario', 'Title')
doc.add_paragraph('Precisión del requerimiento para el seguimiento tutorial', 'Subtitle')
p('Proponente: Área de Tutoría y Capacitación Docente. Destinatarios: Dirección de Bienestar Universitario y Oficina de Tecnologías de Información. Estado: propuesta pendiente de revisión, aprobación y designación nominal de usuarios.')
h('Finalidad y resultado esperado')
p('Solicitamos evaluar una consulta de solo lectura que permita conocer el servicio, la fecha y el estado de las atenciones de estudiantes autorizados para seguimiento tutorial, así como obtener estadísticas por área. La información permitirá coordinar la continuidad de la atención sin pedir al estudiante datos que ya constan en los sistemas institucionales.')
p('El resultado esperado es un conjunto mínimo de datos aprobado por DBU y OTI, un mecanismo de consulta viable y un piloto con accesos delimitados. La implementación no se considerará autorizada por la sola presentación de este plan.')
h('Antecedentes y precisión del alcance')
p('La carta 001026-2026-DIBU solicita finalidad, usuarios autorizados, datos estrictamente necesarios y modalidad de consulta; dispone además la coordinación DBU, OTI y responsable del sistema. Su referencia es el informe 000006-2026-UNAS/DIBU-AJSM del 19 de octubre de 2026, cuyo contenido no forma parte de los documentos disponibles para este plan.')
p('La carta 000151-2026-ATCD excluye información sensible en su primera página, pero sus anexos incluyen solicitudes más amplias. Para este requerimiento proponemos retirar del alcance de integración los diagnósticos, historias clínicas, tratamientos, informes sociales, evaluaciones profesionales, puntajes y motivos confidenciales. Esta precisión deberá ratificarse por la vía institucional correspondiente.')
h('Alcance funcional')
p('Comprende la consulta administrativa de Medicina, Psicología, Psicopedagogía y Servicio Social, según los servicios realmente disponibles en DBU. La ampliación a pautas académicas comunicables, comedor y cobertura de seguro requiere disponibilidad y autorización expresa de cada conjunto de datos.')
p('Los datos académicos y de identidad se solicitarán a la DIAA; la asignación tutorial, a las escuelas; la habilitación docente, a Recursos Humanos; y la identidad y el canal técnico, a OTI. Este plan de integración es distinto del plan de acción tutorial de cada escuela.')
p('Distribución operativa indicada para el sistema el 27 de octubre de 2026: formato 03 para ciclos 1 a 3; formato 04 para ciclos 4 a 7; formato 05 para ciclos 8 a 10. Las tres entrevistas se completan al inicio del semestre. Las evaluaciones 10 y 11 corresponden a cada sesión finalizada con asistencia confirmada y expresan respuestas nuevas del estudiante.')

page('Datos mínimos de la consulta')
p('Se propone una fila por atención. La clave fuente más identificador de atención debe ser estable para actualizar registros sin duplicarlos. El código universitario enlaza con el padrón de la DIAA y se conserva como texto.')
table(['Dato', 'Finalidad y condición'], [
    ('Identificador de atención', 'Referencia opaca y única en el sistema de origen. No contiene diagnóstico ni motivo.'),
    ('Código universitario', 'Relacionar la atención con el estudiante autorizado. Si no coincide con DIAA, dejar el registro en conciliación.'),
    ('Servicio o área', 'Medicina, Psicología, Psicopedagogía o Servicio Social, según catálogo confirmado por DBU.'),
    ('Fecha del evento', 'Ubicar la atención en el tiempo. Diferenciar la fecha de una cita prevista y la fecha de carga.'),
    ('Estado registrado', 'Programada, atendida u otro estado real del origen. Conservar el estado original y homologar con acuerdo de DBU.'),
    ('Fuente y fecha de corte', 'Identificar procedencia y actualidad del conjunto de datos.'),
    ('Actualización en origen', 'Permitir sincronización de cambios si el origen registra esta marca. Si no existe, informar la limitación.'),
], [5, 12])
h('Ampliaciones opcionales sujetas a autorización')
p('Caso y derivación: identificadores de referencia, próxima cita y continuidad solo cuando existan. Una atención espontánea puede no estar vinculada a un formato 12; no se debe inventar ese vínculo.')
p('Pauta académica: únicamente una recomendación funcional autorizada para el acompañamiento, con referencia de autorización, destinatario o ámbito, fecha de inicio y vigencia. Sin autorización o fuera de vigencia, el sistema no deberá entregar el texto.')
p('Comedor y otros beneficios: identificador, tipo, estado y vigencia del beneficio en una entrega separada. No se requieren el informe social, los ingresos familiares ni los resultados de evaluaciones médicas o psicológicas para conocer el estado administrativo.')
p('Seguro de salud: entidad, estado de cobertura, fuente y fecha de corte, si se autoriza su consulta. La afiliación al SIS no está exigida como campo en los doce anexos revisados y no debe deducirse de la existencia de una atención.')
h('Calidad y formato de entrega')
p('Adjuntar diccionario con nombre de campo, significado, tipo, valores admitidos, clave, nulos y responsable. Fechas AAAA-MM-DD e instantes con zona horaria; código y teléfono como texto. Un dato desconocido no equivale a cero, No o ausencia de atenciones. Confirmar cobertura histórica y tratamiento de rectificaciones y revocaciones.')

page('Usuarios y modalidad de consulta')
p('La institución debe aprobar usuarios nominales y sus ámbitos. Los siguientes perfiles son una propuesta funcional, no una autorización concedida.')
table(['Perfil', 'Consulta propuesta y límite'], [
    ('Estudiante', 'Sus propios formularios y estados, si DBU aprueba su publicación en este canal.'),
    ('Docente tutor', 'Estados de estudiantes asignados y pautas expresamente autorizadas durante la vigencia de su asignación. Sin consulta clínica ni descarga masiva.'),
    ('Comisión o coordinación', 'Agregados de su escuela y revisión de sus informes. Acceso individual únicamente con función y autorización explícitas.'),
    ('Responsable de Tutoría', 'Reportes consolidados aprobados y gestión del padrón de autorizaciones.'),
    ('OTI y soporte técnico', 'Operación y trazas minimizadas. El acceso técnico no concede consulta funcional de expedientes.'),
    ('Cuenta de servicio', 'Consulta entre servidores limitada a los campos, recursos y ámbitos aprobados por DBU y OTI.'),
], [4.5, 12.5])
h('Registro nominal que se debe aprobar')
p('Por cada usuario: identificador institucional, nombre, cargo, rol funcional, escuela o ámbito, finalidad, documento de autorización, fecha de inicio, fecha de caducidad y responsable de alta y baja. La relación se completará con personal designado; este documento no incluye ni solicita contraseñas.')
h('Modalidad técnica propuesta')
p('Preferencia: API de lectura entre el servidor de Tutoría y el servicio aprobado por OTI. Cada consulta verificará identidad, rol, estudiante, asignación activa, semestre, ámbito y permiso de acceso. Las credenciales de servicio permanecerán en el servidor, fuera del navegador y del repositorio.')
p('Alternativa si no hay API: archivo CSV UTF-8 o XLSX autorizado, recibido por canal institucional, con manifiesto de lote, corte y responsable. Su carga debe validar el esquema, rechazar campos excluidos y actualizar por clave estable. Esta alternativa no se considera ya implementada.')
p('Propuesta inicial para acordar: actualización diaria en ventana autorizada y consulta bajo demanda desde una copia minimizada. DBU y OTI deberán definir frecuencia final, cobertura, disponibilidad, conservación, revocación y eliminación de copias. No se fijan periodos obligatorios que no estén aprobados.')
p('Registrar usuario, acción, recurso, finalidad, fecha, resultado y autorización, sin copiar contenido profesional en las trazas. La creación del formato 12 en Tutoría no escribe en DBU; un envío hacia DBU requerirá un acuerdo y mecanismo de recepción adicionales.')

page('Actividades y criterios del piloto')
p('Cronograma propuesto de 20 días hábiles desde la designación de responsables y disponibilidad de insumos. Es una estimación para acordar, no un plazo impuesto por las cartas o la resolución. La habilitación con datos identificables depende de la aprobación institucional.')
table(['Etapa', 'Responsables', 'Entregable y tiempo propuesto'], [
    ('1 Precisión', 'Tutoría y DBU', 'Días 1 a 3. Alcance corregido, datos excluidos y usuarios nominales propuestos.'),
    ('2 Viabilidad', 'DBU y OTI', 'Días 4 a 7. Diccionario, catálogos, canal, frecuencia, autorizaciones y condiciones de operación acordados.'),
    ('3 Preparación', 'Responsable del sistema y OTI', 'Días 8 a 13. Persistencia, control por recurso y adaptador de prueba con datos ficticios.'),
    ('4 Piloto', 'DBU, Tutoría y OTI', 'Días 14 a 17. Pruebas de integración, conciliación, permisos, fallas y revocación en el entorno aprobado.'),
    ('5 Aceptación', 'DBU, Tutoría y OTI', 'Días 18 a 20. Acta de resultados, correcciones pendientes y decisión sobre la habilitación.'),
], [3, 4.5, 9.5])
h('Criterios de aceptación')
for text in [
    'El tutor autorizado consulta solo a sus estudiantes asignados; las pruebas de otro estudiante, otra escuela, asignación vencida y usuario sin permiso deben denegarse en el servidor.',
    'La respuesta contiene únicamente campos autorizados. Los diagnósticos, motivos confidenciales y documentos profesionales no se transfieren al navegador ni aparecen en exportaciones o trazas.',
    'Repetir un lote o consultar una atención varias veces no duplica registros. Los cambios de estado se actualizan por la clave del origen; los códigos no reconocidos quedan en conciliación.',
    'Una pauta vencida o revocada deja de mostrarse. La falta de permiso, el servicio no disponible, los datos no entregados y la ausencia confirmada de atenciones se muestran de manera distinta.',
    'Los conteos de atenciones y de estudiantes únicos se contrastan con DBU por servicio y corte. Se verifica la experiencia en móvil y el recorrido de teclado.',
]:
    p('• ' + text)
h('Condiciones pendientes de confirmar')
p('Designaciones y autorización nominal; catálogos y disponibilidad real; frecuencia y conservación; tratamiento de incidencias; responsable de respaldos y revocación; canal de recepción de F12, si se incorpora. Se requiere confirmación separada de la vigencia y reglas de los instrumentos por Gestión Pedagógica.')

page('Texto propuesto para remitir la precisión')
p('A la Dirección de Bienestar Universitario')
p('Asunto: Precisión del requerimiento de consulta de información para el Sistema de Gestión de la Tutoría')
p('Referencia: Carta 001026-2026-DIBU y carta 000151-2026-ATCD')
p('En atención a la carta de la referencia, remitimos para evaluación el plan de trabajo que precisa la finalidad, los perfiles de usuarios, los datos mínimos y la modalidad de consulta propuesta para el seguimiento tutorial.')
p('Precisamos que el alcance propuesto se limita a la información administrativa de las atenciones: identificador, código universitario, servicio, fecha, estado y procedencia con fecha de corte. Las pautas académicas comunicables, los beneficios y la cobertura de seguro se incorporarán únicamente si se acredita su disponibilidad y se autoriza expresamente su tratamiento.')
p('Respecto de los anexos de la solicitud inicial, proponemos excluir del requerimiento de integración los diagnósticos, historias clínicas, tratamientos, informes sociales, evaluaciones y puntajes profesionales, así como los motivos confidenciales. Los archivos académicos corresponden a una coordinación separada con la DIAA.')
p('Solicitamos coordinar una reunión técnica entre DBU, OTI y el responsable del sistema para validar el diccionario, los usuarios nominales y sus ámbitos, el mecanismo de solo lectura y las condiciones de operación. Se adjunta el plan para su revisión y para continuar la evaluación técnica y administrativa señalada en su respuesta.')
p('La relación nominal de usuarios y las designaciones se incorporarán por el canal institucional que se acuerde. La realización de pruebas iniciales utilizará datos ficticios; la habilitación de información identificable quedará sujeta a las autorizaciones correspondientes.')
p('Atentamente,')
p('[Firma y cargo de la persona autorizada para remitir la precisión]')
h('Documentos revisados')
p('Carta 000151-2026-ATCD, siete páginas: alcance principal y anexos de requerimientos. Carta 001026-2026-DIBU, una página: precisión y plan de trabajo. Resolución 500-2022-CU-R-UNAS, extracto proporcionado de quince páginas: formatos 01 a 12.')
p('El extracto de la resolución permite verificar campos y actores de los anexos; no incluye el reglamento completo para confirmar todos los plazos, artículos o vigencia. El informe citado por DBU no fue aportado. El plan no sustituye la aprobación institucional ni acredita una integración ya operativa.')
p('Responsable funcional designado: ____________________    Fecha: __________')
p('Responsable técnico designado: _____________________    Fecha: __________')
p('Validación DBU y OTI: ______________________________    Fecha: __________')

path = OUT / 'plan-trabajo-integracion-dbu.docx'
doc.save(path)
print(path)
