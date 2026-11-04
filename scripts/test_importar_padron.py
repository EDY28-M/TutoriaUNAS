"""Pruebas con un Excel sintético; nunca utilizan el padrón real."""
import tempfile
import unittest
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile
from importar_padron import hours, prepare, sql_json


def workbook(path):
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    header = ['COD SEM', 'COD ALUMNO', 'APE PAT ALUMNO', 'APE MAT ALUMNO', 'NOMBRES',
              'ESCUELA ALUMNO', 'ESTADO', 'PPA', 'TCA', 'EMAIL UNAS', 'CELULAR',
              'COD CURSO', 'NOMBRE CURSO', 'GRUPO CURSO', 'NOMBRE AULA', 'COD AULA',
              'DOCENTE ', 'DIA SEMANA', 'DURACION HORAS', 'HORAS', 'ES HORA TEORICA']
    student = ['2026-2', 'TEST0001', 'Ficticio', 'Prueba', 'Alumno', 'ECONOMIA',
               'MATRICULADO', '0', '0', 'alumno@prueba.invalid', '012345678', 'ECO-01',
               "Curso d'ejemplo", 'A', 'Aula ficticia', '001', 'Docente ficticio', '6', '4', '09-01 pm.', '1']
    excluded = student.copy(); excluded[1] = 'TEST0002'; excluded[9] = ''
    invalid = student.copy(); invalid[18] = '0'
    def sheet(rows):
        root = ET.Element('worksheet', xmlns=ns); data = ET.SubElement(root, 'sheetData')
        for index, values in rows:
            row = ET.SubElement(data, 'row', r=str(index))
            for i, value in enumerate(values):
                cell = ET.SubElement(row, 'c', r=f'{chr(65+i)}{index}', t='inlineStr')
                ET.SubElement(ET.SubElement(cell, 'is'), 't').text = value
        return ET.tostring(root)
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ALUMNOS" r:id="rId1"/><sheet name="DOCENTES" r:id="rId2"/></sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>')
        archive.writestr('xl/worksheets/sheet1.xml', sheet([(4, header), (5, student), (6, student), (7, excluded), (8, invalid)]))
        archive.writestr('xl/worksheets/sheet2.xml', sheet([(3, ['', 'APELLIDO PATERNO', 'APELLIDO MATERNO', 'NOMBRES', 'EMAIL', 'DEPARTAMENTO ACADEMICO']),
            (4, ['', 'Ficticio', 'Prueba', 'Docente', 'docente@prueba.invalid', 'ECONOMIA']),
            (5, ['', 'Ficticio', 'Prueba', 'Sin correo', '', 'ECONOMIA'])]))


class ImportadorTests(unittest.TestCase):
    def test_importa_ambas_hojas_filtra_identidad_y_conserva_todos_los_datos(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'sintetico.xlsx'; workbook(path); data = prepare(path)
        self.assertEqual(len(data['estudiantes']), 1)
        self.assertEqual(len(data['docentes']), 1)
        student = data['estudiantes'][0]
        self.assertEqual(student['telefono'], '012345678')
        self.assertEqual(student['promedioPonderado'], 0)
        self.assertEqual(student['creditosAprobados'], 0)
        self.assertIsNone(student['ciclo'])
        self.assertEqual(student['apellidoPaterno'], 'Ficticio')
        self.assertEqual(len(data['matriculas'][0]['cursos'][0]['horariosOriginales']), 3)
        self.assertEqual(len(data['horarios']), 1)
        self.assertEqual(data['horarios'][0]['dia'], 6)
        self.assertEqual(data['horarios'][0]['origen']['filas'], [5, 6])
        self.assertEqual(data['resumen']['horariosSinNormalizar'], 1)
        self.assertEqual(data['resumen']['alumnosExcluidos'], 1)
        self.assertEqual(data['resumen']['filasDocentesExcluidas'], 1)

    def test_interpreta_mediodia_y_tarde_sin_inventar_duracion_cero(self):
        self.assertEqual(hours('09-01 pm.', 4), ('09:00', '13:00'))
        self.assertEqual(hours('07-09 pm.', 2), ('19:00', '21:00'))
        self.assertEqual(hours('10-12 pm.', 2), ('10:00', '12:00'))
        self.assertIsNone(hours('09-01 pm.', 0))
        self.assertIsNone(hours('09-01 pm.', 2))

    def test_valores_del_excel_son_literales_no_sql(self):
        self.assertEqual(sql_json("O'Brien"), "'\"O''Brien\"'::jsonb")


if __name__ == '__main__':
    unittest.main()
