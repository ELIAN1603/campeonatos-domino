"""Crea un .xlsx pequeño con la hoja WEB exactamente como dice el contrato (docs/W2_contrato_datos.md),
a partir de un actual.json de prueba. Solo sirve para probar publicar.html: el .xlsx no se sube al repo.
Uso: python3 hacer_xlsx.py datos/_prueba/sp-ejemplo/actual.json salida.xlsx"""
import json, sys
from openpyxl import Workbook

META = ['id', 'nombre', 'organizador', 'tipo', 'temporada', 'fecha', 'lugar', 'n_jornadas', 'tantos_meta', 'puntos_ausencia', 'n_participantes', 'hay_b',
        'jornada_b', 'n_b', 'estado', 'jornada', 'jornada_completa', 'mesas_pendientes', 'sorteo', 'sin_sortear', 'emparejamiento', 'plazo_desde', 'plazo_hasta',
        'errores', 'avisos', 'contacto', 'normativa_url', 'criterio1', 'criterio2', 'criterio3', 'criterio4', 'criterio5']
PART = ['id', 'j1_nombre', 'j1_apellido1', 'j2_nombre', 'j2_apellido1', 'corto', 'zona', 'grupo', 'ret', 'ret_desde']
CLAS = ['grupo', 'puesto', 'id', 'jug', 'gan', 'pg', 'pp', 'dp', 'tf', 'tc', 'dt', 'pendiente', 'desempate']
EMP = ['grupo', 'mesa', 'mesa_grupo', 'izq1', 'izq2', 'dcha1', 'dcha2', 'estado', 'ausentes', 'p_izq', 'p_dcha', 't_izq', 't_dcha']
SUST = ['id', 'desde', 'sale_nombre', 'sale_apellido1', 'entra_nombre', 'entra_apellido1']
BLOQUES = [('PARTICIPANTES', 4, PART), ('CLASIFICACION', 15, CLAS), ('EMPAREJAMIENTOS', 29, EMP), ('SUSTITUCIONES', 43, SUST)]  # columna 1-based

def num(b):
    return None if b is None else (1 if b is True else 0 if b is False else b)

j = json.load(open(sys.argv[1], encoding='utf-8'))
t, jo = j['torneo'], j['jornada']
wb = Workbook()
ws = wb.active
ws.title = 'WEB'
ws['A1'] = j['version']
ws['B1'] = 'WEB · datos para la página de publicación. No se edita.'
ws['H1'] = '◄ INICIO'
ws['A2'] = 'META'; ws['A3'] = 'clave'; ws['B3'] = 'valor'
crit = (t['criterios'] + [None] * 5)[:5]
valores = {**t, **{'jornada': jo['numero'], 'jornada_completa': jo['completa'], 'mesas_pendientes': jo['mesas_pendientes'], 'sorteo': jo['sorteo'],
                   'sin_sortear': jo['sin_sortear'], 'emparejamiento': jo['emparejamiento'], 'plazo_desde': jo['plazo_desde'], 'plazo_hasta': jo['plazo_hasta'],
                   'errores': 0, 'avisos': 0}}
for i, c in enumerate(crit, 1):
    valores[f'criterio{i}'] = c
for i, k in enumerate(META):
    ws.cell(row=4 + i, column=1, value=k)
    ws.cell(row=4 + i, column=2, value=num(valores.get(k)))
for titulo, col, cab in BLOQUES:
    ws.cell(row=2, column=col, value=titulo)
    for i, k in enumerate(cab):
        ws.cell(row=3, column=col + i, value=k)
for p in j['participantes']:
    fila = 3 + p['id']                      # la fila es 3 + id (hay huecos)
    for i, k in enumerate(PART):
        ws.cell(row=fila, column=4 + i, value=num(p.get(k)))
for r, f in enumerate(j['clasificacion'], 4):
    for i, k in enumerate(CLAS):
        ws.cell(row=r, column=15 + i, value=num(f.get(k)))
for r, m in enumerate(j['emparejamientos'], 4):
    d = {**m, 'izq1': (m['izq'] + [None, None])[0], 'izq2': (m['izq'] + [None, None])[1], 'dcha1': (m['dcha'] + [None, None])[0], 'dcha2': (m['dcha'] + [None, None])[1],
         'ausentes': ','.join(map(str, m['ausentes'])) or None}
    for i, k in enumerate(EMP):
        ws.cell(row=r, column=29 + i, value=num(d.get(k)))
for r, s in enumerate(j['sustituciones'], 4):
    for i, k in enumerate(SUST):
        ws.cell(row=r, column=43 + i, value=s.get(k))
# Otras hojas con datos personales inventados: publicar.html no debe leerlas nunca
lic = wb.create_sheet('LICENCIAS')
lic.append(['licencia', 'nombre', 'apellido2', 'telefono'])
lic.append(['LIC-' + '0098' + '765', 'Nuria', 'Soriano', '6' + '12' + '345' + '678'])  # valores inventados, armados a trozos
lic.append(['LIC-' + '0012' + '345', 'Pau', 'Marín', '6' + '98 11' + ' 22 33'])
wb.move_sheet('WEB', offset=1)  # WEB no es la primera hoja
wb.save(sys.argv[2])
