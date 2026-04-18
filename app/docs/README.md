# 📚 Documentación Completa de HTML, Formularios, Tablas y Nomenclatura

> Documentación técnica extensa y detallada sobre fundamentos de HTML, etiquetas de formularios, tablas y convenciones de nombrado de archivos y carpetas.

---

## 📋 Tabla de Contenidos

1. [HTML — Fundamentos y Semántica](#1-html--fundamentos-y-semántica)
   - [¿Qué es HTML?](#11-qué-es-html)
   - [Semántica en HTML](#12-semántica-en-html)
   - [Estructura de una Etiqueta](#13-estructura-de-una-etiqueta)
   - [Etiquetas de Apertura y Cierre](#14-etiquetas-de-apertura-y-cierre)
   - [Atributos](#15-atributos)
   - [Etiquetas Semánticas Principales](#16-etiquetas-semánticas-principales)
2. [Etiquetas de Formularios](#2-etiquetas-de-formularios)
   - [¿Qué es un Formulario?](#21-qué-es-un-formulario)
   - [Etiqueta `<form>`](#22-etiqueta-form)
   - [Etiqueta `<input>` y sus tipos](#23-etiqueta-input-y-sus-tipos)
   - [Etiqueta `<label>`](#24-etiqueta-label)
   - [Etiqueta `<textarea>`](#25-etiqueta-textarea)
   - [Etiqueta `<select>` y `<option>`](#26-etiqueta-select-y-option)
   - [Etiqueta `<optgroup>`](#27-etiqueta-optgroup)
   - [Etiqueta `<button>`](#28-etiqueta-button)
   - [Etiqueta `<fieldset>` y `<legend>`](#29-etiqueta-fieldset-y-legend)
   - [Etiqueta `<datalist>`](#210-etiqueta-datalist)
   - [Etiqueta `<output>`](#211-etiqueta-output)
   - [Etiqueta `<progress>`](#212-etiqueta-progress)
   - [Etiqueta `<meter>`](#213-etiqueta-meter)
3. [Etiquetas de Tablas](#3-etiquetas-de-tablas)
   - [¿Qué es una Tabla en HTML?](#31-qué-es-una-tabla-en-html)
   - [Etiqueta `<table>`](#32-etiqueta-table)
   - [Etiqueta `<thead>`](#33-etiqueta-thead)
   - [Etiqueta `<tbody>`](#34-etiqueta-tbody)
   - [Etiqueta `<tfoot>`](#35-etiqueta-tfoot)
   - [Etiqueta `<tr>`](#36-etiqueta-tr)
   - [Etiqueta `<th>`](#37-etiqueta-th)
   - [Etiqueta `<td>`](#38-etiqueta-td)
   - [Etiqueta `<caption>`](#39-etiqueta-caption)
   - [Etiqueta `<colgroup>` y `<col>`](#310-etiqueta-colgroup-y-col)
   - [Estructura Completa de una Tabla](#311-estructura-completa-de-una-tabla)
4. [Nomenclatura de Carpetas y Archivos](#4-nomenclatura-de-carpetas-y-archivos)
   - [¿Por qué importa la nomenclatura?](#41-por-qué-importa-la-nomenclatura)
   - [kebab-case](#42-kebab-case)
   - [snake_case](#43-snake_case)
   - [PascalCase](#44-pascalcase)
   - [camelCase](#45-camelcase)
   - [Tabla Comparativa](#46-tabla-comparativa)

---

## 1. HTML — Fundamentos y Semántica

### 1.1 ¿Qué es HTML?

**HTML** (HyperText Markup Language — Lenguaje de Marcado de Hipertexto) es el lenguaje estándar utilizado para crear y estructurar el contenido de las páginas web. No es un lenguaje de programación en el sentido clásico, ya que no tiene lógica condicional, bucles o funciones propias; es un **lenguaje de marcado**, lo que significa que usa etiquetas (marcas) para describir y organizar el contenido que se debe mostrar en el navegador.

HTML fue creado por Tim Berners-Lee alrededor de 1991 y ha evolucionado significativamente desde entonces. La versión actual y más utilizada es **HTML5**, introducida oficialmente en 2014, que trajo consigo una enorme cantidad de nuevas etiquetas semánticas, APIs, soporte para multimedia y mejoras de accesibilidad.

La función principal de HTML es describir la **estructura** y el **significado** del contenido. No se encarga de la apariencia visual (eso es tarea de CSS) ni de la interactividad (eso es tarea de JavaScript). La combinación de estos tres lenguajes — HTML, CSS y JavaScript — forma la base del desarrollo web frontend.

Cuando un navegador como Chrome, Firefox o Safari recibe un archivo HTML, lo interpreta y renderiza el contenido visualmente. Este proceso se llama **parsing** (análisis sintáctico).

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mi Primera Página Web</title>
  </head>
  <body>
    <h1>Hola, mundo</h1>
    <p>Este es mi primer documento HTML.</p>
  </body>
</html>
```

**Componentes clave de un documento HTML básico:**

- `<!DOCTYPE html>` — Declaración que le indica al navegador que el documento usa HTML5.
- `<html lang="es">` — Elemento raíz que envuelve todo el documento. El atributo `lang` indica el idioma del contenido.
- `<head>` — Sección que contiene metadatos del documento: título, codificación de caracteres, referencias a CSS y scripts externos, entre otros. El contenido de `<head>` no se muestra directamente al usuario.
- `<body>` — Sección que contiene todo el contenido visible de la página: texto, imágenes, videos, formularios, etc.

---

### 1.2 Semántica en HTML

La **semántica** en HTML se refiere al significado intrínseco que cada etiqueta le aporta al contenido que envuelve. Usar HTML semántico significa elegir la etiqueta correcta según la naturaleza del contenido, en lugar de usar etiquetas genéricas para todo.

Antes de HTML5, era muy común construir páginas enteras usando únicamente etiquetas `<div>` y `<span>`, etiquetas que no tienen ningún significado semántico por sí mismas. Con HTML5, se introdujeron etiquetas con significado propio, como `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>` y `<footer>`.

**¿Por qué usar HTML semántico?**

1. **Accesibilidad:** Los lectores de pantalla y otras tecnologías de asistencia utilizan la estructura semántica del HTML para navegar el contenido y ofrecerlo de forma comprensible a personas con discapacidades visuales. Un `<nav>` le dice al lector de pantalla que hay un área de navegación; un `<main>` indica el contenido principal.

2. **SEO (Optimización para motores de búsqueda):** Los motores de búsqueda como Google analizan el HTML para entender de qué trata una página. Un `<h1>` semántico dentro de un `<article>` transmite más información relevante que un `<div class="titulo">`.

3. **Mantenibilidad del código:** El código semántico es más fácil de leer, entender y mantener. Cuando otro desarrollador (o tú mismo en el futuro) lee el código, puede comprender rápidamente la estructura de la página sin necesidad de analizar en detalle las clases CSS.

4. **Estandarización:** El uso de etiquetas semánticas promueve buenas prácticas y compatibilidad con estándares internacionales definidos por el W3C (World Wide Web Consortium).

**Ejemplo de código NO semántico vs semántico:**

```html
<!-- ❌ No semántico -->
<div id="header">
  <div id="logo">Mi Sitio</div>
  <div id="nav">
    <div class="nav-item">Inicio</div>
    <div class="nav-item">Contacto</div>
  </div>
</div>
<div id="main">
  <div class="post">
    <div class="post-title">Título del artículo</div>
    <div class="post-body">Contenido aquí...</div>
  </div>
</div>
<div id="footer">© 2024</div>

<!-- ✅ Semántico -->
<header>
  <h1>Mi Sitio</h1>
  <nav>
    <ul>
      <li><a href="/">Inicio</a></li>
      <li><a href="/contacto">Contacto</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>
    <h2>Título del artículo</h2>
    <p>Contenido aquí...</p>
  </article>
</main>
<footer>
  <p>© 2024</p>
</footer>
```

---

### 1.3 Estructura de una Etiqueta

Una **etiqueta HTML** (también llamada elemento o tag) es la unidad fundamental del lenguaje. Está compuesta por:

```
<nombre-etiqueta atributo="valor">Contenido</nombre-etiqueta>
```

Desglose de cada parte:

| Parte | Descripción |
|---|---|
| `<` | Carácter de apertura del delimitador de etiqueta |
| `nombre-etiqueta` | Nombre del elemento (por ejemplo: `p`, `div`, `h1`, `a`, `img`) |
| `atributo="valor"` | Información adicional asociada al elemento (opcional) |
| `>` | Carácter de cierre del delimitador de etiqueta |
| `Contenido` | El texto, otros elementos o datos que la etiqueta envuelve |
| `</nombre-etiqueta>` | Etiqueta de cierre del elemento |

**Ejemplo detallado:**

```html
<a href="https://www.ejemplo.com" target="_blank" rel="noopener noreferrer">
  Visita nuestro sitio
</a>
```

En este ejemplo:
- `a` es el nombre de la etiqueta (ancla/enlace)
- `href`, `target` y `rel` son atributos
- `"https://www.ejemplo.com"`, `"_blank"` y `"noopener noreferrer"` son los valores de dichos atributos
- `"Visita nuestro sitio"` es el contenido visible del enlace

---

### 1.4 Etiquetas de Apertura y Cierre

En HTML existen dos categorías de etiquetas según su estructura:

#### Etiquetas con apertura y cierre

La gran mayoría de las etiquetas HTML tienen dos partes: la **etiqueta de apertura** y la **etiqueta de cierre**. Entre ambas va el contenido del elemento.

```html
<p>Este es un párrafo de texto.</p>
<h1>Este es un título principal.</h1>
<div>
  <span>Texto dentro de un div y un span.</span>
</div>
```

La etiqueta de cierre es idéntica a la de apertura, pero lleva una barra diagonal (`/`) antes del nombre del elemento: `</p>`, `</h1>`, `</div>`.

**Es obligatorio cerrar correctamente las etiquetas.** El anidamiento incorrecto puede causar comportamientos inesperados en el renderizado del navegador:

```html
<!-- ❌ Incorrecto: etiquetas mal anidadas -->
<p><strong>Texto en negrita</p></strong>

<!-- ✅ Correcto: etiquetas correctamente anidadas -->
<p><strong>Texto en negrita</strong></p>
```

#### Etiquetas vacías (void elements o self-closing)

Algunas etiquetas no tienen contenido propio y por lo tanto **no necesitan etiqueta de cierre**. Estas se denominan etiquetas vacías o elementos vacíos. En HTML5 no es necesario agregar la barra al final (`/>`), aunque en XHTML sí es requerido.

```html
<!-- Etiquetas vacías más comunes -->
<br>           <!-- Salto de línea -->
<hr>           <!-- Línea horizontal -->
<img src="foto.jpg" alt="Descripción">   <!-- Imagen -->
<input type="text">                       <!-- Campo de entrada -->
<meta charset="UTF-8">                   <!-- Metadatos -->
<link rel="stylesheet" href="styles.css"> <!-- Vínculo a recursos externos -->
```

Lista completa de elementos vacíos en HTML5:

| Etiqueta | Descripción |
|---|---|
| `<area>` | Área en un mapa de imagen |
| `<base>` | URL base del documento |
| `<br>` | Salto de línea |
| `<col>` | Columna en una tabla |
| `<embed>` | Contenido externo embebido |
| `<hr>` | Separación temática (línea horizontal) |
| `<img>` | Imagen |
| `<input>` | Campo de formulario |
| `<link>` | Vínculo a recursos externos |
| `<meta>` | Metadatos |
| `<param>` | Parámetro para un elemento `<object>` |
| `<source>` | Fuente de media |
| `<track>` | Pista de texto para media |
| `<wbr>` | Oportunidad de salto de línea |

---

### 1.5 Atributos

Los **atributos** son pares clave-valor que se añaden a la etiqueta de apertura de un elemento para proporcionar información adicional o modificar su comportamiento. Un elemento puede tener cero, uno o múltiples atributos, siempre separados por espacios.

**Sintaxis general:**

```html
<etiqueta atributo1="valor1" atributo2="valor2">Contenido</etiqueta>
```

**Reglas importantes sobre atributos:**

- Los atributos siempre se escriben en la **etiqueta de apertura**, nunca en la de cierre.
- El valor del atributo generalmente va entre comillas dobles (`"`) aunque las comillas simples (`'`) también son válidas.
- Algunos atributos son **booleanos**, es decir, su sola presencia activa su efecto y no necesitan un valor explícito: `disabled`, `checked`, `required`, `readonly`, `multiple`, `selected`, `hidden`, `autofocus`.
- Los nombres de atributos son **insensibles a mayúsculas** en HTML5, aunque por convención se escriben en minúsculas.

```html
<!-- Atributos con valor -->
<input type="email" placeholder="tu@correo.com" maxlength="100">

<!-- Atributos booleanos (su presencia activa el comportamiento) -->
<input type="checkbox" checked>
<input type="text" disabled>
<input type="email" required>
```

#### Atributos Globales

Los atributos globales son aquellos que pueden utilizarse en **cualquier elemento HTML**, independientemente del tipo de etiqueta:

| Atributo | Descripción |
|---|---|
| `id` | Identificador único del elemento en el documento. No debe repetirse. Usado para CSS y JavaScript. |
| `class` | Una o más clases CSS separadas por espacios. Puede repetirse en múltiples elementos. |
| `style` | Estilos CSS en línea aplicados directamente al elemento. |
| `title` | Texto informativo que aparece como tooltip al pasar el cursor por encima. |
| `lang` | Idioma del contenido del elemento (ej: `"es"`, `"en"`, `"fr"`). |
| `dir` | Dirección del texto: `ltr` (izquierda a derecha) o `rtl` (derecha a izquierda). |
| `hidden` | Oculta el elemento visualmente y del árbol de accesibilidad. |
| `tabindex` | Controla el orden de tabulación con el teclado. |
| `data-*` | Atributos de datos personalizados para almacenar información extra. Ej: `data-id="42"`. |
| `contenteditable` | Permite al usuario editar el contenido directamente en el navegador. |
| `draggable` | Indica si el elemento puede ser arrastrado. |
| `role` | Define el rol del elemento para tecnologías de asistencia (ARIA). |
| `aria-*` | Atributos de Accessible Rich Internet Applications para accesibilidad. |

---

### 1.6 Etiquetas Semánticas Principales

#### Estructura del documento

| Etiqueta | Definición | Dónde se usa | Por qué usarla |
|---|---|---|---|
| `<header>` | Representa el encabezado introductorio de una página o sección. Puede contener el logotipo, título principal, navegación, buscador. | Al inicio del `<body>` o dentro de `<article>`, `<section>` | Indica claramente al navegador y a los lectores de pantalla dónde está el encabezado. Mejora la estructura del documento. |
| `<nav>` | Define un bloque de enlaces de navegación principal, como menús, índices, breadcrumbs. | Dentro de `<header>` o en otros lugares del cuerpo | Permite a lectores de pantalla saltar rápidamente a la navegación. Ayuda al SEO a identificar los enlaces principales. |
| `<main>` | Contiene el contenido principal y único de la página. Solo debe haber uno por documento. | Dentro de `<body>`, generalmente entre `<header>` y `<footer>` | Define inequívocamente el contenido central de la página. Permite a tecnologías asistivas saltar directamente al contenido principal. |
| `<footer>` | Representa el pie de página de la sección o del documento. Contiene información de copyright, contacto, enlaces legales. | Al final del `<body>` o dentro de `<article>`, `<section>` | Estructura el cierre del documento de manera significativa. |
| `<aside>` | Contenido relacionado tangencialmente con el contenido principal, como sidebars, anuncios, notas al pie, citas destacadas. | Junto al `<main>` o dentro de `<article>` | Diferencia claramente el contenido complementario del principal. |
| `<section>` | Agrupa contenido temáticamente relacionado que formaría parte de un documento más amplio. Generalmente tiene un encabezado propio. | Dentro de `<main>` o `<article>` | Divide el contenido en bloques lógicos y temáticos, mejorando la estructura del documento. |
| `<article>` | Contenido independiente y autocontenido que podría redistribuirse o reutilizarse por sí solo, como una publicación de blog, noticia, comentario. | Dentro de `<main>` o `<section>` | Indica que el contenido es completo por sí mismo. Muy útil para RSS, scrapers y SEO. |

#### Etiquetas de contenido

| Etiqueta | Definición | Por qué usarla |
|---|---|---|
| `<h1>` a `<h6>` | Encabezados de seis niveles de importancia jerárquica. `<h1>` es el más importante, `<h6>` el menos. | Crear jerarquía textual clara. Fundamental para SEO. `<h1>` debe usarse una vez por página. |
| `<p>` | Define un párrafo de texto. El navegador añade margen superior e inferior automáticamente. | Estructurar bloques de texto corrido. |
| `<ul>` | Lista desordenada (con viñetas). Los ítems no tienen un orden particular. | Listas donde el orden no importa: ingredientes, características, opciones. |
| `<ol>` | Lista ordenada (numerada). Los ítems tienen una secuencia definida. | Pasos de un proceso, rankings, instrucciones. |
| `<li>` | Ítem de lista. Debe ser hijo directo de `<ul>` u `<ol>`. | Cada elemento individual dentro de una lista. |
| `<dl>` | Lista de definición. Contiene pares de término y descripción. | Glosarios, diccionarios, metadatos. |
| `<dt>` | Término en una lista de definición. | Definir el término en un glosario. |
| `<dd>` | Descripción de un término en una lista de definición. | Describir el término en un glosario. |
| `<a>` | Ancla o enlace. Permite crear hipervínculos a otras páginas, recursos o secciones del mismo documento. | Cualquier texto o imagen que debe ser un enlace. |
| `<img>` | Inserta una imagen en el documento. Requiere `src` (ruta) y `alt` (descripción alternativa). | Mostrar imágenes. El `alt` es obligatorio para accesibilidad. |
| `<strong>` | Indica importancia semántica fuerte. Visualmente se muestra en negrita, pero su significado va más allá del estilo. | Resaltar texto de alta importancia semántica (advertencias, términos clave). |
| `<em>` | Énfasis en el texto. Visualmente se muestra en cursiva. | Indicar énfasis en la pronunciación o en el significado de una palabra. |
| `<blockquote>` | Cita larga extraída de otra fuente. | Citar párrafos completos de otros textos. |
| `<q>` | Cita corta en línea. | Citas breves dentro de un párrafo. |
| `<cite>` | Referencia al título de una obra creativa. | Títulos de libros, películas, canciones, artículos. |
| `<code>` | Representa un fragmento de código de computadora. | Mostrar código inline en la documentación. |
| `<pre>` | Texto preformateado que preserva espacios y saltos de línea. | Bloques de código, poesía con formato específico. |
| `<figure>` | Contenido independiente que puede moverse del flujo principal, como imágenes, gráficos, tablas con sus leyendas. | Agrupar imágenes con su leyenda. |
| `<figcaption>` | Leyenda o descripción de un `<figure>`. | Describir el contenido de una figura. |
| `<time>` | Representa una fecha, hora o duración. | Fechas de publicación, eventos, duraciones. Mejora SEO y accesibilidad. |
| `<mark>` | Texto marcado o resaltado por su relevancia en el contexto actual. | Resultados de búsqueda, texto resaltado por el usuario. |
| `<abbr>` | Abreviación o acrónimo, con una expansión opcional en el atributo `title`. | Definir abreviaturas la primera vez que aparecen. |
| `<address>` | Información de contacto del autor o propietario del documento o sección. | Datos de contacto en `<footer>`. |
| `<div>` | Contenedor de bloque genérico sin significado semántico. | Agrupar elementos para aplicar estilos CSS o manipular con JavaScript cuando ninguna otra etiqueta semántica aplica. |
| `<span>` | Contenedor en línea genérico sin significado semántico. | Aplicar estilos o scripts a una porción de texto cuando no existe etiqueta semántica apropiada. |

---

## 2. Etiquetas de Formularios

### 2.1 ¿Qué es un Formulario?

Un **formulario HTML** es un componente de la interfaz de usuario que permite recopilar datos del usuario para enviarlos a un servidor o procesarlos en el cliente. Los formularios son el mecanismo fundamental de interacción entre el usuario y las aplicaciones web: se usan en registros de usuario, inicio de sesión, compras en línea, encuestas, comentarios, buscadores y cualquier otra situación donde se necesite capturar información.

Los formularios funcionan siguiendo este flujo general:

1. El usuario rellena los campos del formulario.
2. El usuario presiona el botón de envío (o se dispara algún evento).
3. El navegador recoge todos los datos del formulario.
4. Los datos se envían al servidor mediante una petición HTTP (GET o POST), o se procesan en el cliente con JavaScript.
5. El servidor recibe y procesa los datos, y responde al navegador.

---

### 2.2 Etiqueta `<form>`

La etiqueta `<form>` es el contenedor principal que envuelve todos los controles de un formulario. Define el comportamiento general del formulario, incluyendo a dónde se envían los datos y qué método HTTP se utiliza.

**Sintaxis:**

```html
<form action="/procesar" method="POST" enctype="multipart/form-data">
  <!-- Controles del formulario -->
</form>
```

**Atributos principales de `<form>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `action` | URL | Especifica la URL del servidor que recibirá y procesará los datos del formulario. Si se omite, los datos se envían a la URL actual de la página. |
| `method` | `get`, `post` | Define el método HTTP para enviar los datos. `GET` añade los datos a la URL como query string (visible, limitado a ~2000 caracteres). `POST` envía los datos en el cuerpo de la petición (invisible en URL, sin límite de tamaño práctico). |
| `enctype` | `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` | Especifica cómo se codifican los datos al enviarlos. `multipart/form-data` es **obligatorio** cuando el formulario incluye subida de archivos (`<input type="file">`). Por defecto usa `application/x-www-form-urlencoded`. |
| `target` | `_self`, `_blank`, `_parent`, `_top` | Define en qué ventana/pestaña se muestra la respuesta del servidor. `_blank` abre en nueva pestaña. |
| `autocomplete` | `on`, `off` | Controla si el navegador puede autocompletar los campos del formulario con datos guardados anteriormente. |
| `novalidate` | booleano | Cuando está presente, deshabilita la validación nativa del navegador antes del envío. |
| `name` | texto | Nombre del formulario. Permite referenciarlo desde JavaScript mediante `document.forms["nombre"]`. |

---

### 2.3 Etiqueta `<input>` y sus tipos

La etiqueta `<input>` es el control de formulario más versátil y usado. Es un **elemento vacío** (no tiene etiqueta de cierre) que cambia completamente de comportamiento según el valor del atributo `type`.

#### Propiedades y atributos comunes a todos los tipos de `<input>`

| Atributo | Tipo de valor | Descripción |
|---|---|---|
| `type` | ver tipos abajo | Define el tipo de control. Si se omite, por defecto es `text`. |
| `name` | texto | Nombre del campo. Es el identificador que se envía al servidor junto al valor. **Obligatorio** para que el campo se incluya en el envío. |
| `id` | texto | Identificador único del elemento. Permite asociarlo con un `<label>` mediante el atributo `for`. |
| `value` | texto | Valor inicial o por defecto del campo. Para checkboxes y radios, es el valor que se envía cuando están seleccionados. |
| `placeholder` | texto | Texto de ayuda que aparece dentro del campo cuando está vacío. Desaparece al escribir. |
| `required` | booleano | Hace que el campo sea obligatorio. El formulario no se envía si está vacío. |
| `disabled` | booleano | Deshabilita el campo. No puede ser modificado ni se envía al servidor. |
| `readonly` | booleano | El campo es de solo lectura. El usuario puede ver el valor pero no modificarlo. Sí se envía al servidor. |
| `autofocus` | booleano | El campo recibe el foco automáticamente cuando la página carga. Solo debe usarse en un campo por página. |
| `autocomplete` | `on`, `off`, nombres estándar | Controla el autocompletado del navegador para ese campo específico. |
| `tabindex` | número | Controla el orden en que el campo recibe foco al presionar Tab. |
| `form` | id de `<form>` | Asocia el campo a un formulario específico aunque esté fuera de él en el HTML. |
| `aria-label` | texto | Etiqueta accesible para lectores de pantalla cuando no se usa `<label>`. |
| `aria-describedby` | id | Asocia el campo con un elemento que lo describe (por ejemplo, un mensaje de error). |

---

#### Tipos de `<input>`

##### `type="text"`

El tipo más básico. Crea un campo de texto de una sola línea para entrada de texto libre.

```html
<input 
  type="text"
  name="nombre"
  id="nombre"
  placeholder="Escribe tu nombre completo"
  minlength="2"
  maxlength="100"
  pattern="[A-Za-záéíóúÁÉÍÓÚñÑ\s]+"
  autocomplete="name"
  required
>
```

**Atributos específicos:**

| Atributo | Descripción |
|---|---|
| `minlength` | Número mínimo de caracteres requeridos. |
| `maxlength` | Número máximo de caracteres permitidos. |
| `pattern` | Expresión regular que el valor debe cumplir para ser válido. |
| `size` | Anchura visual del campo en número de caracteres (no limita el contenido). |
| `spellcheck` | `true`/`false`. Activa o desactiva la revisión ortográfica del navegador. |

---

##### `type="email"`

Campo especializado para capturar direcciones de correo electrónico. El navegador valida automáticamente que el valor tenga el formato de un email (`algo@dominio.ext`).

```html
<input 
  type="email"
  name="correo"
  id="correo"
  placeholder="usuario@ejemplo.com"
  multiple
  autocomplete="email"
  required
>
```

**Atributos específicos:**

| Atributo | Descripción |
|---|---|
| `multiple` | Permite ingresar múltiples emails separados por comas. |
| `maxlength` | Longitud máxima permitida. |
| `pattern` | Patrón de expresión regular adicional para validar el formato. |

---

##### `type="password"`

Campo para contraseñas. Los caracteres introducidos se ocultan visualmente con puntos o asteriscos para proteger la privacidad.

```html
<input 
  type="password"
  name="contrasena"
  id="contrasena"
  minlength="8"
  maxlength="128"
  autocomplete="new-password"
  required
>
```

**Nota importante:** `autocomplete="new-password"` le indica al gestor de contraseñas del navegador que genere y guarde una contraseña nueva. `autocomplete="current-password"` es para el campo de login.

---

##### `type="number"`

Campo para entrada de valores numéricos. En dispositivos móviles muestra el teclado numérico. Permite definir un rango válido y el intervalo de incremento.

```html
<input 
  type="number"
  name="edad"
  id="edad"
  min="0"
  max="120"
  step="1"
  value="25"
  placeholder="Tu edad"
>
```

**Atributos específicos:**

| Atributo | Descripción |
|---|---|
| `min` | Valor mínimo permitido. |
| `max` | Valor máximo permitido. |
| `step` | Intervalo de incremento/decremento. Por defecto `1`. Puede ser decimal, ej: `0.5`. |

---

##### `type="tel"`

Campo para números de teléfono. No valida el formato automáticamente (los formatos varían por país), pero en móviles muestra el teclado telefónico.

```html
<input 
  type="tel"
  name="telefono"
  id="telefono"
  placeholder="+57 300 123 4567"
  pattern="[\+]?[0-9\s\-\(\)]{7,20}"
  autocomplete="tel"
>
```

---

##### `type="url"`

Campo para URLs. Valida que el valor tenga el formato de una URL válida (debe comenzar con `http://` o `https://`).

```html
<input 
  type="url"
  name="sitio-web"
  id="sitio-web"
  placeholder="https://www.ejemplo.com"
  pattern="https://.*"
  autocomplete="url"
>
```

---

##### `type="search"`

Campo de búsqueda. Funcionalmente similar a `text`, pero el navegador puede aplicarle estilos o comportamientos especiales (como un botón para limpiar el campo). En algunos casos muestra sugerencias de búsquedas anteriores.

```html
<input 
  type="search"
  name="buscar"
  id="buscar"
  placeholder="Buscar productos..."
  autocomplete="off"
>
```

---

##### `type="date"`

Campo para seleccionar una fecha (año, mes y día). El navegador muestra un selector visual de fecha (datepicker nativo).

```html
<input 
  type="date"
  name="fecha-nacimiento"
  id="fecha-nacimiento"
  min="1900-01-01"
  max="2024-12-31"
  value="1995-06-15"
>
```

El formato del valor es siempre `YYYY-MM-DD` internamente, aunque el navegador puede mostrarlo en el formato local del usuario.

---

##### `type="time"`

Campo para seleccionar una hora (horas y minutos, opcionalmente segundos).

```html
<input 
  type="time"
  name="hora-cita"
  id="hora-cita"
  min="09:00"
  max="18:00"
  step="1800"
>
```

El atributo `step` en segundos define el intervalo. `1800` = cada 30 minutos.

---

##### `type="datetime-local"`

Campo para seleccionar una fecha y hora juntas, sin zona horaria.

```html
<input 
  type="datetime-local"
  name="evento"
  id="evento"
  min="2024-01-01T09:00"
  max="2024-12-31T18:00"
>
```

---

##### `type="month"`

Campo para seleccionar un mes y año específicos, sin especificar el día.

```html
<input type="month" name="mes-inicio" min="2024-01" max="2025-12">
```

---

##### `type="week"`

Campo para seleccionar una semana específica del año.

```html
<input type="week" name="semana-laboral" min="2024-W01" max="2024-W52">
```

---

##### `type="range"`

Muestra un control deslizante (slider) para seleccionar un valor dentro de un rango. El valor exacto seleccionado no se muestra al usuario a menos que se programe con JavaScript.

```html
<label for="volumen">Volumen: <output id="valor-volumen">50</output></label>
<input 
  type="range"
  name="volumen"
  id="volumen"
  min="0"
  max="100"
  step="5"
  value="50"
  oninput="document.getElementById('valor-volumen').value = this.value"
>
```

---

##### `type="color"`

Muestra un selector de color nativo del navegador. El valor es siempre un código de color hexadecimal de 6 dígitos (`#rrggbb`).

```html
<input 
  type="color"
  name="color-favorito"
  id="color-favorito"
  value="#3B82F6"
>
```

---

##### `type="file"`

Permite al usuario seleccionar uno o múltiples archivos para subir al servidor. Cuando se usa, el formulario debe tener `enctype="multipart/form-data"`.

```html
<input 
  type="file"
  name="documentos"
  id="documentos"
  accept=".pdf,.doc,.docx,image/*"
  multiple
>
```

**Atributos específicos:**

| Atributo | Descripción |
|---|---|
| `accept` | Lista de tipos de archivo permitidos. Puede ser extensiones (`.pdf`), tipos MIME (`image/png`) o categorías (`image/*`, `audio/*`, `video/*`). |
| `multiple` | Permite seleccionar múltiples archivos a la vez. |
| `capture` | En dispositivos móviles, especifica si abrir la cámara (`user` para cámara frontal, `environment` para cámara trasera). |

---

##### `type="checkbox"`

Casilla de verificación que puede estar marcada (checked) o desmarcada. Se usa cuando el usuario puede seleccionar cero o más opciones de un conjunto.

```html
<!-- Checkbox único -->
<input type="checkbox" name="acepto-terminos" id="terminos" value="si" required>
<label for="terminos">Acepto los términos y condiciones</label>

<!-- Grupo de checkboxes -->
<fieldset>
  <legend>Intereses:</legend>
  <input type="checkbox" name="intereses" id="tech" value="tecnologia">
  <label for="tech">Tecnología</label>
  
  <input type="checkbox" name="intereses" id="sport" value="deporte">
  <label for="sport">Deporte</label>
  
  <input type="checkbox" name="intereses" id="art" value="arte" checked>
  <label for="art">Arte</label>
</fieldset>
```

Cuando se usa el mismo `name` en varios checkboxes, todos los valores seleccionados se envían al servidor.

---

##### `type="radio"`

Botón de opción que pertenece a un grupo de opciones mutuamente excluyentes. Solo una opción del grupo puede estar seleccionada a la vez. Los botones del mismo grupo comparten el mismo `name`.

```html
<fieldset>
  <legend>Género:</legend>
  
  <input type="radio" name="genero" id="masc" value="masculino">
  <label for="masc">Masculino</label>
  
  <input type="radio" name="genero" id="fem" value="femenino">
  <label for="fem">Femenino</label>
  
  <input type="radio" name="genero" id="otro" value="otro" checked>
  <label for="otro">Prefiero no decirlo</label>
</fieldset>
```

---

##### `type="submit"`

Botón que, al ser presionado, envía los datos del formulario al servidor según el `action` y `method` del `<form>`.

```html
<input type="submit" value="Enviar formulario">
```

El atributo `value` define el texto visible del botón. Si se omite, el navegador muestra el texto por defecto ("Submit" o "Enviar" según el idioma).

---

##### `type="reset"`

Botón que, al ser presionado, restablece todos los campos del formulario a sus valores iniciales (definidos en el HTML). Se debe usar con precaución porque puede frustrar al usuario si borra accidentalmente datos ingresados.

```html
<input type="reset" value="Limpiar formulario">
```

---

##### `type="button"`

Botón genérico sin comportamiento por defecto. Se usa con JavaScript para ejecutar acciones personalizadas.

```html
<input type="button" value="Calcular total" onclick="calcularTotal()">
```

---

##### `type="image"`

Crea un botón de envío con una imagen. Al hacer clic, envía el formulario y también las coordenadas del clic dentro de la imagen.

```html
<input 
  type="image"
  src="boton-enviar.png"
  alt="Enviar formulario"
  width="120"
  height="40"
>
```

---

##### `type="hidden"`

Campo invisible para el usuario que almacena datos que deben enviarse junto con el formulario pero que no deben ser editados por el usuario (tokens CSRF, IDs de sesión, valores de seguimiento).

```html
<input type="hidden" name="csrf-token" value="abc123xyz789">
<input type="hidden" name="producto-id" value="4521">
```

---

### 2.4 Etiqueta `<label>`

La etiqueta `<label>` define una etiqueta o descripción para un control de formulario. Es un elemento **fundamental para la accesibilidad** porque asocia visualmente y programáticamente un texto descriptivo con su control correspondiente.

**Beneficios de usar `<label>`:**
- Cuando el usuario hace clic en el `<label>`, el control asociado recibe el foco automáticamente.
- Los lectores de pantalla anuncian el texto del `<label>` cuando el usuario llega al control con el teclado.
- Aumenta el área clicable del control (especialmente útil en checkboxes y radios en dispositivos móviles).

**Formas de asociar un `<label>` con su control:**

```html
<!-- Método 1: Usando el atributo "for" (explícito) -->
<!-- El valor de "for" debe coincidir exactamente con el "id" del control -->
<label for="nombre-usuario">Nombre de usuario:</label>
<input type="text" id="nombre-usuario" name="username">

<!-- Método 2: Envolviendo el control (implícito) -->
<label>
  Nombre de usuario:
  <input type="text" name="username">
</label>
```

El método explícito (con `for`) es preferido en la mayoría de los casos porque permite mayor flexibilidad en el layout y es más compatible con tecnologías asistivas.

**Atributos de `<label>`:**

| Atributo | Descripción |
|---|---|
| `for` | El `id` del control al que pertenece esta etiqueta. |
| `form` | El `id` del formulario al que pertenece, si está fuera de él. |

---

### 2.5 Etiqueta `<textarea>`

La etiqueta `<textarea>` crea un área de texto multilínea que permite al usuario ingresar texto largo como comentarios, descripciones, mensajes o cualquier contenido extenso.

A diferencia de `<input type="text">`, `<textarea>` tiene etiqueta de apertura y cierre, y el valor por defecto se coloca como contenido entre las etiquetas (no como atributo `value`).

```html
<label for="comentario">Comentario:</label>
<textarea 
  name="comentario"
  id="comentario"
  rows="6"
  cols="50"
  placeholder="Escribe tu comentario aquí (máximo 500 caracteres)..."
  minlength="10"
  maxlength="500"
  required
  spellcheck="true"
  wrap="soft"
>Texto inicial si es necesario</textarea>
```

**Atributos de `<textarea>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `rows` | número | Número de líneas visibles. Determina la altura inicial del área de texto. Por defecto `2`. |
| `cols` | número | Número de columnas visibles (anchura). Por defecto `20`. En la práctica se prefiere controlar el tamaño con CSS. |
| `maxlength` | número | Número máximo de caracteres permitidos. |
| `minlength` | número | Número mínimo de caracteres requeridos. |
| `placeholder` | texto | Texto de ayuda que aparece cuando el área está vacía. |
| `required` | booleano | Campo obligatorio. |
| `disabled` | booleano | Deshabilita el área de texto. |
| `readonly` | booleano | Solo lectura. |
| `autofocus` | booleano | Recibe el foco automáticamente al cargar la página. |
| `wrap` | `soft`, `hard` | Controla cómo se envuelve el texto al enviarlo. `soft`: no inserta saltos de línea reales; `hard`: inserta saltos de línea según `cols`. |
| `spellcheck` | `true`, `false` | Activa o desactiva la revisión ortográfica. |
| `resize` | (propiedad CSS) | En CSS: `resize: none/both/horizontal/vertical` para controlar si el usuario puede redimensionar el área. |

---

### 2.6 Etiqueta `<select>` y `<option>`

La etiqueta `<select>` crea una lista desplegable (dropdown) o un cuadro de lista (listbox) que permite al usuario elegir una o varias opciones de una lista predefinida. Cada opción se define con la etiqueta `<option>`.

```html
<label for="pais">País:</label>
<select name="pais" id="pais" required autocomplete="country">
  <option value="">-- Selecciona tu país --</option>
  <option value="co" selected>Colombia</option>
  <option value="mx">México</option>
  <option value="ar">Argentina</option>
  <option value="es">España</option>
  <option value="us">Estados Unidos</option>
</select>
```

**Atributos de `<select>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `name` | texto | Nombre del campo para el envío. |
| `multiple` | booleano | Permite seleccionar múltiples opciones manteniendo Ctrl/Cmd. Cambia el aspecto de dropdown a listbox. |
| `size` | número | Número de opciones visibles sin scroll. Por defecto `1` (dropdown). |
| `required` | booleano | Requiere que se seleccione una opción con `value` no vacío. |
| `disabled` | booleano | Deshabilita toda la lista. |
| `autocomplete` | texto | Tipo de autocompletado para el campo. |

**Atributos de `<option>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `value` | texto | El valor que se envía al servidor cuando esta opción está seleccionada. Si se omite, se usa el contenido de texto de la opción. |
| `selected` | booleano | Preselecciona esta opción cuando la página carga. |
| `disabled` | booleano | Deshabilita esta opción específica (no puede ser seleccionada). Útil para el placeholder "Selecciona...". |
| `label` | texto | Etiqueta alternativa para mostrar (raramente usado). |

---

### 2.7 Etiqueta `<optgroup>`

`<optgroup>` permite agrupar visualmente las opciones dentro de un `<select>` bajo un encabezado de grupo. Es útil cuando hay muchas opciones que pueden organizarse en categorías.

```html
<label for="ciudad">Ciudad:</label>
<select name="ciudad" id="ciudad">
  <optgroup label="Colombia">
    <option value="bog">Bogotá</option>
    <option value="med">Medellín</option>
    <option value="cal">Cali</option>
  </optgroup>
  <optgroup label="México">
    <option value="cdmx">Ciudad de México</option>
    <option value="gdl">Guadalajara</option>
    <option value="mty">Monterrey</option>
  </optgroup>
  <optgroup label="Argentina" disabled>
    <option value="bue">Buenos Aires</option>
    <option value="cor">Córdoba</option>
  </optgroup>
</select>
```

**Atributos de `<optgroup>`:**

| Atributo | Descripción |
|---|---|
| `label` | **Obligatorio.** Texto del encabezado del grupo. No es seleccionable. |
| `disabled` | Deshabilita todas las opciones del grupo. |

---

### 2.8 Etiqueta `<button>`

La etiqueta `<button>` crea un botón interactivo. A diferencia de `<input type="submit">`, puede contener HTML complejo dentro de él (iconos, imágenes, texto con formato).

```html
<!-- Botón de envío (comportamiento por defecto dentro de un form) -->
<button type="submit">
  <svg><!-- ícono --></svg>
  Enviar formulario
</button>

<!-- Botón de reset -->
<button type="reset">Limpiar</button>

<!-- Botón genérico (no envía el formulario) -->
<button type="button" onclick="abrirModal()">
  Ver detalles
</button>

<!-- Botón deshabilitado -->
<button type="submit" disabled>Procesando...</button>
```

**Atributos de `<button>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `type` | `submit`, `reset`, `button` | Comportamiento del botón. **Si se omite, por defecto es `submit`** dentro de un formulario, lo que puede causar envíos accidentales. Siempre especificar `type`. |
| `disabled` | booleano | Deshabilita el botón. |
| `name` | texto | Nombre del botón para incluirlo en el envío del formulario. |
| `value` | texto | Valor asociado al `name` que se envía al presionar este botón específico. |
| `form` | id de form | Asocia el botón a un formulario fuera de su contenedor. |
| `formaction` | URL | Sobreescribe el `action` del formulario para este botón específico. |
| `formmethod` | `get`, `post` | Sobreescribe el `method` del formulario para este botón. |
| `formenctype` | encoding | Sobreescribe el `enctype` del formulario para este botón. |
| `formnovalidate` | booleano | Deshabilita la validación del formulario para este botón. |
| `autofocus` | booleano | Recibe el foco al cargar la página. |

---

### 2.9 Etiqueta `<fieldset>` y `<legend>`

`<fieldset>` agrupa visualmente y semánticamente un conjunto de controles relacionados dentro de un formulario. Por defecto el navegador dibuja un borde alrededor del grupo. `<legend>` proporciona un título o descripción para el grupo.

Son especialmente importantes para la **accesibilidad** en grupos de radios y checkboxes: el lector de pantalla anunciará el texto del `<legend>` junto con cada control del grupo.

```html
<fieldset>
  <legend>Información personal</legend>
  
  <div>
    <label for="nombres">Nombres:</label>
    <input type="text" id="nombres" name="nombres" required>
  </div>
  
  <div>
    <label for="apellidos">Apellidos:</label>
    <input type="text" id="apellidos" name="apellidos" required>
  </div>
</fieldset>

<fieldset>
  <legend>Método de pago preferido</legend>
  
  <input type="radio" name="pago" id="tarjeta" value="tarjeta">
  <label for="tarjeta">Tarjeta de crédito</label>
  
  <input type="radio" name="pago" id="efectivo" value="efectivo">
  <label for="efectivo">Efectivo</label>
  
  <input type="radio" name="pago" id="transferencia" value="transferencia" checked>
  <label for="transferencia">Transferencia bancaria</label>
</fieldset>
```

**Atributos de `<fieldset>`:**

| Atributo | Descripción |
|---|---|
| `disabled` | Deshabilita todos los controles del grupo. Útil para deshabilitar secciones completas condicionalmente. |
| `name` | Nombre del fieldset para referenciarlo con JavaScript. |
| `form` | Asocia el fieldset a un formulario externo. |

---

### 2.10 Etiqueta `<datalist>`

`<datalist>` proporciona una lista de sugerencias predefinidas para un campo `<input>`. El usuario puede seleccionar una sugerencia o escribir libremente su propio valor (a diferencia de `<select>`, que restringe la elección a las opciones disponibles). Se asocia al input mediante el atributo `list`.

```html
<label for="lenguaje">Lenguaje de programación:</label>
<input 
  type="text"
  id="lenguaje"
  name="lenguaje"
  list="lenguajes-sugeridos"
  placeholder="Escribe o selecciona..."
>
<datalist id="lenguajes-sugeridos">
  <option value="JavaScript">
  <option value="Python">
  <option value="TypeScript">
  <option value="Rust">
  <option value="Go">
  <option value="Java">
  <option value="C++">
</datalist>
```

También funciona con `type="color"`, `type="range"`, `type="date"` y otros tipos para sugerir valores.

---

### 2.11 Etiqueta `<output>`

`<output>` representa el resultado de un cálculo o la salida de una acción del usuario. Se usa típicamente en conjunto con controles de formulario para mostrar resultados dinámicos calculados con JavaScript.

```html
<form id="calculadora" oninput="resultado.value = Number(a.value) + Number(b.value)">
  <input type="number" name="a" id="a" value="0">
  <span>+</span>
  <input type="number" name="b" id="b" value="0">
  <span>=</span>
  <output name="resultado" for="a b">0</output>
</form>
```

**Atributos de `<output>`:**

| Atributo | Descripción |
|---|---|
| `for` | Lista de `id` de los controles cuyos valores produjeron este resultado, separados por espacios. |
| `name` | Nombre del campo para ser referenciado. |
| `form` | Asocia el output a un formulario externo. |

---

### 2.12 Etiqueta `<progress>`

Muestra el progreso de una tarea, como la carga de un archivo o el avance en un proceso. Visualmente se renderiza como una barra de progreso.

```html
<!-- Progreso determinado (con valor conocido) -->
<label for="carga">Cargando archivo:</label>
<progress id="carga" max="100" value="70">70%</progress>

<!-- Progreso indeterminado (sin value = tarea en curso sin fin conocido) -->
<progress>Procesando...</progress>
```

**Atributos de `<progress>`:**

| Atributo | Descripción |
|---|---|
| `max` | Valor total que representa el 100%. Por defecto `1`. |
| `value` | Progreso actual. Debe ser entre `0` y `max`. Si se omite, la barra es indeterminada (animación de "cargando"). |

---

### 2.13 Etiqueta `<meter>`

Representa un valor escalar dentro de un rango conocido, o una medida fraccionaria. A diferencia de `<progress>`, no representa el avance de una tarea sino una medición estática (nivel de batería, uso de disco, puntuación).

```html
<label>Almacenamiento usado:</label>
<meter min="0" max="100" low="25" high="75" optimum="10" value="82">82%</meter>

<label>Puntuación:</label>
<meter min="0" max="10" value="7.4">7.4 de 10</meter>
```

**Atributos de `<meter>`:**

| Atributo | Descripción |
|---|---|
| `value` | El valor numérico actual medido. |
| `min` | Límite inferior del rango. Por defecto `0`. |
| `max` | Límite superior del rango. Por defecto `1`. |
| `low` | Umbral que define el inicio del rango "bajo". Valores por debajo de este pueden mostrarse en color de advertencia. |
| `high` | Umbral que define el inicio del rango "alto". |
| `optimum` | El valor óptimo o ideal. Guía al navegador sobre qué color usar para indicar si el valor es "bueno" o "malo". |

---

### Estructura completa de un formulario bien construido

```html
<form action="/registro" method="POST" novalidate>
  
  <fieldset>
    <legend>Datos personales</legend>
    
    <div class="form-group">
      <label for="nombre">Nombre completo <span aria-hidden="true">*</span></label>
      <input
        type="text"
        id="nombre"
        name="nombre"
        autocomplete="name"
        placeholder="Ej: María García López"
        minlength="3"
        maxlength="100"
        required
        aria-required="true"
        aria-describedby="nombre-error"
      >
      <span id="nombre-error" class="error" role="alert" hidden>
        Por favor ingresa tu nombre completo.
      </span>
    </div>
    
    <div class="form-group">
      <label for="email">Correo electrónico <span aria-hidden="true">*</span></label>
      <input
        type="email"
        id="email"
        name="email"
        autocomplete="email"
        placeholder="tu@correo.com"
        required
        aria-required="true"
      >
    </div>
    
    <div class="form-group">
      <label for="fecha-nac">Fecha de nacimiento</label>
      <input
        type="date"
        id="fecha-nac"
        name="fecha-nacimiento"
        min="1900-01-01"
        max="2006-01-01"
        autocomplete="bday"
      >
    </div>
  </fieldset>
  
  <fieldset>
    <legend>Preferencias</legend>
    
    <div class="form-group">
      <label for="pais">País de residencia</label>
      <select id="pais" name="pais" autocomplete="country">
        <option value="">-- Selecciona --</option>
        <option value="co">Colombia</option>
        <option value="mx">México</option>
      </select>
    </div>
    
    <div class="form-group">
      <p id="notif-label">¿Cómo prefiere recibir notificaciones?</p>
      <div role="group" aria-labelledby="notif-label">
        <input type="radio" name="notificaciones" id="notif-email" value="email" checked>
        <label for="notif-email">Por correo</label>
        
        <input type="radio" name="notificaciones" id="notif-sms" value="sms">
        <label for="notif-sms">Por SMS</label>
      </div>
    </div>
    
    <div class="form-group">
      <label for="bio">Biografía</label>
      <textarea
        id="bio"
        name="bio"
        rows="5"
        maxlength="300"
        placeholder="Cuéntanos algo sobre ti..."
      ></textarea>
    </div>
  </fieldset>
  
  <div class="form-group">
    <input type="checkbox" id="terminos" name="terminos" value="aceptado" required>
    <label for="terminos">
      Acepto los <a href="/terminos">términos y condiciones</a>
    </label>
  </div>
  
  <input type="hidden" name="csrf" value="token-secreto-123">
  
  <div class="form-actions">
    <button type="reset">Limpiar</button>
    <button type="submit">Crear cuenta</button>
  </div>
  
</form>
```

---

## 3. Etiquetas de Tablas

### 3.1 ¿Qué es una Tabla en HTML?

Una **tabla HTML** es una estructura de datos bidimensional organizada en filas y columnas, diseñada para presentar información **tabular**: datos que tienen una relación lógica entre sí y que se benefician de ser visualizados en una cuadrícula.

Las tablas HTML son apropiadas para mostrar:
- Horarios y calendarios
- Comparaciones de productos o servicios
- Datos estadísticos y reportes
- Precios, tarifas o planes
- Resultados de búsqueda estructurados
- Información de contactos o inventarios

**¿Cuándo NO usar tablas?**

Históricamente, antes de que CSS madurara, los desarrolladores usaban tablas para crear el layout (estructura) visual de las páginas web. Esta práctica está completamente obsoleta y es considerada un error grave en el desarrollo moderno. Las tablas deben usarse **exclusivamente para datos tabulares**, nunca para maquetación. El layout debe hacerse con CSS (Flexbox, Grid).

---

### 3.2 Etiqueta `<table>`

`<table>` es el elemento contenedor principal de toda la estructura de la tabla. Todos los demás elementos de tabla deben estar anidados dentro de este elemento.

```html
<table>
  <!-- contenido de la tabla -->
</table>
```

**Atributos relevantes de `<table>`:**

| Atributo | Descripción |
|---|---|
| `summary` | (Obsoleto en HTML5) Descripción de la tabla para lectores de pantalla. Reemplazado por `<caption>` y `aria-describedby`. |
| `border` | (Obsoleto) Grosor del borde. Usar CSS en su lugar. |
| `cellpadding` | (Obsoleto) Espacio interno en celdas. Usar CSS en su lugar. |
| `cellspacing` | (Obsoleto) Espacio entre celdas. Usar CSS `border-collapse` en su lugar. |
| `width` | (Obsoleto) Anchura de la tabla. Usar CSS en su lugar. |

> **Importante:** En HTML5, todos los atributos de presentación de `<table>` están obsoletos. Todo el estilo visual debe controlarse con CSS.

**Atributos de accesibilidad:**

```html
<table aria-describedby="descripcion-tabla">
  <caption>Ventas por trimestre 2024</caption>
  <!-- ... -->
</table>
<p id="descripcion-tabla">
  La siguiente tabla muestra las cifras de ventas trimestrales del año 2024,
  desglosadas por región geográfica.
</p>
```

---

### 3.3 Etiqueta `<thead>`

`<thead>` (Table Head) define la sección de **encabezado** de la tabla. Contiene las filas que describen el significado de cada columna. Generalmente incluye una o más filas `<tr>` con celdas de encabezado `<th>`.

**¿Por qué usar `<thead>`?**
- Semántica: distingue claramente las filas de encabezado del cuerpo de datos.
- Accesibilidad: los lectores de pantalla pueden anunciar el encabezado de columna antes de leer cada celda de datos.
- Funcionalidad: cuando una tabla larga se imprime, el navegador puede repetir las filas de `<thead>` en cada página impresa automáticamente.
- Estilo: permite aplicar CSS específicamente a las filas de encabezado sin necesidad de clases.

```html
<table>
  <thead>
    <tr>
      <th scope="col">Producto</th>
      <th scope="col">Precio</th>
      <th scope="col">Stock</th>
      <th scope="col">Categoría</th>
    </tr>
  </thead>
  <!-- ... -->
</table>
```

---

### 3.4 Etiqueta `<tbody>`

`<tbody>` (Table Body) define la sección del **cuerpo** de la tabla, que contiene los datos principales. Una tabla puede tener múltiples `<tbody>` para agrupar filas lógicamente relacionadas.

```html
<table>
  <thead><!-- ... --></thead>
  <tbody>
    <tr>
      <td>Laptop Pro 15"</td>
      <td>$1,299</td>
      <td>45</td>
      <td>Computadores</td>
    </tr>
    <tr>
      <td>Mouse Inalámbrico</td>
      <td>$35</td>
      <td>230</td>
      <td>Accesorios</td>
    </tr>
  </tbody>
</table>
```

Aunque `<tbody>` es opcional (el navegador lo añade automáticamente al parsear), su uso explícito mejora la legibilidad y la semántica. Usar múltiples `<tbody>` permite agrupar filas:

```html
<tbody>
  <tr><td colspan="4"><strong>Categoría: Computadores</strong></td></tr>
  <tr><td>Laptop</td><td>...</td><td>...</td><td>...</td></tr>
</tbody>
<tbody>
  <tr><td colspan="4"><strong>Categoría: Accesorios</strong></td></tr>
  <tr><td>Mouse</td><td>...</td><td>...</td><td>...</td></tr>
</tbody>
```

---

### 3.5 Etiqueta `<tfoot>`

`<tfoot>` (Table Foot) define la sección del **pie** de la tabla, que contiene filas de resumen, totales, o notas sobre los datos. Aunque en el HTML puede aparecer antes de `<tbody>`, el navegador siempre lo renderiza al final visualmente.

```html
<table>
  <thead>
    <tr>
      <th>Producto</th>
      <th>Cantidad</th>
      <th>Precio Unit.</th>
      <th>Subtotal</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Laptop</td>
      <td>2</td>
      <td>$1,299</td>
      <td>$2,598</td>
    </tr>
    <tr>
      <td>Mouse</td>
      <td>5</td>
      <td>$35</td>
      <td>$175</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td colspan="3"><strong>Total:</strong></td>
      <td><strong>$2,773</strong></td>
    </tr>
  </tfoot>
</table>
```

---

### 3.6 Etiqueta `<tr>`

`<tr>` (Table Row) define una **fila** en la tabla. Es el contenedor de celdas (`<th>` o `<td>`). Debe ser hijo directo de `<thead>`, `<tbody>` o `<tfoot>`.

```html
<tr>
  <td>Celda 1</td>
  <td>Celda 2</td>
  <td>Celda 3</td>
</tr>
```

Todos los atributos de presentación de `<tr>` están obsoletos en HTML5 (`align`, `valign`, `bgcolor`). Se controlan con CSS.

---

### 3.7 Etiqueta `<th>`

`<th>` (Table Header cell) define una **celda de encabezado**. Por defecto, el navegador muestra su contenido en negrita y centrado para distinguirla visualmente de las celdas de datos. Su función es describir el contenido de las columnas o filas.

El atributo `scope` es crítico para la accesibilidad, ya que indica a qué celdas se aplica el encabezado:

```html
<!-- Encabezados de columna -->
<thead>
  <tr>
    <th scope="col">Nombre</th>
    <th scope="col">Email</th>
    <th scope="col">Rol</th>
  </tr>
</thead>

<!-- Encabezados de fila -->
<tbody>
  <tr>
    <th scope="row">Lunes</th>
    <td>Matemáticas</td>
    <td>Física</td>
  </tr>
  <tr>
    <th scope="row">Martes</th>
    <td>Historia</td>
    <td>Biología</td>
  </tr>
</tbody>
```

**Atributos de `<th>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `scope` | `col`, `row`, `colgroup`, `rowgroup` | **Muy importante para accesibilidad.** Indica si el encabezado aplica a una columna (`col`), una fila (`row`), un grupo de columnas (`colgroup`) o un grupo de filas (`rowgroup`). |
| `abbr` | texto | Versión abreviada del encabezado, usada por lectores de pantalla en tablas complejas. |
| `colspan` | número | Número de columnas que ocupa esta celda (fusión horizontal). Por defecto `1`. |
| `rowspan` | número | Número de filas que ocupa esta celda (fusión vertical). Por defecto `1`. |
| `headers` | lista de ids | Lista de ids de los `<th>` que encabezan esta celda, para tablas muy complejas. |

---

### 3.8 Etiqueta `<td>`

`<td>` (Table Data cell) define una **celda de datos**. Es donde va la información real de la tabla. Es el elemento más común en el cuerpo de una tabla.

```html
<tbody>
  <tr>
    <td>001</td>
    <td>Ana García</td>
    <td>ana@ejemplo.com</td>
    <td>Administradora</td>
  </tr>
</tbody>
```

**Atributos de `<td>`:**

| Atributo | Valores | Descripción |
|---|---|---|
| `colspan` | número | Número de columnas que ocupa (fusión horizontal). Útil para celdas que abarcan múltiples columnas. |
| `rowspan` | número | Número de filas que ocupa (fusión vertical). Útil para celdas que abarcan múltiples filas. |
| `headers` | lista de ids | Referencia a los `<th>` que corresponden a esta celda, para tablas complejas con múltiples niveles de encabezados. |

**Ejemplo de `colspan` y `rowspan`:**

```html
<table>
  <thead>
    <tr>
      <th rowspan="2" scope="col">Empleado</th>
      <th colspan="2" scope="colgroup">Primer semestre</th>
      <th colspan="2" scope="colgroup">Segundo semestre</th>
    </tr>
    <tr>
      <th scope="col">Q1</th>
      <th scope="col">Q2</th>
      <th scope="col">Q3</th>
      <th scope="col">Q4</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Carlos Pérez</th>
      <td>$12,000</td>
      <td>$15,000</td>
      <td>$14,000</td>
      <td>$18,000</td>
    </tr>
  </tbody>
</table>
```

---

### 3.9 Etiqueta `<caption>`

`<caption>` proporciona un **título o descripción** para la tabla. Debe ser el primer elemento hijo de `<table>`. Es esencial para la accesibilidad porque describe el propósito de la tabla.

```html
<table>
  <caption>
    Rendimiento de ventas por región — Año fiscal 2024
  </caption>
  <thead><!-- ... --></thead>
  <tbody><!-- ... --></tbody>
</table>
```

Por defecto el navegador centra el caption encima de la tabla. Se puede mover con CSS:

```css
caption {
  caption-side: bottom; /* top (default) o bottom */
  text-align: left;
  font-style: italic;
}
```

---

### 3.10 Etiqueta `<colgroup>` y `<col>`

`<colgroup>` (Column Group) permite agrupar una o más columnas de la tabla para aplicarles estilos CSS en conjunto. `<col>` representa una columna individual dentro del grupo. Se colocan antes de `<caption>` si existe, o como primer hijo de `<table>`.

```html
<table>
  <caption>Estadísticas del equipo</caption>
  <colgroup>
    <col style="background-color: #f0f4ff; width: 200px;">  <!-- Primera columna -->
    <col span="3" style="width: 100px; text-align: right;"> <!-- Columnas 2, 3 y 4 -->
    <col style="background-color: #fff3cd; font-weight: bold;"> <!-- Última columna -->
  </colgroup>
  <thead>
    <tr>
      <th scope="col">Jugador</th>
      <th scope="col">Goles</th>
      <th scope="col">Asistencias</th>
      <th scope="col">Partidos</th>
      <th scope="col">Promedio</th>
    </tr>
  </thead>
  <tbody><!-- filas de datos --></tbody>
</table>
```

**Atributos de `<col>`:**

| Atributo | Descripción |
|---|---|
| `span` | Número de columnas a las que aplica este `<col>`. Por defecto `1`. |
| `style` | Estilos CSS a aplicar a la columna (opciones limitadas: `background-color`, `border`, `visibility`, `width`). |

> **Nota:** `<col>` solo soporta un subconjunto limitado de propiedades CSS. Para estilos más complejos es mejor usar clases en las celdas directamente.

---

### 3.11 Estructura Completa de una Tabla

```html
<figure>
  <table>
    <caption>
      Comparativa de planes de suscripción — Precios en USD/mes
    </caption>
    
    <colgroup>
      <col style="width: 200px;">
      <col span="3" style="width: 120px; text-align: center;">
    </colgroup>
    
    <thead>
      <tr>
        <th scope="col">Característica</th>
        <th scope="col">Básico</th>
        <th scope="col">Pro</th>
        <th scope="col">Empresarial</th>
      </tr>
    </thead>
    
    <tbody>
      <tr>
        <th scope="row">Precio mensual</th>
        <td>$9.99</td>
        <td>$29.99</td>
        <td>$99.99</td>
      </tr>
      <tr>
        <th scope="row">Usuarios incluidos</th>
        <td>1</td>
        <td>5</td>
        <td>Ilimitados</td>
      </tr>
      <tr>
        <th scope="row">Almacenamiento</th>
        <td>5 GB</td>
        <td>50 GB</td>
        <td>1 TB</td>
      </tr>
      <tr>
        <th scope="row">Soporte técnico</th>
        <td>Email</td>
        <td>Email + Chat</td>
        <td>24/7 Prioritario</td>
      </tr>
      <tr>
        <th scope="row">API Access</th>
        <td aria-label="No disponible">—</td>
        <td>Limitada</td>
        <td>Completa</td>
      </tr>
    </tbody>
    
    <tfoot>
      <tr>
        <td colspan="4">
          * Los precios no incluyen impuestos locales aplicables.
          Todos los planes incluyen 14 días de prueba gratuita.
        </td>
      </tr>
    </tfoot>
  </table>
  <figcaption>
    Tabla actualizada en diciembre de 2024. Sujeto a cambios sin previo aviso.
  </figcaption>
</figure>
```

---

## 4. Nomenclatura de Carpetas y Archivos

### 4.1 ¿Por qué importa la nomenclatura?

La **nomenclatura** (naming convention) en el contexto de desarrollo de software se refiere a las reglas y convenciones que definen cómo se deben nombrar archivos, carpetas, variables, funciones, clases y cualquier otro identificador en el código.

Tener una nomenclatura consistente y bien elegida no es un capricho estético; es una práctica de ingeniería con consecuencias directas y medibles en la calidad del software:

**1. Legibilidad y comprensión del código:**  
Un nombre descriptivo y consistente comunica el propósito de un archivo o variable de forma inmediata. `user-profile-settings.css` es instantáneamente comprensible; `ups.css` o `archivo3.css` no lo son.

**2. Colaboración en equipo:**  
En proyectos con múltiples desarrolladores, las convenciones de nomenclatura evitan que cada persona use su propio estilo, lo que resultaría en una base de código inconsistente y difícil de navegar. Los equipos profesionales documentan sus convenciones en guías de estilo o `CONTRIBUTING.md`.

**3. Compatibilidad entre sistemas operativos:**  
Los sistemas de archivos de diferentes sistemas operativos tienen distintas reglas. En **Linux y macOS** los sistemas de archivos son sensibles a mayúsculas (`archivo.html` y `Archivo.html` son archivos distintos). En **Windows** los sistemas de archivos son generalmente insensibles a mayúsculas. Esto puede causar bugs difíciles de detectar: un archivo funciona localmente en Windows pero falla en producción en un servidor Linux.

**4. URLs y rutas web:**  
Las URLs son procesadas por servidores Linux, por lo que son sensibles a mayúsculas. Las URLs amigables para SEO y usuarios deben ser en minúsculas, con separación clara de palabras. `my-blog-post` es mejor URL que `MyBlogPost` o `my_blog_post`.

**5. Compatibilidad con herramientas:**  
Algunos frameworks, bundlers y herramientas de build tienen expectativas específicas sobre la nomenclatura de archivos (React espera componentes en PascalCase, algunos módulos CSS esperan kebab-case, etc.).

---

### 4.2 kebab-case

**kebab-case** (también llamado *spinal-case*, *dash-case* o *hyphen-case*) es una convención de nomenclatura en la que todas las palabras se escriben en **minúsculas** y se separan por **guiones medios** (`-`).

El nombre "kebab" viene de la analogía visual: las palabras ensartadas en el guión como ingredientes en un pincho de kebab.

**Formato:**
```
mi-archivo-de-estilos.css
user-profile-card.html
api-response-handler.js
```

**Características:**

- Todas las letras en **minúsculas** (sin excepción).
- Palabras separadas con **guión medio** (`-`).
- No usa espacios, guiones bajos, ni mayúsculas en ningún lugar.
- Es **legible** porque el guión actúa como separador visual claro.

**¿Dónde se usa kebab-case?**

**Archivos HTML, CSS y assets web:**  
```
index.html
about-us.html
contact-form.html
main-styles.css
hero-section.css
user-avatar.png
background-pattern.svg
```

**URLs y rutas de navegación:**  
Las URLs en kebab-case son las favoritas de Google para el SEO porque son legibles, fáciles de compartir, y los motores de búsqueda las prefieren para separar palabras clave. Los guiones en las URLs son interpretados como separadores de palabras.
```
https://misitio.com/blog/introduccion-a-javascript
https://misitio.com/productos/zapatos-deportivos
https://misitio.com/sobre-nosotros
```

**Paquetes de npm:**  
```
react-dom
lodash-es
date-fns
express-validator
```

**Carpetas de proyectos web:**  
```
src/
├── components/
│   ├── user-card/
│   ├── navigation-bar/
│   └── hero-section/
├── pages/
│   ├── about-us/
│   └── contact-form/
└── assets/
    ├── images/
    └── fonts/
```

**Clases CSS:**  
La metodología BEM (Block Element Modifier) usa kebab-case para bloques y elementos:
```css
.navigation-bar { }
.navigation-bar__menu-item { }
.navigation-bar__menu-item--active { }
```

**Propiedades CSS personalizadas:**
```css
:root {
  --primary-color: #3B82F6;
  --font-size-large: 1.25rem;
  --border-radius-default: 4px;
}
```

**¿Por qué preferir kebab-case en archivos web?**

- Es la convención estándar de la web.
- Evita problemas de sensibilidad a mayúsculas en servidores Linux.
- Los espacios no son válidos en URLs; los guiones sí.
- Google y otros buscadores tratan los guiones como separadores de palabras.
- Es fácil de leer y escribir.

---

### 4.3 snake_case

**snake_case** es una convención de nomenclatura en la que todas las palabras se escriben en **minúsculas** y se separan con **guiones bajos** (`_`). El nombre "snake" (serpiente) hace referencia a cómo el guión bajo "rastrea" por el suelo entre las palabras, como una serpiente.

**Formato:**
```
mi_archivo.py
user_profile.json
api_response_handler.go
database_connection.rb
```

**Características:**

- Todas las letras en **minúsculas** (por convención, aunque existe `SCREAMING_SNAKE_CASE` para constantes).
- Palabras separadas con **guión bajo** (`_`).
- Sin espacios ni guiones medios.

**¿Dónde se usa snake_case?**

**Python — el lenguaje que más lo usa:**  
La guía de estilo oficial de Python ([PEP 8](https://pep8.org/)) recomienda snake_case para nombres de variables, funciones, métodos, módulos y paquetes:

```python
# Variables
user_name = "Ana García"
total_price = 149.99
is_authenticated = True

# Funciones
def calculate_total_price(unit_price, quantity, discount_rate):
    subtotal = unit_price * quantity
    return subtotal * (1 - discount_rate)

# Módulos y archivos Python
# database_connector.py
# user_authentication.py
# data_validation.py
```

**Ruby:**  
Ruby también usa snake_case por convención para variables y métodos.

```ruby
def calculate_monthly_payment(principal, annual_rate, months)
  monthly_rate = annual_rate / 12
  # ...
end
```

**Bases de datos — nombres de tablas y columnas:**  
En SQL (y en general en bases de datos relacionales), snake_case es la convención más extendida:

```sql
CREATE TABLE user_accounts (
    user_id        INTEGER PRIMARY KEY,
    first_name     VARCHAR(50) NOT NULL,
    last_name      VARCHAR(50) NOT NULL,
    email_address  VARCHAR(100) UNIQUE NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active      BOOLEAN DEFAULT TRUE
);

SELECT user_id, first_name, email_address 
FROM user_accounts 
WHERE is_active = TRUE;
```

**Nombres de archivos en Python:**

```
src/
├── models/
│   ├── user_model.py
│   └── product_model.py
├── controllers/
│   ├── user_controller.py
│   └── auth_controller.py
└── utils/
    ├── date_helpers.py
    └── string_validators.py
```

**JSON y configuración:**  
Muchas APIs y archivos de configuración usan snake_case para sus claves:
```json
{
  "user_id": 1234,
  "first_name": "Carlos",
  "last_name": "Pérez",
  "email_address": "carlos@ejemplo.com",
  "is_verified": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**SCREAMING_SNAKE_CASE:**  
Una variante especial que usa snake_case pero en **mayúsculas**. Se usa universalmente para constantes, variables de entorno y valores que no cambian:

```python
# Python - constantes
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT_SECONDS = 30
DATABASE_CONNECTION_STRING = "postgresql://localhost:5432/mydb"

# JavaScript - constantes
const MAX_FILE_SIZE_MB = 10;
const API_BASE_URL = "https://api.ejemplo.com/v1";
```

```bash
# Variables de entorno (.env)
DATABASE_URL=postgresql://user:password@localhost/myapp
SECRET_KEY=mi-clave-secreta-larga
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

---

### 4.4 PascalCase

**PascalCase** (también llamado *UpperCamelCase* o *StudlyCase*) es una convención en la que la **primera letra de cada palabra se escribe en mayúscula** y no hay separadores entre palabras. Todas las palabras se "fusionan" con sus iniciales en mayúscula.

Se llama "Pascal" porque popularizó su uso el lenguaje de programación Pascal, creado por Niklaus Wirth en los 70.

**Formato:**
```
UserProfile
ShoppingCart
NavigationBar
ApiResponseHandler
```

**Características:**

- La **primera letra de cada palabra** va en mayúscula.
- Sin espacios, guiones ni guiones bajos.
- Incluidas las palabras que serían artículos o preposiciones si forman parte del nombre (aunque en la práctica se omiten artículos cortos).

**¿Dónde se usa PascalCase?**

**Clases en casi todos los lenguajes de programación:**  
PascalCase es la convención casi universal para nombres de clases:

```javascript
// JavaScript / TypeScript
class UserAuthentication {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }
  
  validateCredentials() { /* ... */ }
}

class ShoppingCartItem {
  constructor(productId, quantity, unitPrice) {
    this.productId = productId;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
  }
  
  get subtotal() {
    return this.quantity * this.unitPrice;
  }
}
```

```python
# Python
class DatabaseConnection:
    def __init__(self, host, port, database):
        self.host = host
        self.port = port
        self.database = database
    
    def connect(self):
        pass

class UserAuthenticationService:
    def login(self, email, password):
        pass
    
    def logout(self, user_id):
        pass
```

**Componentes de React:**  
En React, los componentes **deben** nombrarse en PascalCase. Esta es una regla funcional (no solo de estilo): React distingue entre componentes personalizados y elementos HTML nativos precisamente por la capitalización del nombre.

```jsx
// ✅ Correcto: PascalCase — React lo trata como componente
function UserProfileCard({ user }) {
  return (
    <div className="user-card">
      <Avatar src={user.avatar} />
      <UserInfo name={user.name} email={user.email} />
    </div>
  );
}

// Los archivos de componentes React también van en PascalCase
// UserProfileCard.jsx
// NavigationBar.tsx
// ShoppingCartModal.jsx
// ProductImageGallery.tsx
```

```
src/
├── components/
│   ├── UserCard.jsx
│   ├── NavigationBar.jsx
│   ├── ProductList.jsx
│   ├── ShoppingCart.jsx
│   └── HeroSection.jsx
├── pages/
│   ├── HomePage.jsx
│   ├── AboutPage.jsx
│   └── ContactPage.jsx
└── hooks/
    ├── useAuth.js
    └── useCart.js
```

**Interfaces y tipos en TypeScript:**

```typescript
interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  createdAt: Date;
}

type ApiResponse<T> = {
  data: T;
  statusCode: number;
  message: string;
  isSuccess: boolean;
};

enum UserRole {
  Administrator = "ADMINISTRATOR",
  Editor = "EDITOR",
  Viewer = "VIEWER",
}
```

**Namespaces y módulos en C#, Java, C++:**

```csharp
// C#
namespace UserManagement.Authentication {
    public class TokenValidator {
        public bool ValidateToken(string token) { /* ... */ }
    }
}
```

**Por qué PascalCase para clases y componentes:**
- Diferencia visualmente las clases/constructores de funciones y variables.
- Es una convención tan universal que es comprendida inmediatamente por cualquier desarrollador.
- En React, es funcionalmente necesario para que el framework identifique correctamente los componentes.

---

### 4.5 camelCase

**camelCase** (también llamado *lowerCamelCase*) es similar a PascalCase, pero la **primera letra del nombre completo va en minúscula**. Las primeras letras de las palabras subsiguientes van en mayúscula. El nombre "camel" alude a las "jorobas" que forman las mayúsculas en el medio del nombre.

**Formato:**
```
myVariable
calculateTotalPrice
getUserProfile
isAuthenticated
```

**Características:**

- La **primera letra del nombre completo** va en **minúscula**.
- La **primera letra de cada palabra siguiente** va en **mayúscula**.
- Sin espacios, guiones ni guiones bajos.
- Es la "versión minúscula" del PascalCase.

**¿Dónde se usa camelCase?**

**Variables y funciones en JavaScript/TypeScript:**  
camelCase es la convención estándar en JavaScript para nombrar variables, funciones, métodos y parámetros:

```javascript
// Variables
let userName = "Ana";
const maxRetryCount = 3;
let isUserLoggedIn = false;
let totalCartAmount = 0;

// Funciones
function getUserById(userId) {
  return fetch(`/api/users/${userId}`);
}

function calculateShippingCost(weight, destination, isFreeShipping) {
  if (isFreeShipping) return 0;
  return weight * getShippingRate(destination);
}

// Métodos de objeto
const userService = {
  findByEmail(email) { /* ... */ },
  createNewAccount(userData) { /* ... */ },
  updatePassword(userId, newPassword) { /* ... */ }
};
```

**Propiedades de objetos JavaScript:**

```javascript
const userAccount = {
  userId: 42,
  firstName: "María",
  lastName: "González",
  emailAddress: "maria@ejemplo.com",
  dateOfBirth: new Date("1990-05-15"),
  isEmailVerified: true,
  lastLoginDate: new Date()
};
```

**Hooks de React:**  
Los hooks personalizados en React usan camelCase con el prefijo `use`:

```javascript
function useShoppingCart() {
  const [cartItems, setCartItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  
  const addItem = (product) => { /* ... */ };
  const removeItem = (productId) => { /* ... */ };
  const clearCart = () => { /* ... */ };
  
  return { cartItems, totalAmount, addItem, removeItem, clearCart };
}
```

**Métodos en Java:**  
Java usa PascalCase para clases y camelCase para métodos y variables:

```java
public class UserAuthenticationService {
    
    private String secretKey;
    private int maxLoginAttempts;
    
    public boolean validateUserCredentials(String email, String password) {
        // lógica de validación
    }
    
    public String generateAccessToken(User user) {
        // generar token
    }
    
    private boolean isPasswordExpired(Date lastPasswordChange) {
        // verificar expiración
    }
}
```

**Propiedades de objetos JSON (en APIs JavaScript):**  
Muchas APIs REST que sirven a aplicaciones JavaScript usan camelCase en sus respuestas:

```json
{
  "userId": 1234,
  "firstName": "Carlos",
  "lastName": "Martínez",
  "emailAddress": "carlos@ejemplo.com",
  "isEmailVerified": true,
  "lastLoginDate": "2024-12-01T14:30:00Z",
  "profilePictureUrl": "https://cdn.ejemplo.com/avatars/1234.jpg"
}
```

**Atributos de eventos y props en JSX/HTML:**

```jsx
// Eventos en JSX usan camelCase
<button 
  onClick={handleButtonClick}
  onMouseEnter={handleHoverStart}
  onKeyDown={handleKeyboardInput}
>
  Clic aquí
</button>

// Props personalizadas en componentes React
<UserCard 
  userId={42}
  firstName="Ana"
  isActive={true}
  onProfileClick={handleProfileClick}
/>
```

---

### 4.6 Tabla Comparativa

| Convención | Formato | Ejemplo | Usos principales |
|---|---|---|---|
| **kebab-case** | palabras-en-minúsculas-con-guiones | `user-profile-card.css` | Archivos HTML/CSS/assets, URLs, paquetes npm, ramas de Git, variables CSS personalizadas, clases CSS |
| **snake_case** | palabras_en_minúsculas_con_guiones_bajos | `calculate_total_price` | Python (variables, funciones, archivos), Ruby, bases de datos SQL, variables de entorno, JSON de APIs en lenguajes no-JS |
| **SCREAMING_SNAKE_CASE** | CONSTANTES_EN_MAYÚSCULAS | `MAX_RETRY_ATTEMPTS` | Constantes, variables de entorno, configuración fija |
| **PascalCase** | PrimeraLetraDeCadaPalabraEnMayúscula | `UserProfileCard` | Clases (todos los lenguajes), componentes React, interfaces TypeScript, tipos, enums, archivos de componentes |
| **camelCase** | primeraLetraMinúsculaResto EnMayúsculas | `calculateTotalPrice` | Variables y funciones en JS/TS/Java/C#, props de React, hooks, métodos de objetos, propiedades JSON |

**Guía rápida de decisión:**

```
¿Es un archivo HTML, CSS, imagen, o URL?
  → kebab-case: user-profile.html, main-styles.css

¿Es un componente de React o una clase?
  → PascalCase: UserCard.jsx, class DatabaseService

¿Es una variable o función en JavaScript/TypeScript?
  → camelCase: const userName, function getUser()

¿Es código Python, o un campo de base de datos?
  → snake_case: user_name, calculate_total()

¿Es una constante o variable de entorno?
  → SCREAMING_SNAKE_CASE: MAX_CONNECTIONS, DATABASE_URL
```

---

## Referencias y recursos

- [MDN Web Docs — HTML](https://developer.mozilla.org/es/docs/Web/HTML)
- [MDN Web Docs — Formularios HTML](https://developer.mozilla.org/es/docs/Learn/Forms)
- [MDN Web Docs — Tablas HTML](https://developer.mozilla.org/es/docs/Learn/HTML/Tables)
- [W3C — HTML Living Standard](https://html.spec.whatwg.org/)
- [Google — Guía de inicio para SEO](https://developers.google.com/search/docs)
- [PEP 8 — Guía de estilo para Python](https://pep8.org/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [WebAIM — Accesibilidad web](https://webaim.org/)

---

*Documentación generada para uso educativo y de referencia técnica.*
