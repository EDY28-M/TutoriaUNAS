"""Prepara un informe para revisión; conserva intacto el Word de referencia."""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import os
from lxml import etree as ET

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = Path(r'C:\Users\UNAS\Downloads\Informe_Avance_PPP_Tutoria_Matias_Bardales_15-10-2026.docx')
EXPECTED_SHA = '8dd8cb5b9b252f7a960d03945a631f453c6f3b5e8380a85911722ce9b7d14963'
TMP = Path(os.environ['TEMP']) / 'tutoria-requerimientos-dbu'
OUT = ROOT / 'artifacts' / 'analisis-tutoria' / 'Requerimientos_Bienestar_Universitario_Tutoria.docx'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}

def node(name, **attrs):
    el = ET.Element(f'{{{W}}}{name}')
    for key, value in attrs.items():
        el.set(f'{{{W}}}{key}', str(value))
    return el

def child(parent, name, **attrs):
    el = node(name, **attrs); parent.append(el); return el

def xml(el):
    return ET.tostring(el, xml_declaration=True, encoding='UTF-8', standalone=True)

def paragraph(text='', *, style='Normal', bold=False, italic=False, align='left',
              indent=720, spacing=480, keep=False, page=False, size=24):
    p = node('p'); pp = child(p, 'pPr')
    child(pp, 'pStyle', val=style)
    child(pp, 'spacing', before=0, after=0, line=spacing, lineRule='auto')
    child(pp, 'ind', left=0, right=0, firstLine=indent)
    child(pp, 'jc', val=align); child(pp, 'widowControl')
    if keep: child(pp, 'keepNext')
    if page: child(pp, 'pageBreakBefore')
    r = child(p, 'r'); rp = child(r, 'rPr')
    child(rp, 'rFonts', ascii='Times New Roman', hAnsi='Times New Roman', cs='Times New Roman')
    child(rp, 'sz', val=size); child(rp, 'szCs', val=size)
    child(rp, 'color', val='000000'); child(rp, 'lang', val='es-PE')
    if bold: child(rp, 'b')
    if italic: child(rp, 'i')
    for i, line in enumerate(text.split('\n')):
        if i: child(r, 'br')
        t=child(r,'t'); t.text=line; t.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
    return p

def text(value): body.append(paragraph(value))

def heading(value, *, page=False, sub=False):
    body.append(paragraph(value, style='Ttulo2' if sub else 'Ttulo1',
                          bold=True, indent=0, align='left' if sub else 'center',
                          keep=True, page=page))

def table(number, title, headers, rows, widths):
    body.append(paragraph(f'Tabla {number}',bold=True,indent=0,keep=True))
    body.append(paragraph(title,italic=True,indent=0,keep=True))
    t=node('tbl'); pr=child(t,'tblPr')
    child(pr,'tblW',w=sum(widths),type='dxa'); child(pr,'tblLayout',type='fixed')
    # APA 7: tres líneas horizontales; sin cuadrícula vertical ni sombreado.
    borders=child(pr,'tblBorders')
    for side in ['top','bottom']:
        child(borders,side,val='single',sz=6,color='000000')
    for side in ['left','right','insideH','insideV']: child(borders,side,val='nil')
    margins=child(pr,'tblCellMar')
    for side,value in [('top',70),('bottom',70),('left',90),('right',90)]:
        child(margins,side,w=value,type='dxa')
    grid=child(t,'tblGrid')
    for width in widths: child(grid,'gridCol',w=width)
    for i,row in enumerate([headers,*rows]):
        tr=child(t,'tr'); trpr=child(tr,'trPr'); child(trpr,'cantSplit')
        if i==0: child(trpr,'tblHeader')
        for value,width in zip(row,widths):
            tc=child(tr,'tc'); cp=child(tc,'tcPr'); child(cp,'tcW',w=width,type='dxa')
            child(cp,'vAlign',val='center')
            if i==0:
                b=child(cp,'tcBorders'); child(b,'bottom',val='single',sz=6,color='000000')
            tc.append(paragraph(value,bold=i==0,indent=0,spacing=276,size=23))
    body.append(t)
    body.append(paragraph('',indent=0,spacing=240,size=12))

if sha256(REFERENCE.read_bytes()).hexdigest()!=EXPECTED_SHA:
    raise RuntimeError('La referencia cambió; es necesario volver a inspeccionarla.')
TMP.mkdir(parents=True,exist_ok=True); OUT.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(REFERENCE) as z: parts={n:z.read(n) for n in z.namelist()}
document=ET.fromstring(parts['word/document.xml'])
body=document.find('w:body',NS)
section=deepcopy(body.find('w:sectPr',NS))
body.clear()

contract=f'''# Contrato de recreación
Referencia: {REFERENCE}
SHA-256: {EXPECTED_SHA}. Seis páginas, una sección A4 vertical, 29 párrafos y siete tablas.
Evidencia: referencia.pdf, referencia-1.png a referencia-6.png; reference-package.json.
Referencia inalterada. Plantilla copiada y parcheada mediante OOXML; partes no afectadas conservadas byte a byte.

## Sistema observado
A4 21 x 29,7 cm; márgenes de referencia superior 3,556, inferior 2,499, laterales 3 cm.
Header/footer 1,249 cm. Times New Roman 12 pt en cuerpo; 14/12/10 pt en membrete.
Cuerpo 1,15 con alineación justificada; metadatos con tabulación y sangría francesa de 2,286 cm.
Normal heredado define primera línea 1,27 cm, 1,5 líneas y 6 pt después; varias anulaciones directas.
Encabezados en negrita y mayúsculas con numeración romana. Tablas de datos en páginas 1 y 2.
Patrón de evidencias en páginas 3 a 6: tablas con 20 imágenes que se eliminan como contenido ajeno.
Membrete de tres líneas; número de página en pie. Sin controles de contenido ni campos del cuerpo.

## Decisiones por petición explícita APA 7
Se conserva el informe institucional, membrete, fecha, metadatos A/DE/ASUNTO, prosa y cierre del ejemplo.
Se ajustan márgenes a 2,54 cm, alineación izquierda, Times New Roman 12, doble espacio sin antes/después,
sangría inicial 1,27 cm y referencias con sangría francesa 1,27 cm. Encabezados nivel 1 centrados.
Título negro en estilo Title, sin subrayado. Numeración automática superior derecha.
Tablas de datos con título y número APA, sin líneas verticales; cuerpo 11,5 pt y espacio 1,15.
Estas desviaciones corresponden a APA 7 solicitado por el usuario, no a una nueva propuesta visual.

## Ubicaciones editables y cobertura
word/document.xml w:body: reemplazar párrafos, tablas de actividad y evidencias por requerimientos y plan.
w:body/w:sectPr: tamaño A4 preservado; márgenes y distancias de membrete ajustados como se indica.
word/header1.xml y footer1.xml: recrear membrete y paginación; sin firma digital o autorización supuesta.
word/styles.xml: roles Normal, Title, Heading1 y Heading2 ajustados para la tipografía solicitada.
docProps/core.xml: título, asunto y autor del nuevo informe. settings.xml: actualizar campos al abrir.
Se retiran relaciones de imágenes del cuerpo y sus 20 archivos no usados; no forman parte del nuevo informe.
Preservar demás partes, relaciones, tema y numeración. No reutilizar fotografía, gráficos o texto de avances.

## Puertas de verificación
Comparar inventario de partes; diferencias solo en las anteriores. Fuente con SHA sin cambios.
Exportar con Word en modo solo lectura (render_docx no disponible por falta de LibreOffice).
Inspeccionar todas las páginas finales, membrete, tablas, sangrías, blancos y paginación.
No remitir ni firmar. El informe precisa el requerimiento y propone accesos para aprobación institucional.
'''
(TMP/'artifact.md').write_text(contract,encoding='utf-8')

body.append(paragraph('Tingo María, 27 de octubre de 2026',align='right',indent=0))
body.append(paragraph('Requerimientos de información y plan de trabajo para la integración con Bienestar Universitario',
                      style='Ttulo',bold=True,align='center',indent=0,keep=True))
body.append(paragraph('A: Mg. Karol Yoshira Espinoza Quispe\nResponsable del Área de Tutoría y Capacitación Docente',indent=0))
body.append(paragraph('DE: Junior Edinson Matías Bardales\nResponsable del desarrollo del Sistema de Gestión de la Tutoría',indent=0))
body.append(paragraph('ASUNTO: Precisión del requerimiento solicitado mediante la Carta 001026-2026-DIBU',indent=0))
text('Señora responsable:')
text('Presento los requerimientos y el plan de trabajo para la consulta de información desde el Sistema de Gestión de la Tutoría, en coordinación con la Dirección de Bienestar Universitario (DBU) y la Oficina de Tecnologías de Información (OTI).')

heading('I Antecedentes y finalidad')
text('La Carta 000151-2026-ATCD solicita un acceso de solo lectura a información general de las atenciones. La Carta 001026-2026-DIBU pide precisar la finalidad, los usuarios, los datos necesarios y la modalidad de consulta antes de evaluar su viabilidad (Universidad Nacional Agraria de la Selva [UNAS], 2026a, 2026b).')
text('La finalidad es seguir las derivaciones tutoriales, conocer la atención recibida o la cita pendiente y elaborar reportes por servicio y periodo, sin pedir al estudiante datos que ya constan en la institución.')
text('La primera página de la solicitud excluye información sensible, pero sus anexos piden diagnósticos, tratamientos e informes profesionales. Se propone sustituir esos pedidos por los datos administrativos de este informe, previa confirmación de la DBU.')

heading('II Alcance y requerimientos funcionales',page=True)
heading('Servicios comprendidos',sub=True)
text('Comprende Medicina, Psicología, Psicopedagogía y Servicio Social, según los registros que confirme la DBU. Comedor y seguro se consultarán como conjuntos separados, si la DBU dispone de ellos y autoriza su entrega.')
heading('Consulta y seguimiento',sub=True)
text('RF01. Consultar por código universitario, servicio y periodo. Mostrar fecha, estado y procedencia, distinguiendo una cita programada de una atención realizada.')
text('RF02. Vincular la derivación del formato 12 con su recepción y seguimiento cuando exista una referencia común. Las atenciones espontáneas conservarán su origen, sin atribuirles una derivación inexistente.')
text('RF03. Mostrar próximas citas y pautas de acompañamiento solo cuando estén registradas y autorizadas para el destinatario. Retirar la visualización de pautas revocadas o vencidas.')
text('RF04. Generar reportes por servicio y periodo con fecha de corte. Contar por separado atenciones y estudiantes únicos, para evitar que varias atenciones se interpreten como varias personas.')
text('RF05. Distinguir ausencia confirmada de atenciones, información no entregada, consulta no autorizada y servicio no disponible. La falta de respuesta de la fuente no equivale a ausencia de atenciones.')
text('RF06. Consultar sin crear, modificar o eliminar atenciones en Bienestar. Un envío de derivaciones hacia la DBU requiere acordar un mecanismo de recepción entre las áreas.')

heading('III Datos estrictamente necesarios',page=True)
text('Se requiere una fila por atención, con una clave estable del sistema de origen. El código universitario permitirá vincular el registro con el padrón académico, sin solicitar nuevamente al estudiante su nombre, escuela, ciclo u otros datos ya disponibles.')
table(1,'Datos comunes de las atenciones', ['Campo solicitado','Uso en el sistema de tutoría'],[
('Identificador de atención','Reconocer cada atención y actualizarla sin crear duplicados. Debe ser estable y no revelar el motivo de consulta.'),
('Código universitario','Vincular la atención con el expediente del estudiante autorizado. Conservarlo como texto.'),
('Servicio o área responsable','Identificar Medicina, Psicología, Psicopedagogía o Servicio Social según el catálogo de la DBU.'),
('Fecha de atención o de cita','Ubicar el evento en el tiempo y diferenciar atención realizada de cita prevista.'),
('Estado del registro','Conocer si el evento está programado, atendido, cancelado o en otro estado real que confirme la DBU.'),
('Fuente y fecha de corte','Informar de qué sistema procede el dato y hasta qué fecha se encuentra actualizado.'),
('Fecha de actualización','Sincronizar rectificaciones si el sistema de origen dispone de esta marca; de lo contrario, acordar la actualización por lote.'),
],[3000,6030])
body.append(paragraph('Nota. Los nombres definitivos, valores permitidos y campos disponibles se acordarán con la DBU y la OTI. Un campo no registrado debe conservarse como desconocido; no se completará con información supuesta.',indent=0))

heading('Datos por servicio y condiciones de ampliación',page=True)
table(2,'Información específica que debe confirmar Bienestar', ['Servicio o conjunto','Información requerida y condición'],[
('Medicina','Datos comunes de la atención. Próxima cita y pauta de apoyo académico solo cuando estén registradas y autorizadas; sin diagnóstico, tratamiento, historia clínica o resultados de exámenes.'),
('Psicología','Datos comunes y estado administrativo de la continuidad, si existe. Recomendación funcional comunicable con autorización y vigencia; sin pruebas, puntajes, contenido de sesiones ni informe psicológico.'),
('Psicopedagogía','Datos comunes y, si se autoriza, estrategia de apoyo al estudio que el tutor deba aplicar, con vigencia. No se requiere el informe de evaluación ni un diagnóstico.'),
('Servicio Social','Datos comunes de atención y estado de gestión de un apoyo, si se registra. No se requiere clasificación socioeconómica, ingresos familiares ni el informe social.'),
('Comedor universitario','Identificador de beneficio, código universitario, periodo, estado de postulación o beneficio y vigencia. Etapa pendiente solo si existe y es comunicable; sin informes de evaluación ni motivos confidenciales.'),
('Seguro de salud','Entidad, estado de cobertura, fuente y fecha de corte, únicamente si la DBU dispone de un registro verificable y autoriza compartirlo. La atención recibida no acredita afiliación al SIS.'),
],[2500,6530])
text('Los campos de próxima cita, continuidad y apoyo académico son adicionales: su ausencia no impedirá recibir la consulta administrativa básica. Una pauta comunicable deberá incluir su referencia de autorización, destinatario o ámbito y vigencia. No se habilitará texto libre confidencial como parte de la respuesta general.')
text('Las identidades y la matrícula procederán del padrón académico; la asignación de tutores, de las escuelas. No se solicita a la DBU que vuelva a producir esos padrones. Los nombres, el semestre, la escuela y el ciclo se reutilizarán al presentar los formatos y reportes.')

heading('IV Usuarios y condiciones de acceso',page=True)
text('Se proponen los siguientes perfiles para evaluación institucional. La habilitación de cada persona deberá constar en una relación nominal aprobada por los responsables correspondientes; la existencia de un perfil en el sistema no constituye por sí sola autorización de acceso.')
table(3,'Alcance propuesto para cada perfil', ['Perfil','Consulta y límite'],[
('Docente tutor','Atenciones de estudiantes con asignación tutorial activa, dentro del ámbito y periodo autorizados. Pautas funcionales solo con permiso expreso.'),
('Coordinación de escuela','Reportes agregados de su escuela. Consulta individual únicamente si existe una función y autorización expresas.'),
('Responsable de Tutoría','Reportes consolidados aprobados y seguimiento de autorizaciones, según las competencias que se definan.'),
('Estudiante','Sus propios estados, citas y formularios, si la DBU autoriza su publicación mediante este canal.'),
('Cuenta de integración','Consulta entre servidores de los recursos y campos autorizados. Sin permisos de escritura en la fuente.'),
('OTI y soporte','Configuración y operación técnica con trazas minimizadas. Cualquier acceso funcional a datos requiere autorización independiente.'),
],[2500,6530])
text('La relación nominal deberá contener identificador institucional, nombre, cargo, rol, escuela o ámbito, finalidad, documento de autorización, fechas de inicio y caducidad y responsable de alta y baja. La DBU y la OTI definirán el procedimiento para aprobar, revisar y revocar los accesos.')
text('El servidor deberá comprobar la identidad, el rol, el permiso de consulta y la asignación vigente antes de devolver datos. El navegador recibirá solo los campos aprobados. Las credenciales de integración permanecerán en el servidor y no formarán parte del código entregado al navegador.')

heading('V Modalidad y requisitos de entrega',page=True)
heading('Modalidad de consulta propuesta',sub=True)
text('Se propone una API de solo lectura entre el servidor de Tutoría y el servicio aprobado por la OTI. La consulta identificará al estudiante y el periodo permitido; devolverá únicamente los campos autorizados. La DBU y la OTI confirmarán su viabilidad, autenticación y disponibilidad.')
text('Como alternativa, se podrán recibir archivos CSV UTF-8 o XLSX por un canal institucional autorizado. Cada lote indicará fuente, corte y responsable. Se validarán el esquema y las claves; los códigos sin correspondencia quedarán pendientes de conciliación.')
heading('Diccionario y actualización',sub=True)
text('Se solicita un diccionario con nombre del campo, significado, tipo, longitud, valores admitidos, nulabilidad y clave. Las fechas usarán AAAA-MM-DD y los instantes incluirán su zona horaria. Se requieren catálogos de servicios y estados y reglas de rectificación o retiro de registros.')
text('Se propone una actualización diaria, sujeta al acuerdo y capacidad de las áreas responsables, con corte visible al usuario. Antes de habilitar el intercambio se definirán conservación, respaldo, revocación y eliminación de copias.')
heading('Reutilización y trazabilidad',sub=True)
text('Las atenciones se actualizarán por su identificador de origen, sin duplicarlas al repetir una consulta o un lote. Los informes reutilizarán los datos validados y su procedencia. Las evaluaciones de tutoría conservarán respuestas propias de cada sesión.')
text('Las trazas registrarán usuario, acción, fecha, recurso y resultado de autorización, sin detalles profesionales. Se utilizarán datos ficticios durante el desarrollo y las pruebas. La conexión institucional requiere aprobación del alcance, los usuarios y el entorno técnico.')

heading('VI Plan de trabajo y verificación',page=True)
text('Se propone el siguiente plan de veinte días hábiles, contados desde la designación de responsables y la disponibilidad de insumos. Los tiempos son estimaciones para coordinación y deberán ajustarse con la DBU y la OTI.')
table(4,'Actividades propuestas para la integración', ['Etapa y plazo','Responsables','Entregable'],[
('Precisión\nDías 1 a 3','Tutoría y DBU','Campos y exclusiones acordados; servicios disponibles y relación de usuarios propuesta.'),
('Viabilidad\nDías 4 a 7','DBU y OTI','Diccionario, catálogos, canal, mecanismo de acceso y condiciones de actualización.'),
('Preparación\nDías 8 a 13','Responsable del sistema y OTI','Adaptador de consulta, controles por recurso y pruebas con datos ficticios.'),
('Piloto\nDías 14 a 17','DBU, Tutoría y OTI','Pruebas de consulta, conciliación, actualización y revocación en el entorno autorizado.'),
('Evaluación\nDías 18 a 20','DBU, Tutoría y OTI','Acta de resultados, correcciones pendientes y decisión de habilitación.'),
],[2000,2500,4530])
heading('Criterios de aceptación',sub=True)
text('Se verificará que un tutor consulte únicamente a sus estudiantes autorizados; que los campos excluidos no aparezcan en las respuestas, exportaciones o trazas; que un lote repetido no genere duplicados; y que una corrección de la fuente actualice el registro correspondiente.')
text('También se contrastarán los totales por servicio y corte con la DBU. Se comprobará el tratamiento de datos desconocidos, falta de autorización y caída del servicio, así como el retiro de pautas vencidas y de accesos revocados. Los resultados y observaciones deberán quedar registrados antes de decidir la puesta en operación.')

heading('VII Conclusiones y solicitud',page=True)
text('El Sistema de Gestión de la Tutoría necesita una consulta administrativa mínima para dar seguimiento a las atenciones y elaborar reportes. La información profesional reservada permanecerá en los servicios que la generan. Cualquier ampliación deberá sustentarse en una finalidad concreta y contar con autorización institucional.')
text('Solicito que el Área de Tutoría y Capacitación Docente revise este requerimiento y lo remita a la DBU para precisar los campos disponibles y coordinar con la OTI su viabilidad técnica. Se requiere designar a los responsables de coordinación, aprobar la relación nominal de usuarios y acordar el mecanismo de consulta antes de habilitar el intercambio.')
text('Presento el documento para su revisión y las coordinaciones correspondientes.')
body.append(paragraph('Atentamente,\nJunior Edinson Matías Bardales\nResponsable del desarrollo del Sistema de Gestión de la Tutoría',align='center',indent=0))
heading('Referencias',page=True)
for ref in [
    'Universidad Nacional Agraria de la Selva. (2026a). Carta 000151-2026-ATCD sobre la solicitud de acceso de solo lectura a información de atenciones de estudiantes para el seguimiento tutorial [Documento institucional]. Área de Tutoría y Capacitación Docente.',
    'Universidad Nacional Agraria de la Selva. (2026b). Carta 001026-2026-DIBU sobre la precisión del requerimiento de acceso a información de la Plataforma de Bienestar Universitario [Documento institucional]. Dirección de Bienestar Universitario.',
]:
    p=paragraph(ref,indent=0)
    original_run=p.find('w:r',NS); original_props=deepcopy(original_run.find('w:rPr',NS)); p.remove(original_run)
    start=ref.index('Carta '); end=ref.index(' [Documento institucional]')
    for value,is_title in [(ref[:start],False),(ref[start:end],True),(ref[end:],False)]:
        r=child(p,'r'); rp=deepcopy(original_props); r.append(rp)
        if is_title: child(rp,'i')
        t=child(r,'t'); t.text=value; t.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
    ind=p.find('w:pPr/w:ind',NS); ind.set(f'{{{W}}}left','720'); ind.attrib.pop(f'{{{W}}}firstLine',None); ind.set(f'{{{W}}}hanging','720'); body.append(p)

# Geometría APA aplicada sobre la sección A4 del ejemplo.
pgmar=section.find('w:pgMar',NS)
for attr in ['top','bottom','left','right']: pgmar.set(f'{{{W}}}{attr}','1440')
pgmar.set(f'{{{W}}}header','300'); pgmar.set(f'{{{W}}}footer','720')
for first in section.findall('w:titlePg',NS): section.remove(first)
body.append(section)
parts['word/document.xml']=xml(document)

styles=ET.fromstring(parts['word/styles.xml'])
for sid in ['Normal','Ttulo','Ttulo1','Ttulo2']:
    style=styles.find(f"w:style[@w:styleId='{sid}']",NS)
    if style is None: continue
    for name in ['pPr','rPr']:
        old=style.find(f'w:{name}',NS)
        if old is not None: style.remove(old)
    pp=child(style,'pPr'); child(pp,'spacing',before=0,after=0,line=480,lineRule='auto')
    child(pp,'ind',firstLine=720 if sid=='Normal' else 0); child(pp,'widowControl')
    if sid!='Normal': child(pp,'keepNext')
    rp=child(style,'rPr'); child(rp,'rFonts',ascii='Times New Roman',hAnsi='Times New Roman',cs='Times New Roman')
    child(rp,'sz',val=24); child(rp,'szCs',val=24); child(rp,'color',val='000000')
    if sid!='Normal': child(rp,'b')
parts['word/styles.xml']=xml(styles)

hdr=ET.fromstring(parts['word/header1.xml'])
hdr.clear()
page=paragraph('',align='right',indent=0,spacing=240,size=24)
r=child(page,'r'); f=child(r,'fldChar',fldCharType='begin')
r=child(page,'r'); instr=child(r,'instrText'); instr.text=' PAGE '
r=child(page,'r'); child(r,'fldChar',fldCharType='end')
hdr.append(page)
hdr.append(paragraph('UNIVERSIDAD NACIONAL AGRARIA DE LA SELVA\nVICERRECTORADO ACADÉMICO\nÁREA DE TUTORÍA Y CAPACITACIÓN DOCENTE',bold=True,align='center',indent=0,spacing=240,size=20))
parts['word/header1.xml']=xml(hdr)
footer=ET.fromstring(parts['word/footer1.xml']); footer.clear(); footer.append(paragraph('',indent=0)); parts['word/footer1.xml']=xml(footer)
settings=ET.fromstring(parts['word/settings.xml'])
for odd in settings.findall('w:evenAndOddHeaders',NS): settings.remove(odd)
update=settings.find('w:updateFields',NS)
if update is None: update=child(settings,'updateFields',val='true')
else: update.set(f'{{{W}}}val','true')
parts['word/settings.xml']=xml(settings)
core=ET.fromstring(parts['docProps/core.xml'])
for tag,value in [('title','Requerimientos de información y plan de trabajo para la integración con Bienestar Universitario'),('subject','Precisión de la Carta 001026-2026-DIBU'),('creator','Junior Edinson Matías Bardales')]:
    el=core.find(f'{{http://purl.org/dc/elements/1.1/}}{tag}')
    if el is not None: el.text=value
parts['docProps/core.xml']=xml(core)

# Retirar solo imágenes del contenido de avances que se eliminó expresamente.
rels=ET.fromstring(parts['word/_rels/document.xml.rels']); removed=[]
for rel in list(rels):
    if rel.get('Type','').endswith('/image'):
        target=rel.get('Target',''); removed.append('word/'+target); rels.remove(rel)
for name in removed: parts.pop(name,None)
parts['word/_rels/document.xml.rels']=xml(rels)
with ZipFile(OUT,'w',ZIP_DEFLATED) as z:
    for name,data in parts.items(): z.writestr(name,data)
with ZipFile(REFERENCE) as z:
    changed=[n for n in z.namelist() if n in parts and parts[n]!=z.read(n)]
(TMP/'package-diff.json').write_text(json.dumps({'changed':changed,'removed':removed,'reference_sha':EXPECTED_SHA},indent=2),encoding='utf-8')
assert sha256(REFERENCE.read_bytes()).hexdigest()==EXPECTED_SHA
print(OUT)
