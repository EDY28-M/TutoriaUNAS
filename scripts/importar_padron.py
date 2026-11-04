"""Importa el padrón autorizado a PostgreSQL sin publicar datos en el frontend.

Solo usa la biblioteca estándar. Sin --apply valida el Excel sin modificar la BD.
Los valores del libro se tratan exclusivamente como datos.
"""

import argparse
import collections
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import unicodedata
import xml.etree.ElementTree as ET
import zipfile


NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SCHOOLS = {
    "ADMINISTRACION": "E-ADM", "CONTABILIDAD": "E-CON", "ECONOMIA": "E-ECO",
    "INGENIERIA EN INFORMATICA Y SISTEMAS": "E-IIS", "AGRONOMIA": "E-AGR",
    "INGENIERIA FORESTAL": "E-FOR", "ZOOTECNIA": "E-ZOO",
    "INGENIERIA EN CONSERVACION DE SUELOS Y AGUA": "E-CSA",
    "INGENIERIA EN INDUSTRIAS ALIMENTARIAS": "E-IIA",
    "INGENIERIA MECANICA ELECTRICA": "E-IME",
    "INGENIERIA EN RECURSOS NATURALES RENOVABLES": "E-RNR",
    "INGENIERIA AMBIENTAL": "E-AMB", "INGENIERIA EN CIBERSEGURIDAD": "E-CIB",
    "TURISMO Y HOTELERIA": "E-TUH", "INGENIERIA CIVIL": "E-CIV",
}


def text(value):
    return " ".join(str(value or "").split())


def normalized(value):
    return "".join(c for c in unicodedata.normalize("NFD", text(value).upper())
                   if unicodedata.category(c) != "Mn")


def stable_id(prefix, *values):
    return prefix + hashlib.sha256("|".join(map(str, values)).encode()).hexdigest()[:24]


def number(value):
    value = text(value)
    return float(value.replace(",", ".")) if value else None


def has_identity(first_name, last_name, email):
    return bool(text(first_name) and text(last_name) and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", text(email)))


def sheet_rows(archive, path, shared):
    with archive.open(path) as stream:
        for _, row in ET.iterparse(stream, events=("end",)):
            if row.tag != "{" + NS["s"] + "}row":
                continue
            cells = {}
            for cell in row.findall("s:c", NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"])[0]
                idx = 0
                for char in column:
                    idx = idx * 26 + ord(char) - 64
                value = cell.findtext("s:v", default="", namespaces=NS)
                if cell.get("t") == "s":
                    value = shared[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(cell.itertext())
                cells[idx - 1] = value
            yield int(row.attrib["r"]), [cells.get(i, "") for i in range(21)]
            row.clear()


def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(t.itertext()) for t in root]
        relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in relations}
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheets = []
        for sheet in workbook.findall("s:sheets/s:sheet", NS):
            rid = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = targets[rid]
            location = target.lstrip("/") if target.startswith("/") else "xl/" + target
            sheets.append((sheet.get("name"), list(sheet_rows(archive, location, shared))))
        return sheets


def hours(raw, duration):
    match = re.fullmatch(r"(\d{1,2})\s*-\s*(\d{1,2})\s*([ap])m\.?", text(raw), re.I)
    if not match or not duration or duration <= 0:
        return None
    start12, end12, suffix = match.groups()
    end = int(end12) % 12 + (12 if suffix.lower() == "p" else 0)
    start = end - duration
    if start < 0 or start >= end or start % 12 != int(start12) % 12:
        return None
    return f"{start:02}:00", f"{end:02}:00"


def prepare(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    source = {"archivo": path.name, "sha256": digest}
    sheets = read_workbook(path)
    students_sheet = next((s for s in sheets if any(normalized(r[1][0]) == "COD SEM" for r in s[1])), None)
    teachers_sheet = next((s for s in sheets if any(normalized(r[1][1]) == "APELLIDO PATERNO" for r in s[1])), None)
    if not students_sheet or not teachers_sheet:
        raise ValueError("No se reconocen las cabeceras de alumnos y docentes.")
    expected = ["COD SEM", "COD ALUMNO", "APE PAT ALUMNO", "APE MAT ALUMNO", "NOMBRES",
                "ESCUELA ALUMNO", "ESTADO", "PPA", "TCA", "EMAIL UNAS", "CELULAR",
                "COD CURSO", "NOMBRE CURSO", "GRUPO CURSO", "NOMBRE AULA", "COD AULA",
                "DOCENTE", "DIA SEMANA", "DURACION HORAS", "HORAS", "ES HORA TEORICA"]
    student_header = next(row for _, row in students_sheet[1] if normalized(row[0]) == "COD SEM")
    if list(map(normalized, student_header)) != expected:
        raise ValueError("Las columnas cambiaron. Revisa el mapeo antes de importar.")
    teacher_header = next(row for _, row in teachers_sheet[1] if normalized(row[1]) == "APELLIDO PATERNO")
    if list(map(normalized, teacher_header[1:6])) != ["APELLIDO PATERNO", "APELLIDO MATERNO", "NOMBRES", "EMAIL", "DEPARTAMENTO ACADEMICO"]:
        raise ValueError("Las columnas del padrón docente cambiaron.")
    students, teachers, courses, schools, enrollments, schedules = {}, {}, {}, {}, {}, {}
    source_rows = omitted = repeated_hours = 0
    excluded_students, excluded_teachers = set(), []
    semesters = set()
    for rownum, row in students_sheet[1]:
        if rownum <= 4 or not text(row[1]):
            continue
        row = list(map(text, row))
        source_rows += 1
        if not has_identity(row[4], text(row[2] + " " + row[3]), row[9]):
            excluded_students.add(row[1])
            continue
        if not re.fullmatch(r"\d{4}-[12]", row[0]) or not re.fullmatch(r"[0-9A-Za-z-]+", row[1]):
            raise ValueError(f"Código de semestre o alumno inválido en fila {rownum}.")
        semester = row[0][:-1] + ("I" if row[0][-1] == "1" else "II")
        semesters.add(semester)
        school = SCHOOLS.get(normalized(row[5]))
        if not school:
            raise ValueError(f"Escuela sin mapeo en fila {rownum}.")
        if normalized(row[6]) != "MATRICULADO":
            raise ValueError(f"Estado académico sin mapeo en fila {rownum}.")
        origin = {**source, "hoja": students_sheet[0]}
        school_data = {"id": school, "nombre": row[5], "abreviatura": school[2:], "facultadId": ""}
        schools[school] = school_data
        sid = "PAD-ALU-" + row[1]
        if sid in students and students[sid]["_identity"] != row[:11]:
            raise ValueError(f"Datos personales contradictorios en fila {rownum}.")
        if sid not in students:
            ppa, tca = number(row[7]), number(row[8])
            if ppa is not None and not 0 <= ppa <= 20 or tca is not None and tca < 0:
                raise ValueError(f"PPA o TCA inválido en fila {rownum}.")
            students[sid] = {"id": sid, "codigo": row[1], "apellidos": text(row[2] + " " + row[3]),
                "apellidoPaterno": row[2], "apellidoMaterno": row[3], "nombres": row[4], "escuelaId": school, "ciclo": None, "etapa": "sin-informar",
                "estado": "regular", "estadoFuente": row[6], "correo": row[9], "telefono": row[10],
                "ingreso": "", "ppaFuente": row[7], "tcaFuente": row[8], "promedioPonderado": ppa, "creditosAprobados": tca,
                "creditosTotales": None, "alertas": [], "origen": {**origin, "filas": []}, "_identity": row[:11]}
        students[sid]["origen"]["filas"].append(rownum)
        if not row[11] or not row[12]:
            raise ValueError(f"Curso sin código o nombre en fila {rownum}.")
        cid = stable_id("PAD-CUR-", school, row[11])
        course = {"id": cid, "codigo": row[11], "nombre": row[12], "creditos": None,
                  "ciclo": None, "escuelaId": school, "origen": origin}
        if cid in courses and courses[cid]["nombre"] != row[12]:
            raise ValueError(f"Nombres de curso contradictorios en fila {rownum}.")
        courses[cid] = course
        enrollment = enrollments.setdefault((sid, semester), {"estudianteId": sid, "semestreId": semester,
            "fecha": "", "estado": "matriculado", "planEstudios": "", "ciclo": None,
            "origen": origin, "cursos": {}})
        enrolled = enrollment["cursos"].setdefault((cid, row[13]), {"cursoId": cid, "seccion": row[13],
            "creditos": None, "docente": row[16], "horario": [], "horariosOriginales": []})
        if enrolled["docente"] != row[16]:
            enrolled["docente"] = " / ".join(sorted(set(enrolled["docente"].split(" / ") + [row[16]])))
        raw = {"fila": rownum, "dia": row[17], "horas": row[19], "duracion": row[18],
               "aula": row[14], "codigoAula": row[15], "esHoraTeorica": row[20], "docente": row[16]}
        enrolled["horariosOriginales"].append(raw)
        day = int(row[17]) if re.fullmatch(r"[1-7]", row[17]) else None
        duration = int(row[18]) if row[18].isdigit() else None
        parsed = hours(row[19], duration)
        label = f"Día {row[17]} {row[19]}"
        if label not in enrolled["horario"]:
            enrolled["horario"].append(label)
        if not day or not parsed:
            omitted += 1
            continue
        start, end = parsed
        hid = stable_id("PAD-HOR-", sid, semester, cid, row[13], day, start, end, row[15], row[20])
        if hid in schedules:
            schedules[hid]["origen"]["filas"].append(rownum)
            repeated_hours += 1
            continue
        schedules[hid] = {"id": hid, "titulo": row[12] + " · " + row[13], "dia": day,
            "horaInicio": start, "horaFin": end, "modalidad": "presencial", "lugar": row[14],
            "tipo": "academico", "estudianteId": sid, "cursoId": cid, "semestreId": semester,
            "origen": {**origin, "filas": [rownum]}}
    if len(semesters) != 1:
        raise ValueError("El padrón debe corresponder a un único semestre.")
    teacher_rows = 0
    for rownum, row in teachers_sheet[1]:
        if rownum <= 3 or not text(row[1]):
            continue
        teacher_rows += 1
        row = list(map(text, row))
        if not has_identity(row[3], text(row[1] + " " + row[2]), row[4]):
            excluded_teachers.append(rownum)
            continue
        tid = stable_id("PAD-DOC-", *map(normalized, [row[1], row[2], row[3], row[5]]))
        teacher = teachers.setdefault(tid, {"id": tid, "codigo": "", "apellidos": text(row[1] + " " + row[2]),
            "apellidoPaterno": row[1], "apellidoMaterno": row[2], "nombres": row[3], "escuelaId": "", "departamento": row[5], "categoria": None,
            "dedicacion": None, "correo": row[4], "telefono": "", "activo": True,
            "aforoMaximo": None, "cursosAsignados": [], "origen": {**source, "hoja": teachers_sheet[0], "filas": []}})
        if teacher["correo"] and row[4] and teacher["correo"].lower() != row[4].lower():
            raise ValueError(f"Correos docentes contradictorios en fila {rownum}.")
        teacher["correo"] = teacher["correo"] or row[4]
        teacher["origen"]["filas"].append(rownum)
    for student in students.values():
        del student["_identity"]
    for enrollment in enrollments.values():
        enrollment["cursos"] = list(enrollment["cursos"].values())
        for course in enrollment["cursos"]:
            course["horario"] = " · ".join(course["horario"])
    semester = next(iter(semesters))
    report = {**source, "semestre": semester, "semestreFuente": semester.replace('-II', '-2').replace('-I', '-1'), "filasAlumnos": source_rows, "alumnos": len(students),
        "filasDocentes": teacher_rows, "docentes": len(teachers),
        "alumnosExcluidos": len(excluded_students), "filasDocentesExcluidas": len(excluded_teachers),
        "duplicadosDocentes": teacher_rows - len(excluded_teachers) - len(teachers),
        "escuelas": len(schools), "cursos": len(courses), "matriculas": len(enrollments),
        "cursosMatriculados": sum(len(m["cursos"]) for m in enrollments.values()),
        "horarios": len(schedules), "horariosDuplicados": repeated_hours, "horariosSinNormalizar": omitted,
        "sinPpa": sum(s["promedioPonderado"] is None for s in students.values()),
        "sinCiclo": len(students), "sinEscuelaTutorialDocente": len(teachers)}
    if not students or not teachers:
        raise ValueError("El padrón está vacío.")
    return {"estudiantes": list(students.values()), "docentes": list(teachers.values()),
            "escuelas": list(schools.values()), "cursos": list(courses.values()),
            "matriculas": list(enrollments.values()), "horarios": list(schedules.values()), "resumen": report}


def sql_json(value):
    return "'" + json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("'", "''") + "'::jsonb"


def import_sql(data):
    # Todos los valores del libro son literales JSON, nunca identificadores o SQL ejecutable.
    statements = ["SET standard_conforming_strings = on;", "SELECT pg_advisory_xact_lock(20261104);"]
    for key, kind in [("estudiantes", "estudiante"), ("docentes", "tutor")]:
        statements.append(f'''INSERT INTO "Personas" ("Id","Tipo","EscuelaId","Ciclo","Activa","DatosJson")
            SELECT j->>'id','{kind}',j->>'escuelaId',NULL,true,j FROM jsonb_array_elements({sql_json(data[key])}) j
            ON CONFLICT ("Id") DO UPDATE SET "DatosJson" = EXCLUDED."DatosJson" || jsonb_build_object('ciclo',"Personas"."Ciclo"),
            "EscuelaId" = CASE WHEN EXCLUDED."EscuelaId" = '' THEN "Personas"."EscuelaId" ELSE EXCLUDED."EscuelaId" END
            WHERE "Personas"."DatosJson" IS DISTINCT FROM (EXCLUDED."DatosJson" || jsonb_build_object('ciclo',"Personas"."Ciclo"));''')
    for key, kind in [("escuelas", "escuelas"), ("cursos", "cursos")]:
        statements.append(f'''INSERT INTO "Catalogos" ("Tipo","Id","DatosJson","Version")
            SELECT '{kind}',j->>'id',j,1 FROM jsonb_array_elements({sql_json(data[key])}) j
            ON CONFLICT ("Tipo","Id") DO UPDATE SET "DatosJson" = "Catalogos"."DatosJson" || EXCLUDED."DatosJson" ||
            CASE WHEN '{kind}' = 'escuelas' THEN jsonb_build_object('facultadId',coalesce("Catalogos"."DatosJson"->>'facultadId','')) ELSE '{{}}'::jsonb END,
            "Version"="Catalogos"."Version"+1 WHERE "Catalogos"."DatosJson" IS DISTINCT FROM ("Catalogos"."DatosJson" || EXCLUDED."DatosJson" ||
            CASE WHEN '{kind}' = 'escuelas' THEN jsonb_build_object('facultadId',coalesce("Catalogos"."DatosJson"->>'facultadId','')) ELSE '{{}}'::jsonb END);''')
    statements.append(f'''INSERT INTO "Periodos" ("Id","EscuelaId","SemestreId","Momento","Activo","Version")
        SELECT ({sql_json(data['resumen']['semestre'])}#>>'{{}}') || '|' || (j->>'id'),j->>'id',
        {sql_json(data['resumen']['semestre'])}#>>'{{}}','durante',true,1 FROM jsonb_array_elements({sql_json(data['escuelas'])}) j
        WHERE NOT EXISTS (SELECT 1 FROM "Periodos" p WHERE p."EscuelaId"=j->>'id' AND p."Activo")
        ON CONFLICT DO NOTHING;''')
    statements.append(f'''INSERT INTO "Matriculas" ("Id","EstudianteId","SemestreId","DatosJson")
        SELECT (j->>'estudianteId') || '|' || (j->>'semestreId'),j->>'estudianteId',j->>'semestreId',j
        FROM jsonb_array_elements({sql_json(data['matriculas'])}) j
        ON CONFLICT ("Id") DO UPDATE SET "DatosJson"=EXCLUDED."DatosJson" WHERE "Matriculas"."DatosJson" IS DISTINCT FROM EXCLUDED."DatosJson";''')
    statements.append(f'''INSERT INTO "Horarios" ("Id","EstudianteId","SemestreId","Dia","HoraInicio","HoraFin","DatosJson")
        SELECT j->>'id',j->>'estudianteId',j->>'semestreId',(j->>'dia')::int,j->>'horaInicio',j->>'horaFin',j
        FROM jsonb_array_elements({sql_json(data['horarios'])}) j
        ON CONFLICT ("Id") DO UPDATE SET "DatosJson"=EXCLUDED."DatosJson","Dia"=EXCLUDED."Dia","HoraInicio"=EXCLUDED."HoraInicio","HoraFin"=EXCLUDED."HoraFin"
        WHERE "Horarios"."DatosJson" IS DISTINCT FROM EXCLUDED."DatosJson";''')
    report = data["resumen"]
    summaries = [{"estudianteId": p["id"], "semestreId": report["semestre"],
        "promedioPonderado": p["promedioPonderado"], "creditosAprobados": p["creditosAprobados"],
        "creditosMatriculados": None, "avanceCurricular": None, "posicion": None,
        "fuente": "Padrón Excel autorizado · " + report["archivo"], "fechaCorte": ""} for p in data["estudiantes"]]
    statements.append(f'''INSERT INTO "Fuentes" ("Tipo","Id","EscuelaId","EstudianteId","TutorId","DatosJson","SemestreId","Fuente","FechaCorte","Version")
        SELECT 'resumenesAcademicos',(j->>'estudianteId') || '|' || (j->>'semestreId'),p."EscuelaId",j->>'estudianteId',NULL,j,j->>'semestreId',j->>'fuente',now(),1
        FROM jsonb_array_elements({sql_json(summaries)}) j JOIN "Personas" p ON p."Id"=j->>'estudianteId'
        ON CONFLICT ("Tipo","Id") DO UPDATE SET "DatosJson"=EXCLUDED."DatosJson","Version"="Fuentes"."Version"+1
        WHERE "Fuentes"."DatosJson" IS DISTINCT FROM EXCLUDED."DatosJson";''')
    # El estado tutorial, los usuarios y las asignaciones existentes no se modifican.
    statements.append(f'''INSERT INTO "Fuentes" ("Tipo","Id","EscuelaId","EstudianteId","TutorId","DatosJson","Fuente","FechaCorte","Version")
        VALUES ('importacionesPadron',{sql_json(report['sha256'])}#>>'{{}}',NULL,NULL,NULL,{sql_json(report)},'Excel autorizado',now(),1)
        ON CONFLICT ("Tipo","Id") DO UPDATE SET "DatosJson"=EXCLUDED."DatosJson","Version"="Fuentes"."Version"+1
        WHERE "Fuentes"."DatosJson" IS DISTINCT FROM EXCLUDED."DatosJson";''')
    checks = [("Personas", "Id", [s["id"] for s in data["estudiantes"] + data["docentes"]]),
              ("Matriculas", "Id", [m["estudianteId"] + "|" + m["semestreId"] for m in data["matriculas"]]),
              ("Horarios", "Id", [h["id"] for h in data["horarios"]])]
    for table, column, ids in checks:
        statements.append(f'''DO $verify$ BEGIN IF (SELECT count(*) FROM "{table}" WHERE "{column}" IN
            (SELECT jsonb_array_elements_text({sql_json(ids)}))) <> {len(ids)} THEN
            RAISE EXCEPTION 'La conciliación de {table} falló'; END IF; END $verify$;''')
    return "\n".join(statements)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--config", type=Path, default=Path(__file__).resolve().parents[1] / "backend/TutoriaUNAS.Api/appsettings.Development.local.json")
    parser.add_argument("--postgres-bin", type=Path, default=Path(os.environ["LOCALAPPDATA"]) / "TutoriaUNAS/postgresql-18.6/pgsql/bin")
    args = parser.parse_args()
    data = prepare(args.archivo.resolve(strict=True))
    print(json.dumps(data["resumen"], ensure_ascii=False, indent=2))
    if not args.apply:
        return
    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    settings = dict(part.split("=", 1) for part in config["ConnectionStrings"]["Tutoria"].split(";") if "=" in part)
    if settings.get("Host") not in ("127.0.0.1", "localhost") or settings.get("Database") != "tutoria_unas":
        raise ValueError("Este importador solo escribe en la base local tutoria_unas.")
    env = {**os.environ, "PGPASSWORD": settings["Password"], "PGCLIENTENCODING": "UTF8"}
    connection = ["-h", settings["Host"], "-p", settings.get("Port", "5432"), "-U", settings["Username"], "-d", settings["Database"]]
    folder = Path(os.environ["LOCALAPPDATA"]) / "TutoriaUNAS/importaciones" / dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    folder.mkdir(parents=True)
    backup = folder / "antes-del-padron.dump"
    subprocess.run([str(args.postgres_bin / "pg_dump.exe"), *connection, "--format=custom", "--file", str(backup)], env=env, check=True, capture_output=True)
    result = subprocess.run([str(args.postgres_bin / "psql.exe"), *connection, "--no-psqlrc", "--single-transaction", "-v", "ON_ERROR_STOP=1", "-q"],
                            input=import_sql(data), encoding="utf-8", env=env, capture_output=True)
    if result.returncode:
        # psql puede incluir SQL con datos personales. Conservar el diagnóstico fuera de Git.
        (folder / "error.local.txt").write_text(result.stderr, encoding="utf-8")
        raise RuntimeError(f"Se revirtió la importación. Diagnóstico local: {folder}")
    report = {**data["resumen"], "respaldo": str(backup), "conciliacion": "correcta", "cuentasCreadas": 0, "asignacionesCreadas": 0}
    (folder / "resultado.local.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Importación confirmada y conciliada. Respaldo y resultado: {folder}")


if __name__ == "__main__":
    main()
