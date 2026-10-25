# Sistema de generación y validador léxico de credenciales seguras

Proyecto final de Autómatas y Lenguajes Formales (UMG).

## Caracteristicas

- Parser propio de expresiones regulares a AST.
- Construcción propia Thompson (AFND con transiciones epsilon).
- Construcción propia por subconjuntos (AFD).
- Validación léxico-formal de correo y contraseña (sin `RegExp` para validar/generar).
- Reporte de errores por regla: E1-E6 (correo), R1-R11 (contraseña).
- Generación guiada por AFD (solo caminos que alcanzan aceptación).
- Nivel de seguridad: baja, media, fuerte.
- Vista de autómatas: tablas AFND/AFD y diagrama SVG del AFD.
- Casos de prueba en interfaz y tests Node sin librerías.

## Estructura

- `index.html`
- `styles.css`
- `src/parser.js`
- `src/thompson.js`
- `src/dfa.js`
- `src/validator.js`
- `src/generator.js`
- `src/strength.js`
- `src/app.js`
- `tests/run-tests.mjs`

## Ejecucion web

Opción 1 (doble clic):
- Abrir `index.html` en el navegador.

Opción 2 (servidor local simple):
- Con Node: `npx serve .` o `python3 -m http.server 8000`.
- Abrir `http://localhost:8000`.

## Ejecutar pruebas

Requisito: Node.js instalado.

```bash
node tests/run-tests.mjs
```

## Reglas implementadas

### Correo (E1-E6)

- E1: parte local sin punto al inicio, final ni consecutivo; caracteres permitidos.
- E2: exactamente una arroba.
- E3: etiquetas de dominio sin guion inicial/final y con alfanumerico/guion.
- E4: etiquetas de dominio separadas por punto, sin vacias.
- E5: TLD solo letras y longitud minima 2.
- E6: longitud maxima 320 y pertenencia al lenguaje regular definido.

### Contraseña (R1-R11)

- R1: longitud mínima 12.
- R2: longitud máxima 64.
- R3: alfabeto permitido.
- R4: al menos una mayúscula.
- R5: al menos una minúscula.
- R6: al menos un dígito.
- R7: al menos un símbolo permitido.
- R8: sin espacios.
- R9: cumplimiento de interseccion regular de factores.
- R10: sin 3 caracteres iguales consecutivos.
- R11: sin cadenas prohibidas.

## Nota tecnica

La intersección de factores de contraseña se implementa por producto cartesiano de AFDs.
La generación no usa filtrado aleatorio ciego: recorre transiciones del AFD que pueden alcanzar aceptación.
